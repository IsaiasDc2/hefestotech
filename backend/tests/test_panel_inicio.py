"""Tests del tablero de Inicio y del historial de proveedores.

Sin red: `_sb_get` se reemplaza por una base falsa. Correr desde backend/:

    python -m pytest tests -q
"""
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

import admin_api  # noqa: E402
import main  # noqa: E402

cliente = TestClient(main.app)
AUTH = {"Authorization": "Bearer x"}

PA = "33333333-3333-3333-3333-333333333333"
PB = "44444444-4444-4444-4444-444444444444"
OC = "22222222-2222-2222-2222-222222222222"
PROV = "11111111-1111-1111-1111-111111111111"
ORDEN = "55555555-5555-5555-5555-555555555555"


@pytest.fixture(autouse=True)
def _sin_rate_limit():
    admin_api._registro.clear()


def _como(monkeypatch, rol, tablas):
    monkeypatch.setattr(admin_api, "_validar_jwt", lambda bearer: "uid-1")

    def fake_get(tabla, params):
        if tabla == "perfiles":
            return [{"id": "uid-1", "rol": rol}]
        valor = tablas.get(tabla, [])
        valor = valor(params) if callable(valor) else valor
        # Los filtros de igualdad simples se respetan (p. ej. estado=eq.pendiente).
        estado = str(params.get("estado") or "")
        if estado.startswith("eq.") and isinstance(valor, list):
            valor = [f for f in valor if str(f.get("estado")) == estado[3:]]
        return valor

    monkeypatch.setattr(admin_api, "_sb_get", fake_get)


def test_resumen_series_totales_y_top_productos(monkeypatch):
    hoy = datetime.now(timezone.utc).date()
    ayer = (hoy - timedelta(days=1)).isoformat()
    ahora = f"{hoy.isoformat()}T12:00:00+00:00"
    tablas = {
        "productos": [
            {"id": PA, "nombre": "RTX 4070", "stock": 2, "stock_minimo": 5},
            {"id": PB, "nombre": "Teclado", "stock": 20, "stock_minimo": 5},
        ],
        "reclamos": [{"id": "r1", "estado": "abierto"}, {"id": "r2", "estado": "abierto"}],
        "ordenes": [
            {"id": ORDEN, "estado": "pagada", "total_centavos": 100000,
             "mp_payment_type": "credit_card", "mp_payment_method": "visa",
             "created_at": ahora},
            {"id": "o2", "estado": "cancelada", "total_centavos": 50000,
             "mp_payment_type": "credit_card", "created_at": ahora},
            {"id": "o3", "estado": "pendiente", "total_centavos": 7000,
             "mp_payment_type": "debit_card", "created_at": ahora},
        ],
        "movimientos_stock": [
            {"producto_id": PA, "tipo": "entrada", "cantidad": 3, "motivo": "compra",
             "nota": "", "created_at": ahora},
            {"producto_id": PB, "tipo": "salida", "cantidad": 1, "motivo": "venta",
             "nota": "", "created_at": ahora},
            {"producto_id": PB, "tipo": "ajuste", "cantidad": 2, "motivo": "ajuste",
             "nota": "", "created_at": ayer + "T09:00:00+00:00"},
        ],
        "orden_items": [
            {"orden_id": ORDEN, "producto_id": PA, "cantidad": 2, "precio": 500},
            # Ítem de una orden cancelada: no debe sumar al top.
            {"orden_id": "o2", "producto_id": PB, "cantidad": 99, "precio": 100},
        ],
        "ordenes_compra": [
            {"id": OC, "estado": "recibida", "moneda": "ARS", "created_at": ahora,
             "ordenes_compra_items": [{"cantidad": 5, "costo_unitario_centavos": 2000}]},
            {"id": "oc2", "estado": "enviada", "moneda": "USD", "created_at": ahora,
             "ordenes_compra_items": [{"cantidad": 1, "costo_unitario_centavos": 300}]},
        ],
        "proveedores": [{"id": PROV, "estado": "activo"}, {"id": "p2", "estado": "inactivo"}],
        "sucursales": [
            {"id": "s1", "nombre": "Casa central", "direccion": "Salta", "activa": True},
            {"id": "s2", "nombre": "Sucursal Norte", "direccion": "", "activa": True},
        ],
    }
    _como(monkeypatch, "owner", tablas)

    r = cliente.get("/api/admin/resumen", headers=AUTH)
    assert r.status_code == 200, r.text
    d = r.json()

    assert d["productos_activos"] == 2
    assert d["bajo_stock"] == 1
    assert d["pedidos_pendientes"] == 1
    assert d["reclamos_abiertos"] == 2

    ventas = d["ventas"]
    assert ventas["pedidos"] == 1  # solo "pagada"
    assert ventas["total_centavos"] == 100000
    assert ventas["ticket_promedio_centavos"] == 100000
    assert len(ventas["por_dia"]) == 30
    assert ventas["por_dia"][-1]["dia"] == hoy.isoformat()
    assert ventas["por_dia"][-1]["pedidos"] == 1
    assert ventas["por_estado"] == {"pagada": 1, "cancelada": 1, "pendiente": 1}

    stock = d["stock"]
    assert (stock["entradas"], stock["salidas"], stock["ajustes"]) == (3, 1, 2)
    assert len(stock["por_dia"]) == 7
    assert stock["ultimos"][0]["producto"] == "RTX 4070"

    top = d["top_productos"]
    assert len(top) == 1
    assert top[0]["producto_id"] == PA
    assert top[0]["unidades"] == 2
    assert top[0]["total_centavos"] == 100000

    assert d["compras"]["ordenes"] == 2
    assert d["compras"]["abiertas"] == 1
    assert d["compras"]["recibidas"] == 1
    assert d["compras"]["total_centavos"] == {"ARS": 10000, "USD": 300}

    assert d["proveedores"] == {"activos": 1, "total": 2}

    assert d["usuarios"]["total"] == 1
    assert d["pagos"] == [{
        "tipo": "credit_card", "pedidos": 1, "total_centavos": 100000,
        "metodos": {"visa": 1},
    }]
    assert [s["nombre"] for s in d["sucursales"]] == ["Casa central", "Sucursal Norte"]


