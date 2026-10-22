"""HefestoTech · asistente · moderación básica y protección de datos.

- Números de tarjeta (Luhn, 13 a 19 dígitos) y códigos de seguridad se
  reemplazan ANTES de que el mensaje llegue al modelo, al mock o a un log.
- Los logs del asistente nunca llevan el texto de la conversación: solo
  métricas (proveedor, herramientas, duración) y un hash corto de la sesión.
"""

from __future__ import annotations

import hashlib
import re

MARCA_TARJETA = "[dato de tarjeta eliminado]"

_SECUENCIA = re.compile(r"(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)")
_CVV = re.compile(r"\b(cvv|cvc|c[oó]digo de seguridad)\b\D{0,12}\d{3,4}\b", re.I)


def _luhn(digitos: str) -> bool:
    total = 0
    for i, c in enumerate(reversed(digitos)):
        n = int(c)
        if i % 2:
            n *= 2
            if n > 9:
                n -= 9
        total += n
    return total % 10 == 0


def limpiar_tarjetas(texto: str) -> tuple[str, bool]:
    hubo = False

    def reemplazo(m: re.Match) -> str:
        nonlocal hubo
        digitos = re.sub(r"\D", "", m.group(0))
        if 13 <= len(digitos) <= 19 and _luhn(digitos):
            hubo = True
            return MARCA_TARJETA
        return m.group(0)

    limpio = _SECUENCIA.sub(reemplazo, texto)
    if _CVV.search(limpio):
        hubo = True
        limpio = _CVV.sub(lambda m: f"{m.group(1)} {MARCA_TARJETA}", limpio)
    return limpio, hubo


def huella(valor: str) -> str:
    """Identificador corto y no reversible para correlacionar logs."""
    return hashlib.sha256(valor.encode("utf-8")).hexdigest()[:10] if valor else "-"
