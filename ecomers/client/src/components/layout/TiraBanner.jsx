import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useScrollLigado } from "../../hooks/useMotion";
import "./TiraBanner.css";

// Parallax: desplazamiento maximo (fraccion de la altura del bloque) y
// escala de compensacion. Con 1.05 hay 2.5% de margen por lado y el
// desplazamiento maximo (1.6%) nunca deja ver bordes.
const PARALLAX_MAX = 0.016;
const PARALLAX_ESCALA = 1.05;

/**
 * Tira publicitaria de ancho de contenedor.
 *
 * Obligatorias: src, alt.
 * Recomendadas: ancho/alto (medidas reales de la imagen) para reservar el
 * espacio antes de que cargue y evitar saltos de layout (CLS).
 * Opcionales: srcSet/sizes (imagenes responsive), to + etiqueta (link),
 * prioritario (true si esta sobre el pliegue: carga eager + alta prioridad).
 */
export default function TiraBanner({
  src,
  srcSet,
  sizes,
  alt,
  ancho,
  alto,
  to = null,
  etiqueta = null,
  prioritario = false,
}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  // Solo escribe variables CSS (nada de tocar className: React lo pisaria).
  useScrollLigado(ref, (rect, vh, el) => {
    const centro = (rect.top + rect.height / 2 - vh / 2) / vh;
    const k = Math.max(-1, Math.min(1, centro * 2));
    el.style.setProperty("--tira-y", `${(k * rect.height * PARALLAX_MAX).toFixed(1)}px`);
    el.style.setProperty("--tira-escala", PARALLAX_ESCALA);
  });

  // Revelado de entrada una sola vez.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const imagen = (
    <img
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? sizes || "100vw" : undefined}
      alt={alt}
      width={ancho}
      height={alto}
      loading={prioritario ? "eager" : "lazy"}
      fetchPriority={prioritario ? "high" : undefined}
      decoding="async"
      draggable="false"
    />
  );

  return (
    <div ref={ref} className={`tira-banner${visible ? " es-visible" : ""}`}>
      {to ? (
        <Link
          to={to}
          className="tira-banner__marco tira-banner__enlace"
          aria-label={etiqueta ? `${etiqueta}: ${alt}` : undefined}
        >
          {imagen}
        </Link>
      ) : (
        <div className="tira-banner__marco">{imagen}</div>
      )}
    </div>
  );
}
