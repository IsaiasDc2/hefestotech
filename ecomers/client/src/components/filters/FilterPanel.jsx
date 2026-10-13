import { useEffect, useId, useRef, useState } from "react";
import {
  FaBoxesStacked,
  FaDesktop,
  FaFire,
  FaHardDrive,
  FaKeyboard,
  FaMagnifyingGlass,
  FaMemory,
  FaMicrochip,
  FaXmark,
} from "react-icons/fa6";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import "./FilterPanel.css";


export const ICONOS_CATEGORIA = {
  Todas: FaBoxesStacked,
  Procesador: FaMicrochip,
  "Placa de video": FaDesktop,
  "Memoria RAM": FaMemory,
  Almacenamiento: FaHardDrive,
  Periferico: FaKeyboard,
  Ofertas: FaFire,
};

const TODAS = "Todas";

function iconoPara(value, label) {
  return ICONOS_CATEGORIA[value] ?? ICONOS_CATEGORIA[label] ?? FaBoxesStacked;
}

function monograma(nombre) {
  const limpio = (nombre ?? "").trim();
  return limpio ? limpio.charAt(0).toUpperCase() : "?";
}


function FilterPanel({
  texto,
  onTexto,
  categoria,
  onCategoria,
  marcas,
  onMarcas,
  categorias = [],
  marcasDisponibles = [],
  conteosCategoria = {},
  total = 0,
  totalCatalogo = null,
  onLimpiar,
}) {
  const [borrador, setBorrador] = useState(texto ?? "");
  const [abierto, setAbierto] = useState(false);
  const abrirRef = useRef(null);
  const dialogoRef = useRef(null);
  const baseId = useId();
  const idioma = useIdiomaStore((s) => s.idioma);
  const TODAS_T = t(idioma, "filt.todas");

  useEffect(() => {
    setBorrador(texto ?? "");
  }, [texto]);

  useEffect(() => {
    if (borrador === texto) return undefined;
    const t = setTimeout(() => onTexto(borrador), 250);
    return () => clearTimeout(t);
  }, [borrador, texto, onTexto]);

  useEffect(() => {
    if (!abierto) return undefined;
    const alTeclar = (e) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("keydown", alTeclar);
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogoRef.current?.querySelector("button")?.focus();
    return () => {
      document.removeEventListener("keydown", alTeclar);
      document.body.style.overflow = previo;
      abrirRef.current?.focus();
    };
  }, [abierto]);

  const listaMarcas = Array.isArray(marcas) ? marcas : [];
  const hayTexto = (texto ?? "").trim() !== "";
  const hayCategoria = categoria !== TODAS;
  const hayMarcas = listaMarcas.length > 0;
  const hayFiltro = hayTexto || hayCategoria || hayMarcas;
  const cantidadFiltros = (hayTexto ? 1 : 0) + (hayCategoria ? 1 : 0) + listaMarcas.length;

  const totalTodas = Object.values(conteosCategoria).reduce(
    (acc, n) => acc + (Number(n) || 0),
    0
  );

  const marcasOrdenadas = [...marcasDisponibles].sort(
    (a, b) => b.conteo - a.conteo || a.nombre.localeCompare(b.nombre, "es")
  );

  const alternarMarca = (nombre) => {
    if (listaMarcas.includes(nombre)) onMarcas(listaMarcas.filter((m) => m !== nombre));
    else onMarcas([...listaMarcas, nombre]);
  };

  const conteoTexto =
    totalCatalogo == null
      ? `${total} ${total === 1 ? t(idioma, "filt.producto") : t(idioma, "filt.productos")}`
      : `${t(idioma, "filt.mostrando")} ${total} ${t(idioma, "filt.de")} ${totalCatalogo}`;

  const verResultados = `${t(idioma, "filt.ver")} ${total} ${total === 1 ? t(idioma, "filt.resultado") : t(idioma, "filt.resultados")}`;

  const pintarCategorias = (sufijo) => (
    <div className="fp-categorias" role="radiogroup" aria-label={t(idioma, "filt.porCategoria")}>
      {[{ label: TODAS_T, value: TODAS }, ...categorias].map((c) => {
        const Icono = iconoPara(c.value, c.label);
        const activo = categoria === c.value;
        const conteo = c.value === TODAS ? totalTodas : Number(conteosCategoria[c.value] ?? 0);
        const apagado = !activo && conteo === 0;
        return (
          <button
            key={`${sufijo}-${c.value}`}
            type="button"
            role="radio"
            aria-checked={activo}
            disabled={apagado}
            className={`fp-chip${activo ? " fp-chip--activo" : ""}${apagado ? " fp-chip--apagado" : ""}`}
            onClick={() => onCategoria(c.value)}
          >
            <Icono aria-hidden="true" />
            <span>{c.label}</span>
            <span className="fp-conteo">{conteo}</span>
          </button>
        );
      })}
    </div>
  );

  const pintarMarcas = (sufijo) => (
    <div className="fp-marcas">
      <p className="fp-etiqueta" id={`${baseId}-marcas${sufijo}`}>
        {t(idioma, "filt.marcas")}
      </p>
      <div
        className="fp-marcas-scroll"
        role="group"
        aria-labelledby={`${baseId}-marcas${sufijo}`}
      >
        {marcasOrdenadas.map((m) => {
          const activa = listaMarcas.includes(m.nombre);
          const apagada = !activa && m.conteo === 0;
          return (
            <button
              key={`${sufijo}-${m.nombre}`}
              type="button"
              aria-pressed={activa}
              aria-label={`${t(idioma, "filt.filtrarPor")} ${m.nombre}`}
              disabled={apagada}
              className={`fp-marca${activa ? " fp-marca--activa" : ""}${apagada ? " fp-marca--apagada" : ""}`}
              onClick={() => alternarMarca(m.nombre)}
            >
              <span className="fp-monograma" aria-hidden="true">
                {monograma(m.nombre)}
              </span>
              <span>{m.nombre}</span>
              <span className="fp-conteo">{m.conteo}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <section className="filter-panel" aria-label={t(idioma, "filt.titulo")}>
      <div className="fp-buscador">
        <FaMagnifyingGlass className="fp-lupa" aria-hidden="true" />
        <input
          type="search"
          className="fp-input"
          placeholder={t(idioma, "filt.buscarPh")}
          aria-label={t(idioma, "filt.buscarAria")}
          value={borrador}
          onChange={(e) => setBorrador(e.target.value)}
        />
        {borrador !== "" && (
          <button
            type="button"
            className="fp-borrar"
            aria-label={t(idioma, "filt.borrar")}
            onClick={() => {
              setBorrador("");
              onTexto("");
            }}
          >
            <FaXmark aria-hidden="true" />
          </button>
        )}
      </div>

      {pintarCategorias("base")}

      <div className="fp-solo-desktop">{pintarMarcas("base")}</div>

      {hayFiltro && (
        <ul className="fp-activos" aria-label={t(idioma, "filt.activos")}>
          {hayTexto && (
            <li>
              <button type="button" className="fp-activo" onClick={() => onTexto("")}>
                {t(idioma, "filt.busqueda")}: {texto.trim()} <FaXmark aria-hidden="true" />
              </button>
            </li>
          )}
          {hayCategoria && (
            <li>
              <button type="button" className="fp-activo" onClick={() => onCategoria(TODAS)}>
                {categoria} <FaXmark aria-hidden="true" />
              </button>
            </li>
          )}
          {listaMarcas.map((m) => (
            <li key={m}>
              <button type="button" className="fp-activo" onClick={() => alternarMarca(m)}>
                {m} <FaXmark aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="fp-pie">
        <p className="fp-conteo-total" role="status" aria-live="polite">
          {conteoTexto}
        </p>
        {hayFiltro && (
          <button type="button" className="fp-limpiar" onClick={onLimpiar}>
            {t(idioma, "filt.limpiar")}
          </button>
        )}
      </div>

      {total === 0 && (
        <div className="fp-vacio">
          <p className="fp-vacio-titulo">{t(idioma, "filt.sinTitulo")}</p>
          <p className="fp-vacio-texto">{t(idioma, "filt.sinTexto")}</p>
          {hayFiltro && (
            <button type="button" className="fp-limpiar" onClick={onLimpiar}>
              {t(idioma, "filt.limpiar")}
            </button>
          )}
        </div>
      )}

      <button
        ref={abrirRef}
        type="button"
        className="fp-abrir"
        aria-haspopup="dialog"
        onClick={() => setAbierto(true)}
      >
        {t(idioma, "filt.filtros")}{cantidadFiltros > 0 ? ` (${cantidadFiltros})` : ""}
      </button>

      {abierto && (
        <div className="fp-velo" onClick={() => setAbierto(false)}>
          <div
            ref={dialogoRef}
            role="dialog"
            aria-modal="true"
            aria-label={t(idioma, "filt.titulo")}
            className="fp-dialogo"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="fp-dialogo-barra" aria-hidden="true" />
            <button
              type="button"
              className="fp-cerrar"
              aria-label={t(idioma, "filt.cerrar")}
              onClick={() => setAbierto(false)}
            >
              <FaXmark aria-hidden="true" />
            </button>
            {pintarCategorias("movil")}
            {pintarMarcas("movil")}
            <div className="fp-dialogo-acciones">
              <button type="button" className="fp-ver" onClick={() => setAbierto(false)}>
                {verResultados}
              </button>
              {hayFiltro && (
                <button type="button" className="fp-limpiar" onClick={onLimpiar}>
                  {t(idioma, "filt.limpiar")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default FilterPanel;
