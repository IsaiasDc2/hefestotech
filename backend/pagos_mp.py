"""Checkout real HefestoTech: calculo en servidor, preferencia MP, webhook, PDF.

Sin dependencias nuevas: solo stdlib + mercadopago SDK.
Supabase se accede por REST con SERVICE_ROLE_KEY (nunca exponer al frontend).
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone

# ---- Config ----
UMBRAL_ENVIO_GRATIS = 150_000  # pesos enteros
COSTO_ENVIO_ESTANDAR = 5_000
COSTO_ENVIO_EXPRESS = 12_000
ORDEN_TTL_MIN = 60  # vencimiento de la reserva
TZ_AR = "America/Argentina/Buenos_Aires"


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default)


def _sb_headers() -> dict:
    return {
        "apikey": _env("SUPABASE_SERVICE_ROLE_KEY"),
        "Authorization": f"Bearer {_env('SUPABASE_SERVICE_ROLE_KEY')}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _sb(path: str, method: str = "GET", body: dict | list | None = None, query: str = ""):
    """Llamada REST a Supabase. Devuelve el JSON decodificado."""
    base = _env("SUPABASE_URL").rstrip("/")
    url = f"{base}/rest/v1/{path}{query}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=_sb_headers(), method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            raw = r.read().decode()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        detalle = e.read().decode()[:500]
        raise RuntimeError(f"Supabase {e.code}: {detalle}") from e


def _pesos_enteros(valor) -> int:
    """Normaliza a pesos enteros (sin centavos). Todo total se compara en enteros."""
    return int(round(float(valor)))


def _centavos(pesos: int) -> int:
    return pesos * 100


def obtener_productos(ids: list[str]) -> dict:
    filas = _sb("productos", query=f"?id=in.({','.join(ids)})&select=id,nombre,precio,precio_con_descuento,stock,activo")
    return {f["id"]: f for f in (filas or [])}


def calcular_totales(items: list[dict], envio: str) -> dict:
    """Recalcula todo en servidor. `items`: [{producto_id, cantidad}]."""
    if not items:
        raise ValueError("Carrito vacío.")
    ids = [i["producto_id"] for i in items]
    catalogo = obtener_productos(ids)
    lineas = []
    subtotal = 0
    for i in items:
        cant = int(i.get("cantidad", 1))
        if cant < 1 or cant > 10:
            raise ValueError(f"Cantidad inválida para {i['producto_id']}.")
        p = catalogo.get(i["producto_id"])
        if not p or not p.get("activo", True):
            raise ValueError("Producto no disponible.")
        if int(p.get("stock", 0)) < cant:
            raise ValueError(f"Sin stock suficiente: {p.get('nombre')}.")
        unit = _pesos_enteros(p.get("precio_con_descuento") or p.get("precio") or 0)
        subtotal += unit * cant
        lineas.append({
            "producto_id": i["producto_id"],
            "nombre": p.get("nombre", ""),
            "cantidad": cant,
            "precio_unitario": unit,  # pesos enteros
        })
    costo_envio = 0 if subtotal >= UMBRAL_ENVIO_GRATIS else (
        COSTO_ENVIO_EXPRESS if envio == "express" else COSTO_ENVIO_ESTANDAR)
    total = subtotal + costo_envio
    return {
        "lineas": lineas,
        "subtotal": subtotal,
        "costo_envio": costo_envio,
        "total": total,
        "subtotal_centavos": _centavos(subtotal),
        "total_centavos": _centavos(total),
    }


def crear_orden(comprador: dict, items: list[dict], envio: str) -> dict:
    """Crea orden pendiente + reserva de stock en transaccion RPC. Devuelve orden."""
    calc = calcular_totales(items, envio)
    token = secrets.token_urlsafe(24)
    expira = (datetime.now(timezone.utc) + timedelta(minutes=ORDEN_TTL_MIN)).isoformat()
    orden = {
        "nombre": comprador["nombre"][:120],
        "email": comprador["email"][:160],
        "telefono": comprador.get("telefono", "")[:40],
        "documento": comprador.get("documento", "")[:20],
        "direccion": comprador["direccion"][:200],
        "ciudad": comprador["ciudad"][:100],
        "provincia": comprador["provincia"][:60],
        "codigo_postal": comprador["codigo_postal"][:12],
        "envio": envio,
        "medio_pago": "mercadopago",
        "subtotal": calc["subtotal"],
        "costo_envio": calc["costo_envio"],
        "total": calc["total"],
        "estado": "pendiente_mp",
        "token_verificacion": token,
        "expira_en": expira,
    }
    creadas = _sb("ordenes", method="POST", body=orden)
    orden_id = creadas[0]["id"]
    _sb("orden_items", method="POST", body=[
        {"orden_id": orden_id, "producto_id": l["producto_id"],
         "cantidad": l["cantidad"], "precio": l["precio_unitario"]}
        for l in calc["lineas"]
    ])
    # Reserva de stock en transaccion (descuenta + registra movimiento).
    _sb_rpc("reservar_stock_tx", {"p_orden_id": orden_id})
    return {"id": orden_id, "token": token, **calc}


def _sb_rpc(funcion: str, params: dict):
    base = _env("SUPABASE_URL").rstrip("/")
    url = f"{base}/rest/v1/rpc/{funcion}"
    data = json.dumps(params).encode()
    req = urllib.request.Request(url, data=data, headers=_sb_headers(), method="POST")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            raw = r.read().decode()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"RPC {funcion} {e.code}: {e.read().decode()[:500]}") from e


def crear_preferencia_mp(orden_id: str, lineas: list[dict], costo_envio: int, comprador: dict) -> str:
    """Preferencia Checkout Pro real. external_reference = ID del pedido."""
    import mercadopago
    token = _env("MERCADOPAGO_ACCESS_TOKEN")
    if not token:
        raise RuntimeError("Falta MERCADOPAGO_ACCESS_TOKEN.")
    frontend = _env("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    sdk = mercadopago.SDK(token)
    items_mp = [{
        "title": l["nombre"][:100] or "Producto HefestoTech",
        "quantity": l["cantidad"],
        "unit_price": float(l["precio_unitario"]),
        "currency_id": "ARS",
    }]
    if costo_envio > 0:
        items_mp.append({"title": "Costo de envío", "quantity": 1,
                         "unit_price": float(costo_envio), "currency_id": "ARS"})
    pref = {
        "items": items_mp,
        "payer": {"name": comprador.get("nombre", "")[:60], "email": comprador.get("email", "")},
        "external_reference": orden_id,
        "back_urls": {
            "success": f"{frontend}/pago-exito",
            "failure": f"{frontend}/pago-fallido",
            "pending": f"{frontend}/pago-pendiente",
        },
        "auto_return": "approved",
        "notification_url": f"{_env('BACKEND_URL', '').rstrip('/')}/api/webhooks/mercadopago",
        "expires": True,
        "expiration_date_to": (datetime.now(timezone.utc) + timedelta(minutes=ORDEN_TTL_MIN)).strftime("%Y-%m-%dT%H:%M:%S.000-03:00"),
    }
    resp = sdk.preference().create(pref)
    data = resp.get("response", {})
    link = data.get("init_point")
    if not link:
        raise RuntimeError(f"MP no devolvió init_point: {json.dumps(data)[:300]}")
    _sb("ordenes", method="PATCH", query=f"?id=eq.{orden_id}",
        body={"mp_preference_id": data.get("id")})
    return link


def validar_firma_mp(x_signature: str, x_request_id: str, data_id: str) -> bool:
    """Valida firma HMAC del webhook MP (docs: x-signature = ts=...,v1=...)."""
    secreto = _env("MP_WEBHOOK_SECRET")
    if not secreto or not x_signature:
        return False
    try:
        partes = dict(p.split("=", 1) for p in x_signature.split(","))
        ts, v1 = partes.get("ts", ""), partes.get("v1", "")
        manifiesto = f"id:{data_id};request-id:{x_request_id};ts:{ts};"
        esperado = hmac.new(secreto.encode(), manifiesto.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(esperado, v1)
    except Exception:
        return False


def consultar_pago_mp(payment_id: str) -> dict:
    token = _env("MERCADOPAGO_ACCESS_TOKEN")
    req = urllib.request.Request(
        f"https://api.mercadopago.com/v1/payments/{payment_id}",
        headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode())


def estado_orden(orden_id: str) -> dict | None:
    filas = _sb("ordenes", query=f"?id=eq.{orden_id}&select=id,estado,total,mp_payment_id,expira_en,token_verificacion,comprobante_numero")
    return filas[0] if filas else None


def marcar_resultado_webhook(orden_id: str, payment_id: str, status: str, monto: float) -> str:
    """Idempotente: registra evento; si ya existe el payment_id, no repite."""
    existente = _sb("eventos_webhook", query=f"?mp_payment_id=eq.{payment_id}&select=id")
    if existente:
        return "duplicado"
    _sb("eventos_webhook", method="POST",
        body={"orden_id": orden_id, "mp_payment_id": payment_id, "status": status})
    orden = estado_orden(orden_id)
    if not orden or orden["estado"] == "pagado":
        return "sin-cambios"
    if status == "approved":
        if _pesos_enteros(monto) != _pesos_enteros(orden["total"]):
            _sb("ordenes", method="PATCH", query=f"?id=eq.{orden_id}",
                body={"estado": "revision", "mp_payment_id": payment_id})
            return "monto-discrepante"
        _sb_rpc("confirmar_pago_tx", {"p_orden_id": orden_id, "p_payment_id": payment_id})
        _emitir_comprobante(orden_id)
        return "pagado"
    if status in ("rejected", "cancelled"):
        _sb("ordenes", method="PATCH", query=f"?id=eq.{orden_id}",
            body={"estado": "rechazado", "mp_payment_id": payment_id})
        _sb_rpc("liberar_reserva_tx", {"p_orden_id": orden_id})
        return "rechazado"
    _sb("ordenes", method="PATCH", query=f"?id=eq.{orden_id}",
        body={"estado": "pendiente_mp", "mp_payment_id": payment_id})
    return "pendiente"


def _emitir_comprobante(orden_id: str) -> None:
    """Snapshot inmutable + numero correlativo CMP-AAAA-NNNNNN (secuencia por anio en DB)."""
    _sb_rpc("emitir_comprobante_tx", {"p_orden_id": orden_id})


def liberar_expiradas() -> int:
    filas = _sb("ordenes", query="?estado=eq.pendiente_mp&select=id,expira_en")
    ahora = datetime.now(timezone.utc)
    n = 0
    for o in (filas or []):
        try:
            exp = datetime.fromisoformat(o["expira_en"])
            if exp < ahora:
                _sb("ordenes", method="PATCH", query=f"?id=eq.{o['id']}", body={"estado": "expirado"})
                _sb_rpc("liberar_reserva_tx", {"p_orden_id": o["id"]})
                n += 1
        except Exception:
            continue
    return n
