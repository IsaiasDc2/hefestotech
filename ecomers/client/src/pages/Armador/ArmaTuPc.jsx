import Armador from "../../components/armador/Armador";
import "./ArmaTuPc.css";

function ArmaTuPc() {
  return (
    <div className="armador-page">
      <header className="armador-hero">
        <p className="armador-hero__kicker">Armador de PC</p>
        <h1 className="armador-hero__titulo">Armá tu PC pieza por pieza</h1>
        <p className="armador-hero__sub">
          Elegí procesador, mother, memoria y el resto. Validamos la compatibilidad
          en tiempo real y te avisamos antes de que gastes de más.
        </p>
      </header>
      <Armador />
    </div>
  );
}

export default ArmaTuPc;
