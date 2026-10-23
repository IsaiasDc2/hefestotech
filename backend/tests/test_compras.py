"""Tests del módulo Proveedores y Compras (014). Sin red: todo se monkeypatchea.

Correr desde backend/:
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

PROV = "11111111-1111-1111-1111-111111111111"
OC = "22222222-2222-2222-2222-222222222222"
PA = "33333333-3333-3333-3333-333333333333"
PB = "44444444-4444-4444-4444-444444444444"


@pytest.fixture(autouse=True)
def _sin_rate_limit():
    admin_api._registro.clear()


def _como(monkeypatch, rol, tablas=None, posts=None, patches=None, rpcs=None):
    """Sesión con `rol` y una base falsa: `tablas` mapea tabla → filas (o
    función params → filas). Registra posts/patches/rpcs en las listas dadas."""
    tablas = tablas or {}
    monkeypatch.setattr(admin_api, "_validar_jwt", lambda bearer: "uid-1")

    def fake_get(tabla, params):
        if tabla == "perfiles":
            return [{"id": "uid-1", "rol": rol}]
        valor = tablas.get(tabla, [])
        return valor(params) if callable(valor) else valor

    def fake_post(tabla, fila, prefer="return=representation"):
        if posts is not None:
            posts.append((tabla, fila))
        if isinstance(fila, list):
            return []
        return [{"id": OC if tabla == "ordenes_compra" else PROV, "numero": 7, **fila}]

    def fake_patch(tabla, params, cambios):
        if patches is not None:
            patches.append((tabla, params, cambios))
        return [{"id": PROV, **cambios}]

    def fake_rpc(funcion, args):
        if rpcs is not None:
            rpcs.append((funcion, args))
        return {"estado": "recibida_parcial", "pendiente": 4, "items": []}

    def fake_get_total(tabla, params):
        filas = fake_get(tabla, params)
        return filas, len(filas)

    monkeypatch.setattr(admin_api, "_sb_get", fake_get)
    monkeypatch.setattr(admin_api, "_sb_get_total", fake_get_total)
    monkeypatch.setattr(admin_api, "_sb_post", fake_post)
    monkeypatch.setattr(admin_api, "_sb_patch", fake_patch)
    monkeypatch.setattr(admin_api, "_sb_delete", lambda tabla, params: [])
    monkeypatch.setattr(admin_api, "_rpc", fake_rpc)


# ------------------------------------------------------------------- CUIT ---


@pytest.mark.parametrize("cuit", ["20123456786", "30712345671", "27000000006"])
def test_cuit_valido(cuit):
    assert admin_api._cuit_valido(cuit)


@pytest.mark.parametrize("cuit", [
    "20123456780",   # dígito verificador incorrecto
    "30712345670",
    "99123456786",   # prefijo inexistente
    "2012345678",    # 10 dígitos
    "201234567861",  # 12 dígitos
    "20-12345678-6",  # sin normalizar (el modelo normaliza antes)
    "",
])
def test_cuit_invalido(cuit):
    assert not admin_api._cuit_valido(cuit)


def test_cuit_resto_10_nunca_es_valido():
    # Base cuya suma ponderada deja resto 1 → dígito 10: AFIP no emite ese
    # CUIT, ningún último dígito puede validarlo.
    pesos = (5, 4, 3, 2, 7, 6, 5, 4, 3, 2)
    base = next(f"20{n:08d}" for n in range(10**8)
                if sum(int(d) * p for d, p in zip(f"20{n:08d}", pesos)) % 11 == 1)
    assert not any(admin_api._cuit_valido(base + str(dv)) for dv in range(10))


def test_modelo_normaliza_cuit_con_guiones():
    d = admin_api.ProveedorDatos(nombre="X", cuit="30-71234567-1")
    assert d.cuit == "30712345671"


def test_cbu_valido_e_invalido():
    assert admin_api._cbu_valido("2850590940090418135201")
    assert not admin_api._cbu_valido("2850590940090418135202")
    assert not admin_api._cbu_valido("285059094009041813520")


# ------------------------------------------------------------ proveedores ---


def test_alta_rechaza_cuit_invalido(monkeypatch):
    posts = []
    _como(monkeypatch, "admin", posts=posts)
    r = cliente.post("/api/admin/proveedores", headers=AUTH,
                     json={"nombre": "Mayorista SA", "cuit": "30-71234567-0"})
    assert r.status_code == 422
    assert posts == []


def test_alta_guarda_cuit_normalizado_y_no_devuelve_cbu(monkeypatch):
    posts = []
    _como(monkeypatch, "operador", posts=posts)
    r = cliente.post("/api/admin/proveedores", headers=AUTH, json={
        "nombre": "Mayorista SA", "cuit": "30-71234567-1",
        "cbu": "2850590940090418135201", "condicion_pago": "30_dias",
        "contactos": [{"nombre": "Laura", "cargo": "Ventas", "email": "laura@mayorista.com.ar"}],
    })
    assert r.status_code == 201
    tabla, fila = posts[0]
    assert tabla == "proveedores" and fila["cuit"] == "30712345671"
    cuerpo = r.json()["proveedor"]
    assert "cbu" not in cuerpo
    assert cuerpo["cbu_mascara"].endswith("5201")


def test_alta_cuit_duplicado_es_409(monkeypatch):
    _como(monkeypatch, "admin", tablas={
        "proveedores": lambda p: [{"id": "otro"}] if "cuit" in p else [],
    })
    r = cliente.post("/api/admin/proveedores", headers=AUTH,
                     json={"nombre": "Nuevo", "cuit": "30712345671"})
    assert r.status_code == 409


def test_soporte_no_ve_proveedores(monkeypatch):
    _como(monkeypatch, "soporte")
    assert cliente.get("/api/admin/proveedores", headers=AUTH).status_code == 403


def test_operador_no_borra_proveedores(monkeypatch):
    _como(monkeypatch, "operador")
    assert cliente.delete(f"/api/admin/proveedores/{PROV}", headers=AUTH).status_code == 403


def test_no_se_borra_proveedor_con_ordenes_abiertas(monkeypatch):
    patches = []
    _como(monkeypatch, "admin", tablas={"ordenes_compra": [{"id": OC}]}, patches=patches)
    r = cliente.delete(f"/api/admin/proveedores/{PROV}", headers=AUTH)
    assert r.status_code == 409
    assert patches == []


def test_listado_enmascara_cbu(monkeypatch):
    _como(monkeypatch, "solo_lectura", tablas={
        "proveedores": [{"id": PROV, "nombre": "X", "cbu": "2850590940090418135201"}],
    })
    r = cliente.get("/api/admin/proveedores", headers=AUTH)
    assert r.status_code == 200
    fila = r.json()["proveedores"][0]
    assert "cbu" not in fila and fila["cbu_mascara"] == "•••• 5201"


# ------------------------------------------------------------ sugerencias ---


def test_sugerencias_agrupa_por_principal_y_descuenta_lo_pedido():
    productos = [
        {"id": PA, "nombre": "A", "stock": 2, "stock_minimo": 5},   # bajo
        {"id": PB, "nombre": "B", "stock": 0, "stock_minimo": 3},   # bajo, sin principal
        {"id": "c", "nombre": "C", "stock": 5, "stock_minimo": 5},  # en el mínimo: no
        {"id": "d", "nombre": "D", "stock": 1, "stock_minimo": 4},  # cubierto por OC
    ]
    relaciones = [
        {"producto_id": PA, "proveedor_id": PROV, "costo_centavos": 1000, "cantidad_minima": 12},
        {"producto_id": "d", "proveedor_id": PROV, "costo_centavos": 500, "cantidad_minima": 1},
    ]
    proveedores = [{"id": PROV, "nombre": "Mayorista", "moneda": "ARS"}]
    grupos = admin_api._sugerencias_reposicion(productos, relaciones, proveedores, {"d": 7})

    assert [g["proveedor"] and g["proveedor"]["id"] for g in grupos] == [PROV, None]
    item_a = grupos[0]["items"][0]
    # objetivo 10 − stock 2 = 8, llevado a la cantidad mínima del proveedor (12)
    assert item_a["producto_id"] == PA and item_a["sugerida"] == 12
    assert grupos[0]["total_centavos"] == 12 * 1000
    assert [i["producto_id"] for i in grupos[0]["items"]] == [PA]  # D ya pedido
    assert grupos[1]["items"][0]["sugerida"] == 6  # B: 2×3 − 0


def test_sugerencias_endpoint_sin_faltantes(monkeypatch):
    _como(monkeypatch, "operador", tablas={"productos": [{"id": PA, "stock": 9, "stock_minimo": 5}]})
    r = cliente.get("/api/admin/compras/sugerencias", headers=AUTH)
    assert r.status_code == 200 and r.json() == {"grupos": []}


# ------------------------------------------------------- órdenes de compra ---


def test_crear_orden_con_proveedor_inactivo_es_409(monkeypatch):
    _como(monkeypatch, "admin", tablas={"proveedores": [{"id": PROV, "estado": "inactivo"}]})
    r = cliente.post("/api/admin/compras/ordenes", headers=AUTH, json={
        "proveedor_id": PROV, "items": [{"producto_id": PA, "cantidad": 1}],
    })
    assert r.status_code == 409


def test_crear_orden_borrador(monkeypatch):
    posts = []
    _como(monkeypatch, "operador", posts=posts, tablas={
        "proveedores": [{"id": PROV, "estado": "activo", "moneda": "USD"}],
        "productos": [{"id": PA}, {"id": PB}],
    })
    r = cliente.post("/api/admin/compras/ordenes", headers=AUTH, json={
        "proveedor_id": PROV,
        "items": [{"producto_id": PA, "cantidad": 3, "costo_unitario_centavos": 1500},
                  {"producto_id": PB, "cantidad": 1}],
    })
    assert r.status_code == 201
    assert r.json()["orden"]["codigo"] == "OC-000007"
    assert posts[0][0] == "ordenes_compra" and posts[0][1]["moneda"] == "USD"
    assert posts[1][0] == "ordenes_compra_items" and len(posts[1][1]) == 2


def test_orden_con_producto_repetido_es_422(monkeypatch):
    _como(monkeypatch, "admin")
    r = cliente.post("/api/admin/compras/ordenes", headers=AUTH, json={
        "proveedor_id": PROV,
        "items": [{"producto_id": PA, "cantidad": 1}, {"producto_id": PA, "cantidad": 2}],
    })
    assert r.status_code == 422


def test_transicion_invalida_es_409(monkeypatch):
    _como(monkeypatch, "admin", tablas={"ordenes_compra": [{"id": OC, "estado": "borrador",
                                                            "ordenes_compra_items": [{"id": "i"}]}]})
    r = cliente.post(f"/api/admin/compras/ordenes/{OC}/estado", headers=AUTH, json={"a": "confirmada"})
    assert r.status_code == 409


def test_enviar_orden_vacia_es_400(monkeypatch):
    _como(monkeypatch, "admin", tablas={"ordenes_compra": [{"id": OC, "estado": "borrador",
                                                            "ordenes_compra_items": []}]})
    r = cliente.post(f"/api/admin/compras/ordenes/{OC}/estado", headers=AUTH, json={"a": "enviada"})
    assert r.status_code == 400


def test_enviar_orden_filtra_por_estado_actual(monkeypatch):
    patches = []
    _como(monkeypatch, "operador", patches=patches, tablas={
        "ordenes_compra": [{"id": OC, "estado": "borrador", "ordenes_compra_items": [{"id": "i"}]}],
    })
    r = cliente.post(f"/api/admin/compras/ordenes/{OC}/estado", headers=AUTH, json={"a": "enviada"})
    assert r.status_code == 200
    tabla, params, cambios = patches[0]
    assert params["estado"] == "eq.borrador"  # control optimista
    assert cambios["estado"] == "enviada" and "enviada_at" in cambios


# -------------------------------------------------------------- recepción ---

LINEAS = [
    {"producto_id": PA, "cantidad": 10, "cantidad_recibida": 6},
    {"producto_id": PB, "cantidad": 4, "cantidad_recibida": 0},
]


def test_validar_recepcion():
    assert admin_api._validar_recepcion("enviada", LINEAS, [{"producto_id": PA, "cantidad": 4}]) is None
    assert admin_api._validar_recepcion("recibida_parcial", LINEAS, [{"producto_id": PB, "cantidad": 1}]) is None
    assert admin_api._validar_recepcion("enviada", LINEAS, [{"producto_id": PA, "cantidad": 5}])[0] == 400
    assert admin_api._validar_recepcion("enviada", LINEAS, [{"producto_id": "otro", "cantidad": 1}])[0] == 400
    for estado in ("borrador", "recibida", "cancelada"):
        assert admin_api._validar_recepcion(estado, LINEAS, [{"producto_id": PA, "cantidad": 1}])[0] == 409


def _oc(estado):
    return {"ordenes_compra": [{"id": OC, "estado": estado, "ordenes_compra_items": LINEAS}]}


def test_recepcion_llama_a_la_rpc(monkeypatch):
    rpcs = []
    _como(monkeypatch, "operador", tablas=_oc("confirmada"), rpcs=rpcs)
    r = cliente.post(f"/api/admin/compras/ordenes/{OC}/recepciones", headers=AUTH, json={
        "items": [{"producto_id": PA, "cantidad": 4}], "nota": "Remito 0001-123",
        "actualizar_costo": False,
    })
    assert r.status_code == 201
    assert r.json()["estado"] == "recibida_parcial"
    funcion, args = rpcs[0]
    assert funcion == "recibir_orden_compra"
    assert args == {
        "p_orden": OC, "p_items": [{"producto_id": PA, "cantidad": 4}],
        "p_nota": "Remito 0001-123", "p_actor": "uid-1", "p_actualizar_costo": False,
    }


def test_recepcion_que_excede_no_toca_stock(monkeypatch):
    rpcs = []
    _como(monkeypatch, "admin", tablas=_oc("enviada"), rpcs=rpcs)
    r = cliente.post(f"/api/admin/compras/ordenes/{OC}/recepciones", headers=AUTH,
                     json={"items": [{"producto_id": PA, "cantidad": 5}]})
    assert r.status_code == 400
    assert "quedan 4" in r.json()["detail"]
    assert rpcs == []


def test_recepcion_de_orden_en_borrador_es_409(monkeypatch):
    rpcs = []
    _como(monkeypatch, "admin", tablas=_oc("borrador"), rpcs=rpcs)
    r = cliente.post(f"/api/admin/compras/ordenes/{OC}/recepciones", headers=AUTH,
                     json={"items": [{"producto_id": PA, "cantidad": 1}]})
    assert r.status_code == 409
    assert rpcs == []


def test_recepcion_exige_permiso_recibir(monkeypatch):
    _como(monkeypatch, "solo_lectura", tablas=_oc("enviada"))
    r = cliente.post(f"/api/admin/compras/ordenes/{OC}/recepciones", headers=AUTH,
                     json={"items": [{"producto_id": PA, "cantidad": 1}]})
    assert r.status_code == 403


def test_recepcion_con_cantidad_cero_es_422(monkeypatch):
    _como(monkeypatch, "admin", tablas=_oc("enviada"))
    r = cliente.post(f"/api/admin/compras/ordenes/{OC}/recepciones", headers=AUTH,
                     json={"items": [{"producto_id": PA, "cantidad": 0}]})
    assert r.status_code == 422


def test_id_de_orden_no_uuid_es_400(monkeypatch):
    _como(monkeypatch, "admin")
    r = cliente.post("/api/admin/compras/ordenes/x,or(1)/recepciones", headers=AUTH,
                     json={"items": [{"producto_id": PA, "cantidad": 1}]})
    assert r.status_code == 400
