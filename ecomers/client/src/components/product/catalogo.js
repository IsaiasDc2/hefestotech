/**
 * HefestoTech · Lógica pura del catálogo (/productos).
 *
 * La URL es la única fuente de verdad de los filtros: así un listado
 * filtrado se puede compartir, recargar o abrir desde la home sin estado
 * escondido. Todo lo de acá es puro y está cubierto por catalogo.test.js.
 */
import { CATEGORIAS, resolverCategoria } from "../../constants/categorias";
import { precioFinal } from "../../services/productService";
import { normalizar } from "../filters/filtros";

export const ORDENES = ["relevancia", "menor", "mayor", "descuento", "nombre"];
export const POR_PAGINA = 24;

const entero = (v) => {
  const n = Number.parseInt(String(v ?? "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** URLSearchParams → filtros normalizados (tolera valores basura). */
export function leerFiltros(params) {
  const cat = resolverCategoria(params.get("categoria"));
  const orden = params.get("orden");
  const marcas = (params.get("marca") ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  let min = entero(params.get("min"));
  let max = entero(params.get("max"));
  if (min != null && max != null && min > max) [min, max] = [max, min];
  return {
    q: (params.get("q") ?? "").trim(),
    categoria: cat.db,
    ofertas: cat.ofertas || params.get("ofertas") === "1",
    marcas: [...new Set(marcas)],
    min,
    max,
    stock: params.get("stock") === "1",
    // Compatibilidad con links viejos: ?orden=mayor|menor siguen sirviendo.
    orden: ORDENES.includes(orden) ? orden : "relevancia",
  };
}

/** Filtros → objeto de query (sin claves vacías, URLs cortas). */
export function filtrosAParams(f) {
  const out = {};
  if (f.q) out.q = f.q;
  if (f.categoria && f.categoria !== "Todas") {
    out.categoria = CATEGORIAS.find((c) => c.db === f.categoria)?.slug ?? f.categoria;
  }
  if (f.ofertas) {
    if (out.categoria) out.ofertas = "1";
    else out.categoria = "ofertas";
  }
  if (f.marcas?.length) out.marca = f.marcas.join(",");
  if (f.min != null) out.min = String(f.min);
  if (f.max != null) out.max = String(f.max);
  if (f.stock) out.stock = "1";
  if (f.orden && f.orden !== "relevancia") out.orden = f.orden;
  return out;
}

export const tienePrecio = (p) => precioFinal(p) > 0;

function textoBuscable(p) {
  return normalizar(`${p.nombre ?? ""} ${p.marca ?? ""} ${p.categoria ?? ""} ${p.codigo ?? ""}`);
}

/** Cada palabra de la búsqueda tiene que aparecer (orden libre, sin tildes). */
export function coincideBusqueda(p, q) {
  const palabras = normalizar(q).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return true;
  const hay = textoBuscable(p);
  return palabras.every((w) => hay.includes(w));
}

// Predicados por faceta: cada conteo se calcula aplicando todos los
// filtros MENOS el propio, así el usuario ve cuántos resultados obtiene
// si cambia esa faceta (patrón de facetas "disjuntas").
const predicados = {
  q: (f) => (p) => coincideBusqueda(p, f.q),
  categoria: (f) => (p) => f.categoria === "Todas" || p.categoria === f.categoria,
  ofertas: (f) => (p) => !f.ofertas || Number(p.descuento_porcentaje) > 0,
  marcas: (f) => (p) => f.marcas.length === 0 || f.marcas.includes(p.marca),
  precio: (f) => (p) => {
    if (f.min == null && f.max == null) return true;
    const precio = precioFinal(p);
    if (precio <= 0) return false;
    return (f.min == null || precio >= f.min) && (f.max == null || precio <= f.max);
  },
  stock: (f) => (p) => !f.stock || Number(p.stock) > 0,
};

function filtrarSin(productos, f, excluir) {
  const activos = Object.entries(predicados)
    .filter(([clave]) => clave !== excluir)
    .map(([, crear]) => crear(f));
  return productos.filter((p) => activos.every((ok) => ok(p)));
}

export function ordenar(productos, orden) {
  const lista = [...productos];
  // Sin precio confirmado siempre al final: no se pueden comprar.
  const conPrecio = (a, b) => Number(tienePrecio(b)) - Number(tienePrecio(a));
  const porNombre = (a, b) => String(a.nombre).localeCompare(String(b.nombre), "es");
  const hayStock = (a, b) => Number(b.stock > 0) - Number(a.stock > 0);
  const comparadores = {
    menor: (a, b) => conPrecio(a, b) || precioFinal(a) - precioFinal(b),
    mayor: (a, b) => conPrecio(a, b) || precioFinal(b) - precioFinal(a),
    descuento: (a, b) =>
      conPrecio(a, b) || Number(b.descuento_porcentaje) - Number(a.descuento_porcentaje) || porNombre(a, b),
    nombre: porNombre,
    relevancia: (a, b) =>
      conPrecio(a, b) || hayStock(a, b) || Number(b.destacado) - Number(a.destacado) || porNombre(a, b),
  };
  return lista.sort(comparadores[orden] ?? comparadores.relevancia);
}

/** Resultado + facetas con conteos para pintar el panel. */
export function aplicarCatalogo(productos, f) {
  const resultados = ordenar(filtrarSin(productos, f, null), f.orden);

  const porCategoria = {};
  for (const p of filtrarSin(productos, f, "categoria")) {
    porCategoria[p.categoria] = (porCategoria[p.categoria] ?? 0) + 1;
  }
  const categorias = CATEGORIAS.filter(
    (c) => porCategoria[c.db] || c.db === f.categoria
  ).map((c) => ({ value: c.db, label: c.label, conteo: porCategoria[c.db] ?? 0 }));

  const porMarca = {};
  for (const p of filtrarSin(productos, f, "marcas")) {
    const m = (p.marca ?? "").trim();
    if (m) porMarca[m] = (porMarca[m] ?? 0) + 1;
  }
  for (const m of f.marcas) porMarca[m] ??= 0;
  const marcas = Object.entries(porMarca)
    .map(([nombre, conteo]) => ({ nombre, conteo }))
    .sort((a, b) => b.conteo - a.conteo || a.nombre.localeCompare(b.nombre, "es"));

  const precios = productos.map(precioFinal).filter((n) => n > 0);
  const rangoPrecios = precios.length
    ? { min: Math.min(...precios), max: Math.max(...precios) }
    : { min: 0, max: 0 };

  return {
    resultados,
    categorias,
    marcas,
    rangoPrecios,
    conStock: filtrarSin(productos, f, "stock").filter((p) => p.stock > 0).length,
    enOferta: filtrarSin(productos, f, "ofertas").filter((p) => p.descuento_porcentaje > 0).length,
  };
}

export function cantidadFiltrosActivos(f) {
  return (
    (f.q ? 1 : 0) +
    (f.categoria !== "Todas" ? 1 : 0) +
    (f.ofertas ? 1 : 0) +
    f.marcas.length +
    (f.min != null || f.max != null ? 1 : 0) +
    (f.stock ? 1 : 0)
  );
}
