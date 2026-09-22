import { useEffect } from "react";
import "./CarritoLateral.css";

function CarritoLateral({
  isOpen,
  onClose,
  carrito,
  eliminarDelCarrito,
  aumentarCantidad,
  disminuirCantidad
}) {

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const total = carrito.reduce(
    (acc, item) =>
      acc + item.precio * item.cantidad,
    0
  );

  return (
    <>
      <div
        className={`overlay ${isOpen ? "show" : ""}`}
        onClick={onClose}
      ></div>

      <aside className={`cart ${isOpen ? "open" : ""}`}>

        <div className="cart-header">
          <h2>🛒 Mi carrito</h2>
          <button onClick={onClose} aria-label="Cerrar carrito">
            ✕
          </button>
        </div>

        <div className="cart-body">
          {carrito.length === 0 ? (
            <p>Tu carrito está vacío</p>
          ) : (
            carrito.map(item => (
              <div className="cart-item" key={item.id}>
                <img src={item.imagen} alt={item.nombre} />

                <div className="info">
                  <h4>{item.nombre}</h4>
                  <p>${item.precio.toLocaleString()}</p>

                  <div className="cantidad">
                    <button onClick={() => disminuirCantidad(item.id)}>
                      -
                    </button>
                    <span>{item.cantidad}</span>
                    <button onClick={() => aumentarCantidad(item.id)}>
                      +
                    </button>
                  </div>

                  <button
                    className="eliminar"
                    onClick={() => eliminarDelCarrito(item.id)}
                  >
                    🗑 Eliminar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="cart-footer">
          <div className="subtotal">
            <span>Total</span>
            <strong>${total.toLocaleString()}</strong>
          </div>

          <button className="btnComprar">
            Finalizar compra
          </button>
        </div>

      </aside>
    </>
  );
}

export default CarritoLateral;