"""Cambio de estado de pedidos desde el admin.

El checkout descuenta el stock al crear el pedido; cancelar desde el panel lo
dejaba descontado para siempre. Sin red: todo se monkeypatchea.

    python -m pytest tests -q
"""
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

import admin_api  # noqa: E402
import main  # noqa: E402

cliente = TestClient(main.app)
AUTH = {"Authorization": "Bearer x"}
PEDIDO = "55555555-5555-5555-5555-555555555555"


@pytest.fixture(autouse=True)
def _sesion(monkeypatch):
    admin_api._registro.clear()
    monkeypatch.setattr(admin_api, "_validar_jwt", lambda bearer: "uid-1")


def _base(monkeypatch, rpcs, rechazar_estado=False):
    def fake_get(tabla, params):
        if tabla == "perfiles":
            return [{"id": "uid-1", "rol": "owner"}]
        if tabla == "orden_items":
            return [{"producto_id": "p1", "cantidad": 2}, {"producto_id": "p2", "cantidad": 1}]
        return []

    def fake_rpc(funcion, args):
        if funcion == "cambiar_estado_pedido" and rechazar_estado:
            raise HTTPException(status_code=502, detail="Transición de estado inválida.")
        rpcs.append((funcion, args))
        return 3

    monkeypatch.setattr(admin_api, "_sb_get", fake_get)
    monkeypatch.setattr(admin_api, "_rpc", fake_rpc)


def test_cancelar_devuelve_el_stock_de_cada_item(monkeypatch):
    rpcs = []
    _base(monkeypatch, rpcs)
    r = cliente.post(f"/api/admin/pedidos/{PEDIDO}/estado", headers=AUTH, json={"a": "cancelada"})
    assert r.status_code == 200
    ajustes = [a for f, a in rpcs if f == "adjust_stock"]
    assert [(a["p_producto"], a["p_delta"]) for a in ajustes] == [("p1", 2), ("p2", 1)]
    assert all(a["p_motivo"] == "cancelacion" and a["p_nota"] == PEDIDO and a["p_actor"] == "uid-1" for a in ajustes)
    # La transición se valida ANTES de tocar el stock.
    assert [f for f, _ in rpcs][0] == "cambiar_estado_pedido"


@pytest.mark.parametrize("estado", ["pagada", "preparacion", "enviada", "entregada", "reembolsada"])
def test_otros_estados_no_tocan_el_stock(monkeypatch, estado):
    rpcs = []
    _base(monkeypatch, rpcs)
    r = cliente.post(f"/api/admin/pedidos/{PEDIDO}/estado", headers=AUTH, json={"a": estado})
    assert r.status_code == 200
    assert not [1 for f, _ in rpcs if f == "adjust_stock"]


def test_transicion_invalida_no_devuelve_stock(monkeypatch):
    rpcs = []
    _base(monkeypatch, rpcs, rechazar_estado=True)
    r = cliente.post(f"/api/admin/pedidos/{PEDIDO}/estado", headers=AUTH, json={"a": "cancelada"})
    assert r.status_code == 502
    assert not [1 for f, _ in rpcs if f == "adjust_stock"]
