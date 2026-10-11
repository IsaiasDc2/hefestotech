// HefestoTech · Admin · Pedidos: bandeja con filtro de estado y cambio de
// estado con control optimista de versión. Totales en centavos del servidor.
import { useState } from "react";
import { adminApi, fechaCorta, formatoARS } from "./adminApi";
import { Cabecera, Proximamente, SinPermiso, Skeleton, Vacio } from "./ui";
import { useModulo } from "./ui";

const ESTADOS = ["", "pendiente", "pagada", "preparacion", "enviada", "entregada", "cancelada", "reembolsada"];

export default function Pedidos({ avisar, pedirConfirm }) {
  const [estado, setEstado] = useState("");
  const [cambiando, setCambiando] = useState("");
  const { estado: est, datos, recargar } = useModulo(
    () => adminApi.pedidos({ estado }),
    [estado]
  );
  const lista = datos?.pedidos ?? [];

  const cambiar = async (p, a) => {
    const ok = await pedirConfirm({
      titulo: "Cambiar estado",
      texto: `Pasar el pedido ${String(p.id).slice(0, 8)} a «${a}».`,
      confirmar: "Cambiar",
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
        <Vacio titulo="Sin pedidos" texto={estado ? `Ninguno en estado «${estado}».` : "Todavía no hay pedidos."} />
      ) : (
        <ul className="adm-tarjetas">
          {lista.map((p) => (
            <li key={p.id} className="card adm-pedido">
              <div className="adm-pedido-head">
                <strong>#{String(p.id).slice(0, 8)}</strong>
                <span className={`adm-estado es-${p.estado}`}>{p.estado}</span>
              </div>
              <p className="texto-mutado">{fechaCorta(p.created_at)}{p.cupon_codigo ? ` · Cupón ${p.cupon_codigo}` : ""}</p>
              <p>
                Subtotal {formatoARS(p.totales?.subtotal_centavos ?? 0)}
                {" · "}Desc. {formatoARS(p.totales?.descuento_centavos ?? 0)}
                {" · "}<strong>Total {formatoARS(p.totales?.total_centavos ?? 0)}</strong>
              </p>
              {Array.isArray(p.orden_items) && p.orden_items.length > 0 && (
                <ul className="adm-lista-chica">
                  {p.orden_items.slice(0, 5).map((it, i) => (
                    <li key={i}>{it.producto_nombre ?? it.nombre ?? "Ítem"} × {it.cantidad ?? 1}</li>
                  ))}
                </ul>
              )}
              <div className="adm-acciones">
                {ESTADOS.filter((s) => s && s !== p.estado).slice(0, 4).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="btn-fantasma adm-mini"
                    disabled={cambiando === p.id}
                    onClick={() => cambiar(p, s)}
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
