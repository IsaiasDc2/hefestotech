import { useState } from "react";
import { Link } from "react-router-dom";
import "./ProductCard.css";

function ProductCard({ producto, agregarAlCarrito }) {
  const [favorito, setFavorito] = useState(false);

  const tieneOferta = (producto.descuento_porcentaje ?? 0) > 0;
  const precio = Number(producto.precio ?? 0);
  const precioFinal = Number(
    producto.precio_con_descuento ?? producto.precio ?? 0
  );
  const imagen = producto.imagen || "";
  const nombre = producto.nombre || "Producto";

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
        {imagen ? (
          <img
            src={imagen}
            alt={nombre}
            loading="lazy"
            decoding="async"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : (
          <span className="producto-sin-imagen" aria-hidden="true">HefestoTech</span>
        )}
        <h3>{nombre}</h3>
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
            ${precio.toLocaleString("es-AR")}
          </span>
          <strong>
            ${precioFinal.toLocaleString("es-AR")}
          </strong>
        </div>
      ) : (
        <strong>${precio.toLocaleString("es-AR")}</strong>
      )}

      <p className="cuotas">💳 6 cuotas sin interés</p>

      {producto.envio_gratis && <p className="envio">🚚 Envío gratis</p>}

      <button
        type="button"
        className="btn-carrito"
        disabled={!producto.stock}
        onClick={() => agregarAlCarrito?.(producto)}
      >
        {producto.stock ? "🛒 Agregar al carrito" : "Sin stock"}
      </button>
    </div>
  );
}

export default ProductCard;