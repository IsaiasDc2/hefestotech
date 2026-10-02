import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaLock, FaTruckFast, FaCreditCard, FaCircleCheck } from "react-icons/fa6";
import useAuthStore from "../../store/authStore";
import { crearOrden } from "../../services/orderService";
import "./Checkout.css";
import "./Checkout.css";

const UMBRAL_ENVIO_GRATIS = 150000;
const COSTO_ENVIO_ESTANDAR = 5000;
const COSTO_ENVIO_EXPRESS = 12000;

const unitario = (item) =>
  Number(item.precio_con_descuento ?? item.precio ?? 0);

function Checkout({ carrito = [], vaciarCarrito }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authCargando = useAuthStore((s) => s.cargando);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [direccion, setDireccion] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [codigoPostal, setCodigoPostal] = useState("");
  const [envio, setEnvio] = useState("estandar");
  const [pago, setPago] = useState("tarjeta");
  const [tarjeta, setTarjeta] = useState("");
  const [vencimiento, setVencimiento] = useState("");
  const [cvv, setCvv] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [orden, setOrden] = useState(null);

  const subtotal = useMemo(
    () =>
      carrito.reduce(
        (acc, item) =>
          acc + unitario(item) * Number(item.cantidad ?? 1),
        0
      ),
    [carrito]
  );

  const costoEnvio = useMemo(() => {
    if (carrito.length === 0) return 0;
    if (subtotal >= UMBRAL_ENVIO_GRATIS) return 0;
    return envio === "express" ? COSTO_ENVIO_EXPRESS : COSTO_ENVIO_ESTANDAR;
  }, [envio, subtotal, carrito.length]);

  const total = subtotal + costoEnvio;

  const confirmar = async (e) => {
    e.preventDefault();
    setError("");
    if (carrito.length === 0) return;
    if (pago === "tarjeta" && (tarjeta.trim().length < 12 || !vencimiento || !cvv)) {
      setError("Revisá los datos simulados de la tarjeta.");
      return;
    }
    setEnviando(true);
    try {
      const creada = await crearOrden({
        nombre: nombre.trim(),
        email: email.trim(),
        direccion: direccion.trim(),
        ciudad: ciudad.trim(),
        codigo_postal: codigoPostal.trim(),
        envio,
        pago_mock: pago,
        tarjeta_ultimos4: pago === "tarjeta" ? tarjeta.replace(/\D/g, "").slice(-4) : null,
        subtotal,
        costo_envio: costoEnvio,
        total,
        estado: "pendiente",
        items: carrito.map((item) => ({
          producto_id: item.producto_id ?? item.id,
          cantidad: Number(item.cantidad ?? 1),
          precio: unitario(item),
        })),
      });
      setOrden(creada);
      vaciarCarrito?.();
    } catch (err) {
      const msg = err?.message || "No se pudo crear la orden.";
      setError(
        /ordenes|orden_items|relation|migration|002/i.test(msg)
          ? `${msg} — Aplicá supabase/migrations/002_ordenes.sql en Supabase Dashboard → SQL Editor.`
          : msg
      );
    } finally {
      setEnviando(false);
    }
  };

  if (orden) {
    return (
      <div className="checkout centrado">
        <div className="card anim-entrada checkout-exito">
          <p className="badge badge-ok hero-kicker">
            <FaCircleCheck aria-hidden="true" /> Pedido confirmado
          </p>
          <h1>¡Gracias{nombre ? `, ${nombre.split(" ")[0]}` : ""}!</h1>
          <p className="texto-mutado">
            Tu orden se registró con el id{" "}
            <strong>{orden.id?.slice?.(0, 8) || "registrado"}</strong> por{" "}
            <strong>${Number(orden.total ?? total).toLocaleString("es-AR")}</strong>.
            El pago fue simulado, no se cobró nada.
          </p>
          <div className="checkout-acciones">
            <Link to="/productos" className="btn-fantasma">Seguir comprando</Link>
            <Link to="/cuenta" className="btn-primary">Ver mis pedidos</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!authCargando && !isAuthenticated) {
    return (
      <div className="checkout centrado">
        <div className="card anim-entrada checkout-bloqueo">
          <p className="badge badge-aviso hero-kicker">
            <FaLock aria-hidden="true" /> Iniciar sesión
          </p>
          <h1>Checkout</h1>
          <p className="texto-mutado">
            Necesitás una cuenta para confirmar la compra. Tu carrito queda
            guardado en este dispositivo.
          </p>
          <Link to="/cuenta" className="btn-primary">Ir a mi cuenta</Link>
        </div>
      </div>
    );
  }

  if (carrito.length === 0) {
    return (
      <div className="checkout centrado">
        <div className="vacio anim-entrada">
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
          <p className="kicker"><span className="kicker-num">Pago simulado</span> Checkout</p>
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
            </div>

            <div className="checkout-opciones" role="radiogroup" aria-label="Método de envío">
              <label className={envio === "estandar" ? "activo" : ""}>
                <input type="radio" name="envio" value="estandar" checked={envio === "estandar"} onChange={() => setEnvio("estandar")} />
                <FaTruckFast aria-hidden="true" /> Estándar — {subtotal >= UMBRAL_ENVIO_GRATIS ? "gratis" : `$${COSTO_ENVIO_ESTANDAR.toLocaleString("es-AR")}`}
              </label>
              <label className={envio === "express" ? "activo" : ""}>
                <input type="radio" name="envio" value="express" checked={envio === "express"} onChange={() => setEnvio("express")} />
                <FaTruckFast aria-hidden="true" /> Express — {subtotal >= UMBRAL_ENVIO_GRATIS ? "gratis" : `$${COSTO_ENVIO_EXPRESS.toLocaleString("es-AR")}`}
              </label>
            </div>
          </section>

          <section className="card checkout-panel" aria-label="Pago simulado">
            <h2><FaCreditCard aria-hidden="true" /> Pago (simulado)</h2>
            <p className="texto-mutado checkout-nota">Demostración: no ingreses datos reales, nada se cobra.</p>
            <div className="checkout-opciones" role="radiogroup" aria-label="Método de pago">
              {["tarjeta", "transferencia", "efectivo"].map((m) => (
                <label key={m} className={pago === m ? "activo" : ""}>
                  <input type="radio" name="pago" value={m} checked={pago === m} onChange={() => setPago(m)} />
                  {m === "tarjeta" ? "Tarjeta" : m === "transferencia" ? "Transferencia" : "Efectivo al retirar"}
                </label>
              ))}
            </div>
            {pago === "tarjeta" && (
              <div className="checkout-campos">
                <label>Número (simulado)
                  <input value={tarjeta} onChange={(e) => setTarjeta(e.target.value)} inputMode="numeric" placeholder="4242 4242 4242 4242" required />
                </label>
                <div className="checkout-fila">
                  <label>Vencimiento
                    <input value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} placeholder="MM/AA" required />
                  </label>
                  <label>CVV
                    <input value={cvv} onChange={(e) => setCvv(e.target.value)} inputMode="numeric" placeholder="123" required />
                  </label>
                </div>
              </div>
            )}
          </section>
        </div>

        <aside className="card checkout-resumen" aria-label="Resumen del pedido">
          <h2>Resumen</h2>
          <ul className="checkout-items">
            {carrito.map((item) => (
              <li key={item.id}>
                <span>{item.nombre} × {item.cantidad}</span>
                <strong>${(unitario(item) * Number(item.cantidad ?? 1)).toLocaleString("es-AR")}</strong>
              </li>
            ))}
          </ul>
          <dl className="checkout-totales">
            <div><dt>Subtotal</dt><dd>${subtotal.toLocaleString("es-AR")}</dd></div>
            <div><dt>Envío</dt><dd>{costoEnvio === 0 ? "Gratis" : `$${costoEnvio.toLocaleString("es-AR")}`}</dd></div>
            <div className="total"><dt>Total</dt><dd>${total.toLocaleString("es-AR")}</dd></div>
          </dl>
          {error && <p className="badge badge-peligro checkout-error" role="alert">{error}</p>}
          <button type="submit" className="btn-primary" disabled={enviando}>
            {enviando ? "Confirmando..." : `Confirmar pedido · $${total.toLocaleString("es-AR")}`}
          </button>
          <Link to="/carrito" className="btn-fantasma">Volver al carrito</Link>
        </aside>
      </form>
    </div>
  );
}

export default Checkout;
