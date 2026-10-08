import { useRef } from "react";
import { Link } from "react-router-dom";
import { FaChevronLeft, FaChevronRight, FaArrowRight, FaBoxOpen } from "react-icons/fa6";
import Marca from "../brand/Marca";
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
    const movimientoReducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * paso * 2, behavior: movimientoReducido ? "auto" : "smooth" });
  };

  const tituloId = slugId(titulo);
  const editorial = kicker != null || kickerNum != null;

  if (!productos.length) {
    return (
      <section className="carrusel" aria-labelledby={tituloId}>
        <div className="seccion-head editorial">
          <div className="seccion-titular">
            <h2 id={tituloId}>{titulo}</h2>
          </div>
          <div className="carrusel-acciones">
            <Link to={verTodo}>
              Ver todo <FaArrowRight aria-hidden="true" className="carrusel-flecha" />
            </Link>
          </div>
        </div>
        <div className="carrusel-vacio">
          <span className="marca-centrada" aria-hidden="true">
            <Marca variante="simbolo" ancho={40} alto={40} decorativa />
          </span>
          <span className="carrusel-vacio-icono" aria-hidden="true">
            <FaBoxOpen />
          </span>
          <p className="carrusel-vacio-titulo">Nada por acá todavía</p>
          <p className="carrusel-vacio-texto">Volvé en un rato o explorá el catálogo completo.</p>
        </div>
      </section>
    );
  }

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
            Ver todo <FaArrowRight aria-hidden="true" className="carrusel-flecha" />
          </Link>
          <button type="button" onClick={() => desplazar(-1)} aria-label="Ver productos anteriores">
            <FaChevronLeft aria-hidden="true" />
          </button>
          <button type="button" onClick={() => desplazar(1)} aria-label="Ver productos siguientes">
            <FaChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="carrusel-pista" ref={pista} role="region" aria-label={`${titulo}: lista desplazable`} tabIndex="0">
        {productos.map((p) => (
          <div key={p.id} className="carrusel-item">
            <ProductCard producto={p} agregarAlCarrito={agregarAlCarrito} />
          </div>
        ))}
      </div>
    </section>
  );
}
