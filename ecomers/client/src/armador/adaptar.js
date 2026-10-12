/**
 * HefestoTech · Armador · Adaptador producto → objeto normalizado del motor.
 *
 * Fuente ÚNICA: la tabla `product_specs` (migración 005), solo filas con
 * `verified = true`. Si un producto no tiene specs verificadas, el adaptador
 * devuelve solo `{ nombre }` y el motor informa `unknown` (jamás se asume
 * compatible por defecto). Acá no se infiere nada del nombre.
 */

const comoNumero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const comoTexto = (v) => {
  const t = String(v ?? "").trim();
  return t ? t : undefined;
};

const comoBooleano = (v) => (typeof v === "boolean" ? v : undefined);

const comoListaTexto = (v) => {
  if (!Array.isArray(v)) return undefined;
  const lista = v.map((x) => String(x ?? "").trim()).filter(Boolean);
  return lista.length > 0 ? lista : undefined;
};

/** Agrupa filas de product_specs por producto_id: Map<id, {clave: valor}>. */
export function mapaSpecs(filas = []) {
  const mapa = new Map();
  for (const f of filas ?? []) {
    if (!f || f.producto_id == null || !f.clave) continue;
    if (!mapa.has(f.producto_id)) mapa.set(f.producto_id, {});
    mapa.get(f.producto_id)[f.clave] = f.valor;
  }
  return mapa;
}

function conNombre(producto, resto = {}) {
  const spec = { nombre: producto?.nombre ?? "", ...resto };
  for (const k of Object.keys(spec)) {
    if (spec[k] === undefined) delete spec[k];
  }
  return spec;
}

/**
 * Adapta un producto (con `_specs` ya inyectadas) al formato que pide
 * el motor para el slot indicado.
 */
export function adaptarProducto(producto, slot) {
  const s = producto?._specs ?? {};
  switch (slot) {
    case "cpu":
      return conNombre(producto, {
        socket: comoTexto(s.socket),
        tdpW: comoNumero(s.tdpW),
        tieneIGPU: comoBooleano(s.tieneIGPU),
      });
    case "mother":
      return conNombre(producto, {
        socket: comoTexto(s.socket),
        memoriaTipo: comoTexto(s.memoriaTipo),
        ranurasRAM: comoNumero(s.ranurasRAM),
        memoriaMaximaGB: comoNumero(s.memoriaMaximaGB),
        formato: comoTexto(s.formato),
        puertosM2: comoNumero(s.puertosM2),
        puertosSata: comoNumero(s.puertosSata),
        chipset: comoTexto(s.chipset),
      });
    case "ram":
      return conNombre(producto, {
        tipo: comoTexto(s.tipo),
        formatoModulo: comoTexto(s.formatoModulo),
        capacidadGB: comoNumero(s.capacidadGB),
        modulos: comoNumero(s.modulos),
      });
    case "gpu":
      return conNombre(producto, {
        longitudMm: comoNumero(s.longitudMm),
        consumoW: comoNumero(s.consumoW),
        fuenteRecomendadaW: comoNumero(s.fuenteRecomendadaW),
        conectores8pin: comoNumero(s.conectores8pin),
        requiere12VHPWR: comoBooleano(s.requiere12VHPWR),
      });
    case "refrigeracion":
      return conNombre(producto, {
        tipo: comoTexto(s.tipo),
        sockets: comoListaTexto(s.sockets),
        alturaMm: comoNumero(s.alturaMm),
        radiadorMm: comoNumero(s.radiadorMm),
        tdpMaximoW: comoNumero(s.tdpMaximoW),
      });
    case "almacenamiento":
      return conNombre(producto, { tipo: comoTexto(s.tipo) });
    case "fuente":
      return conNombre(producto, {
        potenciaW: comoNumero(s.potenciaW),
        tiene12VHPWR: comoBooleano(s.tiene12VHPWR),
        conectores8pin: comoNumero(s.conectores8pin),
        formato: comoTexto(s.formato),
      });
    case "gabinete":
      return conNombre(producto, {
        formatosMother: comoListaTexto(s.formatosMother),
        maxGpuMm: comoNumero(s.maxGpuMm),
        maxCoolerMm: comoNumero(s.maxCoolerMm),
        radiadorMaxMm: comoNumero(s.radiadorMaxMm),
        formatosFuente: comoListaTexto(s.formatosFuente),
      });
    default:
      return conNombre(producto);
  }
}

/** Precio final real del producto (respeta ofertas, no inventa nada). */
export function precioFinal(producto) {
  return Number(producto?.precio_con_descuento ?? producto?.precio ?? 0);
}

export default { mapaSpecs, adaptarProducto, precioFinal };
