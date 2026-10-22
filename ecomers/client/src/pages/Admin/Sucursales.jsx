// HefestoTech · Admin · Sucursal activa (GET/POST /api/admin/sucursales).
// Tarjeta para Inicio: filtra ventas y pedidos por sucursal y permite crear una.
import { useState } from "react";

const FORM_VACIO = { nombre: "", direccion: "", telefono: "" };

export default function Sucursales({ sucursales, sucursal, onCambiar, puedeGestionar, onCrear, avisar }) {
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState("");

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
    <section className="card adm-panel adm-sucursal" aria-label="Sucursales">
      <div className="adm-sucursal-cab">
        <h2>Sucursal activa</h2>
        {puedeGestionar && (
          <button
            type="button"
            className="btn-fantasma adm-mini"
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
          >
            {abierto ? "Cerrar" : "Agregar sucursal"}
          </button>
        )}
      </div>

      <label className="adm-sucursal-select">
        <span className="texto-mutado">Ver datos de</span>
        <select value={sucursal} onChange={(e) => onCambiar(e.target.value)}>
          <option value="">Todas las sucursales</option>
          {sucursales.filter((s) => s.activa).map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
      </label>

      {sucursal ? (
        <p className="texto-mutado">
          Ventas, pedidos y top de productos de la sucursal elegida. El stock y las compras
          son globales.
        </p>
      ) : (
        <p className="texto-mutado">
          {sucursales.length
            ? "Mostrando todas las sucursales juntas."
            : "Todavía no hay sucursales cargadas. Podés crear la primera acá."}
        </p>
      )}

      {abierto && (
        <form className="adm-form adm-sucursal-form" onSubmit={crear}>
          <label>Nombre *
            <input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              maxLength={120}
              required
            />
          </label>
          <div className="adm-fila-2">
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
              />
            </label>
          </div>
          {error && <p role="alert" className="adm-sucursal-error">{error}</p>}
          <div className="adm-form-acciones">
            <button type="button" className="btn-fantasma adm-btn" onClick={() => setAbierto(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary adm-btn" disabled={creando}>
              {creando ? "Creando…" : "Crear sucursal"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
