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

export default function PromoBar() {
  return (
    <section className="promobar" aria-label="Promociones y formas de pago">
      <div className="promobar-inner">
        {PROMOS.map((p) => (
          <div key={p.titulo} className="promo-item">
            <span className="promo-icono" aria-hidden="true">{p.icono}</span>
            <span className="promo-texto">
              <strong>{p.titulo}</strong>
              <span>{p.texto}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
