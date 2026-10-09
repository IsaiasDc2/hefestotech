import { useEffect, useRef, useState } from "react";
import { FaChevronLeft, FaChevronRight, FaBoxOpen } from "react-icons/fa6";
import Marca from "../brand/Marca";
import SectionHeader from "../ui/SectionHeader";
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
  verTodo = "/productos",
  productos = [],
  agregarAlCarrito,
}) {
  const pista = useRef(null);
  const seccion = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = seccion.current;
    if (!el) return;
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
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
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const desplazar = (dir) => {
    const el = pista.current;
    if (!el) return;
    const tarjeta = el.querySelector(":scope > *");
    const paso = tarjeta ? tarjeta.offsetWidth + 18 : 300;
    const movimientoReducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * paso * 2, behavior: movimientoReducido ? "auto" : "smooth" });
  };

  const tituloId = slugId(titulo);

  if (!productos.length) {
    return (
      <section className="carrusel" aria-labelledby={tituloId}>
        <SectionHeader titulo={titulo} id={tituloId} verTodo={verTodo} />
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
    <section ref={seccion} className={`carrusel${visible ? " is-visible" : ""}`} aria-labelledby={tituloId}>
      <SectionHeader
        kicker={kicker}
        titulo={titulo}
        id={tituloId}
        verTodo={verTodo}
        accionExtra={
          <>
            <button type="button" onClick={() => desplazar(-1)} aria-label="Ver productos anteriores">
              <FaChevronLeft aria-hidden="true" />
            </button>
            <button type="button" onClick={() => desplazar(1)} aria-label="Ver productos siguientes">
              <FaChevronRight aria-hidden="true" />
            </button>
          </>
        }
      />
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
