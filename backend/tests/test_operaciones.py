"""Operación del panel: búsqueda de pedidos, hora argentina, seguimiento,
reembolso por Mercado Pago, emails y reportes. Sin red: todo se monkeypatchea.

Correr desde backend/:
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

cliente = TestClient(main.app)
AUTH = {"Authorization": "Bearer x"}
PED = "aaaaaaaa-1111-2222-3333-444444444444"


@pytest.fixture(autouse=True)
def _limpio(monkeypatch):
    admin_api._registro.clear()
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    monkeypatch.delenv("MAIL_FROM", raising=False)


def _sesion(monkeypatch, rol="owner", ordenes=None, total=None, capturas=None):
    """Sesión con `rol`; `ordenes` = filas que devuelve la tabla ordenes."""
    monkeypatch.setattr(admin_api, "_validar_jwt", lambda bearer: "uid-1")
    ordenes = ordenes if ordenes is not None else []

    def fake_get(tabla, params):
        if tabla == "perfiles":
            return [{"id": "uid-1", "rol": rol}]
        if capturas is not None:
            capturas.append((tabla, params))
        return ordenes if tabla == "ordenes" else []

    def fake_total(tabla, params):
        if capturas is not None:
            capturas.append((tabla, params))
        return ordenes, total if total is not None else len(ordenes)

    monkeypatch.setattr(admin_api, "_sb_get", fake_get)
    monkeypatch.setattr(admin_api, "_sb_get_total", fake_total)


# ------------------------------------------------------------ utilidades ---
def test_numero_pedido_legible():
    assert mailer.numero_pedido(PED) == "HT-AAAAAAAA"
    assert mailer.numero_pedido(None) == "HT-"


def test_dia_en_hora_argentina():
    # 01:30 UTC del 24 = 22:30 del 23 en Argentina.
    assert admin_api._dia_ar("2026-10-24T01:30:00+00:00") == "2026-10-23"
    assert admin_api._dia_ar("2026-10-24T12:00:00Z") == "2026-10-24"
    assert admin_api._dia_ar("basura") == "basura"[:10]


# ----------------------------------------------------- búsqueda de pedidos ---
def test_pedidos_busqueda_por_numero_email_y_nombre(monkeypatch):
    cap = []
    _sesion(monkeypatch, ordenes=[{"id": PED}], capturas=cap)
    r = cliente.get("/api/admin/pedidos?q=HT-AAAA1111", headers=AUTH)
    assert r.status_code == 200
    params = next(p for t, p in cap if t == "ordenes")
    assert "email.ilike.*HT-AAAA1111*" in params["or"]
    assert "and(id.gte.aaaa1111-0000-0000-0000-000000000000,id.lte.aaaa1111-ffff-ffff-ffff-ffffffffffff)" in params["or"]
    assert r.json()["pedidos"][0]["numero"] == "HT-AAAAAAAA"


def test_pedidos_busqueda_parcial_completa_el_rango(monkeypatch):
    cap = []
    _sesion(monkeypatch, capturas=cap)
    cliente.get("/api/admin/pedidos?q=%23ab12", headers=AUTH)
    params = next(p for t, p in cap if t == "ordenes")
    assert "id.gte.ab120000-0000-0000-0000-000000000000" in params["or"]
    assert "id.lte.ab12ffff-ffff-ffff-ffff-ffffffffffff" in params["or"]


def test_pedidos_texto_con_sintaxis_no_inyecta_filtros(monkeypatch):
    cap = []
    _sesion(monkeypatch, capturas=cap)
    cliente.get("/api/admin/pedidos?q=a),estado.eq.cancelada,(b", headers=AUTH)
    params = next(p for t, p in cap if t == "ordenes")
    # Las comas y paréntesis del texto se vuelven espacios: solo quedan las
    # dos condiciones propias (email y nombre), una coma entre ellas.
    assert params["or"].count(",") == 1
    assert params["or"].count("(") == 1 and params["or"].count(")") == 1
    assert "estado" not in params


def test_pedidos_rango_de_fechas_en_hora_argentina(monkeypatch):
    cap = []
    _sesion(monkeypatch, capturas=cap)
    r = cliente.get("/api/admin/pedidos?desde=2026-10-01&hasta=2026-10-23", headers=AUTH)
    assert r.status_code == 200
    params = next(p for t, p in cap if t == "ordenes")
    assert params["and"] == "(created_at.gte.2026-10-01T00:00:00-03:00,created_at.lt.2026-10-24T00:00:00-03:00)"


def test_pedidos_fecha_invalida_400(monkeypatch):
    _sesion(monkeypatch)
    assert cliente.get("/api/admin/pedidos?desde=2026-13-45", headers=AUTH).status_code == 400
    assert cliente.get("/api/admin/pedidos?hasta=ayer", headers=AUTH).status_code == 400


# ------------------------------------------------------------ seguimiento ---
def test_envio_valida_datos(monkeypatch):
    _sesion(monkeypatch)
    url = f"/api/admin/pedidos/{PED}/envio"
    assert cliente.put(url, headers=AUTH, json={}).status_code == 422
    assert cliente.put(url, headers=AUTH, json={"codigo": "X", "url": "javascript:alert(1)"}).status_code == 422
    assert cliente.put(url, headers=AUTH, json={"codigo": "X" * 81}).status_code == 422


def test_envio_guarda_y_avisa_si_ya_esta_enviado(monkeypatch):
    _sesion(monkeypatch)
    cambios, avisos = [], []
    monkeypatch.setattr(admin_api, "_sb_patch",
                        lambda t, p, c: (cambios.append((t, p, c)) or [{"id": PED, "estado": "enviada"}]))
    monkeypatch.setattr(admin_api, "_avisar_cliente", lambda pid, estado: avisos.append((pid, estado)))
    r = cliente.put(f"/api/admin/pedidos/{PED}/envio", headers=AUTH,
                    json={"transportista": "Andreani", "codigo": "ABC123", "url": "https://ej.com/t/ABC123"})
    assert r.status_code == 200
    assert cambios[0][2] == {"transportista": "Andreani", "tracking_codigo": "ABC123",
                             "tracking_url": "https://ej.com/t/ABC123"}
    assert avisos == [(PED, "enviada")]


def test_envio_sin_migracion_017_explica_que_falta(monkeypatch):
    _sesion(monkeypatch)

    def sin_columna(*a, **k):
        raise admin_api.HTTPException(status_code=502, detail="x")

    monkeypatch.setattr(admin_api, "_sb_patch", sin_columna)
    r = cliente.put(f"/api/admin/pedidos/{PED}/envio", headers=AUTH, json={"codigo": "A"})
    assert r.status_code == 409 and "017" in r.json()["detail"]


# -------------------------------------------------------------- reembolso ---
class _RespMP:
    def __init__(self, status):
        self.status_code = status


def _preparar_reembolso(monkeypatch, rol="owner", estado="pagada", pago="123456789", status_mp=201):
    _sesion(monkeypatch, rol=rol,
            ordenes=[{"id": PED, "estado": estado, "mp_payment_id": pago, "email": "c@ej.com", "nombre": "Ana"}])
    monkeypatch.setenv("MERCADOPAGO_ACCESS_TOKEN", "TEST-token")
    llamadas = {"mp": [], "rpc": []}

    def fake_post(url, **kw):
        llamadas["mp"].append((url, kw))
        return _RespMP(status_mp)

    monkeypatch.setattr(admin_api.httpx, "post", fake_post)
    monkeypatch.setattr(admin_api, "_rpc", lambda f, a: (llamadas["rpc"].append((f, a)) or 1))
    monkeypatch.setattr(admin_api, "_avisar_cliente", lambda pid, estado: None)
    return llamadas


def test_reembolso_exitoso_llama_a_mp_con_idempotencia_y_cambia_estado(monkeypatch):
    ll = _preparar_reembolso(monkeypatch)
    r = cliente.post(f"/api/admin/pedidos/{PED}/reembolsar", headers=AUTH, json={"nota": "producto fallado"})
    assert r.status_code == 200 and r.json()["estado"] == "reembolsada"
    url, kw = ll["mp"][0]
    assert url == "https://api.mercadopago.com/v1/payments/123456789/refunds"
    assert kw["headers"]["X-Idempotency-Key"] == f"refund-{PED}"
    assert kw["headers"]["Authorization"] == "Bearer TEST-token"
    f, args = ll["rpc"][0]
    assert f == "cambiar_estado_pedido" and args["p_a"] == "reembolsada"
    assert "producto fallado" in args["p_nota"]


def test_reembolso_puede_devolver_stock(monkeypatch):
    ll = _preparar_reembolso(monkeypatch)
    devueltos = []
    monkeypatch.setattr(admin_api, "_devolver_stock_de_pedido",
                        lambda pid, actor, motivo="cancelacion": devueltos.append((pid, motivo)))
    r = cliente.post(f"/api/admin/pedidos/{PED}/reembolsar", headers=AUTH, json={"devolver_stock": True})
    assert r.status_code == 200 and r.json()["stock_devuelto"] is True
    assert devueltos == [(PED, "reembolso")]
    assert ll["mp"]


def test_reembolso_solo_owner_y_admin(monkeypatch):
    ll = _preparar_reembolso(monkeypatch, rol="operador")
    r = cliente.post(f"/api/admin/pedidos/{PED}/reembolsar", headers=AUTH, json={})
    assert r.status_code == 403
    assert ll["mp"] == [] and ll["rpc"] == []


@pytest.mark.parametrize("estado", ["pendiente", "preparacion", "enviada", "cancelada", "reembolsada"])
def test_reembolso_rechaza_estados_no_reembolsables(monkeypatch, estado):
    ll = _preparar_reembolso(monkeypatch, estado=estado)
    r = cliente.post(f"/api/admin/pedidos/{PED}/reembolsar", headers=AUTH, json={})
    assert r.status_code == 409
    assert ll["mp"] == []  # nunca se toca Mercado Pago


def test_reembolso_sin_pago_de_mp_no_llama(monkeypatch):
    ll = _preparar_reembolso(monkeypatch, pago="")
    r = cliente.post(f"/api/admin/pedidos/{PED}/reembolsar", headers=AUTH, json={})
    assert r.status_code == 409 and ll["mp"] == []
    ll = _preparar_reembolso(monkeypatch, pago="../../otra/ruta")
    assert cliente.post(f"/api/admin/pedidos/{PED}/reembolsar", headers=AUTH, json={}).status_code == 409
    assert ll["mp"] == []


def test_reembolso_rechazado_por_mp_no_cambia_el_estado(monkeypatch):
    ll = _preparar_reembolso(monkeypatch, status_mp=400)
    r = cliente.post(f"/api/admin/pedidos/{PED}/reembolsar", headers=AUTH, json={})
    assert r.status_code == 502
    assert ll["rpc"] == []


def test_reembolso_tolera_que_el_webhook_llegue_primero(monkeypatch):
    ll = _preparar_reembolso(monkeypatch)
    estados = iter([[{"id": PED, "estado": "pagada", "mp_payment_id": "123456789"}],
                    [{"estado": "reembolsada"}]])
    monkeypatch.setattr(admin_api, "_sb_get",
                        lambda t, p: [{"id": "uid-1", "rol": "owner"}] if t == "perfiles" else next(estados))

    def rpc_falla(f, a):
        raise admin_api.HTTPException(status_code=409, detail="transición inválida")

    monkeypatch.setattr(admin_api, "_rpc", rpc_falla)
    r = cliente.post(f"/api/admin/pedidos/{PED}/reembolsar", headers=AUTH, json={})
    assert r.status_code == 200 and ll["mp"]


# ----------------------------------------------------------------- emails ---
def test_sin_configuracion_no_envia_nada(monkeypatch):
    assert mailer.habilitado() is False
    assert mailer.notificar_estado({"id": PED, "email": "c@ej.com"}, "pagada") is False


def test_envia_por_resend_cuando_esta_configurado(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "re_test")
    monkeypatch.setenv("MAIL_FROM", "Tienda <tienda@ej.com>")
    monkeypatch.setenv("FRONTEND_URL", "https://tienda.ej")
    enviados = []

    class R:
        status_code = 200

    monkeypatch.setattr(mailer.httpx, "post", lambda url, **kw: (enviados.append((url, kw)) or R()))
    ok = mailer.notificar_estado(
        {"id": PED, "email": "c@ej.com", "nombre": "<b>Ana</b>", "acceso_token": "tok",
         "transportista": "Andreani", "tracking_codigo": "ABC123", "tracking_url": "https://ej.com/t"},
        "enviada")
    assert ok is True
    url, kw = enviados[0]
    assert url == "https://api.resend.com/emails"
    assert kw["headers"]["Authorization"] == "Bearer re_test"
    assert kw["json"]["to"] == ["c@ej.com"]
    cuerpo = kw["json"]["html"]
    assert "HT-AAAAAAAA" in kw["json"]["subject"]
    assert "ABC123" in cuerpo and "Andreani" in cuerpo
    assert "&lt;b&gt;Ana" in cuerpo and "<b>Ana" not in cuerpo  # escapado


def test_un_email_caido_nunca_lanza(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "re_test")
    monkeypatch.setenv("MAIL_FROM", "t@ej.com")

    def cae(*a, **k):
        raise mailer.httpx.ConnectError("sin red")

    monkeypatch.setattr(mailer.httpx, "post", cae)
    assert mailer.notificar_estado({"id": PED, "email": "c@ej.com"}, "entregada") is False


def test_estados_sin_aviso(monkeypatch):
    assert mailer.armar_correo({"id": PED}, "preparacion") is None
    for estado in ("pagada", "enviada", "entregada", "cancelada", "reembolsada"):
        assert mailer.armar_correo({"id": PED}, estado) is not None


def test_cambiar_estado_avisa_al_cliente(monkeypatch):
    _sesion(monkeypatch)
    avisos = []
    monkeypatch.setattr(admin_api, "_rpc", lambda f, a: 2)
    monkeypatch.setattr(admin_api, "_avisar_cliente", lambda pid, estado: avisos.append((pid, estado)))
    r = cliente.post(f"/api/admin/pedidos/{PED}/estado", headers=AUTH, json={"a": "entregada"})
    assert r.status_code == 200 and avisos == [(PED, "entregada")]


# ---------------------------------------------------------------- reportes ---
def test_reporte_excluye_cancelados_y_calcula_ticket_y_top(monkeypatch):
    cap = []
    items = lambda n, pid, c, precio: [{"cantidad": c, "precio": precio, "producto_id": pid,  # noqa: E731
                                        "productos": {"nombre": n}}]
    filas = [
        {"estado": "pagada", "total_centavos": 100000, "created_at": "2026-10-24T01:30:00+00:00",
         "orden_items": items("Mouse", "p1", 2, 500.0)},
        {"estado": "entregada", "total_centavos": 300000, "created_at": "2026-10-23T15:00:00+00:00",
         "orden_items": items("Mouse", "p1", 1, 500.0) + items("Teclado", "p2", 1, 2500.0)},
        {"estado": "cancelada", "total_centavos": 999999, "created_at": "2026-10-23T15:00:00+00:00",
         "orden_items": items("Mouse", "p1", 50, 500.0)},
    ]
    _sesion(monkeypatch)
    monkeypatch.setattr(admin_api, "_sb_get",
                        lambda t, p: [{"id": "uid-1", "rol": "owner"}] if t == "perfiles" else (cap.append(p) or filas))
    r = cliente.get("/api/admin/reportes/ventas?desde=2026-10-01&hasta=2026-10-24", headers=AUTH)
    d = r.json()
    assert d["pedidos"] == 2 and d["total_centavos"] == 400000
    assert d["ticket_promedio_centavos"] == 200000
    assert d["por_estado"]["cancelada"] == 1
    # 01:30 UTC del 24 cuenta como 23 en Argentina: los dos pedidos caen el mismo día.
    assert d["por_dia"] == [{"dia": "2026-10-23", "pedidos": 2, "total_centavos": 400000}]
    assert d["top_productos"][0] == {"producto_id": "p1", "nombre": "Mouse", "unidades": 3,
                                     "total_centavos": 150000}
    assert cap[0]["and"].startswith("(created_at.gte.2026-10-01T00:00:00-03:00")
