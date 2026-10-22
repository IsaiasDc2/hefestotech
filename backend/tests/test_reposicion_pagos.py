"""Tests del motor de reposición y de los comprobantes de pago del cliente.

Sin red ni Storage real: los helpers REST y de archivos se monkeypatchean.
Correr desde backend/:
    python -m pytest tests -q
"""
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import admin_api  # noqa: E402
import checkout_api  # noqa: E402
import main  # noqa: E402
import reposicion  # noqa: E402

cliente = TestClient(main.app)
AUTH = {"Authorization": "Bearer x"}

PRODUCTO = "33333333-3333-3333-3333-333333333333"
PROVEEDOR = "11111111-1111-1111-1111-111111111111"
ORDEN = "99999999-9999-9999-9999-999999999999"


@pytest.fixture(autouse=True)
def _sin_rate_limit():
    admin_api._registro.clear()
    checkout_api._registro.clear()


def _base_reposicion(producto=None, relacion="default", items=None, notificaciones=None):
    producto = producto or {
        "id": PRODUCTO, "nombre": "GeForce RTX 4060", "stock": 2,
        "stock_minimo": 5, "stock_objetivo": 0, "activo": True, "deleted_at": None,
    }
    if relacion == "default":
        relacion = {
            "proveedor_id": PROVEEDOR, "costo_centavos": 350000_00,
            "moneda": "ARS", "cantidad_minima": 4, "tiempo_entrega_dias": 5,
            "proveedores": {"id": PROVEEDOR, "nombre": "Mayorista Sur",
                            "moneda": "ARS", "estado": "activo",
                            "deleted_at": None, "plazo_entrega_dias": 7},
        }

    def fake_get(tabla, params):
        if tabla == "productos":
            return [producto]
        if tabla == "ordenes_compra_items":
            return items or []
        if tabla == "producto_proveedor":
            return [relacion] if relacion else []
        if tabla == "notificaciones":
            return notificaciones or []
        return []

    return fake_get


def test_reposicion_crea_solicitud_y_notifica(monkeypatch):
    posts = []
    fake_get = _base_reposicion()

    def fake_post(tabla, fila, prefer="return=representation"):
        posts.append((tabla, fila))
        if tabla == "ordenes_compra":
            return [{"id": "oc-1", "numero": 123, **fila}]
        if tabla == "notificaciones":
            return [{"id": "n-1", **fila}]
        return []

    resultado = reposicion.evaluar_producto(
        PRODUCTO, sb_get=fake_get, sb_post=fake_post, actor="uid-1",
    )

    assert resultado["accion"] == "solicitud_creada"
    assert resultado["codigo"] == "OC-000123"
    # stock 2, mínimo 5 → objetivo 10; faltan 8, mínimo de compra 4 → 8.
    assert resultado["cantidad"] == 8
    oc = next(f for t, f in posts if t == "ordenes_compra")
    assert oc["origen"] == "reposicion"
    assert oc["estado"] == "enviada"
    assert oc["proveedor_id"] == PROVEEDOR
    item = next(f for t, f in posts if t == "ordenes_compra_items")
    assert item[0]["cantidad"] == 8
    assert item[0]["costo_unitario_centavos"] == 350000_00
    noti = next(f for t, f in posts if t == "notificaciones")
    assert noti["user_id"] is None
    assert "GeForce RTX 4060" in noti["titulo"]
    assert "Se registró la solicitud de 8 u." in noti["mensaje"]
    assert "Mayorista Sur" in noti["mensaje"]
    assert "OC-000123" in noti["mensaje"]


