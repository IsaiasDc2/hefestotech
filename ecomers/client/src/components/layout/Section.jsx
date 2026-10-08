import "./Section.css";

/**
 * Seccion con tono fijo (dark/light), independiente del tema global.
 * Usar para el mapa de alternancia documentado en DESIGN.md:
 * oscuro = impacto/confianza/cierre, claro = listados/exploracion.
 */
function Section({ tono = "dark", labelledBy, className = "", children }) {
  const cls = `section section--${tono === "light" ? "light" : "dark"}${className ? ` ${className}` : ""}`;
  return (
    <section className={cls} aria-labelledby={labelledBy}>
      <div className="section__inner">{children}</div>
    </section>
  );
}

export default Section;
