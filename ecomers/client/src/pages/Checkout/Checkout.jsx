import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FaLock, FaTruckFast, FaCircleExclamation } from "react-icons/fa6";
import Marca from "../../components/brand/Marca";
import { crearOrdenCheckout } from "../../services/orderService";
import logoMP from "../../assets/mercadopago.svg";
import "./Checkout.css";

const UMBRAL_ENVIO_GRATIS = 150000;
const COSTO_ENVIO_ESTANDAR = 5000;
const COSTO_ENVIO_EXPRESS = 12000;

const PROVINCIAS = [
  "Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut", "Córdoba",
  "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja",
  "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan",
  "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero",
  "Tierra del Fuego", "Tucumán",
];

const unitario = (item) =>
  Math.round(Number(item.precio_con_descuento ?? item.precio ?? 0));

const soloDigitos = (v = "") => String(v).replace(/\D/g, "");

const emailValido = (v = "") => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

const telefonoValido = (v = "") => {
  const d = soloDigitos(v);
  return d.length >= 10 && d.length <= 15;
};

const documentoValido = (v = "") => {
  const d = soloDigitos(v);
  if (/^\d{7,8}$/.test(d)) return true; // DNI
  if (!/^\d{11}$/.test(d)) return false; // CUIT: valida dígito verificador
  const mult = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = mult.reduce((acc, m, i) => acc + m * Number(d[i]), 0);
  const verif = (11 - (suma % 11)) % 11;
  return verif === Number(d[10]);
};

const cpValido = (v = "") =>
  /^\d{4}$/.test(v.trim()) || /^[A-Za-z]\d{4}[A-Za-z]{3}$/.test(v.trim());

const CAMPOS = ["nombre", "email", "telefono", "documento", "direccion", "ciudad", "provincia", "codigoPostal"];

