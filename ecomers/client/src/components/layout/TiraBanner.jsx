import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useScrollLigado } from "../../hooks/useMotion";
import "./TiraBanner.css";

export default function TiraBanner({ src, alt, to = null, etiqueta = null }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  // Parallax <= 2% de la altura (var --tira-y), rAF pasivo, solo en pantalla.
  useScrollLigado(ref, (rect, vh, el) => {
    const centro = (rect.top + rect.height / 2 - vh / 2) / vh;
    const k = Math.max(-1, Math.min(1, centro * 2));
    el.style.setProperty("--tira-y", `${(k * rect.height * 0.02).toFixed(1)}px`);
    el.classList.add("con-parallax");
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
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
    <img src={src} alt={alt} loading="lazy" decoding="async" draggable="false" />
  );

  return (
    <figure ref={ref} className={`tira-banner${visible ? " es-visible" : ""}`}>
      {to ? (
        <Link
          to={to}
          className="tira-banner__marco tira-banner__enlace"
          aria-label={etiqueta || alt}
        >
          {imagen}
        </Link>
      ) : (
        <span className="tira-banner__marco">{imagen}</span>
      )}
    </figure>
  );
}
