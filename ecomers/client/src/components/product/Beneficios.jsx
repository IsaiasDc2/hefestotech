import { Link } from "react-router";
import {
  FaCircleCheck,
  FaCircleXmark,
  FaShieldHalved,
  FaStore,
  FaTriangleExclamation,
  FaTruckFast,
} from "react-icons/fa6";
import useIdiomaStore, { t, tp } from "../../store/idiomaStore";
import { GARANTIA_MESES, UMBRAL_ENVIO_GRATIS } from "../../constants/politicas";
import { formatearPesos } from "../../utils/dinero";
import "./PanelPrecio.css";

/** Lo que se lleva el cliente: stock, garantía, envíos y retiro. */
function Beneficios({ stock = 0, ultimasUnidades = 3, envioGratis = false }) {
  const idioma = useIdiomaStore((s) => s.idioma);
  const hayStock = stock > 0;

  return (
    <ul className="bn-lista">
      {hayStock ? (
        stock <= ultimasUnidades ? (
          <li className="bn-item bn-item--aviso">
            <FaTriangleExclamation aria-hidden="true" />
            <span>
              {t(idioma, "pd.ultimas")} ({stock})
            </span>
          </li>
        ) : (
          <li className="bn-item bn-item--ok">
            <FaCircleCheck aria-hidden="true" />
            <span>{t(idioma, "pd.disponible")}</span>
          </li>
        )
      ) : (
        <li className="bn-item bn-item--sin">
          <FaCircleXmark aria-hidden="true" />
          <span>{t(idioma, "pd.sinStock")}</span>
        </li>
      )}
      <li className="bn-item">
        <FaShieldHalved aria-hidden="true" />
        <span>
          {tp(idioma, "pp.garantia", { meses: GARANTIA_MESES })}{" "}
          <Link to="/reclamo" className="bn-enlace">
            {t(idioma, "pp.comoReclamar")}
          </Link>
        </span>
      </li>
      <li className="bn-item">
        <FaTruckFast aria-hidden="true" />
        <span>
          {t(idioma, "pp.envios")}
          <span className="bn-sub">
            {" · "}
            {envioGratis
              ? t(idioma, "pd.envio")
              : tp(idioma, "pp.enviosDesde", { monto: formatearPesos(UMBRAL_ENVIO_GRATIS) })}
          </span>
        </span>
      </li>
      <li className="bn-item">
        <FaStore aria-hidden="true" />
        <span>{t(idioma, "pp.retiro")}</span>
      </li>
    </ul>
  );
}

export default Beneficios;
