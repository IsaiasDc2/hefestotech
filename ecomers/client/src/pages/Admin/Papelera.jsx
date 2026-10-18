// HefestoTech · Admin · Papelera: productos con borrado lógico + restaurar.
// Purga a los 30 días (servidor). El Deshacer de 10s vive en Productos.
import { adminApi } from "./adminApi";
import { Cabecera, Proximamente, SinPermiso, Skeleton, Vacio } from "./ui";
import { useModulo } from "./hooks";

export default function Papelera({ avisar }) {
  const { estado, datos, recargar } = useModulo(
    () => adminApi.productos({ papelera: true, limit: 100 }),
    []
  );
  const lista = datos?.productos ?? [];

  const restaurar = async (p) => {
    try {
      await adminApi.restaurarProducto(p.id);
      avisar(`«${p.nombre}» restaurado.`);
      recargar();
    } catch (err) {
      avisar(err?.message ?? "No se pudo restaurar.", { tono: "error" });
    }
  };

  if (estado === "cargando") return <Skeleton lineas={6} etiqueta="Cargando papelera…" />;
  if (estado === "sin-permiso") return <SinPermiso modulo="Papelera" />;
  if (estado === "no-disponible") return <Proximamente modulo="Papelera" />;

  return (
    <div>
      <Cabecera
        kicker="Recuperar"
        titulo={`Papelera (${lista.length})`}
        acciones={
          <button type="button" className="btn-fantasma adm-btn" onClick={recargar}>
            Actualizar
          </button>
        }
      />
      <section className="card adm-panel" aria-label="Elementos en papelera">
        <p className="texto-mutado">Borrado lógico: los elementos se purgan a los 30 días.</p>
        {lista.length === 0 ? (
          <Vacio
            titulo="Papelera vacía"
            texto="Nada para restaurar."
            accion={
              <button type="button" className="btn-fantasma adm-btn" onClick={recargar}>
                Actualizar
              </button>
            }
          />
        ) : (
          <ul className="adm-lista">
            {lista.map((p) => (
              <li key={p.id}>
                <span>{p.nombre}</span>
                <button type="button" className="btn-fantasma adm-mini" onClick={() => restaurar(p)}>
                  Restaurar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
