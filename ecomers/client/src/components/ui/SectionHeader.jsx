import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./SectionHeader.css";

/**
 * Encabezado editorial unificado de seccion (El Arsenal).
 * Uso: <SectionHeader num="01" kicker="Explorar" titulo="..." id="home-x" verTodo="/productos" accionExtra={...} />
 * La seccion padre conserva aria-labelledby={id}; este componente pinta el h2 con ese id.
 */
function SectionHeader({ num = null, kicker = null, titulo, id, verTodo = null, accionExtra = null }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
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
              Ver todo <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default SectionHeader;
