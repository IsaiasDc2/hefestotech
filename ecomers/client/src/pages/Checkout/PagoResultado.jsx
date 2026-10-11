import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FaCircleCheck, FaClock, FaCircleXmark } from "react-icons/fa6";
import Marca from "../../components/brand/Marca";
import { obtenerEstadoPedido, reintentarPago } from "../../services/orderService";

const CONFIG = {
  exito: { icono: <FaCircleCheck aria-hidden="true" />, clase: "badge-ok", titulo: "¡Pago aprobado!" },
  pendiente: { icono: <FaClock aria-hidden="true" />, clase: "badge-info", titulo: "Pago pendiente" },
  fallido: { icono: <FaCircleXmark aria-hidden="true" />, clase: "badge-peligro", titulo: "Pago rechazado" },
};

/** Pantalla genérica de retorno de MP. Lee el estado DESDE la DB, nunca de la URL. */
export default function PagoResultado({ tipo }) {
  const [params] = useSearchParams();
  const [estado, setEstado] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [reintentando, setReintentando] = useState(false);
  const cfg = CONFIG[tipo] ?? CONFIG.pendiente;

  // MP devuelve external_reference como query param en el retorno.
  const ordenId = params.get("external_reference") ?? params.get("orden_id") ?? "";
  const tokenInvitado =
    params.get("token") ??
    (ordenId ? sessionStorage.getItem(`ck_token_${ordenId}`) ?? "" : "");

  useEffect(() => {
    let vivo = true;
    const cargar = async (intentos = 0) => {
      try {
        const o = await obtenerEstadoPedido(ordenId, tokenInvitado);
        if (!vivo) return;
        setEstado(o);
        // El webhook puede tardar: reintenta hasta 5 veces si sigue pendiente.
        if (o.estado === "pendiente" && intentos < 5) {
          setTimeout(() => vivo && cargar(intentos + 1), 2500);
        } else {
          setCargando(false);
        }
      } catch {
        if (!vivo) return;
        setError("No pudimos encontrar tu pedido. Revisá el enlace o escribinos.");
        setCargando(false);
      }
    };
    if (ordenId) cargar();
    else {
      setError("Falta el identificador del pedido.");
      setCargando(false);
    }
    return () => { vivo = false; };
  }, [ordenId]);

  const reintentar = async () => {
    setReintentando(true);
    try {
      const { link_pago } = await reintentarPago(ordenId, tokenInvitado);
      window.location.href = link_pago;
    } catch (err) {
      setError(err?.message || "No se pudo reintentar.");
      setReintentando(false);
    }
  };

  return (
    <div className="checkout centrado">
      <div className="card anim-entrada checkout-exito">
        <span className="marca-centrada" aria-hidden="true">
          <Marca variante="simbolo" ancho={44} alto={44} decorativa />
        </span>
        <p className={`badge ${cfg.clase} hero-kicker`}>{cfg.icono} {cfg.titulo}</p>
        <h1>{cfg.titulo}</h1>
        {cargando && <p className="badge badge-info" role="status">Confirmando tu pago…</p>}
        {error && <p className="badge badge-peligro" role="alert">{error}</p>}
        {estado && (
          <p className="texto-mutado">
            Pedido <strong>{String(estado.id).slice(0, 8)}</strong> por{" "}
            <strong>${Number(estado.total ?? 0).toLocaleString("es-AR")}</strong>.{" "}
            Estado actual: <strong>{estado.estado}</strong>.
          </p>
        )}
        {estado?.estado === "pagado" && (
          <p className="texto-mutado">
            Comprobante emitido.{" "}
            <Link to={`/pedido/${estado.id}?token=${tokenInvitado}`}>
              Ver comprobante
            </Link>
          </p>
        )}
        {(estado?.estado === "rechazado" || estado?.estado === "expirado" || estado?.estado === "cancelada" || tipo === "fallido") && !cargando && (
          <button type="button" className="btn-primary" onClick={reintentar} disabled={reintentando}>
            {reintentando ? "Generando link…" : "Reintentar pago"}
          </button>
        )}
        <div className="checkout-acciones">
          <Link to="/productos" className="btn-fantasma">Seguir comprando</Link>
          <Link to="/cuenta" className="btn-primary">Ver mis pedidos</Link>
        </div>
      </div>
    </div>
  );
}
