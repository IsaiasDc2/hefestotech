// HefestoTech · Admin · Clientes: personas registradas (perfiles reales) con
// métricas de sus pedidos: conteo, total comprado, último pedido y estado.
// Solo lectura; búsqueda por nombre contra /api/admin/clientes.
import { useState } from "react";
import { adminApi, fechaCorta, formatoARS } from "./adminApi";
import { Cabecera, Proximamente, SinPermiso, Skeleton, Vacio } from "./ui";
import { useModulo } from "./hooks";

const SIN_RESUMEN = { pedidos: 0, comprado_centavos: 0, ultimo_pedido: null, ultimo_estado: "" };

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
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
