import { useState } from "react";
import { Link } from "react-router";
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
import useIdiomaStore, { t } from "../store/idiomaStore";
import { precioFinal } from "./adaptar";
import { PASOS } from "./pasos";
import { traducirMensaje } from "./mensajesEn";

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
  const agregarVarios = useCartStore((s) => s.agregarVarios);
  const idioma = useIdiomaStore((s) => s.idioma);
  const nombrePaso = (p) => {
    if (!p) return "";
    const clave = `arm.paso.${p.id}`;
    const v = t(idioma, clave);
    return v === clave ? p.titulo : v;
  };
  const [agregando, setAgregando] = useState(false);

  const { resumen, resultados } = evaluacion;
  const bloqueado = resumen.bloqueada;
  const conAvisos = resumen.warn > 0 || resumen.unknown > 0;

  const fuenteW = build.fuente?.potenciaW;

  const agregarTodo = () => {
    if (bloqueado || agregando) return;
    if (conAvisos) {
      const ok = window.confirm(
        idioma === "en"
          ? `Your build has ${resumen.warn} warning(s) and ${resumen.unknown} pending review(s).\n\nAdd it to the cart anyway? We recommend reading the report first.`
          : `Che, tu armado tiene ${resumen.warn} aviso(s) y ${resumen.unknown} pendiente(s) de revisión.\n\n¿Lo agregamos igual al carrito? Te recomendamos leer el informe antes.`
      );
      if (!ok) return;
    }
    setAgregando(true);
    try {
      agregarVarios([...elegidos.map(({ producto }) => producto), ...extrasElegidos]);
    } finally {
      setAgregando(false);
    }
  };

  return (
    <div className="resumen">
      <h2 className="resumen-titulo">{t(idioma, "armres.titulo")}</h2>

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
                  <span className="resumen-paso">{nombrePaso(paso)}</span>
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
                    aria-label={`${t(idioma, "armres.cambiar")} ${nombrePaso(paso)}: ${producto.nombre}`}
                  >
                    <FaPen aria-hidden="true" /> {t(idioma, "armres.cambiar")}
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
                  <span className="resumen-paso">{nombrePaso(paso)}</span>
                  <span className="resumen-no-incluido">{t(idioma, "armres.salteado")}</span>
                  {salteados.includes(paso.id) && (
                    <span className="resumen-marca">
                      {t(idioma, "armres.volverPaso")} {i + 1}
                    </span>
                  )}
                </span>
                <span className="resumen-acciones">
                  <button
                    type="button"
                    className="ht-btn ht-btn-ghost"
                    onClick={() => irAPaso(i)}
                    aria-label={`${t(idioma, "armcard.elegir")} ${nombrePaso(paso)}`}
                  >
                    <FaPen aria-hidden="true" /> {t(idioma, "armcard.elegir")}
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
                aria-label={`${t(idioma, "armres.cambiar")} extras: ${t(idioma, "armres.quitar")} ${extra.nombre}`}
              >
                <FaMinus aria-hidden="true" /> {t(idioma, "armres.quitar")}
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
        <h3 id="informe-titulo">{t(idioma, "armres.compatibilidad")}</h3>
        <p className="informe-resumen-linea" role="status">
          {resumen.total === 0
            ? t(idioma, "arm.elegiDos")
            : `${resumen.ok} ${t(idioma, "arm.bien")} · ${resumen.warn} ${t(idioma, "arm.avisos")} · ${resumen.error} ${t(idioma, "arm.errores")} · ${resumen.unknown} ${t(idioma, "arm.pendientes")}`}
        </p>
        {resultados.length > 0 && (
          <ul className="informe-lista">
            {resultados.map((r, i) => {
              const Icono = ICONO_ESTADO[r.estado] ?? FaCircleQuestion;
              return (
                <li key={`${r.regla}-${i}`} className={`informe-item is-${r.estado}`}>
                  <Icono aria-hidden="true" />
                  <span>{traducirMensaje(r.mensaje, idioma)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="consumo" aria-labelledby="consumo-titulo">
        <h3 id="consumo-titulo">{idioma === "en" ? "Power vs. PSU" : "Consumo vs. fuente"}</h3>
        {consumo == null ? (
          <p>
            {idioma === "en"
              ? "We can't estimate power draw yet: we're missing the processor or power data. Pick the CPU (and GPU if you'll add one) and we'll calculate it."
              : "Todavía no puedo estimar el consumo: me falta el procesador o los datos de consumo. Elegí el CPU (y la GPU si vas a poner una) y lo calculamos."}
          </p>
        ) : typeof fuenteW === "number" ? (
          <p>
            {idioma === "en" ? "We estimate" : "Estimamos"} <strong>~{consumo}W</strong> {idioma === "en" ? "with a 30% margin and your PSU is" : "con margen del 30% y tu fuente es de"} <strong>{fuenteW}W</strong>.
            {consumo <= fuenteW * 0.8
              ? idioma === "en" ? " You've got headroom, nice." : " Vas holgado, bien ahí."
              : idioma === "en" ? " That's tight: consider more wattage if you can." : " Vas justito: si podés, estirate a más potencia."}
          </p>
        ) : (
          <p>
            {idioma === "en" ? "We estimate" : "Estimamos"} <strong>~{consumo}W</strong> {idioma === "en" ? "with a 30% margin. Pick the PSU and we'll tell you if it holds." : "con margen del 30%. Elegí la fuente y te digo si banca."}
          </p>
        )}
      </section>

      <section className="desglose" aria-labelledby="desglose-titulo">
        <h3 id="desglose-titulo">{idioma === "en" ? "Breakdown" : "Desglose"}</h3>
        <dl className="desglose-lista">
          {elegidos.map(
            ({ paso, producto }) =>
              producto && (
                <div key={paso.id} className="desglose-fila">
                  <dt>{nombrePaso(paso)}</dt>
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
            <dt>{t(idioma, "arm.total")}</dt>
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
              ? idioma === "en"
                ? "You can't add the build: there are compatibility errors"
                : "No podés agregar el armado: hay errores de compatibilidad"
              : `${t(idioma, "armres.agregarCarrito")} $${total.toLocaleString("es-AR")}`
          }
        >
          <FaCartPlus aria-hidden="true" /> {t(idioma, "armres.agregarCarrito")}
        </button>
        {bloqueado && (
          <p className="resumen-bloqueo" role="alert">
            {idioma === "en"
              ? "There are compatibility errors: fix them before taking the build."
              : "Hay errores de compatibilidad: resolvelos antes de llevarte el armado."}
          </p>
        )}
        {!bloqueado && conAvisos && (
          <p className="resumen-aviso">
            {idioma === "en"
              ? "You have warnings or pending items: read the report before confirming."
              : "Tenés avisos o pendientes: leé el informe antes de confirmar."}
          </p>
        )}
      </div>
    </div>
  );
}

export default ArmadorResumen;
