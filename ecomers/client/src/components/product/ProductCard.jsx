import { useState } from "react";
import { Link } from "react-router-dom";
import "./ProductCard.css";

function ProductCard({ producto, agregarAlCarrito }) {
  const [favorito, setFavorito] = useState(false);

  const tieneOferta = (producto.descuentoPorcentaje ?? 0) > 0;

  return (
    <div className="card-producto">
      {tieneOferta && <span className="oferta">OFERTA</span>}

      <button
        type="button"
        className={`favorito ${favorito ? "activo" : ""}`}
        onClick={() => setFavorito((prev) => !prev)}
        aria-pressed={favorito}
        aria-label={
          favorito ? "Quitar de favoritos" : "Agregar a favoritos"
        }
      >
        {favorito ? "❤️" : "🤍"}
      </button>

      <Link to={`/producto/${producto.id}`} className="producto-detalle">
        <img src={producto.imagen} alt={producto.nombre} />
        <h3>{producto.nombre}</h3>
      </Link>

      <p className="categoria">{producto.categoria}</p>

      <div className="stock">
        {producto.stock ? (
          <span>🟢 Disponible</span>
        ) : (
          <span>🔴 Sin stock</span>
        )}
      </div>

      {tieneOferta ? (
        <div className="precios">
          <span className="precio-anterior">
            ${producto.precio.toLocaleString("es-AR")}
          </span>
          <strong>
            ${producto.precioConDescuento.toLocaleString("es-AR")}
          </strong>
        </div>
      ) : (
        <strong>${producto.precio.toLocaleString("es-AR")}</strong>
      )}

      <p className="cuotas">💳 6 cuotas sin interés</p>

      {producto.envioGratis && <p className="envio">🚚 Envío gratis</p>}

      <button
        className="btn-carrito"
        disabled={!producto.stock}
        onClick={() => agregarAlCarrito(producto)}
      >
        {producto.stock ? "🛒 Agregar al carrito" : "Sin stock"}
      </button>
    </div>
  );
}

export default ProductCard;