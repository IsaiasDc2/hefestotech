import { useEffect, useMemo, useRef, useState } from "react";
import {
  FaArrowLeft,
  FaArrowRight,
  FaCheck,
  FaForward,
  FaRotateLeft,
  FaScrewdriverWrench,
  FaTriangleExclamation,
  FaCircleXmark,
  FaCircleCheck,
  FaCircleQuestion,
} from "react-icons/fa6";
import useArmador, { PASOS, TOTAL_PASOS } from "./usoArmador";
import useIdiomaStore, { t } from "../store/idiomaStore";
import { PASO_EXTRAS } from "./pasos";
import { precioFinal } from "./adaptar";
import ArmadorCard from "./ArmadorCard";
import ArmadorResumen from "./ArmadorResumen";
import "./Armador.css";

const CATEGORIAS_PRINCIPALES = new Set(
  PASOS.flatMap((p) => p.categorias.map((c) => c.toLowerCase()))
);

const RANGO_ESTADO = { compatible: 0, revisar: 1, incompatible: 2 };

function TotalAnimado({ valor }) {
  const [mostrado, setMostrado] = useState(valor);
  useEffect(() => {
    if (
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
      mostrado === valor
    ) {
      setMostrado(valor);
      return undefined;
    }
    const desde = mostrado;
    const hasta = valor;
    const inicio = performance.now();
    const dur = 250;
    let raf = 0;
    const tick = (t) => {
      const k = Math.min(1, (t - inicio) / dur);
      setMostrado(Math.round(desde + (hasta - desde) * k));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);
  return <>{mostrado.toLocaleString("es-AR")}</>;
}

function estadoGlobal(evaluacion, cantidad, idioma) {
  if (cantidad === 0) return { clase: "is-neutro", texto: t(idioma, "arm.sinArmar") };
  const { resumen } = evaluacion;
  if (resumen.bloqueada) return { clase: "is-error", texto: t(idioma, "arm.conErrores") };
  if (resumen.warn > 0) return { clase: "is-warn", texto: t(idioma, "arm.conAvisos") };
  if (resumen.unknown > 0)
    return { clase: "is-warn", texto: t(idioma, "arm.aRevisar") };
  if (resumen.total === 0) return { clase: "is-neutro", texto: t(idioma, "arm.sinEvaluar") };
  return { clase: "is-ok", texto: t(idioma, "arm.compatible") };
}

function subir() {
  const reduce = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
}

function Armador() {
  const a = useArmador();
  const idioma = useIdiomaStore((s) => s.idioma);
  const tituloRef = useRef(null);
  const nombrePaso = (p) => {
    if (!p) return "";
    const clave = `arm.paso.${p.id}`;
    const v = t(idioma, clave);
    return v === clave ? p.titulo : v;
  };

  const esExtras = a.paso === PASOS.length;
  const pasoDef = esExtras ? PASO_EXTRAS : PASOS[a.paso];

  const hayRestaurado = useMemo(
    () =>
      Object.keys(a.selecciones).length > 0 ||
      a.salteados.length > 0 ||
      a.extras.length > 0,
    [a.selecciones, a.salteados, a.extras]
  );

  useEffect(() => {
    if (a.iniciado) tituloRef.current?.focus();
  }, [a.iniciado, a.paso, a.verResumen]);

  const basePaso = useMemo(() => {
    if (esExtras) {
      return a.productos.filter(
        (p) => !CATEGORIAS_PRINCIPALES.has((p.categoria || "").toLowerCase())
      );
    }
    return a.productos.filter((p) =>
      pasoDef.categorias.includes((p.categoria || "").toLowerCase())
    );
  }, [a.productos, esExtras, pasoDef]);

  const marcasPaso = useMemo(() => {
    const set = new Set();
    for (const p of basePaso) {
      const m = (p.marca || "").trim();
      if (m) set.add(m);
    }
    return [...set].sort((x, y) => x.localeCompare(y, "es"));
  }, [basePaso]);

  const rangoPrecio = useMemo(() => {
    let min = Infinity;
    let max = 0;
    for (const p of basePaso) {
      const v = precioFinal(p);
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (!Number.isFinite(min)) return { min: 0, max: 0 };
    return { min: Math.floor(min), max: Math.ceil(max) };
  }, [basePaso]);

  const candidatos = useMemo(() => {
    const f = a.filtros;
    const q = f.q.trim().toLowerCase();
    let lista = basePaso.filter((p) => {
      if (q && !`${p.nombre} ${p.marca}`.toLowerCase().includes(q)) {
        return false;
      }
      if (f.marca !== "todas" && (p.marca || "").trim() !== f.marca) {
        return false;
      }
      if (f.max != null && precioFinal(p) > f.max) return false;
      return true;
    });
    if (esExtras) {
      const dentro = new Set(a.extras.map(String));
      const ordenar = (x, y) => {
        const dx = dentro.has(String(x.producto.id)) ? 0 : 1;
        const dy = dentro.has(String(y.producto.id)) ? 0 : 1;
        if (dx !== dy) return dx - dy;
        return precioFinal(x.producto) - precioFinal(y.producto);
      };
      return lista
        .map((p) => ({ producto: p, estado: "compatible", motivo: "" }))
        .sort(ordenar);
    }
    let conEstado = lista.map((p) => ({
      producto: p,
      ...a.estadoCandidato(pasoDef, p),
    }));
    if (!f.verIncomp) {
      conEstado = conEstado.filter((c) => c.estado !== "incompatible");
    }
    const porPrecio = (x, y) =>
      precioFinal(x.producto) - precioFinal(y.producto);
    conEstado.sort((x, y) => {
      const r = RANGO_ESTADO[x.estado] - RANGO_ESTADO[y.estado];
      if (r !== 0) return r;
      if (f.orden === "precio-desc") return -porPrecio(x, y);
      if (f.orden === "nombre")
        return x.producto.nombre.localeCompare(y.producto.nombre, "es");
      return porPrecio(x, y);
    });
    return conEstado;
  }, [basePaso, a.filtros, a.extras, a.estadoCandidato, esExtras, pasoDef]);

  const global = estadoGlobal(a.evaluacion, a.cantidad, idioma);
  const seleccionadoActual = esExtras
    ? null
    : a.elegidos[a.paso]?.producto ?? null;

  const irAPaso = (i) => {
    a.setPaso(i);
    a.setVerResumen(false);
  };

  const siguiente = () => {
    if (a.paso < PASOS.length) {
      a.setPaso(a.paso + 1);
    } else {
      a.setVerResumen(true);
    }
    subir();
  };

  const atras = () => {
    if (a.verResumen) {
      a.setVerResumen(false);
      return;
    }
    if (a.paso > 0) a.setPaso(a.paso - 1);
    subir();
  };

  const resumenLinea = useMemo(() => {
    const { resumen } = a.evaluacion;
    if (a.cantidad === 0) return t(idioma, "arm.nadaAun");
    if (resumen.total === 0) return t(idioma, "arm.elegiDos");
    return `${resumen.ok} ${t(idioma, "arm.bien")}, ${resumen.warn} ${t(idioma, "arm.avisos")}, ${resumen.error} ${t(idioma, "arm.errores")}, ${resumen.unknown} ${t(idioma, "arm.pendientes")}.`;
  }, [a.evaluacion, a.cantidad, idioma]);

  /* ---------------- intro ---------------- */
  if (!a.iniciado) {
    return (
      <main className="armador">
        <section className="armador-intro" aria-labelledby="armador-titulo">
          <p className="armador-kicker">{t(idioma, "arm.kicker")}</p>
          <h1 id="armador-titulo" tabIndex={-1} ref={tituloRef}>
            {t(idioma, "arm.introT")}
          </h1>
          <p>
            {t(idioma, "arm.introS")} {TOTAL_PASOS} {t(idioma, "arm.introS2")}
          </p>
          <div className="armador-intro-acciones">
            <button
              type="button"
              className="ht-btn ht-btn-primary"
              onClick={() => a.setIniciado(true)}
            >
              <FaScrewdriverWrench aria-hidden="true" />
              {hayRestaurado ? t(idioma, "arm.seguir") : t(idioma, "arm.empezar")}
            </button>
            {hayRestaurado && (
              <button
                type="button"
                className="ht-btn ht-btn-ghost"
                onClick={() => {
                  a.reiniciar();
                  a.setIniciado(true);
                }}
              >
                <FaRotateLeft aria-hidden="true" /> {t(idioma, "arm.deCero")}
              </button>
            )}
          </div>
        </section>
      </main>
    );
  }

  /* ---------------- resumen ---------------- */
  if (a.verResumen) {
    return (
      <main className="armador">
        <button
          type="button"
          className="ht-btn ht-btn-ghost"
          onClick={atras}
          aria-label={t(idioma, "arm.volverUltimo")}
        >
          <FaArrowLeft aria-hidden="true" /> {t(idioma, "arm.volver")}
        </button>
        <h1 tabIndex={-1} ref={tituloRef} className="armador-titulo">
          {t(idioma, "arm.revisa")}
        </h1>
        <ArmadorResumen
          elegidos={a.elegidos}
          extrasElegidos={a.extrasElegidos}
          salteados={a.salteados}
          evaluacion={a.evaluacion}
          consumo={a.consumo}
          build={a.build}
          total={a.total}
          irAPaso={irAPaso}
        />
      </main>
    );
  }

  const pasoIndice = a.paso;

  /* ---------------- paso ---------------- */
  return (
    <main className="armador">
      {/* Stepper fijo */}
      <nav className="armador-stepper" aria-label={t(idioma, "arm.pasosDe")}>
        <p className="stepper-movil" aria-live="polite">
          {esExtras ? (
            <>{t(idioma, "arm.extrasOp")}</>
          ) : (
            <>
              {t(idioma, "arm.paso")} {pasoIndice + 1} {t(idioma, "arm.de2")} {TOTAL_PASOS}: {nombrePaso(pasoDef)}
            </>
          )}
        </p>
        <ol className="stepper-lista">
          {PASOS.map((p, i) => {
            const elegido = a.elegidos[i]?.producto;
            const salteado = a.salteados.includes(p.id);
            const actual = i === pasoIndice && !esExtras;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className={[
                    "stepper-chip",
                    actual ? "is-actual" : "",
                    elegido ? "is-ok" : "",
                    salteado && !elegido ? "is-salteado" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-current={actual ? "step" : undefined}
                  onClick={() => irAPaso(i)}
                  aria-label={`${t(idioma, "arm.paso")} ${i + 1}: ${nombrePaso(p)}${
                    elegido ? `, ${t(idioma, "arm.elegido")} ${elegido.nombre}` : ""
                  }${salteado && !elegido ? `, ${t(idioma, "arm.salteado")}` : ""}`}
                >
                  {elegido ? (
                    <FaCheck aria-hidden="true" className="pop" />
                  ) : (
                    <span aria-hidden="true">{i + 1}</span>
                  )}
                  {nombrePaso(p)}
                  {salteado && !elegido && (
                    <span className="chip-saltea">{t(idioma, "arm.salteadoC")}</span>
                  )}
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              className={`stepper-chip is-extras${esExtras ? " is-actual" : ""}`}
              aria-current={esExtras ? "step" : undefined}
              onClick={() => irAPaso(PASOS.length)}
            >
              {t(idioma, "arm.extras")}{a.extras.length > 0 && ` (${a.extras.length})`}
            </button>
          </li>
        </ol>
      </nav>

      <h1 tabIndex={-1} ref={tituloRef} className="armador-titulo">
        {esExtras ? t(idioma, "arm.sumaExtras") : `${t(idioma, "arm.elegiTu")} ${nombrePaso(pasoDef)}`}
      </h1>
      <p className="armador-ayuda">
        {esExtras
          ? t(idioma, "arm.ayudaExtras")
          : `${t(idioma, "arm.paso")} ${pasoIndice + 1} ${t(idioma, "arm.de2")} ${TOTAL_PASOS}. ${t(idioma, "arm.ayudaPaso")}`}
      </p>
      <p className="armador-live" aria-live="polite" role="status">
        {t(idioma, "arm.compatDe")} {resumenLinea}
      </p>

      {a.cargando && (
        <p className="estado-carga" role="status">
          {t(idioma, "arm.cargando")}
        </p>
      )}
      {a.errorCarga && !a.cargando && (
        <div className="estado-error" role="alert">
          <p>{t(idioma, "arm.errorCarga")}</p>
          <button
            type="button"
            className="ht-btn ht-btn-primary"
            onClick={a.reintentar}
          >
            {t(idioma, "arm.reintentar")}
          </button>
        </div>
      )}

      {!a.cargando && !a.errorCarga && (
        <>
          {/* Filtros del paso */}
          <form
            className="armador-filtros"
            aria-label={`${t(idioma, "arm.filtrosDe")} ${nombrePaso(pasoDef)}`}
            onSubmit={(e) => e.preventDefault()}
          >
            <label className="filtro">
              <span>{t(idioma, "arm.buscar")}</span>
              <input
                type="search"
                placeholder={`${t(idioma, "arm.buscarEn")} ${nombrePaso(pasoDef).toLowerCase()}…`}
                value={a.filtros.q}
                onChange={(e) => a.setFiltros({ q: e.target.value })}
                aria-label={`${t(idioma, "arm.buscarEn")} ${nombrePaso(pasoDef)}`}
              />
            </label>
            {marcasPaso.length > 0 && (
              <label className="filtro">
                <span>{t(idioma, "arm.marca")}</span>
                <select
                  value={a.filtros.marca}
                  onChange={(e) => a.setFiltros({ marca: e.target.value })}
                >
                  <option value="todas">{t(idioma, "arm.todas")}</option>
                  {marcasPaso.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {rangoPrecio.max > rangoPrecio.min && (
              <label className="filtro">
                <span>
                  {t(idioma, "arm.hasta")} $
                  {(a.filtros.max ?? rangoPrecio.max).toLocaleString("es-AR")}
                </span>
                <input
                  type="range"
                  min={rangoPrecio.min}
                  max={rangoPrecio.max}
                  step={1000}
                  value={a.filtros.max ?? rangoPrecio.max}
                  onChange={(e) =>
                    a.setFiltros({
                      max:
                        Number(e.target.value) >= rangoPrecio.max
                          ? null
                          : Number(e.target.value),
                    })
                  }
                  aria-label={t(idioma, "arm.precioMax")}
                />
              </label>
            )}
            {!esExtras && (
              <>
                <label className="filtro">
                  <span>{t(idioma, "arm.orden")}</span>
                  <select
                    value={a.filtros.orden}
                    onChange={(e) => a.setFiltros({ orden: e.target.value })}
                  >
                    <option value="reco">{t(idioma, "arm.reco")}</option>
                    <option value="precio-asc">{t(idioma, "arm.precioAsc")}</option>
                    <option value="precio-desc">{t(idioma, "arm.precioDesc")}</option>
                    <option value="nombre">{t(idioma, "arm.nombreAz")}</option>
                  </select>
                </label>
                <label className="filtro-check">
                  <input
                    type="checkbox"
                    checked={a.filtros.verIncomp}
                    onChange={(e) =>
                      a.setFiltros({ verIncomp: e.target.checked })
                    }
                  />
                  <span>{t(idioma, "arm.verIncomp")}</span>
                </label>
              </>
            )}
          </form>

          {seleccionadoActual && (
            <p className="armador-elegido" role="status">
              <FaCheck aria-hidden="true" /> {t(idioma, "arm.llevas")}:{" "}
              <strong>{seleccionadoActual.nombre}</strong> ($
              {precioFinal(seleccionadoActual).toLocaleString("es-AR")})
            </p>
          )}

          {candidatos.length === 0 ? (
            <p className="armador-vacio" role="status">
              {t(idioma, "arm.sinFiltros")}
            </p>
          ) : (
            <div className="armador-grilla">
              {candidatos.map(({ producto, estado, motivo }) => {
                if (esExtras) {
                  const dentro = a.extras
                    .map(String)
                    .includes(String(producto.id));
                  return (
                    <ArmadorCard
                      key={producto.id}
                      producto={producto}
                      estado="compatible"
                      motivo=""
                      elegido={dentro}
                      onElegir={() => a.toggleExtra(producto)}
                      onQuitar={() => a.toggleExtra(producto)}
                    />
                  );
                }
                const elegido =
                  String(seleccionadoActual?.id) === String(producto.id);
                const atenuado = estado === "incompatible";
                return (
                  <ArmadorCard
                    key={producto.id}
                    producto={producto}
                    estado={estado}
                    motivo={motivo}
                    elegido={elegido}
                    atenuado={atenuado}
                    onElegir={() => a.elegir(pasoDef, producto)}
                    onQuitar={() => a.quitar(pasoDef)}
                  />
                );
              })}
            </div>
          )}

          {/* Navegación del paso */}
          <div className="armador-nav">
            <button
              type="button"
              className="ht-btn ht-btn-ghost"
              disabled={pasoIndice === 0}
              onClick={atras}
            >
              <FaArrowLeft aria-hidden="true" /> {t(idioma, "arm.atras")}
            </button>
            {!esExtras && (
              <button
                type="button"
                className="ht-btn ht-btn-ghost"
                onClick={() => {
                  if (a.saltear(pasoDef)) siguiente();
                }}
              >
                <FaForward aria-hidden="true" /> {t(idioma, "arm.saltear")}
              </button>
            )}
            <button
              type="button"
              className="ht-btn ht-btn-primary"
              onClick={siguiente}
            >
              {pasoIndice >= PASOS.length ? (
                <>
                  {t(idioma, "arm.verResumen")} <FaArrowRight aria-hidden="true" />
                </>
              ) : (
                <>
                  {t(idioma, "arm.siguiente")}:{" "}
                  {pasoIndice + 1 < PASOS.length
                    ? nombrePaso(PASOS[pasoIndice + 1])
                    : t(idioma, "arm.extras")}{" "}
                  <FaArrowRight aria-hidden="true" />
                </>
              )}
            </button>
          </div>
          <button
            type="button"
            className="armador-reiniciar"
            onClick={a.reiniciar}
          >
            <FaRotateLeft aria-hidden="true" /> {t(idioma, "arm.reiniciar")}
          </button>
        </>
      )}

      {/* Barra fija */}
      <div className="armador-barra" role="status" aria-label={t(idioma, "armres.titulo")}>
        <span className="barra-total">
          {t(idioma, "arm.total")}: $<TotalAnimado valor={a.total} />
        </span>
        <span className="barra-cant">
          {a.cantidad} {a.cantidad === 1 ? t(idioma, "arm.pieza") : t(idioma, "arm.piezas")}
        </span>
        <span className={`barra-estado ${global.clase}`}>
          {global.clase === "is-ok" ? (
            <FaCircleCheck aria-hidden="true" />
          ) : global.clase === "is-error" ? (
            <FaCircleXmark aria-hidden="true" />
          ) : global.clase === "is-warn" ? (
            <FaTriangleExclamation aria-hidden="true" />
          ) : (
            <FaCircleQuestion aria-hidden="true" />
          )}
          {global.texto}
        </span>
        <span className="barra-consumo">
          {a.consumo == null
            ? t(idioma, "arm.consumoDef")
            : `${t(idioma, "arm.consumo")}: ~${a.consumo}W`}
        </span>
        <button
          type="button"
          className="ht-btn ht-btn-primary"
          onClick={siguiente}
          aria-label={t(idioma, "arm.seguirPaso")}
        >
          {t(idioma, "arm.siguiente")} <FaArrowRight aria-hidden="true" />
        </button>
      </div>
    </main>
  );
}

export default Armador;
