import { FaTruckFast } from "react-icons/fa6";

// Camión de envío en movimiento: rebota sobre la ruta y deja líneas de
// velocidad. Decorativo (aria-hidden); el texto de al lado dice lo importante.
export default function CamionEnvio({ className = "" }) {
  return (
    <span className={`camion ${className}`.trim()} aria-hidden="true">
      <span className="camion-lineas">
        <i />
        <i />
        <i />
      </span>
      <FaTruckFast className="camion-icono" />
      <span className="camion-ruta" />
    </span>
  );
}
