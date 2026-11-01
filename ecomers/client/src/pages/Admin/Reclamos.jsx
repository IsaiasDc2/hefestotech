// HefestoTech · Admin · Reclamos: bandeja con filtro y cambio de estado.
// El formulario público vive en /reclamo (ReclamoPublico.jsx).
import { useState } from "react";
import { Link } from "react-router";
import { FaChevronDown } from "react-icons/fa6";
import { adminApi, fechaCorta } from "./adminApi";
import { Cabecera, Paginador, Proximamente, SinPermiso, Skeleton, Vacio } from "./ui";
import { useModulo, usePaginacion } from "./hooks";

const ESTADOS = ["", "abierto", "en_revision", "resuelto", "rechazado"];
const SIGUIENTES = {
  abierto: ["en_revision"],
  en_revision: ["resuelto", "rechazado"],
  resuelto: [],
  rechazado: [],
};

export default function Reclamos({ avisar }) {
  const [estado, setEstado] = useState("");
  const [cambiando, setCambiando] = useState("");
  const [abierto, setAbierto] = useState("");
  const pg = usePaginacion(estado);
  const { estado: est, datos, recargar } = useModulo(
    () => adminApi.reclamos({ estado, limit: pg.por, offset: pg.offset }),
    [estado, pg.por, pg.offset]
  );
  const lista = datos?.reclamos ?? [];

  const cambiar = async (r, nuevo) => {
    setCambiando(r.id);
    try {
      await adminApi.cambiarEstadoReclamo(r.id, nuevo);
      avisar(`Reclamo → ${nuevo}.`);
      recargar();
    } catch (err) {
      avisar(err?.message ?? "No se pudo actualizar.", { tono: "error" });
    } finally {
      setCambiando("");
    }
  };

  if (est === "cargando") return <Skeleton lineas={6} etiqueta="Cargando reclamos…" />;
  if (est === "sin-permiso") return <SinPermiso modulo="Reclamos" />;
  if (est === "no-disponible") return <Proximamente modulo="Reclamos" />;

  return (
    <div>
      <Cabecera
        kicker="Soporte"
        titulo={`Reclamos (${datos?.total ?? lista.length})`}
        acciones={
          <div className="adm-acciones-cab">
            <label className="adm-filtro">Estado
              <select value={estado} onChange={(e) => setEstado(e.target.value)}>
                {ESTADOS.map((s) => (
                  <option key={s} value={s}>{s === "" ? "Todos" : s}</option>
                ))}
              </select>
            </label>
            <Link className="btn-fantasma adm-btn" to="/reclamo">Ver formulario público</Link>
            <button type="button" className="btn-fantasma adm-btn" onClick={recargar}>
              Actualizar
            </button>
          </div>
        }
      />
      {lista.length === 0 ? (
        <Vacio
          titulo="Sin reclamos"
          texto={estado ? `Ninguno en estado «${estado}».` : "No hay reclamos registrados."}
          accion={
            estado ? (
              <button type="button" className="btn-fantasma adm-btn" onClick={() => setEstado("")}>
                Ver todos
              </button>
            ) : null
          }
        />
      ) : (
        <div className="adm-lista-bloque es-reclamos">
          <div className="adm-lista-cabecera" aria-hidden="true">
            <span>Motivo</span>
            <span>Orden</span>
            <span>Fecha</span>
            <span>Estado</span>
            <span />
          </div>
          <ul className="adm-lista-registros">
            {lista.map((r) => {
              const abiertoEste = abierto === r.id;
              const detalleId = `adm-reclamo-det-${r.id}`;
              return (
                <li key={r.id} className={`adm-registro${abiertoEste ? " esta-abierto" : ""}`}>
                  <button
                    type="button"
                    className="adm-registro-toggle"
                    onClick={() => setAbierto(abiertoEste ? "" : r.id)}
                    aria-expanded={abiertoEste}
                    aria-controls={detalleId}
                    aria-label={`${abiertoEste ? "Ocultar" : "Ver"} detalle del reclamo ${r.motivo || String(r.id).slice(0, 8)}`}
                  >
                    <span className="adm-registro-celda es-principal">
                      <strong>{r.motivo || "Sin motivo"}</strong>
                      <span className="adm-registro-sub">
                        {r.detalle ? r.detalle : "Sin detalle"}
                      </span>
                    </span>
                    <span className="adm-registro-celda es-orden">
                      <span className="adm-registro-etiqueta">Orden</span>
                      <span>{r.orden_id ? `#${String(r.orden_id).slice(0, 8)}` : "—"}</span>
                    </span>
                    <span className="adm-registro-celda es-fecha">
                      <span className="adm-registro-etiqueta">Fecha</span>
                      <span>{fechaCorta(r.created_at)}</span>
                    </span>
                    <span className="adm-registro-celda es-estado">
                      <span className={`adm-estado${r.estado ? ` es-${r.estado}` : ""}`}>{r.estado || "—"}</span>
                    </span>
                    <FaChevronDown className="adm-caret" aria-hidden="true" />
                  </button>

                  {abiertoEste && (
                    <div
                      className="adm-registro-detalle"
                      id={detalleId}
                      role="region"
                      aria-label={`Detalle del reclamo ${String(r.id).slice(0, 8)}`}
                    >
                      <dl className="adm-detalle-grid">
                        <div>
                          <dt>Motivo</dt>
                          <dd>{r.motivo || "—"}</dd>
                        </div>
                        <div>
                          <dt>Orden</dt>
                          <dd>{r.orden_id ? `#${String(r.orden_id).slice(0, 8)}` : "Sin orden asociada"}</dd>
                        </div>
                        <div>
                          <dt>Fecha</dt>
                          <dd>{fechaCorta(r.created_at)}</dd>
                        </div>
                        <div>
                          <dt>Estado</dt>
                          <dd>{r.estado || "—"}</dd>
                        </div>
                      </dl>

                      <div>
                        <p className="adm-detalle-subtitulo">Detalle del reclamo</p>
                        <p>{r.detalle || "El cliente no dejó un detalle adicional."}</p>
                      </div>

                      <div className="adm-pedido-acciones">
                        <span className="texto-mutado">Cambiar estado:</span>
                        <div className="adm-acciones">
                          {SIGUIENTES[r.estado]?.length ? (
                            SIGUIENTES[r.estado].map((s) => (
                              <button
                                key={s}
                                type="button"
                                className="btn-fantasma adm-mini"
                                disabled={cambiando === r.id}
                                onClick={() => cambiar(r, s)}
                              >
                                → {s}
                              </button>
                            ))
                          ) : (
                            <span className="texto-mutado">Sin cambios disponibles.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {(datos?.total ?? 0) > 10 && (
        <div className="card adm-panel">
          <Paginador total={datos.total} pagina={pg.pagina} por={pg.por} onPagina={pg.irA} onPor={pg.cambiarPor} />
        </div>
      )}
    </div>
  );
}
