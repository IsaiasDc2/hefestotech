// HefestoTech · Admin · Inicio: tablero operativo (GET /api/admin/resumen).
// Sesión, accesos rápidos, sucursal activa, KPIs y gráficos de movimientos.
import { useState } from "react";
import {
  FaArrowRight,
  FaBox,
  FaBoxesStacked,
  FaCartShopping,
  FaCoins,
  FaMessage,
  FaPlus,
  FaRightFromBracket,
  FaStore,
  FaTruck,
  FaUsers,
} from "react-icons/fa6";
import { adminApi, fechaCorta, formatoARS } from "./adminApi";
import { formatoMoneda } from "./compras";
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

const ACCIONES = [
  { id: "productos", accion: "nuevo", etiqueta: "Nuevo producto", Icono: FaBox },
  { id: "stock", accion: "agregar", etiqueta: "Agregar stock", Icono: FaBoxesStacked },
  { id: "proveedores", accion: "nuevo", etiqueta: "Agregar proveedor", Icono: FaTruck },
  { id: "pedidos", accion: "", etiqueta: "Ver pedidos", Icono: FaCartShopping },
];

function TarjetaSesion({ usuario, rol, onSalir }) {
  const nombre = usuario?.nombre?.trim() || usuario?.email || "Sin sesión";
  const inicial = nombre.slice(0, 1).toUpperCase();
  return (
    <section className="card adm-sesion" aria-label="Sesión actual">
      <span className="adm-avatar" aria-hidden="true">{inicial}</span>
      <div className="adm-sesion-datos">
        <p className="texto-mutado">Sesión iniciada como</p>
        <h2>{nombre}</h2>
        <p className="texto-mutado">{usuario?.email ?? "—"} · Rol: {rol ?? "—"}</p>
      </div>
      {onSalir && (
        <button type="button" className="btn-fantasma adm-btn" onClick={onSalir}>
          <FaRightFromBracket aria-hidden="true" /> Cerrar sesión
        </button>
      )}
    </section>
  );
}

