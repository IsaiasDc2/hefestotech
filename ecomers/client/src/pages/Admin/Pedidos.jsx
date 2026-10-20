// HefestoTech · Admin · Pedidos: bandeja con filtro de estado, detalle
// desplegable (cliente, envío, ítems, pago) y comprobante PDF por API.
import { useState } from "react";
import { FaChevronDown, FaFileArrowDown, FaReceipt } from "react-icons/fa6";
import { adminApi, fechaCorta, formatoARS } from "./adminApi";
import { Cabecera, Proximamente, SinPermiso, Skeleton, Vacio } from "./ui";
import { useModulo } from "./hooks";
import { esDestructivo, siguientesEstados } from "./pedidosUtil";

const ESTADOS = ["", "pendiente", "pagada", "preparacion", "enviada", "entregada", "cancelada", "reembolsada"];

const envioEtiqueta = (v) => (String(v).toLowerCase() === "express" ? "Express" : "Estándar");
const precioPesos = (v) => formatoARS(Math.round(Number(v ?? 0) * 100));

export default function Pedidos({ avisar, pedirConfirm }) {
  const [estado, setEstado] = useState("");
  const [cambiando, setCambiando] = useState("");
  const [abierto, setAbierto] = useState("");
  const [bajando, setBajando] = useState("");
  const { estado: est, datos, recargar } = useModulo(
    () => adminApi.pedidos({ estado }),
    [estado]
  );
  const lista = datos?.pedidos ?? [];

  const cambiar = async (p, a) => {
    const ok = await pedirConfirm({
      titulo: "Cambiar estado",
      texto:
        `Pasar el pedido ${String(p.id).slice(0, 8)} a «${a}».` +
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

  if (est === "cargando") return <Skeleton lineas={6} etiqueta="Cargando pedidos…" />;
  if (est === "sin-permiso") return <SinPermiso modulo="Pedidos" />;
  if (est === "no-disponible") return <Proximamente modulo="Pedidos" />;

  return (
    <div>
      <Cabecera
        kicker="Ventas"
        titulo={`Pedidos (${lista.length})`}
        acciones={
          <label className="adm-filtro">Estado
            <select value={estado} onChange={(e) => setEstado(e.target.value)}>
              {ESTADOS.map((s) => (
                <option key={s} value={s}>{s === "" ? "Todos" : s}</option>
              ))}
            </select>
          </label>
        }
      />
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
                    <strong>#{String(p.id).slice(0, 8)}</strong>
                    <span className={`adm-estado es-${p.estado}`}>{p.estado}</span>
                  </span>
                  <span className="adm-pedido-meta texto-mutado">
                    {fechaCorta(p.created_at)}{p.nombre ? ` · ${p.nombre}` : ""}
                    {p.comprobante ? " · comprobante emitido" : ""}
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

                <div className="adm-acciones">
                  {siguientesEstados(p.estado).map((s) => (
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
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
