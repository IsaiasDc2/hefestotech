import { FaTriangleExclamation, FaCircleXmark, FaArrowRight } from "react-icons/fa6";
import { nombreCategoria } from "../../data/armadorCatalogo";
import "./AlertaCompatibilidad.css";

function AlertaCompatibilidad({ issues, onVerPaso }) {
  if (!issues || issues.length === 0) return null;

  return (
    <div className="alertas" role="alert" aria-label="Avisos de compatibilidad">
      {issues.map((issue, i) => (
        <div key={`${issue.codigo}-${i}`} className={`alerta alerta--${issue.severidad}`}>
          <span className="alerta__icono" aria-hidden="true">
            {issue.severidad === "error" ? <FaCircleXmark /> : <FaTriangleExclamation />}
          </span>
          <div className="alerta__texto">
            <p className="alerta__mensaje">{issue.mensaje}</p>
            <p className="alerta__sugerencia">{issue.sugerencia}</p>
          </div>
          <button
            type="button"
            className="alerta__ver"
            onClick={() => onVerPaso(issue.categoria)}
          >
            Ver {nombreCategoria(issue.categoria).toLowerCase()} <FaArrowRight aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}

export default AlertaCompatibilidad;
