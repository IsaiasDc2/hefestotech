// HefestoTech · Admin · Stock: ajuste por delta (POST /api/admin/stock/ajustar)
// + punto de reposición: al bajar del mínimo se registra la solicitud al
// proveedor principal y queda una notificación con producto y cantidad.
import { useMemo, useState } from "react";
import { FaPlus, FaTruckFast } from "react-icons/fa6";
import { adminApi, fechaCorta, formatoARS } from "./adminApi";
import { Cabecera, Proximamente, SinPermiso, Skeleton, Tabla } from "./ui";
import { useModulo } from "./hooks";

export default function Stock({ avisar, accionInicial, onIr }) {
  const [productoId, setProductoId] = useState("");
  const [delta, setDelta] = useState("");
  const [motivo, setMotivo] = useState("ajuste");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [q, setQ] = useState("");
  const [panelAbierto, setPanelAbierto] = useState(accionInicial === "agregar");
  const [panelRepo, setPanelRepo] = useState(accionInicial === "reposicion");
  const [productoRepo, setProductoRepo] = useState("");
  const [minRepo, setMinRepo] = useState("5");
  const [objetivoRepo, setObjetivoRepo] = useState("0");
  const [guardandoRepo, setGuardandoRepo] = useState(false);
  const [pidiendo, setPidiendo] = useState("");
  const [asignarAbierto, setAsignarAbierto] = useState("");
  const [proveedorElegido, setProveedorElegido] = useState("");
  const [asignando, setAsignando] = useState("");

  const { estado, datos, recargar } = useModulo(
    () => adminApi.productos({ limit: 200 }),
    []
  );
  const repoMod = useModulo(() => adminApi.reposicion(), []);
  const provMod = useModulo(
    () => adminApi.proveedores({ estado: "activo", limit: 200 }),
    []
  );
  const proveedores = provMod.datos?.proveedores ?? [];
  const lista = useMemo(() => datos?.productos ?? [], [datos]);
  const qN = q.trim().toLowerCase();
  const filtrada = useMemo(
    () =>
      qN
        ? lista.filter((p) =>
            `${p.nombre ?? ""} ${p.codigo ?? ""} ${p.marca ?? ""}`.toLowerCase().includes(qN)
          )
        : lista,
    [lista, qN]
  );

  const bajo = useMemo(
    () => lista.filter((p) => Number(p.stock ?? 0) < Number(p.stock_minimo ?? 5)),
    [lista]
  );

  // El backend manda la cantidad sugerida y el estado de la OC. Si la
  // migración 016 todavía no está, se muestra igual la lista local.
  const bajos = useMemo(() => {
    const api = repoMod.datos?.bajos ?? [];
    if (repoMod.estado === "ok") return api;
    return bajo.map((p) => ({
      ...p,
      proveedor: null,
      en_ordenes: 0,
      sugerida: Math.max(Number(p.stock_objetivo || 0) - Number(p.stock || 0), 1),
    }));
  }, [repoMod.datos, repoMod.estado, bajo]);
  const solicitudes = repoMod.datos?.solicitudes ?? [];

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
      const repo = r?.reposicion;
      if (repo?.accion === "solicitud_creada") {
        avisar(
          `Stock actualizado: ahora ${r?.stock ?? "—"}. Se envió la solicitud ${repo.codigo} por ${repo.cantidad} u.`
        );
      } else {
        avisar(`Stock actualizado: ahora ${r?.stock ?? "—"}.`);
      }
      setDelta("");
      setNota("");
      await Promise.all([recargar(), repoMod.recargar()]);
    } catch (err) {
      avisar(err?.message ?? "No se pudo ajustar.", { tono: "error" });
    } finally {
      setGuardando(false);
    }
  };

  const elegirProductoRepo = (id) => {
    setProductoRepo(id);
    const p = lista.find((x) => x.id === id);
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
      await Promise.all([recargar(), repoMod.recargar()]);
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
      await Promise.all([recargar(), repoMod.recargar()]);
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
      avisar(
        `Proveedor asignado a ${p.nombre}. Si sigue bajo el mínimo, ya se envía la solicitud.`
      );
      setAsignarAbierto("");
      setProveedorElegido("");
      await Promise.all([recargar(), repoMod.recargar()]);
    } catch (err) {
      avisar(err?.message ?? "No se pudo asignar el proveedor.", { tono: "error" });
    } finally {
      setAsignando("");
    }
  };

  if (estado === "cargando") return <Skeleton lineas={6} etiqueta="Cargando stock…" />;
  if (estado === "sin-permiso") return <SinPermiso modulo="Stock" />;
  if (estado === "no-disponible") return <Proximamente modulo="Stock" />;

  return (
    <div>
      <Cabecera
        kicker="Inventario"
        titulo="Stock"
        acciones={
          <div className="adm-acciones">
            <button
              type="button"
              className="btn-fantasma adm-btn"
              onClick={() => setPanelRepo((v) => !v)}
              aria-expanded={panelRepo}
            >
              <FaTruckFast aria-hidden="true" /> Reposición
            </button>
            <button
              type="button"
              className="btn-primary adm-btn"
              onClick={() => setPanelAbierto((v) => !v)}
              aria-expanded={panelAbierto}
            >
              <FaPlus aria-hidden="true" /> {panelAbierto ? "Cerrar" : "Agregar stock"}
            </button>
          </div>
        }
      />

      {panelRepo && (
        <section className="card adm-panel" aria-label="Reposición de stock">
          <div className="adm-panel-cab">
            <div>
              <h2>Reposición automática</h2>
              <p className="adm-muted">
                Cuando el stock baja del mínimo se registra una solicitud al proveedor
                principal y aparece una notificación con el producto y la cantidad.
              </p>
            </div>
            <button
              type="button"
              className="btn-primary adm-btn"
              onClick={() => pedir("")}
              disabled={pidiendo !== "" || bajos.length === 0}
            >
              {pidiendo === "todos" ? "Revisando…" : "Revisar y pedir"}
            </button>
          </div>

          <div className="adm-grid-2">
            <div>
              <h3>Bajo el mínimo ({bajos.length})</h3>
              {bajos.length === 0 ? (
                <p className="adm-muted">Todo el catálogo está por encima del punto de reposición.</p>
              ) : (
                <ul className="adm-lista">
                  {bajos.slice(0, 12).map((p) => {
                    const proveedor = p.proveedor?.nombre;
                    const pedido = Number(p.en_ordenes || 0);
                    return (
                      <li
                        key={p.id}
                        className={asignarAbierto === p.id ? "adm-item-repo-abierto" : undefined}
                      >
                        <div className="adm-lista-texto">
                          <strong>{p.nombre}</strong>
                          <span className="adm-muted">
                            Stock {p.stock} · mínimo {p.stock_minimo ?? 5}
                            {Number(p.stock_objetivo) > 0 ? ` · objetivo ${p.stock_objetivo}` : ""}
                          </span>
                          <span className="adm-muted">
                            {proveedor ? `Proveedor: ${proveedor}` : "Sin proveedor principal"}
                            {p.sugerida ? ` · pedir ${p.sugerida} u.` : ""}
                          </span>
                        </div>
                        {pedido > 0 ? (
                          <span className="adm-chip">Ya pedido ({pedido})</span>
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
                          <div className="adm-asignar-proveedor">
                            {provMod.estado === "cargando" ? (
                              <span className="adm-muted">Cargando proveedores…</span>
                            ) : proveedores.length === 0 ? (
                              <>
                                <span className="adm-muted">No hay proveedores activos.</span>
                                <button
                                  type="button"
                                  className="btn-fantasma adm-mini"
                                  onClick={() => onIr?.("proveedores", { accion: "nuevo" })}
                                >
                                  Crear proveedor
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
                  {lista.map((p) => (
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
              <p className="adm-muted">
                Con objetivo 0 se pide el doble del mínimo. La solicitud respeta la
                cantidad mínima de compra del proveedor.
              </p>
              <button type="submit" className="btn-primary adm-btn" disabled={guardandoRepo}>
                {guardandoRepo ? "Guardando…" : "Guardar punto"}
              </button>
            </form>
          </div>

          <h3>Solicitudes recientes ({solicitudes.length})</h3>
          {repoMod.estado === "no-disponible" ? (
            <p className="adm-muted">
              Falta aplicar la migración 016 para ver las solicitudes automáticas.
            </p>
          ) : solicitudes.length === 0 ? (
            <p className="adm-muted">Todavía no se enviaron solicitudes de reposición.</p>
          ) : (
            <ul className="adm-lista">
              {solicitudes.slice(0, 8).map((o) => (
                <li key={o.id}>
                  <div className="adm-lista-texto">
                    <strong>{o.codigo}</strong>
                    <span className="adm-muted">
                      {o.proveedores?.nombre ?? "Proveedor"} · {fechaCorta(o.created_at)} · {o.estado}
                    </span>
                    <span className="adm-muted">
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
        </section>
      )}

      {bajo.length > 0 && !panelRepo && (
        <section className="card adm-panel adm-alerta" aria-label="Bajo stock">
          <div className="adm-panel-cab">
            <h2>Bajo stock ({bajo.length})</h2>
            <button type="button" className="btn-fantasma adm-mini" onClick={() => setPanelRepo(true)}>
              Revisar reposición
            </button>
          </div>
          <ul className="adm-lista">
            {bajo.slice(0, 10).map((p) => (
              <li key={p.id}>
                <span>{p.nombre}</span>
                <strong>{p.stock} / mín {p.stock_minimo ?? 5}</strong>
                <button type="button" className="btn-fantasma adm-mini" onClick={() => { setProductoId(p.id); setPanelAbierto(true); }}>
                  Elegir
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className={panelAbierto ? "adm-grid-2" : ""}>
        {panelAbierto && (
        <section className="card adm-panel" aria-label="Ajustar stock">
          <div className="adm-panel-cab">
            <h2>Ajustar stock</h2>
            <button type="button" className="btn-fantasma adm-mini" onClick={() => setPanelAbierto(false)}>
              Cerrar
            </button>
          </div>
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
        )}
        <section className="card adm-panel" aria-label="Niveles">
          <h2>Niveles ({filtrada.length})</h2>
          <form
            className="adm-buscador-linea"
            onSubmit={(e) => e.preventDefault()}
            role="search"
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filtrar por nombre, código o marca…"
              aria-label="Filtrar stock"
            />
            {q && (
              <button type="button" className="btn-fantasma adm-btn" onClick={() => setQ("")}>
                Limpiar
              </button>
            )}
          </form>
          <Tabla
            columnas={[
              { clave: "nombre", titulo: "Producto", ver: (p) => p.nombre },
              { clave: "stock", titulo: "Stock", ver: (p) => `${p.stock ?? 0} / mín ${p.stock_minimo ?? 5}` },
              {
                clave: "objetivo",
                titulo: "Objetivo",
                ver: (p) => (Number(p.stock_objetivo) > 0 ? p.stock_objetivo : "—"),
              },
            ]}
            filas={filtrada.slice(0, 50)}
            filaKey={(p) => p.id}
            vacio="Sin productos."
          />
        </section>
      </div>
    </div>
  );
}
