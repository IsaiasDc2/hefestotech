"""HefestoTech · backend/checkout_api.py
Checkout con cálculo en servidor + webhook de Mercado Pago.

- POST /api/checkout/crear: recalcula precios/stock/envío desde la DB
  (service_role), crea la orden en `pendiente`, reserva stock con
  `adjust_stock` (motivo `reserva`) y crea la preferencia de MP con
  `external_reference = orden_id`. Devuelve {orden_id, init_point}.
  El cliente NUNCA envía precios ni totales: solo producto_id + cantidad.
- POST /api/webhooks/mercadopago: valida firma HMAC (x-signature, tiempo
  constante), idempotencia (eventos_webhook), consulta el pago a la API de
  MP, verifica monto, confirma (reclasifica reserva→venta, emite
  comprobante) o cancela con liberación de stock. Reintentos seguros.
- POST /api/checkout/liberar-expiradas: cancela pendientes con expira_at
  vencida (>60 min) liberando la reserva.
- GET /api/checkout/estado/{id}: estado real de la orden (el front lo usa
  al volver de MP en vez de inventar estados).

Patrones espejo de admin_api.py: REST a Supabase con service_role, RPC,
montos en centavos enteros, rate-limit en memoria, errores genéricos.
No se loguean ni devuelven secretos. /api/crear-preferencia (main.py)
queda intacto (flujo MP sandbox existente).
"""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, field_validator

router = APIRouter()

# ------------------------------------------------- constantes de negocio ---
# Pesos ARS en centavos (el front los usa solo para ESTIMAR lo visible;
# el total que se cobra sale de acá).
UMBRAL_ENVIO_GRATIS_CENT = 150_000 * 100
ENVIO_ESTANDAR_CENT = 5_000 * 100
ENVIO_EXPRESS_CENT = 12_000 * 100
ENVIOS_VALIDOS = {"estandar", "express"}
EXPIRA_MINUTOS = 60

_MP_HOSTS = (
    "mercadopago.com",
    "mercadopago.com.ar",
    "mercadolibre.com",
)


def _es_url_mp(url: str) -> bool:
    try:
        from urllib.parse import urlparse

        u = urlparse(url)
        host = (u.hostname or "").lower()
        return u.scheme == "https:" and any(
            host == h or host.endswith(f".{h}") for h in _MP_HOSTS
        )
    except Exception:
        return False


# ------------------------------------------------------------ supabase ---
def _env() -> tuple[str, str]:
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise HTTPException(status_code=503, detail="Backend sin conexión a la base de datos.")
    return url, key


_cliente: Optional[httpx.Client] = None


def _client() -> httpx.Client:
    global _cliente
    if _cliente is None:
        url, key = _env()
        _cliente = httpx.Client(
            base_url=f"{url}/rest/v1",
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
            timeout=15.0,
        )
    return _cliente


_ERRORES_SEGUROS = {
    "cupón inexistente", "cupón inactivo", "cupón vencido", "cupón agotado",
    "no alcanza el mínimo de compra", "porcentaje inválido", "subtotal inválido",
    "stock insuficiente", "delta no puede ser cero",
    "producto inexistente o en papelera", "pedido inexistente",
    "conflicto de versión: recargá el pedido",
}


def _mensaje_seguro(detalle: str) -> str:
    for seguro in _ERRORES_SEGUROS:
        if seguro in (detalle or ""):
            return seguro
    if "transición inválida" in (detalle or ""):
        return "La orden ya fue procesada."
    return "Operación no disponible. Intentá de nuevo más tarde."


def _sb_error(exc: httpx.HTTPStatusError) -> HTTPException:
    try:
        detalle = exc.response.json().get("message", "")
    except Exception:
        detalle = ""
    print(f"ERROR checkout_api: supabase {exc.response.status_code}.")
    return HTTPException(status_code=502, detail=_mensaje_seguro(str(detalle)))


