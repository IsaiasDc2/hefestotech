import { useState } from "react";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import "./CalculadoraCuotas.css";

const OPCIONES_CUOTAS = [3, 6, 12, 18];

const pesos = (v) => `$${Number(v ?? 0).toLocaleString("es-AR")}`;

function CalculadoraCuotas({ precio = 0 }) {
  const idioma = useIdiomaStore((s) => s.idioma);
  const [cuotas, setCuotas] = useState(6);
  const base = Number(precio ?? 0);
  const porCuota = cuotas > 0 ? base / cuotas : 0;

  return (
    <section className="calc-cuotas" aria-labelledby="calc-cuotas-titulo">
      <h2 id="calc-cuotas-titulo" className="calc-cuotas-titulo">
        {t(idioma, "pd.cuotasTitulo")}
      </h2>
      <fieldset className="calc-cuotas-grupo">
        <legend className="calc-cuotas-leyenda">{t(idioma, "pd.cuotasElegi")}</legend>
        <div className="calc-cuotas-opciones" role="radiogroup" aria-label={t(idioma, "pd.cuotasElegi")}>
          {OPCIONES_CUOTAS.map((n) => (
            <label
              key={n}
              className={`calc-cuotas-opcion${cuotas === n ? " activa" : ""}`}
            >
              <input
                type="radio"
                name="cuotas-producto"
                value={n}
                checked={cuotas === n}
                onChange={() => setCuotas(n)}
                aria-label={`${n} ${t(idioma, "pd.cuotasDe")}`}
              />
              <span aria-hidden="true">{n}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="calc-cuotas-resultado" role="status" aria-live="polite">
        <strong>
          {cuotas} {t(idioma, "pd.cuotasDe")} {pesos(porCuota)}
        </strong>
      </p>
      <p className="calc-cuotas-aviso">{t(idioma, "pd.cuotasRef")}</p>
    </section>
  );
}

export default CalculadoraCuotas;
