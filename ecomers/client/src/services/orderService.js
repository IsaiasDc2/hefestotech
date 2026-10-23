// HefestoTech · Checkout contra el backend (/api/checkout/*).
// El cliente NUNCA inserta órdenes ni precios directo en Supabase: envía
// solo producto_id + cantidad y el servidor recalcula todo desde la DB.
// Se conservan las lecturas propias por RLS (mis órdenes / por id).
import { supabase } from "../components/lib/supabaseClient";
import { mensajeDeError } from "../utils/errores";

// Se resuelve al usarse (no al importar): sin VITE_API_URL en producción
// falla solo la llamada al backend, no la página entera que importa esto.
const apiBase = () => {
  const base = String(import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
  if (!base && import.meta.env.PROD) {
    // En prod sin VITE_API_URL el pago apuntaría a localhost: falla claro.
    throw new Error("Backend no configurado (VITE_API_URL).");
  }
  return base || "http://127.0.0.1:8000";
};

const sesionToken = async () => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? "";
  } catch {
    return "";
  }
};

// El token de invitado viaja por header (X-Orden-Token), no en la URL:
// así no queda en el historial, en logs de proxies ni en el Referer.
const backend = async (path, { method = "GET", body, tokenOrden = "" } = {}) => {
  const t = await sesionToken();
  const base = apiBase();
  let respuesta;
  try {
    respuesta = await fetch(`${base}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
        ...(tokenOrden ? { "X-Orden-Token": tokenOrden } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Sin conexión con el backend.");
  }
  let datos;
  try {
    datos = await respuesta.json();
  } catch {
    datos = {};
  }
  if (!respuesta.ok) throw new Error(mensajeDeError(datos, respuesta.status));
  return datos;
};

// Crea la orden en el servidor y devuelve {orden_id, init_point,
// total_centavos, expira_at, acceso_token}. El total real lo calcula el
// servidor; lo que muestra el front antes de confirmar es solo estimado.
export const crearCheckout = (payload) =>
  backend("/api/checkout/crear", { method: "POST", body: payload });

// Estado REAL de la orden leído en el servidor (nada de estados locales).
export const obtenerEstadoCheckout = (ordenId, accesoToken = "") =>
  backend(`/api/checkout/estado/${encodeURIComponent(ordenId)}`, { tokenOrden: accesoToken });

// Cuotas informativas de Mercado Pago para el total estimado (solo display;
// el cobro y las cuotas finales se confirman en MP).
export const obtenerCuotas = (totalCentavos) =>
  backend(`/api/checkout/cuotas?total_centavos=${Math.round(totalCentavos)}`);

// Compatibilidad con las pantallas de resultado: el servidor habla en
// estados (pendiente/pagada/cancelada) y centavos; el front muestra pesos.
export const obtenerEstadoPedido = (ordenId, token = "") =>
  obtenerEstadoCheckout(ordenId, token).then((o) => ({
    id: o.orden_id,
    total: (o.total_centavos ?? 0) / 100,
    estado: o.estado === "pagada" ? "pagado" : o.estado,
    comprobante_numero: null,
    comprobante_pago: o.comprobante_pago ?? null,
    seguimiento: o.seguimiento ?? null,
  }));

// Sube el comprobante de pago (transferencia, depósito, etc.). El backend
// valida la firma real del archivo y lo guarda en un bucket privado.
export const subirComprobantePago = async (
  ordenId,
  token,
  archivo,
  { montoCentavos, nota } = {}
) => {
  const t = await sesionToken();
  const forma = new FormData();
  forma.append("archivo", archivo);
  if (montoCentavos != null) forma.append("monto_centavos", String(Math.round(montoCentavos)));
  if (nota) forma.append("nota", nota);
  const base = apiBase();
  let respuesta;
  try {
    respuesta = await fetch(
      `${base}/api/checkout/estado/${encodeURIComponent(ordenId)}/comprobante-pago`,
      {
        method: "POST",
        headers: {
          ...(t ? { Authorization: `Bearer ${t}` } : {}),
          ...(token ? { "X-Orden-Token": token } : {}),
        },
        body: forma,
      }
    );
  } catch {
    throw new Error("Sin conexión con el backend.");
  }
  let datos;
  try {
    datos = await respuesta.json();
  } catch {
    datos = {};
  }
  if (!respuesta.ok) throw new Error(datos?.detail || `Error ${respuesta.status}`);
  return datos;
};

export const obtenerComprobantePago = (ordenId, token = "") =>
  backend(`/api/checkout/estado/${encodeURIComponent(ordenId)}/comprobante-pago`, {
    tokenOrden: token,
  });

// Regenera el link de pago en el servidor (solo pendiente/cancelada).
export const reintentarPago = (ordenId, token = "") =>
  backend(`/api/checkout/${encodeURIComponent(ordenId)}/reintentar`, {
    method: "POST",
    tokenOrden: token,
  }).then((d) => ({ link_pago: d.init_point }));

export const obtenerComprobante = (id, token = "") =>
  backend(`/api/comprobantes/${encodeURIComponent(id)}`, { tokenOrden: token });

// El PDF se abre como link (sin headers posibles): acá el token sigue en
// la query, igual que el link de verificación impreso en el comprobante.
export const urlComprobantePdf = (id, token = "") => {
  const q = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${apiBase()}/api/comprobantes/${encodeURIComponent(id)}/pdf${q}`;
};

export const obtenerMisOrdenes = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sin sesion activa");
  const { data, error } = await supabase
    .from("ordenes")
    .select("*, orden_items(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
};

export const obtenerOrdenPorId = async (id) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sin sesion activa");
  const { data, error } = await supabase
    .from("ordenes")
    .select("*, orden_items(*)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (error) throw new Error(error.message);
  return data;
};
