// HefestoTech · Admin · Stock: ajuste por delta (POST /api/admin/stock/ajustar)
// + alerta de bajo stock. RPC con control de concurrencia en servidor.
import { useMemo, useState } from "react";
import { adminApi } from "./adminApi";
import { Cabecera, Proximamente, SinPermiso, Skeleton, Tabla } from "./ui";
import { useModulo } from "./ui";

export default function Stock({ avisar }) {
  const [productoId, setProductoId] = useState("");
  const [delta, setDelta] = useState("");
  const [motivo, setMotivo] = useState("ajuste");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  const { estado, datos, recargar } = useModulo(
    () => adminApi.productos({ limit: 200 }),
    []
  );
  const lista = datos?.productos ?? [];

  const bajo = useMemo(
    () => lista.filter((p) => Number(p.stock ?? 0) <= Number(p.stock_minimo ?? 5)),
    [lista]
  );

  const ajustar = async (e) => {
    e.preventDefault();
    const d = Number(delta);
    if (!productoId || !d || d === 0) {
      avisar("Elegí un producto y un delta distinto de cero.", { tono: "error" });
      return;
    }
    setGuardando(true);
    try {
      const r = await adminApi.ajustarStock({
        producto_id: productoId,
        delta: d,
        motivo: motivo.trim() || "ajuste",
        nota: nota.trim(),
      });
      avisar(`Stock actualizado: ahora ${r?.stock ?? "—"}.`);
      setDelta("");
      setNota("");
      recargar();
    } catch (err) {
      avisar(err?.message ?? "No se pudo ajustar.", { tono: "error" });
    } finally {
      setGuardando(false);
    }
  };

  if (estado === "cargando") return <Skeleton lineas={6} etiqueta="Cargando stock…" />;
  if (estado === "sin-permiso") return <SinPermiso modulo="Stock" />;
  if (estado === "no-disponible") return <Proximamente modulo="Stock" />;

  return (
    <div>
      <Cabecera kicker="Inventario" titulo="Stock" />
      {bajo.length > 0 && (
        <section className="card adm-panel adm-alerta" aria-label="Bajo stock">
          <h2>Bajo stock ({bajo.length})</h2>
          <ul className="adm-lista">
            {bajo.slice(0, 10).map((p) => (
              <li key={p.id}>
                <span>{p.nombre}</span>
                <strong>{p.stock} / mín {p.stock_minimo ?? 5}</strong>
                <button type="button" className="btn-fantasma adm-mini" onClick={() => setProductoId(p.id)}>
                  Elegir
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="adm-grid-2">
        <section className="card adm-panel" aria-label="Ajustar stock">
          <h2>Ajustar stock</h2>
          <form onSubmit={ajustar} className="adm-form">
            <label>Producto
              <select value={productoId} onChange={(e) => setProductoId(e.target.value)} required>
                <option value="">— Elegir —</option>
                {lista.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre} (stock {p.stock})</option>
                ))}
              </select>
            </label>
            <div className="adm-fila-2">
              <label>Delta (+ entra / − sale)
                <input type="number" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="Ej: 5 o -2" required />
              </label>
              <label>Motivo
                <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={120} />
              </label>
            </div>
            <label>Nota (opcional)
              <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: compra a proveedor…" />
            </label>
            <button type="submit" className="btn-primary adm-btn" disabled={guardando}>
              {guardando ? "Guardando…" : "Aplicar ajuste"}
            </button>
          </form>
        </section>
        <section className="card adm-panel" aria-label="Niveles">
          <h2>Niveles ({lista.length})</h2>
          <Tabla
            columnas={[
              { clave: "nombre", titulo: "Producto", ver: (p) => p.nombre },
              { clave: "stock", titulo: "Stock", ver: (p) => `${p.stock ?? 0} / mín ${p.stock_minimo ?? 5}` },
            ]}
            filas={lista.slice(0, 30)}
            filaKey={(p) => p.id}
            vacio="Sin productos."
          />
        </section>
      </div>
    </div>
  );
}
