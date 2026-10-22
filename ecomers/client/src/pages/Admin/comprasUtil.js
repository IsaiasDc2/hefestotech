// HefestoTech · Admin · utilidades puras de Proveedores y Compras.
// El backend vuelve a validar todo (admin_api.py); esto solo adelanta el
// error en el formulario.

const PESOS_CUIT = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
const PREFIJOS_CUIT = new Set(["20", "23", "24", "25", "26", "27", "30", "33", "34"]);

export const soloDigitos = (v) => String(v ?? "").replace(/\D/g, "");

// Espejo de `_cuit_valido` (backend) y `cuit_valido()` (014).
export function cuitValido(valor) {
  const c = soloDigitos(valor);
  if (c.length !== 11 || !PREFIJOS_CUIT.has(c.slice(0, 2))) return false;
  const suma = PESOS_CUIT.reduce((acc, p, i) => acc + Number(c[i]) * p, 0);
  const resto = 11 - (suma % 11);
  const dv = resto === 11 ? 0 : resto;
  return dv !== 10 && dv === Number(c[10]);
}

export function formatearCuit(valor) {
  const c = soloDigitos(valor);
  return c.length === 11 ? `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}` : c;
}

// "1.234,56" | "1234.56" | 1234.56 → 123456 centavos, sin pasar por floats
// con decimales sueltos. Devuelve null si no es un monto válido.
export function aCentavos(valor) {
  let t = String(valor ?? "").trim().replace(/\s|\$/g, "");
  if (!t) return 0;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null;
  const [entero, dec = ""] = t.split(".");
  return Number(entero) * 100 + Number(dec.padEnd(2, "0"));
}

export const centavosATexto = (c) => {
  const n = Number(c ?? 0);
  return `${Math.trunc(n / 100)},${String(Math.abs(n % 100)).padStart(2, "0")}`;
};

export function formatoMoneda(centavos, moneda = "ARS") {
  const n = Number(centavos ?? 0) / 100;
  return n.toLocaleString("es-AR", { style: "currency", currency: moneda === "USD" ? "USD" : "ARS" });
}

export const ESTADOS_PROVEEDOR = {
  activo: "Activo",
  en_evaluacion: "En evaluación",
  inactivo: "Inactivo",
};

export const CONDICIONES_IVA = {
  responsable_inscripto: "Responsable inscripto",
  monotributo: "Monotributo",
  exento: "Exento",
  no_responsable: "No responsable",
  consumidor_final: "Consumidor final",
};

export const CONDICIONES_PAGO = {
  contado: "Contado",
  "15_dias": "15 días",
  "30_dias": "30 días",
  "60_dias": "60 días",
};

export const ESTADOS_OC = {
  borrador: "Borrador",
  enviada: "Enviada",
  confirmada: "Confirmada",
  recibida_parcial: "Recibida parcial",
  recibida: "Recibida",
  cancelada: "Cancelada",
};

// Espejo de TRANSICIONES_OC (backend): solo para decidir qué botones mostrar.
export const ACCIONES_OC = {
  borrador: [
    { a: "enviada", etiqueta: "Marcar enviada" },
    { a: "cancelada", etiqueta: "Cancelar", peligro: true },
  ],
  enviada: [
    { a: "confirmada", etiqueta: "Marcar confirmada" },
    { a: "cancelada", etiqueta: "Cancelar", peligro: true },
  ],
  confirmada: [{ a: "cancelada", etiqueta: "Cancelar", peligro: true }],
  recibida_parcial: [{ a: "cancelada", etiqueta: "Cerrar saldo", peligro: true }],
};

export const OC_RECIBIBLES = new Set(["enviada", "confirmada", "recibida_parcial"]);
