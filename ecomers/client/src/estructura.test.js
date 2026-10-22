import { readdirSync } from "node:fs";
import { dirname, extname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const SRC = dirname(fileURLToPath(import.meta.url));
const EXTENSIONES = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx", ".json"]);

function archivos(dir = SRC, salida = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) archivos(ruta, salida);
    else if (EXTENSIONES.has(extname(e.name))) salida.push(ruta);
  }
  return salida;
}

describe("estructura de src", () => {
  // Windows no distingue mayúsculas y Vite prueba ".js" antes que ".jsx":
  // con Compras.jsx + compras.js, import("./Compras") cargaba el .js (sin
  // export por defecto) y tiraba abajo el panel en desarrollo y en builds
  // hechos en Windows. En Linux andaba, así que nadie lo veía.
  test("ningún par de archivos de la misma carpeta comparte nombre base (sin distinguir mayúsculas)", () => {
    const porNombre = new Map();
    for (const ruta of archivos()) {
      const clave = join(dirname(ruta), basename(ruta, extname(ruta))).toLowerCase();
      porNombre.set(clave, [...(porNombre.get(clave) ?? []), ruta.slice(SRC.length + 1)]);
    }
    const choques = [...porNombre.values()].filter((v) => v.length > 1).map((v) => v.join(" <-> "));
    expect(choques).toEqual([]);
  });
});
