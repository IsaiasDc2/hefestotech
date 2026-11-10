"""Ofertas, combos y PC armadas desde el panel (todo son filas de productos).

El precio que se cobra (`precio_con_descuento`) lo calcula siempre el
servidor, y los componentes de un combo se leen de la DB. Sin red.

Correr desde backend/:
    python -m pytest tests/test_productos_ofertas.py -q
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

import admin_api  # noqa: E402
import main  # noqa: E402

cliente = TestClient(main.app)
AUTH = {"Authorization": "Bearer x"}
CPU = "11111111-1111-1111-1111-111111111111"
GPU = "22222222-2222-2222-2222-222222222222"
PROD = "33333333-3333-3333-3333-333333333333"


def _como_owner(monkeypatch, productos=None, actual=None):
    """Owner con un catálogo falso; devuelve lo que se mandó a la DB."""
    enviado: dict = {}
    monkeypatch.setattr(admin_api, "_validar_jwt", lambda bearer: "uid-owner")
    monkeypatch.setattr(admin_api, "_limitar", lambda *a, **k: None)

    def fake_get(tabla, params):
        if tabla == "perfiles":
            return [{"id": "uid-owner", "rol": "owner"}]
        if tabla == "productos" and params.get("select", "").startswith("precio,"):
            return [actual] if actual else []
        if tabla == "productos" and "codigo" in params and params["codigo"].startswith("like"):
            return [{"codigo": "HT-0041"}]
        if tabla == "productos":
            return productos or []
        return []

    def fake_post(tabla, fila):
        enviado["post"] = fila
        return [fila]

    def fake_patch(tabla, filtro, cambios):
        enviado["patch"] = cambios
        return [{"id": PROD, **cambios}]

    monkeypatch.setattr(admin_api, "_sb_get", fake_get)
    monkeypatch.setattr(admin_api, "_sb_post", fake_post)
    monkeypatch.setattr(admin_api, "_sb_patch", fake_patch)
    return enviado


def test_oferta_nueva_calcula_el_precio_que_se_cobra(monkeypatch):
    enviado = _como_owner(monkeypatch)
    r = cliente.post("/api/admin/productos", headers=AUTH, json={
        "nombre": "Teclado RGB", "precio": 100000, "descuento_porcentaje": 15,
        "categoria": "Periferico", "destacado": True,
    })
    assert r.status_code == 201
    assert enviado["post"]["precio_con_descuento"] == 85000
    assert enviado["post"]["destacado"] is True


def test_sin_descuento_no_hay_precio_de_oferta(monkeypatch):
    enviado = _como_owner(monkeypatch)
    cliente.post("/api/admin/productos", headers=AUTH, json={"nombre": "Mouse", "precio": 5000})
    assert enviado["post"]["precio_con_descuento"] is None


def test_descuento_fuera_de_rango_se_rechaza(monkeypatch):
    _como_owner(monkeypatch)
    r = cliente.post("/api/admin/productos", headers=AUTH, json={
        "nombre": "X", "precio": 100, "descuento_porcentaje": 95,
    })
    assert r.status_code == 422


def test_editar_precio_recalcula_la_oferta_vigente(monkeypatch):
    enviado = _como_owner(monkeypatch, actual={
        "precio": 1000, "descuento_porcentaje": 10, "especificaciones": {},
    })
    r = cliente.put(f"/api/admin/productos/{PROD}", headers=AUTH, json={"precio": 2000})
    assert r.status_code == 200
    assert enviado["patch"]["precio_con_descuento"] == 1800


def test_quitar_la_oferta_vuelve_al_precio_de_lista(monkeypatch):
    enviado = _como_owner(monkeypatch, actual={
        "precio": 1000, "descuento_porcentaje": 10, "especificaciones": {},
    })
    cliente.put(f"/api/admin/productos/{PROD}", headers=AUTH, json={"descuento_porcentaje": 0})
    assert enviado["patch"]["precio_con_descuento"] is None


def test_combo_guarda_componentes_con_nombre_de_la_db(monkeypatch):
    enviado = _como_owner(monkeypatch, productos=[
        {"id": CPU, "nombre": "Ryzen 5 7600", "codigo": "HT-0001", "deleted_at": None},
        {"id": GPU, "nombre": "RTX 4060", "codigo": "HT-0002", "deleted_at": None},
    ])
    r = cliente.post("/api/admin/productos", headers=AUTH, json={
        "nombre": "Combo gamer", "precio": 900000, "categoria": "Combo",
        "componentes": [{"id": CPU, "cantidad": 1}, {"id": GPU, "cantidad": 1}],
        "especificaciones": {"Uso": "Gaming 1080p", "incluye": "trucho"},
    })
    assert r.status_code == 201
    specs = enviado["post"]["especificaciones"]
    assert specs["Uso"] == "Gaming 1080p"
    assert [c["nombre"] for c in specs["incluye"]] == ["Ryzen 5 7600", "RTX 4060"]


def test_combo_con_componente_inexistente_falla(monkeypatch):
    _como_owner(monkeypatch, productos=[])
    r = cliente.post("/api/admin/productos", headers=AUTH, json={
        "nombre": "Combo", "precio": 1, "componentes": [{"id": CPU}],
    })
    assert r.status_code == 400


def test_editar_ficha_conserva_los_componentes(monkeypatch):
    incluye = [{"id": CPU, "nombre": "Ryzen 5 7600", "codigo": "", "cantidad": 1}]
    enviado = _como_owner(monkeypatch, actual={
        "precio": 1000, "descuento_porcentaje": 0,
        "especificaciones": {"Procesador": "viejo", "incluye": incluye},
    })
    cliente.put(f"/api/admin/productos/{PROD}", headers=AUTH,
                json={"especificaciones": {"Procesador": "Ryzen 7"}})
    assert enviado["patch"]["especificaciones"] == {"Procesador": "Ryzen 7", "incluye": incluye}
