import { describe, expect, test } from "vitest";
import { celdaCsv, centavosAPesosCsv, reporteACsv } from "./reportesUtil";

describe("centavosAPesosCsv", () => {
  test("formatea con coma decimal", () => {
    expect(centavosAPesosCsv(123456)).toBe("1234,56");
    expect(centavosAPesosCsv(5)).toBe("0,05");
    expect(centavosAPesosCsv(0)).toBe("0,00");
    expect(centavosAPesosCsv(-250)).toBe("-2,50");
    expect(centavosAPesosCsv(undefined)).toBe("0,00");
  });
});

describe("celdaCsv", () => {
  test("escapa separador, comillas y saltos de línea", () => {
    expect(celdaCsv("a;b")).toBe('"a;b"');
    expect(celdaCsv('di "hola"')).toBe('"di ""hola"""');
    expect(celdaCsv("uno\ndos")).toBe('"uno\ndos"');
    expect(celdaCsv("normal")).toBe("normal");
  });
  test("neutraliza fórmulas pero deja pasar números negativos", () => {
    expect(celdaCsv("=HYPERLINK(\"http://x\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(celdaCsv("+54 9 387")).toBe("'+54 9 387");
    expect(celdaCsv("@cmd")).toBe("'@cmd");
    expect(celdaCsv("-2,50")).toBe("-2,50");
    expect(celdaCsv(-3)).toBe("-3");
  });
});

describe("reporteACsv", () => {
  const datos = {
    pedidos: 2,
    total_centavos: 400000,
    ticket_promedio_centavos: 200000,
    por_dia: [{ dia: "2026-10-23", pedidos: 2, total_centavos: 400000 }],
    top_productos: [{ nombre: "=Mouse", unidades: 3, total_centavos: 150000 }],
    por_estado: { pagada: 1, cancelada: 1 },
  };
  test("incluye BOM, resumen, días, productos y estados", () => {
    const csv = reporteACsv(datos, { desde: "2026-10-01", hasta: "2026-10-23" });
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("Total ARS;4000,00");
    expect(csv).toContain("Ticket promedio ARS;2000,00");
    expect(csv).toContain("2026-10-23;2;4000,00");
    expect(csv).toContain("'=Mouse;3;1500,00");
    expect(csv).toContain("cancelada;1");
    expect(csv).toContain("\r\n");
  });
  test("tolera datos vacíos", () => {
    expect(() => reporteACsv(null)).not.toThrow();
  });
});