def _sb_get(tabla: str, params: dict[str, Any]) -> Any:
    try:
        r = _client().get(f"/{tabla}", params=params)
        r.raise_for_status()
        return r.json()
    except httpx.HTTPStatusError as e:
        raise _sb_error(e)
    except httpx.HTTPError:
        print("ERROR checkout_api: fallo de red hacia supabase.")
        raise HTTPException(status_code=502, detail="No se pudo consultar la base de datos.")


def _sb_post(tabla: str, fila: dict[str, Any], prefer: str = "return=representation") -> Any:
    try:
        r = _client().post(f"/{tabla}", json=fila, headers={"Prefer": prefer})
        r.raise_for_status()
        return r.json()
    except httpx.HTTPStatusError as e:
        raise _sb_error(e)
    except httpx.HTTPError:
        print("ERROR checkout_api: fallo de red hacia supabase.")
        raise HTTPException(status_code=502, detail="No se pudo guardar en la base de datos.")


def _sb_patch(tabla: str, params: dict[str, Any], cambios: dict[str, Any]) -> Any:
    try:
        r = _client().patch(f"/{tabla}", params=params, json=cambios,
                            headers={"Prefer": "return=representation"})
        r.raise_for_status()
        return r.json()
    except httpx.HTTPStatusError as e:
        raise _sb_error(e)
    except httpx.HTTPError:
        print("ERROR checkout_api: fallo de red hacia supabase.")
        raise HTTPException(status_code=502, detail="No se pudo guardar en la base de datos.")


def _rpc(funcion: str, args: dict[str, Any]) -> Any:
    try:
        r = _client().post(f"/rpc/{funcion}", json=args)
        r.raise_for_status()
        return r.json()
    except httpx.HTTPStatusError as e:
        raise _sb_error(e)
    except httpx.HTTPError:
        print("ERROR checkout_api: fallo de red hacia supabase (rpc).")
        raise HTTPException(status_code=502, detail="No se pudo completar la operación.")


def _insertar_crudo(tabla: str, fila: dict[str, Any]) -> tuple[bool, Any]:
    """POST crudo. Devuelve (creado, filas). creado=False si hubo 409."""
    try:
        r = _client().post(f"/{tabla}", json=fila,
                           headers={"Prefer": "return=representation"})
        r.raise_for_status()
        return True, r.json()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 409:
            return False, []
        raise _sb_error(e)
    except httpx.HTTPError:
        print("ERROR checkout_api: fallo de red hacia supabase.")
        raise HTTPException(status_code=502, detail="No se pudo guardar en la base de datos.")


# ------------------------------------------------------------------ auth ---
def _uid_desde_bearer(authorization: Optional[str]) -> Optional[str]:
    """JWT opcional: None = invitado. Header presente pero inválido = 401."""
    if not authorization:
        return None
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Sesión inválida o vencida.")
    bearer = authorization.split(" ", 1)[1].strip()
    if not bearer:
        raise HTTPException(status_code=401, detail="Sesión inválida o vencida.")
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise HTTPException(status_code=503, detail="Backend sin conexión a la base de datos.")
    try:
        r = httpx.get(f"{url}/auth/v1/user",
                      headers={"apikey": key, "Authorization": f"Bearer {bearer}"},
                      timeout=10.0)
    except httpx.HTTPError:
        print("ERROR checkout_api: fallo validando sesión.")
        raise HTTPException(status_code=503, detail="No se pudo validar la sesión.")
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Sesión inválida o vencida.")
    try:
        uid = r.json().get("id", "")
    except Exception:
        uid = ""
    if not uid:
        raise HTTPException(status_code=401, detail="Sesión inválida o vencida.")
    return uid


# ------------------------------------------------------------- rate limit ---
_LIMITE_VENTANA_SEG = 60
_registro: dict[str, deque] = defaultdict(deque)


def _limitar(ip: str, clave: str, max_req: int) -> None:
    ahora = time.monotonic()
    cola = _registro[f"{clave}:{ip}"]
    while cola and ahora - cola[0] > _LIMITE_VENTANA_SEG:
        cola.popleft()
    if len(cola) >= max_req:
        raise HTTPException(status_code=429, detail="Demasiadas solicitudes. Esperá un momento.")
    cola.append(ahora)


