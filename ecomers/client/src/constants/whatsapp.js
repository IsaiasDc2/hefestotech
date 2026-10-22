// HefestoTech · Canal de WhatsApp centralizado.
// Número confirmado por el dueño: +54 9 387 502-9222 (Salta).
// Sin +, espacios ni guiones: wa.me solo acepta dígitos.
// No inventar otro destino: todo enlace de WhatsApp debe salir de acá.
export const WHATSAPP_NUMERO = "5493875029222";
export const WHATSAPP_NUMERO_A_CONFIRMAR = false;
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMERO}`;

export function whatsappUrl(texto) {
  const mensaje = String(texto ?? "").trim();
  if (!mensaje) return WHATSAPP_URL;
  return `${WHATSAPP_URL}?text=${encodeURIComponent(mensaje)}`;
}

export default WHATSAPP_URL;
