import { describe, expect, test } from "vitest";
import catalogo from "../demo/catalogo.json";
import { destacadosProducto } from "./destacados";
import { precioConDescuento } from "./dinero";

describe("precioConDescuento", () => {
  test("aplica el porcentaje y redondea al peso", () => {
    expect(precioConDescuento(2180697, 10)).toBe(1962627);
    expect(precioConDescuento(100000, 10)).toBe(90000);
    expect(precioConDescuento(999, 10)).toBe(899);
  });

  test("es seguro con datos raros", () => {
    expect(precioConDescuento(100, 0)).toBe(100);
    expect(precioConDescuento(100, 150)).toBe(0);
    expect(precioConDescuento("x", 10)).toBe(0);
    expect(precioConDescuento(100, -5)).toBe(100);
  });
});

describe("destacadosProducto", () => {
  const procesador = {
    categoria: "Procesador",
    especificaciones: {
      paisOrigen: "China",
      nucleos: 14,
      hilos: 20,
      socket: "LGA1700",
      frecuenciaTurbo: "5.3GHz",
      cacheL3: "24MB",
    },
  };

  test("respeta el orden de importancia de la categoría y el máximo", () => {
    const items = destacadosProducto(procesador);
    expect(items.map((i) => i.clave)).toEqual(["nucleos", "hilos", "frecuenciaTurbo", "socket"]);
    expect(items[0]).toEqual({ clave: "nucleos", etiqueta: "Núcleos", valor: "14" });
  });

  test("traduce etiquetas y valores en inglés", () => {
    const monitor = {
      categoria: "Monitor",
      especificaciones: { tamanio: "32 pulgadas", resolucion: "2560x1440 (QHD)", tasaRefresco: "240Hz", panel: "VA Curvo 1000R" },
    };
    const items = destacadosProducto(monitor, { idioma: "en" });
    expect(items.map((i) => `${i.etiqueta}=${i.valor}`)).toEqual([
      "Size=32 inches",
      "Resolution=2560x1440 (QHD)",
      "Refresh rate=240Hz",
      "Panel=VA Curved 1000R",
    ]);
  });

  test("completa con otras specs útiles y descarta color, país y textos largos", () => {
    const raro = {
      categoria: "Categoria nueva",
      especificaciones: {
        colorPrincipal: "Negro",
        paisOrigen: "China",
        descripcionLarga: "x".repeat(60),
        potencia: "750W",
        modular: true,
      },
    };
    const items = destacadosProducto(raro, { si: "Yes", no: "No" });
    expect(items.map((i) => i.clave)).toEqual(["potencia", "modular"]);
    expect(items[1].valor).toBe("Yes");
  });

  test("sin especificaciones no devuelve nada", () => {
    expect(destacadosProducto({ categoria: "Monitor" })).toEqual([]);
    expect(destacadosProducto({ categoria: "Monitor", especificaciones: null })).toEqual([]);
    expect(destacadosProducto(null)).toEqual([]);
  });

  test("en todo el catálogo de demo: máximo 4, sin vacíos ni repetidos (solo lo que existe)", () => {
    for (const p of catalogo.productos) {
      const items = destacadosProducto(p);
      expect(items.length, p.nombre).toBeLessThanOrEqual(4);
      expect(new Set(items.map((i) => i.clave)).size, p.nombre).toBe(items.length);
      for (const i of items) {
        expect(i.etiqueta, p.nombre).toBeTruthy();
        expect(i.valor, p.nombre).toBeTruthy();
        expect(p.especificaciones, p.nombre).toHaveProperty(i.clave);
      }
    }
  });

  test("hay datos suficientes en la mayoría del catálogo", () => {
    const conDatos = catalogo.productos.filter((p) => destacadosProducto(p).length >= 2).length;
    expect(conDatos / catalogo.productos.length).toBeGreaterThan(0.85);
  });
});
