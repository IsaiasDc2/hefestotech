"""Tests de seguridad (Fase 2 de la auditoría). Sin red: todo se monkeypatchea.

Correr desde backend/:
    pip install -r requirements-dev.txt
    python -m pytest tests -q
"""
import hashlib
import hmac
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

import admin_api  # noqa: E402
import checkout_api  # noqa: E402
import main  # noqa: E402

cliente = TestClient(main.app)

PRODUCTO = "00000000-0000-0000-0000-000000000001"

PAYLOAD = {
    "items": [{"producto_id": PRODUCTO, "cantidad": 1}],
    "nombre": "Ana",
    "email": "ana@example.com",
    "direccion": "Calle 1",
    "ciudad": "CABA",
    "codigo_postal": "1000",
    "envio": "estandar",
}

# ------------------------------------------------------- superficie de API ---


def test_docs_apagados_por_defecto():
    """En producción no se expone /docs ni /openapi.json (MOSTRAR_DOCS=1 solo
    para desarrollo local)."""
    assert cliente.get("/openapi.json").status_code == 404
    assert cliente.get("/docs").status_code == 404
    assert cliente.get("/redoc").status_code == 404


def test_cabeceras_seguridad_y_raiz_sin_flags():
    r = cliente.get("/")
    assert r.status_code == 200
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
    assert r.headers["referrer-policy"] == "no-referrer"
    assert "strict-transport-security" in r.headers
    assert "env" not in r.json()  # sin MOSTRAR_ENV no revela configuración


def test_limite_de_cuerpo(monkeypatch):
    monkeypatch.setattr(main, "_LIMITE_BODY_BYTES", 10)
    r = cliente.post(
        "/api/contacto", content=b"x" * 11,
        headers={"Content-Type": "application/json"},
    )
    assert r.status_code == 413


# ------------------------------------------------------------- autorización ---


def test_sin_token_no_entra_al_panel():
    r = cliente.get("/api/admin/productos")
    assert r.status_code == 401


def test_cliente_no_entra_al_panel(monkeypatch):
    monkeypatch.setattr(admin_api, "_validar_jwt", lambda bearer: "uid-1")
    monkeypatch.setattr(
        admin_api, "_sb_get",
        lambda tabla, params: [{"id": "uid-1", "rol": "cliente"}],
    )
    r = cliente.get("/api/admin/productos", headers={"Authorization": "Bearer x"})
    assert r.status_code == 403


def test_rol_desconocido_no_entra(monkeypatch):
    monkeypatch.setattr(admin_api, "_validar_jwt", lambda bearer: "uid-1")
    monkeypatch.setattr(
        admin_api, "_sb_get",
        lambda tabla, params: [{"id": "uid-1", "rol": "superadmin_inventado"}],
    )
    r = cliente.get("/api/admin/productos", headers={"Authorization": "Bearer x"})
    assert r.status_code == 403


def test_owner_lista_productos(monkeypatch):
    monkeypatch.setattr(admin_api, "_validar_jwt", lambda bearer: "uid-2")

    def fake_get(tabla, params):
        if tabla == "perfiles":
            return [{"id": "uid-2", "rol": "owner"}]
        return []

    monkeypatch.setattr(admin_api, "_sb_get", fake_get)
    monkeypatch.setattr(admin_api, "_sb_get_total", lambda tabla, params: ([], 0))
    r = cliente.get("/api/admin/productos", headers={"Authorization": "Bearer x"})
    assert r.status_code == 200
    assert r.json()["productos"] == []
    assert r.json()["total"] == 0


# --------------------------------------------------------------- checkout ---


