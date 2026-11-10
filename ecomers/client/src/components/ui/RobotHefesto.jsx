import Marca from "../brand/Marca.jsx";

// Mini HefestoTech: robotito con el logo de cara. Aparece con un salto al
// abrir el asistente, saluda con la mano y queda flotando. Decorativo.
export default function RobotHefesto({ className = "", saludo = "", despedida = "", ...resto }) {
  return (
    <span className={`robot ${className}`.trim()} aria-hidden="true" {...resto}>
      {saludo && <span className="robot-globo robot-globo--hola">{saludo}</span>}
      {despedida && <span className="robot-globo robot-globo--chau">{despedida}</span>}
      <span className="robot-cuerpo-entero">
        <span className="robot-antena">
          <i />
        </span>
        <span className="robot-cabeza">
          <Marca variante="simbolo" ancho={34} alto={34} decorativa />
          <span className="robot-oreja robot-oreja--izq" />
          <span className="robot-oreja robot-oreja--der" />
        </span>
        <span className="robot-torso">
          <span className="robot-brazo robot-brazo--izq" />
          <span className="robot-pecho" />
          <span className="robot-brazo robot-brazo--der" />
        </span>
        <span className="robot-propulsor" />
      </span>
      <span className="robot-sombra" />
    </span>
  );
}
