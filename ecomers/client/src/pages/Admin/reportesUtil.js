// HefestoTech · Admin · utilidades puras de Reportes (exportación CSV).

// Importe en centavos → "1234,56" (coma decimal, sin separador de miles:
// Excel en español lo reconoce como número).
export const centavosAPesosCsv = (centavos) => {
  const n = Math.round(Number(centavos) || 0);
  const signo = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${signo}${Math.trunc(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
};

// Una celda CSV. Separador ";" (Excel es-AR). Los textos que empiezan con
// = + - @ se prefijan con una comilla: evita que Excel los ejecute como
// fórmula (nombres de producto o de cliente vienen de personas).
export function celdaCsv(valor) {
  let texto = String(valor ?? "");
  if (/^[=+\-@\t\r]/.test(texto) && !/^-?\d+([.,]\d+)?$/.test(texto)) texto = `'${texto}`;
  return /[;"\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export const filaCsv = (celdas) => celdas.map(celdaCsv).join(";");

/** Reporte de ventas → texto CSV con BOM para que Excel respete los acentos. */
export function reporteACsv(datos, rango = {}) {
  const lineas = [
    filaCsv(["Reporte de ventas"]),
    filaCsv(["Desde", rango.desde || "inicio", "Hasta", rango.hasta || "hoy"]),
    filaCsv(["Ventas (sin cancelados ni reembolsados)", datos?.pedidos ?? 0]),
    filaCsv(["Total ARS", centavosAPesosCsv(datos?.total_centavos)]),
    filaCsv(["Ticket promedio ARS", centavosAPesosCsv(datos?.ticket_promedio_centavos)]),
    "",
    filaCsv(["Dia", "Ventas", "Total ARS"]),
    ...(datos?.por_dia ?? []).map((d) => filaCsv([d.dia, d.pedidos, centavosAPesosCsv(d.total_centavos)])),
    "",
    filaCsv(["Producto", "Unidades", "Importe bruto ARS"]),
    ...(datos?.top_productos ?? []).map((p) =>
      filaCsv([p.nombre, p.unidades, centavosAPesosCsv(p.total_centavos)])
    ),
    "",
    filaCsv(["Estado", "Pedidos"]),
    ...Object.entries(datos?.por_estado ?? {}).map(([estado, n]) => filaCsv([estado || "-", n])),
  ];
  return `\uFEFF${lineas.join("\r\n")}\r\n`;
}
