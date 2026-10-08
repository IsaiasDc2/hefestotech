// Tests del motor de compatibilidad — corren con: node --test src/lib/compatibility/motor.test.js
// Cero dependencias: solo node:test + node:assert.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  estimarConsumo,
  potenciaFuenteRecomendada,
  validarArmado,
  evaluarPieza,
  validarCambioClave,
} from "./motor.js";
import { piezaPorId } from "../../data/armadorCatalogo.js";

const VACIO = {
  cpu: null, motherboard: null, ram: null, gpu: null,
  almacenamiento: null, fuente: null, gabinete: null, cooler: null,
};

// Armado base válido con piezas inline (AM4 + DDR4 + ATX).
const BASE = {
  cpu: { id: "t-cpu", categoria: "cpu", specs: { socket: "AM4", tdp: 65, videoIntegrado: true } },
  motherboard: {
    id: "t-mb", categoria: "motherboard",
    specs: { socket: "AM4", ramTipo: "DDR4", ramSlots: 4, ramMaxGb: 128, ramMaxMhz: 3200, formato: "ATX", m2Slots: 2, sataPuertos: 4 },
  },
  ram: { id: "t-ram", categoria: "ram", specs: { tipo: "DDR4", capacidadGb: 16, modulos: 2, velocidadMhz: 3200 } },
  gpu: { id: "t-gpu", categoria: "gpu", specs: { largoMm: 240, consumoW: 200, pcie8pin: 1 } },
  almacenamiento: { id: "t-ssd", categoria: "almacenamiento", specs: { interfaz: "M.2", tipo: "NVMe" } },
  fuente: { id: "t-psu", categoria: "fuente", specs: { potenciaW: 650, pcie8pin: 2 } },
  gabinete: {
    id: "t-gab", categoria: "gabinete",
    specs: { formatos: ["ATX", "mATX", "ITX"], maxGpuMm: 300, maxCoolerMm: 160 },
  },
  cooler: {
    id: "t-cool", categoria: "cooler",
    specs: { sockets: ["AM4"], tdpMaxW: 95, alturaMm: 150 },
  },
};

const con = (cambios) => ({ ...BASE, ...cambios });

describe("casos válidos", () => {
  it("armado completo válido → ok sin issues", () => {
    const r = validarArmado(BASE);
    assert.equal(r.estado, "ok");
    assert.equal(r.issues.length, 0);
    assert.ok(r.consumoEstimadoW > 0);
    assert.ok(r.fuenteRecomendadaW <= 650);
  });

  it("selección vacía → ok, 0 issues, consumo 0, recomendada 450", () => {
    const r = validarArmado(VACIO);
    assert.equal(r.estado, "ok");
    assert.equal(r.issues.length, 0);
    assert.equal(estimarConsumo(VACIO), 0);
    assert.equal(potenciaFuenteRecomendada(0), 450);
  });

  it("solo CPU → sin errores (avisa fuente faltante)", () => {
    const r = validarArmado({ ...VACIO, cpu: BASE.cpu });
    assert.ok(!r.issues.some((i) => i.severidad === "error"));
    assert.ok(r.consumoEstimadoW >= 65);
  });

  it("CPU sin video integrado + GPU dedicada → ok", () => {
    const cpuSinVideo = { ...BASE.cpu, specs: { ...BASE.cpu.specs, videoIntegrado: false } };
    const r = validarArmado(con({ cpu: cpuSinVideo }));
    assert.equal(r.estado, "ok");
    assert.equal(r.issues.filter((i) => i.codigo === "SIN_VIDEO").length, 0);
  });
});

