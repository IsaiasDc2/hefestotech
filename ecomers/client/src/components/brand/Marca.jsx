import "./Marca.css";

const BASE = import.meta.env.BASE_URL || "/";


function Marca({
  variante = "simbolo",
  ancho = 36,
  alto = 36,
  alt = "HefestoTech",
  eager = false,
  decorativa = false,
  className = "",
}) {
  const nombre = variante === "lockup" ? "logo-lockup" : "logo-symbol";
  const cls = `marca marca-${variante}${className ? ` ${className}` : ""}`;
  return (
    <span className={cls} aria-hidden={decorativa || undefined}>
      <picture>
        <source srcSet={`${BASE}brand/${nombre}.webp`} type="image/webp" />
        <img
          src={`${BASE}brand/${nombre}.png`}
          width={ancho}
          height={alto}
          alt={decorativa ? "" : alt}
          loading={eager ? "eager" : "lazy"}
          decoding={eager ? "sync" : "async"}
          fetchPriority={eager ? "high" : "auto"}
          draggable={false}
        />
      </picture>
    </span>
  );
}

export default Marca;
