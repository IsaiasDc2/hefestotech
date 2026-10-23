// HefestoTech · Configuración SEO centralizada.
// - SITE_URL: canónica de producción (GitHub Pages, basename /hefestotech).
// - TITULOS: un título único en ES por ruta (sin inventar secciones:
//   cada texto sale del h1/copy real de la página correspondiente).
// - canonicalPara: canónica absoluta sin query/hash ni barra final
//   (salvo la raíz), derivada de useLocation (basename ya excluido).

// VITE_SITE_URL permite pasar a un dominio propio sin tocar el código
// (el script de build `generar-seo.mjs` lee la misma variable).
export const SITE_URL = String(
  import.meta.env?.VITE_SITE_URL ??
    globalThis.process?.env?.VITE_SITE_URL ??
    "https://IsaiasDc2.github.io/hefestotech"
).replace(/\/+$/, "");
export const NOMBRE_SITIO = "HefestoTech";

export const TITULOS = {
  "/": "HefestoTech | Hardware, PCs armadas y componentes",
  "/productos": "Productos | HefestoTech",
  "/producto": "Producto | HefestoTech",
  "/acerca": "Acerca de HefestoTech",
  "/contactanos": "Contactanos | HefestoTech",
  "/armar": "Armá tu PC | HefestoTech",
  "/carrito": "Carrito | HefestoTech",
  "/checkout": "Finalizar compra | HefestoTech",
  "/cuenta": "Mi cuenta | HefestoTech",
  "/admin": "Administración | HefestoTech",
  "/reclamo": "Hacer un reclamo | HefestoTech",
  "/pago-exito": "Pago aprobado | HefestoTech",
  "/pago-pendiente": "Pago pendiente | HefestoTech",
  "/pago-fallido": "Pago rechazado | HefestoTech",
  "/pedido": "Tu compra | HefestoTech",
};

export const TITULO_NO_ENCONTRADO = "Nada por acá | HefestoTech";

// Mismos títulos en inglés. /admin no está: el panel es solo en español.
export const TITULOS_EN = {
  "/": "HefestoTech | Hardware, prebuilt PCs and components",
  "/productos": "Products | HefestoTech",
  "/producto": "Product | HefestoTech",
  "/acerca": "About HefestoTech",
  "/contactanos": "Contact us | HefestoTech",
  "/armar": "Build your PC | HefestoTech",
  "/carrito": "Cart | HefestoTech",
  "/checkout": "Checkout | HefestoTech",
  "/cuenta": "My account | HefestoTech",
  "/reclamo": "File a claim | HefestoTech",
  "/pago-exito": "Payment approved | HefestoTech",
  "/pago-pendiente": "Payment pending | HefestoTech",
  "/pago-fallido": "Payment declined | HefestoTech",
  "/pedido": "Your order | HefestoTech",
};

export const TITULO_NO_ENCONTRADO_EN = "Nothing here | HefestoTech";

export function tituloPara(pathname, idioma = "es") {
  const en = idioma === "en";
  const tabla = en ? { ...TITULOS, ...TITULOS_EN } : TITULOS;
  if (tabla[pathname]) return tabla[pathname];
  if (pathname.startsWith("/producto/")) return tabla["/producto"];
  if (pathname.startsWith("/pedido/")) return tabla["/pedido"];
  return en ? TITULO_NO_ENCONTRADO_EN : TITULO_NO_ENCONTRADO;
}

export const DESCRIPCION_SITIO =
  "HefestoTech - tienda argentina de hardware: notebooks, PCs armadas y componentes.";
export const IMAGEN_SOCIAL = `${SITE_URL}/brand/og-cover.jpg`;

// Descripción única por ruta (sin prometer nada que la página no muestre).
export const DESCRIPCIONES = {
  "/": DESCRIPCION_SITIO,
  "/productos":
    "Catálogo de HefestoTech: procesadores, placas de video, memorias, almacenamiento y más componentes de hardware con precios en pesos.",
  "/acerca": "Conocé HefestoTech, la tienda argentina de hardware, PCs armadas y componentes.",
  "/contactanos": "Escribinos a HefestoTech por consultas sobre productos y pedidos.",
  "/armar": "Armá tu PC paso a paso con el configurador de HefestoTech.",
};

// Páginas de uso personal o transaccional: no deben aparecer en buscadores.
export const RUTAS_PRIVADAS = [
  "/carrito",
  "/checkout",
  "/cuenta",
  "/admin",
  "/pago-exito",
  "/pago-pendiente",
  "/pago-fallido",
  "/pedido",
  "/reclamo",
  "/login",
  "/registro",
];

export const esRutaPrivada = (pathname) =>
  RUTAS_PRIVADAS.some((r) => pathname === r || pathname.startsWith(`${r}/`));

export const RUTAS_INDEXABLES = ["/", "/productos", "/armar", "/acerca", "/contactanos"];

export function descripcionPara(pathname) {
  return DESCRIPCIONES[pathname] ?? DESCRIPCION_SITIO;
}

/** Recorta a un largo de snippet sin cortar palabras ni dejar espacios sueltos. */
export function recortarDescripcion(texto, max = 155) {
  const limpio = String(texto ?? "").replace(/\s+/g, " ").trim();
  if (limpio.length <= max) return limpio;
  const corte = limpio.slice(0, max - 1);
  const ultimoEspacio = corte.lastIndexOf(" ");
  return `${(ultimoEspacio > 60 ? corte.slice(0, ultimoEspacio) : corte).replace(/[.,;:\s]+$/, "")}…`;
}

export function canonicalPara(pathname) {
  const limpio = pathname === "/" ? "/" : pathname.replace(/\/+$/, "") || "/";
  return `${SITE_URL}${limpio}`;
}
