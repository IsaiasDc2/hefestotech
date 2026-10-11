/**
 * HefestoTech · Armador · Motor de compatibilidad (puro, sin I/O).
 *
 * Evalúa un build completo y devuelve una lista de resultados por regla:
 *   { regla, estado, mensaje, componentes }
 *
 * Estados:
 *   - "ok"      → todo en orden, podés seguir.
 *   - "warn"    → podés seguir, pero fijate en el aviso.
 *   - "error"   → bloqueante, esa combinación no va.
 *   - "unknown" → faltan datos para decidir. NUNCA se asume compatible
 *                 por defecto: lo pendiente se informa, no se aprueba.
 *
 * Reevaluación bidireccional: el motor es una función pura y sin estado.
 * Cada llamada a `evaluarBuild` recalcula TODAS las reglas sobre el build
 * completo, sin importar el orden en que agregaste los componentes.
 * Cambiar el mother revalida el socket del CPU y viceversa; lo mismo con
 * RAM, gabinete, fuente y el resto. No hay caché ni orden de carga.
 *
 * IMPORTANTE: este motor NO lee `productos.especificaciones` (JSONB).
 * Trabaja solo con objetos normalizados (ver @typedef). La tabla futura
 * `product_specs` (migración 004) es la fuente curada que el dueño debe
 * cargar y verificar antes de conectar el motor al catálogo real.
 *
 * @typedef {Object} Cpu
 * @property {string} [nombre]
 * @property {string} [socket]        Ej: "AM5", "LGA1700".
 * @property {number} [tdpW]          TDP en watts.
 * @property {boolean} [tieneIGPU]    Gráficos integrados (si falta, se infiere
 *                                    por sufijo F; si no se puede, unknown).
 *
 * @typedef {Object} Mother
 * @property {string} [nombre]
 * @property {string} [socket]
 * @property {string} [memoriaTipo]   "DDR4" | "DDR5".
 * @property {number} [ranurasRAM]
 * @property {number} [memoriaMaximaGB]
 * @property {string} [formato]       "ATX" | "Micro-ATX" | "Mini-ITX" | "E-ATX".
 * @property {number} [puertosM2]
 * @property {number} [puertosSata]
 * @property {string} [chipset]       Ej: "B650", "B760", "X670E".
 *
 * @typedef {Object} Ram
 * @property {string} [nombre]
 * @property {string} [tipo]          "DDR4" | "DDR5".
 * @property {string} [formatoModulo] "DIMM" | "SO-DIMM" (default: "DIMM").
 * @property {number} [capacidadGB]   Capacidad POR módulo.
 * @property {number} [modulos]       Cantidad de módulos (default: 1).
 *
 * @typedef {Object} Gpu
 * @property {string} [nombre]
 * @property {number} [longitudMm]
 * @property {number} [consumoW]
 * @property {number} [fuenteRecomendadaW]
 * @property {number} [conectores8pin]   Cantidad de 8-pines que pide (default 0).
 * @property {boolean} [requiere12VHPWR]  Pide conector 16-pin 12VHPWR.
 *
 * @typedef {Object} Cooler
 * @property {string} [nombre]
 * @property {string} [tipo]          "aire" | "liquido".
 * @property {string[]} [sockets]     Sockets compatibles.
 * @property {number} [alturaMm]      Solo aire (torre).
 * @property {number} [radiadorMm]    Solo líquidos (120/240/280/360).
 * @property {number} [tdpMaximoW]    Capacidad de disipación.
 *
 * @typedef {Object} Disco
 * @property {string} [nombre]
 * @property {string} [tipo]          "NVMe" | "SATA".
 *
 * @typedef {Object} Fuente
 * @property {string} [nombre]
 * @property {number} [potenciaW]
 * @property {boolean} [tiene12VHPWR]
 * @property {number} [conectores8pin]  8-pines PCIe disponibles.
 * @property {string} [formato]          "ATX" | "SFX" | "SFX-L".
 *
 * @typedef {Object} Gabinete
 * @property {string} [nombre]
 * @property {string[]} [formatosMother]  Ej: ["ATX", "Micro-ATX", "Mini-ITX"].
 * @property {number} [maxGpuMm]          Largo máximo de GPU.
 * @property {number} [maxCoolerMm]       Altura máxima de cooler por aire.
 * @property {number} [radiadorMaxMm]     Radiador máximo soportado.
 * @property {string[]} [formatosFuente]  Ej: ["ATX"].
 *
 * @typedef {Object} Build
 * @property {Cpu} [cpu]
 * @property {Mother} [mother]
 * @property {Ram|Ram[]} [ram]
 * @property {Gpu} [gpu]
 * @property {Cooler} [cooler]
 * @property {Disco|Disco[]} [discos]
 * @property {Fuente} [fuente]
 * @property {Gabinete} [gabinete]
 */

