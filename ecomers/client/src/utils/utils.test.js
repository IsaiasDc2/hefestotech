import { describe, expect, test } from "vitest";
import { formatearCuota, formatearPesos } from "./dinero";
import { esUrlMP } from "./mercadoPago";

describe("dinero", () => {
  test("pesos sin decimales y con el $ pegado", () => {
    expect(formatearPesos(520000)).toBe("$520.000");
    expect(formatearPesos("no")).toBe("$0");
  });

  test("la cuota se redondea hacia arriba al centavo", () => {
    expect(formatearCuota(520000, 6)).toBe("$86.666,67");
    expect(formatearCuota(520000, 4)).toBe("$130.000");
    expect(formatearCuota(100, 3)).toBe("$33,34");
  });
});

describe("esUrlMP (anti redirección abierta)", () => {
  test.each([
    "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1",
    "https://sandbox.mercadopago.com.ar/checkout",
    "https://mercadopago.com/x",
    "https://articulo.mercadolibre.com/y",
  ])("acepta %s", (url) => expect(esUrlMP(url)).toBe(true));

  test.each([
    "http://www.mercadopago.com.ar/checkout",
    "https://mercadopago.com.ar.evil.example/checkout",
    "https://evilmercadopago.com/x",
    "javascript:alert(1)",
    "no es una url",
  ])("rechaza %s", (url) => expect(esUrlMP(url)).toBe(false));
});
