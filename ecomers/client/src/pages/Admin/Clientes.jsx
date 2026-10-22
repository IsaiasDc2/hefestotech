// HefestoTech · Admin · Clientes: personas registradas (perfiles reales) con
// métricas de sus pedidos: conteo, total comprado, último pedido y estado.
// Solo lectura; búsqueda por nombre contra /api/admin/clientes.
import { useState } from "react";
import { FaBoxOpen, FaReceipt } from "react-icons/fa6";
import { adminApi, fechaCorta, formatoARS } from "./adminApi";
import { Cabecera, Proximamente, SinPermiso, Skeleton, Vacio } from "./ui";
import { useModulo } from "./hooks";

const SIN_RESUMEN = {
  pedidos: 0,
  comprado_centavos: 0,
  ultimo_pedido: null,
  ultimo_estado: "",
  pedidos_detalle: [],
};

function FotoProducto({ item }) {
  const [error, setError] = useState(false);
  if (!item.imagen || error) {
    return (
      <span className="adm-cliente-sin-foto" aria-label={`${item.nombre} sin foto`}>
        <FaBoxOpen aria-hidden="true" />
      </span>
    );
  }
  return (
    <img
      src={item.imagen}
      alt={`Foto de ${item.nombre}`}
      width={48}
      height={48}
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}

function ComprobantePagoCliente({ pedido }) {
  const { estado, datos } = useModulo(
    () => adminApi.comprobantePagoPedido(pedido.id),
    [pedido.id]
  );
  const c = datos?.comprobante;
  const url = c?.archivo_url;
  if (estado === "cargando") {
    return <p className="texto-mutado">Cargando comprobante de pago…</p>;
  }
  if (estado !== "ok" || !url) {
    return (
      <p className="texto-mutado">
        {estado === "sin-permiso"
          ? "No tenés permiso para ver el comprobante."
          : "No se pudo abrir el comprobante de pago."}
      </p>
    );
  }
  const mime = String(c?.mime || pedido.comprobante_pago?.mime || "");
  const nombre = c?.archivo_nombre || pedido.comprobante_pago?.archivo_nombre || "";
  const fecha = c?.created_at ?? pedido.comprobante_pago?.created_at;
  const esImagen = mime.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(nombre);
  return (
    <div className="adm-cliente-comprobante">
      {esImagen ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="adm-cliente-comprobante-foto"
        >
          <img
            src={url}
            alt={`Comprobante de pago del pedido ${pedido.codigo || String(pedido.id).slice(0, 8)}`}
            loading="lazy"
          />
        </a>
      ) : (
        <a href={url} target="_blank" rel="noreferrer" className="btn-fantasma adm-mini">
          <FaReceipt aria-hidden="true" /> Ver comprobante PDF
        </a>
      )}
      <span className="texto-mutado">
        {nombre || "Comprobante"}
        {" · "}
        {formatoARS(c?.monto_centavos ?? pedido.comprobante_pago?.monto_centavos ?? 0)}
        {fecha ? ` · ${fechaCorta(fecha)}` : ""}
      </span>
    </div>
  );
}

