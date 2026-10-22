// HefestoTech · Admin · Selector de sucursal de la barra superior.
// Filtra los datos del Inicio y permite dar de alta una sucursal (POST
// /api/admin/sucursales) desde un panel flotante, sin salir de la pantalla.
import { useEffect, useRef, useState } from "react";
import { FaPlus, FaStore, FaXmark } from "react-icons/fa6";

const FORM_VACIO = { nombre: "", direccion: "", telefono: "" };

export default function SelectorSucursal({
  sucursales,
  sucursal,
  onCambiar,
  puedeGestionar,
  onCrear,
  avisar,
}) {
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState("");
  const raiz = useRef(null);
  const botonRef = useRef(null);

  const cerrar = () => {
    setAbierto(false);
    setError("");
  };

  useEffect(() => {
    if (!abierto) return undefined;
    const alTeclar = (e) => {
      if (e.key === "Escape") {
        setAbierto(false);
        setError("");
        botonRef.current?.focus();
      }
    };
    const alClickAfuera = (e) => {
      if (raiz.current && !raiz.current.contains(e.target)) {
        setAbierto(false);
        setError("");
      }
    };
    document.addEventListener("keydown", alTeclar);
    document.addEventListener("mousedown", alClickAfuera);
    return () => {
      document.removeEventListener("keydown", alTeclar);
      document.removeEventListener("mousedown", alClickAfuera);
    };
  }, [abierto]);

  const activas = sucursales.filter((s) => s.activa);

  const crear = async (e) => {
    e.preventDefault();
    const nombre = form.nombre.trim();
    if (!nombre) {
      setError("Poné un nombre para la sucursal.");
      return;
    }
    setCreando(true);
    setError("");
    try {
      const r = await onCrear({
        nombre,
        direccion: form.direccion.trim(),
        telefono: form.telefono.trim(),
      });
      setForm(FORM_VACIO);
      setAbierto(false);
      avisar?.(r?.sucursal?.nombre ? `Sucursal «${r.sucursal.nombre}» creada.` : "Sucursal creada.");
    } catch (err) {
      setError(err?.message ?? "No se pudo crear la sucursal.");
    } finally {
      setCreando(false);
    }
  };

  return (
    <div className="adm-suc" ref={raiz}>
      <label className="adm-suc-select" title="Filtra las ventas y pedidos del Inicio">
        <FaStore aria-hidden="true" />
        <span className="sr-only">Sucursal activa</span>
        <select value={sucursal} onChange={(e) => onCambiar(e.target.value)}>
          <option value="">Todas las sucursales</option>
          {activas.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
      </label>

      {puedeGestionar && (
        <button
          ref={botonRef}
          type="button"
          className="adm-icon-btn"
          onClick={() => (abierto ? cerrar() : setAbierto(true))}
          aria-expanded={abierto}
          aria-controls="adm-suc-panel"
          aria-label="Agregar sucursal"
          title="Agregar sucursal"
        >
          {abierto ? <FaXmark aria-hidden="true" /> : <FaPlus aria-hidden="true" />}
        </button>
      )}

      {abierto && (
        <form
          id="adm-suc-panel"
          className="adm-suc-pop card adm-form"
          onSubmit={crear}
          aria-label="Nueva sucursal"
        >
          <h2>Nueva sucursal</h2>
          <label>Nombre *
            <input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              maxLength={120}
              required
              autoFocus
            />
          </label>
          <label>Dirección
            <input
              value={form.direccion}
              onChange={(e) => setForm({ ...form, direccion: e.target.value })}
              maxLength={200}
            />
          </label>
          <label>Teléfono
            <input
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              maxLength={40}
              inputMode="tel"
            />
          </label>
          {error && <p role="alert" className="adm-error">{error}</p>}
          <div className="adm-form-acciones">
            <button type="button" className="btn-fantasma adm-btn" onClick={cerrar}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary adm-btn" disabled={creando}>
              {creando ? "Creando…" : "Crear sucursal"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
