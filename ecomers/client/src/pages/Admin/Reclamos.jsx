// HefestoTech · Admin · Reclamos: bandeja con filtro y cambio de estado.
// El formulario público vive en /reclamo (ReclamoPublico.jsx).
import { useState } from "react";
import { Link } from "react-router";
import { adminApi, fechaCorta } from "./adminApi";
import { Cabecera, Proximamente, SinPermiso, Skeleton, Vacio } from "./ui";
import { useModulo } from "./hooks";

const ESTADOS = ["", "abierto", "en_revision", "resuelto", "rechazado"];

export default function Reclamos({ avisar }) {
  const [estado, setEstado] = useState("");
  const [cambiando, setCambiando] = useState("");
  const { estado: est, datos, recargar } = useModulo(
    () => adminApi.reclamos({ estado }),
    [estado]
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
        titulo={`Reclamos (${lista.length})`}
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
        <ul className="adm-tarjetas">
          {lista.map((r) => (
            <li key={r.id} className="card adm-pedido">
              <div className="adm-pedido-head">
                <strong>{r.motivo}</strong>
                <span className={`adm-estado es-${r.estado}`}>{r.estado}</span>
              </div>
              <p className="texto-mutado">
                {fechaCorta(r.created_at)}{r.orden_id ? ` · Orden ${String(r.orden_id).slice(0, 8)}` : ""}
              </p>
              {r.detalle && <p>{r.detalle}</p>}
              <div className="adm-acciones">
                {ESTADOS.filter((s) => s && s !== r.estado).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="btn-fantasma adm-mini"
                    disabled={cambiando === r.id}
                    onClick={() => cambiar(r, s)}
                  >
                    → {s}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
