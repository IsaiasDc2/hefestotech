// Motor de compatibilidad — Armador de PC (HefestoTech)
// Funciones puras, sin dependencias. ES modules.

const CATEGORIAS = ["cpu", "motherboard", "ram", "gpu", "almacenamiento", "fuente", "gabinete", "cooler"];
const POTENCIAS_STD = [450, 550, 650, 750, 850, 1000, 1200];

function num(v, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function spec(pieza) {
  return pieza && typeof pieza === "object" && pieza.specs && typeof pieza.specs === "object"
    ? pieza.specs
    : {};
}

function str(v) {
  return v == null ? "—" : String(v);
}

function normInterfaz(v) {
  return String(v ?? "").trim().toLowerCase();
}

function esM2(interfaz) {
  const s = normInterfaz(interfaz);
  return s.includes("m.2") || s.includes("nvme") || s === "m2";
}

function esSata(interfaz) {
  return normInterfaz(interfaz).includes("sata");
}

function hayPieza(p) {
  return p != null && typeof p === "object" && p.id != null;
}

function mkIssue(codigo, categoria, severidad, mensaje, sugerencia) {
  return { codigo, categoria, severidad, mensaje, sugerencia };
}

export function estimarConsumo(seleccion) {
  const s = seleccion && typeof seleccion === "object" ? seleccion : {};
  const cpuS = spec(s.cpu);
  const gpuS = spec(s.gpu);
  const tieneCpu = hayPieza(s.cpu);
  const tieneGpu = hayPieza(s.gpu);
  const tieneAlgo = CATEGORIAS.some((c) => {
    if (c === "almacenamiento") {
      return hayPieza(s.almacenamiento) || (Array.isArray(s.almacenamiento) && s.almacenamiento.some(hayPieza));
    }
    return hayPieza(s[c]);
  });
  if (!tieneAlgo) return 0;
  const cpuW = tieneCpu ? num(cpuS.tdp, 0) : 0;
  const gpuW = tieneGpu ? num(gpuS.consumoW, 0) : 0;
  let total = cpuW + gpuW + 70;
  if (tieneGpu) total += 30;
  return Math.round(total);
}

export function potenciaFuenteRecomendada(consumoW) {
  const objetivo = num(consumoW, 0) * 1.2;
  for (const p of POTENCIAS_STD) {
    if (p >= objetivo) return p;
  }
  return POTENCIAS_STD[POTENCIAS_STD.length - 1];
}

function pushIssue(issues, porPieza, issue) {
  issues.push(issue);
  if (!porPieza[issue.categoria]) porPieza[issue.categoria] = [];
  porPieza[issue.categoria].push(issue);
}

export function validarArmado(seleccion) {
  const s = seleccion && typeof seleccion === "object" ? seleccion : {};
  const cpu = hayPieza(s.cpu) ? s.cpu : null;
  const mother = hayPieza(s.motherboard) ? s.motherboard : null;
  const ram = hayPieza(s.ram) ? s.ram : null;
  const gpu = hayPieza(s.gpu) ? s.gpu : null;
  const fuente = hayPieza(s.fuente) ? s.fuente : null;
  const gab = hayPieza(s.gabinete) ? s.gabinete : null;
  const cooler = hayPieza(s.cooler) ? s.cooler : null;
  let almacenes = [];
  if (Array.isArray(s.almacenamiento)) almacenes = s.almacenamiento.filter(hayPieza);
  else if (hayPieza(s.almacenamiento)) almacenes = [s.almacenamiento];

  const cpuS = spec(cpu);
  const mS = spec(mother);
  const rS = spec(ram);
  const gS = spec(gpu);
  const fS = spec(fuente);
  const gabS = spec(gab);
  const cS = spec(cooler);

  const issues = [];
  const porPieza = {};
  for (const c of CATEGORIAS) {
    if (c === "almacenamiento") {
      if (almacenes.length > 0) porPieza[c] = [];
    } else if (hayPieza(s[c])) porPieza[c] = [];
  }

  // 1. CPU <-> Mother socket
  if (cpu && mother && cpuS.socket != null && mS.socket != null && String(cpuS.socket) !== String(mS.socket)) {
    pushIssue(issues, porPieza, mkIssue("CPU_SOCKET", "cpu", "error",
      `El socket del CPU (${str(cpuS.socket)}) no coincide con el de la mother (${str(mS.socket)}). Así no arranca.`,
      `Cambiá el CPU o la mother por modelos con el mismo socket (buscá socket ${str(mS.socket)} o ${str(cpuS.socket)} en ambos).`));
  }

  // 2. Mother <-> RAM
  if (mother && ram) {
    if (rS.tipo != null && mS.ramTipo != null && String(rS.tipo).toUpperCase() !== String(mS.ramTipo).toUpperCase()) {
      pushIssue(issues, porPieza, mkIssue("RAM_TIPO", "ram", "error",
        `Tu memoria es ${str(rS.tipo)} pero la mother solo acepta ${str(mS.ramTipo)}. No la vas a poder pinchar.`,
        `Elegí una memoria ${str(mS.ramTipo)} o cambiá la mother por una compatible con ${str(rS.tipo)}.`));
    }
    const modulos = num(rS.modulos, 1);
    const slots = num(mS.ramSlots, 0);
    if (slots > 0 && modulos > slots) {
      pushIssue(issues, porPieza, mkIssue("RAM_SLOTS", "ram", "error",
        `Querés poner ${modulos} módulos pero la mother tiene ${slots} slots. Te sobran.`,
        `Elegí un kit con ${slots} módulos como máximo o buscá una mother con más slots.`));
    }
    const capTotal = num(rS.capacidadGb, 0) * modulos;
    const maxGb = num(mS.ramMaxGb, 0);
    if (maxGb > 0 && capTotal > maxGb) {
      pushIssue(issues, porPieza, mkIssue("RAM_CAPACIDAD", "ram", "error",
        `Tenés ${capTotal} GB en total y la mother banca hasta ${maxGb} GB. Te pasaste.`,
        `Bajá la capacidad a ${maxGb} GB o menos, o elegí una mother que banque más RAM.`));
    }
    const vel = num(rS.velocidadMhz, 0);
    const maxMhz = num(mS.ramMaxMhz, 0);
    if (vel > 0 && maxMhz > 0 && vel > maxMhz) {
      pushIssue(issues, porPieza, mkIssue("RAM_VELOCIDAD", "ram", "advertencia",
        `Tu memoria es de ${vel} MHz pero la mother llega hasta ${maxMhz} MHz: la memoria va a correr a ${maxMhz} MHz.`,
        `Si querés aprovecharla al 100%, buscá una mother que banque ${vel} MHz o más.`));
    }
  }

  // 3. Mother <-> Gabinete formato
  if (mother && gab) {
    const fmt = mS.formato != null ? String(mS.formato).toUpperCase() : null;
    const formatos = Array.isArray(gabS.formatos) ? gabS.formatos.map((f) => String(f).toUpperCase()) : [];
    if (fmt && formatos.length > 0 && !formatos.includes(fmt)) {
      pushIssue(issues, porPieza, mkIssue("MOTHER_FORMATO", "gabinete", "error",
        `Tu mother es formato ${str(mS.formato)} y no entra en este gabinete (acepta: ${formatos.join(", ") || "—"}).`,
        `Elegí un gabinete que acepte formato ${str(mS.formato)} o una mother ${formatos.join("/")} compatible.`));
    }
  }

  // 4. GPU <-> Gabinete largo
  if (gpu && gab) {
    const largo = num(gS.largoMm, 0);
    const maxGpu = num(gabS.maxGpuMm, 0);
    if (largo > 0 && maxGpu > 0 && largo > maxGpu) {
      pushIssue(issues, porPieza, mkIssue("GPU_LARGO", "gpu", "error",
        `Tu placa mide ${largo} mm y el gabinete banca hasta ${maxGpu} mm. No te cierra.`,
        `Buscá una placa de ${maxGpu} mm o menos, o un gabinete más grande.`));
    }
  }

  // 5. Cooler <-> CPU
  if (cooler && cpu) {
    const sockCpu = cpuS.socket != null ? String(cpuS.socket) : null;
    const socks = Array.isArray(cS.sockets) ? cS.sockets.map((x) => String(x)) : [];
    if (sockCpu && socks.length > 0 && !socks.includes(sockCpu)) {
      pushIssue(issues, porPieza, mkIssue("COOLER_SOCKET", "cooler", "error",
        `Tu cooler no trae anclaje para el socket ${sockCpu} (soporta: ${socks.join(", ")}). No lo vas a poder montar.`,
        `Elegí un cooler compatible con socket ${sockCpu}.`));
    }
    const tdp = num(cpuS.tdp, 0);
    const tdpMax = num(cS.tdpMaxW, 0);
    if (tdp > 0 && tdpMax > 0) {
      if (tdp > tdpMax) {
        pushIssue(issues, porPieza, mkIssue("COOLER_TDP", "cooler", "error",
          `Tu CPU tira ${tdp} W y el cooler disipa hasta ${tdpMax} W. Se te va a cocinar.`,
          `Elegí un cooler que disipe al menos ${tdp} W.`));
      } else if (tdp > tdpMax * 0.85) {
        pushIssue(issues, porPieza, mkIssue("COOLER_TDP_JUSTO", "cooler", "advertencia",
          `Vas justo de refrigeración: el CPU tira ${tdp} W y el cooler banca ${tdpMax} W. En carga te puede hacer thermal throttle.`,
          `Si podés, subí a un cooler de ${Math.ceil(tdp / 0.85)} W o más para ir sobrado.`));
      }
    }
  }

  // 6. Cooler <-> Gabinete altura
  if (cooler && gab) {
    const alt = num(cS.alturaMm, 0);
    const maxC = num(gabS.maxCoolerMm, 0);
    if (alt > 0 && maxC > 0 && alt > maxC) {
      pushIssue(issues, porPieza, mkIssue("COOLER_ALTURA", "cooler", "error",
        `Tu cooler mide ${alt} mm de alto y el gabinete banca hasta ${maxC} mm. No te cierra la tapa.`,
        `Buscá un cooler de ${maxC} mm o menos, o un gabinete más alto.`));
    }
  }

  // 7. Fuente: potencia y conectores
  const consumoEstimadoW = estimarConsumo(s);
  const fuenteRecomendadaW = potenciaFuenteRecomendada(consumoEstimadoW);
  if (fuente && consumoEstimadoW > 0) {
    const pot = num(fS.potenciaW, 0);
    if (pot > 0 && pot < consumoEstimadoW) {
      pushIssue(issues, porPieza, mkIssue("FUENTE_POTENCIA_INSUFICIENTE", "fuente", "error",
        `Tu fuente de ${pot} W no alcanza: tu armado consume unos ${consumoEstimadoW} W. Ni la enchufes.`,
        `Elegí una fuente de al menos ${fuenteRecomendadaW} W para ir sobrado.`));
    } else if (pot > 0 && pot < fuenteRecomendadaW) {
      pushIssue(issues, porPieza, mkIssue("FUENTE_JUSTA", "fuente", "advertencia",
        `Vas justo: tu fuente es de ${pot} W y se recomienda ${fuenteRecomendadaW} W para este consumo (${consumoEstimadoW} W).`,
        `Si podés, subí a una de ${fuenteRecomendadaW} W para tener un 20% de margen.`));
    }
  } else if (!fuente && consumoEstimadoW > 0) {
    pushIssue(issues, porPieza, mkIssue("FUENTE_FALTANTE", "fuente", "advertencia",
      `Todavía no elegiste fuente: para este consumo (~${consumoEstimadoW} W) necesitás una de al menos ${fuenteRecomendadaW} W.`,
      `Elegí una fuente de al menos ${fuenteRecomendadaW} W con los conectores que pida tu placa.`));
  }
  if (gpu && fuente) {
    const req = num(gS.pcie8pin, 0);
    const disp = num(fS.pcie8pin, 0);
    if (req > 0 && req > disp) {
      pushIssue(issues, porPieza, mkIssue("FUENTE_CONECTORES", "fuente", "error",
        `Tu placa pide ${req} conector(es) de 8 pines y tu fuente trae ${disp}. No la vas a poder alimentar.`,
        `Elegí una fuente con al menos ${req} conector(es) PCIe de 8 pines.`));
    }
  }

  // 8. Almacenamiento <-> Mother
  if (mother && almacenes.length > 0) {
    const m2 = num(mS.m2Slots, 0);
    const sata = num(mS.sataPuertos, 0);
    for (const a of almacenes) {
      const aS = spec(a);
      if (esM2(aS.interfaz) && m2 < 1) {
        pushIssue(issues, porPieza, mkIssue("ALMACEN_M2", "almacenamiento", "error",
          `Tu almacenamiento M.2 no tiene dónde ir: la mother no tiene slots M.2 libres.`,
          `Cambiá a un disco SATA o elegí una mother con slot M.2.`));
      } else if (esSata(aS.interfaz) && sata < 1) {
        pushIssue(issues, porPieza, mkIssue("ALMACEN_SATA", "almacenamiento", "error",
          `Tu disco SATA no tiene dónde ir: la mother no tiene puertos SATA libres.`,
          `Elegí un disco M.2 o una mother con puertos SATA disponibles.`));
      }
    }
  }

  // 9. Sin video
  if (cpu && !gpu) {
    const tieneVideo = cpuS.videoIntegrado === true;
    if (!tieneVideo) {
      pushIssue(issues, porPieza, mkIssue("SIN_VIDEO", "gpu", "advertencia",
        `Ojo: tu CPU no tiene video integrado y no elegiste placa de video. No vas a tener video.`,
        `Agregá una placa de video o cambiá a un CPU con video integrado.`));
    }
  }

  let estado = "ok";
  if (issues.some((i) => i.severidad === "error")) estado = "errores";
  else if (issues.length > 0) estado = "advertencias";

  return { issues, porPieza, estado, consumoEstimadoW, fuenteRecomendadaW };
}

export function evaluarPieza(pieza, seleccion) {
  if (!pieza || typeof pieza !== "object" || pieza.categoria == null) {
    return { compatible: false, motivos: [] };
  }
  const s = seleccion && typeof seleccion === "object" ? { ...seleccion } : {};
  s[pieza.categoria] = pieza;
  const res = validarArmado(s);
  const motivos = res.issues.filter((i) => i.severidad === "error");
  return { compatible: motivos.length === 0, motivos };
}

export function validarCambioClave(seleccion) {
  const res = validarArmado(seleccion);
  const afectadas = [...new Set(res.issues.map((i) => i.categoria))];
  return { ...res, afectadas };
}
