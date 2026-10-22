// HefestoTech · Admin · Cupones: alta y baja lógica (el contrato no expone
// edición: GET/POST/DELETE). Tipos: porcentaje (1–100) o monto (centavos).
import { useState } from "react";
import { FaPlus, FaXmark } from "react-icons/fa6";
import { adminApi, formatoARS } from "./adminApi";
import { Cabecera, Proximamente, SinPermiso, Skeleton, Tabla, Vacio } from "./ui";
import { useModulo } from "./hooks";

const VACIO = { codigo: "", tipo: "porcentaje", valor: "", min_compra: "", usos_max: "", activo: true, vence: "" };

export default function Cupones({ avisar, pedirConfirm }) {
  const [form, setForm] = useState(VACIO);
  const [altaAbierta, setAltaAbierta] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const { estado, datos, recargar } = useModulo(() => adminApi.cupones(), []);
  const lista = datos?.cupones ?? [];

  const alCrear = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await adminApi.crearCupon({
        codigo: form.codigo.trim(),
        tipo: form.tipo,
        valor: form.tipo === "monto" ? Math.round(Number(form.valor || 0) * 100) : Number(form.valor),
        min_compra_centavos: Math.round(Number(form.min_compra || 0) * 100),
        usos_max: form.usos_max === "" ? null : Number(form.usos_max),
        activo: form.activo,
        vence_at: form.vence || null,
      });
      avisar(`Cupón ${form.codigo.trim().toUpperCase()} creado.`);
      setForm(VACIO);
      setAltaAbierta(false);
      recargar();
    } catch (err) {
      avisar(err?.message ?? "No se pudo crear.", { tono: "error" });
    } finally {
      setGuardando(false);
    }
  };

  const alBorrar = async (c) => {
    const ok = await pedirConfirm({
      titulo: "Borrar cupón",
      texto: `El código ${c.codigo} dejará de ser válido.`,
      confirmar: "Borrar",
      peligro: true,
    });
    if (!ok) return;
    try {
      await adminApi.borrarCupon(c.id);
      avisar("Cupón borrado.");
      recargar();
    } catch (err) {
      avisar(err?.message ?? "No se pudo borrar.", { tono: "error" });
    }
  };

  if (estado === "cargando") return <Skeleton lineas={6} etiqueta="Cargando cupones…" />;
  if (estado === "sin-permiso") return <SinPermiso modulo="Cupones" />;
  if (estado === "no-disponible") return <Proximamente modulo="Cupones" />;

  return (
    <div>
      <Cabecera
        kicker="Promos"
        titulo={`Cupones (${lista.length})`}
        acciones={
          <div className="adm-acciones-cab">
            <button type="button" className="btn-fantasma adm-btn" onClick={recargar}>
              Actualizar
            </button>
            <button
              type="button"
              className={altaAbierta ? "btn-fantasma adm-btn" : "btn-primary adm-btn"}
              onClick={() => setAltaAbierta((v) => !v)}
              aria-expanded={altaAbierta}
            >
              {altaAbierta ? <FaXmark aria-hidden="true" /> : <FaPlus aria-hidden="true" />}{" "}
              {altaAbierta ? "Cerrar" : "Nuevo cupón"}
            </button>
          </div>
        }
      />
      {altaAbierta && (
        <section className="card adm-panel" aria-label="Nuevo cupón">
          <div className="adm-panel-cab">
            <h2>Nuevo cupón</h2>
            <button type="button" className="btn-fantasma adm-mini" onClick={() => setAltaAbierta(false)}>
              Cerrar
            </button>
          </div>
          <form onSubmit={alCrear} className="adm-form">
            <div className="adm-fila-3">
              <label>Código *
                <input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} required maxLength={40} placeholder="EJ: FORJA10" style={{ textTransform: "uppercase" }} />
              </label>
              <label>Tipo
                <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                  <option value="porcentaje">Porcentaje (1–100)</option>
                  <option value="monto">Monto fijo (ARS)</option>
                </select>
              </label>
              <label>Valor * {form.tipo === "monto" ? "(ARS)" : "(%)"}
                <input type="number" min="1" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} required />
              </label>
            </div>
            <div className="adm-fila-3">
              <label>Mínimo de compra (ARS)
                <input type="number" min="0" step="0.01" value={form.min_compra} onChange={(e) => setForm({ ...form, min_compra: e.target.value })} />
              </label>
              <label>Usos máximos (vacío = sin límite)
                <input type="number" min="1" value={form.usos_max} onChange={(e) => setForm({ ...form, usos_max: e.target.value })} />
              </label>
              <label>Vence (vacío = sin vencimiento)
                <input type="date" value={form.vence} onChange={(e) => setForm({ ...form, vence: e.target.value })} />
              </label>
            </div>
            <label className="adm-check">Activo
              <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
            </label>
            <div className="adm-form-acciones">
              <button
                type="button"
                className="btn-fantasma adm-btn"
                onClick={() => {
                  setForm(VACIO);
                  setAltaAbierta(false);
                }}
              >
                Cancelar
              </button>
              <button type="submit" className="btn-primary adm-btn" disabled={guardando}>
                {guardando ? "Guardando…" : "Crear cupón"}
              </button>
            </div>
          </form>
        </section>
      )}
      <section className="card adm-panel" aria-label="Listado">
        {lista.length === 0 ? (
          <Vacio titulo="Sin cupones" texto="Todavía no hay cupones cargados." />
        ) : (
          <Tabla
            columnas={[
              { clave: "codigo", titulo: "Código", ver: (c) => <strong>{c.codigo}</strong> },
              {
                clave: "valor", titulo: "Descuento",
                ver: (c) => (c.tipo === "porcentaje" ? `${c.valor}%` : formatoARS(c.valor)),
              },
              { clave: "min", titulo: "Mínimo", ver: (c) => formatoARS(c.min_compra_centavos ?? 0) },
              { clave: "estado", titulo: "Estado", ver: (c) => (c.activo ? "Activo" : "Inactivo") },
              {
                clave: "acciones", titulo: "Acciones",
                ver: (c) => (
                  <button type="button" className="btn-fantasma adm-mini es-peligro" onClick={() => alBorrar(c)}>
                    Borrar
                  </button>
                ),
              },
            ]}
            filas={lista}
            filaKey={(c) => c.id}
            vacio="Sin cupones."
          />
        )}
      </section>
    </div>
  );
}