export const ESTADOS = Object.freeze({
  OK: "ok",
  WARN: "warn",
  ERROR: "error",
  UNKNOWN: "unknown",
});

const norm = (v) => String(v ?? "").trim().toUpperCase().replace(/[\s_]+/g, "-");

function normalizarFormato(v) {
  const n = norm(v);
  if (!n) return "";
  if (["ATX"].includes(n)) return "ATX";
  if (["MICRO-ATX", "MICROATX", "M-ATX", "MATX", "MICRO-ATX-TOWER"].includes(n)) return "MICRO-ATX";
  if (["MINI-ITX", "MINIITX", "MITX"].includes(n)) return "MINI-ITX";
  if (["E-ATX", "EATX", "EXTENDED-ATX"].includes(n)) return "E-ATX";
  return n;
}

/** Orden de menor a mayor: lo que entra en cada gabinete según su formato. */
const FORMATOS_ACEPTADOS_POR_GABINETE = {
  "E-ATX": ["E-ATX", "ATX", "MICRO-ATX", "MINI-ITX"],
  ATX: ["ATX", "MICRO-ATX", "MINI-ITX"],
  "MICRO-ATX": ["MICRO-ATX", "MINI-ITX"],
  "MINI-ITX": ["MINI-ITX"],
};

/**
 * ¿El CPU tiene gráficos integrados?
 * @returns {boolean|undefined} undefined = no se sabe (→ unknown, jamás ok).
 */
export function cpuTieneIGPU(cpu) {
  if (!cpu) return undefined;
  if (typeof cpu.tieneIGPU === "boolean") return cpu.tieneIGPU;
  const nombre = String(cpu.nombre ?? "");
  // Sufijo F en Intel (12400F, 14600F...) = sin iGPU.
  if (/(^|[\s-])\w*F(\s|$)/i.test(nombre) && !/RF\b/i.test(nombre)) {
    // Evitá falsos positivos con "RF" (ej: "RTX"... no es CPU igual).
    if (/\b(i[3579]|Core|KF|KF\b)/i.test(nombre) || /F\b/.test(nombre)) return false;
  }
  if (/\bKF\b/i.test(nombre)) return false;
  return undefined;
}

/** Potencia estimada con margen del 30%. Null si faltan datos. */
export function potenciaEstimada({ cpuW, gpuW, baseW = 100, margen = 0.3 } = {}) {
  if (typeof cpuW !== "number" || typeof gpuW !== "number") return null;
  if (cpuW <= 0 || gpuW < 0) return null;
  return Math.ceil((cpuW + gpuW + baseW) * (1 + margen));
}

function resultado(regla, estado, mensaje, componentes) {
  return { regla, estado, mensaje, componentes };
}

const comoLista = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

// ---------------------------------------------------------------- reglas ---

function reglaCpuSocket(b) {
  const C = ["cpu", "mother"];
  if (!b.cpu || !b.mother) return null;
  const cs = norm(b.cpu.socket);
  const ms = norm(b.mother.socket);
  if (!cs || !ms) {
    return resultado(
      "cpu_socket", ESTADOS.UNKNOWN,
      "Che, me falta el dato del socket del CPU o del mother, así que no te puedo confirmar que encastren. Cargalo y lo reevaluamos.",
      C,
    );
  }
  if (cs === ms) {
    return resultado(
      "cpu_socket", ESTADOS.OK,
      `El CPU y el mother comparten socket ${cs}. Van juntos sin drama.`,
      C,
    );
  }
  return resultado(
    "cpu_socket", ESTADOS.ERROR,
    `Ojo, no encastran: tu CPU es ${cs} y el mother es ${ms}. Tenés que cambiar uno de los dos.`,
    C,
  );
}

