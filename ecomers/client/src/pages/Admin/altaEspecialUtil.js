// Tipos de alta del catálogo y cálculos de precio para mostrar en el panel.
// El precio que se cobra lo recalcula siempre el backend.
export const TIPOS_ALTA = {
  producto: { etiqueta: "Producto", titulo: "Nuevo producto", categoria: "General" },
  notebook: {
    etiqueta: "Notebook",
    titulo: "Nueva notebook",
    categoria: "Notebook",
    ficha: ["Procesador", "Memoria RAM", "Almacenamiento", "Placa de video", "Pantalla", "Sistema operativo"],
  },
  pc: {
    etiqueta: "PC armada",
    titulo: "Nueva PC armada",
    categoria: "PC Armada",
    componentes: true,
    ficha: ["Uso recomendado", "Sistema operativo", "Garantía"],
  },
  combo: {
    etiqueta: "Combo",
    titulo: "Nuevo combo",
    categoria: "Combo",
    componentes: true,
    descuentoSugerido: 10,
  },
  oferta: { etiqueta: "Oferta", titulo: "Poner en oferta" },
};

/** Tipo de alta según la categoría guardada (para editar). */
export function tipoDeCategoria(categoria) {
  if (categoria === "Notebook") return "notebook";
  if (categoria === "PC Armada") return "pc";
  if (categoria === "Combo") return "combo";
  return "producto";
}

export const centavosDe = (p) => Number(p?.precio_centavos ?? Math.round(Number(p?.precio ?? 0) * 100));

export const precioConDescuento = (precio, descuento) => {
  const p = Number(precio) || 0;
  const d = Math.min(90, Math.max(0, Number(descuento) || 0));
  return Math.round(p * (1 - d / 100) * 100) / 100;
};

