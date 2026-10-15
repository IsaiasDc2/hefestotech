import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FaCircleCheck, FaClock, FaCircleXmark } from "react-icons/fa6";
import Marca from "../../components/brand/Marca";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import { obtenerEstadoPedido, reintentarPago } from "../../services/orderService";

const CONFIG_KEYS = {
  exito: { icono: "exito", clase: "badge-ok", tituloKey: "pago.exito" },
  pendiente: { icono: "pendiente", clase: "badge-info", tituloKey: "pago.pendiente" },
  fallido: { icono: "fallido", clase: "badge-peligro", tituloKey: "pago.fallido" },
};

// Anti redirección abierta: solo dominios oficiales de Mercado Pago.
const esUrlMP = (url) => {
  let destino = null;
  try {
    destino = new URL(url);
  } catch {
    return false;
  }
  const host = destino.hostname.toLowerCase();
  return (
    destino.protocol === "https:" &&
    (host === "mercadopago.com" ||
      host === "mercadopago.com.ar" ||
      host.endsWith(".mercadopago.com") ||
      host.endsWith(".mercadopago.com.ar") ||
      host.endsWith(".mercadolibre.com"))
  );
};

/** Pantalla genérica de retorno de MP. Lee el estado DESDE la DB, nunca de la URL. */
export default function PagoResultado({ tipo }) {
  const idioma = useIdiomaStore((s) => s.idioma);
  const [params] = useSearchParams();
  const [estado, setEstado] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [reintentando, setReintentando] = useState(false);
  const cfgKey = CONFIG_KEYS[tipo] ?? CONFIG_KEYS.pendiente;
  const cfgIcono = tipo === "exito" ? <FaCircleCheck aria-hidden="true" /> : tipo === "fallido" ? <FaCircleXmark aria-hidden="true" /> : <FaClock aria-hidden="true" />;
  const cfgTitulo = t(idioma, cfgKey.tituloKey);

  // MP devuelve external_reference como query param en el retorno.
  const ordenId = params.get("external_reference") ?? params.get("orden_id") ?? "";
  const tokenInvitado =
    params.get("token") ??
    (ordenId ? sessionStorage.getItem(`ck_token_${ordenId}`) ?? "" : "");

  useEffect(() => {
    let vivo = true;
    let temporizador = 0;
    const cargar = async (intentos = 0) => {
      try {
        const o = await obtenerEstadoPedido(ordenId, tokenInvitado);
        if (!vivo) return;
        setEstado(o);
        // El webhook puede tardar: reintenta hasta 5 veces si sigue pendiente.
        if (o.estado === "pendiente" && intentos < 5) {
          temporizador = setTimeout(() => vivo && cargar(intentos + 1), 2500);
        } else {
          setCargando(false);
        }
      } catch {
        if (!vivo) return;
        setError(t(idioma, "pago.noPedido"));
        setCargando(false);
      }
    };
    if (ordenId) cargar();
    else {
      setError(t(idioma, "pago.faltaId"));
      setCargando(false);
    }
    return () => { vivo = false; clearTimeout(temporizador); };
  }, [ordenId, tokenInvitado, idioma]);

  const reintentar = async () => {
    setReintentando(true);
    try {
      const { link_pago } = await reintentarPago(ordenId, tokenInvitado);
      if (!esUrlMP(link_pago)) throw new Error(t(idioma, "pago.noReintentar"));
      window.location.href = link_pago;
    } catch (err) {
      setError(err?.message || t(idioma, "pago.noReintentar"));
      setReintentando(false);
    }
  };

  return (
    <div className="checkout centrado">
      <div className="card anim-entrada checkout-exito">
        <span className="marca-centrada" aria-hidden="true">
          <Marca variante="simbolo" ancho={44} alto={44} decorativa />
        </span>
        <p className={`badge ${cfgKey.clase} hero-kicker`}>{cfgIcono} {cfgTitulo}</p>
        <h1>{cfgTitulo}</h1>
        {cargando && <p className="badge badge-info" role="status">{t(idioma, "pago.confirmando")}</p>}
        {error && <p className="badge badge-peligro" role="alert">{error}</p>}
        {estado && (
          <p className="texto-mutado">
            {t(idioma, "pago.pedido")} <strong>{String(estado.id).slice(0, 8)}</strong> {t(idioma, "pago.por")}{" "}
            <strong>${Number(estado.total ?? 0).toLocaleString("es-AR")}</strong>.{" "}
            {t(idioma, "pago.estado")}: <strong>{estado.estado}</strong>.
          </p>
        )}
        {estado?.estado === "pagado" && (
          <p className="texto-mutado">
            {t(idioma, "pago.comprobante")}{" "}
            <Link to={`/pedido/${estado.id}?token=${tokenInvitado}`}>
              {t(idioma, "pago.verComprobante")}
            </Link>
          </p>
        )}
        {(estado?.estado === "rechazado" || estado?.estado === "expirado" || estado?.estado === "cancelada" || tipo === "fallido") && !cargando && (
          <button type="button" className="btn-primary" onClick={reintentar} disabled={reintentando}>
            {reintentando ? t(idioma, "pago.generando") : t(idioma, "pago.reintentar")}
          </button>
        )}
        <div className="checkout-acciones">
          <Link to="/productos" className="btn-fantasma">{t(idioma, "pago.seguir")}</Link>
          <Link to="/cuenta" className="btn-primary">{t(idioma, "pago.verPedidos")}</Link>
        </div>
      </div>
    </div>
  );
}
