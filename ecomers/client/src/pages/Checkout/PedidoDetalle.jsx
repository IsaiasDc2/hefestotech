import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { FaFileArrowDown, FaPrint, FaReceipt } from "react-icons/fa6";
import Marca from "../../components/brand/Marca";
import { obtenerComprobante, obtenerEstadoPedido, urlComprobantePdf } from "../../services/orderService";
import "./Checkout.css";
import "./PedidoDetalle.css";

/** /pedido/:id — comprobante con snapshot, QR/enlace de verificación, PDF e impresión. */
export default function PedidoDetalle() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [comp, setComp] = useState(null);
  const [estado, setEstado] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [c, o] = await Promise.all([
          obtenerComprobante(id, token),
          obtenerEstadoPedido(id, token).catch(() => null),
        ]);
        if (!vivo) return;
        setComp(c);
        setEstado(o);
      } catch {
        if (vivo) setError("Comprobante no disponible. Revisá el enlace de verificación.");
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => { vivo = false; };
  }, [id, token]);

  if (cargando) {
    return (
      <div className="checkout centrado">
        <p className="badge badge-info" role="status">Cargando comprobante…</p>
      </div>
    );
  }

  if (error || !comp) {
    return (
      <div className="checkout centrado">
        <div className="card anim-entrada checkout-exito">
          <p className="badge badge-peligro" role="alert">{error || "No encontrado."}</p>
          <Link to="/productos" className="btn-primary">Volver a la tienda</Link>
        </div>
      </div>
    );
  }

  const items = comp.items_snapshot ?? [];
  const tot = comp.totales_snapshot ?? {};
  const verificacion = `${window.location.origin}${window.location.pathname}?token=${token}`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(verificacion)}`;

  return (
    <div className="checkout">
      <header className="seccion-head editorial">
        <div className="seccion-titular">
          <p className="kicker kicker-marca">
            <Marca variante="simbolo" ancho={20} alto={20} decorativa />
            <span>Comprobante {comp.numero}</span>
          </p>
          <h1>Tu compra</h1>
        </div>
        <span className="badge badge-ok"><FaReceipt aria-hidden="true" /> {estado?.estado === "pagado" ? "Pagado" : estado?.estado ?? ""}</span>
      </header>

      <div className="comprobante-grid">
        <section className="card checkout-panel comprobante" aria-label="Comprobante de compra">
          <p className="badge badge-info">{comp.numero}</p>
          <dl className="comprobante-datos">
            <div><dt>Emitido</dt><dd>{new Date(comp.emitido_en).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</dd></div>
            <div><dt>Cliente</dt><dd>{comp.ordenes?.nombre} — {comp.ordenes?.email}</dd></div>
            <div><dt>Envío</dt><dd>{comp.ordenes?.direccion}, {comp.ordenes?.ciudad} ({comp.ordenes?.provincia}) CP {comp.ordenes?.codigo_postal}</dd></div>
          </dl>
          <table className="comprobante-tabla">
            <thead>
              <tr><th scope="col">Ítem</th><th scope="col">Cant.</th><th scope="col">Precio</th></tr>
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
              <tr><td colSpan={2}>Subtotal</td><td>${Number(tot.subtotal ?? 0).toLocaleString("es-AR")}</td></tr>
              <tr><td colSpan={2}>Envío</td><td>${Number(tot.costo_envio ?? 0).toLocaleString("es-AR")}</td></tr>
              <tr><td colSpan={2}><strong>Total</strong></td><td><strong>${Number(tot.total ?? 0).toLocaleString("es-AR")}</strong></td></tr>
            </tfoot>
          </table>
          <p className="badge badge-aviso" role="note">Comprobante de compra – no válido como factura</p>
          <div className="comprobante-verif">
            <img src={qr} alt="QR de verificación del comprobante" width={140} height={140} loading="lazy" />
            <p className="texto-mutado">Verificá este comprobante en:<br /><Link to={verificacion}>{verificacion}</Link></p>
          </div>
        </section>

        <aside className="card checkout-resumen" aria-label="Acciones del comprobante">
          <h2>Acciones</h2>
          <a className="btn-primary" href={urlComprobantePdf(id, token)} download>
            <FaFileArrowDown aria-hidden="true" /> Descargar PDF
          </a>
          <button type="button" className="btn-fantasma" onClick={() => window.print()}>
            <FaPrint aria-hidden="true" /> Imprimir
          </button>
          <Link to="/productos" className="btn-fantasma">Seguir comprando</Link>
        </aside>
      </div>
    </div>
  );
}
