"""Avisos salientes a n8n: opcionales, seguros y sin red.

    python -m pytest tests -q
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

import admin_api  # noqa: E402
import mailer  # noqa: E402
import main  # noqa: E402
import n8n_hook  # noqa: E402

PED = "aaaaaaaa-1111-2222-3333-444444444444"
ORDEN = {
    "id": PED, "nombre": "Ana", "email": "ana@ej.com", "telefono": "3875551234",
    "total_centavos": 1234500, "acceso_token": "tok",
    "orden_items": [{"cantidad": 2, "precio": 5000, "productos": {"nombre": "RAM 16GB"}}],
    "transportista": "Andreani", "tracking_codigo": "ABC123", "tracking_url": "https://x.test/t",
}


@pytest.fixture(autouse=True)
def _entorno(monkeypatch):
    for k in ("N8N_WEBHOOK_BASE_URL", "N8N_WEBHOOK_SECRET", "FRONTEND_URL"):
        monkeypatch.delenv(k, raising=False)


def _activar(monkeypatch):
    monkeypatch.setenv("N8N_WEBHOOK_BASE_URL", "https://n8n.ej.com/webhook/")
    monkeypatch.setenv("N8N_WEBHOOK_SECRET", "s3cret")
    monkeypatch.setenv("FRONTEND_URL", "https://tienda.ej.com")


def test_sin_configurar_no_hace_nada(monkeypatch):
    llamadas = []
    monkeypatch.setattr(n8n_hook.httpx, "post", lambda *a, **k: llamadas.append(1))
    assert n8n_hook.habilitado() is False
    assert n8n_hook.emitir_pedido(ORDEN, "pagada", "HT-AAAAAAAA") is False
    assert n8n_hook.emitir_cupon({"codigo": "X"}) is False
    assert llamadas == []


def test_exige_url_y_secreto(monkeypatch):
    monkeypatch.setenv("N8N_WEBHOOK_BASE_URL", "https://n8n.ej.com/webhook")
    assert n8n_hook.habilitado() is False  # falta el secreto
    monkeypatch.setenv("N8N_WEBHOOK_SECRET", "s3cret")
    assert n8n_hook.habilitado() is True
    monkeypatch.setenv("N8N_WEBHOOK_BASE_URL", "n8n.ej.com/webhook")
    assert n8n_hook.habilitado() is False  # sin esquema http(s)


def test_payload_pedido():
    p = n8n_hook.payload_pedido(ORDEN, "enviada", "HT-AAAAAAAA")
    assert p["numero"] == "HT-AAAAAAAA" and p["estado"] == "enviada"
    assert p["total"] == 12345.0 and p["moneda"] == "ARS"
    assert p["cliente"] == {"nombre": "Ana", "email": "ana@ej.com", "telefono": "3875551234"}
    assert p["items"] == [{"nombre": "RAM 16GB", "cantidad": 2, "precio_unitario": 5000.0}]
    assert p["envio"] == {"transportista": "Andreani", "codigo": "ABC123", "url": "https://x.test/t"}
    assert p["link_pedido"] == ""  # sin FRONTEND_URL no se inventa un enlace


def test_payload_pedido_con_enlace(monkeypatch):
    _activar(monkeypatch)
    p = n8n_hook.payload_pedido(ORDEN, "pagada", "HT-AAAAAAAA")
    assert p["link_pedido"] == f"https://tienda.ej.com/pedido/{PED}?token=tok"


def test_payload_pedido_tolera_datos_faltantes():
    p = n8n_hook.payload_pedido({"id": PED}, "pagada", "HT-AAAAAAAA")
    assert p["total"] is None and p["items"] == []
    assert p["cliente"]["telefono"] == ""


def test_payload_cupon_no_filtra_datos_internos(monkeypatch):
    _activar(monkeypatch)
    p = n8n_hook.payload_cupon({
        "id": "uuid-interno", "codigo": "HOT10", "tipo": "porcentaje", "valor": 10,
        "min_compra_centavos": 5000000, "usos": 3, "usos_max": 50, "vence_at": None,
    })
    assert p == {"codigo": "HOT10", "tipo": "porcentaje", "valor": 10, "min_compra": 50000.0,
                 "usos_max": 50, "vence_at": None, "tienda_url": "https://tienda.ej.com"}


def test_payload_cupon_monto_fijo_va_en_pesos():
    p = n8n_hook.payload_cupon({"codigo": "MENOS5", "tipo": "monto", "valor": 500000})
    assert p["valor"] == 5000.0 and p["tipo"] == "monto"


def test_envia_al_webhook_correcto_con_secreto(monkeypatch):
    _activar(monkeypatch)
    enviados = []

    class R:
        status_code = 200

    monkeypatch.setattr(n8n_hook.httpx, "post",
                        lambda url, **kw: (enviados.append((url, kw)) or R()))
    ok = n8n_hook.emitir("pedido.estado", {"a": 1}, "id-1", en_segundo_plano=False)
    ok2 = n8n_hook.emitir("oferta.creada", {"b": 2}, "id-2", en_segundo_plano=False)
    assert ok and ok2
    (u1, k1), (u2, _) = enviados
    assert u1 == "https://n8n.ej.com/webhook/hefestotech-pedidos"
    assert u2 == "https://n8n.ej.com/webhook/hefestotech-ofertas"
    assert k1["headers"] == {"X-Hefesto-Secret": "s3cret"}
    assert k1["json"]["evento"] == "pedido.estado" and k1["json"]["evento_id"] == "id-1"
    assert k1["json"]["datos"] == {"a": 1}


def test_evento_desconocido_no_se_envia(monkeypatch):
    _activar(monkeypatch)
    monkeypatch.setattr(n8n_hook.httpx, "post", lambda *a, **k: pytest.fail("no debe enviar"))
    assert n8n_hook.emitir("otra.cosa", {}, "x", en_segundo_plano=False) is False


def test_error_de_red_o_http_no_lanza(monkeypatch):
    _activar(monkeypatch)

    def cae(*a, **k):
        raise n8n_hook.httpx.ConnectError("sin red")

    monkeypatch.setattr(n8n_hook.httpx, "post", cae)
    assert n8n_hook.emitir("pedido.estado", {}, "x", en_segundo_plano=False) is False

    class R:
        status_code = 500

    monkeypatch.setattr(n8n_hook.httpx, "post", lambda *a, **k: R())
    assert n8n_hook.emitir("pedido.estado", {}, "x", en_segundo_plano=False) is False


def test_notificar_estado_avisa_a_n8n_aunque_el_estado_no_lleve_email(monkeypatch):
    avisos = []
    monkeypatch.setattr(n8n_hook, "emitir_pedido",
                        lambda orden, estado, numero: avisos.append((orden["id"], estado, numero)))
    assert mailer.notificar_estado(ORDEN, "preparacion") is False  # no se mailea
    assert avisos == [(PED, "preparacion", "HT-AAAAAAAA")]


def test_crear_cupon_avisa_la_oferta(monkeypatch):
    cliente = TestClient(main.app)
    admin_api._registro.clear()
    monkeypatch.setattr(admin_api, "_validar_jwt", lambda bearer: "uid-1")
    monkeypatch.setattr(admin_api, "_sb_get",
                        lambda tabla, params: [{"id": "uid-1", "rol": "owner"}] if tabla == "perfiles" else [])
    creado = {"id": "c1", "codigo": "HOT10", "tipo": "porcentaje", "valor": 10,
              "min_compra_centavos": 0, "usos_max": None, "activo": True, "vence_at": None}
    monkeypatch.setattr(admin_api, "_sb_post", lambda tabla, fila, prefer="": [creado])
    avisos = []
    monkeypatch.setattr(n8n_hook, "emitir_cupon", lambda c: avisos.append(c["codigo"]))
    r = cliente.post("/api/admin/cupones", headers={"Authorization": "Bearer x"},
                     json={"codigo": "hot10", "tipo": "porcentaje", "valor": 10})
    assert r.status_code == 201
    assert avisos == ["HOT10"]


def test_aviso_desde_el_panel_trae_items_para_n8n(monkeypatch):
    consultas = []
    monkeypatch.setattr(admin_api, "_sb_get", lambda tabla, params: consultas.append(params) or [ORDEN])
    vistos = []
    monkeypatch.setattr(admin_api, "notificar_estado", lambda orden, estado: vistos.append((orden, estado)))
    admin_api._avisar_cliente(PED, "enviada")
    assert "orden_items(cantidad,precio,productos(nombre))" in consultas[0]["select"]
    assert vistos == [(ORDEN, "enviada")]


def test_workflows_de_n8n_son_json_importable():
    import json

    raiz = Path(__file__).resolve().parents[2]
    for nombre in ("hefestotech-pedidos-whatsapp.json", "hefestotech-ofertas.json"):
        datos = json.loads((raiz / "n8n" / nombre).read_text(encoding="utf-8"))
        assert datos["name"].startswith("HefestoTech")
        assert datos["nodes"] and datos["connections"]
        assert all(nodo.get("type") for nodo in datos["nodes"])
