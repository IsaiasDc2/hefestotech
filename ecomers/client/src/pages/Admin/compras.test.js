import { describe, expect, test } from "vitest";
import { aCentavos, centavosATexto, cuitValido, formatearCuit } from "./compras";

describe("CUIT", () => {
  test("acepta dígito verificador correcto, con o sin guiones", () => {
    expect(cuitValido("20123456786")).toBe(true);
    expect(cuitValido("30-71234567-1")).toBe(true);
  });

  test("rechaza verificador, prefijo o largo incorrectos", () => {
    expect(cuitValido("20123456780")).toBe(false);
    expect(cuitValido("99123456786")).toBe(false);
    expect(cuitValido("2012345678")).toBe(false);
    expect(cuitValido("")).toBe(false);
  });

  test("formatea solo si tiene 11 dígitos", () => {
    expect(formatearCuit("30712345671")).toBe("30-71234567-1");
    expect(formatearCuit("3071")).toBe("3071");
  });
});

describe("montos", () => {
  test("texto en pesos → centavos enteros", () => {
    expect(aCentavos("1.234,56")).toBe(123456);
    expect(aCentavos("1234.5")).toBe(123450);
    expect(aCentavos("0,1")).toBe(10);
    expect(aCentavos("$ 99")).toBe(9900);
    expect(aCentavos("")).toBe(0);
    expect(aCentavos("12,345")).toBe(null);
    expect(aCentavos("abc")).toBe(null);
  });

  test("centavos → texto editable", () => {
    expect(centavosATexto(123456)).toBe("1234,56");
    expect(centavosATexto(5)).toBe("0,05");
  });
});
