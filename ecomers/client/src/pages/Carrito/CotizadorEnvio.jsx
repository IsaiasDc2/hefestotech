import { useState } from "react";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import { UMBRAL_ENVIO_GRATIS, costoEnvio } from "../../constants/politicas";
import { esCpValido, guardarCp, leerCp } from "../../utils/codigoPostal";
import "./CotizadorEnvio.css";

// Estimación en pantalla: el total que se cobra lo calcula el servidor. Las
// tarifas son únicas para todo el país (no dependen del código postal): el
// código se pide para confirmar el destino y se recuerda para el checkout.

const pesos = (v) => `$${Number(v ?? 0).toLocaleString("es-AR")}`;

function CotizadorEnvio({ subtotal = 0, compacto = false }) {
  const idioma = useIdiomaStore((s) => s.idioma);
  const [cp, setCp] = useState(leerCp);
  const [consultado, setConsultado] = useState(() => leerCp() !== "");
  const [metodo, setMetodo] = useState("estandar");
  const [error, setError] = useState("");

  const base = Number(subtotal ?? 0);
  const tieneGratis = base >= UMBRAL_ENVIO_GRATIS;
  const faltante = Math.max(0, UMBRAL_ENVIO_GRATIS - base);

  const cotizar = (e) => {
    e.preventDefault();
    if (!esCpValido(cp)) {
      setError(t(idioma, "cart.cotizError"));
      setConsultado(false);
      return;
    }
    setError("");
    guardarCp(cp);
    setConsultado(true);
  };

  const opciones = [
    {
      id: "gratis",
      nombre: `${t(idioma, "cart.cotizGratis")} (${t(idioma, "cart.cotizDesde")} ${pesos(UMBRAL_ENVIO_GRATIS)})`,
      costo: 0,
      disponible: tieneGratis,
      motivo: tieneGratis
        ? ""
        : `${t(idioma, "cart.faltan")} ${pesos(faltante)} ${t(idioma, "cart.paraEnvio")}`,
    },
    {
      id: "estandar",
      nombre: t(idioma, "cart.cotizEstandar"),
      costo: costoEnvio(base, "estandar"),
      disponible: true,
      motivo: "",
    },
    {
      id: "express",
      nombre: t(idioma, "cart.cotizExpress"),
      costo: costoEnvio(base, "express"),
      disponible: true,
      motivo: "",
    },
  ];

  return (
    <section className={`cotiz-envio${compacto ? " cotiz-envio--ficha" : ""}`} aria-labelledby="cotiz-envio-titulo">
      <h2 id="cotiz-envio-titulo" className="cotiz-envio-titulo">
        {t(idioma, "cart.cotizTitulo")}
      </h2>
      <form className="cotiz-envio-form" onSubmit={cotizar}>
        <label className="cotiz-envio-campo">
          <span>{t(idioma, "cart.cotizCp")}</span>
          <input
            value={cp}
            onChange={(e) => {
              setCp(e.target.value.replace(/\D/g, ""));
              setConsultado(false);
            }}
            placeholder={t(idioma, "cart.cotizPh")}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={4}
            aria-describedby={error ? "cotiz-envio-error" : undefined}
            aria-invalid={error ? true : undefined}
          />
        </label>
        <button type="submit" className="cotiz-envio-btn">
          {t(idioma, "cart.cotizBtn")}
        </button>
      </form>
      {error && (
        <p id="cotiz-envio-error" className="cotiz-envio-error" role="alert">
          {error}
        </p>
      )}
      {consultado && !error && (
        <div role="status" aria-live="polite">
          <ul className="cotiz-envio-lista" role="radiogroup" aria-label={t(idioma, "cart.cotizTitulo")}>
            {opciones.map((op) => (
              <li key={op.id}>
                <label className={`cotiz-envio-opcion${metodo === op.id ? " activa" : ""}${op.disponible ? "" : " bloqueada"}`}>
                  <input
                    type="radio"
                    name="metodo-envio-cotiz"
                    value={op.id}
                    checked={metodo === op.id}
                    disabled={!op.disponible}
                    onChange={() => setMetodo(op.id)}
                  />
                  <span className="cotiz-envio-opcion-nombre">{op.nombre}</span>
                  <strong className="cotiz-envio-opcion-costo">
                    {!op.disponible ? "—" : op.costo === 0 ? t(idioma, "chk.gratis") : pesos(op.costo)}
                  </strong>
                  {op.motivo && <span className="cotiz-envio-motivo">{op.motivo}</span>}
                  {op.disponible && (
                    <span className="cotiz-envio-total">
                      {t(idioma, "cart.cotizTotal")}: {pesos(base + op.costo)}
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>
          <p className="cotiz-envio-nota">{t(idioma, "cart.cotizNota")}</p>
        </div>
      )}
    </section>
  );
}

export default CotizadorEnvio;
