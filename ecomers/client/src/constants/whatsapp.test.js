import { describe, expect, test } from "vitest";
import { WHATSAPP_NUMERO, WHATSAPP_NUMERO_A_CONFIRMAR, WHATSAPP_URL, whatsappUrl } from "./whatsapp";

describe("WhatsApp de la tienda", () => {
  test("el número va en formato wa.me: solo dígitos, con 54 y 9", () => {
    expect(WHATSAPP_NUMERO).toMatch(/^549\d{10}$/);
    expect(WHATSAPP_NUMERO).not.toBe("5491112345678"); // placeholder viejo
    expect(WHATSAPP_URL).toBe(`https://wa.me/${WHATSAPP_NUMERO}`);
    expect(WHATSAPP_NUMERO_A_CONFIRMAR).toBe(false);
  });

  test("el mensaje se codifica y sin texto devuelve el chat pelado", () => {
    expect(whatsappUrl()).toBe(WHATSAPP_URL);
    expect(whatsappUrl("   ")).toBe(WHATSAPP_URL);
    expect(whatsappUrl("Hola, ¿precio?")).toBe(`${WHATSAPP_URL}?text=Hola%2C%20%C2%BFprecio%3F`);
  });
});