def test_clientes_incluye_fotos_de_los_productos(monkeypatch):
    orden = {
        "id": ORDEN, "user_id": "uid-cliente", "estado": "pagada",
        "total_centavos": 100000, "comprobante_numero": "HT-0001",
        "created_at": "2026-10-21T12:00:00+00:00",
        "orden_items": [
            {"cantidad": 2, "productos": {
                "nombre": "RTX 4070", "imagen": "https://cdn.example/rtx.jpg",
            }},
            {"cantidad": 1, "productos": None},
        ],
    }
    recibo = {
        "id": "c1", "orden_id": ORDEN, "archivo_nombre": "transferencia.jpg",
        "mime": "image/jpeg", "monto_centavos": 100000, "nota": "",
        "created_at": "2026-10-21T12:05:00+00:00",
    }

    def fake_get(tabla, params):
        if tabla == "ordenes":
            return [orden]
        if tabla == "comprobantes_pago":
            return [recibo]
        return []

    monkeypatch.setattr(admin_api, "_sb_get", fake_get)

    resumen = admin_api._resumen_pedidos(["uid-cliente"])
    r = resumen["uid-cliente"]
    assert r["pedidos"] == 1
    assert r["comprado_centavos"] == 100000
    assert r["pedidos_detalle"][0]["codigo"] == "HT-0001"
    assert r["pedidos_detalle"][0]["items"] == [
        {"nombre": "RTX 4070", "cantidad": 2,
         "imagen": "https://cdn.example/rtx.jpg"},
        {"nombre": "Producto", "cantidad": 1, "imagen": ""},
    ]
    assert r["pedidos_detalle"][0]["comprobante_pago"] == recibo


