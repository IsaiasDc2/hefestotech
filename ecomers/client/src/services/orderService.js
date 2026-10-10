import { supabase } from "../components/lib/supabaseClient";

const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

const sesionUsuarioId = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sin sesion activa");
  return user.id;
};

/** Crea la orden en el SERVIDOR (precios/stock/envío recalculados allá).
 *  Devuelve { orden_id, token, total, link_pago }. */
export const crearOrdenCheckout = async ({ comprador, items, envio }) => {
  const respuesta = await fetch(`${API_URL}/api/checkout/crear`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comprador, items, envio }),
  });
  const data = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    throw new Error(data.detail || "No se pudo crear el pedido. Probá de nuevo.");
  }
  try {
    sessionStorage.setItem(
      `ht-pedido-${data.orden_id}`,
      JSON.stringify({ token: data.token })
    );
  } catch {
    /* sin storage: el token igual viaja en la URL de retorno */
  }
  return data;
};

/** Lee el estado del pedido DESDE la DB (vía backend), nunca de params URL. */
export const obtenerEstadoPedido = async (ordenId, token) => {
  const tk =
    token ??
    (() => {
      try {
        return JSON.parse(sessionStorage.getItem(`ht-pedido-${ordenId}`) || "{}").token ?? "";
      } catch {
        return "";
      }
    })();
  const respuesta = await fetch(
    `${API_URL}/api/pedidos/${ordenId}?token=${encodeURIComponent(tk)}`
  );
  if (!respuesta.ok) throw new Error("No se encontró el pedido.");
  return respuesta.json();
};

/** Genera un nuevo link de pago para un pedido pendiente/rechazado/expirado. */
export const reintentarPago = async (ordenId) => {
  const respuesta = await fetch(`${API_URL}/api/checkout/${ordenId}/reintentar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const data = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(data.detail || "No se pudo reintentar el pago.");
  return data;
};

/** Comprobante (snapshot) + URL del PDF. Requiere token de verificación. */
export const obtenerComprobante = async (ordenId, token) => {
  const respuesta = await fetch(
    `${API_URL}/api/comprobantes/${ordenId}?token=${encodeURIComponent(token ?? "")}`
  );
  if (!respuesta.ok) throw new Error("Comprobante no disponible.");
  return respuesta.json();
};

export const urlComprobantePdf = (ordenId, token) =>
  `${API_URL}/api/comprobantes/${ordenId}/pdf?token=${encodeURIComponent(token ?? "")}`;

/* Historial del comprador (RLS: solo ordenes propias). */
export const obtenerMisOrdenes = async () => {
  const user_id = await sesionUsuarioId();
  const { data, error } = await supabase
    .from("ordenes")
    .select("id,total,estado,created_at,comprobante_numero")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
};