describe("reglas de compatibilidad (errores)", () => {
  it("socket CPU ≠ mother → error CPU_SOCKET", () => {
    const r = validarArmado(con({
      motherboard: { ...BASE.motherboard, specs: { ...BASE.motherboard.specs, socket: "LGA1700" } },
    }));
    assert.equal(r.estado, "errores");
    assert.ok(r.issues.some((i) => i.codigo === "CPU_SOCKET" && i.severidad === "error"));
  });

  it("RAM DDR5 en mother DDR4 → error RAM_TIPO", () => {
    const r = validarArmado(con({
      ram: { ...BASE.ram, specs: { tipo: "DDR5", capacidadGb: 16, modulos: 2, velocidadMhz: 5200 } },
    }));
    assert.equal(r.estado, "errores");
    assert.ok(r.issues.some((i) => i.codigo === "RAM_TIPO"));
  });

  it("más módulos que slots → error RAM_SLOTS", () => {
    const r = validarArmado(con({
      motherboard: { ...BASE.motherboard, specs: { ...BASE.motherboard.specs, ramSlots: 2 } },
      ram: { ...BASE.ram, specs: { ...BASE.ram.specs, modulos: 4 } },
    }));
    assert.ok(r.issues.some((i) => i.codigo === "RAM_SLOTS" && i.severidad === "error"));
  });

  it("capacidad total mayor al máximo → error RAM_CAPACIDAD", () => {
    const r = validarArmado(con({
      ram: { ...BASE.ram, specs: { ...BASE.ram.specs, capacidadGb: 64, modulos: 2 } },
      motherboard: { ...BASE.motherboard, specs: { ...BASE.motherboard.specs, ramMaxGb: 64 } },
    }));
    assert.ok(r.issues.some((i) => i.codigo === "RAM_CAPACIDAD" && i.severidad === "error"));
  });

  it("formato mother no soportado por gabinete → error MOTHER_FORMATO", () => {
    const r = validarArmado(con({
      gabinete: { ...BASE.gabinete, specs: { ...BASE.gabinete.specs, formatos: ["ITX"] } },
    }));
    assert.ok(r.issues.some((i) => i.codigo === "MOTHER_FORMATO" && i.severidad === "error"));
  });

  it("GPU más larga que el máximo → error GPU_LARGO", () => {
    const r = validarArmado(con({
      gpu: { ...BASE.gpu, specs: { ...BASE.gpu.specs, largoMm: 330 } },
    }));
    assert.ok(r.issues.some((i) => i.codigo === "GPU_LARGO" && i.severidad === "error"));
  });

  it("cooler sin anclaje para el socket → error COOLER_SOCKET", () => {
    const r = validarArmado(con({
      cooler: { ...BASE.cooler, specs: { ...BASE.cooler.specs, sockets: ["LGA1700"] } },
    }));
    assert.ok(r.issues.some((i) => i.codigo === "COOLER_SOCKET" && i.severidad === "error"));
  });

  it("cooler con TDP insuficiente → error COOLER_TDP", () => {
    const r = validarArmado(con({
      cpu: { ...BASE.cpu, specs: { ...BASE.cpu.specs, tdp: 125 } },
      cooler: { ...BASE.cooler, specs: { ...BASE.cooler.specs, tdpMaxW: 65 } },
    }));
    assert.ok(r.issues.some((i) => i.codigo === "COOLER_TDP" && i.severidad === "error"));
  });

  it("cooler más alto que el gabinete → error COOLER_ALTURA", () => {
    const r = validarArmado(con({
      cooler: { ...BASE.cooler, specs: { ...BASE.cooler.specs, alturaMm: 170 } },
    }));
    assert.ok(r.issues.some((i) => i.codigo === "COOLER_ALTURA" && i.severidad === "error"));
  });

  it("fuente que no cubre el consumo → error FUENTE_POTENCIA_INSUFICIENTE", () => {
    // consumo BASE = 65 + 200 + 70 + 30 = 365 W
    const r = validarArmado(con({
      fuente: { ...BASE.fuente, specs: { potenciaW: 300, pcie8pin: 2 } },
    }));
    assert.ok(r.issues.some((i) => i.codigo === "FUENTE_POTENCIA_INSUFICIENTE" && i.severidad === "error"));
  });

  it("GPU pide más conectores de los que trae la fuente → error FUENTE_CONECTORES", () => {
    const r = validarArmado(con({
      gpu: { ...BASE.gpu, specs: { ...BASE.gpu.specs, pcie8pin: 2 } },
      fuente: { ...BASE.fuente, specs: { potenciaW: 750, pcie8pin: 1 } },
    }));
    assert.ok(r.issues.some((i) => i.codigo === "FUENTE_CONECTORES" && i.severidad === "error"));
  });

  it("M.2 sin slots libres → error ALMACEN_M2", () => {
    const r = validarArmado(con({
      motherboard: { ...BASE.motherboard, specs: { ...BASE.motherboard.specs, m2Slots: 0 } },
    }));
    assert.ok(r.issues.some((i) => i.codigo === "ALMACEN_M2" && i.severidad === "error"));
  });

  it("SATA sin puertos libres → error ALMACEN_SATA", () => {
    const r = validarArmado(con({
      almacenamiento: { ...BASE.almacenamiento, specs: { interfaz: "SATA", tipo: "SATA" } },
      motherboard: { ...BASE.motherboard, specs: { ...BASE.motherboard.specs, sataPuertos: 0 } },
    }));
    assert.ok(r.issues.some((i) => i.codigo === "ALMACEN_SATA" && i.severidad === "error"));
  });
});

describe("advertencias (no bloquean)", () => {
  it("RAM más rápida que la mother → solo advertencia RAM_VELOCIDAD", () => {
    const r = validarArmado(con({
      ram: { ...BASE.ram, specs: { ...BASE.ram.specs, velocidadMhz: 3600 } },
    }));
    assert.equal(r.estado, "advertencias");
    assert.ok(r.issues.some((i) => i.codigo === "RAM_VELOCIDAD" && i.severidad === "advertencia"));
    assert.ok(!r.issues.some((i) => i.severidad === "error"));
  });

  it("fuente justa (cubre pero sin margen) → advertencia FUENTE_JUSTA", () => {
    // consumo 365 → recomendada 450; fuente de 400 cubre pero va justa
    const r = validarArmado(con({
      fuente: { ...BASE.fuente, specs: { potenciaW: 400, pcie8pin: 2 } },
    }));
    assert.ok(r.issues.some((i) => i.codigo === "FUENTE_JUSTA" && i.severidad === "advertencia"));
  });

  it("CPU sin video integrado y sin GPU → advertencia SIN_VIDEO", () => {
    const cpuSinVideo = { ...BASE.cpu, specs: { ...BASE.cpu.specs, videoIntegrado: false } };
    const r = validarArmado(con({ cpu: cpuSinVideo, gpu: null }));
    assert.ok(r.issues.some((i) => i.codigo === "SIN_VIDEO" && i.severidad === "advertencia"));
  });

  it("cooler al límite de TDP → advertencia COOLER_TDP_JUSTO", () => {
    const r = validarArmado(con({
      cpu: { ...BASE.cpu, specs: { ...BASE.cpu.specs, tdp: 90 } },
    }));
    assert.ok(r.issues.some((i) => i.codigo === "COOLER_TDP_JUSTO" && i.severidad === "advertencia"));
  });
});

