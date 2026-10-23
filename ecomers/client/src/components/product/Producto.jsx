import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { FaMagnifyingGlass, FaSliders, FaXmark } from "react-icons/fa6";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import useCatalogo from "../../hooks/useCatalogo";
import { CATEGORIAS, nombreCategoria, nombreCategoriaDb } from "../../constants/categorias";
import {
  ORDENES,
  POR_PAGINA,
  POR_PAGINA_OPCIONES,
  aplicarCatalogo,
  cantidadFiltrosActivos,
  filtrosAParams,
  leerFiltros,
  leerPaginacion,
} from "./catalogo";
import { formatearPesos } from "../../utils/dinero";
import { paginasVisibles, rangoVisible, totalPaginas } from "../../utils/paginacion";
import ProductCard from "./ProductCard";
import "./ProductCard.css";
import "./Catalogo.css";

const MARCAS_VISIBLES = 8;

/* Input con borrador local que se confirma con debounce. Si el valor
   externo cambia (link, "limpiar"), el borrador se resincroniza durante
   el render: patrón recomendado por React en vez de un efecto. */
function useBorrador(valor, alConfirmar, demora = 300) {
  const [borrador, setBorrador] = useState(valor);
  const [previo, setPrevio] = useState(valor);
  if (valor !== previo) {
    setPrevio(valor);
    if (borrador.trim() !== valor) setBorrador(valor);
  }
  useEffect(() => {
    if (borrador.trim() === valor) return undefined;
    const id = setTimeout(() => alConfirmar(borrador.trim()), demora);
    return () => clearTimeout(id);
  }, [borrador, valor, alConfirmar, demora]);
  return [borrador, setBorrador];
}