def test_resumen_sin_datos_no_inventa(monkeypatch):
    _como(monkeypatch, "owner", {})
    r = cliente.get("/api/admin/resumen", headers=AUTH)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["productos_activos"] == 0
    assert d["ventas"]["pedidos"] == 0
    assert d["ventas"]["total_centavos"] == 0
    assert d["ventas"]["ticket_promedio_centavos"] == 0
    assert len(d["ventas"]["por_dia"]) == 30
    assert len(d["stock"]["por_dia"]) == 7
    assert d["top_productos"] == []
    assert d["compras"]["total_centavos"] == {}


COLUMNAS_015 = ("sucursal_id", "medio_pago", "mp_payment_type", "mp_payment_method")


@pytest.mark.parametrize("ruta", [
    "/api/admin/resumen",
    "/api/admin/resumen?sucursal=66666666-6666-6666-6666-666666666666",
])
def test_resumen_con_la_base_sin_migracion_015(monkeypatch, ruta):
    """Base de produccion antes de aplicar la 015: `ordenes` no tiene ninguna de
    las columnas nuevas (un select que las pida da 400). Inicio no puede romperse."""
    from fastapi import HTTPException

    ahora = f"{datetime.now(timezone.utc).date().isoformat()}T12:00:00+00:00"

    def ordenes(params):
        pedidas = str(params.get("select", "")) + " " + " ".join(params)
        if any(c in pedidas for c in COLUMNAS_015):
            raise HTTPException(status_code=502, detail="Operación no disponible.")
        return [{"id": ORDEN, "estado": "pagada", "total_centavos": 100000, "created_at": ahora}]

    _como(monkeypatch, "owner", {"ordenes": ordenes})
    r = cliente.get(ruta, headers=AUTH)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["ventas"]["pedidos"] == 1
    assert d["ventas"]["total_centavos"] == 100000
    assert d["sucursal"] is None  # sin columna no hay filtro: se muestra todo


def test_resumen_con_015_pero_sin_medio_pago_conserva_el_filtro_de_sucursal(monkeypatch):
    """Base real de hoy: tiene la 015 (sucursal_id, mp_payment_*) pero NO
    `ordenes.medio_pago` (la define otra rama de la 004). El filtro por
    sucursal tiene que seguir funcionando."""
    from fastapi import HTTPException

    ahora = f"{datetime.now(timezone.utc).date().isoformat()}T12:00:00+00:00"
    suc = "66666666-6666-6666-6666-666666666666"
    consultas = []

    def ordenes(params):
        if "medio_pago" in str(params.get("select", "")):
            raise HTTPException(status_code=502, detail="Operación no disponible.")
        consultas.append(dict(params))
        filas = [
            {"id": "o1", "estado": "pagada", "total_centavos": 100000, "created_at": ahora,
             "sucursal_id": suc, "mp_payment_type": "credit_card", "mp_payment_method": "visa"},
            {"id": "o2", "estado": "pagada", "total_centavos": 50000, "created_at": ahora,
             "sucursal_id": "otra", "mp_payment_type": "debit_card", "mp_payment_method": "master"},
        ]
        filtro = str(params.get("sucursal_id") or "")
        if filtro.startswith("eq."):
            filas = [f for f in filas if f["sucursal_id"] == filtro[3:]]
        return filas

    _como(monkeypatch, "owner", {"ordenes": ordenes})
    r = cliente.get(f"/api/admin/resumen?sucursal={suc}", headers=AUTH)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["sucursal"] == suc
    assert d["ventas"]["pedidos"] == 1
    assert d["ventas"]["total_centavos"] == 100000
    assert any(c.get("sucursal_id") == f"eq.{suc}" for c in consultas)


