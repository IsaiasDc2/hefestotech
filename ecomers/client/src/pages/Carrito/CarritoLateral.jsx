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
    if (!isOpen) return undefined;
    const alTeclado = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", alTeclado);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", alTeclado);
    };
  }, [isOpen, onClose]);

  const total = carrito.reduce(
    (acc, item) =>
      acc +
      Number(item.precio_con_descuento ?? item.precio ?? 0) *
        Number(item.cantidad ?? 1),
    0
  );

  return (
    <>
      <div
        className={`overlay ${isOpen ? "show" : ""}`}
        onClick={onClose}
        aria-hidden={!isOpen}
      ></div>

      <aside
        className={`cart ${isOpen ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Carrito de compras"
        aria-hidden={!isOpen}
      >

        <div className="cart-header">
          <h2>🛒 Mi carrito</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar carrito">
            ✕
          </button>
        </div>

        <div className="cart-body">
          {carrito.length === 0 ? (
            <div className="cart-vacio">
              <p className="cart-vacio-titulo">Tu carrito está vacío</p>
              <p className="cart-vacio-texto">Sumá productos y aparecen acá.</p>
            </div>
          ) : (
            carrito.map(item => (
              <div className="cart-item" key={item.id}>
                {item.imagen ? (
                  <img
                    src={item.imagen}
                    alt={item.nombre || "Producto"}
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                ) : null}

                <div className="info">
                  <h4>{item.nombre}</h4>
                  <p className="cart-precio">${Number(item.precio_con_descuento ?? item.precio ?? 0).toLocaleString("es-AR")}</p>

                  <div className="cantidad">
                    <button type="button" onClick={() => disminuirCantidad(item.id)} aria-label="Quitar uno">
                      -
                    </button>
                    <span>{item.cantidad}</span>
                    <button type="button" onClick={() => aumentarCantidad(item.id)} aria-label="Agregar uno">
                      +
                    </button>
                  </div>

                  <button
                    type="button"
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
          <div className="subtotal" aria-live="polite">
            <span>Subtotal</span>
            <strong>${total.toLocaleString("es-AR")}</strong>
          </div>

          <button type="button" className="btnComprar" disabled={carrito.length === 0}>
            Finalizar compra
          </button>
        </div>

      </aside>
    </>
  );
}

export default CarritoLateral;