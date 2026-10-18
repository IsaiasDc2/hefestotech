import { Link } from "react-router";
import { FaCartShopping } from "react-icons/fa6";
import Marca from "../../components/brand/Marca";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import CotizadorEnvio from "./CotizadorEnvio";
import "./CotizadorEnvio.css";

const UMBRAL_ENVIO_GRATIS = 150000;

function Carrito({
  carrito = [],
  eliminarDelCarrito,
  aumentarCantidad,
  disminuirCantidad,
}) {
  const subtotal = carrito.reduce(
    (acc, item) =>
      acc +
      Number(item.precio_con_descuento ?? item.precio ?? 0) *
        Number(item.cantidad ?? 1),
    0
  );
  const idioma = useIdiomaStore((s) => s.idioma);
  const progreso = Math.min(1, UMBRAL_ENVIO_GRATIS > 0 ? subtotal / UMBRAL_ENVIO_GRATIS : 1);
  const faltante = Math.max(0, UMBRAL_ENVIO_GRATIS - subtotal);

  if (carrito.length === 0) {
    return (
      <div className="carrito-pagina carrito-vacio-pagina">
        <span className="marca-centrada" aria-hidden="true">
          <Marca variante="simbolo" ancho={56} alto={56} decorativa />
        </span>
        <div className="cart-vacio-ilustra" aria-hidden="true">
          <span className="cart-vacio-anillo" />
          <FaCartShopping className="cart-vacio-icono" />
        </div>
        <h1>{t(idioma, "cart.titulo")}</h1>
        <p className="carrito-vacio-texto">{t(idioma, "cart.vacio")}</p>
        <Link to="/productos" className="carrito-cta">{t(idioma, "cart.verProd")} →</Link>
      </div>
    );
  }

  return (
    <div className="carrito-pagina">
      <header className="carrito-pagina-head">
      <h1>{t(idioma, "cart.tituloFull")}</h1>
      <p className="carrito-conteo">
        {carrito.length} {carrito.length === 1 ? t(idioma, "cart.producto") : t(idioma, "cart.productos")} {t(idioma, "cart.enCarrito")}
      </p>
      </header>
      <div className="cart-envio cart-envio-pagina" aria-hidden={false}>
        <p className="cart-envio-texto">
          {subtotal >= UMBRAL_ENVIO_GRATIS
            ? t(idioma, "cart.envioGratis")
            : `${t(idioma, "cart.faltan")} $${faltante.toLocaleString("es-AR")} ${t(idioma, "cart.paraEnvio")}`}
        </p>
        <div
          className="cart-envio-barra"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progreso * 100)}
          aria-label={t(idioma, "cart.progreso")}
        >
          <span
            className="cart-envio-relleno"
            style={{ width: `${Math.round(progreso * 100)}%` }}
          />
        </div>
      </div>
      <ul className="carrito-lista">
        {carrito.map((item) => {
          const nombreItem = item.nombre || "Producto";
          const cantidadItem = Number(item.cantidad ?? 1);
          return (
          <li key={item.id} className="carrito-item">
            {item.imagen ? (
              <span className="carrito-thumb">
                <img
                  src={item.imagen}
                  alt={item.nombre || "Producto"}
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              </span>
            ) : null}
            <span className="carrito-item-nombre">{item.nombre}</span>
            <span className="carrito-item-cant">× {item.cantidad}</span>
            <span className="carrito-item-precio">
              $
              {(
                Number(item.precio_con_descuento ?? item.precio ?? 0) *
                Number(item.cantidad ?? 1)
              ).toLocaleString("es-AR")}
            </span>
            <span className="carrito-item-acciones">
              <button type="button" onClick={() => disminuirCantidad?.(item.id)} aria-label={`${t(idioma, "cart.quitarUno")} ${nombreItem}`} disabled={cantidadItem <= 1}>−</button>
              <button type="button" onClick={() => aumentarCantidad?.(item.id)} aria-label={`${t(idioma, "cart.agregarUno")} ${nombreItem}`}>+</button>
              <button type="button" onClick={() => eliminarDelCarrito?.(item.id)} aria-label={`${t(idioma, "cart.eliminar")} ${nombreItem} ${t(idioma, "cart.delCarrito")}`}>{t(idioma, "cart.eliminar")}</button>
            </span>
          </li>
          );
        })}
      </ul>
      <div className="carrito-pagina-resumen">
        <p className="carrito-subtotal">
          {t(idioma, "cart.subtotal")}: <strong>${subtotal.toLocaleString("es-AR")}</strong>
        </p>
        <CotizadorEnvio subtotal={subtotal} />
        <div className="carrito-pagina-acciones">
          <Link to="/productos" className="carrito-secundario">← {t(idioma, "cart.seguir")}</Link>
          <Link to="/checkout" className="btn-primary">{t(idioma, "cart.finalizar")} →</Link>
        </div>
      </div>
    </div>
  );
}

export default Carrito;
