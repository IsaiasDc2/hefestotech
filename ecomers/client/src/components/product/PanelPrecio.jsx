import { useState } from "react";
import { FaBuildingColumns, FaChevronDown, FaCreditCard, FaWhatsapp } from "react-icons/fa6";
import useIdiomaStore, { t, tp } from "../../store/idiomaStore";
import { whatsappUrl } from "../../constants/whatsapp";
import { CUOTAS_SIN_INTERES, DESCUENTO_TRANSFERENCIA_PCT } from "../../constants/politicas";
import { formatearCuota, formatearPesos, precioConDescuento } from "../../utils/dinero";
import CalculadoraCuotas from "./CalculadoraCuotas";
import "./PanelPrecio.css";

/**
 * Panel de precio de la ficha: dos carriles de pago.
 *  - Transferencia/depósito: el "mejor precio" publicado (10% off). El checkout
 *    online no cobra transferencia, así que el botón coordina por WhatsApp.
 *  - Tarjeta: precio final, cuota sin interés publicada y calculadora.
 * Sin precio cargado (a confirmar) muestra solo el aviso.
 */
function PanelPrecio({ producto, precio, final, tieneOferta, descuento, tienePrecio, hayStock = true }) {
  const idioma = useIdiomaStore((s) => s.idioma);
  const [verCuotas, setVerCuotas] = useState(false);

  if (!tienePrecio) {
    return (
      <section className="pp" aria-label={t(idioma, "pp.titulo")}>
        <div className="pp-carril">
          <p className="pp-sin-precio">{t(idioma, "catl.sinPrecio")}</p>
        </div>
      </section>
    );
  }

  const pct = DESCUENTO_TRANSFERENCIA_PCT;
  const transferencia = precioConDescuento(final, pct);
  const ahorro = final - transferencia;
  const codigo = producto.codigo ? ` (${producto.codigo})` : "";
  const mensaje = tp(idioma, "pp.msgTransf", { producto: `${producto.nombre}${codigo}`, pct });

  return (
    <section className="pp" aria-label={t(idioma, "pp.titulo")}>
      <h2 className="sr-only">{t(idioma, "pp.titulo")}</h2>

      <div className="pp-carril pp-carril--mejor">
        <div className="pp-cabecera">
          <p className="pp-etiqueta">
            <FaBuildingColumns aria-hidden="true" />
            <span>
              <span className="pp-kicker">{t(idioma, "pp.mejor")}</span>
              {t(idioma, "pp.transf")}
            </span>
          </p>
          <span className="pp-sello">-{pct}%</span>
        </div>
        <p className="pp-fila">
          <strong className="pp-precio">{formatearPesos(transferencia)}</strong>
          <span className="pp-ahorro">{tp(idioma, "pp.ahorro", { monto: formatearPesos(ahorro) })}</span>
        </p>
        <p className="pp-nota">
          <s>{formatearPesos(final)}</s> · {tp(idioma, "pp.transfDesc", { pct })}
        </p>
        <p className="pp-nota">{t(idioma, "pp.transfAviso")}</p>
        {hayStock && (
          <a className="pp-cta" href={whatsappUrl(mensaje)} target="_blank" rel="noopener noreferrer">
            <FaWhatsapp aria-hidden="true" /> {t(idioma, "pp.transfCta")}
          </a>
        )}
      </div>

      <div className="pp-carril">
        <div className="pp-cabecera">
          <p className="pp-etiqueta">
            <FaCreditCard aria-hidden="true" />
            <span>{t(idioma, "pp.tarjeta")}</span>
          </p>
          {tieneOferta && (
            <span className="pp-sello pp-sello--oferta">
              {t(idioma, "card.oferta")} -{descuento}%
            </span>
          )}
        </div>
        <p className="pp-fila">
          {tieneOferta && <s className="pp-previo">{formatearPesos(precio)}</s>}
          <strong className="pp-precio pp-precio--sec">{formatearPesos(final)}</strong>
        </p>
        <p className="pp-cuotas">
          {tp(idioma, "pp.cuotasSinInt", {
            n: CUOTAS_SIN_INTERES,
            monto: formatearCuota(final, CUOTAS_SIN_INTERES),
          })}
        </p>
        <p className="pp-nota">
          {t(idioma, "pd.ivaIncluido")} {t(idioma, "pp.mp")}
        </p>
        <button
          type="button"
          className="pp-ver"
          aria-expanded={verCuotas}
          aria-controls="pp-cuotas-detalle"
          onClick={() => setVerCuotas((v) => !v)}
        >
          {verCuotas ? t(idioma, "pp.ocultarCuotas") : t(idioma, "pp.verCuotas")}
          <FaChevronDown aria-hidden="true" className={verCuotas ? "pp-ver-abierto" : ""} />
        </button>
        <div id="pp-cuotas-detalle" className="pp-detalle" hidden={!verCuotas}>
          {verCuotas && <CalculadoraCuotas precio={final} incrustada />}
        </div>
      </div>
    </section>
  );
}

export default PanelPrecio;
