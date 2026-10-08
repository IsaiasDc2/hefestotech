// Catálogo mock Armador de PC - HefestoTech
// Precios ARS Argentina 2026 aprox. gama media/alta. imagen "" = la UI usa icono por categoría.

export const CATEGORIAS = [
  { id: "cpu", nombre: "Procesador", icono: "cpu" },
  { id: "motherboard", nombre: "Placa madre", icono: "motherboard" },
  { id: "ram", nombre: "Memoria RAM", icono: "ram" },
  { id: "gpu", nombre: "Placa de video", icono: "gpu" },
  { id: "almacenamiento", nombre: "Almacenamiento", icono: "almacenamiento" },
  { id: "fuente", nombre: "Fuente", icono: "fuente" },
  { id: "gabinete", nombre: "Gabinete", icono: "gabinete" },
  { id: "cooler", nombre: "Refrigeración", icono: "cooler" },
];

export const ORDEN_PASOS = CATEGORIAS.map((c) => c.id);

export const nombreCategoria = (id) =>
  CATEGORIAS.find((c) => c.id === id)?.nombre ?? id;

export const CATALOGO = [
  // ---- CPU (5) ----
  { id: "cpu1", categoria: "cpu", marca: "AMD", nombre: "Ryzen 5 5600 6 núcleos 4.4GHz", precio: 185000, stock: 12, imagen: "", specs: { socket: "AM4", tdp: 65, nucleos: 6, frecuenciaGhz: 4.4, videoIntegrado: false } },
  { id: "cpu2", categoria: "cpu", marca: "AMD", nombre: "Ryzen 7 7800X3D 8 núcleos 5.0GHz", precio: 580000, precioAnterior: 649999, stock: 6, imagen: "", specs: { socket: "AM5", tdp: 120, nucleos: 8, frecuenciaGhz: 5.0, videoIntegrado: false } },
  { id: "cpu3", categoria: "cpu", marca: "Intel", nombre: "Core i5-12400F 6 núcleos 4.4GHz", precio: 220000, precioAnterior: 249999, stock: 10, imagen: "", specs: { socket: "LGA1700", tdp: 117, nucleos: 6, frecuenciaGhz: 4.4, videoIntegrado: false } },
  { id: "cpu4", categoria: "cpu", marca: "Intel", nombre: "Core Ultra 5 245K 14 núcleos 5.2GHz", precio: 450000, stock: 0, imagen: "", specs: { socket: "LGA1851", tdp: 159, nucleos: 14, frecuenciaGhz: 5.2, videoIntegrado: true } },
  { id: "cpu5", categoria: "cpu", marca: "AMD", nombre: "Ryzen 5 8600G 6 núcleos 5.0GHz con video integrado", precio: 320000, stock: 8, imagen: "", specs: { socket: "AM5", tdp: 65, nucleos: 6, frecuenciaGhz: 5.0, videoIntegrado: true } },

  // ---- MOTHERBOARD (5) ----
  { id: "mb1", categoria: "motherboard", marca: "ASUS", nombre: "Prime B550M-A WiFi II AM4 DDR4", precio: 180000, stock: 9, imagen: "", specs: { socket: "AM4", ramTipo: "DDR4", ramSlots: 4, ramMaxGb: 128, ramMaxMhz: 4400, formato: "mATX", m2Slots: 2, sataPuertos: 4 } },
  { id: "mb2", categoria: "motherboard", marca: "MSI", nombre: "MAG B650 Tomahawk WiFi AM5 DDR5", precio: 340000, precioAnterior: 379999, stock: 7, imagen: "", specs: { socket: "AM5", ramTipo: "DDR5", ramSlots: 4, ramMaxGb: 192, ramMaxMhz: 7200, formato: "ATX", m2Slots: 3, sataPuertos: 6 } },
  { id: "mb3", categoria: "motherboard", marca: "Gigabyte", nombre: "H610M H DDR4 LGA1700", precio: 150000, stock: 11, imagen: "", specs: { socket: "LGA1700", ramTipo: "DDR4", ramSlots: 2, ramMaxGb: 64, ramMaxMhz: 3200, formato: "mATX", m2Slots: 1, sataPuertos: 4 } },
  { id: "mb4", categoria: "motherboard", marca: "ASUS", nombre: "Prime Z890-P WiFi LGA1851 DDR5", precio: 480000, stock: 4, imagen: "", specs: { socket: "LGA1851", ramTipo: "DDR5", ramSlots: 4, ramMaxGb: 192, ramMaxMhz: 8600, formato: "ATX", m2Slots: 4, sataPuertos: 4 } },
  { id: "mb5", categoria: "motherboard", marca: "Gigabyte", nombre: "B650I Aorus Ultra ITX AM5 DDR5", precio: 380000, stock: 5, imagen: "", specs: { socket: "AM5", ramTipo: "DDR5", ramSlots: 2, ramMaxGb: 96, ramMaxMhz: 8000, formato: "ITX", m2Slots: 2, sataPuertos: 2 } },

  // ---- RAM (5) ----
  { id: "ram1", categoria: "ram", marca: "Corsair", nombre: "Vengeance LPX 16GB (2x8) DDR4 3200MHz", precio: 75000, stock: 15, imagen: "", specs: { tipo: "DDR4", capacidadGb: 8, modulos: 2, velocidadMhz: 3200 } },
  { id: "ram2", categoria: "ram", marca: "Kingston", nombre: "Fury Beast RGB 32GB (2x16) DDR5 6000MHz", precio: 185000, precioAnterior: 209999, stock: 8, imagen: "", specs: { tipo: "DDR5", capacidadGb: 16, modulos: 2, velocidadMhz: 6000 } },
  { id: "ram3", categoria: "ram", marca: "Kingston", nombre: "Fury Beast 16GB (1x16) DDR4 3200MHz", precio: 70000, stock: 20, imagen: "", specs: { tipo: "DDR4", capacidadGb: 16, modulos: 1, velocidadMhz: 3200 } },
  { id: "ram4", categoria: "ram", marca: "Corsair", nombre: "Vengeance 16GB (2x8) DDR5 5200MHz", precio: 110000, stock: 0, imagen: "", specs: { tipo: "DDR5", capacidadGb: 8, modulos: 2, velocidadMhz: 5200 } },
  { id: "ram5", categoria: "ram", marca: "ADATA", nombre: "XPG Lancer 16GB (1x16) DDR5 5600MHz", precio: 95000, stock: 10, imagen: "", specs: { tipo: "DDR5", capacidadGb: 16, modulos: 1, velocidadMhz: 5600 } },

  // ---- GPU (5) ----
  { id: "gpu1", categoria: "gpu", marca: "MSI", nombre: "GeForce RTX 4060 Ventus 2X 8GB", precio: 520000, stock: 7, imagen: "", specs: { largoMm: 245, consumoW: 115, pcie8pin: 1 } },
  { id: "gpu2", categoria: "gpu", marca: "ASUS", nombre: "GeForce RTX 4070 SUPER Dual 12GB", precio: 1100000, precioAnterior: 1249999, stock: 4, imagen: "", specs: { largoMm: 310, consumoW: 220, pcie8pin: 2 } },
  { id: "gpu3", categoria: "gpu", marca: "Gigabyte", nombre: "Radeon RX 7600 Gaming OC 8GB", precio: 480000, precioAnterior: 529999, stock: 9, imagen: "", specs: { largoMm: 282, consumoW: 165, pcie8pin: 1 } },
  { id: "gpu4", categoria: "gpu", marca: "ASUS", nombre: "GeForce RTX 4090 ROG Strix 24GB", precio: 2450000, stock: 3, imagen: "", specs: { largoMm: 357, consumoW: 450, pcie8pin: 3 } },
  { id: "gpu5", categoria: "gpu", marca: "Gigabyte", nombre: "GeForce GTX 1650 D6 OC 4GB (sin conector extra)", precio: 250000, stock: 0, imagen: "", specs: { largoMm: 191, consumoW: 75, pcie8pin: 0 } },

  // ---- ALMACENAMIENTO (5) ----
  { id: "ssd1", categoria: "almacenamiento", marca: "Samsung", nombre: "980 1TB M.2 NVMe PCIe 3.0", precio: 130000, stock: 14, imagen: "", specs: { interfaz: "M.2", tipo: "NVMe" } },
  { id: "ssd2", categoria: "almacenamiento", marca: "WD", nombre: "Blue SN580 1TB M.2 NVMe PCIe 4.0", precio: 110000, precioAnterior: 129999, stock: 12, imagen: "", specs: { interfaz: "M.2", tipo: "NVMe" } },
  { id: "ssd3", categoria: "almacenamiento", marca: "Kingston", nombre: "A400 480GB SATA 2.5", precio: 65000, stock: 18, imagen: "", specs: { interfaz: "SATA", tipo: "SATA" } },
  { id: "ssd4", categoria: "almacenamiento", marca: "Seagate", nombre: "BarraCuda 2TB HDD SATA 7200RPM", precio: 110000, stock: 6, imagen: "", specs: { interfaz: "SATA", tipo: "SATA" } },
  { id: "ssd5", categoria: "almacenamiento", marca: "Samsung", nombre: "990 Pro 2TB M.2 NVMe PCIe 4.0 con disipador", precio: 280000, stock: 0, imagen: "", specs: { interfaz: "M.2", tipo: "NVMe" } },

  // ---- FUENTE (5) ----
  { id: "psu1", categoria: "fuente", marca: "EVGA", nombre: "650 BR 650W 80 Plus Bronze", precio: 110000, stock: 10, imagen: "", specs: { potenciaW: 650, pcie8pin: 2, certificacion: "80 Plus Bronze" } },
  { id: "psu2", categoria: "fuente", marca: "Corsair", nombre: "CX750M 750W 80 Plus Bronze semi-modular", precio: 145000, stock: 8, imagen: "", specs: { potenciaW: 750, pcie8pin: 2, certificacion: "80 Plus Bronze" } },
  { id: "psu3", categoria: "fuente", marca: "Thermaltake", nombre: "Toughpower GF1 850W 80 Plus Gold full modular", precio: 210000, precioAnterior: 239999, stock: 5, imagen: "", specs: { potenciaW: 850, pcie8pin: 4, certificacion: "80 Plus Gold" } },
  { id: "psu4", categoria: "fuente", marca: "Thermaltake", nombre: "Smart 500W 80 Plus White", precio: 70000, stock: 13, imagen: "", specs: { potenciaW: 500, pcie8pin: 1, certificacion: "80 Plus White" } },
  { id: "psu5", categoria: "fuente", marca: "Cooler Master", nombre: "MWE Gold 1000W 80 Plus Gold full modular", precio: 280000, stock: 3, imagen: "", specs: { potenciaW: 1000, pcie8pin: 6, certificacion: "80 Plus Gold" } },

  // ---- GABINETE (5) ----
  { id: "gab1", categoria: "gabinete", marca: "NZXT", nombre: "H5 Flow vidrio templado ATX", precio: 150000, precioAnterior: 174999, stock: 6, imagen: "", specs: { formatos: ["ATX", "mATX", "ITX"], maxGpuMm: 365, maxCoolerMm: 165 } },
  { id: "gab2", categoria: "gabinete", marca: "Thermaltake", nombre: "Versa H17 micro torre mATX", precio: 85000, stock: 9, imagen: "", specs: { formatos: ["mATX", "ITX"], maxGpuMm: 315, maxCoolerMm: 155 } },
  { id: "gab3", categoria: "gabinete", marca: "Cooler Master", nombre: "MasterBox Q300L mATX", precio: 95000, stock: 7, imagen: "", specs: { formatos: ["mATX", "ITX"], maxGpuMm: 360, maxCoolerMm: 157 } },
  { id: "gab4", categoria: "gabinete", marca: "NZXT", nombre: "H1 Mini ITX compacto", precio: 220000, stock: 4, imagen: "", specs: { formatos: ["ITX"], maxGpuMm: 210, maxCoolerMm: 135 } },
  { id: "gab5", categoria: "gabinete", marca: "Corsair", nombre: "4000D Airflow ATX", precio: 160000, stock: 0, imagen: "", specs: { formatos: ["ATX", "mATX", "ITX"], maxGpuMm: 370, maxCoolerMm: 170 } },

  // ---- COOLER (5) ----
  { id: "cool1", categoria: "cooler", marca: "Cooler Master", nombre: "Hyper 212 EVO V2 por aire", precio: 55000, stock: 16, imagen: "", specs: { sockets: ["AM4", "AM5", "LGA1700", "LGA1851"], tdpMaxW: 150, alturaMm: 155 } },
  { id: "cool2", categoria: "cooler", marca: "DeepCool", nombre: "AK400 por aire 220W", precio: 65000, stock: 11, imagen: "", specs: { sockets: ["AM4", "AM5", "LGA1700", "LGA1851"], tdpMaxW: 220, alturaMm: 155 } },
  { id: "cool3", categoria: "cooler", marca: "Corsair", nombre: "H100i líquida 240mm", precio: 180000, precioAnterior: 199999, stock: 5, imagen: "", specs: { sockets: ["AM4", "AM5", "LGA1700", "LGA1851"], tdpMaxW: 300, alturaMm: 53 } },
  { id: "cool4", categoria: "cooler", marca: "NZXT", nombre: "Kraken 240 líquida 240mm", precio: 200000, stock: 0, imagen: "", specs: { sockets: ["AM4", "AM5", "LGA1700"], tdpMaxW: 320, alturaMm: 55 } },
  { id: "cool5", categoria: "cooler", marca: "Thermaltake", nombre: "UX100 bajo perfil RGB", precio: 35000, stock: 14, imagen: "", specs: { sockets: ["AM4", "AM5", "LGA1700", "LGA1851"], tdpMaxW: 95, alturaMm: 65 } },
];

export const piezaPorId = (id) => CATALOGO.find((p) => p.id === id) ?? null;

export const piezasPorCategoria = (categoria) =>
  CATALOGO.filter((p) => p.categoria === categoria);
