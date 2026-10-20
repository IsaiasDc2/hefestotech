// HefestoTech · Condiciones comerciales que muestra la tienda (una sola fuente
// en el front). Cada una dice de dónde sale:
//  - "checkout": la aplica el servidor al cobrar (backend/checkout_api.py);
//    politicas.test.js falla si el valor de acá se desfasa del backend.
//  - "publicado": figura en el texto del sitio (header, inicio) pero no hay
//    regla en el servidor que la respalde. El dueño debe confirmarla.

// checkout: envío gratis desde este subtotal y tarifas únicas por debajo.
export const UMBRAL_ENVIO_GRATIS = 150000;
export const COSTO_ENVIO_ESTANDAR = 5000;
export const COSTO_ENVIO_EXPRESS = 12000;

/**
 * Costo de envío que cobra el servidor (checkout_api.py): desde el umbral es
 * gratis para cualquier método; por debajo, tarifa única por método.
 */
export function costoEnvio(subtotal, metodo = "estandar") {
  if (Number(subtotal) >= UMBRAL_ENVIO_GRATIS) return 0;
  return metodo === "express" ? COSTO_ENVIO_EXPRESS : COSTO_ENVIO_ESTANDAR;
}

// publicado: "10% off por transferencia". El checkout online solo cobra con
// Mercado Pago: la transferencia se coordina con la tienda por WhatsApp.
export const DESCUENTO_TRANSFERENCIA_PCT = 10;

// publicado: "6 cuotas sin interés con todas las tarjetas".
export const CUOTAS_SIN_INTERES = 6;

// publicado: "Garantía oficial, 12 meses en todos los productos".
export const GARANTIA_MESES = 12;
