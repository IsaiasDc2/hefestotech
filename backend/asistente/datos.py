"""HefestoTech · asistente · fuente de datos de la tienda.

Las herramientas del asistente leen SIEMPRE de acá, nunca del modelo:
- FuenteSupabase: catálogo, specs verificadas y pedidos reales (service_role,
  mismo patrón REST que checkout_api.py).
- FuenteDemo: el catálogo demo del front (ecomers/client/src/demo) y pedidos
  marcados como demo, para que la demo funcione sin internet.

Selección con ASISTENTE_DATOS=supabase|demo; por defecto Supabase si está
configurado, si no demo. Los pedidos demo solo existen en FuenteDemo.
"""

from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path
from typing import Any, Optional, Protocol

import httpx

from .compatibilidad import mapa_specs

RAIZ = Path(__file__).resolve().parents[2]
CATALOGO_DEMO = RAIZ / "ecomers" / "client" / "src" / "demo" / "catalogo.json"
PEDIDOS_DEMO = Path(__file__).with_name("pedidos_demo.json")

_TTL_SEG = 60


def _num(v: Any, defecto: float = 0) -> float:
    try:
        n = float(v)
    except (TypeError, ValueError):
        return defecto
    return n if n == n else defecto


def normalizar_producto(p: dict) -> dict:
    """Vista del producto que ven las herramientas (y las tarjetas del chat).
    El precio final respeta la oferta como adaptar.js#precioFinal."""
    lista = int(_num(p.get("precio")))
    oferta = p.get("precio_con_descuento")
    final = int(_num(oferta)) if oferta is not None else lista
    stock = int(_num(p.get("stock")))
    return {
        "id": str(p.get("id")),
        "codigo": p.get("codigo") or "",
        "nombre": p.get("nombre") or "",
        "marca": p.get("marca") or "",
        "categoria": p.get("categoria") or "",
        "descripcion": (p.get("descripcion") or "")[:400],
        "precio": final,
        "precio_lista": lista,
        "precio_a_confirmar": final <= 0,
        "stock": max(stock, 0),
        "envio_gratis": bool(p.get("envio_gratis")),
        "imagen": p.get("imagen") or "",
        "url": f"/producto/{p.get('id')}",
        "especificaciones": p.get("especificaciones") if isinstance(p.get("especificaciones"), dict) else {},
    }


class FuenteDatos(Protocol):
    nombre: str

    def productos(self) -> list[dict]: ...

    def specs(self) -> dict[str, dict]: ...

    def pedidos_por_email(self, email: str) -> list[dict]: ...


class FuenteDemo:
    nombre = "demo"

    def __init__(self, ruta_catalogo: Path = CATALOGO_DEMO, ruta_pedidos: Path = PEDIDOS_DEMO):
        crudo = json.loads(ruta_catalogo.read_text(encoding="utf-8"))
        self._productos = [
            normalizar_producto(p) for p in crudo.get("productos", [])
            if p.get("activo", True) and not p.get("deleted_at")
        ]
        self._specs = mapa_specs([s for s in crudo.get("product_specs", []) if s.get("verified")])
        self._pedidos = []
        if ruta_pedidos.exists():
            self._pedidos = json.loads(ruta_pedidos.read_text(encoding="utf-8")).get("pedidos", [])

    def productos(self) -> list[dict]:
        return self._productos

    def specs(self) -> dict[str, dict]:
        return self._specs

    def pedidos_por_email(self, email: str) -> list[dict]:
        return [p for p in self._pedidos if p.get("email", "").lower() == email.lower()]


class ErrorDatos(RuntimeError):
    """La base no respondió: la herramienta lo informa, nunca inventa."""


class FuenteSupabase:
    nombre = "supabase"

    def __init__(self, url: str, clave: str):
        self._http = httpx.Client(
            base_url=f"{url.rstrip('/')}/rest/v1",
            headers={"apikey": clave, "Authorization": f"Bearer {clave}"},
            timeout=10.0,
        )
        self._cache: dict[str, tuple[float, Any]] = {}

    def _get(self, tabla: str, params: dict[str, Any]) -> Any:
        try:
            r = self._http.get(f"/{tabla}", params=params)
            r.raise_for_status()
            return r.json()
        except httpx.HTTPError as e:
            print(f"ERROR asistente: supabase {tabla} no respondió ({type(e).__name__}).")
            raise ErrorDatos(tabla) from None

    def _cacheado(self, clave: str, cargar):
        ahora = time.monotonic()
        guardado = self._cache.get(clave)
        if guardado and ahora - guardado[0] < _TTL_SEG:
            return guardado[1]
        valor = cargar()
        self._cache[clave] = (ahora, valor)
        return valor

    def productos(self) -> list[dict]:
        return self._cacheado("productos", lambda: [
            normalizar_producto(p) for p in self._get("productos", {
                "select": "*", "activo": "eq.true", "deleted_at": "is.null",
            }) or []
        ])

    def specs(self) -> dict[str, dict]:
        def cargar():
            try:
                filas = self._get("product_specs", {
                    "select": "producto_id,clave,valor", "verified": "eq.true",
                })
            except ErrorDatos:
                # Sin specs el motor responde "unknown": nunca aprueba a ciegas.
                filas = []
            return mapa_specs(filas or [])
        return self._cacheado("specs", cargar)

    def pedidos_por_email(self, email: str) -> list[dict]:
        base = {
            "email": f"eq.{email.lower()}", "order": "created_at.desc", "limit": 50,
        }
        campos = "id,estado,created_at,total_centavos,envio,orden_items(cantidad,precio,producto_id)"
        try:
            return self._get("ordenes", {**base, "select": f"{campos},envios(operador,tracking,estado)"}) or []
        except ErrorDatos:
            # Migración 005 (envios) sin aplicar: se consulta sin seguimiento.
            return self._get("ordenes", {**base, "select": campos}) or []


_fuente: Optional[FuenteDatos] = None


def fuente() -> FuenteDatos:
    global _fuente
    if _fuente is None:
        modo = os.getenv("ASISTENTE_DATOS", "").strip().lower()
        url = os.getenv("SUPABASE_URL", "")
        clave = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        if modo != "demo" and url and clave:
            _fuente = FuenteSupabase(url, clave)
        else:
            _fuente = FuenteDemo()
    return _fuente


def usar_fuente(f: Optional[FuenteDatos]) -> None:
    """Para tests: fija (o resetea con None) la fuente de datos."""
    global _fuente
    _fuente = f


def numero_pedido(orden_id: str) -> str:
    """Número que ve el cliente: los primeros 8 caracteres del id (Mi cuenta,
    confirmación de pago) y HT-XXXXXXXX en el comprobante."""
    return re.sub(r"[^0-9a-f]", "", str(orden_id).lower())[:8]
