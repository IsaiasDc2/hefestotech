import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { TRANSICIONES_PEDIDO, esDestructivo, siguientesEstados } from "./pedidosUtil";

const sql = readFileSync(
  new URL("../../../../../supabase/migrations/005_admin_infra.sql", import.meta.url),
  "utf8"
);

// Lee las reglas `when de = 'x' and a in ('y','z') then true` de la función SQL.
function transicionesDelSql() {
  const bloque = sql.slice(sql.indexOf("function public.pedido_transicion_ok"), sql.indexOf("end;\n$$;"));
  const reglas = {};
  for (const m of bloque.matchAll(/de\s*=\s*'(\w+)'\s+and\s+a\s+in\s*\(([^)]*)\)\s+then\s+true/g)) {
    reglas[m[1]] = [...m[2].matchAll(/'(\w+)'/g)].map((x) => x[1]);
  }
  return reglas;
}

describe("transiciones de pedido", () => {
  test("coinciden con la función SQL pedido_transicion_ok", () => {
    const delSql = transicionesDelSql();
    expect(Object.keys(delSql).length).toBeGreaterThan(3);
    for (const [de, destinos] of Object.entries(TRANSICIONES_PEDIDO)) {
      expect([...destinos].sort(), de).toEqual([...(delSql[de] ?? [])].sort());
    }
  });

  test("un pedido pendiente se puede cancelar y uno cancelado no ofrece nada", () => {
    expect(siguientesEstados("pendiente")).toContain("cancelada");
    expect(siguientesEstados("cancelada")).toEqual([]);
    expect(siguientesEstados("estado-desconocido")).toEqual([]);
  });

  test("cancelar y reembolsar piden más cuidado", () => {
    expect(esDestructivo("cancelada")).toBe(true);
    expect(esDestructivo("reembolsada")).toBe(true);
    expect(esDestructivo("pagada")).toBe(false);
  });
});
