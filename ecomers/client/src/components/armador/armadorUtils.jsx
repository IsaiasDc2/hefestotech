import {
  FaMicrochip,
  FaDiagramProject,
  FaMemory,
  FaVideo,
  FaHardDrive,
  FaPlug,
  FaBox,
  FaFan,
} from "react-icons/fa6";

export const ICONOS_CATEGORIA = {
  cpu: FaMicrochip,
  motherboard: FaDiagramProject,
  ram: FaMemory,
  gpu: FaVideo,
  almacenamiento: FaHardDrive,
  fuente: FaPlug,
  gabinete: FaBox,
  cooler: FaFan,
};

export function IconoCategoria({ categoria, ...props }) {
  const Icono = ICONOS_CATEGORIA[categoria] ?? FaBox;
  return <Icono aria-hidden="true" {...props} />;
}

// Ahorro por descuento: null si no hay precioAnterior válido.
export function ahorro(pieza) {
  const actual = Number(pieza?.precio ?? 0);
  const anterior = Number(pieza?.precioAnterior ?? 0);
  if (!Number.isFinite(anterior) || anterior <= actual) return null;
  const monto = anterior - actual;
  const porcentaje = Math.round((monto / anterior) * 100);
  return { monto, porcentaje };
}

// 2-3 specs clave por categoría para la tarjeta del catálogo.
export function specsClave(pieza) {
  const s = pieza?.specs ?? {};
  switch (pieza?.categoria) {
    case "cpu":
      return [
        `Socket ${s.socket ?? "—"}`,
        `${s.nucleos ?? "—"} núcleos · ${s.frecuenciaGhz ?? "—"} GHz`,
        `TDP ${s.tdp ?? "—"} W${s.videoIntegrado ? " · Video integrado" : ""}`,
      ];
    case "motherboard":
      return [
        `Socket ${s.socket ?? "—"}`,
        `RAM ${s.ramTipo ?? "—"} hasta ${s.ramMaxMhz ?? "—"} MHz`,
        `Formato ${s.formato ?? "—"} · ${s.m2Slots ?? 0} M.2`,
      ];
    case "ram":
      return [
        `${(Number(s.capacidadGb) || 0) * (Number(s.modulos) || 0)} GB (${s.modulos ?? "—"}x${s.capacidadGb ?? "—"}) ${s.tipo ?? ""}`,
        `${s.velocidadMhz ?? "—"} MHz`,
      ];
    case "gpu":
      return [
        `Largo ${s.largoMm ?? "—"} mm`,
        `Consume ${s.consumoW ?? "—"} W`,
      ];
    case "almacenamiento":
      return [`${s.interfaz ?? "—"} · ${s.tipo ?? "—"}`];
    case "fuente":
      return [
        `${s.potenciaW ?? "—"} W · ${s.certificacion ?? "—"}`,
        `${s.pcie8pin ?? 0} conectores PCIe 8 pines`,
      ];
    case "gabinete":
      return [
        `Acepta ${(s.formatos ?? []).join(" / ") || "—"}`,
        `GPU hasta ${s.maxGpuMm ?? "—"} mm · Cooler hasta ${s.maxCoolerMm ?? "—"} mm`,
      ];
    case "cooler":
      return [
        `Disipa hasta ${s.tdpMaxW ?? "—"} W`,
        `Altura ${s.alturaMm ?? "—"} mm`,
      ];
    default:
      return [];
  }
}