function PedidosCliente({ pedidos }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <details
      className="adm-cliente-pedidos"
      onToggle={(e) => setAbierto(e.currentTarget.open)}
    >
      <summary>Pedidos, productos y comprobantes ({pedidos.length})</summary>
      {abierto ? (
        <ul className="adm-cliente-pedido-lista">
          {pedidos.map((o) => (
            <li key={o.id} className="adm-cliente-pedido">
              <div className="adm-cliente-pedido-cab">
                <strong>#{o.codigo || String(o.id).slice(0, 8)}</strong>
                <span className={`adm-estado es-${o.estado}`}>{o.estado || "—"}</span>
                <span className="texto-mutado">{fechaCorta(o.created_at)}</span>
                <span className="adm-cliente-pedido-total">
                  {formatoARS(o.total_centavos)}
                </span>
              </div>
              {(o.items ?? []).length > 0 ? (
                <ul className="adm-cliente-items">
                  {(o.items ?? []).map((it, i) => (
                    <li key={`${o.id}-${i}`} className="adm-cliente-item">
                      <FotoProducto item={it} />
                      <span className="adm-cliente-item-nombre">
                        {it.nombre}
                        <span className="texto-mutado"> × {it.cantidad}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="texto-mutado">Pedido sin ítems registrados.</p>
              )}
              <div className="adm-cliente-pago">
                <p className="adm-detalle-subtitulo">Comprobante de pago</p>
                {o.comprobante_pago ? (
                  <ComprobantePagoCliente pedido={o} />
                ) : (
                  <p className="texto-mutado">
                    El cliente todavía no cargó el comprobante de pago.
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </details>
  );
}

export default function Clientes() {
  const [q, setQ] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const { estado, datos } = useModulo(
    () => adminApi.clientes({ busqueda }),
    [busqueda]
  );
  const lista = datos?.clientes ?? [];

  if (estado === "cargando") return <Skeleton lineas={6} etiqueta="Cargando clientes…" />;
  if (estado === "sin-permiso") return <SinPermiso modulo="Clientes" />;
  if (estado === "no-disponible") return <Proximamente modulo="Clientes" />;

  return (
    <div>
      <Cabecera kicker="Personas" titulo={`Clientes (${lista.length})`} />
      <section className="card adm-panel" aria-label="Listado de clientes">
        <form
          className="adm-buscador-linea"
          onSubmit={(e) => {
            e.preventDefault();
            setBusqueda(q);
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre…"
            aria-label="Buscar clientes"
          />
          <button type="submit" className="btn-fantasma adm-btn">Buscar</button>
        </form>

        {lista.length === 0 ? (
          <Vacio
            titulo="Sin clientes"
            texto={busqueda ? "Ninguno coincide con esa búsqueda." : "Todavía no hay cuentas registradas."}
            accion={
              busqueda ? (
                <button
                  type="button"
                  className="btn-fantasma adm-btn"
                  onClick={() => {
                    setBusqueda("");
                    setQ("");
                  }}
                >
                  Ver todos
                </button>
              ) : null
            }
          />
        ) : (
          <ul className="adm-tarjetas">
            {lista.map((c) => {
              const r = { ...SIN_RESUMEN, ...(c.resumen ?? {}) };
              return (
                <li key={c.id} className="card adm-pedido">
                  <div className="adm-pedido-head">
                    <strong>{c.nombre || "Sin nombre"}</strong>
                    {c.rol && c.rol !== "cliente" ? (
                      <span className="adm-estado">{c.rol}</span>
                    ) : null}
                  </div>
                  <p className="texto-mutado">
                    {c.email || "Sin email"} · Alta {fechaCorta(c.created_at)}
                  </p>
                  <dl className="adm-detalle-grid">
                    <div>
                      <dt>Pedidos</dt>
                      <dd>{r.pedidos}</dd>
                    </div>
                    <div>
                      <dt>Total comprado</dt>
                      <dd>{formatoARS(r.comprado_centavos)}</dd>
                    </div>
                    <div>
                      <dt>Ciudad</dt>
                      <dd>{c.ciudad || "—"}</dd>
                    </div>
                    <div>
                      <dt>Teléfono</dt>
                      <dd>{c.telefono || "—"}</dd>
                    </div>
                    {r.ultimo_pedido ? (
                      <div>
                        <dt>Último pedido</dt>
                        <dd>{fechaCorta(r.ultimo_pedido)} · {r.ultimo_estado || "—"}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {c.direccion ? (
                    <p className="texto-mutado">
                      Envío: {c.direccion}{c.codigo_postal ? `, CP ${c.codigo_postal}` : ""}
                    </p>
                  ) : null}
                  {(r.pedidos_detalle ?? []).length > 0 ? (
                    <PedidosCliente pedidos={r.pedidos_detalle ?? []} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
