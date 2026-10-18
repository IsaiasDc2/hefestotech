"""HefestoTech · backend/admin_api.py
Panel admin (/api/admin/* + /api/buscar).

- Autorización en servidor: cada endpoint exige un rol de la matriz
  (espejo de `admin_permisos` de 005_admin_infra.sql) vía `requiere()`.
- El JWT del usuario se valida contra Supabase (`/auth/v1/user`) y el rol
  se lee de `perfiles` con service_role. Nunca se confía en el rol que
  declare el cliente.
- Montos siempre en centavos enteros (sin floats para dinero).
- Redacción de secretos: cualquier clave con pinta de secreto se devuelve
  como "***" (ver _redactar). Los secretos del .env nunca salen del servidor.
- Sin datos inventados: todo sale de Supabase; ante error externo se
  responde un mensaje genérico (sin trazas ni detalle del proveedor).
"""

from __future__ import annotations

import os
import re
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Any, Callable, Optional

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from pydantic import BaseModel, field_validator, model_validator

from comprobantes import comprobante_pdf, obtener_comprobante

router = APIRouter()

# ---------------------------------------------------------------- matriz ---
# Espejo de los seeds de `admin_permisos` (005). La fuente de verdad para
# RLS es la tabla SQL; este espejo solo decide el acceso a ESTE backend.
# Roles fuera de la matriz (p. ej. "cliente") no entran a ningún endpoint.
PERMISOS: dict[str, set[tuple[str, str]]] = {
    "owner": {
        ("productos", "leer"), ("productos", "crear"), ("productos", "editar"), ("productos", "borrar"),
        ("pedidos", "leer"), ("pedidos", "crear"), ("pedidos", "editar"), ("pedidos", "cambiar_estado"),
        ("stock", "leer"), ("stock", "ajustar"),
        ("reclamos", "leer"), ("reclamos", "crear"), ("reclamos", "editar"), ("reclamos", "cambiar_estado"),
        ("cupones", "leer"), ("cupones", "crear"), ("cupones", "editar"), ("cupones", "borrar"),
        ("banners", "leer"), ("banners", "crear"), ("banners", "editar"), ("banners", "borrar"),
        ("notificaciones", "leer"), ("auditoria", "leer"),
        ("reportes", "leer"), ("buscar", "leer"),
        ("config", "leer"), ("config", "gestionar"),
        ("usuarios", "leer"), ("usuarios", "gestionar"),
    },
    "admin": {
        ("productos", "leer"), ("productos", "crear"), ("productos", "editar"), ("productos", "borrar"),
        ("pedidos", "leer"), ("pedidos", "crear"), ("pedidos", "editar"), ("pedidos", "cambiar_estado"),
        ("stock", "leer"), ("stock", "ajustar"),
        ("reclamos", "leer"), ("reclamos", "crear"), ("reclamos", "editar"), ("reclamos", "cambiar_estado"),
        ("cupones", "leer"), ("cupones", "crear"), ("cupones", "editar"), ("cupones", "borrar"),
        ("banners", "leer"), ("banners", "crear"), ("banners", "editar"), ("banners", "borrar"),
        ("notificaciones", "leer"), ("auditoria", "leer"),
        ("reportes", "leer"), ("buscar", "leer"),
        ("config", "leer"),
    },
    "operador": {
        ("productos", "leer"), ("productos", "crear"), ("productos", "editar"),
        ("pedidos", "leer"), ("pedidos", "cambiar_estado"),
        ("stock", "leer"), ("stock", "ajustar"),
        ("reclamos", "leer"),
        ("cupones", "leer"), ("banners", "leer"),
        ("notificaciones", "leer"), ("reportes", "leer"), ("buscar", "leer"),
    },
    "soporte": {
        ("productos", "leer"), ("pedidos", "leer"),
        ("reclamos", "leer"), ("reclamos", "crear"), ("reclamos", "editar"), ("reclamos", "cambiar_estado"),
        ("notificaciones", "leer"), ("buscar", "leer"),
    },
    "solo_lectura": {
        ("productos", "leer"), ("pedidos", "leer"),
        ("stock", "leer"), ("reclamos", "leer"),
        ("cupones", "leer"), ("banners", "leer"),
        ("notificaciones", "leer"), ("auditoria", "leer"),
        ("reportes", "leer"), ("buscar", "leer"),
    },
    # Clientes: solo pueden radicar reclamos propios (el formulario /reclamo
    # es su única vía al backend). Sin esto, el reclamo público exige rol
    # staff y la funcionalidad queda rota para su audiencia real.
    "cliente": {
        ("reclamos", "crear"),
    },
}

ESTADOS_PEDIDO = {"pendiente", "pagada", "preparacion", "enviada", "entregada", "cancelada", "reembolsada"}
ESTADOS_RECLAMO = {"abierto", "en_revision", "resuelto", "rechazado"}

# Mensajes de error de los RPC SQL que es seguro mostrar tal cual
# (no contienen secretos ni trazas).
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
        return "Transición de estado inválida."
    return "Operación no disponible. Intentá de nuevo más tarde."


# --------------------------------------------------------------- secretos ---
_CLAVES_SENSIBLES = (
    "token", "secret", "password", "passwd", "api_key", "apikey",
    "private_key", "service_role", "access_token", "refresh_token",
    "webhook", "authorization",
)


def _redactar(obj: Any) -> Any:
    """Devuelve una copia con valores de claves sensibles tapados."""
    if isinstance(obj, dict):
        return {
            k: ("***" if any(s in str(k).lower() for s in _CLAVES_SENSIBLES) else _redactar(v))
            for k, v in obj.items()
        }
    if isinstance(obj, list):
        return [_redactar(x) for x in obj]
    return obj


# ------------------------------------------------------------ supabase rest ---
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


def _sb_error(exc: httpx.HTTPStatusError) -> HTTPException:
    try:
        detalle = exc.response.json().get("message", "")
    except Exception:
        detalle = ""
    print(f"ERROR admin_api: supabase {exc.response.status_code}.")
    return HTTPException(status_code=502, detail=_mensaje_seguro(str(detalle)))


def _sb_get(tabla: str, params: dict[str, Any]) -> Any:
    try:
        r = _client().get(f"/{tabla}", params=params)
        r.raise_for_status()
        return r.json()
    except httpx.HTTPStatusError as e:
        raise _sb_error(e)
    except httpx.HTTPError:
        print("ERROR admin_api: fallo de red hacia supabase.")
        raise HTTPException(status_code=502, detail="No se pudo consultar la base de datos.")


