import { useState } from "react";
import { Link } from "react-router-dom";
import {
  FaCheck,
  FaTriangleExclamation,
  FaCircleXmark,
  FaCircleCheck,
  FaPlus,
  FaMinus,
} from "react-icons/fa6";
import "../components/product/ProductCard.css";
import { precioFinal } from "./adaptar";

const INSIGNIA = {
  compatible: { clase: "is-ok", Icono: FaCircleCheck, texto: "Compatible" },
  revisar: { clase: "is-warn", Icono: FaTriangleExclamation, texto: "Revisar" },
  incompatible: {
    clase: "is-error",
    Icono: FaCircleXmark,
    texto: "Incompatible",
  },
};

/**
 * Card compacta del armador. Reutiliza las clases de ProductCard.css
 * (card-producto, precios, stock…) con el modificador `is-armador`
 * y agrega: insignia de compatibilidad + botón Elegir/Quitar.
 */
function ArmadorCard({
  producto,
  estado = "compatible",
  motivo = "",
  elegido = false,
  atenuado = false,
  onElegir,
  onQuitar,
}) {
  const [imgError, setImgError] = useState(false);
  const sello = INSIGNIA[estado] ?? INSIGNIA.compatible;
  const { Icono } = sello;

  const tieneOferta = Number(producto.descuento_porcentaje ?? 0) > 0;
  const descuento = Math.round(Number(producto.descuento_porcentaje ?? 0));
  const precio = Number(producto.precio ?? 0);
  const final = precioFinal(producto);
  const hayStock = Number(producto.stock ?? 0) > 0;
  const imagen = producto.imagen || "";
  const nombre = producto.nombre || "Producto";
  const marca = (producto.marca || "").trim();

  return (
    <article
      className={[
        "card-producto",
        "is-armador",
        elegido ? "is-elegido" : "",
        atenuado ? "is-atenuado" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={nombre}
    >
      <span
        className={`compat-sello ${sello.clase}`}
        title={motivo}
        aria-label={`Compatibilidad: ${sello.texto}. ${motivo}`}
      >
        <Icono aria-hidden="true" />
        {sello.texto}
      </span>

      <div className="card-media is-compacta">
        <Link
          to={`/producto/${producto.id}`}
          className="card-media-link"
          aria-label={`Ver ${nombre}`}
          tabIndex={atenuado ? -1 : undefined}
        >
          {imagen && !imgError ? (
            <img
              src={imagen}
              alt={nombre}
              width="600"
              height="600"
              loading="lazy"
              decoding="async"
              onError={() => setImgError(true)}
            />
          ) : (
            <span
              className="producto-sin-imagen"
              role="img"
              aria-label={`Sin imagen disponible de ${nombre}`}
            >
              <span className="sin-imagen-texto" aria-hidden="true">
                HefestoTech
              </span>
            </span>
          )}
        </Link>
      </div>

      <Link
        to={`/producto/${producto.id}`}
        className="card-titulo-link"
        tabIndex={atenuado ? -1 : undefined}
      >
        <h3>{nombre}</h3>
      </Link>

      {marca && (
        <p className="categoria">
          {marca} · {producto.categoria}
        </p>
      )}

      <div className="stock">
        {hayStock ? (
          <span className="stock-linea disponible">
            <span className="stock-dot" aria-hidden="true" /> Disponible
          </span>
        ) : (
          <span className="stock-linea agotado">
            <span className="stock-dot" aria-hidden="true" /> Sin stock
          </span>
        )}
      </div>

      {tieneOferta ? (
        <div className="precios">
          <span className="precio-anterior">
            ${precio.toLocaleString("es-AR")}
          </span>
          {descuento > 0 && (
            <span className="descuento-badge">-{descuento}%</span>
          )}
          <strong className="precio-actual">
            ${final.toLocaleString("es-AR")}
          </strong>
        </div>
      ) : (
        <strong className="precio-actual">
          ${final.toLocaleString("es-AR")}
        </strong>
      )}

      {motivo && estado !== "compatible" && (
        <p className="compat-motivo">{motivo}</p>
      )}

      {elegido ? (
        <button
          type="button"
          className="btn-carrito is-added is-quitar"
          onClick={onQuitar}
          aria-label={`Quitar ${nombre} de tu armado`}
        >
          <FaMinus aria-hidden="true" /> Quitar
        </button>
      ) : (
        <button
          type="button"
          className="btn-carrito"
          disabled={!hayStock || atenuado}
          onClick={onElegir}
          title={
            atenuado
              ? motivo || "No compatible con tu armado"
              : undefined
          }
          aria-label={
            atenuado
              ? `${nombre}: no se puede elegir. ${motivo}`
              : hayStock
                ? `Elegir ${nombre} para tu armado`
                : `${nombre} sin stock`
          }
        >
          {!hayStock ? (
            "Sin stock"
          ) : atenuado ? (
            <>
              <FaCircleXmark aria-hidden="true" /> No compatible
            </>
          ) : (
            <>
              <FaPlus aria-hidden="true" /> Elegir
            </>
          )}
        </button>
      )}

      {elegido && (
        <span className="elegido-pop" aria-hidden="true">
          <FaCheck />
        </span>
      )}
    </article>
  );
}

export default ArmadorCard;
