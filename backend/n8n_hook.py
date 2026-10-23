"""HefestoTech · backend/n8n_hook.py
Avisos salientes a n8n (WhatsApp al cliente, ofertas, alertas).

Opcional y a prueba de fallos, igual que `mailer.py`: sin `N8N_WEBHOOK_BASE_URL`
y `N8N_WEBHOOK_SECRET` no hace nada, el envío corre en un hilo aparte (no frena
la respuesta a Mercado Pago ni al panel) y cualquier error de red se traga: un
aviso caído nunca debe impedir cobrar, enviar o reembolsar un pedido.

Eventos (cada uno va a su propio webhook de n8n, ver `docs/N8N.md`):
- `pedido.estado` → `{base}/hefestotech-pedidos`
- `oferta.creada` → `{base}/hefestotech-ofertas`

Autenticación: encabezado `X-Hefesto-Secret` (credencial *Header Auth* del
nodo Webhook de n8n). Los secretos viven solo en el entorno.
"""
from __future__ import annotations

import os
import threading
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

RUTAS = {
    "pedido.estado": "hefestotech-pedidos",
    "oferta.creada": "hefestotech-ofertas",
}
TIMEOUT_SEG = 5.0


def _base() -> Optional[str]:
    base = os.getenv("N8N_WEBHOOK_BASE_URL", "").strip().rstrip("/")
    return base if base.startswith(("http://", "https://")) else None


def habilitado() -> bool:
    return bool(_base() and os.getenv("N8N_WEBHOOK_SECRET", "").strip())


def _pesos(centavos: Any) -> Optional[float]:
    try:
        return round(int(centavos) / 100, 2)
    except (TypeError, ValueError):
        return None


def payload_pedido(orden: dict[str, Any], estado: str, numero: str) -> dict[str, Any]:
    """Datos del pedido para n8n. Solo lo necesario para avisar al cliente."""
    front = os.getenv("FRONTEND_URL", "").rstrip("/")
    token = str(orden.get("acceso_token") or "")
    enlace = ""
    if front and orden.get("id"):
        enlace = f"{front}/pedido/{orden['id']}" + (f"?token={token}" if token else "")
    items = []
    for i in orden.get("orden_items") or []:
        prod = i.get("productos") or {}
        items.append({
            "nombre": str(prod.get("nombre") or "Producto")[:200],
            "cantidad": int(i.get("cantidad") or 1),
            "precio_unitario": float(i.get("precio") or 0),
        })
    return {
        "pedido_id": str(orden.get("id") or ""),
        "numero": numero,
        "estado": estado,
        "cliente": {
            "nombre": str(orden.get("nombre") or "").strip(),
            "email": str(orden.get("email") or "").strip(),
            "telefono": str(orden.get("telefono") or "").strip(),
        },
        "total": _pesos(orden.get("total_centavos")),
        "moneda": "ARS",
        "items": items,
        "envio": {
            "transportista": str(orden.get("transportista") or "").strip(),
            "codigo": str(orden.get("tracking_codigo") or "").strip(),
            "url": str(orden.get("tracking_url") or "").strip(),
        },
        "link_pedido": enlace,
    }


def payload_cupon(cupon: dict[str, Any]) -> dict[str, Any]:
    """Datos públicos de un cupón nuevo (nunca usos ni ids internos).

    `valor` es el porcentaje (1-100) si el tipo es `porcentaje` y pesos ARS si
    es `monto` (en la base los montos fijos están en centavos)."""
    tipo = str(cupon.get("tipo") or "")
    return {
        "codigo": str(cupon.get("codigo") or ""),
        "tipo": tipo,
        "valor": _pesos(cupon.get("valor")) if tipo == "monto" else cupon.get("valor"),
        "min_compra": _pesos(cupon.get("min_compra_centavos")) or 0,
        "usos_max": cupon.get("usos_max"),
        "vence_at": cupon.get("vence_at"),
        "tienda_url": os.getenv("FRONTEND_URL", "").rstrip("/"),
    }


def _enviar(evento: str, datos: dict[str, Any], evento_id: str) -> bool:
    base = _base()
    ruta = RUTAS.get(evento)
    if not (base and ruta and habilitado()):
        return False
    cuerpo = {
        "evento": evento,
        "evento_id": evento_id,
        "ocurrio_at": datetime.now(timezone.utc).isoformat(),
        "datos": datos,
    }
    try:
        r = httpx.post(
            f"{base}/{ruta}",
            headers={"X-Hefesto-Secret": os.getenv("N8N_WEBHOOK_SECRET", "").strip()},
            json=cuerpo,
            timeout=TIMEOUT_SEG,
        )
        if r.status_code >= 300:
            print(f"ERROR n8n_hook: n8n respondió {r.status_code} al evento {evento}.")
            return False
        return True
    except httpx.HTTPError:
        print(f"ERROR n8n_hook: fallo de red al evento {evento}.")
        return False


def emitir(evento: str, datos: dict[str, Any], evento_id: str,
           en_segundo_plano: bool = True) -> bool:
    """Avisa a n8n. Nunca lanza. En segundo plano devuelve True si se despachó."""
    try:
        if not habilitado() or evento not in RUTAS:
            return False
        if not en_segundo_plano:
            return _enviar(evento, datos, evento_id)
        threading.Thread(target=_enviar, args=(evento, datos, evento_id),
                         daemon=True).start()
        return True
    except Exception:
        print("ERROR n8n_hook: no se pudo emitir el evento.")
        return False


def emitir_pedido(orden: dict[str, Any], estado: str, numero: str) -> bool:
    try:
        if not habilitado():
            return False
        return emitir("pedido.estado", payload_pedido(orden, estado, numero),
                      f"{orden.get('id')}:{estado}")
    except Exception:
        print("ERROR n8n_hook: no se pudo armar el aviso del pedido.")
        return False


def emitir_cupon(cupon: dict[str, Any]) -> bool:
    try:
        if not habilitado():
            return False
        return emitir("oferta.creada", payload_cupon(cupon),
                      f"cupon:{cupon.get('codigo')}")
    except Exception:
        print("ERROR n8n_hook: no se pudo armar el aviso de la oferta.")
        return False
