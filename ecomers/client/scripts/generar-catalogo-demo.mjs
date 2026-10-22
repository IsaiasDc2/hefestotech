#!/usr/bin/env node
/**
 * HefestoTech · Genera src/demo/catalogo.json desde las migraciones SQL.
 *
 * El catálogo demo se usa SOLO cuando faltan VITE_SUPABASE_URL /
 * VITE_SUPABASE_PUBLISHABLE_KEY (ver src/components/lib/supabaseClient.js).
 * La fuente de verdad sigue siendo la base: este script solo traduce los
 * seeds (001 y 007) y las specs inferidas (006 y 007) a JSON, para que la
 * tienda se pueda mostrar y probar sin credenciales.
 *
 * Uso (desde ecomers/client):  node scripts/generar-catalogo-demo.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const AQUI = dirname(fileURLToPath(import.meta.url));
const CLIENTE = resolve(AQUI, "..");
const MIGRACIONES = resolve(CLIENTE, "../../supabase/migrations");
const PUBLICO = join(CLIENTE, "public");
const SALIDA = join(CLIENTE, "src/demo/catalogo.json");

const leer = (archivo) => readFileSync(join(MIGRACIONES, archivo), "utf8");

/* ---------- Tokenizador mínimo de tuplas SQL ---------- */
// Recorre `('a', 'b''c', 123, true, '{...}'::jsonb), (...)` y devuelve
// arrays de valores JS. Alcanza para los seeds de este repo (sin
// subconsultas ni funciones dentro de VALUES).
function parsearTuplas(sql) {
  const filas = [];
  let i = 0;
  const n = sql.length;
  while (i < n) {
    if (sql[i] !== "(") {
      i += 1;
      continue;
    }
    i += 1;
    const fila = [];
    let cerrada = false;
    while (i < n && !cerrada) {
      const c = sql[i];
      if (/\s|,/.test(c)) {
        i += 1;
      } else if (c === "'") {
        let valor = "";
        i += 1;
        while (i < n) {
          if (sql[i] === "'" && sql[i + 1] === "'") {
            valor += "'";
            i += 2;
          } else if (sql[i] === "'") {
            i += 1;
            break;
          } else {
            valor += sql[i];
            i += 1;
          }
        }
        if (sql.startsWith("::jsonb", i)) {
          i += "::jsonb".length;
          fila.push(JSON.parse(valor));
        } else {
          fila.push(valor);
        }
      } else if (c === ")") {
        i += 1;
        cerrada = true;
      } else {
        let token = "";
        while (i < n && !/[,)\s]/.test(sql[i])) {
          token += sql[i];
          i += 1;
        }
        if (token === "true" || token === "false") fila.push(token === "true");
        else if (token === "null") fila.push(null);
        else fila.push(Number(token));
      }
    }
    filas.push(fila);
  }
  return filas;
}

function bloqueValues(sql, encabezado) {
  const inicio = sql.indexOf(encabezado);
  if (inicio < 0) throw new Error(`No se encontró: ${encabezado}`);
  const desde = sql.indexOf("values", inicio) + "values".length;
  const hasta = sql.indexOf("on conflict", desde);
  return sql.slice(desde, hasta);
}

/* ---------- Productos ---------- */
const sql001 = leer("001_productos.sql");
const sql007 = leer("007_nuevos_productos.sql");

const base = parsearTuplas(
  bloqueValues(
    sql001,
    "insert into productos (nombre, marca, precio, stock, descripcion, categoria, especificaciones)"
  )
).map(([nombre, marca, precio, stock, descripcion, categoria, especificaciones]) => ({
  nombre,
  marca,
  precio,
  stock,
  descripcion,
  categoria,
  especificaciones,
  imagen: "",
  codigo: null,
}));

// Códigos HT-0001… en orden alfabético, igual que el UPDATE de 001.
[...base]
  .sort((a, b) => (a.nombre < b.nombre ? -1 : a.nombre > b.nombre ? 1 : 0))
  .forEach((p, idx) => {
    p.codigo = `HT-${String(idx + 1).padStart(4, "0")}`;
  });

const nuevos = parsearTuplas(bloqueValues(sql007, "insert into productos")).map(
  ([codigo, nombre, marca, precio, stock, descripcion, categoria, imagen, especificaciones]) => ({
    codigo,
    nombre,
    marca,
    precio,
    stock,
    descripcion,
    categoria,
    imagen,
    especificaciones,
  })
);

