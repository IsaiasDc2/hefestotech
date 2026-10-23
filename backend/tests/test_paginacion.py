"""Paginación del panel: total exacto desde Content-Range de PostgREST."""
import httpx
import pytest
from fastapi import HTTPException

import admin_api


class _Resp:
    def __init__(self, filas, content_range="", status=200):
        self._filas = filas
        self.headers = {"content-range": content_range} if content_range else {}
        self.status_code = status

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(
                "x", request=httpx.Request("GET", "http://x"),
                response=httpx.Response(self.status_code, json={"message": "boom"}),
            )

    def json(self):
        return self._filas


class _Cliente:
    def __init__(self, resp):
        self.resp = resp
        self.pedidos = []

    def get(self, ruta, params=None, headers=None):
        self.pedidos.append((ruta, params, headers))
        return self.resp


def _con(monkeypatch, resp):
    c = _Cliente(resp)
    monkeypatch.setattr(admin_api, "_client", lambda: c)
    return c


def test_total_sale_del_content_range(monkeypatch):
    c = _con(monkeypatch, _Resp([{"id": 1}, {"id": 2}], "50-51/214"))
    filas, total = admin_api._sb_get_total("ordenes", {"offset": 50, "limit": 2})
    assert total == 214 and len(filas) == 2
    assert c.pedidos[0][2] == {"Prefer": "count=exact"}


def test_total_vacio_con_asterisco(monkeypatch):
    _con(monkeypatch, _Resp([], "*/0"))
    assert admin_api._sb_get_total("ordenes", {}) == ([], 0)


def test_sin_content_range_estima_con_offset(monkeypatch):
    _con(monkeypatch, _Resp([{"id": 1}] * 3))
    _, total = admin_api._sb_get_total("ordenes", {"offset": 10})
    assert total == 13


def test_error_de_supabase_es_502(monkeypatch):
    _con(monkeypatch, _Resp([], status=500))
    with pytest.raises(HTTPException) as e:
        admin_api._sb_get_total("ordenes", {})
    assert e.value.status_code == 502


def test_limites_de_pagina():
    assert admin_api._pag(limit=50, offset=0) == {"limit": 50, "offset": 0}
    assert admin_api._pag(limit=200, offset=400)["offset"] == 400
