// Formato de montos en pesos argentinos. Los precios de catálogo son
// enteros; las cuotas pueden tener centavos (se redondea hacia arriba para
// no mostrar una cuota menor a la real).
const SIN_DECIMALES = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});
const CON_DECIMALES = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Intl separa "$" y el número con un espacio duro; el sitio usa "$520.000".
const pegado = (texto) => texto.replace(/^\$\s/u, "$");

export function formatearPesos(valor) {
  return pegado(SIN_DECIMALES.format(Number(valor) || 0));
}

/** Precio con un porcentaje de descuento, redondeado al peso. */
export function precioConDescuento(precio, porcentaje) {
  const base = Number(precio) || 0;
  const pct = Math.min(100, Math.max(0, Number(porcentaje) || 0));
  return Math.round((base * (100 - pct)) / 100);
}

export function formatearCuota(total, cuotas) {
  const n = Number(cuotas) || 1;
  const centavos = Math.ceil((Math.round((Number(total) || 0) * 100)) / n);
  return pegado(
    centavos % 100 === 0
      ? SIN_DECIMALES.format(centavos / 100)
      : CON_DECIMALES.format(centavos / 100)
  );
}
