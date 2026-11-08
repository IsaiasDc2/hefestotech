"""Fixtures comunes de los tests del backend (sin red).

La matriz de permisos se cachea 60 s por proceso y, por defecto, intenta
leerse de `admin_permisos`. En tests se reemplaza por una matriz vacía para
que caiga al espejo Python: así los fakes de `_sb_get` existentes no reciben
una consulta inesperada. Los tests de `test_sesion_admin.py` la reemplazan a
su vez para probar la matriz dinámica.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import admin_api  # noqa: E402


@pytest.fixture(autouse=True)
def _limpiar_estado_global(monkeypatch):
    admin_api._matriz_cache["valores"] = None
    admin_api._matriz_cache["leida"] = 0.0
    admin_api._registro.clear()
    monkeypatch.setattr(admin_api, "_matriz_desde_db", lambda: {})
    yield


@pytest.fixture(autouse=True)
def _sin_avisos_externos(monkeypatch):
    """Los tests nunca deben usar los webhooks de `backend/.env`.

    `main.py` carga el `.env` real al importarse: sin esto, el hook de n8n
    sale a la red y compite con los `httpx.post` que cada test intercepta.
    Los tests de n8n/mailer cargan sus propias variables con `monkeypatch`.
    """
    for clave in ("N8N_WEBHOOK_BASE_URL", "N8N_WEBHOOK_SECRET",
                  "RESEND_API_KEY", "MAIL_FROM"):
        monkeypatch.delenv(clave, raising=False)
    yield
