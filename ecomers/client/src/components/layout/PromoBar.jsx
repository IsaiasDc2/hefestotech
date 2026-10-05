import { useEffect, useState } from "react";
import {
  FaCreditCard,
  FaTags,
  FaTruckFast,
  FaStore,
} from "react-icons/fa6";
import "./PromoBar.css";

const PROMOS = [
  { titulo: "6 cuotas sin interés", texto: "Con todas las tarjetas", icono: <FaCreditCard aria-hidden="true" /> },
  { titulo: "10% off por transferencia", texto: "Acreditación inmediata", icono: <FaTags aria-hidden="true" /> },
  { titulo: "Envío gratis", texto: "En compras desde $99.999", icono: <FaTruckFast aria-hidden="true" /> },
  { titulo: "Retiro gratis", texto: "En nuestra tienda de Salta", icono: <FaStore aria-hidden="true" /> },
];

const ROTACION_MS = 5000;

export default function PromoBar() {
  const [activo, setActivo] = useState(0);
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    if (pausado || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setActivo((a) => (a + 1) % PROMOS.length), ROTACION_MS);
    return () => clearTimeout(t);
  }, [activo, pausado]);

  return (
    <section
      className="promobar"
      aria-label="Promociones y formas de pago"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
    >
      <div className="promobar-inner" aria-live="polite">
        {PROMOS.map((p, i) => (
          <div key={p.titulo} className={`promo-item${i === activo ? " es-activo" : ""}`}>
            <span className="promo-icono" aria-hidden="true">{p.icono}</span>
            <span className="promo-texto">
              <strong>{p.titulo}</strong>
              <span>{p.texto}</span>
            </span>
          </div>
        ))}
        <span className="promobar-contador" aria-hidden="true">
          {activo + 1}/{PROMOS.length}
        </span>
      </div>
    </section>
  );
}
