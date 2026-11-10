// HefestoTech · Admin · altas especiales del catálogo: ofertas, notebooks,
// PC armadas y combos. Todo termina siendo un producto; cambia qué se pide:
// - Notebook: ficha técnica (procesador, RAM, pantalla…).
// - PC armada / Combo: componentes del catálogo + precio sugerido por suma.
// - Oferta: un producto existente con % de descuento.
// El precio que se cobra lo recalcula siempre el backend.
import { useState } from "react";
import { FaMagnifyingGlass, FaMinus, FaPlus, FaTag, FaXmark } from "react-icons/fa6";
import { adminApi, formatoARS } from "./adminApi";
import { centavosDe, precioConDescuento } from "./altaEspecialUtil";

// Buscador de componentes del catálogo + lista elegida con cantidades.
export function SelectorComponentes({ elegidos, onCambio, onUsarSuma }) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState("");

  const buscar = async () => {
    if (!q.trim()) return;
    setBuscando(true);
    setError("");
    try {
      const r = await adminApi.productos({ busqueda: q, limit: 8 });
      setResultados(r?.productos ?? []);
    } catch (e) {
      setError(e?.message ?? "No se pudo buscar.");
    } finally {
      setBuscando(false);
    }
  };

  const agregar = (p) => {
    const ya = elegidos.find((c) => c.id === p.id);
    if (ya) {
      onCambio(elegidos.map((c) => (c.id === p.id ? { ...c, cantidad: Math.min(20, c.cantidad + 1) } : c)));
    } else {
      onCambio([...elegidos, { id: p.id, nombre: p.nombre, centavos: centavosDe(p), cantidad: 1 }]);
    }
  };
  const cambiarCantidad = (id, delta) =>
    onCambio(
      elegidos
        .map((c) => (c.id === id ? { ...c, cantidad: Math.min(20, c.cantidad + delta) } : c))
        .filter((c) => c.cantidad > 0)
    );
  const suma = elegidos.reduce((acc, c) => acc + (c.centavos ?? 0) * c.cantidad, 0);

  return (
    <fieldset className="adm-componentes">
      <legend>Componentes incluidos</legend>
      <div className="adm-buscador-linea">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              buscar();
            }
          }}
          placeholder="Buscar en el catálogo (ej. RTX, Ryzen)…"
          aria-label="Buscar componentes"
        />
        <button type="button" className="btn-fantasma adm-btn" onClick={buscar} disabled={buscando}>
          <FaMagnifyingGlass aria-hidden="true" /> {buscando ? "Buscando…" : "Buscar"}
        </button>
      </div>
      {error && <p className="adm-error" role="alert">{error}</p>}
      {resultados.length > 0 && (
        <ul className="adm-componentes-resultados">
          {resultados.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => agregar(p)}>
                {p.imagen ? <img src={p.imagen} alt="" width={32} height={32} loading="lazy" /> : <span className="adm-componentes-sinfoto" />}
                <span className="adm-componentes-nombre">{p.nombre}</span>
                <span className="adm-muted">{formatoARS(centavosDe(p))}</span>
                <FaPlus aria-hidden="true" />
                <span className="sr-only">Agregar</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {elegidos.length === 0 ? (
        <p className="adm-muted">Todavía no agregaste componentes.</p>
      ) : (
        <>
          <ul className="adm-componentes-elegidos">
            {elegidos.map((c) => (
              <li key={c.id}>
                <span className="adm-componentes-nombre">{c.nombre}</span>
                <span className="adm-componentes-cantidad">
                  <button type="button" onClick={() => cambiarCantidad(c.id, -1)} aria-label={`Quitar uno de ${c.nombre}`}>
                    <FaMinus aria-hidden="true" />
                  </button>
                  <span>{c.cantidad}</span>
                  <button type="button" onClick={() => cambiarCantidad(c.id, 1)} aria-label={`Sumar uno de ${c.nombre}`}>
                    <FaPlus aria-hidden="true" />
                  </button>
                </span>
                <button
                  type="button"
                  className="adm-componentes-quitar"
                  onClick={() => onCambio(elegidos.filter((x) => x.id !== c.id))}
                  aria-label={`Sacar ${c.nombre}`}
                >
                  <FaXmark aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          {suma > 0 && (
            <p className="adm-componentes-suma">
              Suma de componentes: <strong>{formatoARS(suma)}</strong>{" "}
              <button type="button" className="btn-fantasma adm-mini" onClick={() => onUsarSuma(suma / 100)}>
                Usar como precio
              </button>
            </p>
          )}
        </>
      )}
    </fieldset>
  );
}

// Ficha técnica: un campo por dato del tipo elegido.
export function FichaTecnica({ campos, valores, onCambio }) {
  if (!campos?.length) return null;
  return (
    <fieldset className="adm-ficha">
      <legend>Ficha técnica</legend>
      <div className="adm-fila-2">
        {campos.map((campo) => (
          <label key={campo}>
            {campo}
            <input
              value={valores[campo] ?? ""}
              onChange={(e) => onCambio({ ...valores, [campo]: e.target.value })}
              maxLength={300}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// Descuento + destacado, con el precio final en vivo.
export function CamposOferta({ precio, descuento, destacado, onDescuento, onDestacado }) {
  const final = precioConDescuento(precio, descuento);
  const hayOferta = Number(descuento) > 0 && Number(precio) > 0;
  return (
    <div className="adm-oferta-campos">
      <label>
        Descuento (%)
        <input
          type="number"
          min="0"
          max="90"
          step="1"
          value={descuento}
          onChange={(e) => onDescuento(e.target.value)}
        />
      </label>
      <label className="adm-check">
        <input type="checkbox" checked={destacado} onChange={(e) => onDestacado(e.target.checked)} />
        Destacado en el inicio
      </label>
      {hayOferta && (
        <p className="adm-oferta-preview">
          <FaTag aria-hidden="true" /> Se cobra{" "}
          <strong>{formatoARS(Math.round(final * 100))}</strong>{" "}
          <span className="adm-muted">(antes {formatoARS(Math.round(Number(precio) * 100))})</span>
        </p>
      )}
    </div>
  );
}

// Poner en oferta un producto que ya existe: buscar, elegir, % y listo.
export function PanelOferta({ avisar, onListo, onCerrar }) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState([]);
  const [elegido, setElegido] = useState(null);
  const [descuento, setDescuento] = useState("10");
  const [destacado, setDestacado] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const buscar = async () => {
    if (!q.trim()) return;
    try {
      const r = await adminApi.productos({ busqueda: q, limit: 8 });
      setResultados(r?.productos ?? []);
    } catch (e) {
      avisar(e?.message ?? "No se pudo buscar.", { tono: "error" });
    }
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!elegido) return;
    setGuardando(true);
    try {
      await adminApi.editarProducto(elegido.id, {
        descuento_porcentaje: Number(descuento) || 0,
        destacado,
      });
      avisar(Number(descuento) > 0 ? `«${elegido.nombre}» quedó en oferta.` : `«${elegido.nombre}» salió de oferta.`);
      onListo(elegido.categoria || "General");
    } catch (err) {
      avisar(err?.message ?? "No se pudo guardar la oferta.", { tono: "error" });
    } finally {
      setGuardando(false);
    }
  };

  const precio = elegido ? centavosDe(elegido) / 100 : 0;

  return (
    <section className="card adm-panel adm-panel-oferta" aria-label="Poner en oferta">
      <div className="adm-panel-cab">
        <h2>Poner en oferta</h2>
        <button type="button" className="btn-fantasma adm-mini" onClick={onCerrar}>
          Cerrar
        </button>
      </div>
      <form className="adm-form" onSubmit={guardar}>
        <div className="adm-buscador-linea">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                buscar();
              }
            }}
            placeholder="Buscá el producto…"
            aria-label="Buscar producto para la oferta"
          />
          <button type="button" className="btn-fantasma adm-btn" onClick={buscar}>
            <FaMagnifyingGlass aria-hidden="true" /> Buscar
          </button>
        </div>
        {resultados.length > 0 && (
          <ul className="adm-componentes-resultados">
            {resultados.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={elegido?.id === p.id ? "es-elegido" : undefined}
                  aria-pressed={elegido?.id === p.id}
                  onClick={() => {
                    setElegido(p);
                    if (Number(p.descuento_porcentaje) > 0) setDescuento(String(Number(p.descuento_porcentaje)));
                  }}
                >
                  {p.imagen ? <img src={p.imagen} alt="" width={32} height={32} loading="lazy" /> : <span className="adm-componentes-sinfoto" />}
                  <span className="adm-componentes-nombre">{p.nombre}</span>
                  <span className="adm-muted">
                    {formatoARS(centavosDe(p))}
                    {Number(p.descuento_porcentaje) > 0 ? ` · ya -${Number(p.descuento_porcentaje)}%` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {elegido && (
          <CamposOferta
            precio={precio}
            descuento={descuento}
            destacado={destacado}
            onDescuento={setDescuento}
            onDestacado={setDestacado}
          />
        )}
        <div className="adm-form-acciones">
          <button type="submit" className="btn-primary adm-btn" disabled={!elegido || guardando}>
            {guardando ? "Guardando…" : "Guardar oferta"}
          </button>
        </div>
      </form>
    </section>
  );
}
