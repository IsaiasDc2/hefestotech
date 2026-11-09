import { describe, expect, test } from "vitest";
import { WHATSAPP_NUMERO, WHATSAPP_NUMERO_A_CONFIRMAR, WHATSAPP_URL, whatsappUrl, whatsappVisible } from "./whatsapp";

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

  test("el número se muestra legible y los ajenos no se rompen", () => {
    expect(whatsappVisible()).toBe("+54 9 387 502-9222");
    expect(whatsappVisible("5493875029222")).toBe("+54 9 387 502-9222");
    expect(whatsappVisible("123")).toBe("+123");
  });
});
