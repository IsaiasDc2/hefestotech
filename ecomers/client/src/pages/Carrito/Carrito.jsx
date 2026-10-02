import { Link } from "react-router-dom";
import { FaCartShopping } from "react-icons/fa6";

const UMBRAL_ENVIO_GRATIS = 150000;

function Carrito({
  carrito = [],
  eliminarDelCarrito,
  aumentarCantidad,
  disminuirCantidad,
}) {
  const subtotal = carrito.reduce(
    (acc, item) =>
      acc +
      Number(item.precio_con_descuento ?? item.precio ?? 0) *
        Number(item.cantidad ?? 1),
    0
  );
  const progreso = Math.min(1, UMBRAL_ENVIO_GRATIS > 0 ? subtotal / UMBRAL_ENVIO_GRATIS : 1);
  const faltante = Math.max(0, UMBRAL_ENVIO_GRATIS - subtotal);

  if (carrito.length === 0) {
    return (
      <div className="carrito-pagina carrito-vacio-pagina">
        <div className="cart-vacio-ilustra" aria-hidden="true">
          <span className="cart-vacio-anillo" />
          <FaCartShopping className="cart-vacio-icono" />
        </div>
        <h1>Carrito</h1>
        <p className="carrito-vacio-texto">Tu carrito está vacío.</p>
        <Link to="/productos" className="carrito-cta">Ver productos →</Link>
      </div>
    );
  }

  return (
    <div className="carrito-pagina">
      <header className="carrito-pagina-head">
      <h1>Carrito completo</h1>
      <p className="carrito-conteo">
        {carrito.length} producto{carrito.length === 1 ? "" : "s"} en el
        carrito
      </p>
      </header>
      <div className="cart-envio cart-envio-pagina" aria-hidden={false}>
        <p className="cart-envio-texto">
          {subtotal >= UMBRAL_ENVIO_GRATIS
            ? "¡Tenés envío gratis!"
            : `Te faltan $${faltante.toLocaleString("es-AR")} para el envío gratis`}
        </p>
        <div className="cart-envio-barra">
          <span
            className="cart-envio-relleno"
            style={{ width: `${Math.round(progreso * 100)}%` }}
          />
        </div>
      </div>
      <ul className="carrito-lista">
        {carrito.map((item) => (
          <li key={item.id} className="carrito-item">
            {item.imagen ? (
              <span className="carrito-thumb">
                <img
                  src={item.imagen}
                  alt=""
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              </span>
            ) : null}
            <span className="carrito-item-nombre">{item.nombre}</span>
            <span className="carrito-item-cant">× {item.cantidad}</span>
            <span className="carrito-item-precio">
              $
              {(
                Number(item.precio_con_descuento ?? item.precio ?? 0) *
                Number(item.cantidad ?? 1)
              ).toLocaleString("es-AR")}
            </span>
            <span className="carrito-item-acciones">
              <button type="button" onClick={() => disminuirCantidad?.(item.id)} aria-label="Quitar uno">−</button>
              <button type="button" onClick={() => aumentarCantidad?.(item.id)} aria-label="Agregar uno">+</button>
              <button type="button" onClick={() => eliminarDelCarrito?.(item.id)}>Eliminar</button>
            </span>
          </li>
        ))}
      </ul>
      <div className="carrito-pagina-resumen">
        <p className="carrito-subtotal">
          Subtotal: <strong>${subtotal.toLocaleString("es-AR")}</strong>
        </p>
        <div className="carrito-pagina-acciones">
          <Link to="/productos" className="carrito-secundario">← Seguir comprando</Link>
          <Link to="/checkout" className="btn-primary">Finalizar compra →</Link>
        </div>
      </div>
    </div>
  );
}

export default Carrito;
