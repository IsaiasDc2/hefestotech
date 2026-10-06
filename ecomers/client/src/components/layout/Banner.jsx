import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import "./Banner.css";

const SLIDES = [
  {
    id: "gpu",
    tema: "indigo",
    categoria: "Placa de video",
    eyebrow: "Nueva generación",
    titulo: "Todo lo que tu setup",
    acento: "necesita",
    texto: "Subí de nivel con placas de última generación. Jugá en ultra, sin tirones.",
    cta: "Ver placas de video",
    to: "/productos?categoria=placas-de-video",
    ctaSec: "Ver outlet",
    toSec: "/productos?categoria=ofertas",
    posicion: "right center",
    imagen:
      "https://ewqwmzwtrsjlrrnrotcm.supabase.co/storage/v1/object/public/productos/asi-luce-la-nueva-linea-de-placas-de-video.webp",
  },
  {
    id: "setup",
    tema: "celeste",
    categoria: "Monitor",
    eyebrow: "Armalo a tu medida",
    titulo: "Llevá tu setup",
    acento: "más lejos",
    texto: "Monitores, gabinetes y refrigeración para armar el rincón que soñás.",
    cta: "Explorar productos",
    to: "/productos",
    ctaSec: "Ver periféricos",
    toSec: "/productos?categoria=perifericos",
    posicion: "right center",
    imagen:
      "https://ewqwmzwtrsjlrrnrotcm.supabase.co/storage/v1/object/public/productos/neon-rog.webp",
  },
  {
    id: "peris",
    tema: "laton",
    categoria: "Periferico",
    eyebrow: "Precisión gamer",
    titulo: "Cada clic",
    acento: "cuenta",
    texto: "Teclados mecánicos y mouse de alta respuesta para competir de verdad.",
    cta: "Ver periféricos",
    to: "/productos?categoria=perifericos",
    ctaSec: "Explorar productos",
    toSec: "/productos",
    posicion: "right center",
    imagen:
      "https://ewqwmzwtrsjlrrnrotcm.supabase.co/storage/v1/object/public/productos/gaming-setup-pictures-j3k8ezoqihs4xtrm.webp",
  },
];

const CONFIANZA = [
  "Envío a todo el país",
  "6 cuotas sin interés",
  "Garantía oficial",
];

const AUTOPLAY_MS = 6000;

export default function Banner() {
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [fotos, setFotos] = useState({});
  const total = SLIDES.length;
  const timer = useRef(null);
  const touchX = useRef(null);

  useEffect(() => {
    supabase
      .from("productos")
      .select("categoria,imagen")
      .eq("destacado", true)
      .neq("imagen", "")
      .then(({ data }) => {
        const mapa = {};
        (data || []).forEach((p) => {
          if (!mapa[p.categoria]) mapa[p.categoria] = p.imagen;
        });
        setFotos(mapa);
      })
      .catch(() => {});
  }, []);

  const slides = SLIDES.map((s) => ({
    ...s,
    imagen: s.imagen || fotos[s.categoria] || "",
  }));

  const irA = useCallback((i) => setIndice(((i % total) + total) % total), [total]);
  const anterior = useCallback(() => irA(indice - 1), [indice, irA]);
  const siguiente = useCallback(() => irA(indice + 1), [indice, irA]);

  useEffect(() => {
    if (pausado || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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

  return (
    <section
      className="banner"
      aria-roledescription="carrusel"
      aria-label="Promociones destacadas"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="banner-pista"
        style={{ transform: `translateX(-${indice * 100}%)` }}
      >
        {slides.map((s, i) => {
          const activo = i === indice;
          return (
            <article
              key={s.id}
              className={`banner-slide tema-${s.tema}${activo ? " es-activa" : ""}`}
              aria-hidden={!activo}
              aria-roledescription="diapositiva"
              aria-label={`${i + 1} de ${total}`}
            >
              {s.imagen ? (
                <div className="banner-foto" aria-hidden="true">
                  <img
                    src={s.imagen}
                    alt=""
                    aria-hidden="true"
                    loading={i === 0 ? "eager" : "lazy"}
                    decoding="async"
                    style={{ objectPosition: s.posicion }}
                  />
                </div>
              ) : (
                <>
                  {s.id === "gpu" && (
                    <div className="banner-visual" aria-hidden="true">
                      <div className="gpu">
                        <span className="gpu-fan f1" />
                        <span className="gpu-fan f2" />
                        <span className="gpu-fan f3" />
                        <span className="gpu-logo">HTX</span>
                      </div>
                    </div>
                  )}
                  {s.id === "setup" && (
                    <div className="banner-visual" aria-hidden="true">
                      <div className="setup">
                        <span className="setup-torre" />
                        <span className="setup-monitor" />
                        <span className="setup-base" />
                      </div>
                    </div>
                  )}
                  {s.id === "peris" && (
                    <div className="banner-visual" aria-hidden="true">
                      <div className="teclado">
                        <span className="tec-fila" />
                        <span className="tec-fila" />
                        <span className="tec-fila" />
                        <span className="tec-fila corta" />
                        <span className="mouse" />
                      </div>
                    </div>
                  )}
                </>
              )}
              <div className="banner-velo" aria-hidden="true" />
              <motion.div
                className="banner-texto"
                key={activo ? `texto-${indice}` : `texto-idle-${s.id}`}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="banner-kicker">
                  <span className="banner-kicker-num">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="banner-kicker-sep" aria-hidden="true" />
                  {s.eyebrow}
                </p>
                <h1 className="banner-titulo">
                  {s.titulo} <span className="banner-acento">{s.acento}</span>
                </h1>
                <p className="banner-desc">{s.texto}</p>
                <div className="banner-acciones">
                  <Link
                    to={s.to}
                    className="banner-cta"
                    tabIndex={activo ? 0 : -1}
                  >
                    {s.cta}
                  </Link>
                  <Link
                    to={s.toSec}
                    className="banner-cta-sec"
                    tabIndex={activo ? 0 : -1}
                  >
                    {s.ctaSec}
                  </Link>
                </div>
                <ul className="banner-confianza" aria-label="Beneficios destacados">
                  {CONFIANZA.map((c) => (
                    <li key={c}>
                      <span className="banner-check" aria-hidden="true" />
                      {c}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </article>
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
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === indice}
              aria-label={`Ir a la diapositiva ${i + 1}`}
              className={i === indice ? "activo" : ""}
              onClick={() => irA(i)}
            >
              <span className="banner-progreso" key={`${s.id}-${i === indice ? indice : "x"}`} aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
