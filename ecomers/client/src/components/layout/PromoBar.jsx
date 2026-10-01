import "./PromoBar.css";

const PROMOS = [
  { titulo: "6 cuotas sin interés", texto: "Con todas las tarjetas" },
  { titulo: "10% off por transferencia", texto: "Acreditación inmediata" },
  { titulo: "Envío gratis", texto: "En compras desde $99.999" },
  { titulo: "Retiro gratis", texto: "En nuestra tienda de Salta" },
];

export default function PromoBar() {
  return (
    <section className="promobar" aria-label="Promociones y formas de pago">
      <div className="promobar-inner">
        {PROMOS.map((p) => (
          <div key={p.titulo} className="promo-item">
            <strong>{p.titulo}</strong>
            <span>{p.texto}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
