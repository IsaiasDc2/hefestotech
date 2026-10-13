// HefestoTech · Admin · Productos: alta, edición, borrado lógico (papelera)
// con Deshacer (10s) y lotes. Sin datos inventados: vacío real si no hay.
import { useEffect, useState } from "react";
import { adminApi, formatoARS } from "./adminApi";
import { Cabecera, Proximamente, SinPermiso, Skeleton, Tabla, Vacio } from "./ui";
import { useModulo } from "./ui";

const VACIO_FORM = { nombre: "", marca: "", precio: "", stock: "0", descripcion: "", categoria: "General", codigo: "" };

export default function Productos({ avisar, pedirConfirm, presetQ = "" }) {
  const [q, setQ] = useState(presetQ);
  const [busqueda, setBusqueda] = useState(presetQ);
  const [form, setForm] = useState(VACIO_FORM);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const { estado, datos, recargar, setDatos } = useModulo(
    () => adminApi.productos({ q: busqueda, limit: 50 }),
    [busqueda]
  );

  useEffect(() => {
    setQ(presetQ);
    setBusqueda(presetQ);
  }, [presetQ]);

  const lista = datos?.productos ?? [];

  const alGuardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      if (editando) {
        const cambios = {};
        if (form.nombre.trim()) cambios.nombre = form.nombre.trim();
        if (form.marca !== undefined) cambios.marca = form.marca;
        if (form.precio !== "") cambios.precio = Number(form.precio);
        if (form.descripcion !== undefined) cambios.descripcion = form.descripcion;
        if (form.categoria !== undefined) cambios.categoria = form.categoria;
        await adminApi.editarProducto(editando, cambios);
        avisar("Producto actualizado.");
      } else {
        await adminApi.crearProducto({
          nombre: form.nombre.trim(),
          marca: form.marca,
          precio: Number(form.precio || 0),
          stock: Number(form.stock || 0),
          descripcion: form.descripcion,
          categoria: form.categoria || "General",
          codigo: form.codigo.trim(),
        });
        avisar("Producto creado.");
      }
      setForm(VACIO_FORM);
      setEditando(null);
      recargar();
    } catch (err) {
      avisar(err?.message ?? "No se pudo guardar.", { tono: "error" });
    } finally {
      setGuardando(false);
    }
  };

  const alBorrar = async (p) => {
    const ok = await pedirConfirm({
      titulo: "Mover a papelera",
      texto: `«${p.nombre}» se moverá a la papelera. Podés restaurarlo después.`,
      confirmar: "Mover a papelera",
      peligro: true,
    });
    if (!ok) return;
    try {
      await adminApi.borrarProducto(p.id);
      recargar();
      // Deshacer disponible 10 segundos.
      avisar(`«${p.nombre}» movido a papelera.`, {
        tono: "aviso",
        accion: {
          etiqueta: "Deshacer",
          ms: 10000,
          alHacer: async () => {
            try {
              await adminApi.restaurarProducto(p.id);
              avisar("Producto restaurado.");
              recargar();
            } catch (err) {
              avisar(err?.message ?? "No se pudo restaurar.", { tono: "error" });
            }
          },
        },
      });
    } catch (err) {
      avisar(err?.message ?? "No se pudo borrar.", { tono: "error" });
    }
  };

  const alEditar = (p) => {
    setEditando(p.id);
    setForm({
      nombre: p.nombre ?? "",
      marca: p.marca ?? "",
      precio: p.precio ?? "",
      stock: String(p.stock ?? 0),
      descripcion: p.descripcion ?? "",
      categoria: p.categoria ?? "General",
      codigo: p.codigo ?? "",
    });
    const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: sinMovimiento ? "auto" : "smooth" });
  };

  if (estado === "cargando") return <Skeleton lineas={8} etiqueta="Cargando productos…" />;
  if (estado === "sin-permiso") return <SinPermiso modulo="Productos" />;
  if (estado === "no-disponible") return <Proximamente modulo="Productos" />;

  return (
    <div>
      <Cabecera
        kicker="Catálogo"
        titulo={`Productos (${lista.length})`}
        acciones={
          <button type="button" className="btn-fantasma adm-btn" onClick={recargar}>
            Actualizar
          </button>
        }
      />

      <section className="card adm-panel" aria-label={editando ? "Editar producto" : "Nuevo producto"}>
        <h2>{editando ? "Editar producto" : "Nuevo producto"}</h2>
        <form onSubmit={alGuardar} className="adm-form">
          <label>Nombre *
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required maxLength={200} />
          </label>
          <div className="adm-fila-2">
            <label>Marca
              <input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} />
            </label>
            <label>Categoría
              <input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
            </label>
          </div>
          <div className="adm-fila-3">
            <label>Precio (ARS)
              <input type="number" min="0" step="0.01" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} />
            </label>
            {!editando && (
              <label>Stock inicial
                <input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </label>
            )}
            {!editando && (
              <label>Código (vacío = auto)
                <input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="HT-…" />
              </label>
            )}
          </div>
          <label>Descripción
            <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </label>
          <div className="adm-form-acciones">
            <button type="submit" className="btn-primary adm-btn" disabled={guardando}>
              {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear producto"}
            </button>
            {editando && (
              <button type="button" className="btn-fantasma adm-btn" onClick={() => { setEditando(null); setForm(VACIO_FORM); }}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="card adm-panel" aria-label="Listado">
        <form
          className="adm-buscador-linea"
          onSubmit={(e) => {
            e.preventDefault();
            setBusqueda(q);
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre…"
            aria-label="Buscar productos"
          />
          <button type="submit" className="btn-fantasma adm-btn">Buscar</button>
        </form>
        {lista.length === 0 ? (
          <Vacio
            titulo="Sin productos"
            texto={busqueda ? "Ninguno coincide con la búsqueda." : "Todavía no hay productos cargados."}
            accion={
              busqueda ? (
                <button type="button" className="btn-fantasma adm-btn" onClick={() => { setQ(""); setBusqueda(""); }}>
                  Limpiar búsqueda
                </button>
              ) : null
            }
          />
        ) : (
          <Tabla
            columnas={[
              { clave: "nombre", titulo: "Producto", ver: (p) => <><strong>{p.nombre}</strong><br /><span className="texto-mutado">{p.codigo ?? ""} · {p.marca ?? ""}</span></> },
              { clave: "precio", titulo: "Precio", ver: (p) => formatoARS(p.precio_centavos ?? 0) },
              { clave: "stock", titulo: "Stock", ver: (p) => `${p.stock ?? 0} en stock · mín ${p.stock_minimo ?? 5}` },
              {
                clave: "acciones", titulo: "Acciones",
                ver: (p) => (
                  <span className="adm-acciones">
                    <button type="button" className="btn-fantasma adm-mini" onClick={() => alEditar(p)}>Editar</button>
                    <button type="button" className="btn-fantasma adm-mini es-peligro" onClick={() => alBorrar(p)}>Papelera</button>
                  </span>
                ),
              },
            ]}
            filas={lista}
            filaKey={(p) => p.id}
            vacio="Sin productos."
          />
        )}
      </section>
    </div>
  );
}
