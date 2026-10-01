import { useRef } from "react";
import { Link } from "react-router-dom";
import ProductCard from "./ProductCard";
import "./ProductCarousel.css";

export default function ProductCarousel({
  titulo,
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

  return (
    <section className="carrusel">
      <div className="seccion-head">
        <h2>{titulo}</h2>
        <div className="carrusel-acciones">
          <Link to={verTodo}>Ver todo →</Link>
          <button type="button" onClick={() => desplazar(-1)} aria-label="Anterior">
            ‹
          </button>
          <button type="button" onClick={() => desplazar(1)} aria-label="Siguiente">
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
