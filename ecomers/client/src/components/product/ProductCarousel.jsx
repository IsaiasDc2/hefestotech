import { useRef } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";
import SectionHeader from "../ui/SectionHeader";
import ProductCard from "./ProductCard";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import "./ProductCarousel.css";

function slugId(titulo) {
  return (
    "carrusel-" +
    String(titulo || "seccion")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );
}

/** Fila horizontal con scroll-snap; sin productos no se muestra. */
export default function ProductCarousel({
  titulo,
  kicker = null,
  verTodo = "/productos",
  productos = [],
  agregarAlCarrito,
}) {
  const pista = useRef(null);
  const idioma = useIdiomaStore((s) => s.idioma);

  if (!productos.length) return null;

  const desplazar = (dir) => {
    const el = pista.current;
    if (!el) return;
    const movimientoReducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: movimientoReducido ? "auto" : "smooth" });
  };

  const tituloId = slugId(titulo);

  return (
    <section className="carrusel" aria-labelledby={tituloId}>
      <SectionHeader
        kicker={kicker}
        titulo={titulo}
        id={tituloId}
        verTodo={verTodo}
        accionExtra={
          <span className="carrusel-flechas">
            <button type="button" onClick={() => desplazar(-1)} aria-label={t(idioma, "carr.anteriores")}>
              <FaChevronLeft aria-hidden="true" />
            </button>
            <button type="button" onClick={() => desplazar(1)} aria-label={t(idioma, "carr.siguientes")}>
              <FaChevronRight aria-hidden="true" />
            </button>
          </span>
        }
      />
      <ul className="carrusel-pista" ref={pista} aria-label={`${titulo}: ${t(idioma, "carr.lista")}`}>
        {productos.map((p) => (
          <li key={p.id} className="carrusel-item">
            <ProductCard producto={p} agregarAlCarrito={agregarAlCarrito} />
          </li>
        ))}
      </ul>
    </section>
  );
}
