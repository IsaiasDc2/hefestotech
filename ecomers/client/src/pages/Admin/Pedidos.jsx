// HefestoTech · Admin · Pedidos: bandeja con filtro de estado, detalle
// desplegable (cliente, envío, ítems, pago) y comprobante PDF por API.
import { useState } from "react";
import { FaChevronDown, FaFileArrowDown, FaReceipt } from "react-icons/fa6";
import { adminApi, fechaCorta, formatoARS } from "./adminApi";
import { Cabecera, Paginador, Proximamente, SinPermiso, Skeleton, Vacio } from "./ui";
import { useModulo, usePaginacion } from "./hooks";
import { esDestructivo, siguientesEstados } from "./pedidosUtil";

const ESTADOS = ["", "pendiente", "pagada", "preparacion", "enviada", "entregada", "cancelada", "reembolsada"];

const envioEtiqueta = (v) => (String(v).toLowerCase() === "express" ? "Express" : "Estándar");
const precioPesos = (v) => formatoARS(Math.round(Number(v ?? 0) * 100));

const TRANSPORTISTAS = ["Correo Argentino", "Andreani", "OCA", "Enviopack", "Moto / flete propio", "Otro"];
const ESTADOS_CON_ENVIO = ["preparacion", "enviada", "entregada"];
const ESTADOS_REEMBOLSABLES = ["pagada", "entregada"];
const SIN_FILTROS = { q: "", desde: "", hasta: "" };

// Transportista y seguimiento del envío (migración 017). Si el pedido ya está
// enviado, al guardar el cliente recibe el seguimiento por email.
function Seguimiento({ pedido, avisar, onGuardado }) {
  const [form, setForm] = useState({
    transportista: pedido.transportista ?? "",
    codigo: pedido.tracking_codigo ?? "",
    url: pedido.tracking_url ?? "",
  });
  const [guardando, setGuardando] = useState(false);
  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await adminApi.cargarEnvioPedido(pedido.id, form);
      avisar(pedido.estado === "enviada" ? "Seguimiento guardado y enviado al cliente." : "Seguimiento guardado.");
      onGuardado();
    } catch (err) {
      avisar(err?.message ?? "No se pudo guardar el seguimiento.", { tono: "error" });
    } finally {
      setGuardando(false);
    }
  };
  return (
    <form className="adm-form" onSubmit={guardar} aria-label="Seguimiento del envío">
      <p className="adm-detalle-subtitulo">Seguimiento del envío</p>
      <div className="adm-seguimiento-campos">
        <label>Transportista
          <select value={form.transportista} onChange={(e) => setForm({ ...form, transportista: e.target.value })}>
            <option value="">Elegí uno</option>
            {TRANSPORTISTAS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>Código de seguimiento
          <input value={form.codigo} maxLength={80} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
        </label>
        <label>Enlace de seguimiento
          <input type="url" value={form.url} maxLength={500} placeholder="https://" onChange={(e) => setForm({ ...form, url: e.target.value })} />
        </label>
      </div>
      <div className="adm-form-acciones">
        <button type="submit" className="btn-fantasma adm-btn" disabled={guardando || (!form.transportista && !form.codigo)}>
          {guardando ? "Guardando…" : "Guardar seguimiento"}
        </button>
      </div>
    </form>
  );
}

