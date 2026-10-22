import { CATEGORIAS, linkCategoria, linkOfertas } from "../../constants/categorias";

// Fila de navegación: solo destinos que existen en el catálogo (antes
// "Notebooks" y "PCs armadas" eran búsquedas que no devolvían nada).
const EN_NAV = [
  "procesadores",
  "placas-de-video",
  "motherboards",
  "memorias",
  "almacenamiento",
  "fuentes",
  "gabinetes",
  "monitores",
  "perifericos",
  "auriculares",
  "coolers",
  "sillas-gamer",
];

export const FILA_CATEGORIAS = [
  { labelKey: "cat.arma", to: "/armar", clave: "armar", tipo: "armar" },
  { labelKey: "cat.outlet", to: linkOfertas, clave: "ofertas", tipo: "ofertas" },
  ...EN_NAV.map((slug) => {
    const c = CATEGORIAS.find((x) => x.slug === slug);
    return { label: c.label, labelKey: `catg.${slug}`, to: linkCategoria(slug), clave: slug, tipo: "categoria" };
  }),
];

export const IDIOMAS = [
  { codigo: "es", etiqueta: "Español" },
  { codigo: "en", etiqueta: "English" },
];

export function esClaveActiva(pathname, search, clave) {
  if (clave === "armar") return pathname === "/armar";
  if (pathname !== "/productos") return false;
  const categoria = (new URLSearchParams(search).get("categoria") || "").toLowerCase();
  if (clave === "ofertas") return categoria === "oferta" || categoria === "ofertas";
  return categoria === clave;
}