def test_reposicion_respeta_objetivo_y_redondea_al_minimo(monkeypatch):
    posts = []
    fake_get = _base_reposicion(producto={
        "id": PRODUCTO, "nombre": "SSD 1 TB", "stock": 1,
        "stock_minimo": 3, "stock_objetivo": 10, "activo": True, "deleted_at": None,
    })

    def fake_post(tabla, fila, prefer="return=representation"):
        posts.append((tabla, fila))
        return [{"id": "oc-2", "numero": 124, **fila}] if tabla == "ordenes_compra" else []

    resultado = reposicion.evaluar_producto(
        PRODUCTO, sb_get=fake_get, sb_post=fake_post,
    )
    # objetivo 10 - stock 1 = 9; mínimo de compra 4 → 12.
    assert resultado["cantidad"] == 12
    item = next(f for t, f in posts if t == "ordenes_compra_items")
    assert item[0]["cantidad"] == 12


def test_reposicion_no_duplica_si_hay_oc_abierta():
    posts = []
    fake_get = _base_reposicion(items=[{
        "orden_id": "oc-9", "cantidad": 20, "cantidad_recibida": 0,
        "ordenes_compra": {"id": "oc-9", "numero": 9, "estado": "enviada",
                           "origen": "manual"},
    }])

    resultado = reposicion.evaluar_producto(
        PRODUCTO, sb_get=fake_get, sb_post=lambda *a, **k: posts.append((a, k)),
    )
    assert resultado["accion"] == "ya_pedido"
    assert resultado["codigo"] == "OC-000009"
    assert posts == []


def test_reposicion_sin_proveedor_notifica_sin_inventar_orden():
    posts = []
    fake_get = _base_reposicion(relacion=None)

    def fake_post(tabla, fila, prefer="return=representation"):
        posts.append((tabla, fila))
        return []

    resultado = reposicion.evaluar_producto(
        PRODUCTO, sb_get=fake_get, sb_post=fake_post,
    )
    assert resultado["accion"] == "sin_proveedor"
    assert not any(t == "ordenes_compra" for t, _ in posts)
    noti = next(f for t, f in posts if t == "notificaciones")
    assert "no tiene proveedor principal activo" in noti["mensaje"]
    assert "GeForce RTX 4060" in noti["titulo"]


def test_notificacion_pago_al_staff(monkeypatch):
    rpcs = []
    monkeypatch.setattr(checkout_api, "_rpc", lambda f, a: rpcs.append((f, a)))
    checkout_api._notificar_pago_staff({
        "id": ORDEN, "nombre": "Ana Pérez", "total_centavos": 1_234_500,
    }, "mp-77")

    funcion, args = rpcs[0]
    assert funcion == "notificar"
    assert args["p_user"] is None
    assert "Ana Pérez" in args["p_mensaje"]
    assert "$12.345" in args["p_mensaje"]
    assert args["p_dedupe"] == f"pago-staff:{ORDEN}"


def _fake_orden_get(estado="pendiente"):
    def fake_get(tabla, params):
        if tabla == "ordenes":
            return [{
                "id": "o1", "user_id": None, "estado": estado,
                "total_centavos": 12345, "acceso_token": "tok",
                "nombre": "Ana", "email": "ana@example.com",
            }]
        return []
    return fake_get


def test_subir_comprobante_pago_valida_y_notifica(monkeypatch):
    subidos, notificaciones, borrados = [], [], []
    monkeypatch.setattr(checkout_api, "_sb_get", _fake_orden_get())
    monkeypatch.setattr(checkout_api, "_limitar", lambda *a: None)
    monkeypatch.setattr(checkout_api, "subir_archivo",
                        lambda bucket, path, contenido, mime: subidos.append(
                            (bucket, path, contenido, mime)))
    monkeypatch.setattr(checkout_api, "firmar_archivo",
                        lambda bucket, path: "https://firmada/ok")
    monkeypatch.setattr(checkout_api, "borrar_archivo",
                        lambda bucket, path: borrados.append((bucket, path)))

    def fake_post(tabla, fila, prefer="return=representation"):
        assert tabla == "comprobantes_pago"
        return [{"id": "c1", "created_at": "2026-10-21T12:00:00Z",
                 "archivo_path": fila["archivo_path"], **fila}]

    monkeypatch.setattr(checkout_api, "_sb_post", fake_post)
    monkeypatch.setattr(checkout_api, "_rpc", lambda f, a: notificaciones.append((f, a)))

    r = cliente.post(
        "/api/checkout/estado/o1/comprobante-pago?token=tok",
        files={"archivo": ("pago.pdf", b"%PDF-1.4 comprobante", "application/pdf")},
        data={"monto_centavos": "12345", "nota": "Transferencia Banco X"},
    )
    assert r.status_code == 200, r.text
    datos = r.json()
    assert datos["comprobante"]["archivo_nombre"] == "pago.pdf"
    assert datos["comprobante"]["monto_centavos"] == 12345
    assert "archivo_path" not in datos["comprobante"]
    assert datos["archivo_url"] == "https://firmada/ok"
    assert subidos[0][0] == "comprobantes-pago"
    assert subidos[0][1].startswith("ordenes/o1/")
    assert subidos[0][3] == "application/pdf"
    assert borrados == []
    assert notificaciones[0][1]["p_user"] is None
    assert "Ana cargó un comprobante" in notificaciones[0][1]["p_mensaje"]