function reglaRamDdr(b) {
  const rams = comoLista(b.ram);
  if (rams.length === 0 || !b.mother) return null;
  const C = ["ram", "mother"];
  const tipoMother = norm(b.mother.memoriaTipo);
  const salidas = [];
  rams.forEach((r, i) => {
    const tag = rams.length > 1 ? ` (módulo ${i + 1})` : "";
    const tipo = norm(r.tipo);
    if (!tipo || !tipoMother) {
      salidas.push(resultado(
        "ram_ddr", ESTADOS.UNKNOWN,
        `De la RAM${tag} no sé si es DDR4 o DDR5, o me falta el dato del mother. Sin eso no te la puedo aprobar.`,
        C,
      ));
      return;
    }
    if (tipo !== tipoMother) {
      salidas.push(resultado(
        "ram_ddr", ESTADOS.ERROR,
        `Esa RAM${tag} es ${tipo} pero el mother solo acepta ${tipoMother}. No te va a andar: buscá un kit ${tipoMother}.`,
        C,
      ));
      return;
    }
    const mod = norm(r.formatoModulo || "DIMM");
    if (mod === "SO-DIMM") {
      salidas.push(resultado(
        "ram_ddr", ESTADOS.ERROR,
        `Esa RAM${tag} es SO-DIMM (de notebook) y este mother usa DIMM de escritorio. No entra físicamente.`,
        C,
      ));
      return;
    }
    salidas.push(resultado(
      "ram_ddr", ESTADOS.OK,
      `La RAM${tag} es ${tipo} como pide el mother. Bien ahí.`,
      C,
    ));
  });
  return salidas;
}

function reglaRamCapacidad(b) {
  const rams = comoLista(b.ram);
  if (rams.length === 0 || !b.mother) return null;
  const C = ["ram", "mother"];
  const maxGB = b.mother.memoriaMaximaGB;
  let totalModulos = 0;
  let totalGB = 0;
  let incompleta = false;
  for (const r of rams) {
    const mods = r.modulos ?? 1;
    if (typeof r.capacidadGB !== "number" || typeof mods !== "number") { incompleta = true; continue; }
    totalModulos += mods;
    totalGB += r.capacidadGB * mods;
  }
  const salidas = [];
  if (typeof b.mother.ranurasRAM === "number") {
    if (incompleta) {
      salidas.push(resultado(
        "ram_ranuras", ESTADOS.UNKNOWN,
        "Me falta la capacidad o la cantidad de módulos de alguna RAM, así que no puedo verificar las ranuras. Completalo.",
        C,
      ));
    } else if (totalModulos > b.mother.ranurasRAM) {
      salidas.push(resultado(
        "ram_ranuras", ESTADOS.ERROR,
        `Te pasaste de ranuras: querés poner ${totalModulos} módulos y el mother trae ${b.mother.ranurasRAM}. Sacá un kit o cambiá el mother.`,
        C,
      ));
    } else {
      salidas.push(resultado(
        "ram_ranuras", ESTADOS.OK,
        `Entran lo más bien: ${totalModulos} módulo(s) en ${b.mother.ranurasRAM} ranuras.`,
        C,
      ));
    }
  } else {
    salidas.push(resultado(
      "ram_ranuras", ESTADOS.UNKNOWN,
      "No sé cuántas ranuras trae el mother, así que no puedo validar los módulos. Conseguí ese dato.",
      C,
    ));
  }
  if (typeof maxGB === "number") {
    if (incompleta) {
      salidas.push(resultado(
        "ram_maximo", ESTADOS.UNKNOWN,
        "Sin la capacidad de todos los módulos no puedo verificar el máximo del mother.",
        C,
      ));
    } else if (totalGB > maxGB) {
      salidas.push(resultado(
        "ram_maximo", ESTADOS.ERROR,
        `Te pasaste del máximo: sumás ${totalGB}GB y el mother banca hasta ${maxGB}GB. Bajá la capacidad.`,
        C,
      ));
    } else {
      salidas.push(resultado(
        "ram_maximo", ESTADOS.OK,
        `Vas bien de capacidad: ${totalGB}GB de un máximo de ${maxGB}GB.`,
        C,
      ));
    }
  } else {
    salidas.push(resultado(
      "ram_maximo", ESTADOS.UNKNOWN,
      "No sé la memoria máxima del mother, así que la capacidad total queda pendiente de revisión.",
      C,
    ));
  }
  return salidas;
}

