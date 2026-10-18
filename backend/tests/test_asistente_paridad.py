"""El port Python del motor da EXACTAMENTE lo mismo que motor.js.

El fixture lo genera `npm run paridad:motor` (ecomers/client) desde motor.js;
Vitest verifica que siga vigente y acá se compara el port caso por caso.
"""
import json
import sys
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "backend"))

from asistente import compatibilidad as motor  # noqa: E402

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "motor_paridad.json").read_text(encoding="utf-8"))
CATALOGO = json.loads((RAIZ / "ecomers/client/src/demo/catalogo.json").read_text(encoding="utf-8"))
SPECS = motor.mapa_specs([s for s in CATALOGO["product_specs"] if s.get("verified")])
POR_ID = {p["id"]: p for p in CATALOGO["productos"]}


def _build(caso):
    if "build" in caso:
        return caso["build"]
    build, fuera = motor.build_desde_productos([POR_ID[i] for i in caso["ids"]], SPECS)
    assert not fuera
    return build


@pytest.mark.parametrize("caso", FIXTURE["casos"], ids=[c["nombre"] for c in FIXTURE["casos"]])
def test_paridad_con_motor_js(caso):
    assert motor.evaluar_build(_build(caso)) == caso["esperado"]


def test_cobertura_de_reglas():
    reglas = {r["regla"] for c in FIXTURE["casos"] for r in c["esperado"]["resultados"]}
    estados = {(r["regla"], r["estado"]) for c in FIXTURE["casos"] for r in c["esperado"]["resultados"]}
    assert len(reglas) >= 17
    assert sum(1 for _, e in estados if e == motor.ERROR) >= 15
