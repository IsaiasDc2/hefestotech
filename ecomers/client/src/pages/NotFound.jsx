import { Link } from "react-router-dom";
import Marca from "../components/brand/Marca";

function NotFound() {
  return (
    <div className="vacio pagina-404 anim-entrada">
      <span className="marca-centrada" aria-hidden="true">
        <Marca
          variante="lockup"
          ancho={220}
          alto={171}
          decorativa
        />
      </span>
      <p className="vacio-titulo">Nada por acá</p>
      <p className="vacio-texto">
        La página que buscás no existe o se movió.
      </p>
      <Link to="/" className="btn-primary">
        Volver al inicio
      </Link>
    </div>
  );
}

export default NotFound;
