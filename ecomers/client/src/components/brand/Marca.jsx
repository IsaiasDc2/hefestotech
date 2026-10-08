import "./Marca.css";

const BASE = import.meta.env.BASE_URL || "/";

/**
 * Insignia de marca HefestoTech (opcion b: el JPEG oficial no tiene alfa,
 * asi que se presenta en badge redondeado con padding, sin recortes
 * agresivos ni redibujos). El logo se conserva intacto en
 * public/brand/logo-original.jpeg; aca solo se usan derivados.
 *
 * - variante "simbolo": chip recortado, para header/badges/estados (legible a 32px).
 * - variante "lockup": simbolo + texto, para footer/OG/404 (>=150px de ancho).
 * width/height siempre definidos para CLS=0. Prioridad de carga (eager +
 * fetchPriority) solo donde se pida explicitamente (header).
 */
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
