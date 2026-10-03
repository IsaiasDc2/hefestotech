import { useRef } from "react";
import { Link } from "react-router-dom";
import ProductCard from "./ProductCard";
import "./ProductCarousel.css";

function slugId(titulo) {
  return (
    "carrusel-" +
    String(titulo || "seccion")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );
}

export default function ProductCarousel({
  titulo,
  kicker = null,
  kickerNum = null,
  verTodo = "/productos",
  productos = [],
  agregarAlCarrito,
}) {
  const pista = useRef(null);

  const desplazar = (dir) => {
    const el = pista.current;
    if (!el) return;
    const tarjeta = el.querySelector(":scope > *");
    const paso = tarjeta ? tarjeta.offsetWidth + 18 : 300;
    el.scrollBy({ left: dir * paso * 2, behavior: "smooth" });
  };

  if (!productos.length) return null;

  const tituloId = slugId(titulo);
  const editorial = kicker != null || kickerNum != null;

  return (
    <section className="carrusel" aria-labelledby={tituloId}>
      <div className="seccion-head editorial">
        <div className="seccion-titular">
          {editorial && (
            <p className="kicker">
              {kickerNum != null && (
                <span className="kicker-num" aria-hidden="true">
                  {kickerNum}
                </span>
              )}
              {kicker}
            </p>
          )}
          <h2 id={tituloId}>{titulo}</h2>
        </div>
        <div className="carrusel-acciones">
          <Link to={verTodo}>
            Ver todo <span aria-hidden="true">→</span>
          </Link>
          <button type="button" onClick={() => desplazar(-1)} aria-label="Ver anteriores">
            ‹
          </button>
          <button type="button" onClick={() => desplazar(1)} aria-label="Ver siguientes">
            ›
          </button>
        </div>
      </div>
      <div className="carrusel-pista" ref={pista}>
        {productos.map((p) => (
          <div key={p.id} className="carrusel-item">
            <ProductCard producto={p} agregarAlCarrito={agregarAlCarrito} />
          </div>
        ))}
      </div>
    </section>
  );
}
