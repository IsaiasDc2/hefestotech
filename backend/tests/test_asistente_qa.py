"""Las conversaciones de QA (docs/QA-ASISTENTE.md) como tests."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from asistente import datos, router  # noqa: E402
from qa_asistente import CASOS, correr, fallas, preparar  # noqa: E402

cliente = TestClient(main.app)


@pytest.fixture(autouse=True)
def entorno(monkeypatch):
    preparar(monkeypatch)
    yield
    router.usar_proveedor(None)
    datos.usar_fuente(None)


def test_hay_al_menos_30_conversaciones():
    assert len(CASOS) >= 30
    assert len({c.id for c in CASOS}) == len(CASOS)


@pytest.mark.parametrize("caso", CASOS, ids=[c.id for c in CASOS])
def test_conversacion(caso):
    resultado = correr(caso, cliente)
    assert fallas(caso, resultado) == [], resultado.texto
