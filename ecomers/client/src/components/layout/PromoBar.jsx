import { useEffect, useState } from "react";
import {
  FaCreditCard,
  FaTags,
  FaTruckFast,
  FaStore,
} from "react-icons/fa6";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import "./PromoBar.css";

const ROTACION_MS = 5000;

export default function PromoBar() {
  const idioma = useIdiomaStore((s) => s.idioma);
  const promos = [
    { titulo: t(idioma, "promo.cuotasT"), texto: t(idioma, "promo.cuotasS"), icono: <FaCreditCard aria-hidden="true" /> },
    { titulo: t(idioma, "promo.offT"), texto: t(idioma, "promo.offS"), icono: <FaTags aria-hidden="true" />, oferta: true },
    { titulo: t(idioma, "promo.envioT"), texto: t(idioma, "promo.envioS"), icono: <FaTruckFast aria-hidden="true" /> },
    { titulo: t(idioma, "promo.retiroT"), texto: t(idioma, "promo.retiroS"), icono: <FaStore aria-hidden="true" /> },
  ];
  const [activo, setActivo] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [tabVisible, setTabVisible] = useState(
    () => typeof document === "undefined" || !document.hidden
  );

  useEffect(() => {
    const alVisibilidad = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", alVisibilidad);
    return () => document.removeEventListener("visibilitychange", alVisibilidad);
  }, []);

  useEffect(() => {
    if (pausado || !tabVisible || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setTimeout(() => setActivo((a) => (a + 1) % promos.length), ROTACION_MS);
    return () => clearTimeout(timer);
  }, [activo, pausado, tabVisible, promos.length]);

  return (
    <section
      className="promobar"
      aria-label={t(idioma, "promo.aria")}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
    >
      <div className="promobar-inner" aria-live="polite">
        {promos.map((p, i) => (
          <div key={p.titulo} className={`promo-item${i === activo ? " es-activo" : ""}${p.oferta ? " es-oferta" : ""}`}>
            <span className="promo-icono" aria-hidden="true">{p.icono}</span>
            <span className="promo-texto">
              <strong>{p.titulo}</strong>
              <span>{p.texto}</span>
            </span>
          </div>
        ))}
        <span className="promobar-contador" aria-hidden="true">
          {activo + 1}/{promos.length}
        </span>
      </div>
    </section>
  );
}
