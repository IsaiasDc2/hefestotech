// Estados a los que se puede pasar un pedido. Espejo de la función SQL
// `pedido_transicion_ok` (supabase/migrations/005_admin_infra.sql): la base es
// la que decide; esto solo evita ofrecer botones que ella va a rechazar.
// pedidosUtil.test.js falla si se desfasan.
export const TRANSICIONES_PEDIDO = {
  pendiente: ["pagada", "cancelada"],
  pagada: ["preparacion", "cancelada", "reembolsada"],
  preparacion: ["enviada", "cancelada"],
  enviada: ["entregada"],
  entregada: ["reembolsada"],
  cancelada: [],
  reembolsada: [],
};

export const siguientesEstados = (estado) => TRANSICIONES_PEDIDO[estado] ?? [];

export const esDestructivo = (estado) => estado === "cancelada" || estado === "reembolsada";
