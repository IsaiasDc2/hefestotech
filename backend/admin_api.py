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
        ("proveedores", "leer"), ("proveedores", "crear"), ("proveedores", "editar"), ("proveedores", "borrar"),
        ("compras", "leer"), ("compras", "crear"), ("compras", "editar"), ("compras", "cambiar_estado"),
        ("compras", "recibir"),
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
        ("proveedores", "leer"), ("proveedores", "crear"), ("proveedores", "editar"), ("proveedores", "borrar"),
        ("compras", "leer"), ("compras", "crear"), ("compras", "editar"), ("compras", "cambiar_estado"),
        ("compras", "recibir"),
    },
    "operador": {
        ("productos", "leer"), ("productos", "crear"), ("productos", "editar"),
        ("pedidos", "leer"), ("pedidos", "cambiar_estado"),
        ("stock", "leer"), ("stock", "ajustar"),
        ("reclamos", "leer"),
        ("cupones", "leer"), ("banners", "leer"),
        ("notificaciones", "leer"), ("reportes", "leer"), ("buscar", "leer"),
        ("proveedores", "leer"), ("proveedores", "crear"), ("proveedores", "editar"),
        ("compras", "leer"), ("compras", "crear"), ("compras", "editar"), ("compras", "cambiar_estado"),
        ("compras", "recibir"),
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
        ("proveedores", "leer"), ("compras", "leer"),
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
    "orden de compra inexistente", "la orden no admite recepción", "recepción sin ítems",
    "cantidad inválida", "producto fuera de la orden", "recepción excede lo pedido",
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


# --------------------------------------------------- proveedores y compras ---
# Módulo §5.3 (alcance MVP). Tablas y RPC en 014_proveedores_compras.sql.
# Montos en centavos enteros en la moneda de cada proveedor/orden (ARS|USD).
CONDICIONES_IVA = {"responsable_inscripto", "monotributo", "exento", "no_responsable", "consumidor_final"}
CONDICIONES_PAGO = {"contado", "15_dias", "30_dias", "60_dias"}
MONEDAS = {"ARS", "USD"}
ESTADOS_PROVEEDOR = {"activo", "inactivo", "en_evaluacion"}
ESTADOS_OC = {"borrador", "enviada", "confirmada", "recibida_parcial", "recibida", "cancelada"}
OC_ABIERTAS = {"borrador", "enviada", "confirmada", "recibida_parcial"}
OC_RECIBIBLES = {"enviada", "confirmada", "recibida_parcial"}
# Transiciones manuales. recibida_parcial/recibida solo las fija la RPC de
# recepción; cancelar una parcial cierra el saldo pendiente (lo recibido queda).
TRANSICIONES_OC: dict[str, set[str]] = {
    "borrador": {"enviada", "cancelada"},
    "enviada": {"confirmada", "cancelada"},
    "confirmada": {"cancelada"},
    "recibida_parcial": {"cancelada"},
}
_PREFIJOS_CUIT = {"20", "23", "24", "25", "26", "27", "30", "33", "34"}
_RE_UUID = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
_RE_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_RE_ALIAS_CBU = re.compile(r"^[A-Za-z0-9.\-]{6,20}$")
_MAX_CENTAVOS = 10_000_000_000_00


def _solo_digitos(valor: Any) -> str:
    return re.sub(r"\D", "", str(valor or ""))


def _cuit_valido(cuit: str) -> bool:
    """CUIT/CUIL de 11 dígitos con dígito verificador módulo 11.
    Espejo de `cuit_valido()` (014). Resto 10 = inválido (AFIP reasigna
    prefijo 23/33 en ese caso, así que nunca se emite)."""
    if not re.fullmatch(r"\d{11}", cuit or "") or cuit[:2] not in _PREFIJOS_CUIT:
        return False
    suma = sum(int(d) * p for d, p in zip(cuit[:10], (5, 4, 3, 2, 7, 6, 5, 4, 3, 2)))
    resto = 11 - (suma % 11)
    dv = 0 if resto == 11 else resto
    return dv != 10 and dv == int(cuit[10])


def _cbu_valido(cbu: str) -> bool:
    """CBU de 22 dígitos: bloque banco/sucursal (8) y bloque cuenta (14),
    cada uno con su dígito verificador."""
    if not re.fullmatch(r"\d{22}", cbu or ""):
        return False

    def bloque_ok(digitos: str, pesos: tuple[int, ...]) -> bool:
        suma = sum(int(d) * p for d, p in zip(digitos[:-1], pesos))
        return (10 - suma % 10) % 10 == int(digitos[-1])

    return (bloque_ok(cbu[:8], (7, 1, 3, 9, 7, 1, 3))
            and bloque_ok(cbu[8:], (3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3)))


def _proveedor_salida(p: dict[str, Any]) -> dict[str, Any]:
    """El CBU nunca sale completo del servidor: solo los últimos 4 dígitos."""
    fila = dict(p)
    cbu = str(fila.pop("cbu", "") or "")
    fila["cbu_mascara"] = f"•••• {cbu[-4:]}" if cbu else ""
    return fila


def _uuid(valor: str, que: str = "Identificador") -> str:
    v = (valor or "").strip()
    if not _RE_UUID.match(v):
        raise HTTPException(status_code=400, detail=f"{que} inválido.")
    return v


def _codigo_oc(numero: Any) -> str:
    try:
        return f"OC-{int(numero):06d}"
    except (TypeError, ValueError):
        return "OC-—"


def _resumen_oc(oc: dict[str, Any]) -> dict[str, Any]:
    """Agrega código, total y avance de recepción calculados en servidor."""
    items = oc.get("ordenes_compra_items") or []
    oc["codigo"] = _codigo_oc(oc.get("numero"))
    oc["total_centavos"] = sum(int(i.get("cantidad") or 0) * int(i.get("costo_unitario_centavos") or 0)
                               for i in items)
    oc["unidades_pedidas"] = sum(int(i.get("cantidad") or 0) for i in items)
    oc["unidades_recibidas"] = sum(int(i.get("cantidad_recibida") or 0) for i in items)
    return oc


def _validar_recepcion(estado: str, lineas: list[dict[str, Any]],
                       items: list[dict[str, Any]]) -> Optional[tuple[int, str]]:
    """Chequeo previo a la RPC (misma regla que `recibir_orden_compra`):
    (status, mensaje) si la recepción no procede, None si está bien."""
    if estado not in OC_RECIBIBLES:
        return 409, f"La orden está en estado «{estado}» y no admite recepción."
    por_producto = {str(l.get("producto_id")): l for l in lineas}
    for it in items:
        linea = por_producto.get(str(it.get("producto_id")))
        if linea is None:
            return 400, "Hay productos que no están en la orden."
        pendiente = int(linea.get("cantidad") or 0) - int(linea.get("cantidad_recibida") or 0)
        if int(it.get("cantidad") or 0) > pendiente:
            return 400, f"Recepción excede lo pedido (quedan {pendiente} unidades pendientes)."
    return None


def _sugerencias_reposicion(productos: list[dict[str, Any]],
                            relaciones: list[dict[str, Any]],
                            proveedores: list[dict[str, Any]],
                            en_ordenes: dict[str, int]) -> list[dict[str, Any]]:
    """Productos con stock < stock_mínimo agrupados por proveedor principal.

    Objetivo: 2 × mínimo. Sugerida = objetivo − stock − lo ya pedido en OC
    abiertas (incluye borradores, para no duplicar pedidos), llevada como
    mínimo a la cantidad mínima del proveedor. Si lo pedido ya cubre, no se
    sugiere. Sin proveedor principal → grupo con proveedor None.
    """
    rel_por_producto = {str(r.get("producto_id")): r for r in relaciones}
    prov_por_id = {str(p.get("id")): p for p in proveedores}
    grupos: dict[str, dict[str, Any]] = {}
    for p in productos:
        stock = int(p.get("stock") or 0)
        minimo = int(p.get("stock_minimo") if p.get("stock_minimo") is not None else 5)
        if stock >= minimo:
            continue
        pid = str(p.get("id"))
        pedidas = int(en_ordenes.get(pid, 0))
        faltan = 2 * minimo - stock - pedidas
        if faltan <= 0:
            continue
        rel = rel_por_producto.get(pid)
        prov = prov_por_id.get(str(rel.get("proveedor_id"))) if rel else None
        if not prov:
            rel = None  # principal en papelera: cuenta como sin proveedor
        sugerida = max(faltan, int(rel.get("cantidad_minima") or 1)) if rel else faltan
        costo = int(rel.get("costo_centavos") or 0) if rel else 0
        grupo = grupos.setdefault(str(prov.get("id")) if prov else "", {
            "proveedor": ({k: prov.get(k) for k in ("id", "nombre", "moneda", "estado", "pedido_minimo_centavos")}
                          if prov else None),
            "items": [], "total_centavos": 0,
        })
        grupo["items"].append({
            "producto_id": pid, "nombre": p.get("nombre") or "", "codigo": p.get("codigo") or "",
            "stock": stock, "stock_minimo": minimo, "en_ordenes": pedidas, "sugerida": sugerida,
            "costo_unitario_centavos": costo,
            "codigo_proveedor": (rel.get("codigo_proveedor") or "") if rel else "",
        })
        grupo["total_centavos"] += sugerida * costo
    return sorted(grupos.values(),
                  key=lambda g: (g["proveedor"] is None, str((g["proveedor"] or {}).get("nombre") or "").lower()))


class Contacto(BaseModel):
    nombre: str
    cargo: str = ""
    email: str = ""
    telefono: str = ""

    @field_validator("nombre", "cargo", "email", "telefono")
    @classmethod
    def _textos(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) > 200:
            raise ValueError("Dato de contacto demasiado largo (máximo 200 caracteres).")
        return v

    @model_validator(mode="after")
    def _completo(self):
        if not self.nombre:
            raise ValueError("Cada contacto necesita un nombre.")
        if self.email and not _RE_EMAIL.match(self.email):
            raise ValueError("Email de contacto inválido.")
        return self


class ProveedorDatos(BaseModel):
    """Alta y edición. En la edición solo se aplica lo enviado
    (exclude_unset): el CBU se manda solo para reemplazarlo ("" lo borra)."""
    nombre: Optional[str] = None  # razón social
    nombre_comercial: Optional[str] = None
    cuit: Optional[str] = None
    condicion_iva: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    whatsapp: Optional[str] = None
    sitio_web: Optional[str] = None
    direccion: Optional[str] = None
    provincia: Optional[str] = None
    ciudad: Optional[str] = None
    contactos: Optional[list[Contacto]] = None
    condicion_pago: Optional[str] = None
    moneda: Optional[str] = None
    plazo_entrega_dias: Optional[int] = None
    pedido_minimo_centavos: Optional[int] = None
    descuento_pct: Optional[float] = None
    cbu: Optional[str] = None
    alias_cbu: Optional[str] = None
    notas: Optional[str] = None
    etiquetas: Optional[list[str]] = None
    calificacion: Optional[int] = None
    estado: Optional[str] = None

    @field_validator("nombre")
    @classmethod
    def _nombre(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if not v or len(v) > 200:
            raise ValueError("Razón social requerida (máximo 200 caracteres).")
        return v

    @field_validator("nombre_comercial", "telefono", "whatsapp", "direccion", "provincia", "ciudad")
    @classmethod
    def _textos(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if len(v) > 300:
            raise ValueError("Texto demasiado largo (máximo 300 caracteres).")
        return v

    @field_validator("notas")
    @classmethod
    def _notas(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if len(v) > 2000:
            raise ValueError("Notas demasiado largas (máximo 2000 caracteres).")
        return v

    @field_validator("email")
    @classmethod
    def _email(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if v and (len(v) > 200 or not _RE_EMAIL.match(v)):
            raise ValueError("Email inválido.")
        return v

    @field_validator("sitio_web")
    @classmethod
    def _web(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if v and (len(v) > 300 or not v.lower().startswith(("https://", "http://"))):
            raise ValueError("Sitio web inválido (https://…).")
        return v

    @field_validator("cuit")
    @classmethod
    def _cuit(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        digitos = _solo_digitos(v)
        if digitos and not _cuit_valido(digitos):
            raise ValueError("CUIT inválido (revisá el dígito verificador).")
        return digitos

    @field_validator("cbu")
    @classmethod
    def _cbu(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        digitos = _solo_digitos(v)
        if digitos and not _cbu_valido(digitos):
            raise ValueError("CBU inválido (22 dígitos con verificadores correctos).")
        return digitos

    @field_validator("alias_cbu")
    @classmethod
    def _alias(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if v and not _RE_ALIAS_CBU.match(v):
            raise ValueError("Alias inválido (6 a 20 letras, números, puntos o guiones).")
        return v

    @field_validator("condicion_iva")
    @classmethod
    def _iva(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in CONDICIONES_IVA:
            raise ValueError("Condición frente al IVA inválida.")
        return v

    @field_validator("condicion_pago")
    @classmethod
    def _pago(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in CONDICIONES_PAGO:
            raise ValueError("Condición de pago inválida (contado | 15_dias | 30_dias | 60_dias).")
        return v

    @field_validator("moneda")
    @classmethod
    def _moneda(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in MONEDAS:
            raise ValueError("Moneda inválida (ARS | USD).")
        return v

    @field_validator("estado")
    @classmethod
    def _estado(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ESTADOS_PROVEEDOR:
            raise ValueError("Estado inválido (activo | inactivo | en_evaluacion).")
        return v

    @field_validator("plazo_entrega_dias")
    @classmethod
    def _plazo(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and not 0 <= int(v) <= 365:
            raise ValueError("Plazo de entrega inválido (0 a 365 días).")
        return v

    @field_validator("pedido_minimo_centavos")
    @classmethod
    def _pedido_min(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and not 0 <= int(v) <= _MAX_CENTAVOS:
            raise ValueError("Pedido mínimo inválido.")
        return v

    @field_validator("descuento_pct")
    @classmethod
    def _descuento(cls, v: Optional[float]) -> Optional[float]:
        if v is None:
            return None
        if not 0 <= float(v) <= 100:
            raise ValueError("Descuento inválido (0 a 100%).")
        return round(float(v), 2)

    @field_validator("calificacion")
    @classmethod
    def _calificacion(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and not 1 <= int(v) <= 5:
            raise ValueError("Calificación inválida (1 a 5).")
        return v

    @field_validator("etiquetas")
    @classmethod
    def _etiquetas(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        if v is None:
            return None
        limpias: list[str] = []
        for e in v:
            e = str(e or "").strip()
            if len(e) > 40:
                raise ValueError("Etiqueta demasiado larga (máximo 40 caracteres).")
            if e and e not in limpias:
                limpias.append(e)
        if len(limpias) > 20:
            raise ValueError("Máximo 20 etiquetas.")
        return limpias

    @field_validator("contactos")
    @classmethod
    def _contactos(cls, v: Optional[list[Contacto]]) -> Optional[list[Contacto]]:
        if v is not None and len(v) > 20:
            raise ValueError("Máximo 20 contactos.")
        return v


class ProductoProveedorDatos(BaseModel):
    costo_centavos: int = 0
    moneda: str = "ARS"
    codigo_proveedor: str = ""
    cantidad_minima: int = 1
    tiempo_entrega_dias: int = 7
    es_principal: bool = False

    @field_validator("costo_centavos")
    @classmethod
    def _costo(cls, v: int) -> int:
        if v is None or not 0 <= int(v) <= _MAX_CENTAVOS:
            raise ValueError("Costo inválido.")
        return int(v)

    @field_validator("moneda")
    @classmethod
    def _moneda(cls, v: str) -> str:
        if v not in MONEDAS:
            raise ValueError("Moneda inválida (ARS | USD).")
        return v

    @field_validator("codigo_proveedor")
    @classmethod
    def _codigo(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) > 80:
            raise ValueError("Código del proveedor demasiado largo (máximo 80 caracteres).")
        return v

    @field_validator("cantidad_minima")
    @classmethod
    def _cant_min(cls, v: int) -> int:
        if v is None or not 1 <= int(v) <= 1_000_000:
            raise ValueError("Cantidad mínima inválida.")
        return int(v)

    @field_validator("tiempo_entrega_dias")
    @classmethod
    def _plazo(cls, v: int) -> int:
        if v is None or not 0 <= int(v) <= 365:
            raise ValueError("Plazo de entrega inválido (0 a 365 días).")
        return int(v)


class ItemOrdenCompra(BaseModel):
    producto_id: str
    cantidad: int
    costo_unitario_centavos: int = 0

    @field_validator("producto_id")
    @classmethod
    def _producto(cls, v: str) -> str:
        v = (v or "").strip()
        if not _RE_UUID.match(v):
            raise ValueError("Producto inválido.")
        return v

    @field_validator("cantidad")
    @classmethod
    def _cantidad(cls, v: int) -> int:
        if v is None or not 1 <= int(v) <= 1_000_000:
            raise ValueError("Cantidad inválida (1 a 1000000).")
        return int(v)

    @field_validator("costo_unitario_centavos")
    @classmethod
    def _costo(cls, v: int) -> int:
        if v is None or not 0 <= int(v) <= _MAX_CENTAVOS:
            raise ValueError("Costo unitario inválido.")
        return int(v)


def _items_sin_repetir(items: Optional[list[Any]]) -> Optional[list[Any]]:
    if items is None:
        return None
    if not items or len(items) > 200:
        raise ValueError("Se necesitan entre 1 y 200 productos.")
    ids = [i.producto_id for i in items]
    if len(set(ids)) != len(ids):
        raise ValueError("Hay productos repetidos: unificá las cantidades en una sola línea.")
    return items


def _fecha_opcional(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    v = v.strip()
    if v and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
        raise ValueError("Fecha inválida (AAAA-MM-DD).")
    return v or None


def _notas_opcional(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    v = v.strip()
    if len(v) > 2000:
        raise ValueError("Notas demasiado largas (máximo 2000 caracteres).")
    return v


class OrdenCompraCrear(BaseModel):
    proveedor_id: str
    items: list[ItemOrdenCompra]
    notas: str = ""
    fecha_esperada: Optional[str] = None

    @field_validator("proveedor_id")
    @classmethod
    def _proveedor(cls, v: str) -> str:
        v = (v or "").strip()
        if not _RE_UUID.match(v):
            raise ValueError("Proveedor inválido.")
        return v

    @field_validator("items")
    @classmethod
    def _items(cls, v: list[ItemOrdenCompra]) -> list[ItemOrdenCompra]:
        return _items_sin_repetir(v)

    @field_validator("notas")
    @classmethod
    def _notas(cls, v: str) -> str:
        return _notas_opcional(v or "")

    @field_validator("fecha_esperada")
    @classmethod
    def _fecha(cls, v: Optional[str]) -> Optional[str]:
        return _fecha_opcional(v)


class OrdenCompraEditar(BaseModel):
    items: Optional[list[ItemOrdenCompra]] = None
    notas: Optional[str] = None
    fecha_esperada: Optional[str] = None

    @field_validator("items")
    @classmethod
    def _items(cls, v: Optional[list[ItemOrdenCompra]]) -> Optional[list[ItemOrdenCompra]]:
        return _items_sin_repetir(v)

    @field_validator("notas")
    @classmethod
    def _notas(cls, v: Optional[str]) -> Optional[str]:
        return _notas_opcional(v)

    @field_validator("fecha_esperada")
    @classmethod
    def _fecha(cls, v: Optional[str]) -> Optional[str]:
        return _fecha_opcional(v)


class OrdenCompraEstado(BaseModel):
    a: str

    @field_validator("a")
    @classmethod
    def _estado(cls, v: str) -> str:
        if v not in ("enviada", "confirmada", "cancelada"):
            raise ValueError("Estado inválido (enviada | confirmada | cancelada).")
        return v


class ItemRecepcion(BaseModel):
    producto_id: str
    cantidad: int

    @field_validator("producto_id")
    @classmethod
    def _producto(cls, v: str) -> str:
        v = (v or "").strip()
        if not _RE_UUID.match(v):
            raise ValueError("Producto inválido.")
        return v

    @field_validator("cantidad")
    @classmethod
    def _cantidad(cls, v: int) -> int:
        if v is None or not 1 <= int(v) <= 1_000_000:
            raise ValueError("Cantidad inválida (1 a 1000000).")
        return int(v)


class RecepcionCrear(BaseModel):
    items: list[ItemRecepcion]
    nota: str = ""
    actualizar_costo: bool = True

    @field_validator("items")
    @classmethod
    def _items(cls, v: list[ItemRecepcion]) -> list[ItemRecepcion]:
        return _items_sin_repetir(v)

    @field_validator("nota")
    @classmethod
    def _nota(cls, v: str) -> str:
        return _notas_opcional(v or "")


def _proveedor_vivo(pid: str, select: str = "*") -> dict[str, Any]:
    filas = _sb_get("proveedores", {"select": select, "id": f"eq.{pid}", "deleted_at": "is.null", "limit": 1}) or []
    if not filas:
        raise HTTPException(status_code=404, detail="Proveedor inexistente o en papelera.")
    return filas[0]


def _sin_duplicados_proveedor(cambios: dict[str, Any], excluir_id: str = "") -> None:
    """Choques de unicidad con mensaje claro (si no, el 23505 de la base
    llega como error genérico)."""
    if cambios.get("nombre"):
        params: dict[str, Any] = {"select": "id,deleted_at", "nombre": f"eq.{cambios['nombre']}", "limit": 1}
        if excluir_id:
            params["id"] = f"neq.{excluir_id}"
        filas = _sb_get("proveedores", params) or []
        if filas:
            extra = " (está en la papelera)" if filas[0].get("deleted_at") else ""
            raise HTTPException(status_code=409, detail=f"Ya existe un proveedor con esa razón social{extra}.")
    if cambios.get("cuit"):
        params = {"select": "id", "cuit": f"eq.{cambios['cuit']}", "deleted_at": "is.null", "limit": 1}
        if excluir_id:
            params["id"] = f"neq.{excluir_id}"
        if _sb_get("proveedores", params):
            raise HTTPException(status_code=409, detail="Ya existe un proveedor con ese CUIT.")


def _orden_compra(oid: str, select: str = "*") -> dict[str, Any]:
    filas = _sb_get("ordenes_compra", {"select": select, "id": f"eq.{oid}", "limit": 1}) or []
    if not filas:
        raise HTTPException(status_code=404, detail="Orden de compra inexistente.")
    return filas[0]


def _productos_vivos(ids: list[str]) -> None:
    filas = _sb_get("productos", {
        "select": "id", "id": f"in.({','.join(ids)})", "deleted_at": "is.null",
    }) or []
    if len({str(f.get("id")) for f in filas}) != len(set(ids)):
        raise HTTPException(status_code=400, detail="Hay productos inexistentes o en papelera.")


@router.get("/api/admin/proveedores")
def listar_proveedores(q: str = "", estado: str = "", provincia: str = "", moneda: str = "",
                       papelera: bool = False,
                       pag: dict[str, int] = Depends(_pag),
                       admin: AdminActual = Depends(requiere("proveedores", "leer"))) -> dict[str, Any]:
    params: dict[str, Any] = {
        "select": "*", "order": "nombre.asc",
        "limit": pag["limit"], "offset": pag["offset"],
        "deleted_at": "not.is.null" if papelera else "is.null",
    }
    limpio = _filtro_texto(q)
    if limpio:
        filtros = [f"nombre.ilike.*{limpio}*", f"nombre_comercial.ilike.*{limpio}*"]
        digitos = _solo_digitos(limpio)
        if digitos:
            filtros.append(f"cuit.like.*{digitos}*")
        params["or"] = f"({','.join(filtros)})"
    if estado.strip():
        if estado not in ESTADOS_PROVEEDOR:
            raise HTTPException(status_code=400, detail="Estado inválido.")
        params["estado"] = f"eq.{estado}"
    if moneda.strip():
        if moneda not in MONEDAS:
            raise HTTPException(status_code=400, detail="Moneda inválida.")
        params["moneda"] = f"eq.{moneda}"
    if _filtro_texto(provincia):
        params["provincia"] = f"ilike.{_filtro_texto(provincia)}"
    filas = _sb_get("proveedores", params) or []
    return {"proveedores": [_proveedor_salida(p) for p in filas], "papelera": papelera}


@router.get("/api/admin/proveedores/{pid}")
def ficha_proveedor(pid: str,
                    admin: AdminActual = Depends(requiere("proveedores", "leer"))) -> dict[str, Any]:
    pid = _uuid(pid, "Proveedor")
    filas = _sb_get("proveedores", {"select": "*", "id": f"eq.{pid}", "limit": 1}) or []
    if not filas:
        raise HTTPException(status_code=404, detail="Proveedor inexistente.")
    productos = _sb_get("producto_proveedor", {
        "select": "*,productos(id,nombre,codigo,stock,stock_minimo)",
        "proveedor_id": f"eq.{pid}", "order": "updated_at.desc", "limit": 500,
    }) or []
    for r in productos:
        r.pop("costo", None)  # numeric heredado de 003: hacia el panel, solo centavos
    # Órdenes solo si el rol puede ver compras (la ficha es de proveedores).
    ordenes: Optional[list[dict[str, Any]]] = None
    if ("compras", "leer") in PERMISOS.get(admin.rol, set()):
        ordenes = [_resumen_oc(o) for o in (_sb_get("ordenes_compra", {
            "select": "id,numero,estado,moneda,fecha_esperada,created_at,"
                      "ordenes_compra_items(cantidad,cantidad_recibida,costo_unitario_centavos)",
            "proveedor_id": f"eq.{pid}", "order": "created_at.desc", "limit": 100,
        }) or [])]
        for o in ordenes:
            o.pop("ordenes_compra_items", None)
    return {"proveedor": _proveedor_salida(filas[0]), "productos": productos, "ordenes": ordenes}


@router.post("/api/admin/proveedores", status_code=201)
def crear_proveedor(d: ProveedorDatos, request: Request,
                    admin: AdminActual = Depends(requiere("proveedores", "crear"))) -> dict[str, Any]:
    _limitar(request.client.host if request.client else "?", "proveedor-crear", 30)
    fila = d.model_dump(exclude_none=True)
    if not fila.get("nombre"):
        raise HTTPException(status_code=400, detail="Razón social requerida.")
    _sin_duplicados_proveedor(fila)
    creadas = _sb_post("proveedores", fila) or []
    return {"proveedor": _proveedor_salida(creadas[0] if creadas else fila)}


@router.put("/api/admin/proveedores/{pid}")
def editar_proveedor(pid: str, d: ProveedorDatos, request: Request,
                     admin: AdminActual = Depends(requiere("proveedores", "editar"))) -> dict[str, Any]:
    _limitar(request.client.host if request.client else "?", "proveedor-editar", 30)
    pid = _uuid(pid, "Proveedor")
    # Solo lo enviado. Un null explícito se ignora (columnas NOT NULL), salvo
    # la calificación, que sí puede quedar vacía.
    cambios = {k: v for k, v in d.model_dump(exclude_unset=True).items()
               if v is not None or k == "calificacion"}
    if not cambios:
        raise HTTPException(status_code=400, detail="Sin cambios para aplicar.")
    _sin_duplicados_proveedor(cambios, excluir_id=pid)
    filas = _sb_patch("proveedores", {"id": f"eq.{pid}", "deleted_at": "is.null"}, cambios) or []
    if not filas:
        raise HTTPException(status_code=404, detail="Proveedor inexistente o en papelera.")
    return {"proveedor": _proveedor_salida(filas[0])}


@router.delete("/api/admin/proveedores/{pid}")
def borrar_proveedor(pid: str, request: Request,
                     admin: AdminActual = Depends(requiere("proveedores", "borrar"))) -> dict[str, Any]:
    """Borrado lógico. No procede con órdenes de compra abiertas."""
    _limitar(request.client.host if request.client else "?", "proveedor-borrar", 20)
    pid = _uuid(pid, "Proveedor")
    abiertas = _sb_get("ordenes_compra", {
        "select": "id", "proveedor_id": f"eq.{pid}",
        "estado": f"in.({','.join(sorted(OC_ABIERTAS))})", "limit": 1,
    }) or []
    if abiertas:
        raise HTTPException(status_code=409,
                            detail="Tiene órdenes de compra abiertas: recibilas o cancelalas antes de borrarlo.")
    ahora = datetime.now(timezone.utc).isoformat()
    filas = _sb_patch("proveedores", {"id": f"eq.{pid}", "deleted_at": "is.null"},
                      {"deleted_at": ahora, "deleted_by": admin.user_id}) or []
    if not filas:
        raise HTTPException(status_code=404, detail="Proveedor inexistente o ya en papelera.")
    return {"ok": True, "id": pid}


@router.post("/api/admin/proveedores/{pid}/restaurar")
def restaurar_proveedor(pid: str,
                        admin: AdminActual = Depends(requiere("proveedores", "editar"))) -> dict[str, Any]:
    pid = _uuid(pid, "Proveedor")
    filas = _sb_get("proveedores", {"select": "id,cuit", "id": f"eq.{pid}", "limit": 1}) or []
    if not filas:
        raise HTTPException(status_code=404, detail="Proveedor inexistente.")
    _sin_duplicados_proveedor({"cuit": filas[0].get("cuit") or ""}, excluir_id=pid)
    filas = _sb_patch("proveedores", {"id": f"eq.{pid}"}, {"deleted_at": None, "deleted_by": None}) or []
    return {"proveedor": _proveedor_salida(filas[0]) if filas else {"id": pid}}


@router.put("/api/admin/proveedores/{pid}/productos/{producto_id}")
def vincular_producto_proveedor(pid: str, producto_id: str, d: ProductoProveedorDatos, request: Request,
                                admin: AdminActual = Depends(requiere("proveedores", "editar"))) -> dict[str, Any]:
    """Alta o edición del vínculo (upsert por PK). Marcar principal desmarca
    al principal anterior de ese producto (índice único parcial en 014)."""
    _limitar(request.client.host if request.client else "?", "proveedor-producto", 60)
    pid = _uuid(pid, "Proveedor")
    producto_id = _uuid(producto_id, "Producto")
    _proveedor_vivo(pid, "id")
    _productos_vivos([producto_id])
    if d.es_principal:
        _sb_patch("producto_proveedor", {
            "producto_id": f"eq.{producto_id}", "proveedor_id": f"neq.{pid}", "es_principal": "eq.true",
        }, {"es_principal": False})
    fila = {"producto_id": producto_id, "proveedor_id": pid, **d.model_dump()}
    filas = _sb_post("producto_proveedor", fila,
                     prefer="resolution=merge-duplicates,return=representation") or []
    vinculo = filas[0] if filas else fila
    vinculo.pop("costo", None)
    return {"vinculo": vinculo}


@router.delete("/api/admin/proveedores/{pid}/productos/{producto_id}")
def desvincular_producto_proveedor(pid: str, producto_id: str,
                                   admin: AdminActual = Depends(requiere("proveedores", "editar"))) -> dict[str, Any]:
    pid = _uuid(pid, "Proveedor")
    producto_id = _uuid(producto_id, "Producto")
    filas = _sb_delete("producto_proveedor", {
        "proveedor_id": f"eq.{pid}", "producto_id": f"eq.{producto_id}",
    }) or []
    if not filas:
        raise HTTPException(status_code=404, detail="Ese producto no está vinculado al proveedor.")
    return {"ok": True}


@router.get("/api/admin/compras/sugerencias")
def sugerencias_reposicion(admin: AdminActual = Depends(requiere("compras", "leer"))) -> dict[str, Any]:
    productos = _sb_get("productos", {
        "select": "id,nombre,codigo,stock,stock_minimo",
        "deleted_at": "is.null", "activo": "eq.true", "order": "nombre.asc", "limit": 5000,
    }) or []
    # PostgREST no compara columnas entre sí: el filtro stock < mínimo va acá.
    bajo = [p for p in productos
            if int(p.get("stock") or 0) < int(p.get("stock_minimo") if p.get("stock_minimo") is not None else 5)]
    if not bajo:
        return {"grupos": []}
    ids = ",".join(str(p.get("id")) for p in bajo)
    relaciones = _sb_get("producto_proveedor", {
        "select": "producto_id,proveedor_id,costo_centavos,moneda,cantidad_minima,codigo_proveedor",
        "producto_id": f"in.({ids})", "es_principal": "eq.true",
    }) or []
    prov_ids = sorted({str(r.get("proveedor_id")) for r in relaciones})
    proveedores = (_sb_get("proveedores", {
        "select": "id,nombre,moneda,estado,pedido_minimo_centavos",
        "id": f"in.({','.join(prov_ids)})", "deleted_at": "is.null",
    }) or []) if prov_ids else []
    abiertas = _sb_get("ordenes_compra", {
        "select": "id", "estado": f"in.({','.join(sorted(OC_ABIERTAS))})", "limit": 5000,
    }) or []
    en_ordenes: dict[str, int] = defaultdict(int)
    if abiertas:
        items = _sb_get("ordenes_compra_items", {
            "select": "producto_id,cantidad,cantidad_recibida",
            "orden_id": f"in.({','.join(str(o.get('id')) for o in abiertas)})",
            "producto_id": f"in.({ids})", "limit": 5000,
        }) or []
        for it in items:
            en_ordenes[str(it.get("producto_id"))] += (int(it.get("cantidad") or 0)
                                                       - int(it.get("cantidad_recibida") or 0))
    return {"grupos": _sugerencias_reposicion(bajo, relaciones, proveedores, en_ordenes)}


@router.get("/api/admin/compras/ordenes")
def listar_ordenes_compra(estado: str = "", proveedor_id: str = "",
                          pag: dict[str, int] = Depends(_pag),
                          admin: AdminActual = Depends(requiere("compras", "leer"))) -> dict[str, Any]:
    params: dict[str, Any] = {
        "select": "*,proveedores(id,nombre),"
                  "ordenes_compra_items(cantidad,cantidad_recibida,costo_unitario_centavos)",
        "order": "created_at.desc", "limit": pag["limit"], "offset": pag["offset"],
    }
    if estado.strip():
        if estado not in ESTADOS_OC:
            raise HTTPException(status_code=400, detail="Estado inválido.")
        params["estado"] = f"eq.{estado}"
    if proveedor_id.strip():
        params["proveedor_id"] = f"eq.{_uuid(proveedor_id, 'Proveedor')}"
    ordenes = [_resumen_oc(o) for o in (_sb_get("ordenes_compra", params) or [])]
    for o in ordenes:
        o.pop("ordenes_compra_items", None)
    return {"ordenes": ordenes}


@router.get("/api/admin/compras/ordenes/{oid}")
def detalle_orden_compra(oid: str,
                         admin: AdminActual = Depends(requiere("compras", "leer"))) -> dict[str, Any]:
    oid = _uuid(oid, "Orden")
    oc = _resumen_oc(_orden_compra(oid, "*,proveedores(id,nombre,email,moneda,condicion_pago),"
                                        "ordenes_compra_items(*,productos(id,nombre,codigo,stock))"))
    recepciones = _sb_get("recepciones_compra", {
        "select": "*", "orden_id": f"eq.{oid}", "order": "created_at.desc", "limit": 100,
    }) or []
    return {"orden": oc, "recepciones": recepciones}


@router.post("/api/admin/compras/ordenes", status_code=201)
def crear_orden_compra(d: OrdenCompraCrear, request: Request,
                       admin: AdminActual = Depends(requiere("compras", "crear"))) -> dict[str, Any]:
    _limitar(request.client.host if request.client else "?", "oc-crear", 20)
    prov = _proveedor_vivo(d.proveedor_id, "id,estado,moneda")
    if prov.get("estado") == "inactivo":
        raise HTTPException(status_code=409, detail="El proveedor está inactivo.")
    _productos_vivos([i.producto_id for i in d.items])
    creadas = _sb_post("ordenes_compra", {
        "proveedor_id": d.proveedor_id, "moneda": prov.get("moneda") or "ARS",
        "notas": d.notas, "fecha_esperada": d.fecha_esperada, "creado_por": admin.user_id,
    }) or []
    if not creadas:
        raise HTTPException(status_code=502, detail="No se pudo crear la orden.")
    oc = creadas[0]
    try:
        _sb_post("ordenes_compra_items", [
            {"orden_id": oc["id"], **i.model_dump()} for i in d.items
        ], prefer="return=minimal")
    except HTTPException:
        # Sin transacción por REST: se deshace el borrador recién creado.
        _sb_delete("ordenes_compra", {"id": f"eq.{oc['id']}", "estado": "eq.borrador"})
        raise
    oc["codigo"] = _codigo_oc(oc.get("numero"))
    return {"orden": oc}


@router.put("/api/admin/compras/ordenes/{oid}")
def editar_orden_compra(oid: str, d: OrdenCompraEditar, request: Request,
                        admin: AdminActual = Depends(requiere("compras", "editar"))) -> dict[str, Any]:
    _limitar(request.client.host if request.client else "?", "oc-editar", 30)
    oid = _uuid(oid, "Orden")
    if _orden_compra(oid, "id,estado").get("estado") != "borrador":
        raise HTTPException(status_code=409, detail="Solo se edita una orden en borrador.")
    if d.items is not None:
        _productos_vivos([i.producto_id for i in d.items])
        _sb_delete("ordenes_compra_items", {"orden_id": f"eq.{oid}"})
        _sb_post("ordenes_compra_items", [
            {"orden_id": oid, **i.model_dump()} for i in d.items
        ], prefer="return=minimal")
    cambios = d.model_dump(exclude_unset=True, exclude={"items"})
    if cambios:
        _sb_patch("ordenes_compra", {"id": f"eq.{oid}", "estado": "eq.borrador"}, cambios)
    return detalle_orden_compra(oid, admin)


@router.post("/api/admin/compras/ordenes/{oid}/estado")
def estado_orden_compra(oid: str, d: OrdenCompraEstado, request: Request,
                        admin: AdminActual = Depends(requiere("compras", "cambiar_estado"))) -> dict[str, Any]:
    _limitar(request.client.host if request.client else "?", "oc-estado", 30)
    oid = _uuid(oid, "Orden")
    oc = _orden_compra(oid, "id,estado,ordenes_compra_items(id)")
    actual = str(oc.get("estado") or "")
    if d.a not in TRANSICIONES_OC.get(actual, set()):
        raise HTTPException(status_code=409, detail=f"Transición inválida: {actual} → {d.a}.")
    if d.a == "enviada" and not oc.get("ordenes_compra_items"):
        raise HTTPException(status_code=400, detail="La orden no tiene productos.")
    cambios: dict[str, Any] = {"estado": d.a}
    ahora = datetime.now(timezone.utc).isoformat()
    if d.a == "enviada":
        cambios["enviada_at"] = ahora
    elif d.a == "cancelada":
        cambios["cancelada_at"] = ahora
    # Control optimista: si otro la movió (o la recibió) entre medio, 409.
    filas = _sb_patch("ordenes_compra", {"id": f"eq.{oid}", "estado": f"eq.{actual}"}, cambios) or []
    if not filas:
        raise HTTPException(status_code=409, detail="La orden cambió mientras tanto: recargala.")
    return {"id": oid, "estado": d.a}


@router.post("/api/admin/compras/ordenes/{oid}/recepciones", status_code=201)
def recibir_orden_compra(oid: str, d: RecepcionCrear, request: Request,
                         admin: AdminActual = Depends(requiere("compras", "recibir"))) -> dict[str, Any]:
    """Recepción total o parcial: la RPC suma stock con adjust_stock (deja el
    movimiento de inventario), actualiza el costo del proveedor y fija el
    estado de la orden, todo en una transacción."""
    _limitar(request.client.host if request.client else "?", "oc-recibir", 30)
    oid = _uuid(oid, "Orden")
    oc = _orden_compra(oid, "id,estado,ordenes_compra_items(producto_id,cantidad,cantidad_recibida)")
    items = [i.model_dump() for i in d.items]
    error = _validar_recepcion(str(oc.get("estado") or ""), oc.get("ordenes_compra_items") or [], items)
    if error:
        raise HTTPException(status_code=error[0], detail=error[1])
    resultado = _rpc("recibir_orden_compra", {
        "p_orden": oid, "p_items": items, "p_nota": d.nota,
        "p_actor": admin.user_id, "p_actualizar_costo": d.actualizar_costo,
    }) or {}
    return {"id": oid, **resultado}
