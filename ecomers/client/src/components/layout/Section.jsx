import "./Section.css";


function Section({ tono = "dark", labelledBy, className = "", children }) {
  const cls = `section section--${tono === "light" ? "light" : "dark"}${className ? ` ${className}` : ""}`;
  return (
    <section className={cls} aria-labelledby={labelledBy}>
      <div className="section__inner">{children}</div>
    </section>
  );
}

export default Section;
