import { useState } from "react";
import { Link } from "react-router";
import {
  FaCheck,
  FaTriangleExclamation,
  FaCircleXmark,
  FaCircleCheck,
  FaPlus,
  FaMinus,
} from "react-icons/fa6";
import "../components/product/ProductCard.css";
import useIdiomaStore, { t } from "../store/idiomaStore";
import { nombreCategoriaDb } from "../constants/categorias";
import { precioFinal } from "./adaptar";
import { traducirMensaje } from "./mensajesEn";

const INSIGNIA = {
  compatible: { clase: "is-ok", Icono: FaCircleCheck, key: "arm.compatible" },
  revisar: { clase: "is-warn", Icono: FaTriangleExclamation, key: "arm.aRevisar" },
  incompatible: {
    clase: "is-error",
    Icono: FaCircleXmark,
    key: "arm.conErrores",
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
  motivo: motivoMotor = "",
  elegido = false,
  atenuado = false,
  onElegir,
  onQuitar,
}) {
  const [imgError, setImgError] = useState(false);
  const idioma = useIdiomaStore((s) => s.idioma);
  const motivo = traducirMensaje(motivoMotor, idioma);
  const sello = INSIGNIA[estado] ?? INSIGNIA.compatible;
  const selloTexto = t(idioma, sello.key);
  const { Icono } = sello;

  const tieneOferta = Number(producto.descuento_porcentaje ?? 0) > 0;
  const descuento = Math.round(Number(producto.descuento_porcentaje ?? 0));
  const precio = Number(producto.precio ?? 0);
  const final = precioFinal(producto);
  const hayStock = Number(producto.stock ?? 0) > 0;
  const imagen = producto.imagen || "";
  const nombre = producto.nombre || t(idioma, "card.producto");
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
        aria-label={`${t(idioma, "armres.compatibilidad")}: ${selloTexto}. ${motivo}`}
      >
        <Icono aria-hidden="true" />
        {selloTexto}
      </span>

      <div className="card-media is-compacta">
        <Link
          to={`/producto/${producto.id}`}
          className="card-media-link"
          aria-label={`${t(idioma, "card.ver")} ${nombre}`}
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
              aria-label={`${t(idioma, "card.sinImagen")} ${nombre}`}
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
          {marca} · {nombreCategoriaDb(producto.categoria, idioma)}
        </p>
      )}

      <div className="stock">
        {hayStock ? (
          <span className="stock-linea disponible">
            <span className="stock-dot" aria-hidden="true" /> {t(idioma, "card.disponible")}
          </span>
        ) : (
          <span className="stock-linea agotado">
            <span className="stock-dot" aria-hidden="true" /> {t(idioma, "card.sinStock")}
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
          aria-label={`${t(idioma, "armcard.quitar")} ${nombre}`}
        >
          <FaMinus aria-hidden="true" /> {t(idioma, "armcard.quitar")}
        </button>
      ) : (
        <button
          type="button"
          className="btn-carrito"
          disabled={!hayStock || atenuado}
          onClick={onElegir}
          title={
            atenuado
              ? motivo || t(idioma, "armcard.incompatible")
              : undefined
          }
          aria-label={
            atenuado
              ? `${nombre}: ${motivo}`
              : hayStock
                ? `${t(idioma, "armcard.elegir")} ${nombre}`
                : `${nombre} ${t(idioma, "card.sinStock")}`
          }
        >
          {!hayStock ? (
            t(idioma, "card.sinStock")
          ) : atenuado ? (
            <>
              <FaCircleXmark aria-hidden="true" /> {selloTexto}
            </>
          ) : (
            <>
              <FaPlus aria-hidden="true" /> {t(idioma, "armcard.elegir")}
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
