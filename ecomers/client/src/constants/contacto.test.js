import { describe, expect, test } from "vitest";
import { EMAIL_CONTACTO, EMAIL_URL } from "./contacto";

describe("correo oficial de la tienda", () => {
  test("es el Gmail confirmado por el dueño", () => {
    expect(EMAIL_CONTACTO).toBe("Hefestotech077@gmail.com");
  });

  test("el enlace mailto no lleva espacios ni mayúsculas raras", () => {
    expect(EMAIL_URL).toBe(`mailto:${EMAIL_CONTACTO}`);
    expect(EMAIL_CONTACTO).not.toMatch(/\s/);
  });
});
