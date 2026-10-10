import { useCallback, useEffect, useRef, useState } from "react";
import { useHeroVisible, useScrollLigado } from "../../hooks/useMotion";
import "./Banner.css";

const BASE = import.meta.env.BASE_URL || "/";

const SLIDES = [
  {
    id: "hero-banner",
    src: `${BASE}banners/hero-banner.webp`,
    alt: "Teclado gamer AULA con retroiluminación RGB",
    // 1961x544 con texto incrustado a la derecha: contain + fondo
    // difuminado para no cortar el mensaje ni el producto.
    encuadre: "contain",
  },
  {
    id: "hero-neon",
    src: `${BASE}banners/hero-neon.webp`,
    alt: "Logo ROG neón sobre fondo oscuro",
    encuadre: "cover",
  },
  {
    id: "hero-raro",
    src: `${BASE}banners/hero-raro.webp`,
    alt: "Gamer con auriculares y control en ambiente neón",
    // 863x1248 vertical: contain + fondo difuminado; en cover se
    // perderia cabeza y monitor en el recorte 21/9.
    encuadre: "contain",
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
  const refHero = useRef(null);
  // Shrink 1 -> 0.97 + parallax <= 40px + barra que se desvanece,
  // solo transform/opacity via vars, rAF pasivo, pausado fuera de pantalla.
  useHeroVisible(refHero);
  useScrollLigado(refHero, (rect, _vh, el) => {
    const avance = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height)));
    el.style.setProperty("--hero-s", (1 - 0.03 * avance).toFixed(4));
    el.style.setProperty("--hero-y", `${(40 * avance).toFixed(1)}px`);
    el.style.setProperty("--hero-barra", (1 - avance).toFixed(3));
  });
  // Pausa del sistema (pestaña oculta / ventana sin foco). Se combina
  // con `pausado` sin pisar la intencion del usuario (play/pausa).
  const [oculto, setOculto] = useState(
    () => typeof document !== "undefined" && document.hidden
  );
  const efectivoPausado = pausado || oculto;

  const coincideReduceMovimiento = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const alVisibilidad = () => setOculto(document.hidden);
    const alBlur = () => setOculto(true);
    const alFoco = () => setOculto(document.hidden);
    document.addEventListener("visibilitychange", alVisibilidad);
    window.addEventListener("blur", alBlur);
    window.addEventListener("focus", alFoco);
    return () => {
      document.removeEventListener("visibilitychange", alVisibilidad);
      window.removeEventListener("blur", alBlur);
      window.removeEventListener("focus", alFoco);
    };
  }, []);

  // Precarga la siguiente diapositiva (la primera ya es prioritaria
  // con eager + fetchPriority high en el <img>).
  useEffect(() => {
    const href = SLIDES[(indice + 1) % total].src;
    if (document.querySelector(`link[rel="preload"][href="${href}"]`)) return;
    const enlace = document.createElement("link");
    enlace.rel = "preload";
    enlace.as = "image";
    enlace.href = href;
    enlace.fetchPriority = "low";
    document.head.appendChild(enlace);
    return () => {
      enlace.remove();
    };
  }, [indice, total]);

  const irA = useCallback((i) => setIndice(((i % total) + total) % total), [total]);
  const anterior = useCallback(() => irA(indice - 1), [indice, irA]);
  const siguiente = useCallback(() => irA(indice + 1), [indice, irA]);

  useEffect(() => {
    if (efectivoPausado) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    timer.current = setTimeout(() => irA(indice + 1), AUTOPLAY_MS);
    return () => clearTimeout(timer.current);
  }, [indice, efectivoPausado, irA]);

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

  // Pausa por foco solo al entrar/salir de verdad del carrusel
  // (relatedTarget evita parpadeos al tabular entre controles internos).
  const pausarAlEntrar = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setPausado(true);
  };
  const reanudarAlSalir = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget))
      setPausado(coincideReduceMovimiento());
  };

  return (
    <section
      ref={refHero}
      className="banner"
      data-pausado={efectivoPausado ? "true" : "false"}
      aria-roledescription="carrusel"
      aria-label="Promociones destacadas"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(coincideReduceMovimiento())}
      onFocus={pausarAlEntrar}
      onBlur={reanudarAlSalir}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onKeyDown={onKeyDown}
    >
      <div className="banner-pista">
        {SLIDES.map((s, i) => {
          const activo = i === indice;
          const esContain = s.encuadre === "contain";
          return (
            <div
              key={s.id}
              className={`banner-slide${activo ? " es-activa" : ""}${esContain ? " encuadre-contain" : ""}`}
              aria-hidden={!activo}
              aria-roledescription="diapositiva"
              aria-label={`${i + 1} de ${total}`}
            >
              {esContain && (
                <div
                  className="banner-fondo"
                  aria-hidden="true"
                  style={{ backgroundImage: `url("${s.src}")` }}
                />
              )}
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
