import { FaCheck, FaXmark, FaBan } from "react-icons/fa6";
import { IconoCategoria, specsClave, ahorro } from "./armadorUtils";
import { formatoARS } from "../../hooks/useNumeroAnimado";
import "./PiezaCard.css";

function PiezaCard({ pieza, indice, estadoBoton, evaluacion, onAccion }) {
  const sinStock = Number(pieza.stock ?? 0) <= 0;
  const stockBajo = !sinStock && Number(pieza.stock) <= 3;
  const incompatible = evaluacion && !evaluacion.compatible && estadoBoton !== "quitar";
  const motivo = incompatible ? evaluacion.motivos[0]?.mensaje : null;
  const deshabilitado = sinStock || incompatible;
  const desc = ahorro(pieza);

  const etiquetaBoton =
    estadoBoton === "quitar" ? "Quitar" : estadoBoton === "cambiar" ? "Cambiar" : "Agregar";
  const accion = estadoBoton === "quitar" ? "Quitar" : estadoBoton === "cambiar" ? "Cambiar" : "Agregar";

  return (
    <article
      className={`pieza-card${incompatible ? " is-incompatible" : ""}${estadoBoton === "quitar" ? " is-seleccionada" : ""}`}
      style={{ "--i": Math.min(indice, 8) }}
      aria-label={pieza.nombre}
    >
      {desc && (
        <span className="pieza-card__descuento" aria-label={`Descuento del ${desc.porcentaje} por ciento`}>
          −{desc.porcentaje}%
        </span>
      )}

      <div className="pieza-card__cuerpo">
        <div className="pieza-card__media" aria-hidden="true">
          <IconoCategoria categoria={pieza.categoria} className="pieza-card__icono" />
        </div>

        <div className="pieza-card__info">
          <p className="pieza-card__marca">{pieza.marca}</p>
          <h3 className="pieza-card__nombre">{pieza.nombre}</h3>
          <ul className="pieza-card__specs">
            {specsClave(pieza).map((spec) => (
              <li key={spec}>{spec}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="pieza-card__pie">
        <div className="pieza-card__precios">
          {desc && (
            <span className="pieza-card__precio-ant">{formatoARS(pieza.precioAnterior)}</span>
          )}
          <span className="pieza-card__precio">{formatoARS(pieza.precio)}</span>
        </div>
        {sinStock ? (
          <span className="pieza-card__estado estado--agotado">
            <FaBan aria-hidden="true" /> Sin stock
          </span>
        ) : stockBajo ? (
          <span className="pieza-card__estado estado--bajo">¡Quedan {pieza.stock}!</span>
        ) : incompatible ? (
          <span className="pieza-card__estado estado--no" title={motivo}>
            <FaXmark aria-hidden="true" /> No compatible
          </span>
        ) : (
          <span className="pieza-card__estado estado--ok">
            <FaCheck aria-hidden="true" /> Compatible
          </span>
        )}
      </div>

      {motivo && (
        <p className="pieza-card__motivo" role="note">
          {motivo}
        </p>
      )}

      <button
        type="button"
        className={`pieza-card__btn btn--${estadoBoton}`}
        disabled={deshabilitado}
        title={deshabilitado && motivo ? motivo : undefined}
        aria-label={`${accion} ${pieza.nombre} ${estadoBoton === "quitar" ? "del" : "al"} armado`}
        onClick={(e) => onAccion(pieza, e)}
      >
        {etiquetaBoton}
      </button>
    </article>
  );
}

export default PiezaCard;