# ------------------------------------------------------------------ plata ---
def _a_centavos(valor: Any) -> int:
    try:
        return int(round(float(valor or 0) * 100))
    except (TypeError, ValueError):
        return 0


def _a_pesos(centavos: int) -> float:
    return round(int(centavos) / 100, 2)


def _descuento_centavos(subtotal: int, tipo: str, valor: int) -> int:
    if subtotal < 0:
        raise ValueError("subtotal inválido")
    if tipo == "porcentaje":
        if valor <= 0 or valor > 100:
            raise ValueError("porcentaje inválido")
        return (subtotal * valor) // 100
    if tipo == "monto":
        if valor <= 0:
            raise ValueError("monto inválido")
        return min(valor, subtotal)
    raise ValueError("tipo de cupón inválido")


# ---------------------------------------------------------------- modelos ---
class CheckoutItem(BaseModel):
    producto_id: str
    cantidad: int

    @field_validator("producto_id")
    @classmethod
    def _pid(cls, v: str) -> str:
        v = (v or "").strip()
        if not v or len(v) > 60:
            raise ValueError("Identificador de producto inválido.")
        return v

    @field_validator("cantidad")
    @classmethod
    def _cant(cls, v: int) -> int:
        if v is None or int(v) < 1 or int(v) > 100:
            raise ValueError("La cantidad debe estar entre 1 y 100.")
        return int(v)


class CheckoutCrear(BaseModel):
    items: list[CheckoutItem]
    nombre: str = ""
    email: str = ""
    direccion: str = ""
    ciudad: str = ""
    codigo_postal: str = ""
    envio: str = "estandar"
    cupon_codigo: str = ""

    @field_validator("items")
    @classmethod
    def _items(cls, v: list[CheckoutItem]) -> list[CheckoutItem]:
        if not v or len(v) > 50:
            raise ValueError("La orden debe tener entre 1 y 50 líneas.")
        return v

    @field_validator("nombre", "email", "direccion", "ciudad", "codigo_postal")
    @classmethod
    def _textos(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) > 320:
            raise ValueError("Dato demasiado largo.")
        return v

    @field_validator("envio")
    @classmethod
    def _envio(cls, v: str) -> str:
        v = (v or "").strip().lower() or "estandar"
        if v not in ENVIOS_VALIDOS:
            raise ValueError("Método de envío inválido.")
        return v

    @field_validator("cupon_codigo")
    @classmethod
    def _cupon(cls, v: str) -> str:
        v = (v or "").strip().upper()
        if len(v) > 40:
            raise ValueError("Código de cupón inválido.")
        return v


# ------------------------------------------------------------------ urls ---
def _frontend_base() -> str:
    base = os.getenv("FRONTEND_URL", "").rstrip("/") or "http://localhost:5173"
    if not base.lower().startswith(("http://", "https://")):
        return "http://localhost:5173"
    return base


def _backend_base() -> str:
    base = os.getenv("BACKEND_URL", "").rstrip("/") or "http://127.0.0.1:8000"
    if not base.lower().startswith(("http://", "https://")):
        return "http://127.0.0.1:8000"
    return base


# --------------------------------------------------------- crear checkout ---
def _reservar(orden_id: str, lineas: list[dict[str, Any]], actor: Optional[str]) -> None:
    """Reserva stock línea por línea; ante falla libera lo reservado y cancela."""
    reservadas: list[dict[str, Any]] = []
    try:
        for lin in lineas:
            _rpc("adjust_stock", {
                "p_producto": lin["producto_id"], "p_delta": -lin["cantidad"],
                "p_motivo": "reserva", "p_nota": orden_id, "p_actor": actor,
            })
            reservadas.append(lin)
    except HTTPException as e:
        for lin in reservadas:
            try:
                _rpc("adjust_stock", {
                    "p_producto": lin["producto_id"], "p_delta": lin["cantidad"],
                    "p_motivo": "liberacion", "p_nota": f"{orden_id} rollback",
                    "p_actor": actor,
                })
            except HTTPException:
                print("ERROR checkout_api: no se pudo liberar reserva parcial.")
        _sb_patch("ordenes", {"id": f"eq.{orden_id}"}, {"estado": "cancelada"})
        raise HTTPException(status_code=409, detail=_mensaje_seguro(e.detail))