function Buscador({ valor, onCambio, idioma }) {
  const [borrador, setBorrador] = useBorrador(valor, onCambio);
  return (
    <div className="catl-buscador" role="search">
      <FaMagnifyingGlass className="catl-buscador-icono" aria-hidden="true" />
      <input
        type="search"
        enterKeyHint="search"
        value={borrador}
        onChange={(e) => setBorrador(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCambio(borrador.trim());
        }}
        placeholder={t(idioma, "filt.buscarPh")}
        aria-label={t(idioma, "filt.buscarAria")}
      />
      {borrador && (
        <button
          type="button"
          className="catl-icono-btn"
          aria-label={t(idioma, "filt.borrar")}
          onClick={() => {
            setBorrador("");
            onCambio("");
          }}
        >
          <FaXmark aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function RangoPrecio({ min, max, rango, onCambio, idioma }) {
  const id = useId();
  const confirmarMin = useCallback((v) => onCambio({ min: v ? Number(v) : null }), [onCambio]);
  const confirmarMax = useCallback((v) => onCambio({ max: v ? Number(v) : null }), [onCambio]);
  const [desde, setDesde] = useBorrador(min == null ? "" : String(min), confirmarMin, 600);
  const [hasta, setHasta] = useBorrador(max == null ? "" : String(max), confirmarMax, 600);
  const soloDigitos = (v) => v.replace(/\D/g, "").slice(0, 9);
  return (
    <div className="catl-rango">
      <label htmlFor={`${id}-min`}>
        <span>{t(idioma, "catl.desde")}</span>
        <input
          id={`${id}-min`}
          inputMode="numeric"
          autoComplete="off"
          placeholder={rango.min ? formatearPesos(rango.min) : "$"}
          value={desde}
          onChange={(e) => setDesde(soloDigitos(e.target.value))}
        />
      </label>
      <label htmlFor={`${id}-max`}>
        <span>{t(idioma, "catl.hasta")}</span>
        <input
          id={`${id}-max`}
          inputMode="numeric"
          autoComplete="off"
          placeholder={rango.max ? formatearPesos(rango.max) : "$"}
          value={hasta}
          onChange={(e) => setHasta(soloDigitos(e.target.value))}
        />
      </label>
    </div>
  );
}

function PanelFiltros({ filtros, facetas, cambiar, idioma, sufijo }) {
  const [todasMarcas, setTodasMarcas] = useState(false);
  const marcas = todasMarcas ? facetas.marcas : facetas.marcas.slice(0, MARCAS_VISIBLES);
  const nombreGrupo = `catl-cat-${sufijo}`;

  const alternarMarca = (nombre) => {
    const activas = filtros.marcas.includes(nombre)
      ? filtros.marcas.filter((m) => m !== nombre)
      : [...filtros.marcas, nombre];
    cambiar({ marcas: activas });
  };

  return (
    <div className="catl-panel">
      <fieldset className="catl-grupo">
        <legend>{t(idioma, "catl.categoria")}</legend>
        <label className="catl-opcion">
          <input
            type="radio"
            name={nombreGrupo}
            checked={filtros.categoria === "Todas"}
            onChange={() => cambiar({ categoria: "Todas", marcas: [] })}
          />
          <span>{t(idioma, "filt.todas")}</span>
        </label>
        {facetas.categorias.map((c) => (
          <label key={c.value} className="catl-opcion">
            <input
              type="radio"
              name={nombreGrupo}
              checked={filtros.categoria === c.value}
              onChange={() => cambiar({ categoria: c.value, marcas: [] })}
            />
            <span>{nombreCategoriaDb(c.value, idioma)}</span>
            <span className="catl-conteo">{c.conteo}</span>
          </label>
        ))}
      </fieldset>

      {facetas.marcas.length > 0 && (
        <fieldset className="catl-grupo">
          <legend>{t(idioma, "catl.marca")}</legend>
          {marcas.map((m) => (
            <label key={m.nombre} className="catl-opcion">
              <input
                type="checkbox"
                checked={filtros.marcas.includes(m.nombre)}
                disabled={m.conteo === 0 && !filtros.marcas.includes(m.nombre)}
                onChange={() => alternarMarca(m.nombre)}
              />
              <span>{m.nombre}</span>
              <span className="catl-conteo">{m.conteo}</span>
            </label>
          ))}
          {facetas.marcas.length > MARCAS_VISIBLES && (
            <button
              type="button"
              className="catl-link"
              aria-expanded={todasMarcas}
              onClick={() => setTodasMarcas((v) => !v)}
            >
              {todasMarcas ? t(idioma, "catl.verMenosMarcas") : t(idioma, "catl.verMasMarcas")}
            </button>
          )}
        </fieldset>
      )}

      <fieldset className="catl-grupo">
        <legend>{t(idioma, "catl.precio")}</legend>
        <RangoPrecio
          min={filtros.min}
          max={filtros.max}
          rango={facetas.rangoPrecios}
          onCambio={cambiar}
          idioma={idioma}
        />
      </fieldset>

      <fieldset className="catl-grupo">
        <legend>{t(idioma, "catl.disponibilidad")}</legend>
        <label className="catl-opcion">
          <input
            type="checkbox"
            checked={filtros.stock}
            onChange={(e) => cambiar({ stock: e.target.checked })}
          />
          <span>{t(idioma, "catl.conStock")}</span>
          <span className="catl-conteo">{facetas.conStock}</span>
        </label>
        <label className="catl-opcion">
          <input
            type="checkbox"
            checked={filtros.ofertas}
            onChange={(e) => cambiar({ ofertas: e.target.checked })}
          />
          <span>{t(idioma, "catl.enOferta")}</span>
          <span className="catl-conteo">{facetas.enOferta}</span>
        </label>
      </fieldset>
    </div>
  );
}

function ChipsActivos({ filtros, cambiar, limpiar, idioma }) {
  const chips = [];
  if (filtros.q) chips.push({ k: "q", texto: `“${filtros.q}”`, quitar: { q: "" } });
  if (filtros.categoria !== "Todas") {
    const label = nombreCategoriaDb(filtros.categoria, idioma);
    chips.push({ k: "cat", texto: label, quitar: { categoria: "Todas", marcas: [] } });
  }
  for (const m of filtros.marcas) {
    chips.push({ k: `m-${m}`, texto: m, quitar: { marcas: filtros.marcas.filter((x) => x !== m) } });
  }
  if (filtros.min != null || filtros.max != null) {
    const desde = filtros.min != null ? formatearPesos(filtros.min) : "$0";
    const hasta = filtros.max != null ? formatearPesos(filtros.max) : "∞";
    chips.push({ k: "precio", texto: `${desde} – ${hasta}`, quitar: { min: null, max: null } });
  }
  if (filtros.stock) chips.push({ k: "stock", texto: t(idioma, "catl.conStock"), quitar: { stock: false } });
  if (filtros.ofertas) chips.push({ k: "of", texto: t(idioma, "catl.enOferta"), quitar: { ofertas: false } });
  if (chips.length === 0) return null;

  return (
    <ul className="catl-chips" aria-label={t(idioma, "filt.activos")}>
      {chips.map((c) => (
        <li key={c.k}>
          <button
            type="button"
            className="catl-chip"
            aria-label={`${t(idioma, "catl.quitar")}: ${c.texto}`}
            onClick={() => cambiar(c.quitar)}
          >
            {c.texto}
            <FaXmark aria-hidden="true" />
          </button>
        </li>
      ))}
      {chips.length > 1 && (
        <li>
          <button type="button" className="catl-link" onClick={limpiar}>
            {t(idioma, "filt.limpiar")}
          </button>
        </li>
      )}
    </ul>
  );
}

/* Paginación numerada. La página vive en la URL (?pagina=2): Atrás, recargar
   y compartir funcionan. En pantallas angostas queda "‹ 2 / 5 ›". */
function PaginadorTienda({ total, pagina, por, onPagina, onPor, idioma }) {
  const cantidad = totalPaginas(total, por);
  const { desde, hasta } = rangoVisible(pagina, por, total);
  return (
    <nav className="catl-paginacion" aria-label={t(idioma, "catl.paginacion")}>
      <p role="status" aria-live="polite">
        {t(idioma, "catl.mostrando")} {desde}–{hasta} {t(idioma, "catl.de")} {total}
      </p>
      {cantidad > 1 && (
        <div className="catl-pag-botones">
          <button
            type="button"
            className="catl-pag-nav"
            onClick={() => onPagina(pagina - 1)}
            disabled={pagina <= 1}
            aria-label={`${t(idioma, "catl.anterior")}`}
          >
            ‹<span className="catl-pag-texto"> {t(idioma, "catl.anterior")}</span>
          </button>
          <span className="catl-pag-numeros">
            {paginasVisibles(pagina, cantidad).map((n, i) =>
              n === "…" ? (
                <span key={`p${i}`} className="catl-pag-puntos" aria-hidden="true">…</span>
              ) : (
                <button
                  key={n}
                  type="button"
                  className={`catl-pag-num${n === pagina ? " es-actual" : ""}`}
                  onClick={() => onPagina(n)}
                  aria-current={n === pagina ? "page" : undefined}
                  aria-label={`${t(idioma, "catl.pagina")} ${n}`}
                >
                  {n}
                </button>
              )
            )}
          </span>
          <span className="catl-pag-compacto" aria-hidden="true">{pagina} / {cantidad}</span>
          <button
            type="button"
            className="catl-pag-nav"
            onClick={() => onPagina(pagina + 1)}
            disabled={pagina >= cantidad}
            aria-label={`${t(idioma, "catl.siguiente")}`}
          >
            <span className="catl-pag-texto">{t(idioma, "catl.siguiente")} </span>›
          </button>
        </div>
      )}
      <label className="catl-pag-por">
        <span>{t(idioma, "catl.porPagina")}</span>
        <select value={por} onChange={(e) => onPor(Number(e.target.value))}>
          {POR_PAGINA_OPCIONES.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>
    </nav>
  );
}

function Productos({ agregarAlCarrito }) {
  const idioma = useIdiomaStore((s) => s.idioma);
  const { productos, cargando, error, reintentar } = useCatalogo();
  const [params, setParams] = useSearchParams();
  const filtros = useMemo(() => leerFiltros(params), [params]);
  const facetas = useMemo(() => aplicarCatalogo(productos, filtros), [productos, filtros]);
  const dialogoRef = useRef(null);

  const cambiar = useCallback(
    (parcial) => {
      setParams(
        (actuales) => {
          // Cambiar un filtro vuelve a la página 1 (no se copia `pagina`),
          // pero el tamaño de página elegido se conserva.
          const siguiente = filtrosAParams({ ...leerFiltros(actuales), ...parcial });
          const por = actuales.get("por");
          if (por) siguiente.por = por;
          return siguiente;
        },
        // La búsqueda tipeada reemplaza la entrada del historial: "atrás"
        // no tiene que recorrer cada letra.
        { replace: "q" in parcial || "min" in parcial || "max" in parcial }
      );
    },
    [setParams]
  );
  const cambiarBusqueda = useCallback((q) => cambiar({ q }), [cambiar]);
  const limpiar = useCallback(() => setParams({}), [setParams]);

  const total = facetas.resultados.length;
  const { por, pagina } = leerPaginacion(params, total);
  const visibles = facetas.resultados.slice((pagina - 1) * por, pagina * por);

  const irPagina = (n) => {
    setParams((actuales) => {
      const siguiente = Object.fromEntries(actuales);
      if (n <= 1) delete siguiente.pagina;
      else siguiente.pagina = String(n);
      return siguiente;
    });
    document.getElementById("catl-titulo")?.scrollIntoView?.({ block: "start" });
  };
  const cambiarPor = (n) => {
    setParams((actuales) => {
      const siguiente = Object.fromEntries(actuales);
      delete siguiente.pagina;
      if (n === POR_PAGINA) delete siguiente.por;
      else siguiente.por = String(n);
      return siguiente;
    });
  };
  const activos = cantidadFiltrosActivos(filtros);
  const categoriaActual = CATEGORIAS.find((c) => c.db === filtros.categoria);
  const etiquetaCategoria = categoriaActual ? nombreCategoria(categoriaActual, idioma) : undefined;
  const titulo = filtros.q
    ? `${t(idioma, "catl.resultadosPara")} “${filtros.q}”`
    : etiquetaCategoria ??
      (filtros.ofertas ? t(idioma, "prod.ofertas") : t(idioma, "prod.tituloGeneral"));
  const unidad = total === 1 ? t(idioma, "catl.producto") : t(idioma, "catl.productos");

  const panel = (sufijo) => (
    <PanelFiltros
      filtros={filtros}
      facetas={facetas}
      cambiar={cambiar}
      idioma={idioma}
      sufijo={sufijo}
    />
  );

  return (
    <section className="catl" aria-labelledby="catl-titulo">
      <header className="catl-cabecera">
        <nav aria-label={t(idioma, "pd.migas")} className="catl-migas">
          <Link to="/">{t(idioma, "pd.inicio")}</Link>
          <span aria-hidden="true">/</span>
          {etiquetaCategoria ? (
            <>
              <Link to="/productos">{t(idioma, "pd.catalogo")}</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{etiquetaCategoria}</span>
            </>
          ) : (
            <span aria-current="page">{t(idioma, "pd.catalogo")}</span>
          )}
        </nav>
        <h1 id="catl-titulo">{titulo}</h1>
      </header>

      <div className="catl-barra">
        <Buscador valor={filtros.q} onCambio={cambiarBusqueda} idioma={idioma} />
        <button
          type="button"
          className="catl-btn-filtros"
          aria-haspopup="dialog"
          onClick={() => dialogoRef.current?.showModal()}
        >
          <FaSliders aria-hidden="true" />
          {t(idioma, "filt.filtros")}
          {activos > 0 && <span className="catl-badge">{activos}</span>}
        </button>
        <label className="catl-orden">
          <span>{t(idioma, "catl.ordenar")}</span>
          <select value={filtros.orden} onChange={(e) => cambiar({ orden: e.target.value })}>
            {ORDENES.map((o) => (
              <option key={o} value={o}>
                {t(idioma, `catl.o.${o}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="catl-layout">
        <aside className="catl-lateral" aria-label={t(idioma, "filt.titulo")}>
          {panel("lateral")}
        </aside>

        <dialog
          ref={dialogoRef}
          className="catl-dialogo"
          aria-label={t(idioma, "filt.titulo")}
          onClick={(e) => {
            if (e.target === e.currentTarget) e.currentTarget.close();
          }}
        >
          <div className="catl-dialogo-cuerpo">
            <div className="catl-dialogo-cabecera">
              <h2>{t(idioma, "filt.filtros")}</h2>
              <button
                type="button"
                className="catl-icono-btn"
                aria-label={t(idioma, "filt.cerrar")}
                onClick={() => dialogoRef.current?.close()}
              >
                <FaXmark aria-hidden="true" />
              </button>
            </div>
            {panel("movil")}
            <div className="catl-dialogo-pie">
              {activos > 0 && (
                <button type="button" className="catl-btn-secundario" onClick={limpiar}>
                  {t(idioma, "filt.limpiar")}
                </button>
              )}
              <button
                type="button"
                className="catl-btn-primario"
                onClick={() => dialogoRef.current?.close()}
              >
                {t(idioma, "filt.ver")} {total} {unidad}
              </button>
            </div>
          </div>
        </dialog>

        <div className="catl-resultados">
          <div className="catl-estado">
            <p role="status" aria-live="polite" className="catl-total">
              {cargando ? t(idioma, "prod.cargando") : `${total} ${unidad}`}
            </p>
            <ChipsActivos filtros={filtros} cambiar={cambiar} limpiar={limpiar} idioma={idioma} />
          </div>

          {cargando && productos.length === 0 ? (
            <div className="catl-grilla" aria-hidden="true">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="card-skeleton" />
              ))}
            </div>
          ) : error ? (
            <div className="catl-vacio" role="alert">
              <p className="catl-vacio-titulo">{t(idioma, "prod.errorTitulo")}</p>
              <p>{t(idioma, "prod.errorTexto")}</p>
              <button type="button" className="catl-btn-primario" onClick={reintentar}>
                {t(idioma, "prod.reintentar")}
              </button>
            </div>
          ) : total === 0 ? (
            <div className="catl-vacio">
              <p className="catl-vacio-titulo">{t(idioma, "prod.vacio")}</p>
              <p>{t(idioma, "catl.vacioTexto")}</p>
              {activos > 0 && (
                <button type="button" className="catl-btn-secundario" onClick={limpiar}>
                  {t(idioma, "filt.limpiar")}
                </button>
              )}
            </div>
          ) : (
            <>
              <ul className="catl-grilla">
                {visibles.map((p, i) => (
                  <li key={p.id} style={{ "--i": i }}>
                    <ProductCard
                      producto={p}
                      agregarAlCarrito={agregarAlCarrito}
                      prioridad={i < 4}
                    />
                  </li>
                ))}
              </ul>
              {total > POR_PAGINA_OPCIONES[0] && (
                <PaginadorTienda
                  total={total}
                  pagina={pagina}
                  por={por}
                  onPagina={irPagina}
                  onPor={cambiarPor}
                  idioma={idioma}
                />
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default Productos;