export default function Pedidos({ avisar, pedirConfirm, rol }) {
  const [estado, setEstado] = useState("");
  const [cambiando, setCambiando] = useState("");
  const [abierto, setAbierto] = useState("");
  const [bajando, setBajando] = useState("");
  const [viendoPago, setViendoPago] = useState("");
  const [borrador, setBorrador] = useState(SIN_FILTROS);
  const [filtros, setFiltros] = useState(SIN_FILTROS);
  const puedeReembolsar = rol === "owner" || rol === "admin";
  const pg = usePaginacion(`${estado}|${filtros.q}|${filtros.desde}|${filtros.hasta}`);
  const { estado: est, datos, recargar } = useModulo(
    () => adminApi.pedidos({ estado, ...filtros, limit: pg.por, offset: pg.offset }),
    [estado, filtros.q, filtros.desde, filtros.hasta, pg.por, pg.offset]
  );
  const hayFiltros = Boolean(filtros.q || filtros.desde || filtros.hasta);

  const reembolsar = async (p) => {
    const ok = await pedirConfirm({
      titulo: "Reembolsar por Mercado Pago",
      texto:
        `Se devuelve el importe total del pedido ${p.numero ?? String(p.id).slice(0, 8)} al cliente ` +
        "por Mercado Pago y el pedido pasa a «reembolsada». No se puede deshacer.",
      confirmar: "Reembolsar",
      peligro: true,
    });
    if (!ok) return;
    const devolverStock = await pedirConfirm({
      titulo: "¿Devolver los productos al stock?",
      texto: "Elegí «Sí, devolver» si la mercadería vuelve al inventario. Si no vuelve (rota, perdida), elegí cancelar.",
      confirmar: "Sí, devolver",
    });
    setCambiando(p.id);
    try {
      await adminApi.reembolsarPedido(p.id, { devolver_stock: Boolean(devolverStock) });
      avisar("Reembolso realizado y cliente avisado.");
      recargar();
    } catch (err) {
      avisar(err?.message ?? "No se pudo reembolsar.", { tono: "error" });
    } finally {
      setCambiando("");
    }
  };
  const lista = datos?.pedidos ?? [];

  const cambiar = async (p, a) => {
    const ok = await pedirConfirm({
      titulo: "Cambiar estado",
      texto:
        `Pasar el pedido ${p.numero ?? String(p.id).slice(0, 8)} a «${a}».` +
        (a === "cancelada" ? " El stock de sus productos vuelve al inventario." : ""),
      confirmar: "Cambiar",
      peligro: esDestructivo(a),
    });
    if (!ok) return;
    setCambiando(p.id);
    try {
      await adminApi.cambiarEstadoPedido(p.id, { a, version: p.version ?? null });
      avisar(`Pedido → ${a}.`);
      recargar();
    } catch (err) {
      avisar(err?.message ?? "No se pudo cambiar el estado.", { tono: "error" });
    } finally {
      setCambiando("");
    }
  };

  const comprobante = async (p, modo) => {
    setBajando(p.id);
    try {
      const blob = await adminApi.comprobantePedidoPdf(p.id);
      const url = URL.createObjectURL(blob);
      if (modo === "descargar") {
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = `comprobante-${p.comprobante?.numero || String(p.id).slice(0, 8)}.pdf`;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
      } else {
        window.open(url, "_blank", "noopener");
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      avisar(err?.message ?? "No se pudo obtener el comprobante.", { tono: "error" });
    } finally {
      setBajando("");
    }
  };

  const verComprobantePago = async (p) => {
    setViendoPago(p.id);
    try {
      const r = await adminApi.comprobantePagoPedido(p.id);
      const url = r?.comprobante?.archivo_url;
      if (!url) throw new Error("No se pudo abrir el comprobante.");
      window.open(url, "_blank", "noopener");
    } catch (err) {
      avisar(err?.message ?? "No se pudo abrir el comprobante de pago.", { tono: "error" });
    } finally {
      setViendoPago("");
    }
  };

  if (est === "cargando") return <Skeleton lineas={6} etiqueta="Cargando pedidos…" />;
  if (est === "sin-permiso") return <SinPermiso modulo="Pedidos" />;
  if (est === "no-disponible") return <Proximamente modulo="Pedidos" />;

  return (
    <div>
      <Cabecera
        kicker="Ventas"
        titulo={`Pedidos (${datos?.total ?? lista.length})`}
        acciones={
          <div className="adm-acciones-cab">
            <label className="adm-filtro">Estado
              <select value={estado} onChange={(e) => setEstado(e.target.value)}>
                {ESTADOS.map((s) => (
                  <option key={s} value={s}>{s === "" ? "Todos" : s}</option>
                ))}
              </select>
            </label>
            <button type="button" className="btn-fantasma adm-btn" onClick={recargar}>
              Actualizar
            </button>
          </div>
        }
      />
      <section className="card adm-panel" aria-label="Buscar pedidos">
        <form
          className="adm-buscador-linea"
          onSubmit={(e) => {
            e.preventDefault();
            setFiltros({ q: borrador.q.trim(), desde: borrador.desde, hasta: borrador.hasta });
          }}
        >
          <input
            value={borrador.q}
            onChange={(e) => setBorrador({ ...borrador, q: e.target.value })}
            placeholder="Número (HT-…), email o nombre"
            aria-label="Buscar pedidos"
          />
          <label>Desde
            <input type="date" value={borrador.desde} max={borrador.hasta || undefined}
              onChange={(e) => setBorrador({ ...borrador, desde: e.target.value })} />
          </label>
          <label>Hasta
            <input type="date" value={borrador.hasta} min={borrador.desde || undefined}
              onChange={(e) => setBorrador({ ...borrador, hasta: e.target.value })} />
          </label>
          <button type="submit" className="btn-fantasma adm-btn">Buscar</button>
          {hayFiltros && (
            <button
              type="button"
              className="btn-fantasma adm-btn"
              onClick={() => {
                setBorrador(SIN_FILTROS);
                setFiltros(SIN_FILTROS);
              }}
            >
              Limpiar
            </button>
          )}
        </form>
      </section>
      {lista.length === 0 ? (
        <Vacio
          titulo="Sin pedidos"
          texto={estado ? `Ninguno en estado «${estado}».` : "Todavía no hay pedidos."}
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
          {lista.map((p) => {
            const abiertoEste = abierto === p.id;
            const detalleId = `adm-pedido-det-${p.id}`;
            const descuento = p.descuento_centavos ?? p.totales?.descuento_centavos ?? 0;
            return (
              <li key={p.id} className="card adm-pedido">
                <button
                  type="button"
                  className="adm-pedido-toggle"
                  onClick={() => setAbierto(abiertoEste ? "" : p.id)}
                  aria-expanded={abiertoEste}
                  aria-controls={detalleId}
                >
                  <span className="adm-pedido-head">
                    <strong>{p.numero ?? `#${String(p.id).slice(0, 8)}`}</strong>
                    <span className={`adm-estado es-${p.estado}`}>{p.estado}</span>
                  </span>
                  <span className="adm-pedido-meta texto-mutado">
                    {fechaCorta(p.created_at)}{p.nombre ? ` · ${p.nombre}` : ""}
                    {p.comprobante ? " · comprobante emitido" : ""}
                    {p.comprobante_pago ? " · comprobante de pago cargado" : ""}
                    <FaChevronDown className="adm-caret" aria-hidden="true" />
                  </span>
                </button>
                <p>
                  Subtotal {formatoARS(p.totales?.subtotal_centavos ?? 0)}
                  {" · "}Desc. {formatoARS(descuento)}
                  {" · "}<strong>Total {formatoARS(p.total_centavos ?? p.totales?.total_centavos ?? 0)}</strong>
                </p>
                {Array.isArray(p.orden_items) && p.orden_items.length > 0 && (
                  <ul className="adm-lista-chica">
                    {p.orden_items.slice(0, 5).map((it, i) => (
                      <li key={it.id ?? i}>
                        {it.productos?.nombre ?? it.producto_nombre ?? "Producto"} × {it.cantidad ?? 1}
                      </li>
                    ))}
                  </ul>
                )}

                {abiertoEste && (
                  <div className="adm-pedido-detalle" id={detalleId} role="region" aria-label={`Detalle del pedido ${String(p.id).slice(0, 8)}`}>
                    <dl className="adm-detalle-grid">
                      <div>
                        <dt>Cliente</dt>
                        <dd>{p.nombre || "—"}</dd>
                      </div>
                      <div>
                        <dt>Email</dt>
                        <dd>{p.email || "—"}</dd>
                      </div>
                      <div>
                        <dt>Envío</dt>
                        <dd>{envioEtiqueta(p.envio)} — {formatoARS(p.costo_envio_centavos ?? 0)}</dd>
                      </div>
                      <div>
                        <dt>Dirección de entrega</dt>
                        <dd>{p.direccion || "—"}</dd>
                      </div>
                      <div>
                        <dt>Ciudad</dt>
                        <dd>{p.ciudad || "—"}</dd>
                      </div>
                      <div>
                        <dt>Código postal</dt>
                        <dd>{p.codigo_postal || "—"}</dd>
                      </div>
                      {p.cupon_codigo ? (
                        <div>
                          <dt>Cupón</dt>
                          <dd>{p.cupon_codigo} (−{formatoARS(descuento)})</dd>
                        </div>
                      ) : null}
                      {p.mp_payment_id ? (
                        <div>
                          <dt>Pago Mercado Pago</dt>
                          <dd>{p.mp_payment_id}</dd>
                        </div>
                      ) : null}
                    </dl>

                    {Array.isArray(p.orden_items) && p.orden_items.length > 0 && (
                      <div>
                        <p className="adm-detalle-subtitulo">Ítems</p>
                        <ul className="adm-lista-chica">
                          {p.orden_items.map((it, i) => (
                            <li key={it.id ?? i}>
                              {it.productos?.nombre ?? it.producto_nombre ?? "Producto"} × {it.cantidad ?? 1}
                              {" · "}{precioPesos(it.precio)}
                            </li>
                          ))}
                        </ul>
                        <div className="adm-detalle-totales">
                          <p>Subtotal {formatoARS(p.totales?.subtotal_centavos ?? 0)}</p>
                          {descuento > 0 && <p>Descuento −{formatoARS(descuento)}</p>}
                          <p>Envío {formatoARS(p.costo_envio_centavos ?? 0)}</p>
                          <p><strong>Total {formatoARS(p.total_centavos ?? p.totales?.total_centavos ?? 0)}</strong></p>
                        </div>
                      </div>
                    )}

                    <div className="adm-detalle-comprobante">
                      <p className="adm-detalle-subtitulo">Comprobante de pago del cliente</p>
                      {p.comprobante_pago ? (
                        <>
                          <p>
                            <FaReceipt aria-hidden="true" /> {p.comprobante_pago.archivo_nombre || "Comprobante"}
                            {" · "}{fechaCorta(p.comprobante_pago.created_at)}
                            {" · "}{formatoARS(p.comprobante_pago.monto_centavos ?? 0)}
                          </p>
                          {p.comprobante_pago.nota ? (
                            <p className="texto-mutado">Nota: {p.comprobante_pago.nota}</p>
                          ) : null}
                          <div className="adm-acciones">
                            <button
                              type="button"
                              className="btn-primary adm-btn adm-mini"
                              disabled={viendoPago === p.id}
                              onClick={() => verComprobantePago(p)}
                            >
                              {viendoPago === p.id ? "Abriendo…" : "Ver comprobante de pago"}
                            </button>
                          </div>
                        </>
                      ) : (
                        <p className="texto-mutado">
                          El cliente todavía no cargó un comprobante de pago.
                        </p>
                      )}
                    </div>

                    <div className="adm-detalle-comprobante">
                      {p.comprobante ? (
                        <>
                          <p>
                            <FaReceipt aria-hidden="true" /> Comprobante {p.comprobante.numero || "—"}
                            {" · "}{fechaCorta(p.comprobante.emitido_en)}
                          </p>
                          <div className="adm-acciones">
                            <button
                              type="button"
                              className="btn-fantasma adm-mini"
                              disabled={bajando === p.id}
                              onClick={() => comprobante(p, "ver")}
                            >
                              Ver
                            </button>
                            <button
                              type="button"
                              className="btn-primary adm-btn adm-mini"
                              disabled={bajando === p.id}
                              onClick={() => comprobante(p, "descargar")}
                            >
                              <FaFileArrowDown aria-hidden="true" /> Descargar PDF
                            </button>
                          </div>
                        </>
                      ) : (
                        <p className="texto-mutado">
                          Comprobante: se emite automáticamente cuando Mercado Pago acredita el pago.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {abiertoEste && ESTADOS_CON_ENVIO.includes(p.estado) && (
                  <Seguimiento pedido={p} avisar={avisar} onGuardado={recargar} />
                )}

                <div className="adm-pedido-acciones">
                  <span className="texto-mutado">Cambiar estado:</span>
                  <div className="adm-acciones">
                    {siguientesEstados(p.estado)
                      // Con pago de Mercado Pago, «reembolsada» solo por el reembolso real
                      // (el botón común cambiaría la etiqueta sin devolver el dinero).
                      .filter((s) => !(s === "reembolsada" && puedeReembolsar && p.mp_payment_id))
                      .map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`btn-fantasma adm-mini${esDestructivo(s) ? " es-peligro" : ""}`}
                        disabled={cambiando === p.id}
                        onClick={() => cambiar(p, s)}
                      >
                        → {s}
                      </button>
                    ))}
                    {puedeReembolsar && p.mp_payment_id && ESTADOS_REEMBOLSABLES.includes(p.estado) && (
                      <button
                        type="button"
                        className="btn-fantasma adm-mini es-peligro"
                        disabled={cambiando === p.id}
                        onClick={() => reembolsar(p)}
                      >
                        Reembolsar por Mercado Pago
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {(datos?.total ?? 0) > 10 && (
        <div className="card adm-panel">
          <Paginador total={datos.total} pagina={pg.pagina} por={pg.por} onPagina={pg.irA} onPor={pg.cambiarPor} />
        </div>
      )}
    </div>
  );
}