def test_subir_comprobante_rechaza_tipo_falso(monkeypatch):
    subidos = []
    monkeypatch.setattr(checkout_api, "_sb_get", _fake_orden_get())
    monkeypatch.setattr(checkout_api, "_limitar", lambda *a: None)
    monkeypatch.setattr(checkout_api, "subir_archivo",
                        lambda *a: subidos.append(a))
    r = cliente.post(
        "/api/checkout/estado/o1/comprobante-pago?token=tok",
        files={"archivo": ("pago.pdf", b"no soy un pdf", "application/pdf")},
    )
    assert r.status_code == 415
    assert subidos == []


def test_subir_comprobante_borra_archivo_si_falta_migracion(monkeypatch):
    borrados = []
    monkeypatch.setattr(checkout_api, "_sb_get", _fake_orden_get())
    monkeypatch.setattr(checkout_api, "_limitar", lambda *a: None)
    monkeypatch.setattr(checkout_api, "subir_archivo", lambda *a: None)
    monkeypatch.setattr(checkout_api, "firmar_archivo", lambda *a: "")
    monkeypatch.setattr(checkout_api, "borrar_archivo",
                        lambda bucket, path: borrados.append((bucket, path)))

    def fake_post(*a, **k):
        raise HTTPException(status_code=502, detail="tabla inexistente")

    monkeypatch.setattr(checkout_api, "_sb_post", fake_post)
    r = cliente.post(
        "/api/checkout/estado/o1/comprobante-pago?token=tok",
        files={"archivo": ("pago.png", b"\x89PNG\r\n\x1a\nresto", "image/png")},
    )
    assert r.status_code == 503
    assert "migración 016" in r.json()["detail"]
    assert len(borrados) == 1 and borrados[0][0] == "comprobantes-pago"


def test_admin_ve_comprobante_de_pago_con_url_firmada(monkeypatch):
    monkeypatch.setattr(admin_api, "_validar_jwt", lambda bearer: "uid-1")
    monkeypatch.setattr(admin_api, "firmar_archivo",
                        lambda bucket, path: f"https://firmada/{path}")

    def fake_get(tabla, params):
        if tabla == "perfiles":
            return [{"id": "uid-1", "rol": "admin"}]
        if tabla == "comprobantes_pago":
            return [{"id": "c1", "orden_id": ORDEN, "archivo_path": "ordenes/x/a.pdf",
                     "archivo_nombre": "a.pdf", "monto_centavos": 100,
                     "nota": "", "created_at": "2026-10-21T12:00:00Z"}]
        return []

    monkeypatch.setattr(admin_api, "_sb_get", fake_get)
    r = cliente.get(f"/api/admin/pedidos/{ORDEN}/comprobante-pago", headers=AUTH)
    assert r.status_code == 200, r.text
    datos = r.json()["comprobante"]
    assert datos["archivo_url"].endswith("ordenes/x/a.pdf")
    assert "archivo_path" not in datos
