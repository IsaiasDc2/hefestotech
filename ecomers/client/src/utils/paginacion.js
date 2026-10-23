/**
 * HefestoTech · lógica pura de paginación (tienda y panel admin).
 * Sin React ni estilos: cada lado pinta el control con sus propias clases.
 */

export const totalPaginas = (total, por) => {
  const t = Math.max(0, Number(total) || 0);
  const p = Math.max(1, Number(por) || 1);
  return Math.max(1, Math.ceil(t / p));
};

/** Mantiene la página dentro de 1..totalPaginas (links viejos, filtros que achican). */
export const paginaValida = (pagina, total, por) => {
  const n = Number.parseInt(String(pagina ?? ""), 10);
  const base = Number.isFinite(n) && n > 0 ? n : 1;
  return Math.min(base, totalPaginas(total, por));
};

/** Posición de la página en la lista: 1-based, desde/hasta inclusivos. */
export const rangoVisible = (pagina, por, total) => {
  const t = Math.max(0, Number(total) || 0);
  if (t === 0) return { desde: 0, hasta: 0 };
  const desde = (pagina - 1) * por + 1;
  return { desde, hasta: Math.min(pagina * por, t) };
};

/**
 * Números a mostrar: siempre la primera y la última, la actual con `vecinas`
 * a cada lado, y "…" donde hay huecos. Ej: [1, "…", 4, 5, 6, "…", 20].
 */
export function paginasVisibles(actual, cantidad, vecinas = 1) {
  if (cantidad <= 1) return [1];
  const set = new Set([1, cantidad]);
  for (let i = actual - vecinas; i <= actual + vecinas; i += 1) {
    if (i >= 1 && i <= cantidad) set.add(i);
  }
  // Con pocas páginas, mostrar todas es más claro que "1 … 3".
  const orden = [...set].sort((a, b) => a - b);
  const salida = [];
  for (let i = 0; i < orden.length; i += 1) {
    if (i > 0) {
      const salto = orden[i] - orden[i - 1];
      if (salto === 2) salida.push(orden[i] - 1);
      else if (salto > 2) salida.push("…");
    }
    salida.push(orden[i]);
  }
  return salida;
}
