import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./TiraBanner.css";

export default function TiraBanner({ src, alt, to = null, etiqueta = null }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

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
          className="tira-banner__enlace"
          aria-label={etiqueta || alt}
        >
          {imagen}
        </Link>
      ) : (
        imagen
      )}
    </figure>
  );
}
