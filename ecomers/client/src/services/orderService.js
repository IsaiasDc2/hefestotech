// HefestoTech · Checkout contra el backend (/api/checkout/*).
// El cliente NUNCA inserta órdenes ni precios directo en Supabase: envía
// solo producto_id + cantidad y el servidor recalcula todo desde la DB.
// Se conservan las lecturas propias por RLS (mis órdenes / por id).
import { supabase } from "../components/lib/supabaseClient";

const API_BASE = String(
  import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000"
).replace(/\/+$/, "");

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

const backend = async (path, { method = "GET", body } = {}) => {
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
    throw new Error("Sin conexión con el backend.");
  }
  let datos = {};
  try {
    datos = await respuesta.json();
  } catch {
    datos = {};
  }
  if (!respuesta.ok) throw new Error(datos?.detail || `Error ${respuesta.status}`);
  return datos;
};

// Crea la orden en el servidor y devuelve {orden_id, init_point,
// total_centavos, expira_at, acceso_token}. El total real lo calcula el
// servidor; lo que muestra el front antes de confirmar es solo estimado.
export const crearCheckout = (payload) =>
  backend("/api/checkout/crear", { method: "POST", body: payload });

// Estado REAL de la orden leído en el servidor (nada de estados locales).
export const obtenerEstadoCheckout = (ordenId, accesoToken = "") => {
  const q = accesoToken ? `?token=${encodeURIComponent(accesoToken)}` : "";
  return backend(`/api/checkout/estado/${encodeURIComponent(ordenId)}${q}`);
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
