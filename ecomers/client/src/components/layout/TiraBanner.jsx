import { Link } from "react-router-dom";
import "./TiraBanner.css";

export default function TiraBanner({ src, alt, to = null, etiqueta = null }) {
  const imagen = (
    <img src={src} alt={alt} loading="lazy" decoding="async" draggable="false" />
  );

  return (
    <figure className="tira-banner">
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
