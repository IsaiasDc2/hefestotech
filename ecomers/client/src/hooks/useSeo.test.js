import { describe, expect, test } from "vitest";
import { seoDeRuta } from "./useSeo";
import { esRutaPrivada, recortarDescripcion, SITE_URL } from "../seo/sitio";

describe("seoDeRuta", () => {
  test("home y páginas públicas se indexan con su descripción", () => {
    const home = seoDeRuta("/");
    expect(home.noindex).toBe(false);
    expect(home.canonical).toBe(`${SITE_URL}/`);
    expect(seoDeRuta("/acerca").descripcion).toMatch(/HefestoTech/);
  });

  test("rutas privadas y desconocidas no se indexan", () => {
    for (const r of ["/admin", "/carrito", "/checkout", "/cuenta", "/pedido/abc", "/pago-exito"]) {
      expect(seoDeRuta(r).noindex).toBe(true);
    }
    expect(seoDeRuta("/ruta-que-no-existe").noindex).toBe(true);
  });

  test("categoría tiene título, descripción y canonical propios", () => {
    const s = seoDeRuta("/productos", "?categoria=procesadores&marca=AMD&orden=menor");
    expect(s.titulo).toBe("Procesadores | HefestoTech");
    expect(s.descripcion).toMatch(/Procesadores/);
    expect(s.canonical).toBe(`${SITE_URL}/productos?categoria=procesadores`);
    expect(s.noindex).toBe(false);
  });

  test("filtros no cambian la canónica; la búsqueda interna no se indexa", () => {
    expect(seoDeRuta("/productos", "?min=100&max=500&por=12").canonical).toBe(`${SITE_URL}/productos`);
    expect(seoDeRuta("/productos", "?q=rtx").noindex).toBe(true);
  });

  test("páginas siguientes se identifican y tienen canonical propia", () => {
    const s = seoDeRuta("/productos", "?categoria=memorias&pagina=2");
    expect(s.titulo).toBe("Memorias - Página 2 | HefestoTech");
    expect(s.canonical).toBe(`${SITE_URL}/productos?categoria=memorias&pagina=2`);
  });

  test("idioma inglés", () => {
    expect(seoDeRuta("/carrito", "", "en").titulo).toBe("Cart | HefestoTech");
    expect(seoDeRuta("/productos", "?pagina=3", "en").titulo).toContain("Page 3");
  });
});

describe("helpers de sitio", () => {
  test("esRutaPrivada", () => {
    expect(esRutaPrivada("/pedido/123")).toBe(true);
    expect(esRutaPrivada("/producto/123")).toBe(false);
    expect(esRutaPrivada("/productos")).toBe(false);
  });

  test("recortarDescripcion no corta palabras y respeta el largo", () => {
    const largo = "palabra ".repeat(60);
    const r = recortarDescripcion(largo, 155);
    expect(r.length).toBeLessThanOrEqual(155);
    expect(r.endsWith("…")).toBe(true);
    expect(r).not.toMatch(/palab…$/);
    expect(recortarDescripcion("  corto \n texto ")).toBe("corto texto");
  });
});
