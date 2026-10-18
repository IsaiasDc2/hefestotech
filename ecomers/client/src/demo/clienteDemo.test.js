import { describe, expect, test } from "vitest";
import { crearClienteDemo } from "./clienteDemo";

const sb = crearClienteDemo();

describe("cliente demo (PostgREST en memoria)", () => {
  test("lista productos activos con filtros encadenados", async () => {
    const { data, error } = await sb
      .from("productos")
      .select("*")
      .eq("activo", true)
      .is("deleted_at", null)
      .gt("descuento_porcentaje", 0);
    expect(error).toBeNull();
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((p) => p.descuento_porcentaje > 0)).toBe(true);
  });

  test("or + ilike sin distinguir tildes ni mayúsculas", async () => {
    const { data } = await sb
      .from("productos")
      .select("*")
      .or("nombre.ilike.%ryzen%,marca.ilike.%amd%");
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((p) => /ryzen/i.test(p.nombre) || /amd/i.test(p.marca))).toBe(true);
  });

  test("single sin coincidencia devuelve error estilo PGRST116", async () => {
    const { data, error } = await sb.from("productos").select("*").eq("id", "no-existe").single();
    expect(data).toBeNull();
    expect(error.code).toBe("PGRST116");
  });

  test("maybeSingle, order, limit y select de columnas", async () => {
    const { data } = await sb
      .from("productos")
      .select("nombre,precio")
      .order("precio", { ascending: false })
      .limit(3);
    expect(data).toHaveLength(3);
    expect(Object.keys(data[0])).toEqual(["nombre", "precio"]);
    expect(data[0].precio).toBeGreaterThanOrEqual(data[1].precio);
    const nada = await sb.from("productos").select("*").eq("id", "x").maybeSingle();
    expect(nada).toMatchObject({ data: null, error: null });
  });

  test("las escrituras y el login fallan de forma explícita", async () => {
    const escritura = await sb.from("favoritos").upsert({ producto_id: "1" });
    expect(escritura.error.code).toBe("DEMO");
    const login = await sb.auth.signInWithPassword({ email: "a@b.c", password: "x" });
    expect(login.error.code).toBe("DEMO");
    const { data } = await sb.auth.getSession();
    expect(data.session).toBeNull();
  });

  test("devuelve copias: mutar el resultado no altera el catálogo", async () => {
    const { data } = await sb.from("productos").select("*").limit(1);
    data[0].precio = -1;
    const { data: otra } = await sb.from("productos").select("*").eq("id", data[0].id).single();
    expect(otra.precio).not.toBe(-1);
  });
});
