import { describe, expect, test } from "vitest";
import {
  aplicarCatalogo,
  cantidadFiltrosActivos,
  coincideBusqueda,
  filtrosAParams,
  leerFiltros,
  ordenar,
} from "./catalogo";

const p = (datos) => ({
  id: datos.nombre,
  marca: "",
  categoria: "Procesador",
  precio: 100,
  precio_con_descuento: null,
  descuento_porcentaje: 0,
  stock: 1,
  destacado: false,
  ...datos,
});

const CATALOGO = [
  p({ nombre: "Ryzen 5 7600", marca: "AMD", precio: 340000 }),
  p({ nombre: "Ryzen 7 9800X3D", marca: "AMD", precio: 0, stock: 0 }),
  p({ nombre: "Core i7 14700K", marca: "Intel", precio: 480000, stock: 0 }),
  p({
    nombre: "RX 7900 XTX",
    marca: "XFX",
    categoria: "Placa de video",
    precio: 1350000,
    precio_con_descuento: 1215000,
    descuento_porcentaje: 10,
  }),
  p({ nombre: "Monitor Gigabyte", marca: "Gigabyte", categoria: "Monitor", precio: 420000 }),
];

const params = (q) => new URLSearchParams(q);

describe("leerFiltros / filtrosAParams", () => {
  test("lee la URL y tolera valores basura", () => {
    const f = leerFiltros(params("categoria=procesadores&marca=AMD,,Intel&min=abc&max=500000&orden=raro&stock=1"));
    expect(f).toMatchObject({
      categoria: "Procesador",
      marcas: ["AMD", "Intel"],
      min: null,
      max: 500000,
      orden: "relevancia",
      stock: true,
    });
  });

  test("invierte un rango de precios cargado al revés", () => {
    const f = leerFiltros(params("min=900&max=100"));
    expect([f.min, f.max]).toEqual([100, 900]);
  });

  test("ida y vuelta conserva los filtros con URLs cortas", () => {
    const f = leerFiltros(params("categoria=ofertas&marca=XFX&orden=menor"));
    const q = filtrosAParams(f);
    expect(q).toEqual({ categoria: "ofertas", marca: "XFX", orden: "menor" });
    expect(leerFiltros(params(q))).toEqual(f);
  });

  test("cuenta filtros activos (rango de precio vale uno)", () => {
    expect(cantidadFiltrosActivos(leerFiltros(params("q=rtx&min=1&max=2&marca=A,B")))).toBe(4);
  });
});

describe("búsqueda", () => {
  test("ignora tildes, mayúsculas y orden de palabras", () => {
    const monitor = p({ nombre: "Monitor Gigabyte AORUS", categoria: "Monitor" });
    expect(coincideBusqueda(monitor, "aorus MONITOR")).toBe(true);
    expect(coincideBusqueda(monitor, "monítor")).toBe(true);
    expect(coincideBusqueda(monitor, "samsung")).toBe(false);
  });
});

describe("aplicarCatalogo", () => {
  test("filtra por precio FINAL (con descuento) y excluye precio a confirmar", () => {
    const { resultados } = aplicarCatalogo(CATALOGO, leerFiltros(params("max=1300000")));
    const nombres = resultados.map((x) => x.nombre);
    expect(nombres).toContain("RX 7900 XTX"); // 1.215.000 con descuento
    expect(nombres).not.toContain("Ryzen 7 9800X3D"); // precio 0
  });

  test("las facetas cuentan sin aplicar su propio filtro", () => {
    const { categorias, marcas } = aplicarCatalogo(CATALOGO, leerFiltros(params("categoria=procesadores&marca=AMD")));
    // Con marca=AMD no hay monitores: la categoría vacía no se ofrece.
    expect(categorias.find((c) => c.value === "Monitor")).toBeUndefined();
    expect(categorias.find((c) => c.value === "Procesador")?.conteo).toBe(2);
    expect(marcas.find((m) => m.nombre === "Intel")?.conteo).toBe(1);
  });

  test("solo con stock y solo ofertas", () => {
    const f = leerFiltros(params("stock=1&ofertas=1"));
    expect(aplicarCatalogo(CATALOGO, f).resultados.map((x) => x.nombre)).toEqual(["RX 7900 XTX"]);
  });
});

describe("ordenar", () => {
  test("menor precio usa el precio final y deja sin precio al final", () => {
    const nombres = ordenar(CATALOGO, "menor").map((x) => x.nombre);
    expect(nombres[0]).toBe("Ryzen 5 7600");
    expect(nombres.at(-1)).toBe("Ryzen 7 9800X3D");
  });

  test("relevancia prioriza comprables: con precio y con stock", () => {
    const nombres = ordenar(CATALOGO, "relevancia").map((x) => x.nombre);
    expect(nombres.indexOf("Core i7 14700K")).toBeGreaterThan(nombres.indexOf("Ryzen 5 7600"));
    expect(nombres.at(-1)).toBe("Ryzen 7 9800X3D");
  });
});
