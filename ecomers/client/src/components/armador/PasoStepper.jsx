import { FaCheck, FaTriangleExclamation } from "react-icons/fa6";
import { IconoCategoria } from "./armadorUtils";
import "./PasoStepper.css";

const ETIQUETA_ESTADO = {
  completo: "completo",
  actual: "actual",
  vacio: "vacío",
  error: "con error",
};

function PasoStepper({ pasos, pasoActual, seleccion, onIrAPaso }) {
  return (
    <nav className="riel" aria-label="Pasos del armado">
      <ol>
        {pasos.map((paso, i) => {
          const esActual = paso.id === pasoActual;
          const elegido = seleccion?.[paso.id] ?? null;
          return (
            <li key={paso.id} className={`casilla casilla--${paso.estado}${esActual ? " is-actual" : ""}`}>
              <button
                type="button"
                className="casilla__btn"
                onClick={() => onIrAPaso(paso.id)}
                aria-current={esActual ? "step" : undefined}
                aria-label={`Paso ${i + 1}: ${paso.nombre}, ${ETIQUETA_ESTADO[paso.estado] ?? paso.estado}`}
              >
                <span className="casilla__icono" aria-hidden="true">
                  <IconoCategoria categoria={paso.id} />
                  {paso.estado === "completo" && (
                    <span className="casilla__check">
                      <FaCheck />
                    </span>
                  )}
                  {paso.estado === "error" && (
                    <span className="casilla__alerta">
                      <FaTriangleExclamation />
                    </span>
                  )}
                </span>
                <span className="casilla__texto">
                  <span className="casilla__nombre">{paso.nombre}</span>
                  <span className="casilla__elegido">
                    {elegido ? `${elegido.marca} · listo` : "Sin elegir"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default PasoStepper;