def _liberar(orden_id: str, lineas: list[dict[str, Any]], motivo: str,
             actor: Optional[str] = None) -> None:
    for lin in lineas:
        try:
            _rpc("adjust_stock", {
                "p_producto": lin["producto_id"], "p_delta": lin["cantidad"],
                "p_motivo": motivo, "p_nota": orden_id, "p_actor": actor,
            })
        except HTTPException:
            print("ERROR checkout_api: no se pudo liberar stock.")


@router.post("/api/checkout/crear", status_code=201)
def crear_checkout(d: CheckoutCrear, request: Request) -> dict[str, Any]:
    ip = request.client.host if request.client else "?"
    _limitar(ip, "checkout-crear", 10)
    uid = _uid_desde_bearer(request.headers.get("authorization"))

    # 1. Precios y stock SIEMPRE desde la DB (lo que mande el cliente se ignora).
    ids = sorted({it.producto_id for it in d.items})
    prods = _sb_get("productos", {
        "select": "id,nombre,precio,precio_con_descuento,stock,activo,deleted_at",
        "id": f"in.({','.join(ids)})",
    }) or []
    por_id = {p["id"]: p for p in prods}
    lineas: list[dict[str, Any]] = []
    subtotal = 0
    for it in d.items:
        p = por_id.get(it.producto_id)
        if p is None or (p.get("deleted_at") is not None) or not p.get("activo", True):
            raise HTTPException(status_code=404, detail="Producto inexistente o no disponible.")
        if int(p.get("stock") or 0) < it.cantidad:
            raise HTTPException(status_code=409, detail="Stock insuficiente.")
        base = p.get("precio_con_descuento")
        if base is None:
            base = p.get("precio")
        unit = _a_centavos(base)
        if unit <= 0:
            raise HTTPException(status_code=409, detail="Producto sin precio válido.")
        subtotal += unit * it.cantidad
        lineas.append({
            "producto_id": it.producto_id,
            "cantidad": it.cantidad,
            "unit_centavos": unit,
            "nombre": str(p.get("nombre") or "Producto")[:200],
        })

    # 2. Cupón: se VALIDA acá, el uso se descuenta al acreditar (webhook).
    descuento = 0
    if d.cupon_codigo:
        cups = _sb_get("cupones", {
            "select": "codigo,tipo,valor,min_compra_centavos,usos_max,usos,activo,vence_at",
            "codigo": f"eq.{d.cupon_codigo}", "deleted_at": "is.null", "limit": 1,
        }) or []
        if not cups:
            raise HTTPException(status_code=400, detail="Cupón inexistente.")
        c = cups[0]
        ahora = datetime.now(timezone.utc)
        if not c.get("activo"):
            raise HTTPException(status_code=400, detail="Cupón inactivo.")
        if c.get("vence_at") and str(c["vence_at"]) < ahora.isoformat():
            raise HTTPException(status_code=400, detail="Cupón vencido.")
        if c.get("usos_max") is not None and int(c.get("usos") or 0) >= int(c["usos_max"]):
            raise HTTPException(status_code=400, detail="Cupón agotado.")
        if subtotal < int(c.get("min_compra_centavos") or 0):
            raise HTTPException(status_code=400, detail="No alcanza el mínimo de compra.")
        try:
            descuento = _descuento_centavos(subtotal, c.get("tipo", ""), int(c.get("valor", 0)))
        except ValueError:
            raise HTTPException(status_code=400, detail="Cupón inválido.")

    # 3. Envío desde regla del servidor.
    if subtotal >= UMBRAL_ENVIO_GRATIS_CENT:
        envio_cent = 0
    else:
        envio_cent = ENVIO_EXPRESS_CENT if d.envio == "express" else ENVIO_ESTANDAR_CENT
    total = subtotal - descuento + envio_cent

    # 4. Orden pendiente + expiración + token de lectura para invitados.
    expira = datetime.now(timezone.utc) + timedelta(minutes=EXPIRA_MINUTOS)
    token = secrets.token_urlsafe(32)
    creadas = _sb_post("ordenes", {
        "user_id": uid,
        "nombre": d.nombre, "email": d.email, "direccion": d.direccion,
        "ciudad": d.ciudad, "codigo_postal": d.codigo_postal,
        "envio": d.envio, "pago_mock": "mercadopago",
        "subtotal": _a_pesos(subtotal), "costo_envio": _a_pesos(envio_cent),
        "total": _a_pesos(total),
        "subtotal_centavos": subtotal, "descuento_centavos": descuento,
        "total_centavos": total, "costo_envio_centavos": envio_cent,
        "cupon_codigo": d.cupon_codigo, "estado": "pendiente",
        "expira_at": expira.isoformat(), "acceso_token": token,
    }) or []
    if not creadas:
        raise HTTPException(status_code=502, detail="No se pudo crear la orden.")
    orden_id = creadas[0]["id"]
    _sb_patch("ordenes", {"id": f"eq.{orden_id}"}, {"mp_external_reference": orden_id})

    # 5. Items con precios del servidor.
    _sb_post("orden_items", [
        {"orden_id": orden_id, "producto_id": lin["producto_id"],
         "cantidad": lin["cantidad"], "precio": _a_pesos(lin["unit_centavos"])}
        for lin in lineas
    ], prefer="return=minimal")

    # 6. Reserva de stock.
    _reservar(orden_id, lineas, uid)

    # 7. Preferencia MP (sandbox intacto): montos del servidor.
    mp_token = os.getenv("MERCADOPAGO_ACCESS_TOKEN", "")
    if not mp_token:
        _liberar(orden_id, lineas, "liberacion")
        _sb_patch("ordenes", {"id": f"eq.{orden_id}"}, {"estado": "cancelada"})
        raise HTTPException(status_code=503, detail="Pagos no configurados.")
    try:
        import mercadopago

        sdk = mercadopago.SDK(mp_token)
        front = _frontend_base()
        pref = {
            "items": [{
                "title": lin["nombre"], "quantity": lin["cantidad"],
                "unit_price": _a_pesos(lin["unit_centavos"]), "currency_id": "ARS",
            } for lin in lineas],
            "shipments": {"cost": _a_pesos(envio_cent), "mode": "not_specified"},
            "external_reference": orden_id,
            "back_urls": {
                "success": f"{front}/checkout?orden_id={orden_id}&pago=exito",
                "failure": f"{front}/checkout?orden_id={orden_id}&pago=fallo",
                "pending": f"{front}/checkout?orden_id={orden_id}&pago=pendiente",
            },
            "notification_url": f"{_backend_base()}/api/webhooks/mercadopago",
            "expires": True,
            "expiration_date_to": expira.strftime("%Y-%m-%dT%H:%M:%S.000-03:00"),
            "auto_return": "approved",
        }
        resp = sdk.preference().create(pref)
        data = (resp or {}).get("response") or {}
        init_point = data.get("init_point") or data.get("sandbox_init_point") or ""
        if not init_point or not _es_url_mp(init_point):
            raise ValueError("preferencia inválida")
        if data.get("id"):
            _sb_patch("ordenes", {"id": f"eq.{orden_id}"},
                      {"mp_preference_id": str(data["id"])})
    except HTTPException:
        raise
    except Exception:
        print("ERROR checkout_api: fallo interno al generar preferencia.")
        _liberar(orden_id, lineas, "liberacion")
        _sb_patch("ordenes", {"id": f"eq.{orden_id}"}, {"estado": "cancelada"})
        raise HTTPException(
            status_code=502,
            detail="No se pudo generar el link de pago. Intentá de nuevo más tarde.",
        )

    return {
        "orden_id": orden_id,
        "init_point": init_point,
        "total_centavos": total,
        "expira_at": expira.isoformat(),
        "acceso_token": token,
    }


