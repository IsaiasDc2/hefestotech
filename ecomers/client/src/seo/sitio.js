// HefestoTech · Configuración SEO centralizada.
// - SITE_URL: canónica de producción (GitHub Pages, basename /hefestotech).
// - TITULOS: un título único en ES por ruta (sin inventar secciones:
//   cada texto sale del h1/copy real de la página correspondiente).
// - canonicalPara: canónica absoluta sin query/hash ni barra final
//   (salvo la raíz), derivada de useLocation (basename ya excluido).

export const SITE_URL = "https://IsaiasDc2.github.io/hefestotech";
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

export function canonicalPara(pathname) {
  const limpio = pathname === "/" ? "/" : pathname.replace(/\/+$/, "") || "/";
  return `${SITE_URL}${limpio}`;
}
