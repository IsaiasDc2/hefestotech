// Características principales de un producto, tomadas de sus
// `especificaciones` reales (nada inventado): por categoría hay una lista de
// claves en orden de importancia; si faltan, se completa con otras
// especificaciones cortas. Devuelve datos planos; el ícono lo elige el
// componente según la clave.
import { nombreSpec, valorSpec } from "./specs";

// Orden de importancia por categoría (valores de `productos.categoria`).
const PRIORIDAD = {
  Procesador: ["nucleos", "hilos", "frecuenciaTurbo", "socket", "cacheL3"],
  "Placa de video": ["interfazMemoria", "frecuenciaBoost", "consumo", "fuenteRecomendada", "longitud", "conectores"],
  Motherboard: ["socket", "chipset", "formato", "memoriaMaxima", "puertosM2", "ranurasRAM"],
  "Memoria RAM": ["capacidad", "tipo", "velocidad", "latencia"],
  Almacenamiento: ["capacidad", "tipo", "interfaz", "velocidadLectura"],
  Fuente: ["potencia", "certificacion", "modular", "proteccion"],
  Gabinete: ["formato", "panelLateral", "ventiladoresIncluidos", "compatibilidadMB"],
  Monitor: ["tamanio", "resolucion", "tasaRefresco", "panel", "tiempoRespuesta"],
  Periferico: ["tipo", "conexion", "switches", "dpiMaximo", "formato"],
  Cooler: ["tipo", "tdpMaximo", "ventiladores", "ventilador", "socketsCompatibles"],
  Auriculares: ["tipo", "conexion", "sonido", "bateria"],
  Parlantes: ["configuracion", "potenciaTotal", "conectores", "certificacion"],
  "Silla Gamer": ["material", "cargaMaxima", "reclinacion", "apoyabrazos"],
  Mousepad: ["material", "dimensiones", "bordesCosidos", "iluminacionRGB"],
  UPS: ["capacidad", "tiempoRespaldo", "tomasBateria", "tipoOnda"],
  Webcam: ["resolucion", "campoVision", "enfoque", "conexion"],
};

// No aportan para decidir una compra a primera vista.
const IGNORADAS = new Set([
  "colorPrincipal",
  "colorDisponible",
  "colorDisipador",
  "paisOrigen",
  "garantiaFabricante",
]);

const LARGO_MAXIMO_VALOR = 28;

const esUtil = (valor) => {
  if (valor === null || valor === undefined || valor === "") return false;
  if (Array.isArray(valor)) return valor.length > 0 && valor.join(", ").length <= LARGO_MAXIMO_VALOR;
  if (typeof valor === "object") return false;
  return typeof valor === "boolean" || String(valor).length <= LARGO_MAXIMO_VALOR;
};

/**
 * @returns {Array<{clave: string, etiqueta: string, valor: string}>}
 */
export function destacadosProducto(producto, { idioma = "es", si = "Sí", no = "No", max = 4 } = {}) {
  const specs = producto?.especificaciones;
  if (!specs || typeof specs !== "object") return [];

  const claves = [];
  for (const clave of PRIORIDAD[producto.categoria] ?? []) {
    if (clave in specs && esUtil(specs[clave])) claves.push(clave);
  }
  for (const clave of Object.keys(specs)) {
    if (claves.length >= max) break;
    if (!claves.includes(clave) && !IGNORADAS.has(clave) && esUtil(specs[clave])) claves.push(clave);
  }

  return claves.slice(0, max).map((clave) => ({
    clave,
    etiqueta: nombreSpec(clave, idioma),
    valor: valorSpec(specs[clave], { si, no, idioma }),
  }));
}
