// HefestoTech · Admin · Banners: CRUD completo (GET/POST/PUT/DELETE).
import { useState } from "react";
import { adminApi } from "./adminApi";
import { Cabecera, Proximamente, SinPermiso, Skeleton, Vacio } from "./ui";
import { useModulo } from "./ui";

const VACIO = { titulo: "", imagen: "", link: "", orden: "0", activo: true };

export default function Banners({ avisar, pedirConfirm }) {
  const [form, setForm] = useState(VACIO);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const { estado, datos, recargar } = useModulo(() => adminApi.banners(), []);
  const lista = datos?.banners ?? [];

  const alGuardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    const cuerpo = { ...form, orden: Number(form.orden || 0) };
    try {
      if (editando) {
        await adminApi.editarBanner(editando, cuerpo);
        avisar("Banner actualizado.");
      } else {
        await adminApi.crearBanner(cuerpo);
        avisar("Banner creado.");
      }
      setForm(VACIO);
      setEditando(null);
      recargar();
    } catch (err) {
      avisar(err?.message ?? "No se pudo guardar.", { tono: "error" });
    } finally {
      setGuardando(false);
    }
  };

  const alBorrar = async (b) => {
    const ok = await pedirConfirm({
      titulo: "Borrar banner",
      texto: `«${b.titulo || b.id}» dejará de mostrarse.`,
      confirmar: "Borrar",
      peligro: true,
    });
    if (!ok) return;
    try {
      await adminApi.borrarBanner(b.id);
      avisar("Banner borrado.");
      recargar();
    } catch (err) {
      avisar(err?.message ?? "No se pudo borrar.", { tono: "error" });
    }
  };

  if (estado === "cargando") return <Skeleton lineas={6} etiqueta="Cargando banners…" />;
  if (estado === "sin-permiso") return <SinPermiso modulo="Banners" />;
  if (estado === "no-disponible") return <Proximamente modulo="Banners" />;

  return (
    <div>
      <Cabecera kicker="Vidriera" titulo={`Banners (${lista.length})`} />
      <section className="card adm-panel" aria-label={editando ? "Editar banner" : "Nuevo banner"}>
        <h2>{editando ? "Editar banner" : "Nuevo banner"}</h2>
        <form onSubmit={alGuardar} className="adm-form">
          <label>Título
            <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} maxLength={200} />
          </label>
          <label>Imagen (URL)
            <input value={form.imagen} onChange={(e) => setForm({ ...form, imagen: e.target.value })} placeholder="https://…" inputMode="url" />
          </label>
          <div className="adm-fila-3">
            <label>Link
              <input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="/productos" />
            </label>
            <label>Orden
              <input type="number" value={form.orden} onChange={(e) => setForm({ ...form, orden: e.target.value })} />
            </label>
            <label className="adm-check">Activo
              <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
            </label>
          </div>
          <div className="adm-form-acciones">
            <button type="submit" className="btn-primary adm-btn" disabled={guardando}>
              {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear banner"}
            </button>
            {editando && (
              <button type="button" className="btn-fantasma adm-btn" onClick={() => { setEditando(null); setForm(VACIO); }}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>
      <section className="card adm-panel" aria-label="Listado">
        {lista.length === 0 ? (
          <Vacio titulo="Sin banners" texto="Todavía no hay banners cargados." />
        ) : (
          <ul className="adm-tarjetas">
            {lista.map((b) => (
              <li key={b.id} className="card adm-plantilla">
                <strong>{b.titulo || "Sin título"}</strong>
                <span className="texto-mutado">Orden {b.orden ?? 0} · {b.activo ? "Activo" : "Inactivo"}{b.link ? ` · ${b.link}` : ""}</span>
                <div className="adm-acciones">
                  <button type="button" className="btn-fantasma adm-mini" onClick={() => { setEditando(b.id); setForm({ titulo: b.titulo ?? "", imagen: b.imagen ?? "", link: b.link ?? "", orden: String(b.orden ?? 0), activo: !!b.activo }); }}>
                    Editar
                  </button>
                  <button type="button" className="btn-fantasma adm-mini es-peligro" onClick={() => alBorrar(b)}>
                    Borrar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