def _sb_post(tabla: str, fila: dict[str, Any], prefer: str = "return=representation") -> Any:
    try:
        r = _client().post(f"/{tabla}", json=fila, headers={"Prefer": prefer})
        r.raise_for_status()
        return r.json()
    except httpx.HTTPStatusError as e:
        raise _sb_error(e)
    except httpx.HTTPError:
        print("ERROR admin_api: fallo de red hacia supabase.")
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
        print("ERROR admin_api: fallo de red hacia supabase.")
        raise HTTPException(status_code=502, detail="No se pudo guardar en la base de datos.")


def _sb_delete(tabla: str, params: dict[str, Any]) -> Any:
    try:
        r = _client().delete(f"/{tabla}", params=params, headers={"Prefer": "return=representation"})
        r.raise_for_status()
        return r.json()
    except httpx.HTTPStatusError as e:
        raise _sb_error(e)
    except httpx.HTTPError:
        print("ERROR admin_api: fallo de red hacia supabase.")
        raise HTTPException(status_code=502, detail="No se pudo borrar en la base de datos.")


def _rpc(funcion: str, args: dict[str, Any]) -> Any:
    try:
        r = _client().post(f"/rpc/{funcion}", json=args)
        r.raise_for_status()
        return r.json()
    except httpx.HTTPStatusError as e:
        raise _sb_error(e)
    except httpx.HTTPError:
        print("ERROR admin_api: fallo de red hacia supabase (rpc).")
        raise HTTPException(status_code=502, detail="No se pudo completar la operación.")


# ------------------------------------------------------------------- auth ---
class AdminActual(BaseModel):
    user_id: str
    rol: str


def _validar_jwt(bearer: str) -> str:
    """Valida el JWT contra Supabase y devuelve el `sub`. Sin red → 401/503."""
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise HTTPException(status_code=503, detail="Backend sin conexión a la base de datos.")
    try:
        r = httpx.get(f"{url}/auth/v1/user",
                      headers={"apikey": key, "Authorization": f"Bearer {bearer}"},
                      timeout=10.0)
    except httpx.HTTPError:
        print("ERROR admin_api: fallo validando sesión.")
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


def requiere(modulo: str, accion: str) -> Callable[[Optional[str]], AdminActual]:
    def dependencia(authorization: Optional[str] = Header(default=None)) -> AdminActual:
        if not authorization or not authorization.lower().startswith("bearer "):
            raise HTTPException(status_code=401, detail="Falta el token de sesión.")
        # El token nunca se loguea ni se devuelve.
        bearer = authorization.split(" ", 1)[1].strip()
        if not bearer:
            raise HTTPException(status_code=401, detail="Falta el token de sesión.")
        uid = _validar_jwt(bearer)
        filas = _sb_get("perfiles", {"id": f"eq.{uid}", "select": "id,rol"})
        rol = (filas[0].get("rol") if filas else "") or ""
        if (modulo, accion) not in PERMISOS.get(rol, set()):
            raise HTTPException(status_code=403, detail="Sin permiso para esta acción.")
        return AdminActual(user_id=uid, rol=rol)

    return dependencia


# Rate-limit simple en memoria para mutaciones sensibles (por IP).
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


# ------------------------------------------------------------- centavos ---
def _a_centavos(valor: Any) -> int:
    """numeric/float/str → centavos enteros (redondeo mitad arriba)."""
    try:
        return int(round(float(valor or 0) * 100))
    except (TypeError, ValueError):
        return 0


def _descuento_centavos(subtotal: int, tipo: str, valor: int) -> int:
    """Descuento en centavos. Espejo de `aplicar_cupon()` (005) para vista previa."""
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


def _totales_con_cupon(subtotal: int, cupon: Optional[dict[str, Any]]) -> dict[str, int]:
    """{subtotal_centavos, descuento_centavos, total_centavos} en enteros."""
    if cupon:
        descuento = _descuento_centavos(subtotal, cupon.get("tipo", ""), int(cupon.get("valor", 0)))
    else:
        descuento = 0
    return {
        "subtotal_centavos": subtotal,
        "descuento_centavos": descuento,
        "total_centavos": subtotal - descuento,
    }


# ---------------------------------------------------------------- modelos ---
class ProductoCrear(BaseModel):
    nombre: str
    marca: str = ""
    precio: float = 0
    stock: int = 0
    descripcion: str = ""
    categoria: str = "General"
    codigo: str = ""
    imagen: str = ""

    @field_validator("nombre")
    @classmethod
    def _nombre(cls, v: str) -> str:
        v = (v or "").strip()
        if not v or len(v) > 200:
            raise ValueError("Nombre requerido (máximo 200 caracteres).")
        return v

    @field_validator("precio")
    @classmethod
    def _precio(cls, v: float) -> float:
        if v is None or float(v) < 0 or float(v) > 1_000_000_000:
            raise ValueError("Precio inválido.")
        return float(v)

    @field_validator("stock")
    @classmethod
    def _stock(cls, v: int) -> int:
        if v is None or int(v) < 0 or int(v) > 1_000_000:
            raise ValueError("Stock inválido.")
        return int(v)