function reglaMotherGabinete(b) {
  if (!b.mother || !b.gabinete) return null;
  const C = ["mother", "gabinete"];
  const formatoMother = normalizarFormato(b.mother.formato);
  if (!formatoMother) {
    return resultado(
      "mother_gabinete", ESTADOS.UNKNOWN,
      "No sé el factor de forma del mother. Sin eso no te puedo decir si entra en el gabinete.",
      C,
    );
  }
  let aceptados = comoLista(b.gabinete.formatosMother).map(normalizarFormato).filter(Boolean);
  if (aceptados.length === 0) {
    const g = normalizarFormato(b.gabinete.formato);
    if (!g) {
      return resultado(
        "mother_gabinete", ESTADOS.UNKNOWN,
        "No sé qué tamaños de mother acepta el gabinete. Fijate la ficha del gabo y lo reevaluamos.",
        C,
      );
    }
    aceptados = FORMATOS_ACEPTADOS_POR_GABINETE[g] ?? [g];
  }
  if (aceptados.includes(formatoMother)) {
    return resultado(
      "mother_gabinete", ESTADOS.OK,
      `El mother ${formatoMother} entra en el gabinete. Mandale nomás.`,
      C,
    );
  }
  return resultado(
    "mother_gabinete", ESTADOS.ERROR,
    `No entra: el mother es ${formatoMother} y el gabinete solo acepta ${aceptados.join(", ")}. Cambiá uno de los dos.`,
    C,
  );
}

function reglaGpuGabinete(b) {
  if (!b.gpu || !b.gabinete) return null;
  const C = ["gpu", "gabinete"];
  const largo = b.gpu.longitudMm;
  const max = b.gabinete.maxGpuMm;
  if (typeof largo !== "number" || typeof max !== "number") {
    return resultado(
      "gpu_gabinete", ESTADOS.UNKNOWN,
      "Me falta el largo de la placa o el espacio máximo del gabinete. Medilo antes de comprar, que una GPU que no entra es un clavo.",
      C,
    );
  }
  if (largo <= max) {
    return resultado(
      "gpu_gabinete", ESTADOS.OK,
      `La placa (${largo}mm) entra en el gabinete (hasta ${max}mm).`,
      C,
    );
  }
  return resultado(
    "gpu_gabinete", ESTADOS.ERROR,
    `La placa no entra: mide ${largo}mm y el gabinete banca hasta ${max}mm. Buscá un gabo más grande o una placa más corta.`,
    C,
  );
}

