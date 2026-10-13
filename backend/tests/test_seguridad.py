"""Regresion de seguridad: acceso de invitado a estado de checkout (H1) y
reintento de ordenes canceladas con re-reserva de stock (H2).

Los tests mockean la capa Supabase (_sb_get/_sb_patch/_rpc) y MercadoPago:
no se requieren credenciales ni red.
"""
import os
import sys
import uuid

os.environ.setdefault("SUPABASE_URL", "http://stub.local")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "stub-key")
os.environ.setdefault("MERCADOPAGO_ACCESS_TOKEN", "stub-mp")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient

import checkout_api
import main


ORDEN_ID = str(uuid.uuid4())
TOKEN = "token-invitado-abc"
PRODUCTO_ID = str(uuid.uuid4())


def _orden(**kw):
    base = {
        "id": ORDEN_ID, "user_id": None, "estado": "pendiente",
        "total_centavos": 5000_00, "acceso_token": TOKEN,
        "subtotal_centavos": 5000_00, "descuento_centavos": 0,
        "costo_envio_centavos": 0, "expira_at": None, "mp_payment_id": "",
        "created_at": "2026-01-01T00:00:00Z", "orden_items": [],
    }
    base.update(kw)
    return base


@pytest.fixture()
def client():
    return TestClient(main.app)


# ------------------------------------------------------------- H1 ----
def test_estado_invitado_con_token_devuelve_orden(client, monkeypatch):
    """Antes del fix el select no incluia acceso_token -> invitado siempre 403."""
    capturado = {}

    def fake_get(tabla, params=None):
        params = params or {}
        capturado["select"] = params.get("select", "")
        return [_orden()]

    monkeypatch.setattr(checkout_api, "_sb_get", fake_get)
    r = client.get(f"/api/checkout/estado/{ORDEN_ID}", params={"token": TOKEN})
    assert r.status_code == 200
    assert r.json()["estado"] == "pendiente"
    # El defecto H1: la columna acceso_token tiene que pedirse explicitamente.
    assert "acceso_token" in capturado["select"]


def test_estado_invitado_sin_token_403(client, monkeypatch):
    monkeypatch.setattr(checkout_api, "_sb_get", lambda t, p=None: [_orden()])
    r = client.get(f"/api/checkout/estado/{ORDEN_ID}")
    assert r.status_code == 403


def test_estado_invitado_token_incorrecto_403(client, monkeypatch):
    monkeypatch.setattr(checkout_api, "_sb_get", lambda t, p=None: [_orden()])
    r = client.get(f"/api/checkout/estado/{ORDEN_ID}",
                   params={"token": "otro-token"})
    assert r.status_code == 403


def test_estado_orden_ajena_sin_sesion_404(client, monkeypatch):
    """Orden con user_id: sin sesion valida no revela existencia."""
    monkeypatch.setattr(checkout_api, "_sb_get",
                        lambda t, p=None: [_orden(user_id="user-123")])
    r = client.get(f"/api/checkout/estado/{ORDEN_ID}",
                   params={"token": TOKEN})
    assert r.status_code == 404


# ------------------------------------------------------------- H2 ----
@pytest.fixture()
def mocks_mp(monkeypatch):
    class _Pref:
        def create(self, pref):
            return {"response": {
                "init_point": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=x",
                "id": "pref-1"}}

    class _SDK:
        def preference(self):
            return _Pref()

    import mercadopago
    monkeypatch.setattr(mercadopago, "SDK", lambda token: _SDK())


def test_reintento_cancelada_re_reserva_stock(client, monkeypatch, mocks_mp):
    """Orden cancelada: el reintento debe volver a reservar antes de cobrar."""
    llamados = {"reservar": 0}

    def fake_get(tabla, params=None):
        if tabla == "ordenes":
            return [_orden(estado="cancelada")]
        if tabla == "orden_items":
            return [{"producto_id": PRODUCTO_ID, "cantidad": 2}]
        if tabla == "productos":
            return [{"id": PRODUCTO_ID, "stock": 5, "activo": True,
                     "deleted_at": None}]
        return []

    def fake_reservar(orden_id, lineas, actor):
        llamados["reservar"] += 1

    monkeypatch.setattr(checkout_api, "_sb_get", fake_get)
    monkeypatch.setattr(checkout_api, "_reservar", fake_reservar)
    monkeypatch.setattr(checkout_api, "_sb_patch", lambda *a, **k: {})
    monkeypatch.setattr(checkout_api, "_uid_desde_bearer", lambda h: None)

    r = client.post(f"/api/checkout/{ORDEN_ID}/reintentar",
                    params={"token": TOKEN})
    assert r.status_code == 200
    assert llamados["reservar"] == 1


def test_reintento_cancelada_sin_stock_409(client, monkeypatch, mocks_mp):
    """Sin stock disponible, el reintento no crea preferencia de pago."""
    def fake_get(tabla, params=None):
        if tabla == "ordenes":
            return [_orden(estado="cancelada")]
        if tabla == "orden_items":
            return [{"producto_id": PRODUCTO_ID, "cantidad": 2}]
        if tabla == "productos":
            return [{"id": PRODUCTO_ID, "stock": 1, "activo": True,
                     "deleted_at": None}]
        return []

    monkeypatch.setattr(checkout_api, "_sb_get", fake_get)
    monkeypatch.setattr(checkout_api, "_reservar",
                        lambda *a: pytest.fail("no debe reservar sin stock"))
    monkeypatch.setattr(checkout_api, "_uid_desde_bearer", lambda h: None)

    r = client.post(f"/api/checkout/{ORDEN_ID}/reintentar",
                    params={"token": TOKEN})
    assert r.status_code == 409


def test_reintento_pendiente_no_re_reserva(client, monkeypatch, mocks_mp):
    """Orden pendiente mantiene su reserva: no se reserva dos veces."""
    monkeypatch.setattr(checkout_api, "_sb_get",
                        lambda t, p=None: [_orden(estado="pendiente")])
    monkeypatch.setattr(checkout_api, "_reservar",
                        lambda *a: pytest.fail("reserva duplicada"))
    monkeypatch.setattr(checkout_api, "_sb_patch", lambda *a, **k: {})

    r = client.post(f"/api/checkout/{ORDEN_ID}/reintentar",
                    params={"token": TOKEN})
    assert r.status_code == 200


def test_reintento_pagada_409(client, monkeypatch):
    monkeypatch.setattr(checkout_api, "_sb_get",
                        lambda t, p=None: [_orden(estado="pagada")])
    r = client.post(f"/api/checkout/{ORDEN_ID}/reintentar",
                    params={"token": TOKEN})
    assert r.status_code == 409


# -------------------------------------------- _es_url_mp (H10) ----
def test_es_url_mp_acepta_init_point_real():
    """Regresion: urlparse da scheme 'https' (sin ':'). Antes siempre False."""
    assert checkout_api._es_url_mp(
        "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=x")


def test_es_url_mp_rechaza_host_ajeno_y_http():
    assert not checkout_api._es_url_mp("http://www.mercadopago.com.ar/x")
    assert not checkout_api._es_url_mp("https://mercadopago.com.ar.evil.com/x")
    assert not checkout_api._es_url_mp("https://evil-mercadopago.com/x")
    assert not checkout_api._es_url_mp("javascript:alert(1)")