class ProductoEditar(BaseModel):
    nombre: Optional[str] = None
    marca: Optional[str] = None
    precio: Optional[float] = None
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    stock_minimo: Optional[int] = None
    destacado: Optional[bool] = None
    activo: Optional[bool] = None
    imagen: Optional[str] = None

    @field_validator("nombre", "marca", "descripcion", "categoria")
    @classmethod
    def _textos(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if len(v) > 2000:
            raise ValueError("Texto demasiado largo (máximo 2000 caracteres).")
        return v

    @field_validator("precio")
    @classmethod
    def _precio(cls, v: Optional[float]) -> Optional[float]:
        if v is None:
            return None
        if float(v) < 0 or float(v) > 1_000_000_000:
            raise ValueError("Precio inválido.")
        return float(v)

    @field_validator("stock_minimo")
    @classmethod
    def _stock_min(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return None
        if int(v) < 0 or int(v) > 1_000_000:
            raise ValueError("Stock mínimo inválido.")
        return int(v)

    @field_validator("imagen")
    @classmethod
    def _imagen(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if len(v) > 2000:
            raise ValueError("URL de imagen demasiado larga.")
        if v and not _url_imagen_ok(v):
            raise ValueError("URL de imagen inválida.")
        return v


def _url_imagen_ok(v: str) -> bool:
    # Solo rutas internas o https: http:// da contenido mixto (bloqueado por
    # el navegador en el sitio https) y "//host" es una URL externa disfrazada.
    u = v.strip()
    if u.startswith("/"):
        return not u.startswith("//")
    return u.lower().startswith("https://")


def _url_link_ok(v: str) -> bool:
    """Links de banner: rutas internas o http(s). Sin javascript:/data:."""
    u = v.strip()
    if not u:
        return True
    if u.startswith("/"):
        return len(u) <= 500
    bajo = u.lower()
    return (bajo.startswith("https://") or bajo.startswith("http://")) and len(u) <= 2000


class StockAjustar(BaseModel):
    producto_id: str
    delta: int
    motivo: str = "ajuste"
    nota: str = ""

    @field_validator("delta")
    @classmethod
    def _delta(cls, v: int) -> int:
        if v is None or int(v) == 0 or abs(int(v)) > 1_000_000:
            raise ValueError("Delta inválido (distinto de cero, máximo ±1000000).")
        return int(v)

    @field_validator("motivo")
    @classmethod
    def _motivo(cls, v: str) -> str:
        v = (v or "").strip() or "ajuste"
        if len(v) > 120:
            raise ValueError("Motivo demasiado largo (máximo 120 caracteres).")
        return v

    @field_validator("nota")
    @classmethod
    def _nota(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) > 2000:
            raise ValueError("Nota demasiado larga (máximo 2000 caracteres).")
        return v


class PedidoEstado(BaseModel):
    a: str
    nota: str = ""
    version: Optional[int] = None

    @field_validator("a")
    @classmethod
    def _estado(cls, v: str) -> str:
        if v not in ESTADOS_PEDIDO:
            raise ValueError("Estado inválido.")
        return v

    @field_validator("nota")
    @classmethod
    def _nota(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) > 2000:
            raise ValueError("Nota demasiado larga (máximo 2000 caracteres).")
        return v


class ReclamoCrear(BaseModel):
    orden_id: Optional[str] = None
    motivo: str
    detalle: str = ""

    @field_validator("motivo")
    @classmethod
    def _motivo(cls, v: str) -> str:
        v = (v or "").strip()
        if not v or len(v) > 200:
            raise ValueError("Motivo requerido (máximo 200 caracteres).")
        return v

    @field_validator("detalle")
    @classmethod
    def _detalle(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) > 2000:
            raise ValueError("Detalle demasiado largo (máximo 2000 caracteres).")
        return v

    @field_validator("orden_id")
    @classmethod
    def _orden(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if len(v) > 60:
            raise ValueError("Identificador de orden inválido.")
        return v or None


class ReclamoEstado(BaseModel):
    estado: str

    @field_validator("estado")
    @classmethod
    def _estado(cls, v: str) -> str:
        if v not in ESTADOS_RECLAMO:
            raise ValueError("Estado inválido.")
        return v


class MensajeReclamoCrear(BaseModel):
    """Nota interna del hilo de un reclamo (bandeja WhatsApp).

    El autor se acota a staff/sistema: los mensajes de cliente entran por
    el formulario público o por WhatsApp manual, nunca por este endpoint.
    Nada se envía solo: responder por WhatsApp es un enlace wa.me manual.
    """
    texto: str
    autor: str = "staff"

    @field_validator("texto")
    @classmethod
    def _texto(cls, v: str) -> str:
        v = (v or "").strip()
        if not v or len(v) > 2000:
            raise ValueError("Texto requerido (máximo 2000 caracteres).")
        return v

    @field_validator("autor")
    @classmethod
    def _autor(cls, v: str) -> str:
        if v not in ("staff", "sistema"):
            raise ValueError("Autor inválido (staff | sistema).")
        return v


class CuponCrear(BaseModel):
    codigo: str
    tipo: str
    valor: int
    min_compra_centavos: int = 0
    usos_max: Optional[int] = None
    activo: bool = True
    vence_at: Optional[str] = None

    @field_validator("codigo")
    @classmethod
    def _codigo(cls, v: str) -> str:
        v = (v or "").strip().upper()
        if not v or len(v) > 40:
            raise ValueError("Código requerido (máximo 40 caracteres).")
        return v

    @field_validator("tipo")
    @classmethod
    def _tipo(cls, v: str) -> str:
        if v not in ("porcentaje", "monto"):
            raise ValueError("Tipo inválido (porcentaje | monto).")
        return v

    @field_validator("valor")
    @classmethod
    def _valor(cls, v: int) -> int:
        if v is None or int(v) <= 0 or int(v) > 100_000_000:
            raise ValueError("Valor inválido.")
        return int(v)

    @field_validator("min_compra_centavos")
    @classmethod
    def _min_compra(cls, v: int) -> int:
        if v is None or int(v) < 0 or int(v) > 100_000_000_00:
            raise ValueError("Mínimo de compra inválido.")
        return int(v)

    @field_validator("usos_max")
    @classmethod
    def _usos(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return None
        if int(v) <= 0 or int(v) > 10_000_000:
            raise ValueError("Límite de usos inválido.")
        return int(v)

    @model_validator(mode="after")
    def _porcentaje_acotado(self):
        # Defensa en profundidad: la ruta también lo exige, pero el modelo
        # no debe representar un cupón imposible (999% = regalar stock).
        if self.tipo == "porcentaje" and int(self.valor) > 100:
            raise ValueError("Porcentaje inválido (1–100).")
        return self


class BannerCrear(BaseModel):
    titulo: str = ""
    imagen: str = ""
    link: str = ""
    orden: int = 0
    activo: bool = True

    @field_validator("titulo")
    @classmethod
    def _titulo(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) > 200:
            raise ValueError("Título demasiado largo (máximo 200 caracteres).")
        return v

    @field_validator("imagen")
    @classmethod
    def _imagen(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) > 2000:
            raise ValueError("URL de imagen demasiado larga.")
        if v and not _url_imagen_ok(v):
            raise ValueError("URL de imagen inválida (https:// o ruta /...).")
        return v

    @field_validator("link")
    @classmethod
    def _link(cls, v: str) -> str:
        v = (v or "").strip()
        if not _url_link_ok(v):
            raise ValueError("Link inválido (ruta /... o https://).")
        return v

    @field_validator("orden")
    @classmethod
    def _orden(cls, v: int) -> int:
        if v is None or abs(int(v)) > 1_000_000:
            raise ValueError("Orden inválido.")
        return int(v)


class BannerEditar(BaseModel):
    titulo: Optional[str] = None
    imagen: Optional[str] = None
    link: Optional[str] = None
    orden: Optional[int] = None
    activo: Optional[bool] = None

    @field_validator("titulo")
    @classmethod
    def _titulo(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if len(v) > 200:
            raise ValueError("Título demasiado largo (máximo 200 caracteres).")
        return v

    @field_validator("imagen")
    @classmethod
    def _imagen(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if len(v) > 2000:
            raise ValueError("URL de imagen demasiado larga.")
        if v and not _url_imagen_ok(v):
            raise ValueError("URL de imagen inválida (https:// o ruta /...).")
        return v

    @field_validator("link")
    @classmethod
    def _link(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if not _url_link_ok(v):
            raise ValueError("Link inválido (ruta /... o https://).")
        return v

    @field_validator("orden")
    @classmethod
    def _orden(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return None
        if abs(int(v)) > 1_000_000:
            raise ValueError("Orden inválido.")
        return int(v)


class LoteCrear(BaseModel):
    codigo_lote: str = ""
    cantidad: int = 0
    vence_at: Optional[str] = None

    @field_validator("cantidad")
    @classmethod
    def _cant(cls, v: int) -> int:
        if v is None or int(v) < 0 or int(v) > 1_000_000:
            raise ValueError("Cantidad inválida.")
        return int(v)

    @field_validator("codigo_lote")
    @classmethod
    def _codigo(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) > 120:
            raise ValueError("Código de lote demasiado largo (máximo 120 caracteres).")
        return v

    @field_validator("vence_at")
    @classmethod
    def _vence(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if len(v) > 30:
            raise ValueError("Fecha de vencimiento inválida.")
        return v or None


def _pag(limit: int = Query(default=50, ge=1, le=200),
          offset: int = Query(default=0, ge=0)) -> dict[str, int]:
    return {"limit": limit, "offset": offset}


def _filtro_texto(valor: str) -> str:
    """Texto seguro para filtros PostgREST: sin comodines ni sintaxis
    (*, %, comas, paréntesis) que puedan alterar el filtro."""
    limpio = re.sub(r"[,()*%\\\"]", " ", str(valor or ""))
    return " ".join(limpio.split())


# ------------------------------------------------------------------ rutas ---
@router.get("/api/admin/resumen")
def resumen(admin: AdminActual = Depends(requiere("reportes", "leer"))) -> dict[str, Any]:
    productos = _sb_get("productos", {
        "select": "id,stock,stock_minimo",
        "deleted_at": "is.null", "activo": "eq.true", "limit": 5000,
    }) or []
    bajo = sum(1 for p in productos
               if (p.get("stock") or 0) <= (p.get("stock_minimo") if p.get("stock_minimo") is not None else 5))
    pendientes = _sb_get("ordenes", {
        "select": "id", "estado": "eq.pendiente", "limit": 1,
    }) or []
    reclamos = _sb_get("reclamos", {
        "select": "id", "estado": "eq.abierto", "limit": 5000,
    }) or []
    return {
        "productos_activos": len(productos),
        "bajo_stock": bajo,
        "pedidos_pendientes_pagina": len(pendientes),
        "reclamos_abiertos": len(reclamos),
        "rol": admin.rol,
    }


@router.get("/api/admin/productos")
def listar_productos(papelera: bool = False, q: str = "",
                     pag: dict[str, int] = Depends(_pag),
                     admin: AdminActual = Depends(requiere("productos", "leer"))) -> dict[str, Any]:
    params: dict[str, Any] = {
        "select": "*",
        "order": "nombre.asc",
        "limit": pag["limit"],
        "offset": pag["offset"],
        "deleted_at": "not.is.null" if papelera else "is.null",
    }
    if q.strip():
        limpio = _filtro_texto(q)
        if limpio:
            params["nombre"] = f"ilike.*{limpio}*"
    filas = _sb_get("productos", params) or []
    for f in filas:  # centavos para el panel, sin floats
        f["precio_centavos"] = _a_centavos(f.get("precio"))
    return {"productos": filas, "papelera": papelera}


@router.post("/api/admin/productos", status_code=201)
def crear_producto(d: ProductoCrear, request: Request,
                   admin: AdminActual = Depends(requiere("productos", "crear"))) -> dict[str, Any]:
    _limitar(request.client.host if request.client else "?", "producto-crear", 30)
    fila: dict[str, Any] = {
        "nombre": d.nombre, "marca": d.marca, "precio": d.precio,
        "stock": d.stock, "descripcion": d.descripcion, "categoria": d.categoria,
    }
    if (d.imagen or "").strip():
        if not _url_imagen_ok(d.imagen.strip()):
            raise HTTPException(status_code=400, detail="URL de imagen inválida.")
        fila["imagen"] = d.imagen.strip()
    if d.codigo.strip():
        fila["codigo"] = d.codigo.strip()
    else:  # codigo es NOT NULL (001): generamos el siguiente HT-NNNN.
        existentes = _sb_get("productos", {
            "select": "codigo", "codigo": "like.HT-%",
            "order": "codigo.desc", "limit": 1,
        }) or []
        try:
            ultimo = int((existentes[0].get("codigo") or "HT-0000").split("-")[1])
        except (IndexError, ValueError):
            ultimo = 0
        fila["codigo"] = f"HT-{ultimo + 1:04d}"
    creadas = _sb_post("productos", fila) or []
    return {"producto": creadas[0] if creadas else fila}


@router.put("/api/admin/productos/{pid}")
def editar_producto(pid: str, d: ProductoEditar, request: Request,
                    admin: AdminActual = Depends(requiere("productos", "editar"))) -> dict[str, Any]:
    _limitar(request.client.host if request.client else "?", "producto-editar", 30)
    cambios = {k: v for k, v in d.model_dump().items() if v is not None}
    if not cambios:
        raise HTTPException(status_code=400, detail="Sin cambios para aplicar.")
    filas = _sb_patch("productos", {"id": f"eq.{pid}", "deleted_at": "is.null"}, cambios) or []
    if not filas:
        raise HTTPException(status_code=404, detail="Producto inexistente o en papelera.")
    return {"producto": filas[0]}


@router.post("/api/admin/productos/imagen", status_code=201)
async def subir_imagen_producto(request: Request,
                                admin: AdminActual = Depends(requiere("productos", "crear"))) -> dict[str, Any]:
    """Sube una foto al bucket `productos`: valida firma real (JPEG/PNG/WebP),
    tope 5 MB, nombre aleatorio. Sin SVG (pueden llevar scripts)."""
    _limitar(request.client.host if request.client else "?", "producto-imagen", 20)
    form = await request.form()
    archivo = form.get("archivo")
    if archivo is None or not hasattr(archivo, "read"):
        raise HTTPException(status_code=400, detail="Falta el archivo.")
    contenido = await archivo.read()
    if not contenido or len(contenido) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Archivo vacío o mayor a 5 MB.")
    if contenido[:3] == b"\xff\xd8\xff":
        ext = "jpg"
    elif contenido[:8] == b"\x89PNG\r\n\x1a\n":
        ext = "png"
    elif contenido[:4] == b"RIFF" and contenido[8:12] == b"WEBP":
        ext = "webp"
    else:
        raise HTTPException(status_code=400, detail="Solo JPEG, PNG o WebP.")
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base or not key:
        raise HTTPException(status_code=503, detail="Almacenamiento no configurado.")
    nombre = f"admin/{secrets.token_hex(12)}.{ext}"
    try:
        r = httpx.post(f"{base}/storage/v1/object/productos/{nombre}",
                       headers={"apikey": key, "Authorization": f"Bearer {key}",
                                "Content-Type": f"image/{ext}", "x-upsert": "false"},
                       content=contenido, timeout=30.0)
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="No se pudo subir. Intentá más tarde.")
    if r.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail="No se pudo subir. Intentá más tarde.")
    return {"url": f"{base}/storage/v1/object/public/productos/{nombre}"}


@router.delete("/api/admin/productos/{pid}")
def borrar_producto(pid: str, request: Request,
                    admin: AdminActual = Depends(requiere("productos", "borrar"))) -> dict[str, Any]:
    _limitar(request.client.host if request.client else "?", "producto-borrar", 20)
    """Borrado lógico: papelera (deleted_at/deleted_by). Purga a los 30 días."""
    ahora = datetime.now(timezone.utc).isoformat()
    filas = _sb_patch("productos", {"id": f"eq.{pid}", "deleted_at": "is.null"},
                      {"deleted_at": ahora, "deleted_by": admin.user_id}) or []
    if not filas:
        raise HTTPException(status_code=404, detail="Producto inexistente o ya en papelera.")
    return {"ok": True, "id": pid}


@router.post("/api/admin/productos/{pid}/restaurar")
def restaurar_producto(pid: str,
                       admin: AdminActual = Depends(requiere("productos", "editar"))) -> dict[str, Any]:
    filas = _sb_patch("productos", {"id": f"eq.{pid}"},
                      {"deleted_at": None, "deleted_by": None}) or []
    if not filas:
        raise HTTPException(status_code=404, detail="Producto inexistente.")
    return {"producto": filas[0]}


@router.get("/api/admin/productos/{pid}/lotes")
def listar_lotes(pid: str,
                 admin: AdminActual = Depends(requiere("productos", "leer"))) -> dict[str, Any]:
    return {"lotes": _sb_get("producto_lotes", {
        "select": "*", "producto_id": f"eq.{pid}", "order": "created_at.desc", "limit": 200,
    }) or []}


@router.post("/api/admin/productos/{pid}/lotes", status_code=201)
def crear_lote(pid: str, d: LoteCrear,
               admin: AdminActual = Depends(requiere("productos", "editar"))) -> dict[str, Any]:
    creados = _sb_post("producto_lotes", {
        "producto_id": pid, "codigo_lote": d.codigo_lote.strip(),
        "cantidad": d.cantidad, "vence_at": d.vence_at,
    }) or []
    return {"lote": creados[0] if creados else {}}


@router.post("/api/admin/stock/ajustar")
def ajustar_stock(d: StockAjustar, request: Request,
                  admin: AdminActual = Depends(requiere("stock", "ajustar"))) -> dict[str, Any]:
    _limitar(request.client.host if request.client else "?", "stock-ajustar", 30)
    nuevo = _rpc("adjust_stock", {
        "p_producto": d.producto_id, "p_delta": d.delta,
        "p_motivo": d.motivo.strip() or "ajuste", "p_nota": d.nota.strip(),
        "p_actor": admin.user_id,
    })
    return {"producto_id": d.producto_id, "stock": nuevo}


@router.get("/api/admin/pedidos")
def listar_pedidos(estado: str = "",
                   pag: dict[str, int] = Depends(_pag),
                   admin: AdminActual = Depends(requiere("pedidos", "leer"))) -> dict[str, Any]:
    params: dict[str, Any] = {
        "select": "*,orden_items(*,productos(nombre))",
        "order": "created_at.desc",
        "limit": pag["limit"],
        "offset": pag["offset"],
    }
    if estado.strip():
        if estado not in ESTADOS_PEDIDO:
            raise HTTPException(status_code=400, detail="Estado inválido.")
        params["estado"] = f"eq.{estado}"
    pedidos = _sb_get("ordenes", params) or []
    # Comprobante por pedido (UNIQUE orden_id). Si la base aún no tiene 012,
    # el listado igual responde (queda sin comprobante hasta migrar).
    ids = [str(p.get("id")) for p in pedidos if p.get("id")]
    por_orden: dict[str, dict[str, Any]] = {}
    if ids:
        try:
            comps = _sb_get("comprobantes", {
                "select": "id,orden_id,numero,emitido_en,total_centavos",
                "orden_id": f"in.({','.join(ids)})",
            }) or []
            por_orden = {str(c.get("orden_id")): c for c in comps}
        except HTTPException:
            por_orden = {}
    for p in pedidos:  # totales en centavos calculados en servidor
        sub = int(p.get("subtotal_centavos") or _a_centavos(p.get("subtotal")))
        cupon = None
        if (p.get("cupon_codigo") or "").strip():
            filas = _sb_get("cupones", {
                "select": "tipo,valor", "codigo": f"eq.{p['cupon_codigo'].strip().upper()}", "limit": 1,
            }) or []
            cupon = filas[0] if filas else None
        try:
            p["totales"] = _totales_con_cupon(sub, cupon)
        except ValueError:
            p["totales"] = {"subtotal_centavos": sub, "descuento_centavos": 0, "total_centavos": sub}
        p["comprobante"] = por_orden.get(str(p.get("id")))
    return {"pedidos": pedidos}


@router.post("/api/admin/pedidos/{pid}/estado")
def cambiar_estado(pid: str, d: PedidoEstado, request: Request,
                    admin: AdminActual = Depends(requiere("pedidos", "cambiar_estado"))) -> dict[str, Any]:
    _limitar(request.client.host if request.client else "?", "pedido-estado", 30)
    nueva_version = _rpc("cambiar_estado_pedido", {
        "p_id": pid, "p_a": d.a,
        "p_nota": d.nota.strip(), "p_version": d.version,
        "p_actor": admin.user_id,
    })
    return {"id": pid, "estado": d.a, "version": nueva_version}


@router.get("/api/admin/pedidos/{pid}/comprobante/pdf")
def comprobante_pedido_pdf(pid: str,
                           admin: AdminActual = Depends(requiere("pedidos", "leer"))) -> Response:
    c = obtener_comprobante(pid.strip())
    if not c:
        raise HTTPException(status_code=404, detail="Este pedido todavía no tiene comprobante.")
    return Response(
        content=comprobante_pdf(c), media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=comprobante-{c.get('numero') or pid}.pdf"},
    )


# --------------------------------------------------------------- clientes ---
# Página "Personas": perfiles reales + métricas de sus pedidos. Solo lectura;
# el permiso es el de la matriz (usuarios.leer, hoy solo owner).
_ESTADOS_COMPRA = {"pagada", "preparacion", "enviada", "entregada"}


def _emails_auth() -> dict[str, str]:
    """id→email desde GoTrue (service_role). {} si no se puede consultar."""
    url, key = _env()
    try:
        r = httpx.get(f"{url}/auth/v1/admin/users",
                      headers={"apikey": key, "Authorization": f"Bearer {key}"},
                      params={"page": 1, "per_page": 1000}, timeout=15.0)
    except httpx.HTTPError:
        return {}
    if r.status_code != 200:
        return {}
    try:
        usuarios = (r.json() or {}).get("users") or []
    except Exception:
        return {}
    return {str(u.get("id")): (u.get("email") or "") for u in usuarios if u.get("id")}


def _resumen_pedidos(ids: list[str]) -> dict[str, dict[str, Any]]:
    """Conteo, total comprado y último pedido por user_id (sin inventar)."""
    resumen: dict[str, dict[str, Any]] = {}
    if not ids:
        return resumen
    filas = _sb_get("ordenes", {
        "select": "user_id,estado,total_centavos,created_at",
        "user_id": f"in.({','.join(ids)})",
        "order": "created_at.desc",
        "limit": 2000,
    }) or []
    for o in filas:
        uid = str(o.get("user_id") or "")
        if not uid:
            continue
        r = resumen.setdefault(uid, {"pedidos": 0, "comprado_centavos": 0,
                                     "ultimo_pedido": None, "ultimo_estado": ""})
        r["pedidos"] += 1
        if str(o.get("estado")) in _ESTADOS_COMPRA:
            r["comprado_centavos"] += int(o.get("total_centavos") or 0)
        if r["ultimo_pedido"] is None:  # filas ya vienen desc por fecha
            r["ultimo_pedido"] = o.get("created_at")
            r["ultimo_estado"] = str(o.get("estado") or "")
    return resumen


@router.get("/api/admin/clientes")
def listar_clientes(q: str = "",
                    pag: dict[str, int] = Depends(_pag),
                    admin: AdminActual = Depends(requiere("usuarios", "leer"))) -> dict[str, Any]:
    params: dict[str, Any] = {
        "select": "id,nombre,telefono,direccion,ciudad,codigo_postal,rol,created_at",
        "order": "created_at.desc",
        "limit": pag["limit"], "offset": pag["offset"],
    }
    if q.strip():
        limpio = _filtro_texto(q)
        if limpio:
            params["nombre"] = f"ilike.*{limpio}*"
    perfiles = _sb_get("perfiles", params) or []
    ids = [str(p.get("id")) for p in perfiles if p.get("id")]
    resumen = _resumen_pedidos(ids)
    correos = _emails_auth()
    for p in perfiles:
        uid = str(p.get("id"))
        p["email"] = correos.get(uid, "")
        p["resumen"] = resumen.get(uid, {"pedidos": 0, "comprado_centavos": 0,
                                         "ultimo_pedido": None, "ultimo_estado": ""})
    return {"clientes": perfiles}


@router.get("/api/admin/reclamos")
def listar_reclamos(estado: str = "",
                    pag: dict[str, int] = Depends(_pag),
                    admin: AdminActual = Depends(requiere("reclamos", "leer"))) -> dict[str, Any]:
    params: dict[str, Any] = {
        "select": "*", "order": "created_at.desc",
        "limit": pag["limit"], "offset": pag["offset"],
    }
    if estado.strip():
        if estado not in ESTADOS_RECLAMO:
            raise HTTPException(status_code=400, detail="Estado inválido.")
        params["estado"] = f"eq.{estado}"
    return {"reclamos": _sb_get("reclamos", params) or []}


@router.post("/api/admin/reclamos", status_code=201)
def crear_reclamo(d: ReclamoCrear, request: Request,
                  admin: AdminActual = Depends(requiere("reclamos", "crear"))) -> dict[str, Any]:
    _limitar(request.client.host if request.client else "?", "reclamo-crear", 10)
    if d.orden_id:
        # Anti-IDOR: la orden debe existir y ser propia, salvo staff con
        # lectura de pedidos (radican en nombre del cliente).
        ordenes = _sb_get("ordenes", {
            "select": "id,user_id", "id": f"eq.{d.orden_id}", "limit": 1,
        }) or []
        if not ordenes:
            raise HTTPException(status_code=404, detail="Orden inexistente.")
        duenio = ordenes[0].get("user_id")
        es_staff_pedidos = ("pedidos", "leer") in PERMISOS.get(admin.rol, set())
        if duenio != admin.user_id and not es_staff_pedidos:
            raise HTTPException(status_code=403, detail="Sin permiso sobre esa orden.")
    creados = _sb_post("reclamos", {
        "orden_id": d.orden_id, "user_id": admin.user_id,
        "motivo": d.motivo, "detalle": d.detalle.strip(),
    }) or []
    return {"reclamo": creados[0] if creados else {}}


@router.patch("/api/admin/reclamos/{rid}")
def estado_reclamo(rid: str, d: ReclamoEstado,
                   admin: AdminActual = Depends(requiere("reclamos", "cambiar_estado"))) -> dict[str, Any]:
    filas = _sb_patch("reclamos", {"id": f"eq.{rid}"}, {"estado": d.estado}) or []
    if not filas:
        raise HTTPException(status_code=404, detail="Reclamo inexistente.")
    return {"reclamo": filas[0]}


# ------------------------------------------------------- bandeja (hilos) ---
# La bandeja trata cada reclamo como una conversación: KPIs reales + lista
# con último mensaje real. Sin mensajes, no hay hilos inventados (ultimo=None
# y el hilo muestra el detalle original del reclamo como único contexto).
import re as _re_bandeja

_RE_NOMBRE_RECLAMO = _re_bandeja.compile(r"—\s*(?P<nombre>.+?)\s*<(?P<email>[^<>]+)>\s*$")


def _cliente_de_reclamo(r: dict[str, Any]) -> str:
    """Nombre del reclamante o 'Invitado'.

    El formulario público (/reclamo) guarda `motivo` como
    '<motivo> — <nombre> <email>'; si no matchea, es invitado/anónimo.
    Nunca se inventa un nombre: solo se parsea lo guardado.
    """
    m = _RE_NOMBRE_RECLAMO.search(str(r.get("motivo") or ""))
    nombre = (m.group("nombre") if m else "").strip()
    return nombre or "Invitado"


@router.get("/api/admin/bandeja")
def bandeja(admin: AdminActual = Depends(requiere("reclamos", "leer"))) -> dict[str, Any]:
    """KPIs reales + conversaciones (reclamos con su último mensaje real)."""
    todos = _sb_get("reclamos", {
        "select": "id,motivo,detalle,estado,created_at,updated_at,user_id,orden_id",
        "order": "created_at.desc", "limit": 5000,
    }) or []

    por_estado: dict[str, int] = {e: 0 for e in ESTADOS_RECLAMO}
    for r in todos:
        if r.get("estado") in por_estado:
            por_estado[r.get("estado")] += 1

    hoy = datetime.now(timezone.utc).date().isoformat()
    abiertos_hoy = sum(1 for r in todos
                       if r.get("estado") == "abierto"
                       and str(r.get("created_at") or "")[:10] == hoy)

    # Mensajes de los recientes (para el snippet) y de los abiertos
    # (para "sin responder"). Topes para no armar URLs eternas.
    recientes = todos[:100]
    abiertos = [r for r in todos if r.get("estado") in ("abierto", "en_revision")][:500]
    ids = {r.get("id") for r in recientes} | {r.get("id") for r in abiertos}
    ids.discard(None)
    por_reclamo: dict[str, list[dict[str, Any]]] = {}
    if ids:
        msgs = _sb_get("reclamo_mensajes", {
            "select": "reclamo_id,autor,texto,created_at",
            "reclamo_id": f"in.({','.join(sorted(str(i) for i in ids))})",
            "order": "created_at.asc", "limit": 5000,
        }) or []
        for m in msgs:
            por_reclamo.setdefault(str(m.get("reclamo_id")), []).append(m)

    # Sin responder >48h: abierto/en revisión donde lo último relevante del
    # cliente (o la radicación) tiene más de 48h y ningún staff/sistema
    # escribió después. Todo sale de created_at reales, nada estimado.
    ahora = datetime.now(timezone.utc)
    sin_responder = 0
    for r in abiertos:
        msgs = por_reclamo.get(str(r.get("id")), [])
        ult_staff = max(
            (str(m.get("created_at") or "") for m in msgs if m.get("autor") in ("staff", "sistema")),
            default="",
        )
        ref_candidatos = [str(r.get("created_at") or "")]
        ref_candidatos += [str(m.get("created_at") or "") for m in msgs
                           if m.get("autor") not in ("staff", "sistema")]
        ref = max(ref_candidatos)
        if ult_staff and ult_staff >= ref:
            continue  # staff respondió después de lo último del cliente
        try:
            ref_dt = datetime.fromisoformat(ref.replace("Z", "+00:00"))
            if (ahora - ref_dt).total_seconds() > 48 * 3600:
                sin_responder += 1
        except ValueError:
            continue

    conversaciones = []
    for r in recientes:
        msgs = por_reclamo.get(str(r.get("id")), [])
        ultimo = msgs[-1] if msgs else None
        conversaciones.append({
            "id": r.get("id"),
            "cliente": _cliente_de_reclamo(r),
            "motivo": r.get("motivo") or "",
            "detalle": r.get("detalle") or "",
            "estado": r.get("estado") or "",
            "orden_id": r.get("orden_id"),
            "created_at": r.get("created_at"),
            "updated_at": r.get("updated_at"),
            "ultimo": ({
                "autor": ultimo.get("autor"),
                "texto": ultimo.get("texto"),
                "created_at": ultimo.get("created_at"),
            } if ultimo else None),
        })

    return {
        "kpis": {
            "abiertos_hoy": abiertos_hoy,
            "sin_responder_48h": sin_responder,
            "por_estado": por_estado,
        },
        "conversaciones": conversaciones,
    }


@router.get("/api/admin/reclamos/{rid}/mensajes")
def mensajes_reclamo(rid: str,
                     admin: AdminActual = Depends(requiere("reclamos", "leer"))) -> dict[str, Any]:
    existe = _sb_get("reclamos", {"select": "id", "id": f"eq.{rid}", "limit": 1}) or []
    if not existe:
        raise HTTPException(status_code=404, detail="Reclamo inexistente.")
    return {"mensajes": _sb_get("reclamo_mensajes", {
        "select": "*", "reclamo_id": f"eq.{rid}",
        "order": "created_at.asc", "limit": 500,
    }) or []}


@router.post("/api/admin/reclamos/{rid}/mensajes", status_code=201)
def crear_mensaje_reclamo(rid: str, d: MensajeReclamoCrear, request: Request,
                          admin: AdminActual = Depends(requiere("reclamos", "editar"))) -> dict[str, Any]:
    _limitar(request.client.host if request.client else "?", "reclamo-mensaje", 20)
    existe = _sb_get("reclamos", {"select": "id", "id": f"eq.{rid}", "limit": 1}) or []
    if not existe:
        raise HTTPException(status_code=404, detail="Reclamo inexistente.")
    creados = _sb_post("reclamo_mensajes", {
        "reclamo_id": rid, "autor": d.autor, "texto": d.texto,
    }) or []
    return {"mensaje": creados[0] if creados else {}}


@router.get("/api/admin/cupones")
def listar_cupones(pag: dict[str, int] = Depends(_pag),
                   admin: AdminActual = Depends(requiere("cupones", "leer"))) -> dict[str, Any]:
    return {"cupones": _sb_get("cupones", {
        "select": "*", "deleted_at": "is.null",
        "order": "created_at.desc", "limit": pag["limit"], "offset": pag["offset"],
    }) or []}


@router.post("/api/admin/cupones", status_code=201)
def crear_cupon(d: CuponCrear, request: Request,
                admin: AdminActual = Depends(requiere("cupones", "crear"))) -> dict[str, Any]:
    _limitar(request.client.host if request.client else "?", "cupon-crear", 20)
    if d.tipo == "porcentaje" and d.valor > 100:
        raise HTTPException(status_code=400, detail="Porcentaje inválido (1–100).")
    creados = _sb_post("cupones", {
        "codigo": d.codigo, "tipo": d.tipo, "valor": d.valor,
        "min_compra_centavos": d.min_compra_centavos, "usos_max": d.usos_max,
        "activo": d.activo, "vence_at": d.vence_at,
    }) or []
    return {"cupon": _redactar(creados[0]) if creados else {}}


@router.delete("/api/admin/cupones/{cid}")
def borrar_cupon(cid: str,
                 admin: AdminActual = Depends(requiere("cupones", "borrar"))) -> dict[str, Any]:
    ahora = datetime.now(timezone.utc).isoformat()
    filas = _sb_patch("cupones", {"id": f"eq.{cid}"}, {"deleted_at": ahora}) or []
    if not filas:
        raise HTTPException(status_code=404, detail="Cupón inexistente.")
    return {"ok": True, "id": cid}


@router.get("/api/admin/banners")
def listar_banners(pag: dict[str, int] = Depends(_pag),
                   admin: AdminActual = Depends(requiere("banners", "leer"))) -> dict[str, Any]:
    return {"banners": _sb_get("banners", {
        "select": "*", "deleted_at": "is.null",
        "order": "orden.asc", "limit": pag["limit"], "offset": pag["offset"],
    }) or []}


@router.post("/api/admin/banners", status_code=201)
def crear_banner(d: BannerCrear, request: Request,
                 admin: AdminActual = Depends(requiere("banners", "crear"))) -> dict[str, Any]:
    _limitar(request.client.host if request.client else "?", "banner-crear", 20)
    creados = _sb_post("banners", d.model_dump()) or []
    return {"banner": creados[0] if creados else {}}


@router.put("/api/admin/banners/{bid}")
def editar_banner(bid: str, d: BannerEditar,
                  admin: AdminActual = Depends(requiere("banners", "editar"))) -> dict[str, Any]:
    cambios = {k: v for k, v in d.model_dump().items() if v is not None}
    if not cambios:
        raise HTTPException(status_code=400, detail="Sin cambios para aplicar.")
    filas = _sb_patch("banners", {"id": f"eq.{bid}", "deleted_at": "is.null"}, cambios) or []
    if not filas:
        raise HTTPException(status_code=404, detail="Banner inexistente.")
    return {"banner": filas[0]}


@router.delete("/api/admin/banners/{bid}")
def borrar_banner(bid: str,
                  admin: AdminActual = Depends(requiere("banners", "borrar"))) -> dict[str, Any]:
    ahora = datetime.now(timezone.utc).isoformat()
    filas = _sb_patch("banners", {"id": f"eq.{bid}"},
                      {"deleted_at": ahora, "deleted_by": admin.user_id}) or []
    if not filas:
        raise HTTPException(status_code=404, detail="Banner inexistente.")
    return {"ok": True, "id": bid}


@router.get("/api/admin/notificaciones")
def listar_notificaciones(pag: dict[str, int] = Depends(_pag),
                          admin: AdminActual = Depends(requiere("notificaciones", "leer"))) -> dict[str, Any]:
    return {"notificaciones": _sb_get("notificaciones", {
        "select": "*", "order": "created_at.desc",
        "limit": pag["limit"], "offset": pag["offset"],
    }) or []}


@router.get("/api/buscar")
def buscar(q: str = Query(default="", max_length=120),
           limite: int = Query(default=20, ge=1, le=50),
           request: Request = None,
           admin: AdminActual = Depends(requiere("buscar", "leer"))) -> dict[str, Any]:
    if request is not None:
        _limitar(request.client.host if request.client else "?", "buscar", 30)
    if not q.strip():
        return {"resultados": []}
    filas = _rpc("buscar_productos", {"q": q.strip(), "limite": limite}) or []
    return {"resultados": filas}


@router.get("/api/admin/auditoria")
def listar_auditoria(modulo: str = "", entidad: str = "",
                     pag: dict[str, int] = Depends(_pag),
                     admin: AdminActual = Depends(requiere("auditoria", "leer"))) -> dict[str, Any]:
    params: dict[str, Any] = {
        "select": "*", "order": "created_at.desc",
        "limit": pag["limit"], "offset": pag["offset"],
    }
    if modulo.strip():
        params["modulo"] = f"eq.{modulo.strip()}"
    if entidad.strip():
        params["entidad"] = f"eq.{entidad.strip()}"
    filas = _sb_get("audit_log", params) or []
    # Append-only: solo lectura; se redactan secretos de diff/meta.
    return {"eventos": [_redactar(f) for f in filas]}


@router.get("/api/admin/reportes/ventas")
def reporte_ventas(desde: str = "", hasta: str = "",
                   admin: AdminActual = Depends(requiere("reportes", "leer"))) -> dict[str, Any]:
    import re as _re
    _fecha = _re.compile(r"^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$")
    for etiqueta, valor in (("desde", desde.strip()), ("hasta", hasta.strip())):
        # Sin validación, `desde`/`hasta` se interpolan en el filtro `and=`
        # de PostgREST: comas/paréntesis inyectarían filtros (solo lectura,
        # pero rompen el rango y devuelven 400 del proveedor).
        if valor and not _fecha.match(valor):
            raise HTTPException(status_code=400, detail=f"Fecha {etiqueta} inválida (usar AAAA-MM-DD).")
    params: dict[str, Any] = {
        "select": "id,estado,subtotal_centavos,descuento_centavos,total_centavos,subtotal,total,created_at",
        "order": "created_at.asc", "limit": 5000,
    }
    filtros_and: list[str] = []
    if desde.strip():
        filtros_and.append(f"created_at.gte.{desde.strip()}")
    if hasta.strip():
        filtros_and.append(f"created_at.lte.{hasta.strip()}")
    if filtros_and:
        params["and"] = f"({','.join(filtros_and)})"
    ordenes = _sb_get("ordenes", params) or []
    por_dia: dict[str, dict[str, int]] = defaultdict(lambda: {"pedidos": 0, "total_centavos": 0})
    total = 0
    por_estado: dict[str, int] = defaultdict(int)
    for o in ordenes:
        tot = int(o.get("total_centavos") or _a_centavos(o.get("total")))
        dia = str(o.get("created_at") or "")[:10]
        por_dia[dia]["pedidos"] += 1
        por_dia[dia]["total_centavos"] += tot
        por_estado[o.get("estado") or ""] += 1
        total += tot
    return {
        "pedidos": len(ordenes),
        "total_centavos": total,  # entero, sin floats
        "por_estado": dict(por_estado),
        "por_dia": [{"dia": d, **v} for d, v in sorted(por_dia.items())],
    }
