import { useState } from "react";
import { Link } from "react-router";
import { FaCartPlus, FaCheck, FaCube } from "react-icons/fa6";
import useIdiomaStore, { t } from "../store/idiomaStore";
import { formatearPesos } from "../utils/dinero";
import { comprable } from "./conversacion";

const BASE = import.meta.env.BASE_URL || "/";

function urlImagen(imagen) {
  if (!imagen) return "";
  return /^https?:\/\//.test(imagen) ? imagen : `${BASE}${imagen}`;
}

/** Tarjeta de producto del chat: todos los datos vienen de la base, nunca del texto del modelo. */
function TarjetaChat({ tarjeta, alAgregar, alNavegar }) {
  const idioma = useIdiomaStore((s) => s.idioma);
  const [agregado, setAgregado] = useState(false);
  const [sinImagen, setSinImagen] = useState(!tarjeta.imagen);
  const sePuede = comprable(tarjeta);
  const conOferta = Number(tarjeta.precio) < Number(tarjeta.precio_lista);

  const agregar = () => {
    alAgregar(tarjeta);
    setAgregado(true);
  };

  return (
    <article className="asistente-tarjeta" aria-label={tarjeta.nombre}>
      <div className="asistente-tarjeta-img" aria-hidden="true">
        {sinImagen ? (
          <FaCube />
        ) : (
          <img src={urlImagen(tarjeta.imagen)} alt="" loading="lazy" decoding="async" onError={() => setSinImagen(true)} />
        )}
      </div>
      <div className="asistente-tarjeta-info">
        <Link to={tarjeta.url} className="asistente-tarjeta-nombre" onClick={alNavegar}>
          {tarjeta.nombre}
        </Link>
        <p className="asistente-tarjeta-precio">
          {tarjeta.precio_a_confirmar ? (
            t(idioma, "as.aConfirmar")
          ) : (
            <>
              <strong>{formatearPesos(tarjeta.precio)}</strong>
              {conOferta && <s>{formatearPesos(tarjeta.precio_lista)}</s>}
            </>
          )}
        </p>
        <p className={`asistente-tarjeta-stock${tarjeta.stock > 0 ? "" : " es-sin"}`}>
          {tarjeta.stock > 0 ? `${tarjeta.stock} ${t(idioma, "as.enStock")}` : t(idioma, "as.sinStock")}
        </p>
      </div>
      <button
        type="button"
        className="asistente-tarjeta-agregar"
        onClick={agregar}
        disabled={!sePuede || agregado}
        aria-label={`${agregado ? t(idioma, "as.agregado") : t(idioma, "as.agregar")}: ${tarjeta.nombre}`}
      >
        {agregado ? <FaCheck aria-hidden="true" /> : <FaCartPlus aria-hidden="true" />}
        <span>{agregado ? t(idioma, "as.agregado") : t(idioma, "as.agregar")}</span>
      </button>
    </article>
  );
}

export default TarjetaChat;
