// HefestoTech · SEO de build (se ejecuta solo, después de `vite build`).
//
// Por qué existe: la tienda es una SPA en GitHub Pages. Pages responde 404
// a cualquier ruta profunda (/producto/123, /acerca) y recién después el
// JavaScript redirige; los buscadores no indexan páginas que devuelven 404 y
// las redes sociales no ejecutan JavaScript (todas las vistas previas eran
// iguales). Este script genera, a partir de dist/index.html:
//   - un HTML real por producto y por página pública (estado 200) con título,
//     descripción, canonical, Open Graph, Twitter y JSON-LD propios;
//   - sitemap.xml con productos (e imágenes) y categorías;
//   - robots.txt.
// Los datos salen de Supabase con la clave pública (la misma que usa la
// tienda). Si no hay red o variables, genera solo las páginas fijas y avisa:
// nunca rompe el build.
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(raiz, "dist");

function cargarEnv() {
  for (const archivo of [".env.production.local", ".env.local", ".env.production", ".env"]) {
    const ruta = path.join(raiz, archivo);
    if (!existsSync(ruta)) continue;
    for (const linea of readFileSync(ruta, "utf8").split(/\r?\n/)) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const jsonSeguro = (obj) => JSON.stringify(obj).replace(/</g, "\\u003c");

function ponerMeta(html, atributo, nombre, valor) {
  if (!valor) return html;
  const etiqueta = `<meta ${atributo}="${nombre}" content="${esc(valor)}" />`;
  const re = new RegExp(`<meta\\s[^>]*?${atributo}="${nombre}"[^>]*>`);
  return re.test(html) ? html.replace(re, etiqueta) : html.replace("</head>", `    ${etiqueta}\n  </head>`);
}

function categoriasDelCodigo() {
  const fuente = readFileSync(path.join(raiz, "src", "constants", "categorias.js"), "utf8");
  return [...fuente.matchAll(/slug:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*db:\s*"([^"]+)"/g)].map(
    (m) => ({ slug: m[1], label: m[2], db: m[3] })
  );
}

async function obtenerProductos() {
  const url = (process.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");
  const clave = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  if (!url || !clave) {
    console.warn("[seo] Sin VITE_SUPABASE_URL / clave pública: solo páginas fijas.");
    return [];
  }
  const campos =
    "id,codigo,nombre,descripcion,categoria,marca,precio,precio_con_descuento,descuento_porcentaje,stock,imagen";
  const consulta = `${url}/rest/v1/productos?select=${campos}&activo=eq.true&deleted_at=is.null&order=nombre.asc&limit=2000`;
  try {
    const r = await fetch(consulta, {
      headers: { apikey: clave, Authorization: `Bearer ${clave}` },
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const filas = await r.json();
    return filas.map((p) => {
      const precio = Number(p.precio ?? 0);
      const desc = Number(p.descuento_porcentaje ?? 0);
      return {
        ...p,
        precio,
        stock: Number(p.stock ?? 0),
        precio_con_descuento:
          p.precio_con_descuento != null
            ? Number(p.precio_con_descuento)
            : desc > 0
              ? Math.round(precio * (1 - desc / 100))
              : precio,
      };
    });
  } catch (e) {
    console.warn(`[seo] No se pudieron leer los productos (${e.message}): solo páginas fijas.`);
    return [];
  }
}

async function main() {
  cargarEnv();
  const plantillaRuta = path.join(dist, "index.html");
  if (!existsSync(plantillaRuta)) {
    console.warn("[seo] No existe dist/index.html: ¿corrió `vite build`?");
    return;
  }
  const { SITE_URL, DESCRIPCIONES, DESCRIPCION_SITIO, TITULOS, NOMBRE_SITIO, recortarDescripcion } =
    await import("../src/seo/sitio.js");
  const { construirJsonLdProducto } = await import("../src/components/seo/jsonLdProducto.js");

  const base = `/${(process.env.VITE_BASE ?? "/hefestotech/").replace(/^\/+|\/+$/g, "")}/`.replace(/^\/\/$/, "/");
  const imagenSocial = `${SITE_URL}/brand/og-cover.jpg`;

  // Los recursos relativos (./brand/...) se romperían dentro de subcarpetas.
  let plantilla = (await readFile(plantillaRuta, "utf8")).replace(/(href|src)="\.\//g, `$1="${base}`);

  const pesos = (n) => `$${Math.round(n).toLocaleString("es-AR")}`;

  function pagina({ titulo, descripcion, canonical, imagen = imagenSocial, tipo = "website", jsonld, cuerpo }) {
    let html = plantilla.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(titulo)}</title>`);
    html = html.replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${esc(canonical)}" />`);
    html = ponerMeta(html, "name", "description", descripcion);
    html = ponerMeta(html, "property", "og:title", titulo);
    html = ponerMeta(html, "property", "og:description", descripcion);
    html = ponerMeta(html, "property", "og:url", canonical);
    html = ponerMeta(html, "property", "og:image", imagen);
    html = ponerMeta(html, "property", "og:type", tipo);
    html = ponerMeta(html, "name", "twitter:title", titulo);
    html = ponerMeta(html, "name", "twitter:description", descripcion);
    html = ponerMeta(html, "name", "twitter:image", imagen);
    html = ponerMeta(html, "name", "robots", "index, follow");
    if (jsonld) {
      html = html.replace(
        "</head>",
        `    <script type="application/ld+json" data-prerender="jsonld-producto">${jsonSeguro(jsonld)}</script>\n  </head>`
      );
    }
    if (cuerpo) {
      html = html.replace('<div id="root"></div>', `<div id="root"></div>\n    <noscript>${cuerpo}</noscript>`);
    }
    return html;
  }

  const productos = await obtenerProductos();
  const categorias = categoriasDelCodigo();
  const escritas = [];

  async function escribir(rutaRelativa, html) {
    const destino = path.join(dist, ...rutaRelativa.split("/"));
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, html, "utf8");
    escritas.push(rutaRelativa);
  }

  // Páginas fijas. `/` ya es dist/index.html (su SEO está en el HTML base).
  const enlaces = productos
    .map((p) => `<li><a href="${base}producto/${esc(p.id)}">${esc(p.nombre)}</a></li>`)
    .join("");
  for (const ruta of ["/productos", "/armar", "/acerca", "/contactanos"]) {
    const nombre = ruta.slice(1);
    await escribir(
      `${nombre}.html`,
      pagina({
        titulo: TITULOS[ruta],
        descripcion: DESCRIPCIONES[ruta] ?? DESCRIPCION_SITIO,
        canonical: `${SITE_URL}${ruta}`,
        cuerpo:
          ruta === "/productos"
            ? `<main><h1>${esc(TITULOS[ruta])}</h1><ul>${enlaces}</ul></main>`
            : `<main><h1>${esc(TITULOS[ruta])}</h1><p>${esc(DESCRIPCIONES[ruta] ?? DESCRIPCION_SITIO)}</p></main>`,
      })
    );
  }

  // Una página por producto publicado.
  for (const p of productos) {
    const descripcion = recortarDescripcion(
      p.descripcion || `${p.nombre}${p.marca ? ` de ${p.marca}` : ""} en ${NOMBRE_SITIO}.`
    );
    const final = Number(p.precio_con_descuento ?? p.precio ?? 0);
    await escribir(
      `producto/${p.id}.html`,
      pagina({
        titulo: `${p.nombre} | ${NOMBRE_SITIO}`,
        descripcion,
        canonical: `${SITE_URL}/producto/${p.id}`,
        imagen: p.imagen || imagenSocial,
        tipo: "product",
        jsonld: construirJsonLdProducto(p),
        cuerpo:
          `<main><h1>${esc(p.nombre)}</h1>` +
          (p.marca ? `<p>${esc(p.marca)}</p>` : "") +
          (final > 0 ? `<p>${esc(pesos(final))}</p>` : "") +
          (p.descripcion ? `<p>${esc(p.descripcion)}</p>` : "") +
          `<p><a href="${base}productos">Ver catálogo</a></p></main>`,
      })
    );
  }

  // sitemap.xml
  const url = (loc, prioridad, frecuencia, imagenes = []) =>
    `  <url><loc>${esc(loc)}</loc><changefreq>${frecuencia}</changefreq><priority>${prioridad}</priority>` +
    imagenes.map((i) => `<image:image><image:loc>${esc(i)}</image:loc></image:image>`).join("") +
    `</url>`;
  const conProductos = new Set(productos.map((p) => p.categoria));
  const lineas = [
    url(`${SITE_URL}/`, "1.0", "daily"),
    url(`${SITE_URL}/productos`, "0.9", "daily"),
    ...categorias
      .filter((c) => !productos.length || conProductos.has(c.db))
      .map((c) => url(`${SITE_URL}/productos?categoria=${c.slug}`, "0.8", "daily")),
    url(`${SITE_URL}/armar`, "0.8", "weekly"),
    url(`${SITE_URL}/acerca`, "0.5", "monthly"),
    url(`${SITE_URL}/contactanos`, "0.5", "monthly"),
    ...productos.map((p) =>
      url(`${SITE_URL}/producto/${p.id}`, "0.7", "weekly", p.imagen && /^https?:/.test(p.imagen) ? [p.imagen] : [])
    ),
  ];
  await writeFile(
    path.join(dist, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${lineas.join("\n")}\n</urlset>\n`,
    "utf8"
  );

  // robots.txt (en Pages solo rige si el sitio está en la raíz del dominio;
  // la protección efectiva de las páginas privadas es su meta robots noindex).
  const privadas = ["admin", "carrito", "checkout", "cuenta", "pago-exito", "pago-pendiente", "pago-fallido", "pedido/"];
  await writeFile(
    path.join(dist, "robots.txt"),
    `User-agent: *\nAllow: /\n${privadas.map((r) => `Disallow: ${base}${r}`).join("\n")}\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
    "utf8"
  );

  console.log(`[seo] ${escritas.length} páginas (${productos.length} productos), sitemap con ${lineas.length} URLs y robots.txt.`);
}

main().catch((e) => {
  console.warn(`[seo] Omitido por error: ${e.message}`);
});
