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
    alt: "Gamer con triple monitor y luces de neón",
    encuadre: "cover",
    to: "/armar",
    etiqueta: "Armá tu PC",
  },
];

// Duracion de cada diapositiva. Unica fuente de verdad: se publica como
// --banner-ciclo y la barra de progreso (CSS) funciona como temporizador.
const INTERVALO_MS = 6000;
const UMBRAL_SWIPE = 48;

const reduceMovimiento = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

export default function Banner({ intervalo = INTERVALO_MS }) {
  const total = SLIDES.length;
  const [indice, setIndice] = useState(0);
  // Motivos de pausa independientes: ninguno pisa la intencion de otro.
  const [pausaUsuario, setPausaUsuario] = useState(reduceMovimiento);
  const [pausaPuntero, setPausaPuntero] = useState(false);
  const [pausaFoco, setPausaFoco] = useState(false);
  const [oculto, setOculto] = useState(
    () => typeof document !== "undefined" && document.hidden
  );
  const [enVista, setEnVista] = useState(true);
  const [montadas, setMontadas] = useState(() => new Set([0]));
  const refHero = useRef(null);
  const toque = useRef(null);
  const arranque = useRef(true);

  const pausado = pausaUsuario || pausaPuntero || pausaFoco || oculto || !enVista;
  // Con autoplay quieto un lector de pantalla anuncia los cambios manuales.
  const anunciar = pausaUsuario || pausaFoco;

  // Shrink 1 -> 0.97 + parallax <= 40px + barra que se desvanece,
  // solo transform/opacity via vars, rAF pasivo, pausado fuera de pantalla.
  useHeroVisible(refHero);
  useScrollLigado(refHero, (rect, _vh, el) => {
    const avance = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height)));
    el.style.setProperty("--hero-s", (1 - 0.03 * avance).toFixed(4));
    el.style.setProperty("--hero-y", `${(40 * avance).toFixed(1)}px`);
    el.style.setProperty("--hero-barra", (1 - avance).toFixed(3));
  });

  // Pausa del sistema: pestaña oculta o carrusel fuera de pantalla.
  useEffect(() => {
    const alCambiar = () => setOculto(document.hidden);
    document.addEventListener("visibilitychange", alCambiar);
    return () => document.removeEventListener("visibilitychange", alCambiar);
  }, []);

  useEffect(() => {
    const el = refHero.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setEnVista(e.isIntersecting), {
      threshold: 0.35,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Solo se monta la imagen de la diapositiva activa y la de sus vecinas
  // (estas ultimas tras un respiro, para no competir con la imagen LCP).
  // Las ya montadas se conservan: el fundido de salida no parpadea.
  useEffect(() => {
    const sumar = () =>
      setMontadas((prev) => {
        const sig = new Set(prev);
        [indice, indice - 1, indice + 1].forEach((i) => sig.add(envolver(i, total)));
        return sig.size === prev.size ? prev : sig;
      });
    if (arranque.current) {
      arranque.current = false;
      const t = setTimeout(sumar, 1200);
      return () => clearTimeout(t);
    }
    sumar();
  }, [indice, total]);

  const irA = useCallback((i) => setIndice(envolver(i, total)), [total]);
  const anterior = useCallback(() => setIndice((i) => envolver(i - 1, total)), [total]);
  const siguiente = useCallback(() => setIndice((i) => envolver(i + 1, total)), [total]);

  useEffect(() => {
    if (pausado || reduceMovimiento()) return;
    const t = setTimeout(siguiente, intervalo);
    return () => clearTimeout(t);
  }, [indice, pausado, intervalo, siguiente]);

  // Swipe horizontal. Mientras el dedo esta apoyado el autoplay espera, y
  // un gesto mayormente vertical (scroll) no cambia de diapositiva.
  const alTocar = (e) => {
    const t = e.touches[0];
    toque.current = { x: t.clientX, y: t.clientY };
    setPausaPuntero(true);
  };
  const alSoltar = (e) => {
    setPausaPuntero(false);
    const ini = toque.current;
    toque.current = null;
    if (!ini) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - ini.x;
    const dy = t.clientY - ini.y;
    if (Math.abs(dx) < UMBRAL_SWIPE || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) siguiente();
    else anterior();
  };
  const alCancelarToque = () => {
    toque.current = null;
    setPausaPuntero(false);
  };

  const alTeclear = (e) => {
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
  const alEntrarFoco = (e) => {
    if (esFocoTeclado(e.target)) setPausaFoco(true);
  };
  const alSalirFoco = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setPausaFoco(false);
  };

  return (
    <section
      ref={refHero}
      className="banner"
      style={{ "--banner-ciclo": `${intervalo}ms` }}
      data-pausado={pausado ? "true" : "false"}
      aria-roledescription="carrusel"
      aria-label="Promociones destacadas"
      onPointerEnter={(e) => e.pointerType === "mouse" && setPausaPuntero(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setPausaPuntero(false)}
      onFocus={alEntrarFoco}
      onBlur={alSalirFoco}
      onTouchStart={alTocar}
      onTouchEnd={alSoltar}
      onTouchCancel={alCancelarToque}
      onKeyDown={alTeclear}
    >
      <div className="banner-pista" aria-live={anunciar ? "polite" : "off"}>
        {SLIDES.map((s, i) => {
          const activo = i === indice;
          const esContain = s.encuadre === "contain";
          const prioridad = i === 0 ? "high" : "low";
          return (
            <div
              key={s.id}
              role="group"
              aria-roledescription="diapositiva"
              aria-label={`${i + 1} de ${total}`}
              aria-hidden={!activo}
              className={`banner-slide${activo ? " es-activa" : ""}${esContain ? " encuadre-contain" : ""}`}
            >
              {(activo || montadas.has(i)) && (
                <>
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
                      fetchPriority={prioridad}
                      decoding="async"
                      draggable="false"
                    />
                  </Link>
                  {esContain && (
                    <img
                      src={s.src}
                      alt=""
                      aria-hidden="true"
                      className="banner-fondo"
                      fetchPriority={prioridad}
                      decoding="async"
                      draggable="false"
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {total > 1 && (
        <>
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

        </>
      )}
    </section>
  );
}
