"""Mensajes de error que el admin le muestra al operador.

    python -m pytest tests -q
"""
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import admin_api  # noqa: E402


def _error(estado, cuerpo):
    req = httpx.Request("POST", "http://supabase.test/x")
    return httpx.HTTPStatusError("x", request=req, response=httpx.Response(estado, json=cuerpo, request=req))


def test_valor_duplicado_es_409_con_mensaje_claro_y_sin_nombres_internos():
    exc = admin_api._sb_error(_error(409, {
        "code": "23505",
        "message": 'duplicate key value violates unique constraint "cupones_codigo_key"',
    }))
    assert exc.status_code == 409
    assert exc.detail == "Ya existe un registro con ese código o valor único."
    assert "cupones_codigo_key" not in exc.detail


def test_otros_errores_siguen_siendo_genericos_y_502():
    exc = admin_api._sb_error(_error(500, {"message": 'relation "secreta" does not exist'}))
    assert exc.status_code == 502
    assert "secreta" not in exc.detail
    assert exc.detail.startswith("Operación no disponible")


def test_errores_seguros_conocidos_se_conservan():
    exc = admin_api._sb_error(_error(400, {"message": "stock insuficiente"}))
    assert exc.detail == "stock insuficiente"
