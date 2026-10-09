import { linkOfertas } from "../../constants/categorias";

export const FILA_CATEGORIAS = [
  { labelKey: "cat.productos", to: "/productos", clave: "productos" },
  { labelKey: "cat.notebooks", to: "/productos?q=notebook", clave: "notebook" },
  { labelKey: "cat.pcs", to: "/productos?q=pc%20armada", clave: "pc armada" },
  { labelKey: "cat.arma", to: "/productos?q=combo", clave: "combo" },
  { labelKey: "cat.outlet", to: linkOfertas, clave: "outlet" },
];

export const IDIOMAS = [
  { codigo: "es", etiqueta: "Español" },
  { codigo: "en", etiqueta: "English" },
];

export function esClaveActiva(pathname, search, clave) {
  const params = new URLSearchParams(search);
  const categoriaActual = (params.get("categoria") || "").toLowerCase();
  const busquedaActual = (params.get("q") || "").toLowerCase();
  const enProductos = pathname === "/productos";
  if (!enProductos) return false;
  if (clave === "productos") return !categoriaActual && !busquedaActual;
  if (clave === "outlet") {
    return categoriaActual === "oferta" || categoriaActual === "ofertas";
  }
  return busquedaActual === clave;
}