def test_total_calculado_en_servidor(monkeypatch):
    """El cliente no puede imponer precios: total y envío salen de la DB."""
    # Independiente del .env local: el endpoint exige estas variables.
    monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test")
    monkeypatch.setenv("MERCADOPAGO_ACCESS_TOKEN", "test")
    monkeypatch.setenv("BACKEND_URL", "https://api.test")
    monkeypatch.setenv("FRONTEND_URL", "https://front.test")
    capturado = {}

    def fake_get(tabla, params):
        if tabla == "productos":
            return [{
                "id": PRODUCTO, "nombre": "GPU", "precio": 100000,
                "precio_con_descuento": None, "stock": 5,
                "activo": True, "deleted_at": None,
            }]
        return []

    def fake_post(tabla, fila, prefer="return=representation"):
        if tabla == "ordenes":
            capturado["orden"] = fila
            return [{"id": "orden-1"}]
        return []

    monkeypatch.setenv("MERCADOPAGO_ACCESS_TOKEN", "TEST-token")
    monkeypatch.setattr(checkout_api, "_sb_get", fake_get)
    monkeypatch.setattr(checkout_api, "_sb_post", fake_post)
    monkeypatch.setattr(checkout_api, "_sb_patch", lambda *a, **k: [])
    monkeypatch.setattr(checkout_api, "_reservar", lambda *a, **k: None)
    monkeypatch.setattr(
        checkout_api, "_pref_mp",
        lambda *a, **k: "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1",
    )

    # Intento de manipulación: manda precio y total falsos (se ignoran).
    r = cliente.post("/api/checkout/crear",
                     json={**PAYLOAD, "precio": 1, "total": 1})
    assert r.status_code == 201
    subtotal = 100000 * 100  # precio de la DB en centavos
    assert capturado["orden"]["subtotal_centavos"] == subtotal
    assert capturado["orden"]["total_centavos"] == subtotal + checkout_api.ENVIO_ESTANDAR_CENT
    assert r.json()["total_centavos"] == subtotal + checkout_api.ENVIO_ESTANDAR_CENT


def test_idem_no_duplica_orden(monkeypatch):
    """Doble submit con la misma clave: reutiliza la orden existente."""
    creadas = []

    def fake_get(tabla, params):
        if tabla == "ordenes" and params.get("idem_key"):
            return [{
                "id": "orden-existente", "estado": "pendiente",
                "acceso_token": "tok-123", "expira_at": None,
                "costo_envio_centavos": 0, "total_centavos": 9900,
                "mp_preference_id": "42",
                "orden_items": [{
                    "producto_id": PRODUCTO, "cantidad": 1,
                    "precio": 99, "productos": {"nombre": "GPU"},
                }],
            }]
        return []

    def fake_post(*a, **k):
        creadas.append(a)
        return []

    monkeypatch.setattr(checkout_api, "_sb_get", fake_get)
    monkeypatch.setattr(checkout_api, "_sb_post", fake_post)
    monkeypatch.setattr(
        checkout_api, "_pref_mp",
        lambda *a, **k: "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=42",
    )

    r = cliente.post("/api/checkout/crear", json={**PAYLOAD, "idem": "ck-prueba-1"})
    assert r.status_code == 201
    assert r.json()["orden_id"] == "orden-existente"
    assert r.json()["acceso_token"] == "tok-123"
    assert creadas == []  # no se insertó otra orden


def test_idem_invalida_rechazada(monkeypatch):
    r = cliente.post("/api/checkout/crear",
                     json={**PAYLOAD, "idem": "no vale!!!"})
    assert r.status_code == 422


# ---------------------------------------------------------------- pedidos ---


def test_pedido_de_otro_no_visible(monkeypatch):
    monkeypatch.setattr(checkout_api, "_sb_get", lambda t, p: [{
        "id": "o1", "user_id": "otro", "estado": "pendiente",
        "total_centavos": 1, "acceso_token": "abc",
        "subtipo": None, "subtotal_centavos": 1, "descuento_centavos": 0,
        "costo_envio_centavos": 0, "expira_at": None, "mp_payment_id": "",
        "created_at": None, "orden_items": [],
    }])
    monkeypatch.setattr(checkout_api, "_uid_desde_bearer", lambda a: None)
    # Sin sesión del dueño ni token correcto: 404 (no revela existencia).
    r = cliente.get("/api/checkout/estado/o1?token=malo")
    assert r.status_code == 404


def test_pedido_invitado_con_token_correcto(monkeypatch):
    monkeypatch.setattr(checkout_api, "_sb_get", lambda t, p: [{
        "id": "o2", "user_id": None, "estado": "pendiente",
        "subtotal_centavos": 100, "descuento_centavos": 0,
        "costo_envio_centavos": 0, "total_centavos": 100,
        "expira_at": None, "mp_payment_id": "", "created_at": None,
        "acceso_token": "tok-bueno", "orden_items": [],
    }])
    r = cliente.get("/api/checkout/estado/o2?token=malo")
    assert r.status_code == 403
    r = cliente.get("/api/checkout/estado/o2?token=tok-bueno")
    assert r.status_code == 200
    assert r.json()["orden_id"] == "o2"


# ---------------------------------------------------------------- webhook ---


