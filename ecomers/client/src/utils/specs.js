// Nombres legibles para las claves de `productos.especificaciones`
// (camelCase sin tildes en la base). Siglas y tildes se corrigen acá.
const PALABRAS = {
  nucleos: "núcleos",
  graficos: "gráficos",
  litografia: "litografía",
  pais: "país",
  cache: "caché",
  bahias: "bahías",
  tamanio: "tamaño",
  maxima: "máxima",
  maximo: "máximo",
  bateria: "batería",
  microfono: "micrófono",
  cancelacion: "cancelación",
  configuracion: "configuración",
  reclinacion: "reclinación",
  carga: "carga",
  vision: "visión",
  retroiluminacion: "retroiluminación",
  conexion: "conexión",
  iluminacion: "iluminación",
  refrigeracion: "refrigeración",
  certificacion: "certificación",
  proteccion: "protección",
  garantia: "garantía",
  tecnologia: "tecnología",
  rotacion: "rotación",
  resolucion: "resolución",
  lectura: "lectura",
  escritura: "escritura",
  reposamunecas: "reposamuñecas",
  pantalla: "pantalla",
  cuda: "CUDA",
  tdp: "TDP",
  tbw: "TBW",
  dpi: "DPI",
  avr: "AVR",
  bus: "bus",
  mb: "MB",
  usb: "USB",
  lan: "LAN",
  wifi: "Wi-Fi",
  pcie: "PCIe",
  ssd: "SSD",
  ram: "RAM",
  rgb: "RGB",
  lcd: "LCD",
  gpu: "GPU",
};

export function nombreSpec(clave = "") {
  const palabras = String(clave)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      const base = w.toLowerCase();
      if (PALABRAS[base]) return PALABRAS[base];
      // Siglas que ya vienen en mayúsculas (L3, M2, LCD…) se respetan.
      return w.length > 1 && w === w.toUpperCase() ? w : base;
    });
  const texto = palabras.join(" ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function valorSpec(valor, { si = "Sí", no = "No" } = {}) {
  if (typeof valor === "boolean") return valor ? si : no;
  if (Array.isArray(valor)) return valor.join(", ");
  return String(valor);
}
