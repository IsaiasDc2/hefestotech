import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { FaFileArrowDown, FaPrint, FaReceipt } from "react-icons/fa6";
import Marca from "../../components/brand/Marca";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import { obtenerComprobante, obtenerEstadoPedido, urlComprobantePdf } from "../../services/orderService";
import ComprobantePago from "./ComprobantePago";
import "./Checkout.css";
import "./PedidoDetalle.css";

/** /pedido/:id — comprobante con snapshot, QR/enlace de verificación, PDF e impresión. */
export default function PedidoDetalle() {
  const { id } = useParams();
  const idioma = useIdiomaStore((s) => s.idioma);
  const [params] = useSearchParams();
  const token =
    params.get("token") ?? (id ? sessionStorage.getItem(`ck_token_${id}`) ?? "" : "");
  const [comp, setComp] = useState(null);
  const [qr, setQr] = useState("");
  const [estado, setEstado] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        // El comprobante de compra solo existe cuando el pago se acreditó.
        // El estado se consulta siempre para permitir subir el comprobante
        // de pago de una orden pendiente.
        const [c, o] = await Promise.all([
          obtenerComprobante(id, token).catch(() => null),
          obtenerEstadoPedido(id, token).catch(() => null),
        ]);
        if (!vivo) return;
        setComp(c);
        setEstado(o);
        if (!c && !o) setError(t(idioma, "ped.noDisponible"));
      } catch {
        if (vivo) setError(t(idioma, "ped.noDisponible"));
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => { vivo = false; };
  }, [id, token, idioma]);

  // QR generado en el navegador: el link de verificación lleva el token del
  // pedido y no tiene que viajar a un servicio de terceros.
  const verificacion = `${window.location.origin}${window.location.pathname}?token=${encodeURIComponent(token)}`;
  useEffect(() => {
    let vivo = true;
    import("qrcode")
      .then((QR) => QR.toDataURL(verificacion, { width: 140, margin: 1, errorCorrectionLevel: "M" }))
      .then((url) => vivo && setQr(url))
      .catch(() => vivo && setQr(""));
    return () => { vivo = false; };
  }, [verificacion]);

  if (cargando) {
    return (
      <div className="checkout centrado">
        <p className="badge badge-info" role="status">{t(idioma, "ped.cargando")}</p>
      </div>
    );
  }

  if (error || (!comp && !estado)) {
    return (
      <div className="checkout centrado">
        <div className="card anim-entrada checkout-exito">
          <p className="badge badge-peligro" role="alert">{error || t(idioma, "ped.noEncontrado")}</p>
          <Link to="/productos" className="btn-primary">{t(idioma, "ped.volver")}</Link>
        </div>
      </div>
    );
  }

  if (!comp) {
    return (
      <div className="checkout">
        <header className="seccion-head editorial">
          <div className="seccion-titular">
            <p className="kicker kicker-marca">
              <Marca variante="simbolo" ancho={20} alto={20} decorativa />
              <span>{t(idioma, "ped.tuCompra")}</span>
            </p>
            <h1>{t(idioma, "pago.pendiente")}</h1>
          </div>
          <span className="badge badge-info">#{String(id).slice(0, 8)}</span>
        </header>
        <div className="comprobante-grid">
          <section className="card checkout-panel">
            <p className="texto-mutado">
              {t(idioma, "pago.pedido")} <strong>#{String(id).slice(0, 8)}</strong>
              {" "}{t(idioma, "pago.por")}{" "}
              <strong>${Number(estado.total ?? 0).toLocaleString("es-AR")}</strong>.
            </p>
            <p className="badge badge-info">
              {t(idioma, "pago.estado")}: {estado.estado}
            </p>
            <p className="texto-mutado">{t(idioma, "pago.compPendienteAyuda")}</p>
          </section>
          <aside className="card checkout-resumen" aria-label={t(idioma, "ped.acciones")}>
            <h2>{t(idioma, "ped.acciones")}</h2>
            <ComprobantePago
              ordenId={id}
              token={token}
              estado={estado?.estado ?? ""}
              comprobanteInicial={estado?.comprobante_pago}
              montoCentavos={Math.round(Number(estado.total ?? 0) * 100)}
            />
            <Link to="/cuenta" className="btn-fantasma">{t(idioma, "pago.verPedidos")}</Link>
          </aside>
        </div>
      </div>
    );
  }

  const items = comp.items_snapshot ?? [];
  const tot = comp.totales_snapshot ?? {};

  return (
    <div className="checkout">
      <header className="seccion-head editorial">
        <div className="seccion-titular">
          <p className="kicker kicker-marca">
            <Marca variante="simbolo" ancho={20} alto={20} decorativa />
            <span>{t(idioma, "ped.comprobante")} {comp.numero}</span>
          </p>
          <h1>{t(idioma, "ped.tuCompra")}</h1>
        </div>
        <span className="badge badge-ok"><FaReceipt aria-hidden="true" /> {estado?.estado === "pagado" ? t(idioma, "ped.pagado") : estado?.estado ?? ""}</span>
      </header>

      <div className="comprobante-grid">
        <section className="card checkout-panel comprobante" aria-label={t(idioma, "ped.comprobante")}>
          <p className="badge badge-info">{comp.numero}</p>
          <dl className="comprobante-datos">
            <div><dt>{t(idioma, "ped.emitido")}</dt><dd>{new Date(comp.emitido_en).toLocaleString(idioma === "en" ? "en-US" : "es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</dd></div>
            <div><dt>{t(idioma, "ped.cliente")}</dt><dd>{comp.ordenes?.nombre} — {comp.ordenes?.email}</dd></div>
            <div><dt>{t(idioma, "ped.envio")}</dt><dd>{comp.ordenes?.direccion}, {comp.ordenes?.ciudad} · CP {comp.ordenes?.codigo_postal}</dd></div>
          </dl>
          <table className="comprobante-tabla">
            <thead>
              <tr><th scope="col">{t(idioma, "ped.item")}</th><th scope="col">{t(idioma, "ped.cant")}</th><th scope="col">{t(idioma, "ped.precio")}</th></tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td>{it.nombre}</td>
                  <td>{it.cantidad}</td>
                  <td>${Number(it.precio_unitario ?? 0).toLocaleString("es-AR")}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={2}>{t(idioma, "ped.subtotal")}</td><td>${Number(tot.subtotal ?? 0).toLocaleString("es-AR")}</td></tr>
              <tr><td colSpan={2}>{t(idioma, "ped.envio")}</td><td>${Number(tot.costo_envio ?? 0).toLocaleString("es-AR")}</td></tr>
              <tr><td colSpan={2}><strong>{t(idioma, "ped.total")}</strong></td><td><strong>${Number(tot.total ?? 0).toLocaleString("es-AR")}</strong></td></tr>
            </tfoot>
          </table>
          <p className="badge badge-aviso" role="note">{t(idioma, "ped.nota")}</p>
          <div className="comprobante-verif">
            {qr ? (
              <img src={qr} alt={t(idioma, "ped.qr")} width={140} height={140} />
            ) : (
              <span className="comprobante-qr-espacio" aria-hidden="true" />
            )}
            <p className="texto-mutado">{t(idioma, "ped.verifica")}<br /><a href={verificacion}>{verificacion}</a></p>
          </div>
        </section>

        <aside className="card checkout-resumen" aria-label={t(idioma, "ped.acciones")}>
          <h2>{t(idioma, "ped.acciones")}</h2>
          <a className="btn-primary" href={urlComprobantePdf(id, token)} download>
            <FaFileArrowDown aria-hidden="true" /> {t(idioma, "ped.descargar")}
          </a>
          <button type="button" className="btn-fantasma" onClick={() => window.print()}>
            <FaPrint aria-hidden="true" /> {t(idioma, "ped.imprimir")}
          </button>
          <Link to="/productos" className="btn-fantasma">{t(idioma, "ped.seguir")}</Link>
          <ComprobantePago
            ordenId={id}
            token={token}
            estado={estado?.estado ?? ""}
            comprobanteInicial={estado?.comprobante_pago}
            montoCentavos={Math.round(Number(tot.total ?? 0) * 100)}
          />
        </aside>
      </div>
    </div>
  );
}