function reglaCooler(b) {
  if (!b.cooler) return null;
  const salidas = [];
  if (b.cpu) {
    const C = ["cooler", "cpu"];
    const sockets = comoLista(b.cooler.sockets).map(norm).filter(Boolean);
    const cs = norm(b.cpu.socket);
    if (sockets.length === 0 || !cs) {
      salidas.push(resultado(
        "cooler_socket", ESTADOS.UNKNOWN,
        "No sé los sockets que banca el cooler o el socket del CPU. Verificá la compatibilidad del anclaje.",
        C,
      ));
    } else if (sockets.includes(cs)) {
      salidas.push(resultado(
        "cooler_socket", ESTADOS.OK,
        `El cooler trae anclaje para ${cs}. Perfecto.`,
        C,
      ));
    } else {
      salidas.push(resultado(
        "cooler_socket", ESTADOS.ERROR,
        `El cooler no trae anclaje para ${cs} (solo ${sockets.join(", ")}). Elegí otro cooler.`,
        C,
      ));
    }
    const tdpCpu = b.cpu.tdpW;
    const tdpCooler = b.cooler.tdpMaximoW;
    if (typeof tdpCpu !== "number" || typeof tdpCooler !== "number") {
      salidas.push(resultado(
        "cooler_tdp", ESTADOS.UNKNOWN,
        "Me falta el TDP del CPU o la capacidad del cooler. Sin eso no sé si te va a hacer throttle.",
        C,
      ));
    } else if (tdpCooler < tdpCpu) {
      salidas.push(resultado(
        "cooler_tdp", ESTADOS.ERROR,
        `El cooler se queda corto: disipa ${tdpCooler}W y el CPU tira ${tdpCpu}W. Te va a hacer throttle; subí de cooler.`,
        C,
      ));
    } else if (tdpCooler < tdpCpu * 1.15) {
      salidas.push(resultado(
        "cooler_tdp", ESTADOS.WARN,
        `Vas justito de disipación (${tdpCooler}W para un CPU de ${tdpCpu}W). Anda, pero con calor te conviene algo más grande.`,
        C,
      ));
    } else {
      salidas.push(resultado(
        "cooler_tdp", ESTADOS.OK,
        `De disipación vas sobrado: ${tdpCooler}W para ${tdpCpu}W del CPU.`,
        C,
      ));
    }
  }
  if (b.gabinete) {
    const C = ["cooler", "gabinete"];
    const tipo = norm(b.cooler.tipo);
    if (tipo === "LIQUIDO" || /AIO|LIQUID/.test(tipo)) {
      const rad = b.cooler.radiadorMm;
      const max = b.gabinete.radiadorMaxMm;
      if (typeof rad !== "number" || typeof max !== "number") {
        salidas.push(resultado(
          "cooler_gabinete", ESTADOS.UNKNOWN,
          "No sé el tamaño del radiador o el máximo del gabinete. Confirmá que el radiador entra.",
          C,
        ));
      } else if (rad <= max) {
        salidas.push(resultado(
          "cooler_gabinete", ESTADOS.OK,
          `El radiador de ${rad}mm entra en el gabinete (hasta ${max}mm).`,
          C,
        ));
      } else {
        salidas.push(resultado(
          "cooler_gabinete", ESTADOS.ERROR,
          `El radiador no entra: es de ${rad}mm y el gabinete banca hasta ${max}mm.`,
          C,
        ));
      }
    } else {
      const altura = b.cooler.alturaMm;
      const max = b.gabinete.maxCoolerMm;
      if (typeof altura !== "number" || typeof max !== "number") {
        salidas.push(resultado(
          "cooler_gabinete", ESTADOS.UNKNOWN,
          "Me falta la altura del cooler o el despeje del gabinete. Si el cooler toca el vidrio, es un problema.",
          C,
        ));
      } else if (altura <= max) {
        salidas.push(resultado(
          "cooler_gabinete", ESTADOS.OK,
          `El cooler (${altura}mm) entra en el gabinete (hasta ${max}mm).`,
          C,
        ));
      } else {
        salidas.push(resultado(
          "cooler_gabinete", ESTADOS.ERROR,
          `El cooler no entra: mide ${altura}mm y el gabinete banca hasta ${max}mm. Andá por un perfil más bajo.`,
          C,
        ));
      }
    }
  }
  return salidas;
}

