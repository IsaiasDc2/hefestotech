import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import "./SectionHeader.css";

const sinRevelado = () =>
  typeof IntersectionObserver === "undefined" ||
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;


function SectionHeader({ num = null, kicker = null, titulo, id, verTodo = null, accionExtra = null }) {
  const ref = useRef(null);
  // Sin IntersectionObserver o con movimiento reducido arranca ya revelado.
  const [visible, setVisible] = useState(sinRevelado);
  const idioma = useIdiomaStore((s) => s.idioma);

  useEffect(() => {
    const el = ref.current;
    if (!el || sinRevelado()) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const muestraKicker = num != null || kicker != null;

  return (
    <div ref={ref} className={`ht-sh${visible ? " is-visible" : ""}`}>
      <div className="ht-sh__titular">
        {num != null && (
          <span className="ht-sh__insignia" aria-hidden="true">
            {num}
          </span>
        )}
        <div className="ht-sh__textos">
          {muestraKicker && kicker != null && <p className="ht-sh__kicker">{kicker}</p>}
          <h2 id={id} className="ht-sh__titulo">
            {titulo}
          </h2>
        </div>
      </div>
      <span className="ht-sh__linea" aria-hidden="true" />
      {(verTodo || accionExtra) && (
        <div className="ht-sh__acciones">
          {accionExtra}
          {verTodo && (
            <Link to={verTodo} className="ht-sh__vertodo">
              {t(idioma, "sec.verTodo")} <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default SectionHeader;
