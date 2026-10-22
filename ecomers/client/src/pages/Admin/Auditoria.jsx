// HefestoTech · Admin · Auditoría: log append-only (solo lectura).
import { useState } from "react";
import { adminApi, fechaCorta } from "./adminApi";
import { Cabecera, Proximamente, SinPermiso, Skeleton, Tabla } from "./ui";
import { useModulo } from "./hooks";

export default function Auditoria() {
  const [modulo, setModulo] = useState("");
  const [entidad, setEntidad] = useState("");
  const [filtro, setFiltro] = useState({ modulo: "", entidad: "" });
  const { estado, datos, recargar } = useModulo(
    () => adminApi.auditoria(filtro),
    [filtro.modulo, filtro.entidad]
  );
  const lista = datos?.eventos ?? [];

  if (estado === "cargando") return <Skeleton lineas={8} etiqueta="Cargando auditoría…" />;
  if (estado === "sin-permiso") return <SinPermiso modulo="Auditoría" />;
  if (estado === "no-disponible") return <Proximamente modulo="Auditoría" />;

  return (
    <div>
      <Cabecera
        kicker="Trazas"
        titulo={`Auditoría (${lista.length})`}
        acciones={
          <button type="button" className="btn-fantasma adm-btn" onClick={recargar}>
            Actualizar
          </button>
        }
      />
      <section className="card adm-panel" aria-label="Filtros">
        <form
          className="adm-buscador-linea"
          onSubmit={(e) => {
            e.preventDefault();
            setFiltro({ modulo: modulo.trim(), entidad: entidad.trim() });
          }}
        >
          <label>Módulo <input value={modulo} onChange={(e) => setModulo(e.target.value)} placeholder="Ej: productos" /></label>
          <label>Entidad <input value={entidad} onChange={(e) => setEntidad(e.target.value)} placeholder="Ej: productos" /></label>
          <button type="submit" className="btn-fantasma adm-btn">Filtrar</button>
        </form>
      </section>
      <section className="card adm-panel" aria-label="Eventos">
        <Tabla
          columnas={[
            { clave: "fecha", titulo: "Fecha", ver: (e) => fechaCorta(e.created_at) },
            { clave: "modulo", titulo: "Módulo" },
            { clave: "accion", titulo: "Acción", ver: (e) => e.accion ?? e.evento ?? "—" },
            { clave: "entidad", titulo: "Entidad", ver: (e) => e.entidad_id ?? e.entidad ?? "—" },
            { clave: "actor", titulo: "Actor", ver: (e) => (e.actor_id ?? e.user_id ?? "—").toString().slice(0, 8) },
          ]}
          filas={lista}
          filaKey={(e) => e.id ?? `${e.created_at ?? "?"}-${e.modulo ?? "?"}-${e.accion ?? e.evento ?? "?"}`}
          vacio="Sin eventos registrados."
        />
        <p className="texto-mutado">Append-only: este registro no se puede editar ni borrar desde el panel.</p>
      </section>
    </div>
  );
}
