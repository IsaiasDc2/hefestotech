// HefestoTech · Admin · colores por estado de pedido.
// Se comparten entre el tablero y los gráficos para que el color sea el mismo
// en la dona, la tabla y las insignias. Solo variables de la paleta del sitio
// (index.css): verde = cobrado, ámbar = en espera, rojo = cancelado.
export const COLORES_ESTADO = {
  pendiente: "var(--warning)",
  pagada: "var(--ok)",
  preparacion: "var(--primary)",
  enviada: "var(--primary-oscuro)",
  entregada: "var(--primitive-green-deep)",
  cancelada: "var(--danger)",
  reembolsada: "var(--muted)",
};
