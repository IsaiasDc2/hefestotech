import { useState } from "react";
import { Link } from "react-router-dom";
import {
  FaCartPlus,
  FaPen,
  FaMinus,
  FaCircleCheck,
  FaTriangleExclamation,
  FaCircleXmark,
  FaCircleQuestion,
} from "react-icons/fa6";
import useCartStore from "../store/cartStore";
import { precioFinal } from "./adaptar";
import { PASOS } from "./pasos";

const ICONO_ESTADO = {
  ok: FaCircleCheck,
  warn: FaTriangleExclamation,
  error: FaCircleXmark,
  unknown: FaCircleQuestion,
};

/**
 * Resumen "Tu PC": lo elegido por paso, salteados como "No incluido",
 * informe de compatibilidad del motor, consumo vs. fuente, desglose
 * y "Agregar todo al carrito" (bloqueado ante errores, con
 * confirmación ante avisos).
 */
function ArmadorResumen({
  elegidos,
  extrasElegidos,
  salteados,
  evaluacion,
  consumo,
  build,
  total,
  irAPaso,
}) {
  const agregarAlCarrito = useCartStore((s) => s.agregarAlCarrito);
  const [agregando, setAgregando] = useState(false);

  const { resumen, resultados } = evaluacion;
  const bloqueado = resumen.bloqueada;
  const conAvisos = resumen.warn > 0 || resumen.unknown > 0;

  const fuenteW = build.fuente?.potenciaW;

  const agregarTodo = () => {
    if (bloqueado || agregando) return;
    if (conAvisos) {
      const ok = window.confirm(
        `Che, tu armado tiene ${resumen.warn} aviso(s) y ${resumen.unknown} pendiente(s) de revisión.\n\n¿Lo agregamos igual al carrito? Te recomendamos leer el informe antes.`
      );
      if (!ok) return;
    }
    setAgregando(true);
    try {
      for (const { producto } of elegidos) {
        if (producto) agregarAlCarrito(producto);
      }
      for (const extra of extrasElegidos) agregarAlCarrito(extra);
    } finally {
      setAgregando(false);
    }
  };

  return (
    <div className="resumen">
      <h2 className="resumen-titulo">Tu PC</h2>

      <ul className="resumen-lista">
        {elegidos.map(({ paso, producto }, i) => (
          <li key={paso.id} className="resumen-fila">
            {producto ? (
              <>
                <span className="resumen-media" aria-hidden="true">
                  {producto.imagen ? (
                    <img
                      src={producto.imagen}
                      alt=""
                      width="96"
                      height="96"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span className="resumen-sin-img">HT</span>
                  )}
                </span>
                <span className="resumen-datos">
                  <span className="resumen-paso">{paso.titulo}</span>
                  <Link
                    to={`/producto/${producto.id}`}
                    className="resumen-nombre"
                  >
                    {producto.nombre}
                  </Link>
                  {producto.marca && (
                    <span className="resumen-marca">{producto.marca}</span>
                  )}
                  <strong className="resumen-precio">
                    ${precioFinal(producto).toLocaleString("es-AR")}
                  </strong>
                </span>
                <span className="resumen-acciones">
                  <button
                    type="button"
                    className="ht-btn ht-btn-ghost"
                    onClick={() => irAPaso(i)}
                    aria-label={`Cambiar ${paso.titulo}: ${producto.nombre}`}
                  >
                    <FaPen aria-hidden="true" /> Cambiar
                  </button>
                </span>
              </>
            ) : (
              <>
                <span
                  className="resumen-media is-vacio"
                  aria-hidden="true"
                />
                <span className="resumen-datos">
                  <span className="resumen-paso">{paso.titulo}</span>
                  <span className="resumen-no-incluido">No incluido</span>
                  {salteados.includes(paso.id) && (
                    <span className="resumen-marca">
                      Lo salteaste en el paso {i + 1}
                    </span>
                  )}
                </span>
                <span className="resumen-acciones">
                  <button
                    type="button"
                    className="ht-btn ht-btn-ghost"
                    onClick={() => irAPaso(i)}
                    aria-label={`Elegir ${paso.titulo}`}
                  >
                    <FaPen aria-hidden="true" /> Elegir
                  </button>
                </span>
              </>
            )}
          </li>
        ))}

        {extrasElegidos.map((extra) => (
          <li key={`extra-${extra.id}`} className="resumen-fila is-extra">
            <span className="resumen-media" aria-hidden="true">
              {extra.imagen ? (
                <img
                  src={extra.imagen}
                  alt=""
                  width="96"
                  height="96"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span className="resumen-sin-img">HT</span>
              )}
            </span>
            <span className="resumen-datos">
              <span className="resumen-paso">Extra</span>
              <Link to={`/producto/${extra.id}`} className="resumen-nombre">
                {extra.nombre}
              </Link>
              {extra.marca && (
                <span className="resumen-marca">{extra.marca}</span>
              )}
              <strong className="resumen-precio">
                ${precioFinal(extra).toLocaleString("es-AR")}
              </strong>
            </span>
            <span className="resumen-acciones">
              <button
                type="button"
                className="ht-btn ht-btn-ghost"
                onClick={() => irAPaso(PASOS.length)}
                aria-label={`Cambiar extras: quitar ${extra.nombre}`}
              >
                <FaMinus aria-hidden="true" /> Quitar
              </button>
            </span>
          </li>
        ))}
      </ul>

      <section
        className="informe"
        aria-labelledby="informe-titulo"
        aria-live="polite"
      >
        <h3 id="informe-titulo">Informe de compatibilidad</h3>
        <p className="informe-resumen-linea" role="status">
          {resumen.total === 0
            ? "Todavía no hay nada para evaluar: elegí al menos dos componentes."
            : `${resumen.ok} bien · ${resumen.warn} avisos · ${resumen.error} errores · ${resumen.unknown} pendientes`}
        </p>
        {resultados.length > 0 && (
          <ul className="informe-lista">
            {resultados.map((r, i) => {
              const Icono = ICONO_ESTADO[r.estado] ?? FaCircleQuestion;
              return (
                <li key={`${r.regla}-${i}`} className={`informe-item is-${r.estado}`}>
                  <Icono aria-hidden="true" />
                  <span>{r.mensaje}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="consumo" aria-labelledby="consumo-titulo">
        <h3 id="consumo-titulo">Consumo vs. fuente</h3>
        {consumo == null ? (
          <p>
            Todavía no puedo estimar el consumo: me falta el procesador
            {build.gpu ? "" : " o los datos de consumo"}.
            Elegí el CPU (y la GPU si vas a poner una) y lo calculamos.
          </p>
        ) : typeof fuenteW === "number" ? (
          <p>
            Estimamos <strong>~{consumo}W</strong> con margen del 30% y tu
            fuente es de <strong>{fuenteW}W</strong>.
            {consumo <= fuenteW * 0.8
              ? " Vas holgado, bien ahí."
              : " Vas justito: si podés, estirate a más potencia."}
          </p>
        ) : (
          <p>
            Estimamos <strong>~{consumo}W</strong> con margen del 30%.
            Elegí la fuente y te digo si banca.
          </p>
        )}
      </section>

      <section className="desglose" aria-labelledby="desglose-titulo">
        <h3 id="desglose-titulo">Desglose</h3>
        <dl className="desglose-lista">
          {elegidos.map(
            ({ paso, producto }) =>
              producto && (
                <div key={paso.id} className="desglose-fila">
                  <dt>{paso.titulo}</dt>
                  <dd>${precioFinal(producto).toLocaleString("es-AR")}</dd>
                </div>
              )
          )}
          {extrasElegidos.map((extra) => (
            <div key={extra.id} className="desglose-fila">
              <dt>Extra · {extra.nombre}</dt>
              <dd>${precioFinal(extra).toLocaleString("es-AR")}</dd>
            </div>
          ))}
          <div className="desglose-fila is-total">
            <dt>Total</dt>
            <dd>${total.toLocaleString("es-AR")}</dd>
          </div>
        </dl>
      </section>

      <div className="resumen-cta">
        <button
          type="button"
          className="ht-btn ht-btn-primary"
          disabled={bloqueado || agregando}
          onClick={agregarTodo}
          aria-label={
            bloqueado
              ? "No podés agregar el armado: hay errores de compatibilidad"
              : `Agregar todo al carrito por $${total.toLocaleString("es-AR")}`
          }
        >
          <FaCartPlus aria-hidden="true" /> Agregar todo al carrito
        </button>
        {bloqueado && (
          <p className="resumen-bloqueo" role="alert">
            Hay errores de compatibilidad: resolvelos antes de llevarte el
            armado.
          </p>
        )}
        {!bloqueado && conAvisos && (
          <p className="resumen-aviso">
            Tenés avisos o pendientes: leé el informe antes de confirmar.
          </p>
        )}
      </div>
    </div>
  );
}

export default ArmadorResumen;
