// Regenera backend/tests/fixtures/motor_paridad.json desde motor.js.
// Correr después de cambiar el motor: npm run paridad:motor
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { construirCasos } from "../src/armador/paridad.js";

const aqui = dirname(fileURLToPath(import.meta.url));
const catalogo = JSON.parse(readFileSync(resolve(aqui, "../src/demo/catalogo.json"), "utf8"));
const destino = resolve(aqui, "../../../backend/tests/fixtures/motor_paridad.json");

const casos = construirCasos(catalogo);
mkdirSync(dirname(destino), { recursive: true });
// Un caso por línea: diffs legibles cuando cambia una regla.
const lineas = casos.map((caso) => JSON.stringify(caso)).join(",\n");
writeFileSync(destino, `{"generado_por": "scripts/generar-paridad-motor.mjs", "casos": [\n${lineas}\n]}\n`);
process.stdout.write(`${casos.length} casos → ${destino}\n`);
