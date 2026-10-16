import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FaLock, FaTruckFast, FaCircleCheck, FaTriangleExclamation } from "react-icons/fa6";
import Marca from "../../components/brand/Marca";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import { crearCheckout, obtenerEstadoCheckout } from "../../services/orderService";
import logoMP from "../../assets/mercadopago.svg";
import "./Checkout.css";

// Estimación SOLO para mostrar en pantalla. El total que se cobra lo
// calcula el servidor (POST /api/checkout/crear) desde precios/stock de
// la DB: el front envía únicamente producto_id + cantidad.
const UMBRAL_ENVIO_GRATIS = 150000;
const COSTO_ENVIO_ESTANDAR = 5000;
const COSTO_ENVIO_EXPRESS = 12000;

const unitarioEstimado = (item) =>
  Number(item.precio_con_descuento ?? item.precio ?? 0);

const pesos = (v) => `$${Number(v ?? 0).toLocaleString("es-AR")}`;

// Anti redirección abierta: solo dominios oficiales de Mercado Pago.
// Si el backend (o un MITM sin TLS) devuelve otra URL, no navegar.
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

function Checkout({ carrito = [], vaciarCarrito }) {
  const idioma = useIdiomaStore((s) => s.idioma);
  // Clave de idempotencia: una por intento de compra en esta pantalla. Si la
  // red reintenta el envío, el servidor reutiliza la orden (no duplica).
  const idemRef = useRef(null);
  if (!idemRef.current) {
    idemRef.current =
      globalThis.crypto?.randomUUID?.() ??
      `ck-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }
  const enviandoRef = useRef(false);
  const ESTADO_TXT = {
    pendiente: t(idioma, "chk.pendiente"),
    pagada: t(idioma, "chk.pagada"),
    preparacion: t(idioma, "chk.preparacion"),
    enviada: t(idioma, "chk.enviada"),
    entregada: t(idioma, "chk.entregada"),
    cancelada: t(idioma, "chk.cancelada"),
    reembolsada: t(idioma, "chk.reembolsada"),
  };
  const [params] = useSearchParams();
  const ordenIdUrl = params.get("orden_id") || "";
  const pagoUrl = params.get("pago") || "";

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [direccion, setDireccion] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [codigoPostal, setCodigoPostal] = useState("");
  const [envio, setEnvio] = useState("estandar");
  const [cupon, setCupon] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [consultando, setConsultando] = useState(false);
  const [pasoPago, setPasoPago] = useState("");
  const [error, setError] = useState("");
  const [orden, setOrden] = useState(null);

  // Al volver de Mercado Pago (?orden_id=...) se lee el estado REAL desde
  // el servidor. Nada se da por pagado por el hecho de volver.
  useEffect(() => {
    if (!ordenIdUrl) return;
    let viva = true;
    setConsultando(true);
    setError("");
    const acceso = sessionStorage.getItem(`ck_token_${ordenIdUrl}`) || "";
    obtenerEstadoCheckout(ordenIdUrl, acceso)
      .then((r) => {
        if (viva) setOrden(r);
      })
      .catch((err) => {
        if (viva) setError(err?.message || t(idioma, "chk.noEstado"));
      })
      .finally(() => {
        if (viva) setConsultando(false);
      });
    return () => {
      viva = false;
    };
  }, [ordenIdUrl, idioma]);

  const subtotalEst = useMemo(
    () =>
      carrito.reduce(
        (acc, item) =>
          acc + unitarioEstimado(item) * Number(item.cantidad ?? 1),
        0
      ),
    [carrito]
  );

  const costoEnvioEst = useMemo(() => {
    if (carrito.length === 0) return 0;
    if (subtotalEst >= UMBRAL_ENVIO_GRATIS) return 0;
    return envio === "express" ? COSTO_ENVIO_EXPRESS : COSTO_ENVIO_ESTANDAR;
  }, [envio, subtotalEst, carrito.length]);

  const totalEst = subtotalEst + costoEnvioEst;

  const confirmar = async (e) => {
    e.preventDefault();
    setError("");
    if (carrito.length === 0 || enviando || enviandoRef.current) return;
    enviandoRef.current = true;
    setEnviando(true);
    try {
      setPasoPago(t(idioma, "chk.creando"));
      const resp = await crearCheckout({
        items: carrito.map((item) => ({
          producto_id: item.producto_id ?? item.id,
          cantidad: Number(item.cantidad ?? 1),
        })),
        nombre: nombre.trim(),
        email: email.trim(),
        direccion: direccion.trim(),
        ciudad: ciudad.trim(),
        codigo_postal: codigoPostal.trim(),
        envio,
        idem: idemRef.current,
        ...(cupon.trim() ? { cupon_codigo: cupon.trim() } : {}),
      });
      if (resp.acceso_token) {
        sessionStorage.setItem(`ck_token_${resp.orden_id}`, resp.acceso_token);
      }
      if (!esUrlMP(resp.init_point)) {
        throw new Error(t(idioma, "chk.respInvalida"));
      }
      // Respaldo por si vuelve de MP con fallo/cancelación: permite restaurar.
      try {
        sessionStorage.setItem("ck_carrito_respaldo", JSON.stringify(carrito));
      } catch {
        /* respaldo opcional */
      }
      vaciarCarrito?.();
      window.location.href = resp.init_point;
    } catch (err) {
      setError(err?.message || t(idioma, "chk.noOrden"));
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
      setPasoPago("");
    }
  };

  if (ordenIdUrl || orden) {
    const estado = orden?.estado || "";
    const acreditada = estado === "pagada";
    return (
      <div className="checkout centrado">
        <div className="card anim-entrada checkout-exito">
          <span className="marca-centrada" aria-hidden="true">
            <Marca variante="simbolo" ancho={44} alto={44} decorativa />
          </span>
          {consultando && (
            <p className="badge badge-info" role="status">{t(idioma, "chk.consultando")}</p>
          )}
          {!consultando && orden && (
            <>
              <p className={`badge ${acreditada ? "badge-ok" : estado === "cancelada" ? "badge-peligro" : "badge-info"} hero-kicker`}>
                {acreditada && <FaCircleCheck aria-hidden="true" />}
                {!acreditada && pagoUrl === "fallo" && <FaTriangleExclamation aria-hidden="true" />}
                {" "}{ESTADO_TXT[estado] || estado}
              </p>
              <h1>{acreditada ? `${t(idioma, "chk.gracias")}${nombre ? `, ${nombre.split(" ")[0]}` : ""}!` : t(idioma, "chk.tuOrden")}</h1>
              <p className="texto-mutado">
                {t(idioma, "chk.orden")} <strong>{String(orden.orden_id || "").slice(0, 8)}</strong> {t(idioma, "chk.por")}{" "}
                <strong>{pesos(Number(orden.total_centavos ?? 0) / 100)}</strong>.
                {acreditada
                  ? ` ${t(idioma, "chk.pagoConfirmado")}`
                  : estado === "pendiente"
                    ? ` ${t(idioma, "chk.pagoPendiente")}`
                    : ` ${t(idioma, "chk.pagoNo")}`}
              </p>
            </>
          )}
          {!consultando && !orden && (
            <>
              {error && <p className="badge badge-peligro checkout-error" role="alert">{error}</p>}
              <p className="texto-mutado">{t(idioma, "chk.noEncontrada")}</p>
            </>
          )}
          <div className="checkout-acciones">
            <Link to="/productos" className="btn-fantasma">{t(idioma, "chk.seguir")}</Link>
            <Link to="/cuenta" className="btn-primary">{t(idioma, "chk.verPedidos")}</Link>
          </div>
        </div>
      </div>
    );
  }

  if (carrito.length === 0) {
    return (
      <div className="checkout centrado">
        <div className="vacio anim-entrada">
          <span className="marca-centrada" aria-hidden="true">
            <Marca variante="simbolo" ancho={44} alto={44} decorativa />
          </span>
          <p className="vacio-titulo">{t(idioma, "chk.vacioT")}</p>
          <p className="vacio-texto">{t(idioma, "chk.vacioS")}</p>
          <Link to="/productos" className="btn-primary">{t(idioma, "chk.verProd")}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout">
      <header className="seccion-head editorial">
        <div className="seccion-titular">
          <p className="kicker kicker-marca">
            <Marca variante="simbolo" ancho={20} alto={20} decorativa />
            <span><span className="kicker-num">{t(idioma, "chk.pagoSeguro")}</span> {t(idioma, "chk.checkout")}</span>
          </p>
          <h1>{t(idioma, "chk.finalizar")}</h1>
        </div>
        <span className="badge badge-info"><FaLock aria-hidden="true" /> {t(idioma, "chk.compraProt")}</span>
      </header>

      <form className="checkout-grid" onSubmit={confirmar}>
        <div className="checkout-col">
          <section className="card checkout-panel" aria-label={t(idioma, "chk.datosEnvio")}>
            <h2>{t(idioma, "chk.datosEnvio")}</h2>
            <div className="checkout-campos">
              <label>{t(idioma, "chk.nombre")}
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} required autoComplete="name" />
              </label>
              <label>{t(idioma, "chk.email")}
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </label>
              <label>{t(idioma, "chk.direccion")}
                <input value={direccion} onChange={(e) => setDireccion(e.target.value)} required autoComplete="street-address" />
              </label>
              <div className="checkout-fila">
                <label>{t(idioma, "chk.ciudad")}
                  <input value={ciudad} onChange={(e) => setCiudad(e.target.value)} required />
                </label>
                <label>{t(idioma, "chk.cp")}
                  <input value={codigoPostal} onChange={(e) => setCodigoPostal(e.target.value)} required inputMode="numeric" />
                </label>
              </div>
              <label>{t(idioma, "chk.cupon")}
                <input value={cupon} onChange={(e) => setCupon(e.target.value)} placeholder={t(idioma, "chk.cuponPh")} autoComplete="off" />
              </label>
            </div>

            <div className="checkout-opciones" role="radiogroup" aria-label={t(idioma, "chk.metodoEnvio")}>
              <label className={envio === "estandar" ? "activo" : ""}>
                <input type="radio" name="envio" value="estandar" checked={envio === "estandar"} onChange={() => setEnvio("estandar")} />
                <FaTruckFast aria-hidden="true" /> {t(idioma, "chk.estandar")} — {subtotalEst >= UMBRAL_ENVIO_GRATIS ? t(idioma, "chk.gratis") : pesos(COSTO_ENVIO_ESTANDAR)}
              </label>
              <label className={envio === "express" ? "activo" : ""}>
                <input type="radio" name="envio" value="express" checked={envio === "express"} onChange={() => setEnvio("express")} />
                <FaTruckFast aria-hidden="true" /> {t(idioma, "chk.express")} — {subtotalEst >= UMBRAL_ENVIO_GRATIS ? t(idioma, "chk.gratis") : pesos(COSTO_ENVIO_EXPRESS)}
              </label>
            </div>
          </section>

          <section className="card checkout-panel" aria-label={`${t(idioma, "chk.pago")} ${t(idioma, "chk.mpTitulo")}`}>
            <h2><img src={logoMP} alt="" aria-hidden="true" className="pago-logo" /> {t(idioma, "chk.mpTitulo")}</h2>
            <div className="pago-mp-panel">
              <img src={logoMP} alt="Mercado Pago" className="pago-logo-lg" />
              <p className="texto-mutado">{t(idioma, "chk.mpTexto")}</p>
            </div>
          </section>
        </div>

        <aside className="card checkout-resumen" aria-label={t(idioma, "chk.resumen")}>
          <h2>{t(idioma, "chk.resumen")}</h2>
          <ul className="checkout-items">
            {carrito.map((item) => (
              <li key={item.id}>
                <span>{item.nombre} × {item.cantidad}</span>
                <strong>{pesos(unitarioEstimado(item) * Number(item.cantidad ?? 1))}</strong>
              </li>
            ))}
          </ul>
          <dl className="checkout-totales">
            <div><dt>{t(idioma, "chk.subtotal")}</dt><dd>{pesos(subtotalEst)}</dd></div>
            <div><dt>{t(idioma, "chk.envio")}</dt><dd>{costoEnvioEst === 0 ? t(idioma, "chk.gratis") : pesos(costoEnvioEst)}</dd></div>
            <div className="total"><dt>{t(idioma, "chk.total")}</dt><dd>{pesos(totalEst)}</dd></div>
          </dl>
          <p className="texto-mutado checkout-nota">{t(idioma, "chk.nota")}</p>
          {error && <p className="badge badge-peligro checkout-error" role="alert">{error}</p>}
          {enviando && pasoPago && <p className="badge badge-info" role="status">{pasoPago}</p>}
          <button type="submit" className="btn-primary" disabled={enviando}>
            {enviando ? t(idioma, "chk.creandoOrden") : `${t(idioma, "chk.pagar")} ${pesos(totalEst)} ${t(idioma, "chk.con")} Mercado Pago`}
          </button>
          <Link to="/carrito" className="btn-fantasma">{t(idioma, "chk.volver")}</Link>
        </aside>
      </form>
    </div>
  );
}

export default Checkout;
