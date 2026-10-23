// HefestoTech · Admin · Banners: CRUD completo (GET/POST/PUT/DELETE).
import { useState } from "react";
import { FaPlus, FaXmark } from "react-icons/fa6";
import { adminApi } from "./adminApi";
import { Cabecera, Paginador, Proximamente, SinPermiso, Skeleton, Vacio } from "./ui";
import { useModulo, usePaginacion } from "./hooks";

const VACIO = { titulo: "", imagen: "", link: "", orden: "0", activo: true };

export default function Banners({ avisar, pedirConfirm }) {
  const [form, setForm] = useState(VACIO);
  const [altaAbierta, setAltaAbierta] = useState(false);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const pg = usePaginacion("");
  const { estado, datos, recargar } = useModulo(
    () => adminApi.banners({ limit: pg.por, offset: pg.offset }),
    [pg.por, pg.offset]
  );
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
      setAltaAbierta(false);
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

  const mostrarForm = altaAbierta || Boolean(editando);
  const alEditar = (b) => {
    setEditando(b.id);
    setForm({
      titulo: b.titulo ?? "",
      imagen: b.imagen ?? "",
      link: b.link ?? "",
      orden: String(b.orden ?? 0),
      activo: !!b.activo,
    });
    setAltaAbierta(true);
    const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: sinMovimiento ? "auto" : "smooth" });
  };
  const alternarAlta = () => {
    if (mostrarForm) {
      setAltaAbierta(false);
      setEditando(null);
      setForm(VACIO);
    } else {
      setAltaAbierta(true);
    }
  };

  return (
    <div>
      <Cabecera
        kicker="Vidriera"
        titulo={`Banners (${datos?.total ?? lista.length})`}
        acciones={
          <div className="adm-acciones-cab">
            <button type="button" className="btn-fantasma adm-btn" onClick={recargar}>
              Actualizar
            </button>
            <button
              type="button"
              className={mostrarForm ? "btn-fantasma adm-btn" : "btn-primary adm-btn"}
              onClick={alternarAlta}
              aria-expanded={mostrarForm}
            >
              {mostrarForm ? <FaXmark aria-hidden="true" /> : <FaPlus aria-hidden="true" />}{" "}
              {mostrarForm ? "Cerrar" : "Nuevo banner"}
            </button>
          </div>
        }
      />
      {mostrarForm && (
      <section className="card adm-panel" aria-label={editando ? "Editar banner" : "Nuevo banner"}>
        <div className="adm-panel-cab">
          <h2>{editando ? "Editar banner" : "Nuevo banner"}</h2>
          <button type="button" className="btn-fantasma adm-mini" onClick={alternarAlta}>
            Cerrar
          </button>
        </div>
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
            <button
              type="button"
              className="btn-fantasma adm-btn"
              onClick={() => {
                setEditando(null);
                setForm(VACIO);
                setAltaAbierta(false);
              }}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary adm-btn" disabled={guardando}>
              {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear banner"}
            </button>
          </div>
        </form>
      </section>
      )}
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
                  <button type="button" className="btn-fantasma adm-mini" onClick={() => alEditar(b)}>
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
        <Paginador total={datos?.total ?? 0} pagina={pg.pagina} por={pg.por} onPagina={pg.irA} onPor={pg.cambiarPor} />
      </section>
    </div>
  );
}
