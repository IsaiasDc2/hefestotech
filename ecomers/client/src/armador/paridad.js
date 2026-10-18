/**
 * HefestoTech · Armador · Casos de paridad motor.js ↔ backend/asistente.
 *
 * El asistente (Python) valida compatibilidad con un port de este motor.
 * Estos casos (sintéticos + combinaciones reales del catálogo demo) se
 * guardan con su resultado en backend/tests/fixtures/motor_paridad.json:
 * Vitest verifica que el fixture siga coincidiendo con motor.js y pytest que
 * el port dé exactamente lo mismo. Regenerar: npm run paridad:motor.
 */
import { evaluarBuild } from "./motor.js";
import { adaptarProducto, mapaSpecs } from "./adaptar.js";
import { PASOS, SLOT_MOTOR } from "./pasos.js";

const SLOT_POR_CATEGORIA = new Map(
  PASOS.flatMap((p) => p.categorias.map((c) => [c, p.slot])),
);

/** Build del motor desde ids de producto (misma lógica que usoArmador.js). */
export function buildDesdeIds(ids, catalogo) {
  const specs = mapaSpecs(catalogo.product_specs.filter((s) => s.verified));
  const porId = new Map(catalogo.productos.map((p) => [p.id, p]));
  const build = {};
  for (const id of ids) {
    const prod = porId.get(id);
    const slot = SLOT_POR_CATEGORIA.get(String(prod.categoria).trim().toLowerCase());
    const spec = adaptarProducto({ ...prod, _specs: specs.get(id) ?? {} }, slot);
    const clave = SLOT_MOTOR[slot];
    if (clave === "discos") (build.discos ??= []).push(spec);
    else build[clave] = spec;
  }
  return build;
}

const BASE = () => ({
  cpu: { nombre: "Ryzen 5 7600", socket: "AM5", tdpW: 65, tieneIGPU: true },
  mother: {
    nombre: "ASUS TUF B650-PLUS", socket: "AM5", memoriaTipo: "DDR5",
    ranurasRAM: 4, memoriaMaximaGB: 128, formato: "ATX", puertosM2: 2, puertosSata: 4, chipset: "B650",
  },
  ram: { nombre: "Fury Beast 32GB", tipo: "DDR5", formatoModulo: "DIMM", capacidadGB: 16, modulos: 2 },
  gpu: { nombre: "RTX 4060 Ti", longitudMm: 242, consumoW: 165, fuenteRecomendadaW: 550, conectores8pin: 1 },
  cooler: { nombre: "Hyper 212", tipo: "aire", sockets: ["AM5", "LGA1700"], alturaMm: 159, tdpMaximoW: 150 },
  discos: [{ nombre: "NV2 500GB", tipo: "NVMe" }],
  fuente: { nombre: "RM850", potenciaW: 850, tiene12VHPWR: true, conectores8pin: 4, formato: "ATX" },
  gabinete: {
    nombre: "NZXT H7 Flow", formatosMother: ["ATX", "Micro-ATX", "Mini-ITX"],
    maxGpuMm: 400, maxCoolerMm: 185, radiadorMaxMm: 360, formatosFuente: ["ATX"],
  },
});

function con(cambios) {
  const b = BASE();
  for (const [ruta, valor] of Object.entries(cambios)) {
    const [k, sub] = ruta.split(".");
    if (sub === undefined) {
      if (valor === undefined) delete b[k];
      else b[k] = valor;
    } else if (valor === undefined) delete b[k][sub];
    else b[k][sub] = valor;
  }
  return b;
}

