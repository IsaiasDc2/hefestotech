// HefestoTech · Admin · Reposición automática de stock. Al bajar del mínimo se
// registra una solicitud al proveedor principal (orden de compra) y queda una
// notificación. Sección plegable dentro de Stock: no cambia el resto de la pantalla.
import { useMemo, useState } from "react";
import { adminApi, fechaCorta, formatoARS } from "./adminApi";
import { useModulo } from "./hooks";

export default function Reposicion({ avisar, onIr, productos, refrescar = 0, onCambio }) {
  const [abierta, setAbierta] = useState(false);
  const [productoRepo, setProductoRepo] = useState("");
  const [minRepo, setMinRepo] = useState("5");
  const [objetivoRepo, setObjetivoRepo] = useState("0");
  const [guardandoRepo, setGuardandoRepo] = useState(false);
  const [pidiendo, setPidiendo] = useState("");
  const [asignarAbierto, setAsignarAbierto] = useState("");
  const [proveedorElegido, setProveedorElegido] = useState("");
  const [asignando, setAsignando] = useState("");

  const repoMod = useModulo(() => adminApi.reposicion(), [refrescar]);
  const provMod = useModulo(
    () => (abierta ? adminApi.proveedores({ estado: "activo", limit: 200 }) : Promise.resolve(null)),
    [abierta]
  );
  const proveedores = provMod.datos?.proveedores ?? [];

  // El backend solo devuelve los bajo el mínimo que ya tienen proveedor: se suman
  // los que no (son los que hay que asignar) para coincidir con "Bajo stock".
  const bajos = useMemo(() => {
    const locales = productos
      .filter((p) => Number(p.stock ?? 0) < Number(p.stock_minimo ?? 5))
      .map((p) => ({
        ...p,
        proveedor: null,
        en_ordenes: 0,
        sugerida: Math.max(Number(p.stock_objetivo || 0) - Number(p.stock || 0), 1),
      }));
    if (repoMod.estado !== "ok") return locales;
    const api = repoMod.datos?.bajos ?? [];
    const conocidos = new Set(api.map((p) => String(p.id)));
    return [...api, ...locales.filter((p) => !conocidos.has(String(p.id)))];
  }, [repoMod.datos, repoMod.estado, productos]);
  const solicitudes = repoMod.datos?.solicitudes ?? [];

  const actualizar = async () => {
    await Promise.all([repoMod.recargar(), onCambio?.()]);
  };

  const elegirProductoRepo = (id) => {
    setProductoRepo(id);
    const p = productos.find((x) => x.id === id);
    if (p) {
      setMinRepo(String(p.stock_minimo ?? 5));
      setObjetivoRepo(String(p.stock_objetivo ?? 0));
    }
  };

  const guardarConfig = async (e) => {
    e.preventDefault();
    if (!productoRepo) {
      avisar("Elegí un producto para configurar.", { tono: "error" });
      return;
    }
    setGuardandoRepo(true);
    try {
      const r = await adminApi.configurarReposicion(productoRepo, {
        stock_minimo: Number(minRepo) || 0,
        stock_objetivo: Number(objetivoRepo) || 0,
      });
      if (r?.aviso) {
        avisar(r.aviso, { tono: "error" });
      } else if (r?.reposicion?.accion === "solicitud_creada") {
        avisar(
          `Punto guardado. Se envió la solicitud ${r.reposicion.codigo} por ${r.reposicion.cantidad} u.`
        );
      } else {
        avisar("Punto de reposición guardado.");
      }
      await actualizar();
    } catch (err) {
      avisar(err?.message ?? "No se pudo guardar.", { tono: "error" });
    } finally {
      setGuardandoRepo(false);
    }
  };

  const pedir = async (id) => {
    setPidiendo(id || "todos");
    try {
      const r = await adminApi.pedirReposicion(id || undefined);
      const res = r?.resultados ?? [];
      const creadas = res.filter((x) => x?.accion === "solicitud_creada");
      if (creadas.length) {
        avisar(
          `Solicitud enviada: ${creadas.map((x) => `${x.codigo} (${x.cantidad} u. de ${x.proveedor})`).join(" · ")}.`
        );
      } else {
        const ya = res.find((x) => x?.accion === "ya_pedido");
        const sinProv = res.find((x) => x?.accion === "sin_proveedor");
        if (ya) avisar(`Ya hay una orden de compra abierta: ${ya.codigo}.`);
        else if (sinProv) avisar("El producto no tiene proveedor principal activo.", { tono: "error" });
        else avisar("No hay productos bajo el mínimo para pedir.");
      }
      await actualizar();
    } catch (err) {
      avisar(err?.message ?? "No se pudo pedir la reposición.", { tono: "error" });
    } finally {
      setPidiendo("");
    }
  };

  const asignarProveedor = async (p) => {
    if (!proveedorElegido) {
      avisar("Elegí un proveedor de la lista.", { tono: "error" });
      return;
    }
    const prov = proveedores.find((x) => x.id === proveedorElegido);
    setAsignando(p.id);
    try {
      await adminApi.vincularProducto(proveedorElegido, p.id, {
        costo_centavos: 0,
        moneda: prov?.moneda ?? "ARS",
        codigo_proveedor: "",
        cantidad_minima: 1,
        tiempo_entrega_dias: Number(prov?.plazo_entrega_dias ?? 7),
        es_principal: true,
      });
      avisar(`Proveedor asignado a ${p.nombre}. Si sigue bajo el mínimo, ya se envía la solicitud.`);
      setAsignarAbierto("");
      setProveedorElegido("");
      await actualizar();
    } catch (err) {
      avisar(err?.message ?? "No se pudo asignar el proveedor.", { tono: "error" });
    } finally {
      setAsignando("");
    }
  };

  return (
    <section className="card adm-panel adm-repo" aria-label="Reposición de stock">
      <div className="adm-repo-cab">
        <div>
          <h2>Reposición automática</h2>
          <p className="texto-mutado">
            Cuando el stock baja del mínimo se registra una solicitud al proveedor principal
            y aparece una notificación con el producto y la cantidad.
          </p>
        </div>
        <div className="adm-form-acciones">
          {abierta && (
            <button
              type="button"
              className="btn-primary adm-btn"
              onClick={() => pedir("")}
              disabled={pidiendo !== "" || bajos.length === 0}
            >
              {pidiendo === "todos" ? "Revisando…" : "Revisar y pedir"}
            </button>
          )}
          <button
            type="button"
            className="btn-fantasma adm-btn"
            onClick={() => setAbierta((v) => !v)}
            aria-expanded={abierta}
          >
            {abierta ? "Cerrar" : `Abrir (${bajos.length} bajo el mínimo)`}
          </button>
        </div>
      </div>

      {abierta && (
        <>
          <div className="adm-grid-2">
            <div className="adm-repo-col">
              <h3>Bajo el mínimo ({bajos.length})</h3>
              {bajos.length === 0 ? (
                <p className="texto-mutado">Todo el catálogo está por encima del punto de reposición.</p>
              ) : (
                <ul className="adm-lista">
                  {bajos.slice(0, 12).map((p) => {
                    const proveedor = p.proveedor?.nombre;
                    const pedido = Number(p.en_ordenes || 0);
                    return (
                      <li key={p.id} className="adm-repo-item">
                        <div className="adm-repo-texto">
                          <span className="adm-repo-nombre">{p.nombre}</span>
                          <span className="texto-mutado">
                            Stock {p.stock} · mínimo {p.stock_minimo ?? 5}
                            {Number(p.stock_objetivo) > 0 ? ` · objetivo ${p.stock_objetivo}` : ""}
                          </span>
                          <span className="texto-mutado">
                            {proveedor ? `Proveedor: ${proveedor}` : "Sin proveedor principal"}
                            {p.sugerida ? ` · pedir ${p.sugerida} u.` : ""}
                          </span>
                        </div>
                        {pedido > 0 ? (
                          <span className="adm-repo-chip">Ya pedido ({pedido})</span>
                        ) : proveedor ? (
                          <button
                            type="button"
                            className="btn-fantasma adm-mini"
                            onClick={() => pedir(p.id)}
                            disabled={pidiendo !== ""}
                          >
                            {pidiendo === p.id ? "Pidiendo…" : "Pedir"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-fantasma adm-mini"
                            onClick={() => {
                              setAsignarAbierto((v) => (v === p.id ? "" : p.id));
                              setProveedorElegido("");
                            }}
                            aria-expanded={asignarAbierto === p.id}
                          >
                            {asignarAbierto === p.id ? "Cerrar" : "Asignar proveedor"}
                          </button>
                        )}

                        {asignarAbierto === p.id && (
                          <div className="adm-repo-asignar">
                            {provMod.estado === "cargando" ? (
                              <span className="texto-mutado">Cargando proveedores…</span>
                            ) : proveedores.length === 0 ? (
                              <>
                                <span className="texto-mutado">No hay proveedores activos.</span>
                                <button
                                  type="button"
                                  className="btn-fantasma adm-mini"
                                  onClick={() => onIr?.("proveedores")}
                                >
                                  Ir a Proveedores
                                </button>
                              </>
                            ) : (
                              <>
                                <select
                                  value={proveedorElegido}
                                  onChange={(e) => setProveedorElegido(e.target.value)}
                                  aria-label={`Proveedor para ${p.nombre}`}
                                >
                                  <option value="">— Elegir proveedor —</option>
                                  {proveedores.map((pr) => (
                                    <option key={pr.id} value={pr.id}>
                                      {pr.nombre}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className="btn-primary adm-mini"
                                  onClick={() => asignarProveedor(p)}
                                  disabled={asignando === p.id || !proveedorElegido}
                                >
                                  {asignando === p.id ? "Asignando…" : "Asignar"}
                                </button>
                                <button
                                  type="button"
                                  className="btn-fantasma adm-mini"
                                  onClick={() => {
                                    setAsignarAbierto("");
                                    setProveedorElegido("");
                                  }}
                                  disabled={asignando === p.id}
                                >
                                  Cancelar
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <form className="adm-form" onSubmit={guardarConfig}>
              <h3>Configurar punto de reposición</h3>
              <label>Producto
                <select value={productoRepo} onChange={(e) => elegirProductoRepo(e.target.value)} required>
                  <option value="">— Elegir —</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre} (stock {p.stock})</option>
                  ))}
                </select>
              </label>
              <div className="adm-fila-2">
                <label>Avisar cuando baje de
                  <input
                    type="number"
                    min="0"
                    max="1000000"
                    value={minRepo}
                    onChange={(e) => setMinRepo(e.target.value)}
                    required
                  />
                </label>
                <label>Comprar hasta
                  <input
                    type="number"
                    min="0"
                    max="1000000"
                    value={objetivoRepo}
                    onChange={(e) => setObjetivoRepo(e.target.value)}
                    required
                  />
                </label>
              </div>
              <p className="texto-mutado">
                Con objetivo 0 se pide el doble del mínimo. La solicitud respeta la
                cantidad mínima de compra del proveedor.
              </p>
              <div className="adm-form-acciones">
                <button type="submit" className="btn-primary adm-btn" disabled={guardandoRepo}>
                  {guardandoRepo ? "Guardando…" : "Guardar punto"}
                </button>
              </div>
            </form>
          </div>

          <h3>Solicitudes recientes ({solicitudes.length})</h3>
          {repoMod.estado === "no-disponible" ? (
            <p className="texto-mutado">
              Falta aplicar la migración 016 para ver las solicitudes automáticas.
            </p>
          ) : solicitudes.length === 0 ? (
            <p className="texto-mutado">Todavía no se enviaron solicitudes de reposición.</p>
          ) : (
            <ul className="adm-lista">
              {solicitudes.slice(0, 8).map((o) => (
                <li key={o.id} className="adm-repo-item">
                  <div className="adm-repo-texto">
                    <span className="adm-repo-nombre">{o.codigo}</span>
                    <span className="texto-mutado">
                      {o.proveedores?.nombre ?? "Proveedor"} · {fechaCorta(o.created_at)} · {o.estado}
                    </span>
                    <span className="texto-mutado">
                      {(o.ordenes_compra_items ?? [])
                        .map((i) => `${i.productos?.nombre ?? "Producto"} ×${i.cantidad}`)
                        .join(" · ")}
                    </span>
                  </div>
                  <strong>{formatoARS(o.total_centavos)}</strong>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