function TarjetaSucursal({ sucursales, sucursal, onCambiar, puedeGestionar, onCrear, avisar }) {
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState({ nombre: "", direccion: "", telefono: "" });
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState("");

  const crear = async (e) => {
    e.preventDefault();
    const nombre = form.nombre.trim();
    if (!nombre) {
      setError("Poné un nombre para la sucursal.");
      return;
    }
    setCreando(true);
    setError("");
    try {
      const r = await onCrear({
        nombre,
        direccion: form.direccion.trim(),
        telefono: form.telefono.trim(),
      });
      setForm({ nombre: "", direccion: "", telefono: "" });
      setAbierto(false);
      avisar?.(r?.sucursal?.nombre ? `Sucursal «${r.sucursal.nombre}» creada.` : "Sucursal creada.");
    } catch (err) {
      setError(err?.message ?? "No se pudo crear la sucursal.");
    } finally {
      setCreando(false);
    }
  };

  return (
    <section className="card adm-panel adm-sucursal" aria-label="Alternar entre sucursales">
      <div className="adm-panel-cab">
        <h2>Alternar entre sucursales</h2>
        {puedeGestionar && (
          <button
            type="button"
            className="btn-fantasma adm-mini"
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
          >
            <FaPlus aria-hidden="true" /> Agregar
          </button>
        )}
      </div>

      <label className="adm-sucursal-select">
        <span className="texto-mutado">Sucursal activa</span>
        <select value={sucursal} onChange={(e) => onCambiar(e.target.value)}>
          <option value="">Todas las sucursales</option>
          {sucursales.filter((s) => s.activa).map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
      </label>

      {sucursal ? (
        <p className="texto-mutado">
          Ventas, pedidos y top de productos de la sucursal elegida. El stock y las compras
          son globales.
        </p>
      ) : (
        <p className="texto-mutado">
          {sucursales.length
            ? "Mostrando todas las sucursales juntas."
            : "Todavía no hay sucursales cargadas. Podés crear la primera acá."}
        </p>
      )}

      {abierto && (
        <form className="adm-form adm-sucursal-form" onSubmit={crear}>
          <label>Nombre *
            <input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              maxLength={120}
              required
            />
          </label>
          <div className="adm-fila-2">
            <label>Dirección
              <input
                value={form.direccion}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                maxLength={200}
              />
            </label>
            <label>Teléfono
              <input
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                maxLength={40}
              />
            </label>
          </div>
          {error && <p role="alert" className="adm-error">{error}</p>}
          <div className="adm-form-acciones">
            <button type="submit" className="btn-primary adm-btn" disabled={creando}>
              {creando ? "Creando…" : "Crear sucursal"}
            </button>
            <button type="button" className="btn-fantasma adm-btn" onClick={() => setAbierto(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function Panel({ titulo, insignia = null, accion = null, children, etiqueta }) {
  return (
    <section className="card adm-panel" aria-label={etiqueta ?? titulo}>
      <div className="adm-panel-cab">
        <h2>{titulo}</h2>
        {insignia}
        {accion}
      </div>
      {children}
    </section>
  );
}

export default function Inicio({ onIr, usuario, rol, onSalir, avisar }) {
  const [sucursal, setSucursal] = useState("");
  const { estado, datos, detalle, recargar } = useModulo(
    () => adminApi.resumen({ sucursal }),
    [sucursal]
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
  const puedeGestionar = rol === "owner" || rol === "admin";
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
    { id: "productos", etiqueta: "Productos activos", valor: datos?.productos_activos ?? 0, Icono: FaBox, tono: "" },
    { id: "stock", etiqueta: "Con bajo stock", valor: datos?.bajo_stock ?? 0, Icono: FaBoxesStacked, tono: (datos?.bajo_stock ?? 0) > 0 ? "es-alerta" : "" },
    { id: "pedidos", etiqueta: "Pedidos pendientes", valor: datos?.pedidos_pendientes ?? datos?.pedidos_pendientes_pagina ?? 0, Icono: FaCartShopping, tono: (datos?.pedidos_pendientes ?? 0) > 0 ? "es-aviso" : "" },
    { id: "reclamos", etiqueta: "Reclamos abiertos", valor: datos?.reclamos_abiertos ?? 0, Icono: FaMessage, tono: (datos?.reclamos_abiertos ?? 0) > 0 ? "es-aviso" : "" },
    { id: "reportes", etiqueta: "Ventas 30 días", valor: formatoARS(ventas.total_centavos ?? 0), Icono: FaCoins, tono: "" },
    { id: "compras", etiqueta: "Compras abiertas", valor: compras.abiertas ?? 0, Icono: FaTruck, tono: (compras.abiertas ?? 0) > 0 ? "es-aviso" : "" },
    { id: "clientes", etiqueta: "Usuarios registrados", valor: usuarios.total ?? 0, Icono: FaUsers, tono: "" },
    { id: "config", etiqueta: "Sucursales activas", valor: sucursales.filter((s) => s.activa).length, Icono: FaStore, tono: "" },
  ];

  return (
    <div className="adm-dashboard">
      <Cabecera
        kicker="Panel"
        titulo="Inicio"
        acciones={
          <button type="button" className="btn-fantasma adm-btn" onClick={recargar}>
            Actualizar
          </button>
        }
      />

      <section className="card adm-panel adm-acciones-rapidas" aria-label="Accesos rápidos">
        <div className="adm-panel-cab">
          <h2>Accesos rápidos</h2>
          <span className="texto-mutado">Altas y tareas frecuentes, a un clic</span>
        </div>
        <div className="adm-acciones-grid">
          {ACCIONES.map((a) => (
            <button
              key={a.etiqueta}
              type="button"
              className="btn-fantasma adm-accion"
              onClick={() => onIr?.(a.id, a.accion ? { accion: a.accion } : {})}
            >
              <span className="adm-accion-icono" aria-hidden="true"><a.Icono /></span>
              {a.etiqueta}
            </button>
          ))}
        </div>
      </section>

      <div className="adm-grid-2 adm-grid-contexto">
        <TarjetaSesion usuario={usuario} rol={rol} onSalir={onSalir} />
        <TarjetaSucursal
          sucursales={sucursales}
          sucursal={sucursal}
          onCambiar={setSucursal}
          puedeGestionar={puedeGestionar}
          onCrear={async (d) => {
            const r = await adminApi.crearSucursal(d);
            recargar();
            return r;
          }}
          avisar={avisar}
        />
      </div>

      <div className="adm-kpis">
        {tarjetas.map((t) => (
          <button key={t.id} type="button" className={`card adm-kpi ${t.tono}`} onClick={() => onIr?.(t.id)}>
            <span className="adm-kpi-icono" aria-hidden="true"><t.Icono /></span>
            <span className="adm-kpi-valor">{t.valor}</span>
            <span className="adm-kpi-etiqueta">{t.etiqueta}</span>
            <span className="adm-kpi-ir" aria-hidden="true"><FaArrowRight /></span>
          </button>
        ))}
      </div>

      <div className="adm-grid-2">
        <Panel
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

        <Panel titulo="Pedidos por estado · 30 días">
          <Donut datos={porEstado} etiqueta="Pedidos por estado" />
        </Panel>

        <Panel titulo="Métodos de pago · 30 días">
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
            El detalle sale del pago real de Mercado Pago. Los pedidos anteriores a la
            migración 015 quedan como «Mercado Pago (sin detalle)».
          </p>
        </Panel>

        <Panel titulo="Movimientos de stock · 7 días">
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

        <Panel titulo="Usuarios registrados">
          <div className="adm-mini-kpis">
            <div><span>Total</span><strong>{usuarios.total ?? 0}</strong></div>
            <div><span>Clientes</span><strong>{usuarios.clientes ?? 0}</strong></div>
            <div><span>Nuevos (30 días)</span><strong>{usuarios.nuevos_30d ?? 0}</strong></div>
          </div>
          <p className="texto-mutado adm-pie-dato">
            Perfiles reales de Supabase. El total incluye también al staff.
          </p>
        </Panel>
      </div>

      <Panel
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

      <Panel titulo="Compras · últimos 30 días">
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
    </div>
  );
}
