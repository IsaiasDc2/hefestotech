import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import catalogo from "../demo/catalogo.json";
import { CATEGORIAS, nombreCategoria, nombreCategoriaDb } from "../constants/categorias";
import { PASOS } from "../armador/pasos";
import { PLANTILLAS_ES_EN, traducirMensaje } from "../armador/mensajesEn";
import { MENSAJES_ERROR_EN, mensajeDeError, traducirError, traducirErrorAuth } from "../utils/errores";
import { ETIQUETAS_EN, nombreSpec, valorSpec } from "../utils/specs";
import { TITULOS, TITULOS_EN, tituloPara } from "../seo/sitio";
import { TEXTO, t } from "./idiomaStore";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), "utf8");

function archivosFuente(dir = SRC, salida = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) archivosFuente(ruta, salida);
    else if (/\.(jsx?|mjs)$/.test(e.name) && !/\.test\./.test(e.name)) salida.push(ruta);
  }
  return salida;
}

describe("diccionario es/en", () => {
  test("ambos idiomas tienen exactamente las mismas claves", () => {
    const es = Object.keys(TEXTO.es).sort();
    const en = Object.keys(TEXTO.en).sort();
    expect(en).toEqual(es);
  });

  test("toda clave pedida con t(idioma, 'x') en el código existe", () => {
    const pedidas = new Map();
    for (const archivo of archivosFuente()) {
      const fuente = readFileSync(archivo, "utf8");
      for (const m of fuente.matchAll(/\btp?\(\s*\w+\s*,\s*["'`]([\w.-]+)["'`]/g)) {
        if (!pedidas.has(m[1])) pedidas.set(m[1], archivo.slice(SRC.length + 1));
      }
    }
    const faltan = [...pedidas].filter(([clave]) => !(clave in TEXTO.es)).map(([c, f]) => `${c} (${f})`);
    expect(faltan).toEqual([]);
  });

  test("los marcadores {x} están en ambos idiomas", () => {
    for (const clave of ["wa.consulta", "wa.precioStock"]) {
      expect(TEXTO.es[clave]).toContain("{producto}");
      expect(TEXTO.en[clave]).toContain("{producto}");
    }
    expect(TEXTO.es["arm.salteamos"]).toContain("{paso}");
    expect(TEXTO.en["arm.salteamos"]).toContain("{paso}");
  });
});

describe("categorías", () => {
  test("cada categoría tiene nombre en español e inglés", () => {
    for (const c of CATEGORIAS) {
      expect(TEXTO.es[`catg.${c.slug}`], c.slug).toBeTruthy();
      expect(TEXTO.en[`catg.${c.slug}`], c.slug).toBeTruthy();
    }
  });

  test("el español conserva el nombre original y el inglés lo traduce", () => {
    for (const c of CATEGORIAS) expect(nombreCategoria(c, "es")).toBe(c.label);
    expect(nombreCategoriaDb("Placa de video", "en")).toBe("Graphics cards");
    expect(nombreCategoriaDb("Periferico", "en")).toBe("Peripherals");
    expect(nombreCategoriaDb("Cosa nueva", "en")).toBe("Cosa nueva");
  });
});

describe("especificaciones en inglés", () => {
  test("toda clave del catálogo tiene etiqueta en inglés", () => {
    const claves = new Set();
    for (const p of catalogo.productos) {
      for (const k of Object.keys(p.especificaciones ?? {})) claves.add(k);
    }
    expect([...claves].filter((k) => !(k in ETIQUETAS_EN))).toEqual([]);
  });

  test("etiquetas y valores", () => {
    expect(nombreSpec("tasaRefresco", "en")).toBe("Refresh rate");
    expect(nombreSpec("tasaRefresco")).toBe("Tasa refresco");
    expect(nombreSpec("claveNuevaDeEjemplo", "en")).toBe("Clave nueva de ejemplo");
    expect(valorSpec("32 pulgadas", { idioma: "en" })).toBe("32 inches");
    expect(valorSpec("3 anios", { idioma: "en" })).toBe("3 years");
    expect(valorSpec("Hasta 18 horas", { idioma: "en" })).toBe("Up to 18 hours");
    expect(valorSpec(["Negro", "Blanco"], { idioma: "en" })).toBe("Black, White");
    expect(valorSpec("32 pulgadas")).toBe("32 pulgadas");
    expect(valorSpec(true, { si: "Yes", no: "No", idioma: "en" })).toBe("Yes");
  });
});

describe("títulos de pestaña", () => {
  test("cada ruta pública tiene título en inglés (el panel /admin queda en español)", () => {
    const rutas = Object.keys(TITULOS).filter((r) => r !== "/admin");
    expect(rutas.filter((r) => !(r in TITULOS_EN))).toEqual([]);
  });

  test("tituloPara respeta el idioma", () => {
    expect(tituloPara("/carrito")).toBe("Carrito | HefestoTech");
    expect(tituloPara("/carrito", "en")).toBe("Cart | HefestoTech");
    expect(tituloPara("/producto/abc", "en")).toBe("Product | HefestoTech");
    expect(tituloPara("/ruta-que-no-existe", "en")).toBe("Nothing here | HefestoTech");
    expect(tituloPara("/admin", "en")).toBe(TITULOS["/admin"]);
  });
});

describe("armador: mensajes del motor en inglés", () => {
  const esqueleto = (s) => s.replace(/\$\{[^}]*\}/g, "{}").replace(/\{\w+\}/g, "{}");
  const MENSAJE_USO_ARMADOR = "Va con lo que ya elegiste.";

  test("cada frase de motor.js tiene plantilla en inglés (y no sobran plantillas)", () => {
    const fuente = leer("../armador/motor.js");
    const literales = [
      ...fuente.matchAll(
        /resultado\(\s*"[a-z_0-9]+",\s*ESTADOS\.\w+,\s*(`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*")/g,
      ),
    ].map((m) => esqueleto(m[1].slice(1, -1)));
    expect(literales.length).toBeGreaterThan(60);

    const plantillas = new Set(PLANTILLAS_ES_EN.map(([es]) => esqueleto(es)));
    expect([...new Set(literales)].filter((l) => !plantillas.has(l))).toEqual([]);

    const delMotor = new Set(literales);
    const sobran = [...plantillas].filter((p) => p !== MENSAJE_USO_ARMADOR && !delMotor.has(p));
    expect(sobran).toEqual([]);
  });

  test("todos los mensajes reales del fixture de paridad se traducen", () => {
    const fixture = JSON.parse(leer("../../../../backend/tests/fixtures/motor_paridad.json"));
    const mensajes = new Set();
    for (const caso of fixture.casos) {
      for (const r of caso.esperado?.resultados ?? []) mensajes.add(r.mensaje);
    }
    expect(mensajes.size).toBeGreaterThan(20);
    const sinTraducir = [...mensajes].filter((m) => {
      const en = traducirMensaje(m, "en");
      return en === m || /[áéíóúñ¿¡]/.test(en);
    });
    expect(sinTraducir).toEqual([]);
  });

  test("datos variables, módulos de RAM y español sin cambios", () => {
    expect(traducirMensaje("El CPU y el mother comparten socket AM5. Van juntos sin drama.", "en")).toBe(
      "The CPU and the motherboard share the AM5 socket. They go together, no drama.",
    );
    expect(traducirMensaje("La RAM (módulo 2) es DDR5 como pide el mother. Bien ahí.", "en")).toBe(
      "The RAM (module 2) is DDR5, just as the motherboard requires. Nice.",
    );
    expect(traducirMensaje('Del disco "sin nombre" no sé si es NVMe o SATA. Sin eso no puedo verificar los slots.', "en")).toContain(
      '"unnamed"',
    );
    const es = "El CPU y el mother comparten socket AM5. Van juntos sin drama.";
    expect(traducirMensaje(es, "es")).toBe(es);
    expect(traducirMensaje("Un texto que el motor no genera", "en")).toBe("Un texto que el motor no genera");
    expect(traducirMensaje("", "en")).toBe("");
  });

  test("cada paso tiene nombre y consecuencia en ambos idiomas, iguales a pasos.js en español", () => {
    for (const p of PASOS) {
      expect(TEXTO.es[`arm.paso.${p.id}`], p.id).toBeTruthy();
      expect(TEXTO.en[`arm.paso.${p.id}`], p.id).toBeTruthy();
      expect(TEXTO.es[`arm.cons.${p.id}`], p.id).toBe(p.consecuencia);
      expect(TEXTO.en[`arm.cons.${p.id}`], p.id).toBeTruthy();
      expect(t("en", `arm.cons.${p.id}`)).not.toBe(p.consecuencia);
    }
  });
});

describe("errores del servidor en inglés", () => {
  test("traduce los conocidos y deja pasar el resto", () => {
    expect(traducirError("Stock insuficiente.", "en")).toBe("Insufficient stock.");
    expect(traducirError("Stock insuficiente.", "es")).toBe("Stock insuficiente.");
    expect(traducirError("Invalid login credentials", "en")).toBe("Invalid login credentials");
    expect(traducirError(undefined, "en")).toBeUndefined();
  });

  test("mensajeDeError nunca devuelve un objeto (422 de FastAPI incluidos)", () => {
    expect(mensajeDeError({ detail: "Stock insuficiente." }, 409)).toBe("Stock insuficiente.");
    expect(
      mensajeDeError(
        { detail: [{ type: "value_error", loc: ["body", "estado"], msg: "Value error, Estado inválido (activo | inactivo)." }] },
        422
      )
    ).toBe("estado: Estado inválido (activo | inactivo).");
    expect(
      mensajeDeError({ detail: [{ loc: ["body", "email"], msg: "a" }, { loc: ["body", "nombre"], msg: "b" }] }, 422)
    ).toBe("email: a · nombre: b");
    expect(mensajeDeError({ detail: { raro: true } }, 500)).toBe("Error 500");
    expect(mensajeDeError({ detail: [] }, 422)).toBe("Error 422");
    expect(mensajeDeError({}, 502)).toBe("Error 502");
    expect(mensajeDeError(undefined, 0)).toBe("Error 0");
  });

  test("los errores de Supabase Auth se muestran en el idioma elegido", () => {
    expect(traducirErrorAuth("Invalid login credentials", "es")).toBe("Email o contraseña incorrectos");
    expect(traducirErrorAuth("Invalid login credentials", "en")).toBe("Incorrect email or password");
    expect(traducirErrorAuth("Email not confirmed", "es")).toContain("Confirmá tu email");
    expect(traducirErrorAuth("User already registered", "en")).toContain("already exists");
    expect(traducirErrorAuth("Password should be at least 6 characters.", "es")).toBe(TEXTO.es["reg.passCorta"]);
    expect(traducirErrorAuth("Failed to fetch", "es")).toContain("conectarnos");
    expect(traducirErrorAuth("Algo que no conocemos", "es")).toBe("Algo que no conocemos");
    expect(traducirErrorAuth(undefined, "es")).toBeUndefined();
  });

  test("cada mensaje de la tabla existe tal cual en el backend o en el cliente", () => {
    const fuentes = [
      leer("../../../../backend/checkout_api.py"),
      leer("../../../../backend/contacto_api.py"),
      leer("../services/orderService.js"),
    ].join("\n");
    const huerfanos = Object.keys(MENSAJES_ERROR_EN).filter((m) => !fuentes.includes(m));
    expect(huerfanos).toEqual([]);
  });
});