describe("cálculos de potencia", () => {
  it("potenciaFuenteRecomendada en los bordes", () => {
    assert.equal(potenciaFuenteRecomendada(500), 650); // 500*1.2=600 → 650
    assert.equal(potenciaFuenteRecomendada(0), 450); // mínimo
    assert.equal(potenciaFuenteRecomendada(375), 450); // 375*1.2=450 exacto, no sube
    assert.equal(potenciaFuenteRecomendada(376), 550); // 376*1.2=451.2 → 550
  });

  it("estimarConsumo suma CPU + GPU + base", () => {
    const w = estimarConsumo({ ...VACIO, cpu: BASE.cpu, gpu: BASE.gpu });
    assert.ok(w >= 65 + 200);
    assert.equal(w, 65 + 200 + 70 + 30);
  });
});

describe("evaluarPieza y validarCambioClave", () => {
  it("evaluarPieza detecta error futuro (GPU larga)", () => {
    const sel = con({ gpu: null });
    const gpuLarga = { ...BASE.gpu, specs: { ...BASE.gpu.specs, largoMm: 350 } };
    const ev = evaluarPieza(gpuLarga, sel);
    assert.equal(ev.compatible, false);
    assert.ok(ev.motivos.some((m) => m.codigo === "GPU_LARGO"));
  });

  it("evaluarPieza con solo advertencia → compatible true, motivos vacíos", () => {
    const sel = con({ ram: null });
    const ramRapida = { ...BASE.ram, specs: { ...BASE.ram.specs, velocidadMhz: 3600 } };
    const ev = evaluarPieza(ramRapida, sel);
    assert.equal(ev.compatible, true);
    assert.equal(ev.motivos.length, 0);
  });

  it("validarCambioClave señala categorías afectadas al romper el socket", () => {
    const rota = con({
      motherboard: { ...BASE.motherboard, specs: { ...BASE.motherboard.specs, socket: "LGA1700" } },
    });
    const r = validarCambioClave(rota);
    assert.equal(r.estado, "errores");
    assert.ok(r.afectadas.includes("cpu"));
    const sana = validarCambioClave(BASE);
    assert.equal(sana.afectadas.length, 0);
  });
});

describe("catálogo real: casos conflictivos intencionales", () => {
  const porId = (id) => {
    const p = piezaPorId(id);
    assert.ok(p, `existe pieza ${id}`);
    return p;
  };

  it("cpu1 (AM4) + mb2 (AM5) → error de socket", () => {
    const r = validarArmado({ ...VACIO, cpu: porId("cpu1"), motherboard: porId("mb2") });
    assert.equal(r.estado, "errores");
    assert.ok(r.issues.some((i) => i.codigo === "CPU_SOCKET"));
  });

  it("mb1 (DDR4) + ram2 (DDR5) → error de tipo", () => {
    const r = validarArmado({ ...VACIO, motherboard: porId("mb1"), ram: porId("ram2") });
    assert.ok(r.issues.some((i) => i.codigo === "RAM_TIPO" && i.severidad === "error"));
  });

  it("gpu4 (357mm) + gab4 (máx 210mm) → error de largo", () => {
    const r = validarArmado({ ...VACIO, gpu: porId("gpu4"), gabinete: porId("gab4") });
    assert.ok(r.issues.some((i) => i.codigo === "GPU_LARGO"));
  });

  it("mb2 (ATX) + gab4 (solo ITX) → error de formato", () => {
    const r = validarArmado({ ...VACIO, motherboard: porId("mb2"), gabinete: porId("gab4") });
    assert.ok(r.issues.some((i) => i.codigo === "MOTHER_FORMATO"));
  });

  it("cpu2 + gpu4 + psu4 → error de potencia y de conectores", () => {
    const r = validarArmado({
      ...VACIO, cpu: porId("cpu2"), gpu: porId("gpu4"), fuente: porId("psu4"),
    });
    assert.ok(r.issues.some((i) => i.codigo === "FUENTE_POTENCIA_INSUFICIENTE"));
    assert.ok(r.issues.some((i) => i.codigo === "FUENTE_CONECTORES"));
  });

  it("cpu2 (120W) + cool5 (95W) → error de TDP", () => {
    const r = validarArmado({ ...VACIO, cpu: porId("cpu2"), cooler: porId("cool5") });
    assert.ok(r.issues.some((i) => i.codigo === "COOLER_TDP"));
  });
});
