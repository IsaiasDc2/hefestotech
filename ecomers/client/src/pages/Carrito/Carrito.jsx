import { Link } from "react-router-dom";

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

  if (carrito.length === 0) {
    return (
      <div className="carrito-pagina carrito-vacio-pagina">
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
      <ul className="carrito-lista">
        {carrito.map((item) => (
          <li key={item.id} className="carrito-item">
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
      <p className="carrito-subtotal">
        Subtotal: <strong>${subtotal.toLocaleString("es-AR")}</strong>
      </p>
      <div className="carrito-pagina-acciones">
      <Link to="/productos" className="carrito-secundario">← Seguir comprando</Link>
      </div>
    </div>
  );
}

export default Carrito;
