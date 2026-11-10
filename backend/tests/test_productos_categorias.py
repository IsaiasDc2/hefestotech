"""Productos del panel agrupados por categoría (Memoria RAM, Procesador…).

El listado del admin se dibuja plegado: primero pide el conteo por categoría y
recién al abrir una pide sus productos. Sin red: todo monkeypatcheado.

Correr desde backend/:
    python -m pytest tests/test_productos_categorias.py -q
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

import admin_api  # noqa: E402
import main  # noqa: E402

cliente = TestClient(main.app)


def _como_owner(monkeypatch, filas_productos, capturado=None):
    monkeypatch.setattr(admin_api, "_validar_jwt", lambda bearer: "uid-owner")

    def fake_get(tabla, params):
        if tabla == "perfiles":
            return [{"id": "uid-owner", "rol": "owner"}]
        if tabla == "productos":
            if capturado is not None:
                capturado["params"] = params
            return filas_productos
        return []

    monkeypatch.setattr(admin_api, "_sb_get", fake_get)


AUTH = {"Authorization": "Bearer x"}


def test_conteo_por_categoria_agrupa_y_ordena(monkeypatch):
    _como_owner(monkeypatch, [
        {"categoria": "Memoria RAM", "stock": 10, "stock_minimo": 5},
        {"categoria": "Memoria RAM", "stock": 2, "stock_minimo": 5},
        {"categoria": "Procesador", "stock": 7, "stock_minimo": 5},
    ])
    r = cliente.get("/api/admin/productos/categorias", headers=AUTH)
    assert r.status_code == 200
    d = r.json()
    assert d["total"] == 3
    assert [c["categoria"] for c in d["categorias"]] == ["Memoria RAM", "Procesador"]
    assert d["categorias"][0]["total"] == 2
    # El que está en su mínimo o por debajo se cuenta como stock bajo.
    assert d["categorias"][0]["stock_bajo"] == 1
    assert d["categorias"][1]["stock_bajo"] == 0


def test_categoria_vacia_cae_en_general(monkeypatch):
    _como_owner(monkeypatch, [
        {"categoria": "", "stock": 1, "stock_minimo": 0},
        {"categoria": None, "stock": 1, "stock_minimo": 0},
    ])
    d = cliente.get("/api/admin/productos/categorias", headers=AUTH).json()
    assert d["categorias"] == [{"categoria": "General", "total": 2, "stock_bajo": 0}]


def test_conteo_filtra_por_busqueda_y_papelera(monkeypatch):
    capturado = {}
    _como_owner(monkeypatch, [], capturado)
    cliente.get("/api/admin/productos/categorias?q=rtx&papelera=true", headers=AUTH)
    assert capturado["params"]["nombre"] == "ilike.*rtx*"
    assert capturado["params"]["deleted_at"] == "not.is.null"


def test_conteo_exige_permiso(monkeypatch):
    monkeypatch.setattr(admin_api, "_validar_jwt", lambda bearer: "uid-1")
    monkeypatch.setattr(
        admin_api, "_sb_get",
        lambda tabla, params: [{"id": "uid-1", "rol": "cliente"}],
    )
    r = cliente.get("/api/admin/productos/categorias", headers=AUTH)
    assert r.status_code == 403


def test_listado_filtra_por_categoria(monkeypatch):
    capturado = {}
    monkeypatch.setattr(admin_api, "_validar_jwt", lambda bearer: "uid-owner")
    monkeypatch.setattr(
        admin_api, "_sb_get",
        lambda tabla, params: [{"id": "uid-owner", "rol": "owner"}] if tabla == "perfiles" else [],
    )

    def fake_total(tabla, params):
        capturado["params"] = params
        return ([], 0)

    monkeypatch.setattr(admin_api, "_sb_get_total", fake_total)
    r = cliente.get("/api/admin/productos?categoria=Memoria%20RAM", headers=AUTH)
    assert r.status_code == 200
    assert capturado["params"]["categoria"] == "eq.Memoria RAM"


def test_categoria_no_inyecta_filtros_postgrest(monkeypatch):
    """Una categoría con comas o paréntesis no debe poder alterar el filtro."""
    capturado = {}
    monkeypatch.setattr(admin_api, "_validar_jwt", lambda bearer: "uid-owner")
    monkeypatch.setattr(
        admin_api, "_sb_get",
        lambda tabla, params: [{"id": "uid-owner", "rol": "owner"}] if tabla == "perfiles" else [],
    )

    def fake_total(tabla, params):
        capturado["params"] = params
        return ([], 0)

    monkeypatch.setattr(admin_api, "_sb_get_total", fake_total)
    cliente.get("/api/admin/productos?categoria=RAM),stock.gt.0(", headers=AUTH)
    filtro = capturado["params"]["categoria"]
    assert "(" not in filtro and ")" not in filtro and "," not in filtro


def test_sin_categoria_no_agrega_filtro(monkeypatch):
    capturado = {}
    monkeypatch.setattr(admin_api, "_validar_jwt", lambda bearer: "uid-owner")
    monkeypatch.setattr(
        admin_api, "_sb_get",
        lambda tabla, params: [{"id": "uid-owner", "rol": "owner"}] if tabla == "perfiles" else [],
    )

    def fake_total(tabla, params):
        capturado["params"] = params
        return ([], 0)

    monkeypatch.setattr(admin_api, "_sb_get_total", fake_total)
    cliente.get("/api/admin/productos", headers=AUTH)
    assert "categoria" not in capturado["params"]


def test_general_incluye_productos_sin_categoria(monkeypatch):
    """El conteo mete las filas sin categoría en "General": al abrir ese grupo
    tienen que listarse también."""
    capturado = {}
    monkeypatch.setattr(admin_api, "_validar_jwt", lambda bearer: "uid-owner")
    monkeypatch.setattr(
        admin_api, "_sb_get",
        lambda tabla, params: [{"id": "uid-owner", "rol": "owner"}] if tabla == "perfiles" else [],
    )

    def fake_total(tabla, params):
        capturado["params"] = params
        return ([], 0)

    monkeypatch.setattr(admin_api, "_sb_get_total", fake_total)
    cliente.get("/api/admin/productos?categoria=General", headers=AUTH)
    assert "categoria" not in capturado["params"]
    assert capturado["params"]["or"] == "(categoria.eq.General,categoria.is.null,categoria.eq.)"