// Ofertas y destacados: mismos nombres que los UPDATE de 001.
const listaNombres = (sql, marcador) => {
  const tramo = sql.slice(sql.indexOf(marcador));
  const inicio = tramo.indexOf("where nombre in (") + "where nombre in (".length;
  const fin = tramo.indexOf(");", inicio);
  return parsearTuplas(`(${tramo.slice(inicio, fin)})`)[0];
};
const OFERTAS = new Set(listaNombres(sql001, "-- ============ OFERTAS"));
const DESTACADOS = new Set(listaNombres(sql001, "-- ============ DESTACADOS"));

/* ---------- Imágenes ---------- */
// 1) Derivado local optimizado (funciona sin internet).
// 2) Si no hay local, la URL pública del bucket registrada en la auditoría.
const csv = readFileSync(join(PUBLICO, "productos-optimizados/auditoria-bucket.csv"), "utf8")
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((linea) => linea.split(","));
const imagenPorNombre = new Map(csv.map((c) => [c[0], { archivo: c[2], url: c[3] }]));

function resolverImagen(p) {
  if (p.imagen?.startsWith("NUEVO/")) {
    const archivo = p.imagen.slice("NUEVO/".length);
    return existsSync(join(PUBLICO, "productos-optimizados/nuevos", archivo))
      ? `productos-optimizados/nuevos/${archivo}`
      : "";
  }
  const hit = imagenPorNombre.get(p.nombre);
  if (!hit) return "";
  if (existsSync(join(PUBLICO, "productos-optimizados/resubir", hit.archivo))) {
    return `productos-optimizados/resubir/${hit.archivo}`;
  }
  return hit.url || "";
}

// UUID estable derivado del código (mismo id en cada regeneración).
function uuidDesde(texto) {
  const h = createHash("sha1").update(`hefestotech-demo:${texto}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const creado = "2026-10-01T12:00:00.000Z";
const productos = [...base, ...nuevos].map((p) => {
  const oferta = OFERTAS.has(p.nombre);
  return {
    id: uuidDesde(p.codigo),
    codigo: p.codigo,
    nombre: p.nombre,
    descripcion: p.descripcion,
    categoria: p.categoria,
    marca: p.marca,
    precio: p.precio,
    precio_con_descuento: oferta ? Math.round(p.precio * 0.9 * 100) / 100 : null,
    descuento_porcentaje: oferta ? 10 : 0,
    stock: p.stock,
    stock_minimo: 5,
    envio_gratis: false,
    destacado: DESTACADOS.has(p.nombre),
    imagen: resolverImagen(p),
    especificaciones: p.especificaciones ?? {},
    activo: true,
    deleted_at: null,
    created_at: creado,
  };
});

/* ---------- Specs normalizadas para el Armador ---------- */
// En la base entran como inferidas (verified=false) y el motor solo lee
// las verificadas. En modo demo se marcan verified=true para poder
// mostrar el Armador: la etiqueta "demo" de la UI deja claro que no son
// datos confirmados por el comercio.
const idPorNombre = new Map(productos.map((p) => [p.nombre, p.id]));
const reSpec =
  /select id, '([^']+)', '((?:[^']|'')*)'::jsonb, '(?:inferred|manual)', (?:true|false) from productos\s+where nombre = '((?:[^']|'')*)'/g;
const product_specs = [];
for (const sql of [leer("006_specs_iniciales.sql"), sql007]) {
  for (const m of sql.matchAll(reSpec)) {
    const nombre = m[3].replace(/''/g, "'");
    const producto_id = idPorNombre.get(nombre);
    if (!producto_id) continue;
    product_specs.push({
      producto_id,
      clave: m[1],
      valor: JSON.parse(m[2].replace(/''/g, "'")),
      source: "inferred",
      verified: true,
    });
  }
}

const categorias = [...new Set(productos.map((p) => p.categoria))]
  .sort()
  .map((nombre) => ({ id: uuidDesde(`cat:${nombre}`), nombre, descripcion: "" }));

mkdirSync(dirname(SALIDA), { recursive: true });
writeFileSync(
  SALIDA,
  `${JSON.stringify({ generado: creado, productos, categorias, product_specs }, null, 2)}\n`
);
console.log(
  `catalogo.json: ${productos.length} productos, ${categorias.length} categorías, ${product_specs.length} specs, ` +
    `${productos.filter((p) => p.imagen).length} con imagen`
);