# ---------------------------------------------------------- estado real ---
@router.get("/api/checkout/estado/{orden_id}")
def estado_checkout(orden_id: str, request: Request, token: str = "") -> dict[str, Any]:
    _limitar(request.client.host if request.client else "?", "checkout-estado", 30)
    filas = _sb_get("ordenes", {
        "select": ("id,user_id,estado,subtotal_centavos,descuento_centavos,"
                   "costo_envio_centavos,total_centavos,expira_at,mp_payment_id,"
                   "created_at,orden_items(producto_id,cantidad,precio)"),
        "id": f"eq.{orden_id.strip()}", "limit": 1,
    }) or []
    if not filas:
        raise HTTPException(status_code=404, detail="Orden inexistente.")
    o = filas[0]
    if o.get("user_id"):
        uid = _uid_desde_bearer(request.headers.get("authorization"))
        if uid != o["user_id"]:
            # 404 para no revelar existencia a terceros.
            raise HTTPException(status_code=404, detail="Orden inexistente.")
    else:
        # Invitado: solo con el token entregado al crear la orden.
        esperado = o.get("acceso_token") or ""
        if not esperado or not token or not hmac.compare_digest(str(token), str(esperado)):
            raise HTTPException(status_code=403, detail="Sin permiso sobre esa orden.")
    return {
        "orden_id": o["id"],
        "estado": o.get("estado"),
        "subtotal_centavos": int(o.get("subtotal_centavos") or 0),
        "descuento_centavos": int(o.get("descuento_centavos") or 0),
        "costo_envio_centavos": int(o.get("costo_envio_centavos") or 0),
        "total_centavos": int(o.get("total_centavos") or 0),
        "expira_at": o.get("expira_at"),
        "mp_payment_id": o.get("mp_payment_id") or "",
        "items": o.get("orden_items") or [],
    }