function Checkout({ carrito = [], vaciarCarrito }) {
  const [form, setForm] = useState({
    nombre: "", email: "", telefono: "", documento: "",
    direccion: "", ciudad: "", provincia: "", codigoPostal: "",
  });
  const [errores, setErrores] = useState({});
  const [envio, setEnvio] = useState("estandar");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const enviandoRef = useRef(false);
  const refs = useRef({});

  const set = (campo) => (e) => {
    setForm((f) => ({ ...f, [campo]: e.target.value }));
    setErrores((prev) => ({ ...prev, [campo]: "" }));
  };

  const subtotal = useMemo(
    () => carrito.reduce((acc, item) => acc + unitario(item) * Number(item.cantidad ?? 1), 0),
    [carrito]
  );

  const costoEnvio = useMemo(() => {
    if (carrito.length === 0) return 0;
    if (subtotal >= UMBRAL_ENVIO_GRATIS) return 0;
    return envio === "express" ? COSTO_ENVIO_EXPRESS : COSTO_ENVIO_ESTANDAR;
  }, [envio, subtotal, carrito.length]);

  const total = subtotal + costoEnvio;

  const validar = () => {
    const e = {};
    if (form.nombre.trim().length < 3) e.nombre = "Ingresá tu nombre completo.";
    if (!emailValido(form.email)) e.email = "Ingresá un email válido.";
    if (!telefonoValido(form.telefono)) e.telefono = "Ingresá un teléfono válido (ej. 11 5555 5555).";
    if (!documentoValido(form.documento)) e.documento = "DNI (7-8 dígitos) o CUIT válido.";
    if (form.direccion.trim().length < 4) e.direccion = "Ingresá tu dirección.";
    if (form.ciudad.trim().length < 2) e.ciudad = "Ingresá tu ciudad.";
    if (!PROVINCIAS.includes(form.provincia)) e.provincia = "Elegí tu provincia.";
    if (!cpValido(form.codigoPostal)) e.codigoPostal = "CP de 4 dígitos o CPA.";
    return e;
  };

  const confirmar = async (e) => {
    e.preventDefault();
    if (enviandoRef.current) return; // anti-doble-clic
    setError("");
    if (carrito.length === 0) return;
    const e2 = validar();
    setErrores(e2);
    if (Object.keys(e2).length > 0) {
      const primero = CAMPOS.find((c) => e2[c]);
      refs.current[primero]?.focus();
      return;
    }
    enviandoRef.current = true;
    setEnviando(true);
    try {
      const data = await crearOrdenCheckout({
        comprador: {
          nombre: form.nombre.trim(),
          email: form.email.trim(),
          telefono: soloDigitos(form.telefono),
          documento: soloDigitos(form.documento),
          direccion: form.direccion.trim(),
          ciudad: form.ciudad.trim(),
          provincia: form.provincia,
          codigo_postal: form.codigoPostal.trim().toUpperCase(),
        },
        items: carrito.map((item) => ({
          producto_id: item.producto_id ?? item.id,
          cantidad: Number(item.cantidad ?? 1),
        })),
        envio,
      });
      vaciarCarrito?.();
      window.location.href = data.link_pago;
    } catch (err) {
      setError(err?.message || "No se pudo crear el pedido. Probá de nuevo.");
      enviandoRef.current = false;
      setEnviando(false);
    }
  };

  const campo = (id, label, props, type = "text") => (
    <label>
      {label}
      <input
        ref={(el) => { refs.current[id] = el; }}
        type={type}
        value={form[id]}
        onChange={set(id)}
        aria-invalid={Boolean(errores[id])}
        aria-describedby={errores[id] ? `err-${id}` : undefined}
        {...props}
      />
      {errores[id] && <span className="campo-error" id={`err-${id}`} role="alert">{errores[id]}</span>}
    </label>
  );

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
            <span>Checkout</span>
          </p>
          <h1>Finalizar compra</h1>
        </div>
        <span className="badge badge-info"><FaLock aria-hidden="true" /> Compra protegida</span>
      </header>

      <form className="checkout-grid" onSubmit={confirmar} noValidate>
        <div className="checkout-col">
          <section className="card checkout-panel" aria-label="Datos de contacto y envío">
            <h2>Datos y envío</h2>
            <div className="checkout-campos">
              {campo("nombre", "Nombre completo", { autoComplete: "name", placeholder: "Juan Pérez" })}
              {campo("email", "Email", { autoComplete: "email", placeholder: "juan@mail.com" }, "email")}
              <div className="checkout-fila">
                {campo("telefono", "Teléfono", { autoComplete: "tel", inputMode: "tel", placeholder: "11 5555 5555" })}
                {campo("documento", "DNI o CUIT", { autoComplete: "off", inputMode: "numeric", placeholder: "20123456789" })}
              </div>
              {campo("direccion", "Dirección", { autoComplete: "street-address", placeholder: "Av. Siempreviva 123" })}
              <div className="checkout-fila">
                {campo("ciudad", "Ciudad", { autoComplete: "address-level2", placeholder: "Rosario" })}
                {campo("codigoPostal", "Código postal", { autoComplete: "postal-code", inputMode: "text", placeholder: "2000" })}
              </div>
              <label>
                Provincia
                <select
                  ref={(el) => { refs.current.provincia = el; }}
                  value={form.provincia}
                  onChange={set("provincia")}
                  autoComplete="address-level1"
                  aria-invalid={Boolean(errores.provincia)}
                  aria-describedby={errores.provincia ? "err-provincia" : undefined}
                >
                  <option value="">Elegí tu provincia…</option>
                  {PROVINCIAS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                {errores.provincia && <span className="campo-error" id="err-provincia" role="alert">{errores.provincia}</span>}
              </label>
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

          <section className="card checkout-panel" aria-label="Método de pago">
            <h2>Pago</h2>
            <div className="checkout-opciones" role="radiogroup" aria-label="Método de pago">
              <label className="activo">
                <input type="radio" name="pago" value="mercadopago" checked readOnly />
                <img src={logoMP} alt="" aria-hidden="true" className="pago-logo" />
                Mercado Pago
              </label>
              <label className="opcion-deshabilitada" aria-disabled="true" title="Próximamente: datos de transferencia no disponibles">
                <input type="radio" name="pago" value="transferencia" disabled />
                Transferencia <span className="badge badge-aviso">Próximamente</span>
              </label>
              <label className="opcion-deshabilitada" aria-disabled="true" title="Próximamente: pago en efectivo no disponible">
                <input type="radio" name="pago" value="efectivo" disabled />
                Efectivo al retirar <span className="badge badge-aviso">Próximamente</span>
              </label>
            </div>
            <div className="pago-mp-panel">
              <img src={logoMP} alt="Mercado Pago" className="pago-logo-lg" />
              <p className="texto-mutado">Al confirmar te redirigimos a Mercado Pago para pagar de forma segura con tarjeta, débito o dinero en cuenta.</p>
            </div>
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
          <p className="texto-mutado checkout-nota">Totales estimados: el servidor recalcula precios, stock y envío antes de cobrar.</p>
          {error && <p className="badge badge-peligro checkout-error" role="alert"><FaCircleExclamation aria-hidden="true" /> {error}</p>}
          {enviando && <p className="badge badge-info" role="status">Creando tu pedido…</p>}
          <button type="submit" className="btn-primary" disabled={enviando}>
            {enviando ? "Creando pedido…" : `Pagar $${total.toLocaleString("es-AR")} con Mercado Pago`}
          </button>
          <Link to="/carrito" className="btn-fantasma">Volver al carrito</Link>
        </aside>
      </form>
    </div>
  );
}

export default Checkout;
