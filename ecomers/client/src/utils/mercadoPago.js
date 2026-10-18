// Anti redirección abierta: solo se navega a dominios oficiales de Mercado
// Pago. Si el backend (o un MITM sin TLS) devuelve otra URL, no se sigue.
const HOSTS_MP = ["mercadopago.com", "mercadopago.com.ar", "mercadolibre.com"];

export function esUrlMP(url) {
  let destino;
  try {
    destino = new URL(url);
  } catch {
    return false;
  }
  const host = destino.hostname.toLowerCase();
  return (
    destino.protocol === "https:" &&
    HOSTS_MP.some((base) => host === base || host.endsWith(`.${base}`))
  );
}