def test_webhook_exige_secreto_y_firma(monkeypatch):
    monkeypatch.delenv("MP_WEBHOOK_SECRET", raising=False)
    r = cliente.post("/api/webhooks/mercadopago?data.id=1&type=payment")
    assert r.status_code == 503  # fail-closed sin secreto

    monkeypatch.setenv("MP_WEBHOOK_SECRET", "secreto-prueba")
    r = cliente.post(
        "/api/webhooks/mercadopago?data.id=1&type=payment",
        headers={"x-signature": "ts=1,v1=mala", "x-request-id": "req1"},
    )
    assert r.status_code == 401  # firma inválida

    # Firma válida pero el pago no existe en MP: se ignora sin tocar nada.
    ts = str(int(time.time()))
    plantilla = f"id:1;request-id:req1;ts:{ts};"
    v1 = hmac.new(b"secreto-prueba", plantilla.encode(), hashlib.sha256).hexdigest()
    monkeypatch.setattr(checkout_api, "_pago_mp", lambda pid: None)
    r = cliente.post(
        "/api/webhooks/mercadopago?data.id=1&type=payment",
        headers={"x-signature": f"ts={ts},v1={v1}", "x-request-id": "req1"},
    )
    assert r.status_code == 200
    assert r.json().get("ignorado") == "pago inexistente en MP"


# -------------------------------------------------------- liberar expiradas ---


def test_liberar_expiradas_fail_closed(monkeypatch):
    monkeypatch.delenv("CRON_SECRET", raising=False)
    monkeypatch.delenv("MP_WEBHOOK_SECRET", raising=False)
    r = cliente.post("/api/checkout/liberar-expiradas")
    assert r.status_code == 503  # sin secreto no se ejecuta

    monkeypatch.setenv("CRON_SECRET", "cron-prueba")
    r = cliente.post("/api/checkout/liberar-expiradas")
    assert r.status_code == 403  # sin cabecera

    monkeypatch.setattr(checkout_api, "_sb_get", lambda t, p: [])
    r = cliente.post("/api/checkout/liberar-expiradas",
                     headers={"x-cron-secret": "cron-prueba"})
    assert r.status_code == 200
    assert r.json()["revisadas"] == 0


# ------------------------------------------------------------------- cuotas ---


def test_cuotas_endpoint_con_cache(monkeypatch):
    monkeypatch.setenv("MERCADOPAGO_ACCESS_TOKEN", "token-prueba")
    llamadas = []

    class FalsaRespuesta:
        def __init__(self, data):
            self._data = data

        def raise_for_status(self):
            pass

        def json(self):
            return self._data

    def fake_get(url, params=None, headers=None, timeout=None):
        llamadas.append(params["payment_method_id"])
        if params["payment_method_id"] == "visa":
            return FalsaRespuesta([{
                "payment_method_id": "visa",
                "payer_costs": [
                    {"installments": 1, "total_amount": 100.0, "installment_amount": 100.0},
                    {"installments": 3, "total_amount": 110.0, "installment_amount": 36.67},
                    {"installments": 12, "total_amount": 160.0, "installment_amount": 13.34},
                ],
            }])
        return FalsaRespuesta([{
            "payment_method_id": "master",
            "payer_costs": [
                {"installments": 3, "total_amount": 130.0, "installment_amount": 43.34},
                {"installments": 6, "total_amount": 120.0, "installment_amount": 20.0},
            ],
        }])

    monkeypatch.setattr(checkout_api.httpx, "get", fake_get)
    checkout_api._CUOTAS_CACHE.clear()

    r = cliente.get("/api/checkout/cuotas?total_centavos=10000")
    assert r.status_code == 200
    opciones = r.json()["opciones"]
    assert [o["cuotas"] for o in opciones] == [3, 6, 12]
    # 3 cuotas: gana el mejor total (visa 110 sobre master 130).
    assert opciones[0]["total_centavos"] == 11000
    assert opciones[0]["sin_interes"] is False
    # 6 cuotas: solo master (120 -> 20 c/u).
    assert opciones[1]["valor_cuota_centavos"] == 2000

    # Segunda llamada con el mismo monto: sale de caché, no pega a MP de nuevo.
    antes = len(llamadas)
    r = cliente.get("/api/checkout/cuotas?total_centavos=10000")
    assert r.status_code == 200
    assert len(llamadas) == antes
    assert r.json()["opciones"] == opciones

    # Monto fuera de rango: rechazado por validación.
    assert cliente.get("/api/checkout/cuotas?total_centavos=0").status_code == 422


def test_cuotas_sin_token(monkeypatch):
    monkeypatch.delenv("MERCADOPAGO_ACCESS_TOKEN", raising=False)
    checkout_api._CUOTAS_CACHE.clear()
    r = cliente.get("/api/checkout/cuotas?total_centavos=10000")
    assert r.status_code == 503


