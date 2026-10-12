/**
 * HefestoTech · Armador · Definición de pasos.
 *
 * 8 pasos esenciales en el orden en que conviene elegir (lo que más
 * condiciona la compatibilidad va primero) + paso final de extras
 * opcionales (todo lo que no es componente del build: monitores,
 * periféricos, sillas, etc.). Esos extras no los evalúa el motor.
 */

export const SLOT_MOTOR = Object.freeze({
  cpu: "cpu",
  mother: "mother",
  ram: "ram",
  gpu: "gpu",
  refrigeracion: "cooler",
  almacenamiento: "discos",
  gabinete: "gabinete",
  fuente: "fuente",
});

export const PASOS = Object.freeze([
  {
    id: "cpu",
    titulo: "Procesador",
    categorias: ["procesador"],
    slot: "cpu",
    esencial: true,
    consecuencia:
      "Sin procesador no hay PC: tampoco puedo estimar el consumo ni validar el socket del mother.",
  },
  {
    id: "mother",
    titulo: "Motherboard",
    categorias: ["motherboard"],
    slot: "mother",
    esencial: true,
    consecuencia:
      "Sin mother no puedo validar nada: socket, memoria, slots ni formato. Todo queda pendiente.",
  },
  {
    id: "ram",
    titulo: "Memoria RAM",
    categorias: ["memoria ram"],
    slot: "ram",
    esencial: true,
    consecuencia:
      "Sin RAM la PC no arranca. Además queda pendiente la validación de tipo DDR y ranuras.",
  },
  {
    id: "gpu",
    titulo: "Placa de video",
    categorias: ["placa de video"],
    slot: "gpu",
    esencial: false,
    consecuencia:
      "Si tu procesador no trae gráficos integrados (serie F) y salteás la placa, te quedás sin imagen.",
  },
  {
    id: "almacenamiento",
    titulo: "Almacenamiento",
    categorias: ["almacenamiento"],
    slot: "almacenamiento",
    esencial: true,
    consecuencia:
      "Sin disco no tenés dónde instalar el sistema. Además quedan pendientes los slots M.2/SATA.",
  },
  {
    id: "refrigeracion",
    titulo: "Refrigeración",
    categorias: ["cooler"],
    slot: "refrigeracion",
    esencial: false,
    consecuencia:
      "Vas a usar el cooler de stock del procesador. Si tu CPU levanta temperatura, revisá este paso después.",
  },
  {
    id: "gabinete",
    titulo: "Gabinete",
    categorias: ["gabinete"],
    slot: "gabinete",
    esencial: true,
    consecuencia:
      "Sin gabinete no puedo validar que entren el mother, la placa ni el cooler. Todo lo físico queda pendiente.",
  },
  {
    id: "fuente",
    titulo: "Fuente",
    categorias: ["fuente"],
    slot: "fuente",
    esencial: true,
    consecuencia:
      "Sin fuente no puedo validar la potencia ni los conectores de la placa. Es lo que le da de comer a todo.",
  },
]);

export const PASO_EXTRAS = Object.freeze({
  id: "extras",
  titulo: "Extras",
  categorias: [],
  slot: null,
  esencial: false,
  consecuencia: "",
});

export const TOTAL_PASOS = PASOS.length;
