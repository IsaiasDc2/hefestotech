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

function estadoGlobal(evaluacion, cantidad) {
  if (cantidad === 0) return { clase: "is-neutro", texto: "Sin armar" };
  const { resumen } = evaluacion;
  if (resumen.bloqueada) return { clase: "is-error", texto: "Con errores" };
  if (resumen.warn > 0) return { clase: "is-warn", texto: "Con avisos" };
  if (resumen.unknown > 0)
    return { clase: "is-warn", texto: "A revisar" };
  if (resumen.total === 0) return { clase: "is-neutro", texto: "Sin evaluar" };
  return { clase: "is-ok", texto: "Compatible" };
}

function Armador() {
  const a = useArmador();
  const tituloRef = useRef(null);

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

  const global = estadoGlobal(a.evaluacion, a.cantidad);
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const atras = () => {
    if (a.verResumen) {
      a.setVerResumen(false);
      return;
    }
    if (a.paso > 0) a.setPaso(a.paso - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resumenLinea = useMemo(() => {
    const { resumen } = a.evaluacion;
    if (a.cantidad === 0) return "Todavía no elegiste nada.";
    if (resumen.total === 0) return "Elegí al menos dos componentes y lo evaluamos.";
    return `${resumen.ok} bien, ${resumen.warn} avisos, ${resumen.error} errores, ${resumen.unknown} pendientes.`;
  }, [a.evaluacion, a.cantidad]);

  /* ---------------- intro ---------------- */
  if (!a.iniciado) {
    return (
      <main className="armador">
        <section className="armador-intro" aria-labelledby="armador-titulo">
          <p className="armador-kicker">Armá tu PC</p>
          <h1 id="armador-titulo" tabIndex={-1} ref={tituloRef}>
            Tu próxima PC, pieza por pieza
          </h1>
          <p>
            Te guiamos en {TOTAL_PASOS} pasos: elegís cada componente y te
            avisamos al toque si algo no combina. Nada de tuteo raro ni
            letra chica: si falta un dato, te lo decimos en vez de
            inventarlo.
          </p>
          <div className="armador-intro-acciones">
            <button
              type="button"
              className="ht-btn ht-btn-primary"
              onClick={() => a.setIniciado(true)}
            >
              <FaScrewdriverWrench aria-hidden="true" />
              {hayRestaurado ? "Seguir armando" : "Empezar"}
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
                <FaRotateLeft aria-hidden="true" /> Arrancar de cero
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
          aria-label="Volver al último paso"
        >
          <FaArrowLeft aria-hidden="true" /> Volver
        </button>
        <h1 tabIndex={-1} ref={tituloRef} className="armador-titulo">
          Revisá tu armado
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
      <nav className="armador-stepper" aria-label="Pasos del armado">
        <p className="stepper-movil" aria-live="polite">
          {esExtras ? (
            <>Extras (opcional)</>
          ) : (
            <>
              Paso {pasoIndice + 1} de {TOTAL_PASOS}: {pasoDef.titulo}
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
                  aria-label={`Paso ${i + 1}: ${p.titulo}${
                    elegido ? `, elegido ${elegido.nombre}` : ""
                  }${salteado && !elegido ? ", salteado" : ""}`}
                >
                  {elegido ? (
                    <FaCheck aria-hidden="true" className="pop" />
                  ) : (
                    <span aria-hidden="true">{i + 1}</span>
                  )}
                  {p.titulo}
                  {salteado && !elegido && (
                    <span className="chip-saltea">salteado</span>
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
              Extras{a.extras.length > 0 && ` (${a.extras.length})`}
            </button>
          </li>
        </ol>
      </nav>

      <h1 tabIndex={-1} ref={tituloRef} className="armador-titulo">
        {esExtras ? "Sumá extras (opcional)" : `Elegí tu ${pasoDef.titulo}`}
      </h1>
      <p className="armador-ayuda">
        {esExtras
          ? "Monitores, periféricos y más. No afectan la compatibilidad y podés saltear esta parte."
          : `Paso ${pasoIndice + 1} de ${TOTAL_PASOS}. Los compatibles van primero; si algo no combina, te decimos por qué.`}
      </p>
      <p className="armador-live" aria-live="polite" role="status">
        Compatibilidad de tu armado: {resumenLinea}
      </p>

      {a.cargando && (
        <p className="estado-carga" role="status">
          Cargando productos…
        </p>
      )}
      {a.errorCarga && !a.cargando && (
        <div className="estado-error" role="alert">
          <p>No pudimos cargar los productos.</p>
          <button
            type="button"
            className="ht-btn ht-btn-primary"
            onClick={a.reintentar}
          >
            Reintentar
          </button>
        </div>
      )}

      {!a.cargando && !a.errorCarga && (
        <>
          {/* Filtros del paso */}
          <form
            className="armador-filtros"
            aria-label={`Filtros de ${pasoDef.titulo}`}
            onSubmit={(e) => e.preventDefault()}
          >
            <label className="filtro">
              <span>Buscar</span>
              <input
                type="search"
                placeholder={`Buscar en ${pasoDef.titulo.toLowerCase()}…`}
                value={a.filtros.q}
                onChange={(e) => a.setFiltros({ q: e.target.value })}
                aria-label={`Buscar en ${pasoDef.titulo}`}
              />
            </label>
            {marcasPaso.length > 0 && (
              <label className="filtro">
                <span>Marca</span>
                <select
                  value={a.filtros.marca}
                  onChange={(e) => a.setFiltros({ marca: e.target.value })}
                >
                  <option value="todas">Todas</option>
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
                  Hasta $
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
                  aria-label="Precio máximo"
                />
              </label>
            )}
            {!esExtras && (
              <>
                <label className="filtro">
                  <span>Orden</span>
                  <select
                    value={a.filtros.orden}
                    onChange={(e) => a.setFiltros({ orden: e.target.value })}
                  >
                    <option value="reco">Recomendados</option>
                    <option value="precio-asc">Precio: menor a mayor</option>
                    <option value="precio-desc">Precio: mayor a menor</option>
                    <option value="nombre">Nombre A–Z</option>
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
                  <span>Mostrar incompatibles</span>
                </label>
              </>
            )}
          </form>

          {seleccionadoActual && (
            <p className="armador-elegido" role="status">
              <FaCheck aria-hidden="true" /> Llevás:{" "}
              <strong>{seleccionadoActual.nombre}</strong> ($
              {precioFinal(seleccionadoActual).toLocaleString("es-AR")})
            </p>
          )}

          {candidatos.length === 0 ? (
            <p className="armador-vacio" role="status">
              No hay productos con esos filtros. Aflojá con la búsqueda o
              el precio y probá de nuevo.
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
              <FaArrowLeft aria-hidden="true" /> Atrás
            </button>
            {!esExtras && (
              <button
                type="button"
                className="ht-btn ht-btn-ghost"
                onClick={() => {
                  if (a.saltear(pasoDef)) siguiente();
                }}
              >
                <FaForward aria-hidden="true" /> Saltear este paso
              </button>
            )}
            <button
              type="button"
              className="ht-btn ht-btn-primary"
              onClick={siguiente}
            >
              {pasoIndice >= PASOS.length ? (
                <>
                  Ver resumen <FaArrowRight aria-hidden="true" />
                </>
              ) : (
                <>
                  Siguiente:{" "}
                  {pasoIndice + 1 < PASOS.length
                    ? PASOS[pasoIndice + 1].titulo
                    : "Extras"}{" "}
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
            <FaRotateLeft aria-hidden="true" /> Arrancar de cero
          </button>
        </>
      )}

      {/* Barra fija */}
      <div className="armador-barra" role="status" aria-label="Resumen del armado">
        <span className="barra-total">
          Total: $<TotalAnimado valor={a.total} />
        </span>
        <span className="barra-cant">
          {a.cantidad} {a.cantidad === 1 ? "pieza" : "piezas"}
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
            ? "Consumo: a definir"
            : `Consumo: ~${a.consumo}W`}
        </span>
        <button
          type="button"
          className="ht-btn ht-btn-primary"
          onClick={siguiente}
          aria-label="Seguir al siguiente paso"
        >
          Siguiente <FaArrowRight aria-hidden="true" />
        </button>
      </div>
    </main>
  );
}

export default Armador;
