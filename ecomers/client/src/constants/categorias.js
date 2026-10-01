// Mapa único entre lo que muestran los links (slug) y lo que guarda
// la base de datos (db). Evita que "Procesadores" no matchee "Procesador".
export const CATEGORIAS = [
  { slug: "procesadores", label: "Procesadores", db: "Procesador" },
  { slug: "placas-de-video", label: "Placas de video", db: "Placa de video" },
  { slug: "motherboards", label: "Motherboards", db: "Motherboard" },
  { slug: "memorias", label: "Memorias", db: "Memoria RAM" },
  { slug: "almacenamiento", label: "Almacenamiento", db: "Almacenamiento" },
  { slug: "fuentes", label: "Fuentes", db: "Fuente" },
  { slug: "gabinetes", label: "Gabinetes", db: "Gabinete" },
  { slug: "monitores", label: "Monitores", db: "Monitor" },
  { slug: "perifericos", label: "Periféricos", db: "Periferico" },
  { slug: "mousepads", label: "Mousepads", db: "Mousepad" },
  { slug: "coolers", label: "Refrigeración", db: "Cooler" },
  { slug: "auriculares", label: "Auriculares", db: "Auriculares" },
  { slug: "parlantes", label: "Parlantes", db: "Parlantes" },
  { slug: "sillas-gamer", label: "Sillas Gamer", db: "Silla Gamer" },
  { slug: "webcams", label: "Webcams", db: "Webcam" },
  { slug: "ups", label: "UPS", db: "UPS" },
];

export const linkCategoria = (slug) => `/productos?categoria=${slug}`;
export const linkOfertas = `/productos?categoria=ofertas`;

// Resuelve ?categoria=slug|label|valor-db → { db, ofertas }
// "ofertas" activa el modo solo-descuentos en vez de filtrar por texto.
export function resolverCategoria(param) {
  if (!param) return { db: "Todas", ofertas: false };
  const p = param.trim().toLowerCase();
  if (p === "todas") return { db: "Todas", ofertas: false };
  if (p === "oferta" || p === "ofertas") return { db: "Todas", ofertas: true };
  const hit = CATEGORIAS.find(
    (c) => c.slug === p || c.label.toLowerCase() === p || c.db.toLowerCase() === p
  );
  if (hit) return { db: hit.db, ofertas: false };
  return { db: "Todas", ofertas: false };
}
