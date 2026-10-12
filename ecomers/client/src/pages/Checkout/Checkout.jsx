import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FaLock, FaTruckFast, FaCircleCheck, FaTriangleExclamation } from "react-icons/fa6";
import Marca from "../../components/brand/Marca";
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

const ESTADO_TEXTO = {
  pendiente: "Pago pendiente de acreditación",
  pagada: "Pago acreditado",
  preparacion: "En preparación",
  enviada: "Enviada",
  entregada: "Entregada",
  cancelada: "Cancelada",
  reembolsada: "Reembolsada",
};

function Checkout({ carrito = [], vaciarCarrito }) {
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
        if (viva) setError(err?.message || "No se pudo consultar el estado del pago.");
      })
      .finally(() => {
        if (viva) setConsultando(false);
      });
    return () => {
      viva = false;
    };
  }, [ordenIdUrl]);

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
    if (carrito.length === 0 || enviando) return;
    setEnviando(true);
    try {
      setPasoPago("Creando tu orden en el servidor…");
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
        ...(cupon.trim() ? { cupon_codigo: cupon.trim() } : {}),
      });
      if (resp.acceso_token) {
        sessionStorage.setItem(`ck_token_${resp.orden_id}`, resp.acceso_token);
      }
      if (!esUrlMP(resp.init_point)) {
        throw new Error("Respuesta de pago inválida. No se continúa por seguridad.");
      }
      vaciarCarrito?.();
      window.location.href = resp.init_point;
    } catch (err) {
      setError(err?.message || "No se pudo crear la orden.");
    } finally {
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
            <p className="badge badge-info" role="status">Consultando el estado de tu pago…</p>
          )}
          {!consultando && orden && (
            <>
              <p className={`badge ${acreditada ? "badge-ok" : estado === "cancelada" ? "badge-peligro" : "badge-info"} hero-kicker`}>
                {acreditada && <FaCircleCheck aria-hidden="true" />}
                {!acreditada && pagoUrl === "fallo" && <FaTriangleExclamation aria-hidden="true" />}
                {" "}{ESTADO_TEXTO[estado] || estado}
              </p>
              <h1>{acreditada ? `¡Gracias${nombre ? `, ${nombre.split(" ")[0]}` : ""}!` : "Tu orden"}</h1>
              <p className="texto-mutado">
                Orden <strong>{String(orden.orden_id || "").slice(0, 8)}</strong> por{" "}
                <strong>{pesos(Number(orden.total_centavos ?? 0) / 100)}</strong>.
                {acreditada
                  ? " El pago fue confirmado por Mercado Pago."
                  : estado === "pendiente"
                    ? " Todavía no se acreditó el pago. Si ya pagaste, aguardá unos instantes y recargá esta página."
                    : " No se completó el pago. Podés reintentar desde el carrito."}
              </p>
            </>
          )}
          {!consultando && !orden && (
            <>
              {error && <p className="badge badge-peligro checkout-error" role="alert">{error}</p>}
              <p className="texto-mutado">No pudimos encontrar esa orden.</p>
            </>
          )}
          <div className="checkout-acciones">
            <Link to="/productos" className="btn-fantasma">Seguir comprando</Link>
            <Link to="/cuenta" className="btn-primary">Ver mis pedidos</Link>
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
          <p className="vacio-titulo">Tu carrito está vacío</p>
          <p className="vacio-texto">Sumá productos antes de finalizar la compra.</p>
          <Link to="/productos" className="btn-primary">Ver productos</Link>
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
            <span><span className="kicker-num">Pago seguro</span> Checkout</span>
          </p>
          <h1>Finalizar compra</h1>
        </div>
        <span className="badge badge-info"><FaLock aria-hidden="true" /> Compra protegida</span>
      </header>

      <form className="checkout-grid" onSubmit={confirmar}>
        <div className="checkout-col">
          <section className="card checkout-panel" aria-label="Datos de contacto y envío">
            <h2>Datos y envío</h2>
            <div className="checkout-campos">
              <label>Nombre completo
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} required autoComplete="name" />
              </label>
              <label>Email
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </label>
              <label>Dirección
                <input value={direccion} onChange={(e) => setDireccion(e.target.value)} required autoComplete="street-address" />
              </label>
              <div className="checkout-fila">
                <label>Ciudad
                  <input value={ciudad} onChange={(e) => setCiudad(e.target.value)} required />
                </label>
                <label>Código postal
                  <input value={codigoPostal} onChange={(e) => setCodigoPostal(e.target.value)} required inputMode="numeric" />
                </label>
              </div>
              <label>Cupón (opcional)
                <input value={cupon} onChange={(e) => setCupon(e.target.value)} placeholder="Ej. HEROES10" autoComplete="off" />
              </label>
            </div>

            <div className="checkout-opciones" role="radiogroup" aria-label="Método de envío">
              <label className={envio === "estandar" ? "activo" : ""}>
                <input type="radio" name="envio" value="estandar" checked={envio === "estandar"} onChange={() => setEnvio("estandar")} />
                <FaTruckFast aria-hidden="true" /> Estándar — {subtotalEst >= UMBRAL_ENVIO_GRATIS ? "gratis" : pesos(COSTO_ENVIO_ESTANDAR)}
              </label>
              <label className={envio === "express" ? "activo" : ""}>
                <input type="radio" name="envio" value="express" checked={envio === "express"} onChange={() => setEnvio("express")} />
                <FaTruckFast aria-hidden="true" /> Express — {subtotalEst >= UMBRAL_ENVIO_GRATIS ? "gratis" : pesos(COSTO_ENVIO_EXPRESS)}
              </label>
            </div>
          </section>

          <section className="card checkout-panel" aria-label="Pago con Mercado Pago">
            <h2><img src={logoMP} alt="" aria-hidden="true" className="pago-logo" /> Mercado Pago</h2>
            <div className="pago-mp-panel">
              <img src={logoMP} alt="Mercado Pago" className="pago-logo-lg" />
              <p className="texto-mutado">Al confirmar creamos tu orden en el servidor y te redirigimos a Mercado Pago para completar el pago de forma segura con tarjeta, débito o dinero en cuenta.</p>
            </div>
          </section>
        </div>

        <aside className="card checkout-resumen" aria-label="Resumen del pedido">
          <h2>Resumen</h2>
          <ul className="checkout-items">
            {carrito.map((item) => (
              <li key={item.id}>
                <span>{item.nombre} × {item.cantidad}</span>
                <strong>{pesos(unitarioEstimado(item) * Number(item.cantidad ?? 1))}</strong>
              </li>
            ))}
          </ul>
          <dl className="checkout-totales">
            <div><dt>Subtotal (estimado)</dt><dd>{pesos(subtotalEst)}</dd></div>
            <div><dt>Envío (estimado)</dt><dd>{costoEnvioEst === 0 ? "Gratis" : pesos(costoEnvioEst)}</dd></div>
            <div className="total"><dt>Total (estimado)</dt><dd>{pesos(totalEst)}</dd></div>
          </dl>
          <p className="texto-mutado checkout-nota">El total final lo calcula el servidor al confirmar.</p>
          {error && <p className="badge badge-peligro checkout-error" role="alert">{error}</p>}
          {enviando && pasoPago && <p className="badge badge-info" role="status">{pasoPago}</p>}
          <button type="submit" className="btn-primary" disabled={enviando}>
            {enviando ? "Creando orden…" : `Pagar ${pesos(totalEst)} con Mercado Pago`}
          </button>
          <Link to="/carrito" className="btn-fantasma">Volver al carrito</Link>
        </aside>
      </form>
    </div>
  );
}

export default Checkout;
