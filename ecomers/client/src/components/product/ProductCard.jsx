import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaHeart,
  FaRegHeart,
  FaCreditCard,
  FaTruckFast,
  FaCartPlus,
  FaCheck,
} from "react-icons/fa6";
import "./ProductCard.css";

// Manifiesto estatico public/manifiesto-fondos.json (generado por
// scripts/auditoria-imagenes.py): URL -> "blanco" | "negro".
// Define el blend del recuadro sin canvas en runtime. Sin entrada = sin blend.
const MANIFIESTO_URL = `${import.meta.env.BASE_URL}manifiesto-fondos.json`;
let promesaManifiesto = null;

function cargarManifiesto() {
  if (!promesaManifiesto) {
    promesaManifiesto = fetch(MANIFIESTO_URL, { cache: "force-cache" })
      .then((respuesta) => (respuesta.ok ? respuesta.json() : {}))
      .then((json) =>
        json && json.entradas ? json.entradas : {}
      )
      .catch(() => ({}));
  }
  return promesaManifiesto;
}

function basenameDe(url) {
  const limpio = String(url || "").split("?")[0].split("#")[0];
  const partes = limpio.split("/");
  return partes[partes.length - 1].toLowerCase();
}

function buscarFondo(imagen, manifiesto) {
  if (!imagen || !manifiesto) return null;
  if (manifiesto[imagen]) return manifiesto[imagen];
  const base = basenameDe(imagen);
  if (!base) return null;
  const claves = Object.keys(manifiesto);
  for (let i = 0; i < claves.length; i += 1) {
    if (basenameDe(claves[i]) === base) return manifiesto[claves[i]];
  }
  return null;
}

function ProductCard({ producto, agregarAlCarrito }) {
  const [favorito, setFavorito] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [agregado, setAgregado] = useState(false);
  const [fondoTipo, setFondoTipo] = useState(null);
  const timerAgregado = useRef(null);

  useEffect(() => () => {
    if (timerAgregado.current) clearTimeout(timerAgregado.current);
  }, []);

  const tieneOferta = (producto.descuento_porcentaje ?? 0) > 0;
  const descuento = Math.round(Number(producto.descuento_porcentaje ?? 0));
  const precio = Number(producto.precio ?? 0);
  const precioFinal = Number(
    producto.precio_con_descuento ?? producto.precio ?? 0
  );
  const imagen = producto.imagen || "";
  const nombre = producto.nombre || "Producto";
  const marca = (producto.marca || "").trim();
  const sinStock = !producto.stock;
  const ratingRaw = producto.rating ?? producto.promedio ?? null;
  const tieneRating =
    ratingRaw !== null &&
    ratingRaw !== undefined &&
    ratingRaw !== "" &&
    !Number.isNaN(Number(ratingRaw));
  const rating = tieneRating ? Number(ratingRaw) : null;
  const resenas = producto.resenas ?? producto.cantidad_resenas ?? null;
  const detalleUrl = `/producto/${producto.id}`;
  const claseFondo =
    fondoTipo === "blanco"
      ? "img-fondo-blanco"
      : fondoTipo === "negro"
        ? "img-fondo-negro"
        : undefined;

  useEffect(() => {
    let viva = true;
    setFondoTipo(null);
    setImgError(false);
    if (imagen) {
      cargarManifiesto().then((entradas) => {
        if (viva) setFondoTipo(buscarFondo(imagen, entradas));
      });
    }
    return () => {
      viva = false;
    };
  }, [imagen]);

  const manejarAgregar = () => {
    agregarAlCarrito?.(producto);
    setAgregado(true);
    if (timerAgregado.current) clearTimeout(timerAgregado.current);
    timerAgregado.current = setTimeout(() => setAgregado(false), 1400);
  };

  return (
    <div className={`card-producto${sinStock ? " is-sin-stock" : ""}`}>
      {tieneOferta && (
        <span className="oferta">
          <span>OFERTA</span>
          {descuento > 0 && <span className="oferta-pct">-{descuento}%</span>}
        </span>
      )}

      {marca && (
        <span className="card-marca" title={marca}>
          {marca}
        </span>
      )}

      <div className="card-media-wrap">
        <Link
          to={detalleUrl}
          className="card-media-link"
          tabIndex={-1}
          aria-hidden="true"
        >
          <span className="card-media">
            {imagen && !imgError ? (
              <img
                src={imagen}
                alt={nombre}
                width="600"
                height="600"
                loading="lazy"
                decoding="async"
                className={claseFondo}
                onError={() => { setImgError(true); }}
              />
            ) : (
              <span
                className="producto-sin-imagen"
                role="img"
                aria-label={`Sin foto de ${nombre}`}
              >
                HefestoTech
              </span>
            )}
          </span>
        </Link>

        <button
          type="button"
          className={`favorito ${favorito ? "activo" : ""}`}
          onClick={() => setFavorito((prev) => !prev)}
          aria-pressed={favorito}
          aria-label={
            favorito ? "Quitar de favoritos" : "Agregar a favoritos"
          }
        >
          {favorito ? (
            <FaHeart aria-hidden="true" />
          ) : (
            <FaRegHeart aria-hidden="true" />
          )}
        </button>
      </div>

      <Link to={detalleUrl} className="producto-detalle">
        <h3>{nombre}</h3>
        {tieneRating && (
          <span className="card-rating" aria-label={`Calificación ${rating} de 5`}>
            <span className="estrellas" aria-hidden="true">★★★★★</span>
            <span className="rating-num">{rating.toFixed(1)}</span>
            {resenas != null && <span className="rating-count">({resenas})</span>}
          </span>
        )}
      </Link>

      <p className="categoria">{producto.categoria}</p>

      <div className="stock">
        {producto.stock ? (
          <span className="stock-linea disponible">
            <span className="stock-dot" aria-hidden="true" /> Disponible
          </span>
        ) : (
          <span className="stock-linea agotado">
            <span className="stock-dot" aria-hidden="true" /> Sin stock
          </span>
        )}
      </div>

      <div className="card-pie">
        {tieneOferta ? (
          <div className="precios">
            <span className="precio-anterior">
              ${precio.toLocaleString("es-AR")}
            </span>
            {descuento > 0 && (
              <span className="descuento-badge">-{descuento}%</span>
            )}
            <strong className="precio-actual">
              ${precioFinal.toLocaleString("es-AR")}
            </strong>
          </div>
        ) : (
          <strong className="precio-actual">${precio.toLocaleString("es-AR")}</strong>
        )}

        <p className="cuotas">
          <FaCreditCard aria-hidden="true" /> 6 cuotas sin interés
        </p>

        {producto.envio_gratis && (
          <p className="envio">
            <FaTruckFast aria-hidden="true" /> Envío gratis
          </p>
        )}

        <button
          type="button"
          className={`btn-carrito${agregado ? " is-added" : ""}`}
          disabled={sinStock}
          onClick={manejarAgregar}
          aria-live="polite"
          aria-label={
            producto.stock
              ? `Agregar ${nombre} al carrito`
              : `${nombre} sin stock`
          }
        >
          {producto.stock ? (
            agregado ? (
              <>
                <FaCheck aria-hidden="true" /> Agregado
              </>
            ) : (
              <>
                <FaCartPlus aria-hidden="true" /> Agregar al carrito
              </>
            )
          ) : (
            "Sin stock"
          )}
        </button>
      </div>
    </div>
  );
}

export default ProductCard;
