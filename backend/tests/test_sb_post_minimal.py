"""`_sb_post` con Prefer: return=minimal.

Supabase contesta 201 SIN cuerpo; leer `.json()` ahí tiraba JSONDecodeError y
dejaba un 500: el checkout no podía guardar los ítems del pedido y el admin no
podía crear órdenes de compra (los datos igual quedaban escritos). Los tests
anteriores falseaban `_sb_post` entero, por eso no lo veían.

    python -m pytest tests -q
"""
import sys
from pathlib import Path

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import admin_api  # noqa: E402
import checkout_api  # noqa: E402


def _cliente(handler):
    return httpx.Client(base_url="http://supabase.test", transport=httpx.MockTransport(handler))


@pytest.mark.parametrize("modulo", [admin_api, checkout_api])
def test_return_minimal_sin_cuerpo_no_rompe(monkeypatch, modulo):
    pedidos = []

    def handler(request):
        pedidos.append(request)
        return httpx.Response(201)  # igual que Supabase: sin cuerpo

    monkeypatch.setattr(modulo, "_client", lambda: _cliente(handler))
    assert modulo._sb_post("tabla", [{"a": 1}], prefer="return=minimal") is None
    assert pedidos[0].headers["Prefer"] == "return=minimal"


@pytest.mark.parametrize("modulo", [admin_api, checkout_api])
def test_return_representation_sigue_devolviendo_filas(monkeypatch, modulo):
    def handler(request):
        return httpx.Response(201, json=[{"id": "x"}])

    monkeypatch.setattr(modulo, "_client", lambda: _cliente(handler))
    assert modulo._sb_post("tabla", {"a": 1}) == [{"id": "x"}]
