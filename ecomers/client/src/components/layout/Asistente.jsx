import { useState } from "react";
import { FaRobot, FaXmark } from "react-icons/fa6";
import "./Asistente.css";

function Asistente() {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="asistente">
      {abierto && (
        <div className="asistente-panel card" role="dialog" aria-label="Asistente IA">
          <div className="asistente-head">
            <span className="asistente-avatar" aria-hidden="true">
              <FaRobot />
            </span>
            <div>
              <strong>Asistente Hefesto</strong>
              <span className="asistente-estado">
                <span className="asistente-dot" aria-hidden="true" />
                En línea (demo)
              </span>
            </div>
            <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar asistente">
              <FaXmark aria-hidden="true" />
            </button>
          </div>
          <p className="texto-mutado">Hola, ¿en qué te ayudo con tu setup?</p>
          <div className="asistente-fake">
            <span>Escribí tu consulta…</span>
            <span className="asistente-enviar" aria-hidden="true">→</span>
          </div>
          <p className="asistente-aviso">Vista previa sin función</p>
        </div>
      )}
      <button
        type="button"
        className={`asistente-bola${abierto ? " es-abierto" : ""}`}
        onClick={() => setAbierto((v) => !v)}
        aria-label={abierto ? "Cerrar asistente IA" : "Abrir asistente IA"}
        aria-expanded={abierto}
      >
        {abierto ? <FaXmark aria-hidden="true" /> : <FaRobot aria-hidden="true" />}
        {!abierto && <span className="asistente-punto" aria-hidden="true" />}
      </button>
    </div>
  );
}

export default Asistente;
