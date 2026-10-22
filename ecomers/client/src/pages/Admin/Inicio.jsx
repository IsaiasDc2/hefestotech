// HefestoTech · Admin · Inicio: tablero operativo (GET /api/admin/resumen).
// KPIs y gráficos de ventas, pagos, stock y compras. La sucursal activa y la
// sesión viven en la barra superior (AdminLayout); acá solo se recibe el filtro.
import {
  FaArrowRight,
  FaBox,
  FaBoxesStacked,
  FaCartShopping,
  FaCoins,
  FaMessage,
  FaStore,
  FaTruck,
  FaUsers,
} from "react-icons/fa6";
import { adminApi, fechaCorta, formatoARS } from "./adminApi";
import { formatoMoneda } from "./comprasUtil";
import { Cabecera, Proximamente, SinPermiso, Skeleton, Tabla } from "./ui";
import { useModulo } from "./hooks";
import {
  Barras,
  BarrasApiladas,
  BarrasHorizontales,
  Donut,
} from "./Graficos";
import { COLORES_ESTADO } from "./coloresEstado";

const NOMBRE_ESTADO = {
  pendiente: "Pendiente",
  pagada: "Pagada",
  preparacion: "En preparación",
  enviada: "Enviada",
  entregada: "Entregada",
  cancelada: "Cancelada",
  reembolsada: "Reembolsada",
};

const NOMBRE_MOVIMIENTO = {
  entrada: "Entrada",
  salida: "Salida",
  ajuste: "Ajuste",
};

const NOMBRE_PAGO = {
  credit_card: "Tarjeta de crédito",
  debit_card: "Tarjeta de débito",
  account_money: "Dinero en cuenta (MP)",
  bank_transfer: "Transferencia bancaria",
  ticket: "Efectivo (Rapipago / Pago Fácil)",
  atm: "Cajero automático",
  mercadopago: "Mercado Pago (sin detalle)",
  sin_dato: "Sin dato",
};

// Monto sin decimales para las tarjetas chicas: "$ 645.000" entra donde
// "$ 645.000,00" se cortaba.
const pesosCortos = (centavos) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(centavos ?? 0) / 100);

function Panel({ titulo, ancho = 12, insignia = null, accion = null, children, etiqueta }) {
  return (
    <section className={`card adm-panel adm-col-${ancho}`} aria-label={etiqueta ?? titulo}>
      <div className="adm-panel-cab">
        <h2>{titulo}</h2>
        {insignia}
        {accion}
      </div>
      {children}
    </section>
  );
}

