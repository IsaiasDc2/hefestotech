import { Link } from "react-router";
import { FaArrowRight } from "react-icons/fa6";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import "./SectionHeader.css";

function SectionHeader({ kicker = null, titulo, id, verTodo = null, accionExtra = null }) {
  const idioma = useIdiomaStore((s) => s.idioma);

  return (
    <div className="ht-sh">
      <div className="ht-sh__textos">
        {kicker && <p className="ht-sh__kicker">{kicker}</p>}
        <h2 id={id} className="ht-sh__titulo">
          {titulo}
        </h2>
      </div>
      {(verTodo || accionExtra) && (
        <div className="ht-sh__acciones">
          {verTodo && (
            <Link to={verTodo} className="ht-sh__vertodo">
              {t(idioma, "sec.verTodo")} <FaArrowRight aria-hidden="true" />
            </Link>
          )}
          {accionExtra}
        </div>
      )}
    </div>
  );
}

export default SectionHeader;
