"""Sesión del panel: roles, permisos efectivos y fallback de la matriz.

Sin red: `_validar_jwt` y `_sb_get` se reemplazan por fakes.

    python -m pytest tests -q
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

import admin_api  # noqa: E402
import main  # noqa: E402

cliente = TestClient(main.app)
AUTH = {"Authorization": "Bearer x"}
# Referencia previa al fixture que lo reemplaza (conftest).
_matriz_real = admin_api._matriz_desde_db


def _como(monkeypatch, rol, *, nombre="Ana", permisos=None, caida=False):
    monkeypatch.setattr(admin_api, "_validar_jwt", lambda bearer: "uid-1")

    matriz = {
        r: {(m, a) for rr, m, a in (permisos or []) if rr == r}
        for r in {r for r, _, _ in (permisos or [])}
    }

    def fake_matriz():
        if caida:
            raise admin_api.HTTPException(status_code=502, detail="caída simulada")
        return matriz

    monkeypatch.setattr(admin_api, "_matriz_desde_db", fake_matriz)

    def fake_get(tabla, params):
        if tabla == "perfiles":
            return [{"id": "uid-1", "rol": rol, "nombre": nombre}]
        return []

    monkeypatch.setattr(admin_api, "_sb_get", fake_get)


def test_sin_token_es_401():
    r = cliente.get("/api/admin/sesion")
    assert r.status_code == 401


def test_matriz_desde_db_parsea_y_descarta_filas_invalidas(monkeypatch):
    monkeypatch.setattr(
        admin_api,
        "_sb_get",
        lambda tabla, params: [
            {"rol": "vendedor", "modulo": "pedidos", "accion": "leer"},
            {"rol": "vendedor", "modulo": "", "accion": "leer"},
            {"rol": "vendedor", "modulo": "stock", "accion": None},
            "fila rota",
        ],
    )
    assert _matriz_real() == {"vendedor": {("pedidos", "leer")}}


def test_cliente_no_entra_al_panel(monkeypatch):
    _como(monkeypatch, "cliente", permisos=[("cliente", "reclamos", "crear")])
    r = cliente.get("/api/admin/sesion", headers=AUTH)
    assert r.status_code == 403


def test_operador_recibe_rol_nombre_y_permisos(monkeypatch):
    _como(
        monkeypatch,
        "operador",
        nombre="Mica",
        permisos=[
            ("operador", "productos", "leer"),
            ("operador", "stock", "ajustar"),
        ],
    )
    r = cliente.get("/api/admin/sesion", headers=AUTH)
    assert r.status_code == 200
    datos = r.json()
    assert datos["usuario"] == {"id": "uid-1", "rol": "operador", "nombre": "Mica"}
    assert datos["permisos"] == ["productos.leer", "stock.ajustar"]


def test_owner_sigue_entrando_si_la_tabla_esta_vacia(monkeypatch):
    """Sin filas (fake viejo o migración pendiente) manda el espejo Python."""
    _como(monkeypatch, "owner", permisos=None)
    r = cliente.get("/api/admin/sesion", headers=AUTH)
    assert r.status_code == 200
    permisos = r.json()["permisos"]
    assert "productos.leer" in permisos
    assert "categorias.borrar" in permisos


def test_owner_sigue_entrando_si_supabase_falla(monkeypatch):
    _como(monkeypatch, "owner", caida=True)
    r = cliente.get("/api/admin/sesion", headers=AUTH)
    assert r.status_code == 200
    assert "reportes.leer" in r.json()["permisos"]


def test_rol_nuevo_con_permiso_en_la_tabla_entra(monkeypatch):
    _como(monkeypatch, "vendedor", nombre="Vera", permisos=[("vendedor", "pedidos", "leer")])
    r = cliente.get("/api/admin/sesion", headers=AUTH)
    assert r.status_code == 200
    assert r.json()["usuario"]["rol"] == "vendedor"
    assert r.json()["permisos"] == ["pedidos.leer"]


def test_la_tabla_manda_sobre_el_espejo(monkeypatch):
    """Si la matriz de la DB revoca un permiso, el backend no lo inventa."""
    _como(monkeypatch, "owner", permisos=[("owner", "productos", "leer")])
    r = cliente.get("/api/admin/sesion", headers=AUTH)
    assert r.status_code == 200
    assert r.json()["permisos"] == ["productos.leer"]
    # Resumen exige reportes.leer: la misma matriz debe negarlo.
    assert cliente.get("/api/admin/resumen", headers=AUTH).status_code == 403


def test_permiso_de_la_tabla_habilita_endpoint(monkeypatch):
    _como(monkeypatch, "vendedor", permisos=[("vendedor", "pedidos", "leer")])
    monkeypatch.setattr(admin_api, "_sb_get_total", lambda tabla, params: ([], 0))
    assert cliente.get("/api/admin/productos", headers=AUTH).status_code == 403
    assert cliente.get("/api/admin/pedidos", headers=AUTH).status_code == 200
