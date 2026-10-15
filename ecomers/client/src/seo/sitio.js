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

export function tituloPara(pathname) {
  if (TITULOS[pathname]) return TITULOS[pathname];
  if (pathname.startsWith("/producto/")) return TITULOS["/producto"];
  if (pathname.startsWith("/pedido/")) return TITULOS["/pedido"];
  return TITULO_NO_ENCONTRADO;
}

export function canonicalPara(pathname) {
  const limpio = pathname === "/" ? "/" : pathname.replace(/\/+$/, "") || "/";
  return `${SITE_URL}${limpio}`;
}
