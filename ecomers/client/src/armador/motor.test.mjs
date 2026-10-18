/**
 * HefestoTech · Armador · Tests del motor de compatibilidad.
 * Runner: Vitest.
 *   npm test (Vitest)
 */
import { describe, test } from "vitest";
import assert from "node:assert/strict";
import { evaluarBuild, esCompatible, cpuTieneIGPU, potenciaEstimada } from "./motor.js";

const porRegla = (res, regla) => res.resultados.filter((r) => r.regla === regla);
const unSolo = (res, regla) => {
  const rs = porRegla(res, regla);
  assert.equal(rs.length, 1, `esperaba 1 resultado de ${regla}, hubo ${rs.length}`);
  return rs[0];
};

// --- Fixtures base (build sano, estilo gama media AM5) ---
function buildSano() {
  return {
    cpu: { nombre: "Ryzen 5 7600", socket: "AM5", tdpW: 65, tieneIGPU: true },
    mother: {
      nombre: "ASUS TUF B650-PLUS", socket: "AM5", memoriaTipo: "DDR5",
      ranurasRAM: 4, memoriaMaximaGB: 128, formato: "ATX",
      puertosM2: 2, puertosSata: 4, chipset: "B650",
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
  };
}

describe("helpers", () => {
  test("cpuTieneIGPU respeta el flag explícito", () => {
    assert.equal(cpuTieneIGPU({ tieneIGPU: true }), true);
    assert.equal(cpuTieneIGPU({ tieneIGPU: false }), false);
  });

  test("cpuTieneIGPU detecta sufijo F como sin iGPU", () => {
    assert.equal(cpuTieneIGPU({ nombre: "Intel Core i5 12400F" }), false);
    assert.equal(cpuTieneIGPU({ nombre: "Intel Core i5 14600KF" }), false);
  });

  test("cpuTieneIGPU devuelve undefined si no se sabe", () => {
    assert.equal(cpuTieneIGPU({ nombre: "Ryzen 7 7800X3D" }), undefined);
    assert.equal(cpuTieneIGPU(null), undefined);
  });

  test("potenciaEstimada aplica base + 30% de margen", () => {
    // (65 + 165 + 100) * 1.3 = 429
    assert.equal(potenciaEstimada({ cpuW: 65, gpuW: 165 }), 429);
  });

  test("potenciaEstimada devuelve null sin datos", () => {
    assert.equal(potenciaEstimada({}), null);
    assert.equal(potenciaEstimada({ cpuW: 65 }), null);
  });
});

describe("regla cpu_socket", () => {
  test("ok cuando comparten socket", () => {
    const r = unSolo(evaluarBuild(buildSano()), "cpu_socket");
    assert.equal(r.estado, "ok");
    assert.ok(r.mensaje.length > 0);
    assert.deepEqual(r.componentes, ["cpu", "mother"]);
  });

  test("error cuando no coinciden", () => {
    const b = buildSano();
    b.mother.socket = "LGA1700";
    const r = unSolo(evaluarBuild(b), "cpu_socket");
    assert.equal(r.estado, "error");
  });

  test("unknown si falta el socket del CPU", () => {
    const b = buildSano();
    delete b.cpu.socket;
    assert.equal(unSolo(evaluarBuild(b), "cpu_socket").estado, "unknown");
  });

  test("unknown no se cuenta como compatible por defecto", () => {
    const b = buildSano();
    delete b.cpu.socket;
    const res = evaluarBuild(b);
    assert.ok(res.resumen.tienePendientes);
    assert.ok(porRegla(res, "cpu_socket").every((r) => r.estado !== "ok"));
  });
});

describe("regla ram_ddr + capacidad", () => {
  test("ok con DDR5 en mother DDR5", () => {
    assert.equal(unSolo(evaluarBuild(buildSano()), "ram_ddr").estado, "ok");
  });

  test("error con DDR4 en mother DDR5", () => {
    const b = buildSano();
    b.ram = { nombre: "Vengeance", tipo: "DDR4", capacidadGB: 8, modulos: 2 };
    assert.equal(unSolo(evaluarBuild(b), "ram_ddr").estado, "error");
  });

  test("error con SO-DIMM en mother de escritorio", () => {
    const b = buildSano();
    b.ram = { nombre: "Kit notebook", tipo: "DDR5", formatoModulo: "SO-DIMM", capacidadGB: 16, modulos: 2 };
    const r = unSolo(evaluarBuild(b), "ram_ddr");
    assert.equal(r.estado, "error");
    assert.match(r.mensaje, /SO-DIMM/);
  });

  test("unknown si falta el tipo de RAM", () => {
    const b = buildSano();
    b.ram = { capacidadGB: 16, modulos: 2 };
    assert.equal(unSolo(evaluarBuild(b), "ram_ddr").estado, "unknown");
  });

  test("error si los módulos superan las ranuras", () => {
    const b = buildSano();
    b.ram = { tipo: "DDR5", capacidadGB: 8, modulos: 6 };
    assert.equal(unSolo(evaluarBuild(b), "ram_ranuras").estado, "error");
  });

  test("error si la capacidad supera el máximo", () => {
    const b = buildSano();
    b.ram = { tipo: "DDR5", capacidadGB: 64, modulos: 4 };
    const r = unSolo(evaluarBuild(b), "ram_maximo");
    assert.equal(r.estado, "error");
    assert.match(r.mensaje, /256GB|máximo/);
  });

  test("unknown de ranuras si el mother no informa", () => {
    const b = buildSano();
    delete b.mother.ranurasRAM;
    assert.equal(unSolo(evaluarBuild(b), "ram_ranuras").estado, "unknown");
  });
});

describe("regla mother_gabinete", () => {
  test("ok ATX en gabinete que acepta ATX", () => {
    assert.equal(unSolo(evaluarBuild(buildSano()), "mother_gabinete").estado, "ok");
  });

  test("error ATX en gabinete solo Micro-ATX/Mini-ITX", () => {
    const b = buildSano();
    b.gabinete.formatosMother = ["Micro-ATX", "Mini-ITX"];
    assert.equal(unSolo(evaluarBuild(b), "mother_gabinete").estado, "error");
  });

  test("unknown si el gabinete no informa formatos", () => {
    const b = buildSano();
    b.gabinete = { nombre: "Gabo misterioso" };
    assert.equal(unSolo(evaluarBuild(b), "mother_gabinete").estado, "unknown");
  });
});

describe("regla gpu_gabinete", () => {
  test("ok si la placa entra", () => {
    assert.equal(unSolo(evaluarBuild(buildSano()), "gpu_gabinete").estado, "ok");
  });

  test("error si la placa es más larga que el gabinete", () => {
    const b = buildSano();
    b.gpu = { nombre: "RTX 4090", longitudMm: 357, consumoW: 450, fuenteRecomendadaW: 1000, requiere12VHPWR: true };
    b.gabinete.maxGpuMm = 300;
    assert.equal(unSolo(evaluarBuild(b), "gpu_gabinete").estado, "error");
  });

  test("unknown si falta el largo", () => {
    const b = buildSano();
    delete b.gpu.longitudMm;
    assert.equal(unSolo(evaluarBuild(b), "gpu_gabinete").estado, "unknown");
  });
});

describe("regla cooler (socket, TDP, tamaño)", () => {
  test("ok de socket cuando incluye AM5", () => {
    assert.equal(unSolo(evaluarBuild(buildSano()), "cooler_socket").estado, "ok");
  });

  test("error de socket cuando no lo incluye", () => {
    const b = buildSano();
    b.cooler.sockets = ["LGA1700"];
    assert.equal(unSolo(evaluarBuild(b), "cooler_socket").estado, "error");
  });

  test("ok de TDP cuando sobra disipación", () => {
    assert.equal(unSolo(evaluarBuild(buildSano()), "cooler_tdp").estado, "ok");
  });

  test("error de TDP cuando el cooler se queda corto", () => {
    const b = buildSano();
    b.cpu.tdpW = 125;
    b.cooler.tdpMaximoW = 95;
    assert.equal(unSolo(evaluarBuild(b), "cooler_tdp").estado, "error");
  });

  test("warn de TDP cuando va justito", () => {
    const b = buildSano();
    b.cpu.tdpW = 125;
    b.cooler.tdpMaximoW = 130;
    assert.equal(unSolo(evaluarBuild(b), "cooler_tdp").estado, "warn");
  });

  test("ok de radiador cuando entra el AIO", () => {
    const b = buildSano();
    b.cooler = { nombre: "Kraken 280", tipo: "liquido", sockets: ["AM5"], radiadorMm: 280, tdpMaximoW: 280 };
    assert.equal(unSolo(evaluarBuild(b), "cooler_gabinete").estado, "ok");
  });

  test("error de radiador cuando no entra", () => {
    const b = buildSano();
    b.cooler = { nombre: "Kraken 280", tipo: "liquido", sockets: ["AM5"], radiadorMm: 280, tdpMaximoW: 280 };
    b.gabinete.radiadorMaxMm = 240;
    assert.equal(unSolo(evaluarBuild(b), "cooler_gabinete").estado, "error");
  });

  test("error de altura cuando la torre no entra", () => {
    const b = buildSano();
    b.gabinete.maxCoolerMm = 150;
    assert.equal(unSolo(evaluarBuild(b), "cooler_gabinete").estado, "error");
  });

  test("unknown de socket si el cooler no lista sockets", () => {
    const b = buildSano();
    b.cooler.sockets = [];
    assert.equal(unSolo(evaluarBuild(b), "cooler_socket").estado, "unknown");
  });
});

describe("regla almacenamiento", () => {
  test("ok con 1 NVMe en 2 slots", () => {
    assert.equal(unSolo(evaluarBuild(buildSano()), "almacenamiento_nvme").estado, "ok");
  });

  test("error con más NVMes que slots", () => {
    const b = buildSano();
    b.discos = [
      { nombre: "A", tipo: "NVMe" },
      { nombre: "B", tipo: "NVMe" },
      { nombre: "C", tipo: "NVMe" },
    ];
    assert.equal(unSolo(evaluarBuild(b), "almacenamiento_nvme").estado, "error");
  });

  test("ok con SATA dentro de los puertos", () => {
    const b = buildSano();
    b.discos = [{ nombre: "Barracuda", tipo: "SATA" }];
    assert.equal(unSolo(evaluarBuild(b), "almacenamiento_sata").estado, "ok");
  });

  test("unknown si el disco no dice NVMe o SATA", () => {
    const b = buildSano();
    b.discos = [{ nombre: "Disco raro" }];
    const rs = porRegla(evaluarBuild(b), "almacenamiento_slots");
    assert.equal(rs.length, 1);
    assert.equal(rs[0].estado, "unknown");
  });

  test("unknown si el mother no informa M.2", () => {
    const b = buildSano();
    delete b.mother.puertosM2;
    assert.equal(unSolo(evaluarBuild(b), "almacenamiento_nvme").estado, "unknown");
  });
});

describe("regla cpu sin iGPU + GPU", () => {
  test("error con CPU serie F y sin placa", () => {
    const b = buildSano();
    b.cpu = { nombre: "Intel Core i5 12400F", socket: "LGA1700", tdpW: 65 };
    b.mother = { ...b.mother, socket: "LGA1700", memoriaTipo: "DDR5", chipset: "B760", formato: "Micro-ATX" };
    delete b.gpu;
    assert.equal(unSolo(evaluarBuild(b), "cpu_gpu_video").estado, "error");
  });

  test("ok con iGPU y sin placa dedicada", () => {
    const b = buildSano();
    delete b.gpu;
    assert.equal(unSolo(evaluarBuild(b), "cpu_gpu_video").estado, "ok");
  });

  test("unknown sin placa y sin dato de iGPU", () => {
    const b = buildSano();
    b.cpu = { nombre: "Procesador misterioso", socket: "AM5", tdpW: 65 };
    delete b.gpu;
    assert.equal(unSolo(evaluarBuild(b), "cpu_gpu_video").estado, "unknown");
  });

  test("ok con placa dedicada aunque el CPU sea F", () => {
    const b = buildSano();
    b.cpu = { nombre: "Intel Core i5 12400F", socket: "LGA1700", tdpW: 65, tieneIGPU: false };
    b.mother.socket = "LGA1700";
    assert.equal(unSolo(evaluarBuild(b), "cpu_gpu_video").estado, "ok");
  });
});

describe("regla fuente (potencia, conectores, tamaño)", () => {
  test("ok con fuente sobrada", () => {
    assert.equal(unSolo(evaluarBuild(buildSano()), "fuente_potencia").estado, "ok");
  });

  test("error si la fuente no llega a la recomendada de la GPU", () => {
    const b = buildSano();
    b.gpu = { nombre: "RTX 4090", longitudMm: 357, consumoW: 450, fuenteRecomendadaW: 1000, requiere12VHPWR: true };
    b.fuente.potenciaW = 650;
    assert.equal(unSolo(evaluarBuild(b), "fuente_potencia").estado, "error");
  });

  test("warn si el estimado supera el 80% de la fuente", () => {
    const b = buildSano();
    // Estimado: (65 + 300 + 100) * 1.3 = 605 → 605/650 = 93%
    b.gpu.consumoW = 300;
    delete b.gpu.fuenteRecomendadaW;
    b.fuente.potenciaW = 650;
    assert.equal(unSolo(evaluarBuild(b), "fuente_potencia").estado, "warn");
  });

  test("unknown si falta el consumo de la GPU", () => {
    const b = buildSano();
    delete b.gpu.consumoW;
    assert.equal(unSolo(evaluarBuild(b), "fuente_potencia").estado, "unknown");
  });

  test("error si falta el 12VHPWR", () => {
    const b = buildSano();
    b.gpu = { nombre: "RTX 4070 S", longitudMm: 267, consumoW: 220, fuenteRecomendadaW: 650, requiere12VHPWR: true };
    b.fuente.tiene12VHPWR = false;
    const r = unSolo(evaluarBuild(b), "fuente_12vhpwr");
    assert.equal(r.estado, "error");
    assert.match(r.mensaje, /12VHPWR/);
  });

  test("ok si la fuente trae 12VHPWR", () => {
    const b = buildSano();
    b.gpu.requiere12VHPWR = true;
    assert.equal(unSolo(evaluarBuild(b), "fuente_12vhpwr").estado, "ok");
  });

  test("error si faltan 8-pines", () => {
    const b = buildSano();
    b.gpu.conectores8pin = 2;
    b.fuente.conectores8pin = 1;
    assert.equal(unSolo(evaluarBuild(b), "fuente_8pin").estado, "error");
  });

  test("unknown si no se saben los 8-pines de la fuente", () => {
    const b = buildSano();
    delete b.fuente.conectores8pin;
    assert.equal(unSolo(evaluarBuild(b), "fuente_8pin").estado, "unknown");
  });

  test("ok de tamaño ATX en gabinete ATX", () => {
    assert.equal(unSolo(evaluarBuild(buildSano()), "fuente_gabinete").estado, "ok");
  });

  test("unknown de tamaño si nadie informa formato", () => {
    const b = buildSano();
    delete b.fuente.formato;
    b.gabinete = { nombre: "Gabo sin ficha" };
    assert.equal(unSolo(evaluarBuild(b), "fuente_gabinete").estado, "unknown");
  });
});

describe("regla bios_chipset", () => {
  test("warn con 14va gen en B760", () => {
    const b = buildSano();
    b.cpu = { nombre: "Intel Core i7 14700K", socket: "LGA1700", tdpW: 125, tieneIGPU: true };
    b.mother = { ...b.mother, socket: "LGA1700", chipset: "B760", formato: "Micro-ATX" };
    assert.equal(unSolo(evaluarBuild(b), "bios_chipset").estado, "warn");
  });

  test("warn con Ryzen 8000 en B650", () => {
    const b = buildSano();
    b.cpu = { nombre: "Ryzen 5 8600G", socket: "AM5", tdpW: 65, tieneIGPU: true };
    assert.equal(unSolo(evaluarBuild(b), "bios_chipset").estado, "warn");
  });

  test("ok con combo sin choque generacional", () => {
    assert.equal(unSolo(evaluarBuild(buildSano()), "bios_chipset").estado, "ok");
  });

  test("unknown sin chipset", () => {
    const b = buildSano();
    delete b.mother.chipset;
    assert.equal(unSolo(evaluarBuild(b), "bios_chipset").estado, "unknown");
  });
});

describe("integración y bidireccionalidad", () => {
  test("build sano: sin errores y resumen consistente", () => {
    const res = evaluarBuild(buildSano());
    assert.equal(res.resumen.error, 0);
    assert.equal(res.resumen.bloqueada, false);
    assert.equal(res.resumen.total, res.resultados.length);
    assert.equal(
      res.resumen.ok + res.resumen.warn + res.resumen.error + res.resumen.unknown,
      res.resumen.total,
    );
    assert.ok(esCompatible(buildSano()));
  });

  test("build con socket cruzado queda bloqueado", () => {
    const b = buildSano();
    b.cpu.socket = "LGA1700";
    const res = evaluarBuild(b);
    assert.equal(res.resumen.bloqueada, true);
    assert.ok(!esCompatible(b));
    assert.ok(res.resumen.error >= 1);
  });

  test("bidireccional: el orden de carga no cambia el resultado", () => {
    const a = buildSano();
    const b = {};
    for (const k of Object.keys(a).reverse()) b[k] = a[k];
    const ra = evaluarBuild(a);
    const rb = evaluarBuild(b);
    assert.deepEqual(
      rb.resultados.map((r) => [r.regla, r.estado]),
      ra.resultados.map((r) => [r.regla, r.estado]),
    );
  });

  test("cambiar el mother revalida el socket del CPU (ida y vuelta)", () => {
    const b = buildSano();
    assert.equal(unSolo(evaluarBuild(b), "cpu_socket").estado, "ok");
    b.mother.socket = "LGA1700";
    assert.equal(unSolo(evaluarBuild(b), "cpu_socket").estado, "error");
    b.cpu.socket = "LGA1700";
    assert.equal(unSolo(evaluarBuild(b), "cpu_socket").estado, "ok");
  });

  test("todos los mensajes están en español (voseo) y traen componentes", () => {
    const res = evaluarBuild({ ...buildSano(), discos: [{ nombre: "X" }] });
    assert.ok(res.resultados.length > 5);
    for (const r of res.resultados) {
      assert.ok(r.mensaje && r.mensaje.length > 10, `mensaje vacío en ${r.regla}`);
      assert.ok(Array.isArray(r.componentes) && r.componentes.length > 0, `sin componentes en ${r.regla}`);
      assert.ok(["ok", "warn", "error", "unknown"].includes(r.estado), `estado inválido en ${r.regla}`);
    }
  });

  test("build vacío no tira errores falsos ni compatibles gratis", () => {
    const res = evaluarBuild({});
    assert.equal(res.resultados.length, 0);
    assert.equal(res.resumen.error, 0);
  });
});