def test_ficha_proveedor_historial_de_recepciones(monkeypatch):
    tablas = {
        "proveedores": [{"id": PROV, "nombre": "Proveedor SA", "estado": "activo",
                         "condicion_iva": "responsable_inscripto"}],
        "producto_proveedor": [],
        "ordenes_compra": [{
            "id": OC, "numero": 7, "estado": "recibida", "moneda": "ARS",
            "fecha_esperada": None, "created_at": "2026-10-01T10:00:00+00:00",
            "ordenes_compra_items": [{
                "producto_id": PA, "cantidad": 5, "cantidad_recibida": 3,
                "costo_unitario_centavos": 2000,
            }],
        }],
        "recepciones_compra": [{
            "id": "rec1", "orden_id": OC, "nota": "Llegó parcial",
            "items": [{"producto_id": PA, "cantidad": 3, "stock": 10}],
            "created_at": "2026-10-20T15:00:00+00:00",
        }],
        "productos": [{"id": PA, "nombre": "RTX 4070"}],
    }
    _como(monkeypatch, "owner", tablas)

    r = cliente.get(f"/api/admin/proveedores/{PROV}", headers=AUTH)
    assert r.status_code == 200, r.text
    d = r.json()

    h = d["historial"]
    assert h["ordenes"] == 1
    assert h["recepciones"] == 1
    assert h["unidades_pedidas"] == 5
    assert h["unidades_recibidas"] == 3
    assert h["ultima_recepcion"] == "2026-10-20T15:00:00+00:00"
    assert h["total_centavos"] == {"ARS": 6000}

    rec = d["recepciones"][0]
    assert rec["orden_codigo"] == "OC-000007"
    assert rec["unidades"] == 3
    assert rec["total_centavos"] == 6000
    assert rec["items"] == [{
        "producto_id": PA, "nombre": "RTX 4070", "cantidad": 3,
        "costo_unitario_centavos": 2000,
    }]


def test_ficha_proveedor_sin_recepciones(monkeypatch):
    tablas = {
        "proveedores": [{"id": PROV, "nombre": "Proveedor SA", "estado": "activo"}],
        "producto_proveedor": [],
        "ordenes_compra": [],
    }
    _como(monkeypatch, "owner", tablas)

    r = cliente.get(f"/api/admin/proveedores/{PROV}", headers=AUTH)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["recepciones"] == []
    assert d["historial"]["recepciones"] == 0
    assert d["historial"]["unidades_recibidas"] == 0
    assert d["historial"]["ultima_recepcion"] is None


def test_sucursales_lista_real(monkeypatch):
    _como(monkeypatch, "owner", {"sucursales": [
        {"id": "s1", "nombre": "Casa central", "direccion": "Salta", "activa": True},
    ]})
    r = cliente.get("/api/admin/sucursales", headers=AUTH)
    assert r.status_code == 200, r.text
    assert r.json()["sucursales"][0]["nombre"] == "Casa central"


def test_crear_sucursal_normaliza_campos(monkeypatch):
    _como(monkeypatch, "owner", {})
    enviado = {}

    def fake_post(tabla, fila, prefer="return=representation"):
        enviado["tabla"] = tabla
        enviado["fila"] = fila
        return [{"id": "s1", **fila}]

    monkeypatch.setattr(admin_api, "_sb_post", fake_post)
    r = cliente.post("/api/admin/sucursales", headers=AUTH, json={
        "nombre": "  Casa central  ", "direccion": " Salta ", "telefono": " 388 4000000 ",
    })
    assert r.status_code == 201, r.text
    assert enviado["tabla"] == "sucursales"
    assert enviado["fila"] == {
        "nombre": "Casa central", "direccion": "Salta", "telefono": "388 4000000",
    }
    assert r.json()["sucursal"]["nombre"] == "Casa central"


def test_crear_sucursal_sin_nombre_es_400(monkeypatch):
    _como(monkeypatch, "owner", {})
    r = cliente.post("/api/admin/sucursales", headers=AUTH, json={"nombre": "   "})
    assert r.status_code == 400
