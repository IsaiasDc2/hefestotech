// URL base del backend (mismo VITE_API_URL que Checkout/Asistente/Admin).
// Sin barra final para poder concatenar rutas sin duplicarla.
export const API_BASE = String(
  import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000"
).replace(/\/+$/, "");
