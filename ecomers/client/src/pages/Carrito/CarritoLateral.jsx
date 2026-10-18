import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { FaCartShopping, FaXmark, FaTrashCan, FaMinus, FaPlus, FaTruckFast, FaCircleCheck, FaArrowRight } from "react-icons/fa6";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import { topeDeStock } from "../../store/cartStore";
import "./CarritoLateral.css";

const UMBRAL_ENVIO_GRATIS = 150000;

function CarritoLateral({
  isOpen,
  onClose,
  carrito,
  eliminarDelCarrito,
  aumentarCantidad,
  disminuirCantidad
}) {
  const panelRef = useRef(null);
  const idioma = useIdiomaStore((s) => s.idioma);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    if (!isOpen) return undefined;
    const panel = panelRef.current;
    const previo = document.activeElement;
    const alTeclado = (e) => {
      if (e.key === "Escape") {
        onClose?.();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const focos = panel.querySelectorAll(
        'a[href], button:not(:disabled), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focos.length === 0) return;
      const primero = focos[0];
      const ultimo = focos[focos.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    window.addEventListener("keydown", alTeclado);
    panel?.querySelector("button")?.focus();
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", alTeclado);
      if (previo instanceof HTMLElement) previo.focus();
    };
  }, [isOpen, onClose]);

  const total = carrito.reduce(
    (acc, item) =>
      acc +
      Number(item.precio_con_descuento ?? item.precio ?? 0) *
        Number(item.cantidad ?? 1),
    0
  );
  const cantidadTotal = carrito.reduce(
    (acc, item) => acc + Number(item.cantidad ?? 1),
    0
  );
  const progreso = Math.min(1, UMBRAL_ENVIO_GRATIS > 0 ? total / UMBRAL_ENVIO_GRATIS : 1);
  const faltante = Math.max(0, UMBRAL_ENVIO_GRATIS - total);
  const envioGratis = total >= UMBRAL_ENVIO_GRATIS && carrito.length > 0;

  return (
    <>
      <div
        className={`overlay ${isOpen ? "show" : ""}`}
        onClick={onClose}
        aria-hidden={!isOpen}
      ></div>

      <aside
        ref={panelRef}
        className={`cart ${isOpen ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={t(idioma, "cl.titulo")}
        inert={!isOpen}
      >

        <div className="cart-header">
          <h2>
            <span className="cart-header-icono" aria-hidden="true">
              <FaCartShopping />
            </span>
            {t(idioma, "cl.miCarrito")}
            {cantidadTotal > 0 && (
              <span className="cart-header-conteo">{cantidadTotal}</span>
            )}
          </h2>
          <button type="button" onClick={onClose} aria-label={t(idioma, "cl.cerrar")}>
            <FaXmark aria-hidden="true" />
          </button>
        </div>

        {carrito.length > 0 && (
          <div className="cart-envio">
            <p className="cart-envio-texto">
              {envioGratis ? (
                <>
                  <FaCircleCheck aria-hidden="true" />
                  {t(idioma, "cl.envioGratis")}
                </>
              ) : (
                <>
                  <FaTruckFast aria-hidden="true" />
                  {t(idioma, "cl.faltan")} ${faltante.toLocaleString("es-AR")} {t(idioma, "cl.paraEnvio")}
                </>
              )}
            </p>
            <div
              className="cart-envio-barra"
              role="progressbar"
              aria-valuenow={Math.round(progreso * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t(idioma, "cl.progreso")}
            >
              <span
                className={`cart-envio-relleno${envioGratis ? " is-completo" : ""}`}
                style={{ "--relleno": progreso }}
              />
            </div>
          </div>
        )}

        <div className="cart-body">
          {carrito.length === 0 ? (
            <div className="cart-vacio">
              <div className="cart-vacio-ilustra" aria-hidden="true">
                <span className="cart-vacio-anillo" />
                <FaCartShopping className="cart-vacio-icono" />
              </div>
              <p className="cart-vacio-titulo">{t(idioma, "cl.vacioT")}</p>
              <p className="cart-vacio-texto">{t(idioma, "cl.vacioS")}</p>
              <button type="button" className="cart-vacio-cta" onClick={onClose}>
                {t(idioma, "cl.verProd")}
                <FaArrowRight aria-hidden="true" />
              </button>
            </div>
          ) : (
            carrito.map(item => {
              const unitario = Number(item.precio_con_descuento ?? item.precio ?? 0);
              const linea = unitario * Number(item.cantidad ?? 1);
              return (
              <div className="cart-item" key={item.id}>
                <div className="cart-thumb" aria-hidden={!item.imagen}>
                  {item.imagen ? (
                    <img
                      src={item.imagen}
                      alt=""
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                  ) : (
                    <FaCartShopping className="cart-thumb-icono" />
                  )}
                </div>

                <div className="info">
                  <h4>{item.nombre}</h4>
                  <p className="cart-precio">${unitario.toLocaleString("es-AR")}</p>

                  <div className="cart-item-pie">
                    <div className="cantidad">
                      <button
                        type="button"
                        onClick={() => disminuirCantidad(item.id)}
                        aria-label={t(idioma, "cl.quitarUno")}
                        disabled={item.cantidad <= 1}
                      >
                        <FaMinus aria-hidden="true" />
                      </button>
                      <span aria-hidden="true">{item.cantidad}</span>
                      <span className="sr-only" aria-live="polite" aria-atomic="true">
                        {`${item.nombre}, ${t(idioma, "cl.cantidad")}: ${item.cantidad}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => aumentarCantidad(item.id)}
                        aria-label={t(idioma, "cl.agregarUno")}
                        disabled={item.cantidad >= topeDeStock(item)}
                      >
                        <FaPlus aria-hidden="true" />
                      </button>
                    </div>
                    <strong className="cart-linea-total">
                      ${linea.toLocaleString("es-AR")}
                    </strong>
                  </div>

                  <button
                    type="button"
                    className="eliminar"
                    onClick={() => eliminarDelCarrito(item.id)}
                  >
                    <FaTrashCan aria-hidden="true" />
                    {t(idioma, "cl.eliminar")}
                  </button>
                </div>
              </div>
              );
            })
          )}
        </div>

        <div className="cart-footer">
          <div className="subtotal" aria-live="polite">
            <span>{t(idioma, "cl.subtotal")}</span>
            <strong>${total.toLocaleString("es-AR")}</strong>
          </div>
          <p className="cart-nota">{t(idioma, "cl.nota")}</p>

          {carrito.length === 0 ? (
            <button type="button" className="btnComprar" disabled>
              {t(idioma, "cl.finalizar")}
              <FaArrowRight aria-hidden="true" />
            </button>
          ) : (
            <Link to="/checkout" className="btnComprar" onClick={onClose}>
              {t(idioma, "cl.finalizar")}
              <FaArrowRight aria-hidden="true" />
            </Link>
          )}
          <Link to="/productos" className="cart-seguir" onClick={onClose}>
            {t(idioma, "cl.seguir")}
          </Link>
        </div>

      </aside>
    </>
  );
}

export default CarritoLateral;
