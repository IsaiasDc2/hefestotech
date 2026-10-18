"""HefestoTech · asistente · políticas de la tienda (get_store_policies).

Cada punto declara de dónde sale, para que el modelo sepa qué puede afirmar:
- "checkout": regla que el servidor aplica al cobrar (checkout_api.py). Firme.
- "ley": norma vigente en Argentina. Firme.
- "sitio": funcionalidad que existe en la tienda (por ejemplo /reclamo). Firme.
- "publicado": texto visible en el sitio, sin regla en el servidor que lo
  respalde. Se puede citar como "figura en el sitio", nunca prometer; el
  dueño debe confirmarlo (ver AUDITORIA.md, sección Asistente).
- "nota": indicación para el asistente cuando no hay dato publicado.

Los montos de envío se leen de checkout_api para que el asistente no pueda
desfasarse de lo que efectivamente se cobra.
"""

from __future__ import annotations

from checkout_api import (
    ENVIO_ESTANDAR_CENT,
    ENVIO_EXPRESS_CENT,
    EXPIRA_MINUTOS,
    UMBRAL_ENVIO_GRATIS_CENT,
)


def pesos(centavos: int) -> str:
    return "$" + f"{centavos // 100:,}".replace(",", ".")


def _p(texto: str, fuente: str) -> dict:
    return {"texto": texto, "fuente": fuente}


def politicas() -> dict[str, dict]:
    return {
        "envios": {
            "titulo": "Envíos",
            "puntos": [
                _p(f"Envío gratis cuando el subtotal llega a {pesos(UMBRAL_ENVIO_GRATIS_CENT)}.", "checkout"),
                _p(f"Debajo de ese monto: envío estándar {pesos(ENVIO_ESTANDAR_CENT)} o express "
                   f"{pesos(ENVIO_EXPRESS_CENT)}, tarifa única para todo el país.", "checkout"),
                _p("El costo final del envío se confirma en el checkout antes de pagar.", "checkout"),
                _p("Envíos a todo el país.", "publicado"),
                _p("Retiro gratis en la tienda de Salta (se coordina con la tienda; no es una opción del checkout).",
                   "publicado"),
                _p("No hay un plazo de entrega confirmado: no prometer fechas; para un plazo concreto, derivar.",
                   "nota"),
            ],
        },
        "pagos": {
            "titulo": "Pagos y cuotas",
            "puntos": [
                _p("El pago online se hace con Mercado Pago (Checkout Pro): la tienda nunca ve ni guarda datos de tarjeta.",
                   "checkout"),
                _p("Los precios publicados son finales, con impuestos incluidos.", "checkout"),
                _p(f"Al iniciar el pago, el stock queda reservado {EXPIRA_MINUTOS} minutos.", "checkout"),
                _p("Las cuotas que se muestran son informativas; las finales las confirma Mercado Pago según la tarjeta y el banco.",
                   "checkout"),
                _p("6 cuotas sin interés con todas las tarjetas.", "publicado"),
                _p("10% off por transferencia (el checkout online no ofrece transferencia: se coordina con la tienda).",
                   "publicado"),
            ],
        },
        "garantia": {
            "titulo": "Garantía",
            "puntos": [
                _p("Garantía oficial, 12 meses en todos los productos.", "publicado"),
                _p("Para iniciar una garantía o un reclamo está el formulario de /reclamo.", "sitio"),
                _p("Rige además la garantía legal mínima de la Ley 24.240 de Defensa del Consumidor (art. 11).", "ley"),
            ],
        },
        "cambios": {
            "titulo": "Cambios y devoluciones",
            "puntos": [
                _p("Compras online: derecho de arrepentimiento de 10 días corridos desde la entrega o la compra, "
                   "lo último que ocurra (Ley 24.240, art. 34).", "ley"),
                _p("Las condiciones de cambio por otro producto no están publicadas: derivar a una persona.", "nota"),
                _p("Reclamos: formulario en /reclamo.", "sitio"),
            ],
        },
        "contacto": {
            "titulo": "Contacto",
            "puntos": [
                _p("WhatsApp de la tienda (el chat muestra el botón) y email contacto@hefestotech.com.", "publicado"),
                _p("Horario de atención: lunes a viernes de 9 a 18 hs.", "publicado"),
            ],
        },
        "privacidad": {
            "titulo": "Datos personales",
            "puntos": [
                _p("Nunca se piden por chat datos de tarjeta, contraseñas ni claves.", "checkout"),
                _p("Para consultar un pedido alcanza con el número de pedido y el email de la compra.", "checkout"),
            ],
        },
    }


TEMAS = tuple(politicas().keys())

_SINONIMOS = {
    "envio": "envios", "envíos": "envios", "envío": "envios", "shipping": "envios", "retiro": "envios",
    "pago": "pagos", "cuotas": "pagos", "medios de pago": "pagos", "tarjeta": "pagos", "transferencia": "pagos",
    "garantía": "garantia", "warranty": "garantia",
    "cambio": "cambios", "devolucion": "cambios", "devolución": "cambios", "devoluciones": "cambios",
    "arrepentimiento": "cambios", "returns": "cambios",
    "horario": "contacto", "whatsapp": "contacto", "email": "contacto",
    "datos": "privacidad",
}


def buscar_politica(tema: str) -> dict:
    clave = (tema or "").strip().lower()
    clave = _SINONIMOS.get(clave, clave)
    todas = politicas()
    if clave in todas:
        return {"tema": clave, **todas[clave]}
    return {"tema": None, "temas_disponibles": list(TEMAS),
            "error": "No hay una política publicada sobre ese tema."}
