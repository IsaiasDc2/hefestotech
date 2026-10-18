import { createElement, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import {
  FaHeart,
  FaRegHeart,
  FaCreditCard,
  FaTruckFast,
  FaCartPlus,
  FaCheck,
  FaMicrochip,
  FaMemory,
  FaHardDrive,
  FaKeyboard,
  FaDesktop,
  FaCube,
  FaWhatsapp,
} from "react-icons/fa6";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import { useEsFavorito } from "../../services/favoritos";
import { whatsappUrl } from "../../constants/whatsapp";
import { formatearPesos } from "../../utils/dinero";
import "./ProductCard.css";

/* Icono de respaldo según categoría (estado de error de imagen). */
function iconoPorCategoria(categoria = "") {
  const c = categoria.toLowerCase();
  if (c.includes("procesador")) return FaMicrochip;
  if (c.includes("placa")) return FaDesktop;
  if (c.includes("memoria") || c.includes("ram")) return FaMemory;
  if (c.includes("almacen") || c.includes("disco")) return FaHardDrive;
  if (c.includes("perif") || c.includes("teclado") || c.includes("mouse"))
    return FaKeyboard;
  return FaCube;
}

function ProductCard({ producto, agregarAlCarrito, prioridad = false }) {
  const idioma = useIdiomaStore((s) => s.idioma);
  const [favorito, alternarFavorito] = useEsFavorito(producto.id);
  const [imgError, setImgError] = useState(false);
  const [agregado, setAgregado] = useState(false);
  const timerAgregado = useRef(null);

  useEffect(() => () => {
    if (timerAgregado.current) clearTimeout(timerAgregado.current);
  }, []);

  const manejarAgregar = () => {
    agregarAlCarrito?.(producto);
    setAgregado(true);
    if (timerAgregado.current) clearTimeout(timerAgregado.current);
    timerAgregado.current = setTimeout(() => setAgregado(false), 1400);
  };

  const tieneOferta = (producto.descuento_porcentaje ?? 0) > 0;
  const descuento = Math.round(Number(producto.descuento_porcentaje ?? 0));
  const precio = Number(producto.precio ?? 0);
  const precioFinal = Number(
    producto.precio_con_descuento ?? producto.precio ?? 0
  );
  // Precio 0 = carga pendiente del dueño (ver mig. 007): no se vende a $0.
  const tienePrecio = precioFinal > 0;
  const hayStock = Number(producto.stock ?? 0) > 0;
  const comprable = hayStock && tienePrecio;
  const imagen = producto.imagen || "";
  const nombre = producto.nombre || t(idioma, "card.producto");
  const marca = (producto.marca || "").trim();
  const categoria = producto.categoria || "General";
  const urlProducto = `/producto/${producto.id}`;
  const ratingRaw = producto.rating ?? producto.promedio ?? null;
  const tieneRating =
    ratingRaw !== null &&
    ratingRaw !== undefined &&
    ratingRaw !== "" &&
    !Number.isNaN(Number(ratingRaw));
  const rating = tieneRating ? Number(ratingRaw) : null;
  const resenas = producto.resenas ?? producto.cantidad_resenas ?? null;
  /* Cuotas solo si el dato es real (campo del producto). Nada inventado. */
  const cuotasTexto =
    typeof producto.cuotas_texto === "string" && producto.cuotas_texto.trim()
      ? producto.cuotas_texto.trim()
      : null;

  return (
    <article className={`card-producto${hayStock ? "" : " is-sin-stock"}`} aria-label={nombre}>
      <div className="card-media">
        <Link to={urlProducto} className="card-media-link" tabIndex={-1} aria-hidden="true">
          {imagen && !imgError ? (
            <img
              src={imagen}
              alt=""
              width="600"
              height="600"
              sizes="(min-width: 1280px) 280px, (min-width: 640px) 33vw, 50vw"
              loading={prioridad ? "eager" : "lazy"}
              fetchPriority={prioridad ? "high" : "auto"}
              decoding="async"
              onError={() => {
                setImgError(true);
              }}
            />
          ) : (
            <span className="producto-sin-imagen">
              {createElement(iconoPorCategoria(categoria), {
                className: "sin-imagen-icono",
                "aria-hidden": true,
              })}
            </span>
          )}
        </Link>
        {tieneOferta && tienePrecio && descuento > 0 && (
          <span className="oferta" aria-label={`${t(idioma, "card.oferta")} ${descuento}%`}>
            -{descuento}%
          </span>
        )}
        <button
          type="button"
          className={`favorito ${favorito ? "activo" : ""}`}
          onClick={alternarFavorito}
          aria-pressed={favorito}
          aria-label={`${favorito ? t(idioma, "card.favQuitar") : t(idioma, "card.favAgregar")}: ${nombre}`}
        >
          {favorito ? <FaHeart aria-hidden="true" /> : <FaRegHeart aria-hidden="true" />}
        </button>
      </div>

      <p className="card-meta">
        {marca && <span className="card-marca">{marca}</span>}
        <span className={`card-stock${hayStock ? " disponible" : " agotado"}`}>
          <span className="stock-dot" aria-hidden="true" />
          {hayStock ? t(idioma, "card.disponible") : t(idioma, "card.sinStock")}
        </span>
      </p>

      <Link to={urlProducto} className="card-titulo-link">
        <h3>{nombre}</h3>
      </Link>

      {tieneRating && (
        <span
          className="card-rating"
          role="img"
          aria-label={`${t(idioma, "card.rating")} ${rating.toFixed(1)} ${t(idioma, "card.de")} 5`}
        >
          <span className="estrellas" aria-hidden="true">★</span>
          <span className="rating-num">{rating.toFixed(1)}</span>
          {resenas != null && <span className="rating-count">({resenas})</span>}
        </span>
      )}

      <div className="card-precio">
        {!tienePrecio ? (
          <strong className="precio-actual precio-a-confirmar">{t(idioma, "catl.sinPrecio")}</strong>
        ) : (
          <>
            {tieneOferta && <span className="precio-anterior">{formatearPesos(precio)}</span>}
            <strong className="precio-actual">{formatearPesos(precioFinal)}</strong>
          </>
        )}
      </div>

      {(cuotasTexto || producto.envio_gratis) && (
        <ul className="card-extras">
          {cuotasTexto && (
            <li>
              <FaCreditCard aria-hidden="true" /> {cuotasTexto}
            </li>
          )}
          {producto.envio_gratis && (
            <li>
              <FaTruckFast aria-hidden="true" /> {t(idioma, "card.envioGratis")}
            </li>
          )}
        </ul>
      )}

      {!tienePrecio ? (
        <a
          className="btn-carrito btn-consultar"
          href={whatsappUrl(`Hola! Quiero consultar precio y stock de ${nombre}${producto.codigo ? ` (${producto.codigo})` : ""}.`)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <FaWhatsapp aria-hidden="true" /> {t(idioma, "catl.consultar")}
        </a>
      ) : (
        <button
          type="button"
          className={`btn-carrito${agregado ? " is-added" : ""}`}
          disabled={!comprable}
          onClick={manejarAgregar}
          aria-label={
            hayStock ? `${t(idioma, "card.agregar")}: ${nombre}` : `${nombre}: ${t(idioma, "card.sinStock")}`
          }
        >
          {!hayStock ? (
            t(idioma, "card.sinStock")
          ) : agregado ? (
            <>
              <FaCheck aria-hidden="true" /> {t(idioma, "card.agregado")}
            </>
          ) : (
            <>
              <FaCartPlus aria-hidden="true" /> {t(idioma, "card.agregar")}
            </>
          )}
        </button>
      )}
      <span className="sr-only" aria-live="polite">
        {agregado ? `${nombre}: ${t(idioma, "card.agregado")}` : ""}
      </span>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="card-skeleton" aria-hidden="true">
      <span className="sk-media" />
      <span className="sk-linea sk-titulo" />
      <span className="sk-linea sk-corta" />
      <span className="sk-linea sk-precio" />
      <span className="sk-boton" />
    </div>
  );
}

export default ProductCard;
