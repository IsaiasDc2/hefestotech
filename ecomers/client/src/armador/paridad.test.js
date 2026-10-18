import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import catalogo from "../demo/catalogo.json";
import { recalcular } from "./paridad.js";

const fixture = JSON.parse(
  readFileSync(new URL("../../../../backend/tests/fixtures/motor_paridad.json", import.meta.url), "utf8"),
);

describe("paridad motor.js ↔ asistente", () => {
  test("el fixture del backend cubre sintéticos y combinaciones reales", () => {
    expect(fixture.casos.some((c) => c.build)).toBe(true);
    expect(fixture.casos.filter((c) => c.ids).length).toBeGreaterThan(100);
  });

  test("motor.js sigue dando lo que el port de Python verifica (si falla: npm run paridad:motor)", () => {
    const distintos = fixture.casos
      .filter((caso) => JSON.stringify(recalcular(caso, catalogo)) !== JSON.stringify(caso.esperado))
      .map((caso) => caso.nombre);
    expect(distintos).toEqual([]);
  });
});