const SINTETICOS = {
  vacio: {},
  sano: BASE(),
  socket_distinto: con({ "mother.socket": "LGA1700" }),
  socket_falta: con({ "cpu.socket": undefined }),
  ram_ddr4_en_ddr5: con({ "ram.tipo": "DDR4" }),
  ram_sodimm: con({ "ram.formatoModulo": "SO-DIMM" }),
  ram_sin_tipo: con({ "ram.tipo": undefined }),
  ram_varios_kits: con({ ram: [
    { nombre: "A", tipo: "DDR5", capacidadGB: 16, modulos: 2 },
    { nombre: "B", tipo: "DDR5", capacidadGB: 32, modulos: 2 },
    { nombre: "C", tipo: "DDR4", capacidadGB: 8 },
  ] }),
  ram_excede_maximo: con({ "ram.capacidadGB": 96, "mother.memoriaMaximaGB": 128 }),
  ram_sin_capacidad: con({ "ram.capacidadGB": undefined }),
  mother_sin_ranuras: con({ "mother.ranurasRAM": undefined, "mother.memoriaMaximaGB": undefined }),
  mother_eatx_en_atx: con({ "mother.formato": "E-ATX", "gabinete.formatosMother": undefined, "gabinete.formato": "ATX" }),
  mother_matx_alias: con({ "mother.formato": "mATX", "gabinete.formatosMother": ["Micro ATX"] }),
  gabinete_sin_formatos: con({ "gabinete.formatosMother": undefined }),
  gpu_larga: con({ "gpu.longitudMm": 420.5 }),
  gpu_sin_largo: con({ "gpu.longitudMm": undefined }),
  cooler_socket_no: con({ "cooler.sockets": ["LGA1700"] }),
  cooler_corto: con({ "cpu.tdpW": 170, "cooler.tdpMaximoW": 150 }),
  cooler_justo: con({ "cpu.tdpW": 140, "cooler.tdpMaximoW": 150 }),
  cooler_alto: con({ "cooler.alturaMm": 190 }),
  liquido_entra: con({ cooler: { nombre: "Kraken", tipo: "liquido", sockets: ["AM5"], radiadorMm: 280, tdpMaximoW: 300 } }),
  liquido_no_entra: con({ cooler: { nombre: "AIO 420", tipo: "AIO", sockets: ["AM5"], radiadorMm: 420, tdpMaximoW: 300 } }),
  discos_varios: con({ discos: [
    { nombre: "N1", tipo: "NVMe" }, { nombre: "N2", tipo: "nvme" }, { nombre: "N3", tipo: "NVMe" },
    { nombre: "S1", tipo: "SATA" }, { tipo: "IDE" }, { nombre: "", tipo: "" },
  ] }),
  discos_sin_slots: con({ "mother.puertosM2": undefined, "mother.puertosSata": undefined,
    discos: [{ nombre: "N1", tipo: "NVMe" }, { nombre: "S1", tipo: "SATA" }] }),
  sin_gpu_con_igpu: con({ gpu: undefined }),
  sin_gpu_serie_f: con({ gpu: undefined, cpu: { nombre: "Intel Core i5 12400F", socket: "LGA1700", tdpW: 65 } }),
  sin_gpu_kf: con({ gpu: undefined, cpu: { nombre: "Core i7 14700KF", socket: "LGA1700", tdpW: 125 } }),
  sin_gpu_desconocido: con({ gpu: undefined, cpu: { nombre: "Ryzen 7 7700", socket: "AM5", tdpW: 65 } }),
  fuente_corta_rec: con({ "fuente.potenciaW": 500 }),
  fuente_corta_estimada: con({ "gpu.consumoW": 450, "gpu.fuenteRecomendadaW": undefined, "fuente.potenciaW": 650 }),
  fuente_justa: con({ "gpu.consumoW": 320, "gpu.fuenteRecomendadaW": 600, "fuente.potenciaW": 650 }),
  fuente_sin_datos: con({ "cpu.tdpW": undefined }),
  fuente_sin_gpu: con({ gpu: undefined }),
  fuente_12vhpwr_no: con({ "gpu.requiere12VHPWR": true, "fuente.tiene12VHPWR": false }),
  fuente_12vhpwr_falta: con({ "gpu.requiere12VHPWR": true, "fuente.tiene12VHPWR": undefined }),
  fuente_8pin_faltan: con({ "gpu.conectores8pin": 3, "fuente.conectores8pin": 2 }),
  fuente_8pin_desconocido: con({ "fuente.conectores8pin": undefined }),
  fuente_sfx_en_atx: con({ "fuente.formato": "SFX" }),
  fuente_sin_formatos: con({ "fuente.formato": undefined, "gabinete.formatosFuente": undefined }),
  gabinete_sin_formatos_fuente: con({ "gabinete.formatosFuente": undefined }),
  bios_intel14_b660: con({ cpu: { nombre: "Intel Core i5 14600K", socket: "LGA1700", tdpW: 125 },
    "mother.socket": "LGA1700", "mother.chipset": "B660" }),
  bios_intel14_b760: con({ cpu: { nombre: "Intel Core i5 14600K", socket: "LGA1700", tdpW: 125 },
    "mother.socket": "LGA1700", "mother.chipset": "B760" }),
  bios_ryzen8000: con({ cpu: { nombre: "Ryzen 5 8600G", socket: "AM5", tdpW: 65 } }),
  bios_sin_chipset: con({ "mother.chipset": undefined }),
  solo_cpu: { cpu: { nombre: "Ryzen 5 7600", socket: "AM5", tdpW: 65 } },
  solo_fuente: { fuente: { potenciaW: 650 } },
};

/** Combinaciones reales: cada par de componentes que una regla compara. */
function combinacionesReales(catalogo) {
  const de = (categoria) =>
    catalogo.productos.filter((p) => String(p.categoria).toLowerCase() === categoria).map((p) => p.id);
  const cpus = de("procesador");
  const mothers = de("motherboard");
  const rams = de("memoria ram");
  const gpus = de("placa de video");
  const discos = de("almacenamiento");
  const coolers = de("cooler");
  const gabinetes = de("gabinete");
  const fuentes = de("fuente");
  const casos = [];
  for (const c of cpus) for (const m of mothers) casos.push([c, m, rams[0], discos[0]]);
  for (const r of rams) for (const m of mothers) casos.push([cpus[0], m, r]);
  for (const g of gpus) for (const gb of gabinetes) for (const f of fuentes) casos.push([cpus[0], g, gb, f]);
  for (const co of coolers) for (const c of cpus) casos.push([c, co, gabinetes[0]]);
  for (const co of coolers) for (const gb of gabinetes) casos.push([cpus[2], co, gb, mothers[1]]);
  for (const d of discos) casos.push([mothers[0], d, discos[1]]);
  for (const c of cpus) casos.push([c, mothers[0], fuentes[1]]);
  return casos;
}

export function construirCasos(catalogo) {
  const casos = Object.entries(SINTETICOS).map(([nombre, build]) => ({
    nombre,
    build,
    esperado: evaluarBuild(build),
  }));
  combinacionesReales(catalogo).forEach((ids, i) => {
    casos.push({ nombre: `real_${i}`, ids, esperado: evaluarBuild(buildDesdeIds(ids, catalogo)) });
  });
  return casos;
}

export function recalcular(caso, catalogo) {
  return evaluarBuild(caso.ids ? buildDesdeIds(caso.ids, catalogo) : caso.build);
}
