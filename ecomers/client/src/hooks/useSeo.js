import { useEffect } from "react";
import { useLocation } from "react-router";
import { CATEGORIAS, nombreCategoria } from "../constants/categorias";
import {
  IMAGEN_SOCIAL,
  NOMBRE_SITIO,
  TITULO_NO_ENCONTRADO,
  TITULO_NO_ENCONTRADO_EN,
  canonicalPara,
  descripcionPara,
  esRutaPrivada,
  tituloPara,
} from "../seo/sitio";
import useIdiomaStore from "../store/idiomaStore";

function meta(atributo, nombre) {
  let el = document.head.querySelector(`meta[${atributo}="${nombre}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(atributo, nombre);
    document.head.appendChild(el);
  }
  return el;
}

/**
 * Escribe en el <head> todo lo que leen buscadores y redes al compartir:
 * título, descripción, canonical, Open Graph, Twitter y robots.
 */
export function aplicarSeo({
  titulo,
  descripcion,
  canonical,
  imagen = IMAGEN_SOCIAL,
  noindex = false,
  tipo = "website",
}) {
  if (titulo) document.title = titulo;
  if (descripcion) meta("name", "description").setAttribute("content", descripcion);

  if (canonical) {
    let enlace = document.head.querySelector('link[rel="canonical"]');
    if (!enlace) {
      enlace = document.createElement("link");
      enlace.setAttribute("rel", "canonical");
      document.head.appendChild(enlace);
    }
    enlace.setAttribute("href", canonical);
    meta("property", "og:url").setAttribute("content", canonical);
  }

  const par = [
    ["property", "og:title", titulo],
    ["property", "og:description", descripcion],
    ["property", "og:image", imagen],
    ["property", "og:type", tipo],
    ["name", "twitter:title", titulo],
    ["name", "twitter:description", descripcion],
    ["name", "twitter:image", imagen],
  ];
  for (const [attr, nombre, valor] of par) {
    if (valor) meta(attr, nombre).setAttribute("content", valor);
  }

  meta("name", "robots").setAttribute("content", noindex ? "noindex, follow" : "index, follow");
}

/** SEO de una ruta a partir de pathname + query. Pura: no toca el DOM. */
export function seoDeRuta(pathname, search = "", idioma = "es") {
  const limpio = pathname === "/" ? "/" : pathname.replace(/\/+$/, "") || "/";
  let titulo = tituloPara(limpio, idioma);
  let descripcion = descripcionPara(limpio);
  let canonical = canonicalPara(limpio);
  const noEncontrado = titulo === TITULO_NO_ENCONTRADO || titulo === TITULO_NO_ENCONTRADO_EN;
  let noindex = esRutaPrivada(limpio) || noEncontrado;

  if (limpio === "/productos") {
    const params = new URLSearchParams(search);
    const cat = CATEGORIAS.find((c) => c.slug === params.get("categoria"));
    const pagina = Math.max(1, Number.parseInt(params.get("pagina") ?? "1", 10) || 1);
    // Búsquedas internas: útiles para la persona, ruido para el buscador.
    if (params.get("q")) noindex = true;
    const consulta = [];
    if (cat) {
      const nombre = nombreCategoria(cat, idioma);
      titulo = `${nombre} | ${NOMBRE_SITIO}`;
      descripcion =
        idioma === "en"
          ? `${nombre} at ${NOMBRE_SITIO}, Argentine hardware store.`
          : `Catálogo de ${nombre} en ${NOMBRE_SITIO}, tienda argentina de hardware.`;
      consulta.push(`categoria=${cat.slug}`);
    }
    if (pagina > 1) {
      titulo = `${titulo.replace(` | ${NOMBRE_SITIO}`, "")} - ${idioma === "en" ? "Page" : "Página"} ${pagina} | ${NOMBRE_SITIO}`;
      consulta.push(`pagina=${pagina}`);
    }
    // Filtros, orden y tamaño de página no cambian la canónica: así no se
    // reparte la autoridad entre cientos de combinaciones de la misma lista.
    if (consulta.length) canonical = `${canonical}?${consulta.join("&")}`;
  }

  return { titulo, descripcion, canonical, noindex };
}

/** Un solo punto de entrada para App: SEO de la ruta actual. */
export function useSeoRuta() {
  const { pathname, search } = useLocation();
  const idioma = useIdiomaStore((s) => s.idioma);
  useEffect(() => {
    aplicarSeo(seoDeRuta(pathname, search, idioma));
  }, [pathname, search, idioma]);
}

/** SEO propio de una página con datos reales (ficha de producto). */
export function useSeo(opciones) {
  const { titulo, descripcion, canonical, imagen, noindex, tipo } = opciones ?? {};
  const activo = Boolean(opciones);
  useEffect(() => {
    if (!activo) return;
    aplicarSeo({ titulo, descripcion, canonical, imagen, noindex, tipo });
  }, [activo, titulo, descripcion, canonical, imagen, noindex, tipo]);
}

export default useSeoRuta;
