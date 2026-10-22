import { Link } from "react-router";
import Marca from "../components/brand/Marca";
import useIdiomaStore, { t } from "../store/idiomaStore";

function NotFound() {
  const idioma = useIdiomaStore((s) => s.idioma);
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
      <h1 className="vacio-titulo">{t(idioma, "nf.titulo")}</h1>
      <p className="vacio-texto">
        {t(idioma, "nf.texto")}
      </p>
      <Link to="/" className="btn-primary">
        {t(idioma, "nf.volver")}
      </Link>
    </div>
  );
}

export default NotFound;