function reglaAlmacenamiento(b) {
  const discos = comoLista(b.discos);
  if (discos.length === 0 || !b.mother) return null;
  const C = ["almacenamiento", "mother"];
  const nvme = discos.filter((d) => norm(d.tipo) === "NVME");
  const sata = discos.filter((d) => norm(d.tipo) === "SATA");
  const desconocidos = discos.filter((d) => !["NVME", "SATA"].includes(norm(d.tipo)));
  const salidas = [];
  for (const d of desconocidos) {
    salidas.push(resultado(
      "almacenamiento_slots", ESTADOS.UNKNOWN,
      `Del disco "${d.nombre ?? "sin nombre"}" no sé si es NVMe o SATA. Sin eso no puedo verificar los slots.`,
      C,
    ));
  }
  if (nvme.length > 0) {
    const slots = b.mother.puertosM2;
    if (typeof slots !== "number") {
      salidas.push(resultado(
        "almacenamiento_nvme", ESTADOS.UNKNOWN,
        "No sé cuántos slots M.2 trae el mother. Contalos en la ficha antes de sumar NVMes.",
        C,
      ));
    } else if (nvme.length <= slots) {
      salidas.push(resultado(
        "almacenamiento_nvme", ESTADOS.OK,
        `Tenés ${nvme.length} NVMe(s) para ${slots} slot(s) M.2. Entran todos.`,
        C,
      ));
    } else {
      salidas.push(resultado(
        "almacenamiento_nvme", ESTADOS.ERROR,
        `Te sobran NVMes: querés ${nvme.length} y el mother trae ${slots} slots M.2. Sacá uno o cambiá el mother.`,
        C,
      ));
    }
  }
  if (sata.length > 0) {
    const slots = b.mother.puertosSata;
    if (typeof slots !== "number") {
      salidas.push(resultado(
        "almacenamiento_sata", ESTADOS.UNKNOWN,
        "No sé cuántos SATA trae el mother, así que los discos SATA quedan pendientes de revisión.",
        C,
      ));
    } else if (sata.length <= slots) {
      salidas.push(resultado(
        "almacenamiento_sata", ESTADOS.OK,
        `Tenés ${sata.length} disco(s) SATA para ${slots} puertos. Van todos.`,
        C,
      ));
    } else {
      salidas.push(resultado(
        "almacenamiento_sata", ESTADOS.ERROR,
        `Te faltan SATA: querés ${sata.length} discos y el mother trae ${slots} puertos.`,
        C,
      ));
    }
  }
  return salidas;
}

function reglaIgpu(b) {
  if (!b.cpu) return null;
  const C = ["cpu", "gpu"];
  if (b.gpu) {
    return resultado(
      "cpu_gpu_video", ESTADOS.OK,
      "Tenés placa dedicada, así que el video está cubierto uses el CPU que uses.",
      C,
    );
  }
  const igpu = cpuTieneIGPU(b.cpu);
  if (igpu === true) {
    return resultado(
      "cpu_gpu_video", ESTADOS.OK,
      "No pusiste placa, pero tu CPU trae gráficos integrados. Zafás para usar la PC (para jugar en serio después sumás una GPU).",
      C,
    );
  }
  if (igpu === false) {
    return resultado(
      "cpu_gpu_video", ESTADOS.ERROR,
      "Ojo: tu CPU no trae gráficos integrados (serie F) y no pusiste placa de video. Te vas a quedar sin imagen; sumá una GPU.",
      C,
    );
  }
  return resultado(
    "cpu_gpu_video", ESTADOS.UNKNOWN,
    "No pusiste placa y no sé si tu CPU trae gráficos integrados. Confirmalo antes de comprar, porque sin video no hay PC que valga.",
    C,
  );
}