# ---------------------------------------------------------------- webhook ---
def _firma_mp_valida(request: Request, data_id: str) -> bool:
    """Valida x-signature según docs MP (HMAC-SHA256, comparación constante)."""
    secreto = os.getenv("MP_WEBHOOK_SECRET", "")
    if not secreto:
        return False
    cab = request.headers.get("x-signature", "")
    partes = dict(p.split("=", 1) for p in cab.split(",") if "=" in p)
    ts, v1 = partes.get("ts", ""), partes.get("v1", "")
    req_id = request.headers.get("x-request-id", "")
    if not ts or not v1 or not req_id or not data_id:
        return False
    plantilla = f"id:{data_id};request-id:{req_id};ts:{ts};"
    esperado = hmac.new(secreto.encode(), plantilla.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(esperado, v1)


def _pago_mp(payment_id: str) -> Optional[dict[str, Any]]:
    """Pago real desde la API de MP. None si no existe (nunca existirá)."""
    token = os.getenv("MERCADOPAGO_ACCESS_TOKEN", "")
    if not token:
        raise HTTPException(status_code=503, detail="Pagos no configurados.")
    try:
        r = httpx.get(f"https://api.mercadopago.com/v1/payments/{payment_id}",
                      headers={"Authorization": f"Bearer {token}"}, timeout=15.0)
    except httpx.HTTPError:
        print("ERROR checkout_api: fallo consultando pago a MP.")
        raise HTTPException(status_code=502, detail="No se pudo verificar el pago.")
    if r.status_code == 404:
        return None
    if r.status_code != 200:
        print("ERROR checkout_api: MP devolvió estado no exitoso.")
        raise HTTPException(status_code=502, detail="No se pudo verificar el pago.")
    try:
        return r.json()
    except Exception:
        raise HTTPException(status_code=502, detail="No se pudo verificar el pago.")


@router.post("/api/webhooks/mercadopago")
async def webhook_mercadopago(request: Request) -> dict[str, Any]:
    _limitar(request.client.host if request.client else "?", "webhook-mp", 60)
    query = dict(request.query_params)
    data_id = str(query.get("data.id") or query.get("id") or "").strip()
    tipo = str(query.get("type") or query.get("topic") or "").strip().lower()

    if not data_id:
        # Ping de prueba / evento sin pago: 200 para no generar reintentos.
        return {"recibido": True, "ignorado": "sin data.id"}
    if tipo and tipo not in ("payment", "payments"):
        return {"recibido": True, "ignorado": f"tipo {tipo}"}
    if not os.getenv("MP_WEBHOOK_SECRET", ""):
        # Fail-closed: sin secreto no se procesa nada (MP reintenta).
        raise HTTPException(status_code=503, detail="Webhook no configurado.")
    if not _firma_mp_valida(request, data_id):
        raise HTTPException(status_code=401, detail="Firma inválida.")

    # 1. Pago real desde la API de MP (nunca se confía en el body del webhook).
    pago = _pago_mp(data_id)
    if pago is None:
        return {"recibido": True, "ignorado": "pago inexistente en MP"}
    estado_mp = str(pago.get("status") or "").lower()
    orden_ref = str(pago.get("external_reference") or "").strip()

    # 2. Idempotencia por (pago, estado): reintentos del mismo evento → 200.
    evento_id = f"mp:{data_id}:{estado_mp or 'sin-estado'}"
    creado, _ = _insertar_crudo("eventos_webhook", {
        "fuente": "mercadopago", "evento_id": evento_id,
        "orden_id": orden_ref or None,
        "estado": estado_mp or "recibido",
        "payload": {"query": query, "status": estado_mp,
                    "external_reference": orden_ref},
    })
    if not creado:
        return {"recibido": True, "duplicado": True}

    if not orden_ref:
        return {"recibido": True, "ignorado": "sin external_reference"}
    filas = _sb_get("ordenes", {
        "select": ("id,user_id,estado,subtotal_centavos,descuento_centavos,"
                   "total_centavos,cupon_codigo,mp_payment_id,"
                   "orden_items(producto_id,cantidad)"),
        "id": f"eq.{orden_ref}", "limit": 1,
    }) or []
    if not filas:
        return {"recibido": True, "ignorado": "orden inexistente"}
    o = filas[0]
    orden_id = o["id"]
    lineas = [{"producto_id": i.get("producto_id"), "cantidad": int(i.get("cantidad") or 0)}
              for i in (o.get("orden_items") or []) if i.get("producto_id")]
    _sb_patch("ordenes", {"id": f"eq.{orden_id}"}, {"mp_payment_id": data_id})

    # 3. Verificación de monto y moneda contra la orden del servidor.
    try:
        monto_mp = _a_centavos(pago.get("transaction_amount"))
    except Exception:
        monto_mp = -1
    if str(pago.get("currency_id") or "").upper() != "ARS" \
            or monto_mp != int(o.get("total_centavos") or 0):
        print("ERROR checkout_api: monto/moneda de MP no coincide con la orden.")
        return {"recibido": True, "verificado": False,
                "motivo": "monto o moneda no coincide"}

    actual = o.get("estado")

    # 4a. Acreditado → confirma (guardas hacen el reintento seguro).
    if estado_mp == "approved":
        if actual != "pendiente":
            return {"recibido": True, "duplicado": True, "estado": actual}
        _sb_patch("ordenes", {"id": f"eq.{orden_id}"},
                  {"mp_payment_id": data_id})
        # Reserva → venta: reclasifica movimientos (idempotente por filtro).
        _sb_patch("movimientos_stock",
                  {"nota": f"eq.{orden_id}", "motivo": "eq.reserva"},
                  {"motivo": "venta", "nota": f"{orden_id} mp:{data_id}"})
        # El uso del cupón recién se descuenta al acreditar.
        if (o.get("cupon_codigo") or "").strip() and int(o.get("descuento_centavos") or 0) > 0:
            try:
                _rpc("aplicar_cupon", {"p_codigo": o["cupon_codigo"].strip().upper(),
                                      "p_subtotal_centavos": int(o.get("subtotal_centavos") or 0)})
            except HTTPException:
                print("ERROR checkout_api: no se pudo aplicar cupón al acreditar.")
        try:
            _rpc("cambiar_estado_pedido", {
                "p_id": orden_id, "p_a": "pagada",
                "p_nota": f"mp:{data_id}", "p_version": None, "p_actor": None,
            })
        except HTTPException as e:
            return {"recibido": True, "duplicado": True,
                    "detalle": _mensaje_seguro(e.detail)}
        # Comprobante idempotente (UNIQUE orden_id: 409 = ya emitido).
        _insertar_crudo("comprobantes", {
            "orden_id": orden_id,
            "total_centavos": int(o.get("total_centavos") or 0),
            "mp_payment_id": data_id,
        })
        if o.get("user_id"):
            try:
                _rpc("notificar", {
                    "p_user": o["user_id"], "p_titulo": "Pago acreditado",
                    "p_mensaje": f"Tu orden {orden_id} fue pagada.",
                    "p_dedupe": f"pago:{orden_id}",
                })
            except HTTPException:
                print("ERROR checkout_api: no se pudo notificar pago.")
        return {"recibido": True, "estado": "pagada"}

    # 4b. Rechazado/cancelado/expirado → libera reserva y cancela.
    if estado_mp in ("rejected", "cancelled", "expired"):
        if actual == "pendiente":
            _liberar(orden_id, lineas, "liberacion")
            try:
                _rpc("cambiar_estado_pedido", {
                    "p_id": orden_id, "p_a": "cancelada",
                    "p_nota": f"mp:{data_id} {estado_mp}", "p_version": None,
                    "p_actor": None,
                })
            except HTTPException:
                pass
            return {"recibido": True, "estado": "cancelada"}
        return {"recibido": True, "duplicado": True, "estado": actual}

    # 4c. Reembolso/contra-cargo de orden pagada → reembolsada.
    if estado_mp in ("refunded", "charged_back"):
        if actual == "pagada":
            try:
                _rpc("cambiar_estado_pedido", {
                    "p_id": orden_id, "p_a": "reembolsada",
                    "p_nota": f"mp:{data_id} {estado_mp}", "p_version": None,
                    "p_actor": None,
                })
            except HTTPException:
                pass
            return {"recibido": True, "estado": "reembolsada"}
        return {"recibido": True, "duplicado": True, "estado": actual}

    # 4d. Pendiente/en proceso/mediación: se deja pendiente al expirador.
    return {"recibido": True, "estado": actual, "pago": estado_mp}


# ------------------------------------------------- liberar expiradas ---
@router.post("/api/checkout/liberar-expiradas")
def liberar_expiradas(request: Request) -> dict[str, Any]:
    _limitar(request.client.host if request.client else "?", "checkout-liberar", 10)
    ahora = datetime.now(timezone.utc).isoformat()
    vencidas = _sb_get("ordenes", {
        "select": "id,orden_items(producto_id,cantidad)",
        "estado": "eq.pendiente", "expira_at": f"lt.{ahora}",
        "order": "expira_at.asc", "limit": 100,
    }) or []
    liberadas = 0
    for o in vencidas:
        oid = o["id"]
        lineas = [{"producto_id": i.get("producto_id"),
                   "cantidad": int(i.get("cantidad") or 0)}
                  for i in (o.get("orden_items") or []) if i.get("producto_id")]
        try:
            _liberar(oid, lineas, "liberacion-expirada")
            _rpc("cambiar_estado_pedido", {
                "p_id": oid, "p_a": "cancelada",
                "p_nota": "expirada sin pago", "p_version": None, "p_actor": None,
            })
            liberadas += 1
        except HTTPException:
            print("ERROR checkout_api: no se pudo liberar orden expirada.")
            continue
    return {"revisadas": len(vencidas), "liberadas": liberadas}
