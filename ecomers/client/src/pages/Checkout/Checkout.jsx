import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaLock, FaTruckFast, FaCreditCard, FaCircleCheck, FaTriangleExclamation } from "react-icons/fa6";
import {
  soloDigitos,
  formatearTarjeta,
  formatearVenc,
  detectarMarca,
  pasaLuhn,
  vencimientoValido,
} from "../../utils/pago";
import useAuthStore from "../../store/authStore";
import { crearOrden } from "../../services/orderService";
import "./Checkout.css";

const UMBRAL_ENVIO_GRATIS = 150000;
const COSTO_ENVIO_ESTANDAR = 5000;
const COSTO_ENVIO_EXPRESS = 12000;

const unitario = (item) =>
  Number(item.precio_con_descuento ?? item.precio ?? 0);

const CUOTAS = [
  { id: 1, label: "1 pago sin interés" },
  { id: 3, label: "3 cuotas sin interés" },
  { id: 6, label: "6 cuotas sin interés" },
];

function Checkout({ carrito = [], vaciarCarrito }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [direccion, setDireccion] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [codigoPostal, setCodigoPostal] = useState("");
  const [envio, setEnvio] = useState("estandar");
  const [pago, setPago] = useState("tarjeta");
  const [titular, setTitular] = useState("");
  const [tarjeta, setTarjeta] = useState("");
  const [vencimiento, setVencimiento] = useState("");
  const [cvv, setCvv] = useState("");
  const [cuotas, setCuotas] = useState(6);
  const [enviando, setEnviando] = useState(false);
  const [pasoPago, setPasoPago] = useState("");
  const [error, setError] = useState("");
  const [orden, setOrden] = useState(null);
  const [pagoInfo, setPagoInfo] = useState(null);

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
  const valorCuota = cuotas > 0 ? total / cuotas : total;
  const marca = detectarMarca(tarjeta);
  const ultimos4 = soloDigitos(tarjeta).slice(-4);

  const validarTarjeta = () => {
    if (titular.trim().length < 3) return "Ingresá el nombre del titular.";
    if (!pasaLuhn(tarjeta)) return "Número de tarjeta inválido (probá 4242 4242 4242 4242).";
    if (!vencimientoValido(vencimiento)) return "Vencimiento inválido o vencido (MM/AA).";
    if (!/^\d{3,4}$/.test(soloDigitos(cvv))) return "CVV inválido (3 o 4 dígitos).";
    return "";
  };

  const procesarPagoSimulado = async () => {
    const pasos = ["Validando datos…", "Contactando banco simulado…", "Autorizando…"];
    for (const p of pasos) {
      setPasoPago(p);
      await new Promise((r) => setTimeout(r, 650));
    }
    const num = soloDigitos(tarjeta);
    if (num.endsWith("0002") || num === "4000000000000002") {
      throw new Error("Pago rechazado por el banco simulado (fondos insuficientes). Probá con 4242 4242 4242 4242.");
    }
    return {
      autorizado: true,
      codigo: `SIM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      marca,
      ultimos4,
      cuotas,
    };
  };

  const confirmar = async (e) => {
    e.preventDefault();
    setError("");
    if (carrito.length === 0) return;
    if (pago === "tarjeta") {
      const msg = validarTarjeta();
      if (msg) {
        setError(msg);
        return;
      }
    }
    setEnviando(true);
    try {
      let info = null;
      if (pago === "tarjeta") {
        info = await procesarPagoSimulado();
        setPagoInfo(info);
      }
      const datos = {
        nombre: nombre.trim(),
        email: email.trim(),
        direccion: direccion.trim(),
        ciudad: ciudad.trim(),
        codigo_postal: codigoPostal.trim(),
        envio,
        pago_mock: pago,
        tarjeta_ultimos4: pago === "tarjeta" ? ultimos4 : null,
        subtotal,
        costo_envio: costoEnvio,
        total,
        estado: pago === "tarjeta" ? "pagado_simulado" : "pendiente",
        items: carrito.map((item) => ({
          producto_id: item.producto_id ?? item.id,
          cantidad: Number(item.cantidad ?? 1),
          precio: unitario(item),
        })),
      };
      if (isAuthenticated) {
        try {
          const creada = await crearOrden(datos);
          setOrden({ ...creada, _pago: info });
        } catch (err) {
          setOrden({
            id: `demo-${Date.now().toString(36)}`,
            total,
            _local: true,
            _detalle: err?.message || "",
            _pago: info,
          });
        }
      } else {
        setOrden({
          id: `invitado-${Date.now().toString(36)}`,
          total,
          _local: true,
          _invitado: true,
          _pago: info,
        });
      }
      vaciarCarrito?.();
    } catch (err) {
      setError(err?.message || "No se pudo procesar el pago simulado.");
    } finally {
      setEnviando(false);
      setPasoPago("");
    }
  };

  if (orden) {
    const p = orden._pago || pagoInfo;
    return (
      <div className="checkout centrado">
        <div className="card anim-entrada checkout-exito">
          <p className="badge badge-ok hero-kicker">
            <FaCircleCheck aria-hidden="true" /> Pago simulado aprobado
          </p>
          <h1>¡Gracias{nombre ? `, ${nombre.split(" ")[0]}` : ""}!</h1>
          <p className="texto-mutado">
            Orden <strong>{String(orden.id || "").slice(0, 8)}</strong> por{" "}
            <strong>${Number(orden.total ?? total).toLocaleString("es-AR")}</strong>.
            {p ? (
              <> Pagaste con {p.marca} terminada en <strong>•••• {p.ultimos4}</strong> en {p.cuotas} cuota(s) de <strong>${valorCuota.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</strong>. Código <strong>{p.codigo}</strong>.</>
            ) : (
              <> Método elegido: <strong>{pago}</strong>.</>
            )}{" "}
            Nada se cobró, es demostración.
          </p>
          {orden._local && !orden._invitado && (
            <p className="badge badge-aviso" role="note">
              <FaTriangleExclamation aria-hidden="true" /> Demo local: aplicá 002_ordenes.sql para guardar en Supabase.
            </p>
          )}
          {orden._invitado && (
            <p className="texto-mutado" role="note">
              Compraste como invitado. <Link to="/cuenta">Creá tu cuenta</Link> para ver tu historial.
            </p>
          )}
          <div className="checkout-acciones">
            <Link to="/productos" className="btn-fantasma">Seguir comprando</Link>
            {isAuthenticated ? (
              <Link to="/cuenta" className="btn-primary">Ver mis pedidos</Link>
            ) : (
              <Link to="/cuenta" className="btn-primary">Crear cuenta</Link>
            )}
          </div>
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

      {!isAuthenticated && (
        <p className="texto-mutado" role="note">
          Comprás como invitado. Si <Link to="/cuenta">iniciás sesión</Link>, tu pedido queda guardado en tu cuenta.
        </p>
      )}

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
            <p className="texto-mutado checkout-nota">Demostración: no ingreses datos reales, nada se cobra. Aprobada: <code>4242 4242 4242 4242</code> · Rechazada: <code>4000 0000 0000 0002</code></p>
            <div className="checkout-opciones" role="radiogroup" aria-label="Método de pago">
              {["tarjeta", "transferencia", "efectivo"].map((m) => (
                <label key={m} className={pago === m ? "activo" : ""}>
                  <input type="radio" name="pago" value={m} checked={pago === m} onChange={() => setPago(m)} />
                  {m === "tarjeta" ? "Tarjeta" : m === "transferencia" ? "Transferencia (10% off simulado)" : "Efectivo al retirar"}
                </label>
              ))}
            </div>
            {pago === "tarjeta" && (
              <div className="checkout-campos pago-tarjeta">
                <div className="tarjeta-preview" aria-hidden="true">
                  <span className="tarjeta-marca">{marca || "••••"}</span>
                  <span className="tarjeta-num">{tarjeta || "•••• •••• •••• ••••"}</span>
                  <span className="tarjeta-pie">
                    <span>{titular || "TITULAR"}</span>
                    <span>{vencimiento || "MM/AA"}</span>
                  </span>
                </div>
                <label>Titular
                  <input value={titular} onChange={(e) => setTitular(e.target.value)} placeholder="Como figura en la tarjeta" autoComplete="cc-name" required />
                </label>
                <label>Número (simulado)
                  <input value={tarjeta} onChange={(e) => setTarjeta(formatearTarjeta(e.target.value))} inputMode="numeric" placeholder="4242 4242 4242 4242" autoComplete="cc-number" required />
                </label>
                <div className="checkout-fila">
                  <label>Vencimiento
                    <input value={vencimiento} onChange={(e) => setVencimiento(formatearVenc(e.target.value))} placeholder="MM/AA" inputMode="numeric" autoComplete="cc-exp" required />
                  </label>
                  <label>CVV
                    <input value={cvv} onChange={(e) => setCvv(soloDigitos(e.target.value).slice(0, 4))} inputMode="numeric" placeholder="123" autoComplete="cc-csc" required />
                  </label>
                </div>
                <label>Cuotas
                  <select value={cuotas} onChange={(e) => setCuotas(Number(e.target.value))} aria-label="Cuotas">
                    {CUOTAS.map((c) => (
                      <option key={c.id} value={c.id}>{c.label} · ${(total / c.id).toLocaleString("es-AR", { maximumFractionDigits: 0 })} c/u</option>
                    ))}
                  </select>
                </label>
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
          {enviando && pasoPago && <p className="badge badge-info" role="status">{pasoPago}</p>}
          <button type="submit" className="btn-primary" disabled={enviando}>
            {enviando ? "Procesando pago simulado…" : `Pagar $${total.toLocaleString("es-AR")} (simulado)`}
          </button>
          <Link to="/carrito" className="btn-fantasma">Volver al carrito</Link>
        </aside>
      </form>
    </div>
  );
}

export default Checkout;
