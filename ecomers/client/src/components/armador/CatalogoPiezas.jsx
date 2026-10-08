import { useEffect, useMemo, useState } from "react";
import PiezaCard from "./PiezaCard";
import "./CatalogoPiezas.css";

const TITULOS_PASO = {
  cpu: "Elegí tu procesador",
  motherboard: "Elegí tu placa madre",
  ram: "Elegí tu memoria RAM",
  gpu: "Elegí tu placa de video",
  almacenamiento: "Elegí tu almacenamiento",
  fuente: "Elegí tu fuente",
  gabinete: "Elegí tu gabinete",
  cooler: "Elegí tu refrigeración",
};

function CatalogoPiezas({ paso, nombrePaso, piezas, seleccionadaId, evaluaciones, onAccion }) {
  const [busqueda, setBusqueda] = useState("");
  const [marca, setMarca] = useState("todas");
  const [precioMin, setPrecioMin] = useState("");
  const [precioMax, setPrecioMax] = useState("");
  const [soloCompatibles, setSoloCompatibles] = useState(false);
  const [orden, setOrden] = useState("relevancia");

  useEffect(() => {
    setBusqueda("");
    setMarca("todas");
    setPrecioMin("");
    setPrecioMax("");
    setSoloCompatibles(false);
    setOrden("relevancia");
  }, [paso]);

  const marcas = useMemo(
    () => [...new Set(piezas.map((p) => p.marca))].sort(),
    [piezas]
  );

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const min = precioMin === "" ? null : Number(precioMin);
    const max = precioMax === "" ? null : Number(precioMax);
    const lista = piezas.filter((p) => {
      if (q && !`${p.marca} ${p.nombre}`.toLowerCase().includes(q)) return false;
      if (marca !== "todas" && p.marca !== marca) return false;
      if (min != null && Number.isFinite(min) && p.precio < min) return false;
      if (max != null && Number.isFinite(max) && p.precio > max) return false;
      if (soloCompatibles && p.id !== seleccionadaId && !evaluaciones[p.id]?.compatible) return false;
      return true;
    });
    if (orden === "precio-asc") lista.sort((a, b) => a.precio - b.precio);
    else if (orden === "precio-desc") lista.sort((a, b) => b.precio - a.precio);
    else if (orden === "nombre") lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    return lista;
  }, [piezas, busqueda, marca, precioMin, precioMax, soloCompatibles, orden, evaluaciones, seleccionadaId]);

  return (
    <section className="catalogo" aria-label={`Catálogo de ${nombrePaso}`}>
      <div className="catalogo__filtros" role="search" aria-label="Filtros del catálogo">
        <div className="filtro filtro--busqueda">
          <label htmlFor="armador-busqueda">Buscar</label>
          <input
            id="armador-busqueda"
            type="search"
            placeholder="Buscá por nombre o marca…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <div className="filtro filtro--precio">
          <label htmlFor="armador-min">Precio mín.</label>
          <input
            id="armador-min"
            type="number"
            min="0"
            inputMode="numeric"
            placeholder="0"
            value={precioMin}
            onChange={(e) => setPrecioMin(e.target.value)}
          />
        </div>
        <div className="filtro filtro--precio">
          <label htmlFor="armador-max">Precio máx.</label>
          <input
            id="armador-max"
            type="number"
            min="0"
            inputMode="numeric"
            placeholder="Sin tope"
            value={precioMax}
            onChange={(e) => setPrecioMax(e.target.value)}
          />
        </div>
        <div className="filtro">
          <label htmlFor="armador-orden">Ordenar</label>
          <select id="armador-orden" value={orden} onChange={(e) => setOrden(e.target.value)}>
            <option value="relevancia">Relevancia</option>
            <option value="precio-asc">Menor precio</option>
            <option value="precio-desc">Mayor precio</option>
            <option value="nombre">Nombre</option>
          </select>
        </div>
        <label className="filtro-check" htmlFor="armador-compatibles">
          <input
            id="armador-compatibles"
            type="checkbox"
            checked={soloCompatibles}
            onChange={(e) => setSoloCompatibles(e.target.checked)}
          />
          Solo compatibles
        </label>
      </div>

      <div className="marcas-pills" role="group" aria-label="Filtrar por marca">
        <button
          type="button"
          className={`marca-pill${marca === "todas" ? " is-activa" : ""}`}
          aria-pressed={marca === "todas"}
          onClick={() => setMarca("todas")}
        >
          Todas
        </button>
        {marcas.map((m) => (
          <button
            key={m}
            type="button"
            className={`marca-pill${marca === m ? " is-activa" : ""}`}
            aria-pressed={marca === m}
            onClick={() => setMarca(marca === m ? "todas" : m)}
          >
            {m}
          </button>
        ))}
      </div>

      <div key={paso} className="catalogo__panel">
        <p className="catalogo__titulo">
          {TITULOS_PASO[paso] ?? nombrePaso}{" "}
          <span className="catalogo__conteo">({filtradas.length})</span>
        </p>

        {filtradas.length === 0 ? (
          <p className="catalogo__vacio">
            No hay piezas con esos filtros. Probá aflojar la búsqueda o desactivá “Solo compatibles”.
          </p>
        ) : (
          <div className="catalogo__grilla">
            {filtradas.map((pieza, i) => {
              const esSeleccionada = pieza.id === seleccionadaId;
              const haySeleccion = seleccionadaId != null;
              return (
                <PiezaCard
                  key={pieza.id}
                  pieza={pieza}
                  indice={i}
                  estadoBoton={esSeleccionada ? "quitar" : haySeleccion ? "cambiar" : "agregar"}
                  evaluacion={esSeleccionada ? null : evaluaciones[pieza.id]}
                  onAccion={onAccion}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default CatalogoPiezas;
