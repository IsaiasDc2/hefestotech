// HefestoTech · Admin · cliente HTTP del CONTRATO servido por backend/admin_api.py.
// Base: VITE_API_URL (mismo patrón que Checkout/Asistente). Auth: JWT de Supabase.
// Nunca se loguea ni se renderiza el token. Sin datos inventados: ante error,
// el llamador muestra "Próximamente" (ver ui.jsx `useModulo`).
import { supabase } from "../../components/lib/supabaseClient";

export const API_BASE = String(
  import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000"
).replace(/\/+$/, "");

async function sesionToken() {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? "";
  } catch {
    return "";
  }
}

export async function api(path, { method = "GET", body } = {}) {
  const t = await sesionToken();
  let respuesta;
  try {
    respuesta = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    const e = new Error("Sin conexión con el backend.");
    e.status = 0;
    throw e;
  }
  let datos = {};
  try {
    datos = await respuesta.json();
  } catch {
    datos = {};
  }
  if (!respuesta.ok) {
    const e = new Error(datos?.detail || `Error ${respuesta.status}`);
    e.status = respuesta.status;
    e.datos = datos;
    throw e;
  }
  return datos;
}

const q = (v) => encodeURIComponent(String(v ?? ""));

export const adminApi = {
  resumen: () => api("/api/admin/resumen"),
  productos: ({ papelera = false, busqueda = "", limit = 50, offset = 0 } = {}) =>
    api(
      `/api/admin/productos?papelera=${papelera ? "true" : "false"}` +
        (busqueda.trim() ? `&q=${q(busqueda.trim())}` : "") +
        `&limit=${limit}&offset=${offset}`
    ),
  crearProducto: (d) => api("/api/admin/productos", { method: "POST", body: d }),
  editarProducto: (id, d) => api(`/api/admin/productos/${q(id)}`, { method: "PUT", body: d }),
  subirImagenProducto: async (archivo) => {
    const t = await sesionToken();
    const forma = new FormData();
    forma.append("archivo", archivo);
    let respuesta;
    try {
      respuesta = await fetch(`${API_BASE}/api/admin/productos/imagen`, {
        method: "POST",
        headers: t ? { Authorization: `Bearer ${t}` } : {},
        body: forma,
      });
    } catch {
      const e = new Error("Sin conexión con el backend.");
      e.status = 0;
      throw e;
    }
    let datos = {};
    try {
      datos = await respuesta.json();
    } catch {
      datos = {};
    }
    if (!respuesta.ok) {
      throw new Error(datos?.detail || `Error ${respuesta.status}`);
    }
    return datos;
  },
  borrarProducto: (id) => api(`/api/admin/productos/${q(id)}`, { method: "DELETE" }),
  restaurarProducto: (id) => api(`/api/admin/productos/${q(id)}/restaurar`, { method: "POST" }),
  lotes: (id) => api(`/api/admin/productos/${q(id)}/lotes`),
  crearLote: (id, d) => api(`/api/admin/productos/${q(id)}/lotes`, { method: "POST", body: d }),
  ajustarStock: (d) => api("/api/admin/stock/ajustar", { method: "POST", body: d }),
  pedidos: ({ estado = "", limit = 50, offset = 0 } = {}) =>
    api(
      `/api/admin/pedidos?limit=${limit}&offset=${offset}` +
        (estado ? `&estado=${q(estado)}` : "")
    ),
  cambiarEstadoPedido: (id, d) =>
    api(`/api/admin/pedidos/${q(id)}/estado`, { method: "POST", body: d }),
  reclamos: ({ estado = "", limit = 50, offset = 0 } = {}) =>
    api(
      `/api/admin/reclamos?limit=${limit}&offset=${offset}` +
        (estado ? `&estado=${q(estado)}` : "")
    ),
  crearReclamo: (d) => api("/api/admin/reclamos", { method: "POST", body: d }),
  cambiarEstadoReclamo: (id, estado) =>
    api(`/api/admin/reclamos/${q(id)}`, { method: "PATCH", body: { estado } }),
  cupones: ({ limit = 50, offset = 0 } = {}) =>
    api(`/api/admin/cupones?limit=${limit}&offset=${offset}`),
  crearCupon: (d) => api("/api/admin/cupones", { method: "POST", body: d }),
  borrarCupon: (id) => api(`/api/admin/cupones/${q(id)}`, { method: "DELETE" }),
  banners: ({ limit = 50, offset = 0 } = {}) =>
    api(`/api/admin/banners?limit=${limit}&offset=${offset}`),
  crearBanner: (d) => api("/api/admin/banners", { method: "POST", body: d }),
  editarBanner: (id, d) => api(`/api/admin/banners/${q(id)}`, { method: "PUT", body: d }),
  borrarBanner: (id) => api(`/api/admin/banners/${q(id)}`, { method: "DELETE" }),
  notificaciones: ({ limit = 20, offset = 0 } = {}) =>
    api(`/api/admin/notificaciones?limit=${limit}&offset=${offset}`),
  buscar: (texto, limite = 20) =>
    api(`/api/buscar?q=${q(texto)}&limite=${limite}`),
  auditoria: ({ modulo = "", entidad = "", limit = 50, offset = 0 } = {}) =>
    api(
      `/api/admin/auditoria?limit=${limit}&offset=${offset}` +
        (modulo ? `&modulo=${q(modulo)}` : "") +
        (entidad ? `&entidad=${q(entidad)}` : "")
    ),
  reporteVentas: ({ desde = "", hasta = "" } = {}) =>
    api(
      `/api/admin/reportes/ventas` +
        (desde || hasta
          ? `?${desde ? `desde=${q(desde)}` : ""}${desde && hasta ? "&" : ""}${hasta ? `hasta=${q(hasta)}` : ""}`
          : "")
    ),
};

// Centavos enteros → "$ 12.345,67" (es-AR). Nunca floats para dinero.
export function formatoARS(centavos) {
  const n = Number(centavos ?? 0) / 100;
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

export function fechaCorta(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}
