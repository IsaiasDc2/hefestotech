"""HefestoTech · backend/mailer.py
Emails transaccionales al cliente (cambios de estado del pedido).

Opcional y a prueba de fallos: sin RESEND_API_KEY + MAIL_FROM no hace nada, y
cualquier error de red se traga (un email caído nunca debe impedir cobrar,
enviar o reembolsar un pedido). Proveedor: Resend (https://resend.com), por
REST, sin dependencias nuevas. Los secretos viven solo en el entorno.
"""
from __future__ import annotations

import html
import os
from typing import Any, Optional

import httpx

import n8n_hook


def numero_pedido(orden_id: Any) -> str:
    """Número legible del pedido: HT- + los primeros 8 caracteres del id."""
    return "HT-" + str(orden_id or "").replace("-", "")[:8].upper()


def habilitado() -> bool:
    return bool(os.getenv("RESEND_API_KEY") and os.getenv("MAIL_FROM"))


def enviar(para: str, asunto: str, cuerpo_html: str) -> bool:
    if not habilitado() or not para or "@" not in para:
        return False
    try:
        r = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {os.getenv('RESEND_API_KEY', '')}"},
            json={"from": os.getenv("MAIL_FROM", ""), "to": [para],
                  "subject": asunto, "html": cuerpo_html},
            timeout=10.0,
        )
        if r.status_code >= 300:
            print(f"ERROR mailer: el proveedor respondió {r.status_code}.")
            return False
        return True
    except httpx.HTTPError:
        print("ERROR mailer: fallo de red.")
        return False


def _marco(titulo: str, parrafos: list[str], enlace: Optional[tuple[str, str]] = None) -> str:
    cuerpo = "".join(f"<p style=\"margin:0 0 12px\">{p}</p>" for p in parrafos)
    boton = ""
    if enlace:
        boton = (f"<p style=\"margin:20px 0\"><a href=\"{html.escape(enlace[1], quote=True)}\" "
                 f"style=\"background:#0a7fb8;color:#fff;padding:10px 18px;border-radius:8px;"
                 f"text-decoration:none\">{html.escape(enlace[0])}</a></p>")
    return (f"<div style=\"font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1b1f24\">"
            f"<h2 style=\"margin:0 0 16px\">{html.escape(titulo)}</h2>{cuerpo}{boton}"
            f"<p style=\"color:#6b7280;font-size:12px;margin-top:24px\">HefestoTech</p></div>")


def armar_correo(orden: dict[str, Any], estado: str) -> Optional[tuple[str, str]]:
    """(asunto, html) para el estado, o None si ese estado no se avisa."""
    numero = numero_pedido(orden.get("id"))
    nombre = html.escape(str(orden.get("nombre") or "").strip() or "hola")
    saludo = f"Hola {nombre},"
    front = os.getenv("FRONTEND_URL", "").rstrip("/")
    token = str(orden.get("acceso_token") or "")
    enlace = None
    if front and orden.get("id"):
        url = f"{front}/pedido/{orden['id']}" + (f"?token={token}" if token else "")
        enlace = ("Ver mi pedido", url)

    if estado == "pagada":
        return (f"Recibimos tu pago · {numero}",
                _marco("Recibimos tu pago",
                       [saludo, f"Confirmamos el pago de tu pedido <strong>{numero}</strong>. "
                                "Lo estamos preparando."], enlace))
    if estado == "enviada":
        extra = []
        transportista = str(orden.get("transportista") or "").strip()
        codigo = str(orden.get("tracking_codigo") or "").strip()
        if transportista:
            extra.append(f"Transportista: <strong>{html.escape(transportista)}</strong>.")
        if codigo:
            extra.append(f"Código de seguimiento: <strong>{html.escape(codigo)}</strong>.")
        url_seguimiento = str(orden.get("tracking_url") or "").strip()
        if url_seguimiento.startswith(("http://", "https://")):
            enlace = ("Seguir mi envío", url_seguimiento)
        return (f"Tu pedido {numero} está en camino",
                _marco("Tu pedido está en camino",
                       [saludo, f"Despachamos tu pedido <strong>{numero}</strong>."] + extra, enlace))
    if estado == "entregada":
        return (f"Pedido entregado · {numero}",
                _marco("Pedido entregado",
                       [saludo, f"Tu pedido <strong>{numero}</strong> figura como entregado. "
                                "Si hay algún problema, respondé este correo o escribinos desde la tienda."],
                       enlace))
    if estado == "cancelada":
        return (f"Pedido cancelado · {numero}",
                _marco("Pedido cancelado",
                       [saludo, f"Tu pedido <strong>{numero}</strong> fue cancelado."], enlace))
    if estado == "reembolsada":
        return (f"Reembolso de tu pedido {numero}",
                _marco("Reembolso realizado",
                       [saludo, f"Reembolsamos tu pedido <strong>{numero}</strong> por Mercado Pago. "
                                "El tiempo en que se acredita depende de tu medio de pago."], enlace))
    return None


def notificar_estado(orden: dict[str, Any], estado: str) -> bool:
    """Avisa al cliente del nuevo estado. Nunca lanza."""
    # Aviso a n8n (WhatsApp, etc.): independiente del email y de qué estados se mailean.
    n8n_hook.emitir_pedido(orden, estado, numero_pedido(orden.get("id")))
    try:
        correo = armar_correo(orden, estado)
        if not correo:
            return False
        return enviar(str(orden.get("email") or "").strip(), correo[0], correo[1])
    except Exception:
        print("ERROR mailer: no se pudo armar el correo.")
        return False
