import { describe, expect, it } from "vitest";
import { paginaValida, paginasVisibles, rangoVisible, totalPaginas } from "./paginacion";

describe("totalPaginas", () => {
  it("redondea hacia arriba y nunca baja de 1", () => {
    expect(totalPaginas(54, 25)).toBe(3);
    expect(totalPaginas(50, 25)).toBe(2);
    expect(totalPaginas(0, 25)).toBe(1);
    expect(totalPaginas(undefined, 0)).toBe(1);
  });
});

describe("paginaValida", () => {
  it("acota a 1..total y tolera basura", () => {
    expect(paginaValida("3", 54, 25)).toBe(3);
    expect(paginaValida("99", 54, 25)).toBe(3);
    expect(paginaValida("-2", 54, 25)).toBe(1);
    expect(paginaValida("abc", 54, 25)).toBe(1);
    expect(paginaValida(null, 54, 25)).toBe(1);
  });
});

describe("rangoVisible", () => {
  it("devuelve desde/hasta inclusivos", () => {
    expect(rangoVisible(1, 25, 54)).toEqual({ desde: 1, hasta: 25 });
    expect(rangoVisible(3, 25, 54)).toEqual({ desde: 51, hasta: 54 });
    expect(rangoVisible(1, 25, 0)).toEqual({ desde: 0, hasta: 0 });
  });
});

describe("paginasVisibles", () => {
  it("muestra todas si son pocas", () => {
    expect(paginasVisibles(1, 1)).toEqual([1]);
    expect(paginasVisibles(2, 4)).toEqual([1, 2, 3, 4]);
  });
  it("agrega puntos suspensivos en los huecos", () => {
    expect(paginasVisibles(1, 20)).toEqual([1, 2, "…", 20]);
    expect(paginasVisibles(10, 20)).toEqual([1, "…", 9, 10, 11, "…", 20]);
    expect(paginasVisibles(20, 20)).toEqual([1, "…", 19, 20]);
  });
  it("no pone '…' cuando el hueco es de una sola página", () => {
    expect(paginasVisibles(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});
