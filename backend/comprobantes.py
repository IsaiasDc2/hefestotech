"""Comprobante de compra: snapshot + PDF liviano (stdlib, sin Chromium)."""
from __future__ import annotations

import os
from datetime import datetime
from zoneinfo import ZoneInfo

import httpx

TZ = ZoneInfo("America/Argentina/Buenos_Aires")
LEYENDA = "Comprobante de compra – no válido como factura"


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default)


def _sb(tabla: str, query: str = "") -> list:
    url = _env("SUPABASE_URL").rstrip("/")
    key = _env("SUPABASE_SERVICE_ROLE_KEY")
    r = httpx.get(
        f"{url}/rest/v1/{tabla}{query}",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        timeout=20,
    )
    r.raise_for_status()
    return r.json()


def tienda() -> dict:
    return {
        "nombre": _env("TIENDA_NOMBRE", ""),
        "cuit": _env("TIENDA_CUIT", ""),
        "direccion": _env("TIENDA_DIRECCION", ""),
        "email": _env("TIENDA_EMAIL", ""),
        "telefono": _env("TIENDA_TELEFONO", ""),
    }


def obtener_comprobante(orden_id: str) -> dict | None:
    filas = _sb("comprobantes",
                query=f"?orden_id=eq.{orden_id}&select=*,ordenes(nombre,email,direccion,ciudad,codigo_postal,envio,subtotal,costo_envio,total,created_at,acceso_token,orden_items(cantidad,precio,productos(nombre)))")
    return filas[0] if filas else None


def _pdf_minimo(lineas: list[str]) -> bytes:
    """Genera un PDF 1.x valido con texto (Courier 10). Sin dependencias."""
    objs: list[bytes] = []
    contenido = "BT /F1 10 Tf 40 780 Td 13 TL " + "".join(
        f"({l.replace(chr(92), '/').replace('(', '[').replace(')', ']')}) Tj T* "
        for l in lineas) + "ET"
    objs.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objs.append(b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    objs.append(b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
                b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>")
    objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>")
    objs.append(b"<< /Length %d >>\nstream\n" % len(contenido.encode("latin-1", "replace"))
                + contenido.encode("latin-1", "replace") + b"\nendstream")
    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for i, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + o + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs)+1}\n0000000000 65535 f \n".encode()
    for off in offsets[1:]:
        out += f"{off:010d} 00000 n \n".encode()
    out += (f"trailer\n<< /Size {len(objs)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF").encode()
    return bytes(out)


def comprobante_pdf(c: dict) -> bytes:
    t = tienda()
    o = c.get("ordenes", {}) if isinstance(c.get("ordenes"), dict) else {}
    fecha = c.get("emitida_at") or c.get("emitido_en") or c.get("created_at") or ""
    try:
        fecha = datetime.fromisoformat(fecha).astimezone(TZ).strftime("%d/%m/%Y %H:%M")
    except Exception:
        pass
    numero = c.get("numero") or c.get("mp_payment_id") or str(c.get("id", ""))[:8]
    lineas = [
        f"{t['nombre'] or 'HefestoTech'}",
        f"CUIT: {t['cuit'] or '-'}  |  {t['direccion'] or ''}",
        f"{t['email'] or ''}  {t['telefono'] or ''}",
        "=" * 58,
        f"COMPROBANTE {numero}",
        f"Fecha (Bs.As.): {fecha}",
        f"Cliente: {o.get('nombre', '')}",
        f"{o.get('direccion', '')}, {o.get('ciudad', '')} CP {o.get('codigo_postal', '')}",
        "-" * 58,
    ]
    for it in (o.get("orden_items") or c.get("items_snapshot") or []):
        prod = it.get("productos") if isinstance(it.get("productos"), dict) else {}
        nombre = it.get("nombre") or prod.get("nombre") or ""
        precio = it.get("precio", it.get("precio_unitario", 0))
        lineas.append(f"{it.get('cantidad',1)}x {str(nombre)[:36]:36} ${int(precio or 0):>9,}".replace(",", "."))
    total = o.get("total") or int(c.get("total_centavos") or 0) / 100
    lineas += [
        "-" * 58,
        f"Subtotal: ${int(o.get('subtotal', 0)):>,}".replace(",", "."),
        f"Envio ({o.get('envio','')}): ${int(o.get('costo_envio', 0)):>,}".replace(",", "."),
        f"TOTAL: ${int(total):>,}".replace(",", "."),
        "=" * 58,
        LEYENDA,
        f"Verificacion: {_env('FRONTEND_URL', '')}/pedido/{c.get('orden_id','')}?token={o.get('acceso_token','')}",
    ]
    return _pdf_minimo(lineas)