function reglaFuentePotencia(b) {
  if (!b.fuente) return null;
  const C = ["fuente", "cpu", "gpu"];
  const pot = b.fuente.potenciaW;
  const cpuW = b.cpu?.tdpW;
  const gpuW = b.gpu ? b.gpu.consumoW : 0;
  if (typeof pot !== "number" || typeof cpuW !== "number" || (b.gpu && typeof gpuW !== "number")) {
    return resultado(
      "fuente_potencia", ESTADOS.UNKNOWN,
      "Me faltan los consumos (TDP del CPU / consumo de la GPU) o la potencia de la fuente. Sin eso no te puedo decir si la fuente banca.",
      C,
    );
  }
  const estimada = potenciaEstimada({ cpuW, gpuW });
  if (estimada == null) {
    return resultado("fuente_potencia", ESTADOS.UNKNOWN, "No pude estimar el consumo con los datos que hay.", C);
  }
  const rec = b.gpu?.fuenteRecomendadaW;
  if (typeof rec === "number" && pot < rec) {
    return resultado(
      "fuente_potencia", ESTADOS.ERROR,
      `La fuente se queda corta: tenés ${pot}W y la placa pide mínimo ${rec}W. Subí a ${rec}W o más (estimado total con margen: ~${estimada}W).`,
      C,
    );
  }
  if (estimada > pot) {
    return resultado(
      "fuente_potencia", ESTADOS.ERROR,
      `No te alcanza la fuente: el consumo estimado con margen es ~${estimada}W y tenés ${pot}W. Buscá una más grande.`,
      C,
    );
  }
  if (estimada > pot * 0.8) {
    return resultado(
      "fuente_potencia", ESTADOS.WARN,
      `Vas justito: estimamos ~${estimada}W contra ${pot}W de fuente (más del 80%). Anda, pero si podés estirate a más potencia para ir holgado.`,
      C,
    );
  }
  return resultado(
    "fuente_potencia", ESTADOS.OK,
    `La fuente banca: estimamos ~${estimada}W con margen del 30% y tenés ${pot}W.`,
    C,
  );
}

function reglaFuenteConectores(b) {
  if (!b.fuente || !b.gpu) return null;
  const C = ["fuente", "gpu"];
  const salidas = [];
  if (b.gpu.requiere12VHPWR) {
    if (b.fuente.tiene12VHPWR === true) {
      salidas.push(resultado(
        "fuente_12vhpwr", ESTADOS.OK,
        "La fuente trae el 12VHPWR que pide la placa. Conectás directo, sin adaptadores raros.",
        C,
      ));
    } else if (b.fuente.tiene12VHPWR === false) {
      salidas.push(resultado(
        "fuente_12vhpwr", ESTADOS.ERROR,
        "La placa pide 12VHPWR y tu fuente no lo trae. Cambiá la fuente por una con 12VHPWR nativo (los adaptadores son un parche).",
        C,
      ));
    } else {
      salidas.push(resultado(
        "fuente_12vhpwr", ESTADOS.UNKNOWN,
        "La placa pide 12VHPWR y no sé si tu fuente lo trae. Fijate la ficha de la fuente.",
        C,
      ));
    }
  }
  const pide8 = b.gpu.conectores8pin ?? 0;
  if (pide8 > 0) {
    const tiene8 = b.fuente.conectores8pin;
    if (typeof tiene8 !== "number") {
      salidas.push(resultado(
        "fuente_8pin", ESTADOS.UNKNOWN,
        "La placa pide 8-pines y no sé cuántos trae tu fuente. Contalos en la ficha.",
        C,
      ));
    } else if (tiene8 >= pide8) {
      salidas.push(resultado(
        "fuente_8pin", ESTADOS.OK,
        `La fuente trae ${tiene8} conector(es) de 8-pines y la placa pide ${pide8}. Listo.`,
        C,
      ));
    } else {
      salidas.push(resultado(
        "fuente_8pin", ESTADOS.ERROR,
        `Te faltan conectores: la placa pide ${pide8} de 8-pines y la fuente trae ${tiene8}.`,
        C,
      ));
    }
  }
  return salidas.length > 0 ? salidas : null;
}

function reglaFuenteGabinete(b) {
  if (!b.fuente || !b.gabinete) return null;
  const C = ["fuente", "gabinete"];
  const f = norm(b.fuente.formato || "ATX");
  const aceptados = comoLista(b.gabinete.formatosFuente).map(norm).filter(Boolean);
  if (!b.fuente.formato && aceptados.length === 0) {
    return resultado(
      "fuente_gabinete", ESTADOS.UNKNOWN,
      "No sé el tamaño de la fuente ni los que acepta el gabinete. Verificá que la fuente entra.",
      C,
    );
  }
  if (aceptados.length === 0) {
    return resultado(
      "fuente_gabinete", ESTADOS.UNKNOWN,
      "No sé qué formatos de fuente acepta el gabinete. Fijate la ficha del gabo.",
      C,
    );
  }
  if (aceptados.includes(f)) {
    return resultado(
      "fuente_gabinete", ESTADOS.OK,
      `La fuente ${f} entra en el gabinete.`,
      C,
    );
  }
  return resultado(
    "fuente_gabinete", ESTADOS.ERROR,
    `La fuente ${f} no entra en el gabinete (acepta ${aceptados.join(", ")}).`,
    C,
  );
}