# ------------------------------------------- regresiones de la auditoría ---


def test_estado_invitado_pide_el_token_a_la_db(monkeypatch):
    """F01: el select tiene que traer acceso_token o el invitado nunca entra."""
    def fake_get(tabla, params):
        fila = {
            "id": "o3", "user_id": None, "estado": "pendiente",
            "subtotal_centavos": 100, "descuento_centavos": 0,
            "costo_envio_centavos": 0, "total_centavos": 100,
            "expira_at": None, "mp_payment_id": "", "orden_items": [],
        }
        # Simula PostgREST: solo devuelve las columnas pedidas.
        if "acceso_token" in params.get("select", ""):
            fila["acceso_token"] = "tok-o3"
        return [fila]

    monkeypatch.setattr(checkout_api, "_sb_get", fake_get)
    r = cliente.get("/api/checkout/estado/o3", headers={"X-Orden-Token": "tok-o3"})
    assert r.status_code == 200
    r = cliente.get("/api/checkout/estado/o3?token=tok-o3")
    assert r.status_code == 200


def _orden_cancelada(monkeypatch, patches):
    def fake_get(tabla, params):
        if tabla == "ordenes":
            return [{
                "id": "o4", "user_id": None, "estado": "cancelada",
                "total_centavos": 10_000_00, "costo_envio_centavos": 0,
                "acceso_token": "tok-o4",
                "orden_items": [{"producto_id": PRODUCTO, "cantidad": 2, "precio": 5000}],
            }]
        if tabla == "productos":
            return [{"id": PRODUCTO, "nombre": "GPU", "stock": 9,
                     "activo": True, "deleted_at": None}]
        return []

    def fake_patch(tabla, params, cambios):
        patches.append((params, cambios))
        return [{"id": "o4"}] if params.get("estado") == "eq.cancelada" else []

    monkeypatch.setenv("MERCADOPAGO_ACCESS_TOKEN", "TEST-token")
    monkeypatch.setenv("BACKEND_URL", "https://api.example.test")
    monkeypatch.setattr(checkout_api, "_sb_get", fake_get)
    monkeypatch.setattr(checkout_api, "_sb_patch", fake_patch)


def test_reintento_desde_cancelada_libera_si_falla_mp(monkeypatch):
    """F02: si MP falla después de re-reservar, el stock vuelve y la orden
    queda cancelada (antes quedaba reservado en una orden muerta)."""
    patches, reservas, liberaciones = [], [], []
    _orden_cancelada(monkeypatch, patches)
    monkeypatch.setattr(checkout_api, "_reservar", lambda oid, lin, a: reservas.append(lin))
    monkeypatch.setattr(checkout_api, "_liberar",
                        lambda oid, lin, motivo, a=None: liberaciones.append(lin))

    import mercadopago

    class SdkRoto:
        def __init__(self, *_a):
            pass

        def preference(self):
            raise RuntimeError("MP caído")

    monkeypatch.setattr(mercadopago, "SDK", SdkRoto)
    r = cliente.post("/api/checkout/o4/reintentar", headers={"X-Orden-Token": "tok-o4"})
    assert r.status_code == 502
    assert len(reservas) == 1 and liberaciones == reservas
    assert patches[0][0]["estado"] == "eq.cancelada"  # compare-and-set
    assert patches[-1][1] == {"estado": "cancelada"}


def test_reintento_concurrente_no_reserva_dos_veces(monkeypatch):
    """F02: si otra petición ya tomó la orden, no se reserva de nuevo."""
    patches, reservas = [], []
    _orden_cancelada(monkeypatch, patches)
    monkeypatch.setattr(checkout_api, "_sb_patch", lambda *a, **k: [])  # CAS perdido
    monkeypatch.setattr(checkout_api, "_reservar", lambda *a, **k: reservas.append(a))
    r = cliente.post("/api/checkout/o4/reintentar?token=tok-o4")
    assert r.status_code == 409
    assert reservas == []


def test_checkout_rechaza_email_invalido():
    r = cliente.post("/api/checkout/crear", json={**PAYLOAD, "email": "no-es-un-email"})
    assert r.status_code == 422


def test_imagenes_admin_solo_https_o_internas():
    assert admin_api._url_imagen_ok("https://cdn.example.com/a.webp")
    assert admin_api._url_imagen_ok("/productos/a.webp")
    assert not admin_api._url_imagen_ok("http://cdn.example.com/a.webp")
    assert not admin_api._url_imagen_ok("//evil.example.com/a.webp")
    assert not admin_api._url_imagen_ok("javascript:alert(1)")
