// HefestoTech · Admin · Notificaciones: bandeja (campana del topbar).
import { adminApi, fechaCorta } from "./adminApi";
import { Cabecera, Proximamente, SinPermiso, Skeleton, Vacio } from "./ui";
import { useModulo } from "./ui";

export default function Notificaciones({ onLeidas }) {
  const { estado, datos, recargar } = useModulo(() => adminApi.notificaciones({ limit: 30 }), []);
  const lista = datos?.notificaciones ?? [];

  if (estado === "cargando") return <Skeleton lineas={6} etiqueta="Cargando notificaciones…" />;
  if (estado === "sin-permiso") return <SinPermiso modulo="Notificaciones" />;
  if (estado === "no-disponible") return <Proximamente modulo="Notificaciones" />;

  if (onLeidas && lista.length) {
    // Marca visual de lectura al abrir la bandeja (sin endpoint dedicado).
    setTimeout(onLeidas, 0);
  }

  return (
    <div>
      <Cabecera
        kicker="Avisos"
        titulo={`Notificaciones (${lista.length})`}
        acciones={
          <button type="button" className="btn-fantasma adm-btn" onClick={recargar}>
            Actualizar
          </button>
        }
      />
      <section className="card adm-panel" aria-label="Bandeja">
        {lista.length === 0 ? (
          <Vacio
            titulo="Sin notificaciones"
            texto="No hay avisos por ahora."
            accion={
              <button type="button" className="btn-fantasma adm-btn" onClick={recargar}>
                Actualizar
              </button>
            }
          />
        ) : (
          <ul className="adm-lista">
            {lista.map((n, i) => (
              <li key={n.id ?? i}>
                <span><strong>{n.titulo ?? "Aviso"}</strong><br />{n.mensaje ?? n.detalle ?? ""}</span>
                <span className="texto-mutado">{fechaCorta(n.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
