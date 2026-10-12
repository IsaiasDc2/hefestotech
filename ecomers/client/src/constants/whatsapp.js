// HefestoTech · Canal de WhatsApp centralizado.
// El numero 5491112345678 es PLACEHOLDER ("a confirmar" por el dueno).
// No inventar otro destino: todo enlace de WhatsApp debe salir de aca y,
// hasta confirmar el numero real, tratarse como pendiente en qa/interactivos.csv.
export const WHATSAPP_NUMERO = "5491112345678";
export const WHATSAPP_NUMERO_A_CONFIRMAR = true;
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMERO}`;

export function whatsappUrl(texto) {
  const mensaje = String(texto ?? "").trim();
  if (!mensaje) return WHATSAPP_URL;
  return `${WHATSAPP_URL}?text=${encodeURIComponent(mensaje)}`;
}

export default WHATSAPP_URL;