export default function Inicio({ onIr, sucursal = "", sucursalNombre = "", refresco = 0 }) {
  const { estado, datos, detalle, recargar } = useModulo(
    () => adminApi.resumen({ sucursal }),
    [sucursal, refresco]
  );

  if (estado === "cargando") return <Skeleton lineas={6} etiqueta="Cargando resumen…" />;
  if (estado === "sin-permiso") return <SinPermiso modulo="Inicio" />;
  if (estado === "no-disponible") return <Proximamente modulo="Inicio" detalle={detalle} />;

  const ventas = datos?.ventas ?? {};
  const stock = datos?.stock ?? {};
  const compras = datos?.compras ?? {};
  const proveedores = datos?.proveedores ?? {};
  const usuarios = datos?.usuarios ?? {};
  const pagos = datos?.pagos ?? [];
  const sucursales = datos?.sucursales ?? [];
  const monedasCompra = Object.entries(compras.total_centavos ?? {});
  const topePagos = Math.max(1, ...pagos.map((p) => Number(p.total_centavos) || 0));

  const porEstado = Object.entries(ventas.por_estado ?? {})
    .filter(([, n]) => Number(n) > 0)
    .map(([clave, n]) => ({
      etiqueta: NOMBRE_ESTADO[clave] ?? clave,
      valor: Number(n),
      color: COLORES_ESTADO[clave] ?? "var(--muted)",
    }));

  const movimientos = (stock.ultimos ?? []).map((m, i) => ({
    ...m,
    _clave: `${m.created_at}-${i}`,
  }));

  const tarjetas = [
    { id: "reportes", etiqueta: "Ventas 30 días", valor: pesosCortos(ventas.total_centavos), Icono: FaCoins, tono: "" },
    { id: "pedidos", etiqueta: "Pedidos pendientes", valor: datos?.pedidos_pendientes ?? datos?.pedidos_pendientes_pagina ?? 0, Icono: FaCartShopping, tono: (datos?.pedidos_pendientes ?? 0) > 0 ? "es-aviso" : "" },
    { id: "stock", etiqueta: "Con bajo stock", valor: datos?.bajo_stock ?? 0, Icono: FaBoxesStacked, tono: (datos?.bajo_stock ?? 0) > 0 ? "es-alerta" : "" },
    { id: "reclamos", etiqueta: "Reclamos abiertos", valor: datos?.reclamos_abiertos ?? 0, Icono: FaMessage, tono: (datos?.reclamos_abiertos ?? 0) > 0 ? "es-aviso" : "" },
    { id: "productos", etiqueta: "Productos activos", valor: datos?.productos_activos ?? 0, Icono: FaBox, tono: "" },
    { id: "compras", etiqueta: "Compras abiertas", valor: compras.abiertas ?? 0, Icono: FaTruck, tono: (compras.abiertas ?? 0) > 0 ? "es-aviso" : "" },
    { id: "clientes", etiqueta: "Usuarios registrados", valor: usuarios.total ?? 0, Icono: FaUsers, tono: "" },
    { id: "config", etiqueta: "Sucursales activas", valor: sucursales.filter((s) => s.activa).length, Icono: FaStore, tono: "" },
  ];

  return (
    <div className="adm-dashboard">
      <Cabecera
        kicker="Panel"
        titulo="Inicio"
        insignia={
          sucursal ? (
            <span className="adm-insignia">Sucursal: {sucursalNombre || "elegida"}</span>
          ) : null
        }
        acciones={
          <button type="button" className="btn-fantasma adm-btn" onClick={recargar}>
            Actualizar
          </button>
        }
      />

      {sucursal && (
        <p className="texto-mutado adm-nota-sucursal" role="note">
          Ventas, pedidos y top de productos de la sucursal elegida. El stock y las
          compras son globales.
        </p>
      )}

      <div className="adm-kpis adm-kpis-dash">
        {tarjetas.map((t) => (
          <button key={t.id} type="button" className={`card adm-kpi ${t.tono}`} onClick={() => onIr?.(t.id)}>
            <span className="adm-kpi-icono" aria-hidden="true"><t.Icono /></span>
            <span className="adm-kpi-valor">{t.valor}</span>
            <span className="adm-kpi-etiqueta">{t.etiqueta}</span>
            <span className="adm-kpi-ir" aria-hidden="true"><FaArrowRight /></span>
          </button>
        ))}
      </div>

      <div className="adm-dash-grid">
        <Panel
          ancho={8}
          titulo="Ventas · últimos 30 días"
          insignia={<span className="adm-insignia es-ok">{formatoARS(ventas.total_centavos ?? 0)}</span>}
        >
          <Barras
            datos={ventas.por_dia ?? []}
            valor={(d) => d.total_centavos}
            etiqueta="Ventas por día"
            formato={formatoARS}
          />
          <p className="texto-mutado adm-pie-dato">
            {ventas.pedidos ?? 0} pedidos cobrados · ticket promedio {formatoARS(ventas.ticket_promedio_centavos ?? 0)}
          </p>
        </Panel>

        <Panel ancho={4} titulo="Pedidos por estado · 30 días">
          <Donut datos={porEstado} etiqueta="Pedidos por estado" />
        </Panel>

        <Panel ancho={4} titulo="Métodos de pago · 30 días">
          {pagos.length === 0 ? (
            <p className="adm-grafico-vacio">Sin pedidos cobrados en el período.</p>
          ) : (
            <ul className="adm-pagos">
              {pagos.map((p) => (
                <li key={p.tipo}>
                  <div className="adm-pagos-fila">
                    <span className="adm-pagos-nombre">{NOMBRE_PAGO[p.tipo] ?? p.tipo}</span>
                    <strong>{formatoARS(p.total_centavos)}</strong>
                  </div>
                  <span className="adm-pagos-barra" aria-hidden="true">
                    <span style={{ width: `${(Number(p.total_centavos) / topePagos) * 100}%` }} />
                  </span>
                  <span className="texto-mutado adm-pagos-detalle">
                    {p.pedidos} pedido(s)
                    {Object.keys(p.metodos ?? {}).length
                      ? ` · ${Object.entries(p.metodos).map(([m, n]) => `${m} (${n})`).join(", ")}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="texto-mutado adm-pie-dato">
            El detalle sale del pago real de Mercado Pago; los pedidos que no lo
            tienen figuran como «Sin dato».
          </p>
        </Panel>

        <Panel ancho={4} titulo="Movimientos de stock · 7 días">
          <BarrasApiladas
            datos={stock.por_dia ?? []}
            etiqueta="Movimientos de stock por día"
            series={[
              { clave: "entradas", etiqueta: "Entradas", color: "var(--ok)" },
              { clave: "salidas", etiqueta: "Salidas", color: "var(--danger)" },
              { clave: "ajustes", etiqueta: "Ajustes", color: "var(--muted)" },
            ]}
          />
          <p className="texto-mutado adm-pie-dato">
            {stock.entradas ?? 0} entraron · {stock.salidas ?? 0} salieron · {stock.ajustes ?? 0} ajustes
          </p>
        </Panel>

        <Panel
          ancho={4}
          titulo="Top productos · 30 días"
          accion={
            <button type="button" className="btn-fantasma adm-mini" onClick={() => onIr?.("productos")}>
              Ver catálogo
            </button>
          }
        >
          <BarrasHorizontales
            datos={datos?.top_productos ?? []}
            valor={(d) => d.unidades}
            etiqueta="Productos más vendidos por unidades"
            formato={(n) => `${n} u.`}
          />
        </Panel>

        <Panel ancho={6} titulo="Usuarios registrados">
          <div className="adm-mini-kpis">
            <div><span>Total</span><strong>{usuarios.total ?? 0}</strong></div>
            <div><span>Clientes</span><strong>{usuarios.clientes ?? 0}</strong></div>
            <div><span>Nuevos (30 días)</span><strong>{usuarios.nuevos_30d ?? 0}</strong></div>
          </div>
          <p className="texto-mutado adm-pie-dato">
            Perfiles reales de Supabase. El total incluye también al staff.
          </p>
        </Panel>

        <Panel ancho={6} titulo="Compras · últimos 30 días">
          <div className="adm-mini-kpis">
            <div><span>Órdenes</span><strong>{compras.ordenes ?? 0}</strong></div>
            <div><span>Abiertas</span><strong>{compras.abiertas ?? 0}</strong></div>
            <div><span>Recibidas</span><strong>{compras.recibidas ?? 0}</strong></div>
            {monedasCompra.map(([moneda, total]) => (
              <div key={moneda}>
                <span>Comprado ({moneda})</span>
                <strong>{formatoMoneda(total, moneda)}</strong>
              </div>
            ))}
          </div>
          <p className="texto-mutado adm-pie-dato">
            Proveedores activos: {proveedores.activos ?? 0} de {proveedores.total ?? 0}.
          </p>
        </Panel>

        <Panel
          ancho={12}
          titulo="Últimos movimientos de stock"
          accion={
            <button type="button" className="btn-fantasma adm-mini" onClick={() => onIr?.("stock")}>
              Ir a Stock
            </button>
          }
        >
          <Tabla
            columnas={[
              { clave: "created_at", titulo: "Cuándo", ver: (m) => fechaCorta(m.created_at) },
              { clave: "producto", titulo: "Producto", ver: (m) => m.producto },
              {
                clave: "tipo",
                titulo: "Tipo",
                ver: (m) => (
                  <span className={`adm-insignia ${m.tipo === "entrada" ? "es-ok" : m.tipo === "salida" ? "es-peligro" : ""}`}>
                    {NOMBRE_MOVIMIENTO[m.tipo] ?? m.tipo}
                  </span>
                ),
              },
              { clave: "cantidad", titulo: "Cantidad", ver: (m) => m.cantidad },
              { clave: "motivo", titulo: "Motivo", ver: (m) => m.motivo || "—" },
            ]}
            filas={movimientos}
            filaKey={(m) => m._clave}
            vacio="Sin movimientos en los últimos 7 días."
          />
        </Panel>
      </div>
    </div>
  );
}
