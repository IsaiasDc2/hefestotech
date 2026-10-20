"""`_es_url_mp`: valida que el link de pago sea de Mercado Pago.

Tenía `scheme == "https:"` (con dos puntos) y urlparse devuelve "https": la
función rechazaba SIEMPRE, y cada checkout terminaba en 502 ("No se pudo
generar el link de pago"). Los tests de checkout falseaban `_pref_mp` y no lo
veían.

    python -m pytest tests -q
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import checkout_api  # noqa: E402


@pytest.mark.parametrize("url", [
    "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=123-abc",
    "https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=123-abc",
    "https://www.mercadopago.com/checkout/v1/redirect?pref_id=1",
])
def test_acepta_los_links_de_mercado_pago(url):
    assert checkout_api._es_url_mp(url) is True


@pytest.mark.parametrize("url", [
    "http://www.mercadopago.com.ar/checkout",             # sin TLS
    "https://mercadopago.com.ar.evil.example/checkout",   # sufijo falso
    "https://evilmercadopago.com.ar/checkout",            # prefijo pegado
    "https://evil.example/?u=www.mercadopago.com.ar",     # el dominio solo en la query
    "javascript:alert(1)",
    "//www.mercadopago.com.ar/checkout",
    "",
])
def test_rechaza_lo_que_no_es_mercado_pago(url):
    assert checkout_api._es_url_mp(url) is False
