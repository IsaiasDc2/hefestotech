/* HefestoTech · filtros puros del catálogo (sin React, sin estado).
   Regla de visibilidad: (categoría "Todas" o igual) Y (sin marcas o incluida)
   Y texto incluido en nombre+marca, case y acento-insensible (NFD). */

export function normalizar(texto) {
  return (texto ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function coincideTexto(producto, consulta) {
  const q = normalizar(consulta).trim();
  if (!q) return true;
  const hay = normalizar(`${producto?.nombre ?? ""} ${producto?.marca ?? ""}`);
  return hay.includes(q);
}

/* Subconjunto visible según los tres filtros combinados. */
export function filtrar(productos = [], { textoDif = "", categoria = "Todas", marcas = [] } = {}) {
  const set = new Set(Array.isArray(marcas) ? marcas : []);
  return (productos ?? []).filter((p) => {
    const okCategoria = categoria === "Todas" || p?.categoria === categoria;
    const okMarca = set.size === 0 || set.has(p?.marca);
    return okCategoria && okMarca && coincideTexto(p, textoDif);
  });
}

/* Conteos por categoría IGNORANDO la categoría elegida (aplican texto+marcas).
   Clave: valor de categoría tal cual viene en producto.categoria. */
export function contarCategorias(productos = [], { texto = "", marcas = [] } = {}) {
  const set = new Set(Array.isArray(marcas) ? marcas : []);
  const conteos = {};
  for (const p of productos ?? []) {
    if (set.size > 0 && !set.has(p?.marca)) continue;
    if (!coincideTexto(p, texto)) continue;
    const cat = p?.categoria ?? "General";
    conteos[cat] = (conteos[cat] ?? 0) + 1;
  }
  return conteos;
}

/* Conteos por marca IGNORANDO las marcas elegidas (aplican texto+categoría).
   Clave: producto.marca. Las marcas vacías no se cuentan. */
export function contarMarcas(productos = [], { texto = "", categoria = "Todas" } = {}) {
  const conteos = {};
  for (const p of productos ?? []) {
    if (categoria !== "Todas" && p?.categoria !== categoria) continue;
    if (!coincideTexto(p, texto)) continue;
    const marca = (p?.marca ?? "").trim();
    if (!marca) continue;
    conteos[marca] = (conteos[marca] ?? 0) + 1;
  }
  return conteos;
}

/* Todas las marcas del catálogo con su conteo, ordenadas desc (empate: A-Z es). */
export function extraerMarcas(productos = []) {
  const conteos = {};
  for (const p of productos ?? []) {
    const marca = (p?.marca ?? "").trim();
    if (!marca) continue;
    conteos[marca] = (conteos[marca] ?? 0) + 1;
  }
  return Object.entries(conteos)
    .map(([nombre, conteo]) => ({ nombre, conteo }))
    .sort((a, b) => b.conteo - a.conteo || a.nombre.localeCompare(b.nombre, "es"));
}