function reglaBios(b) {
  if (!b.cpu || !b.mother) return null;
  const C = ["cpu", "mother"];
  const chipset = norm(b.mother.chipset);
  const nombreCpu = String(b.cpu.nombre ?? "");
  if (!chipset || !nombreCpu) {
    return resultado(
      "bios_chipset", ESTADOS.UNKNOWN,
      "Sin el chipset del mother o el modelo exacto del CPU no puedo avisarte si vas a necesitar actualizar la BIOS.",
      C,
    );
  }
  const esIntel14 = /\b14\d{3}/.test(nombreCpu);
  const esIntel13 = /\b13\d{3}/.test(nombreCpu);
  const esAmd8000 = /\b8\d{3}[A-Z]?\b/.test(nombreCpu) && /RYZEN/i.test(nombreCpu);
  if ((esIntel14 || esIntel13) && ["B660", "Z690"].includes(chipset)) {
    return resultado(
      "bios_chipset", ESTADOS.WARN,
      `Ojo: ese ${chipset} seguro necesita actualizar la BIOS para tu CPU de 13va/14va gen. Pedí que te lo den actualizado o tené un pendrive a mano.`,
      C,
    );
  }
  if (esIntel14 && ["B760", "Z790", "H770"].includes(chipset)) {
    return resultado(
      "bios_chipset", ESTADOS.WARN,
      "Tu combo puede pedir actualización de BIOS (14va gen en serie 600/700). Revisá que el mother venga con BIOS actualizada.",
      C,
    );
  }
  if (esAmd8000 && ["B650", "X670", "B650E", "X670E"].includes(chipset)) {
    return resultado(
      "bios_chipset", ESTADOS.WARN,
      "Los Ryzen 8000 en placas B650/X670 de las primeras tandas a veces piden actualizar la BIOS. Confirmá que venga lista.",
      C,
    );
  }
  return resultado(
    "bios_chipset", ESTADOS.OK,
    "No vemos choque de generación entre CPU y chipset. Igual, siempre fijate la versión de BIOS en la ficha.",
    C,
  );
}

// ------------------------------------------------------------- evaluación ---

/**
 * Evalúa el build completo (reevaluación total, sin importar el orden).
 * @param {Build} build
 * @returns {{ resultados: Array, resumen: Object }}
 */
export function evaluarBuild(build = {}) {
  const b = build ?? {};
  const reglas = [
    reglaCpuSocket, reglaRamDdr, reglaRamCapacidad, reglaMotherGabinete,
    reglaGpuGabinete, reglaCooler, reglaAlmacenamiento, reglaIgpu,
    reglaFuentePotencia, reglaFuenteConectores, reglaFuenteGabinete, reglaBios,
  ];
  const resultados = [];
  for (const fn of reglas) {
    const r = fn(b);
    if (!r) continue;
    if (Array.isArray(r)) resultados.push(...r);
    else resultados.push(r);
  }
  const resumen = {
    total: resultados.length,
    ok: resultados.filter((r) => r.estado === ESTADOS.OK).length,
    warn: resultados.filter((r) => r.estado === ESTADOS.WARN).length,
    error: resultados.filter((r) => r.estado === ESTADOS.ERROR).length,
    unknown: resultados.filter((r) => r.estado === ESTADOS.UNKNOWN).length,
    bloqueada: resultados.some((r) => r.estado === ESTADOS.ERROR),
    tienePendientes: resultados.some((r) => r.estado === ESTADOS.UNKNOWN),
  };
  return { resultados, resumen };
}

/** Atajo: ¿el build tiene algún error bloqueante? */
export function esCompatible(build) {
  return evaluarBuild(build).resumen.bloqueada === false;
}

export default { evaluarBuild, esCompatible, cpuTieneIGPU, potenciaEstimada, ESTADOS };
