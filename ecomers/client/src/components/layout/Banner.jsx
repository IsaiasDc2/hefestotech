import { useCallback, useEffect, useRef, useState } from "react";
import "./Banner.css";

const BASE = import.meta.env.BASE_URL || "/";

const SLIDES = [
  {
    id: "hero-banner",
    src: `${BASE}banners/hero-banner.webp`,
    alt: "Teclado gamer AULA con retroiluminación RGB",
  },
  {
    id: "hero-neon",
    src: `${BASE}banners/hero-neon.webp`,
    alt: "Logo ROG neón sobre fondo oscuro",
  },
  {
    id: "hero-raro",
    src: `${BASE}banners/hero-raro.webp`,
    alt: "Gamer con auriculares y control en ambiente neón",
  },
];

const AUTOPLAY_MS = 5000;

export default function Banner() {
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const total = SLIDES.length;
  const timer = useRef(null);
  const touchX = useRef(null);

  const irA = useCallback((i) => setIndice(((i % total) + total) % total), [total]);
  const anterior = useCallback(() => irA(indice - 1), [indice, irA]);
  const siguiente = useCallback(() => irA(indice + 1), [indice, irA]);

  useEffect(() => {
    if (pausado) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    timer.current = setTimeout(() => irA(indice + 1), AUTOPLAY_MS);
    return () => clearTimeout(timer.current);
  }, [indice, pausado, irA]);

  const onTouchStart = (e) => {
    touchX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) {
      if (dx < 0) siguiente();
      else anterior();
    }
    touchX.current = null;
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      anterior();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      siguiente();
    }
  };

  return (
    <section
      className="banner"
      aria-roledescription="carrusel"
      aria-label="Promociones destacadas"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() =>
        setPausado(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      }
      onFocus={() => setPausado(true)}
      onBlur={() =>
        setPausado(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      }
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onKeyDown={onKeyDown}
    >
      <div
        className="banner-pista"
        style={{ transform: `translateX(-${indice * 100}%)` }}
      >
        {SLIDES.map((s, i) => {
          const activo = i === indice;
          return (
            <div
              key={s.id}
              className={`banner-slide${activo ? " es-activa" : ""}`}
              aria-hidden={!activo}
              aria-roledescription="diapositiva"
              aria-label={`${i + 1} de ${total}`}
            >
              <img
                src={s.src}
                alt={s.alt}
                className="banner-img"
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : undefined}
                decoding="async"
                draggable="false"
              />
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className="banner-flecha ant"
        onClick={anterior}
        aria-label="Diapositiva anterior"
      >
        ‹
      </button>
      <button
        type="button"
        className="banner-flecha sig"
        onClick={siguiente}
        aria-label="Diapositiva siguiente"
      >
        ›
      </button>

      <div className="banner-barra">
        <span className="banner-contador" aria-live="polite">
          {String(indice + 1).padStart(2, "0")}
          <span className="banner-contador-total"> / {String(total).padStart(2, "0")}</span>
        </span>
        <div className="banner-puntos" role="tablist" aria-label="Elegir diapositiva">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === indice}
              aria-label={`Ir a la diapositiva ${i + 1}`}
              className={i === indice ? "activo" : ""}
              onClick={() => irA(i)}
            >
              <span
                className="banner-progreso"
                key={`${s.id}-${i === indice ? indice : "x"}`}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          className="banner-pausa"
          onClick={() => setPausado((p) => !p)}
          aria-pressed={pausado}
          aria-label={pausado ? "Reanudar carrusel" : "Pausar carrusel"}
        >
          <span aria-hidden="true">{pausado ? "▶" : "❚❚"}</span>
        </button>
      </div>
    </section>
  );
}
