import { beforeEach, describe, expect, test } from "vitest";
import { esCpValido, guardarCp, leerCp } from "./codigoPostal";

const memoria = () => {
  const datos = new Map();
  return {
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => datos.set(k, String(v)),
  };
};

describe("código postal", () => {
  beforeEach(() => {
    globalThis.localStorage = memoria();
  });

  test("valida exactamente 4 dígitos", () => {
    expect(esCpValido("4400")).toBe(true);
    expect(esCpValido(" 4400 ")).toBe(true);
    for (const malo of ["", "440", "44000", "abcd", "44 0", "4400a", null, undefined]) {
      expect(esCpValido(malo), String(malo)).toBe(false);
    }
  });

  test("recuerda solo códigos válidos", () => {
    expect(leerCp()).toBe("");
    guardarCp("abc");
    expect(leerCp()).toBe("");
    guardarCp("4400");
    expect(leerCp()).toBe("4400");
  });

  test("no rompe si el almacenamiento falla", () => {
    globalThis.localStorage = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    };
    expect(leerCp()).toBe("");
    expect(() => guardarCp("4400")).not.toThrow();
  });
});
