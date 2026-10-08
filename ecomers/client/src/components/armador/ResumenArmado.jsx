import { FaCopy, FaPrint, FaCartPlus, FaTrash, FaCircleCheck, FaCircleXmark, FaTriangleExclamation } from "react-icons/fa6";
import { IconoCategoria } from "./armadorUtils";
import { formatoARS, useNumeroAnimado } from "../../hooks/useNumeroAnimado";
import "./ResumenArmado.css";

function ResumenArmado({
  filas,
  total,
  consumo,
  recomendada,
  completados,
  totalPasos,
  estado,
  errores,
  advertencias,
  copiado,
  onQuitar,
  onCopiar,
  onImprimir,
  onAgregarTodo,
  resumenRef,
  onCerrarSheet,
  enSheet,
}) {
  const totalMostrado = useNumeroAnimado(total);
  const incompleto = completados < totalPasos;

  return (
    <aside
      className="resumen"
      ref={resumenRef}
      aria-label="Resumen de tu armado"
    >
      <div className="resumen__head">
        <h2>Tu armado</h2>
        {enSheet && (
          <button type="button" className="resumen__cerrar" onClick={onCerrarSheet} aria-label="Cerrar resumen">
            ✕
          </button>
        )}
      </div>

      <div className="resumen__progreso">
        <div className="resumen__progreso-texto">
          <span>
            {completados} de {totalPasos} componentes
          </span>
          <span>{Math.round((completados / totalPasos) * 100)}%</span>
        </div>
        <div
          className="resumen__barra"
          role="progressbar"
          aria-valuenow={completados}
          aria-valuemin={0}
          aria-valuemax={totalPasos}
          aria-label={`Progreso del armado: ${completados} de ${totalPasos}`}
        >
          <div
            className="resumen__relleno"
            style={{ width: `${(completados / totalPasos) * 100}%` }}
          />
        </div>
      </div>

      <ul className="resumen__filas">
        {filas.map((fila) => (
          <li key={fila.paso} className={`resumen__fila${fila.pieza ? "" : " is-vacia"}`}>
            <span className="resumen__fila-icono" aria-hidden="true">
              <IconoCategoria categoria={fila.paso} />
            </span>
            <span className="resumen__fila-texto">
              <span className="resumen__fila-paso">{fila.nombre}</span>
              {fila.pieza ? (
                <span className="resumen__fila-pieza">{fila.pieza.nombre}</span>
              ) : (
                <span className="resumen__fila-falta">Falta elegir</span>
              )}
            </span>
            {fila.pieza && (
              <>
                <span className="resumen__fila-precio">{formatoARS(fila.pieza.precio)}</span>
                <button
                  type="button"
                  className="resumen__quitar"
                  onClick={() => onQuitar(fila.paso)}
                  aria-label={`Quitar ${fila.pieza.nombre} del armado`}
                >
                  <FaTrash aria-hidden="true" />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      <dl className="resumen__totales">
        <div className="resumen__total-linea">
          <dt>Total</dt>
          <dd className="resumen__total-valor" aria-live="polite">
            {formatoARS(totalMostrado)}
          </dd>
        </div>
        <div className="resumen__meta-linea">
          <dt>Consumo estimado</dt>
          <dd>{consumo} W</dd>
        </div>
        {consumo > 0 && (
          <div className="resumen__meta-linea">
            <dt>Fuente recomendada</dt>
            <dd>{recomendada} W</dd>
          </div>
        )}
      </dl>

      <p
        className={`resumen__estado resumen__estado--${estado}`}
        aria-live="polite"
      >
        {estado === "ok" && (
          <>
            <FaCircleCheck aria-hidden="true" /> Todo compatible
          </>
        )}
        {estado === "advertencias" && (
          <>
            <FaTriangleExclamation aria-hidden="true" /> {advertencias} advertencia(s): revisá los avisos
          </>
        )}
        {estado === "errores" && (
          <>
            <FaCircleXmark aria-hidden="true" /> {errores} error(es): hay piezas incompatibles
          </>
        )}
      </p>

      <div className="resumen__acciones">
        <button type="button" className="btn-resumen btn-resumen--ghost" onClick={onCopiar}>
          <FaCopy aria-hidden="true" /> {copiado ? "¡Copiado!" : "Copiar"}
        </button>
        <button type="button" className="btn-resumen btn-resumen--ghost" onClick={onImprimir}>
          <FaPrint aria-hidden="true" /> Imprimir
        </button>
        <button
          type="button"
          className="btn-resumen btn-resumen--primario"
          onClick={onAgregarTodo}
          disabled={incompleto}
          title={incompleto ? "Elegí los 8 componentes primero" : undefined}
        >
          <FaCartPlus aria-hidden="true" /> Agregar todo al carrito
        </button>
      </div>
    </aside>
  );
}

export default ResumenArmado;
