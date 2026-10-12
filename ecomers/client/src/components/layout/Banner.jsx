import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
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
    to: "/productos?categoria=perifericos",
    etiqueta: "Ver periféricos",
  },
  {
    id: "hero-neon",
    src: `${BASE}banners/hero-neon.webp`,
    alt: "Logo ROG neón sobre fondo oscuro",
    encuadre: "cover",
    to: "/productos?q=ASUS",
    etiqueta: "Ver productos ASUS",
  },
  {
    id: "hero-raro",
    src: `${BASE}banners/hero-raro.webp`,
    alt: "Gamer con auriculares y control en ambiente neón",
    // 863x1248 vertical: contain + fondo difuminado; en cover se
    // perderia cabeza y monitor en el recorte 21/9.
    encuadre: "contain",
    to: "/armar",
    etiqueta: "Armá tu PC",
  },
];

const AUTOPLAY_MS = 6000;
const UMBRAL_SWIPE = 40;

const envolver = (i, total) => ((i % total) + total) % total;

// :focus-visible separa teclado de clic. Sin soporte se asume teclado.
const esFocoTeclado = (el) => {
  try {
    return el.matches(":focus-visible");
  } catch {
    return true;
  }
};

const Chevron = ({ izquierda = false }) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d={izquierda ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
  </svg>
);

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
  const [montadas, setMontadas] = useState(() => new Set([0]));
  const [enVista, setEnVista] = useState(true);
  // Shrink 1 -> 0.97 + parallax <= 40px + barra que se desvanece,
  // solo transform/opacity via vars, rAF pasivo, pausado fuera de pantalla.
  useHeroVisible(refHero);
  useScrollLigado(refHero, (rect, _vh, el) => {
    const avance = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height)));
    el.style.setProperty("--hero-s", (1 - 0.03 * avance).toFixed(4));
    el.style.setProperty("--hero-y", `${(40 * avance).toFixed(1)}px`);
    el.style.setProperty("--hero-barra", (1 - avance).toFixed(3));
  });
  // Pausa del sistema (pestaña oculta / ventana sin foco / fuera de pantalla).
  // Se combina con `pausado` sin pisar la intencion del usuario.
  const [oculto, setOculto] = useState(
    () => typeof document !== "undefined" && document.hidden
  );
  const efectivoPausado = pausado || oculto || !enVista;

  const coincideReduceMovimiento = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const el = refHero.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setEnVista(e.isIntersecting), {
      threshold: 0.2,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Solo se monta la imagen activa y sus vecinas (las vecinas tras un
  // respiro, para no competir con la imagen LCP). Las ya montadas se
  // conservan: el fundido de salida no parpadea.
  useEffect(() => {
    const t = setTimeout(() => {
      setMontadas((prev) => {
        const sig = new Set(prev);
        [indice, indice - 1, indice + 1].forEach((i) => sig.add(envolver(i, total)));
        return sig.size === prev.size ? prev : sig;
      });
    }, 1200);
    return () => clearTimeout(t);
  }, [indice, total]);

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
    if (Math.abs(dx) > UMBRAL_SWIPE) {
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

  // Pausa por foco solo con foco de teclado y solo al entrar/salir de verdad
  // del carrusel. Un clic con mouse no deja el autoplay detenido.
  const pausarAlEntrar = (e) => {
    if (esFocoTeclado(e.target)) setPausado(true);
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
              role="group"
              className={`banner-slide${activo ? " es-activa" : ""}${esContain ? " encuadre-contain" : ""}`}
              aria-hidden={!activo}
              aria-roledescription="diapositiva"
              aria-label={`${i + 1} de ${total}`}
            >
              {(activo || montadas.has(i)) && (
                <>
              {esContain && (
                <div
                  className="banner-fondo"
                  aria-hidden="true"
                  style={{ backgroundImage: `url("${s.src}")` }}
                />
              )}
              <Link
                to={s.to}
                className="banner-slide-link"
                aria-label={`${s.etiqueta}: ${s.alt}`}
                tabIndex={activo ? 0 : -1}
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
              </Link>
                </>
              )}
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
        <Chevron izquierda />
      </button>
      <button
        type="button"
        className="banner-flecha sig"
        onClick={siguiente}
        aria-label="Diapositiva siguiente"
      >
        <Chevron />
      </button>

    </section>
  );
}
