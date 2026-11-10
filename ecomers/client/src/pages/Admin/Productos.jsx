// HefestoTech · Admin · Productos: alta, edición, borrado lógico (papelera)
// con Deshacer (10s) y lotes. El listado va plegado por categoría: cada
// subcategoría se abre y se cierra, y recién al abrirla pide sus productos.
// Sin datos inventados: vacío real si no hay.
import { useState } from "react";
import { FaChevronDown, FaPlus, FaXmark } from "react-icons/fa6";
import { adminApi, formatoARS } from "./adminApi";
import { CATEGORIAS } from "../../constants/categorias";
import { Cabecera, Paginador, Proximamente, SinPermiso, Skeleton, Tabla, Vacio } from "./ui";
import { useModulo, usePaginacion } from "./hooks";

const VACIO_FORM = { nombre: "", marca: "", precio: "", stock: "0", descripcion: "", categoria: "General", codigo: "", imagen: "" };

const POR_PAGINA_CATEGORIA = 10;

// "Memoria RAM" ya es el valor que guarda la base; para las categorías que
// tienen etiqueta propia en el catálogo se usa esa, y si no, el valor crudo.
function etiquetaCategoria(db) {
  const hit = CATEGORIAS.find((c) => c.db === db);
  return hit ? hit.label : db;
}

// Productos de una sola categoría. Se monta al abrir el acordeón, así que el
// pedido al backend sale recién ahí; `refresco` lo vuelve a pedir después de
// crear, editar o mandar a papelera.
function ListaCategoria({ categoria, busqueda, refresco, onEditar, onBorrar }) {
  // `refresco` no entra en la clave de paginación a propósito: tras editar un
  // producto se recargan los datos pero la persona se queda en su página.
  const pg = usePaginacion(`${categoria}|${busqueda}`, POR_PAGINA_CATEGORIA);
  const { estado, datos, detalle } = useModulo(
    () =>
      adminApi.productos({
        categoria,
        busqueda,
        limit: pg.por,
        offset: pg.offset,
      }),
    [categoria, busqueda, refresco, pg.por, pg.offset]
  );

  if (estado === "cargando") {
    return <Skeleton lineas={4} etiqueta={`Cargando ${etiquetaCategoria(categoria)}…`} />;
  }
  if (estado === "sin-permiso") {
    return <p className="texto-mutado">No tenés permiso para ver esta categoría.</p>;
  }
  if (estado === "no-disponible") {
    return (
      <p className="texto-mutado">
        No se pudieron cargar los productos de esta categoría.
        {detalle ? ` Detalle: ${detalle}` : ""}
      </p>
    );
  }

  const lista = datos?.productos ?? [];
  if (lista.length === 0) {
    return <Vacio titulo="Sin productos en esta categoría" />;
  }

  return (
    <>
      <Tabla
        columnas={[
          {
            clave: "nombre",
            titulo: "Producto",
            ver: (p) => (
              <>
                <strong>{p.nombre}</strong>
                <br />
                <span className="texto-mutado">
                  {[p.codigo, p.marca].filter(Boolean).join(" · ") || "—"}
                </span>
              </>
            ),
          },
          {
            clave: "imagen",
            titulo: "Foto",
            ver: (p) =>
              p.imagen ? (
                <img src={p.imagen} alt="" width={44} height={44} loading="lazy" className="adm-miniatura-tabla" />
              ) : (
                <span className="texto-mutado">—</span>
              ),
          },
          { clave: "precio", titulo: "Precio", ver: (p) => formatoARS(p.precio_centavos ?? 0) },
          {
            clave: "stock",
            titulo: "Stock",
            ver: (p) => {
              const stock = Number(p.stock ?? 0);
              const minimo = Number(p.stock_minimo ?? 5);
              return (
                <span className={stock <= minimo ? "adm-stock-bajo" : undefined}>
                  {stock} en stock · mín {minimo}
                </span>
              );
            },
          },
          {
            clave: "acciones",
            titulo: "Acciones",
            ver: (p) => (
              <span className="adm-acciones">
                <button type="button" className="btn-fantasma adm-mini" onClick={() => onEditar(p)}>
                  Editar
                </button>
                <button type="button" className="btn-fantasma adm-mini es-peligro" onClick={() => onBorrar(p)}>
                  Papelera
                </button>
              </span>
            ),
          },
        ]}
        filas={lista}
        filaKey={(p) => p.id}
        vacio="Sin productos."
      />
      <Paginador
        total={datos?.total ?? 0}
        pagina={pg.pagina}
        por={pg.por}
        onPagina={pg.irA}
        onPor={pg.cambiarPor}
        opcionesPor={[10, 25, 50]}
      />
    </>
  );
}

export default function Productos({ avisar, pedirConfirm, presetQ = "", accionInicial }) {
  const [q, setQ] = useState(presetQ);
  const [busqueda, setBusqueda] = useState(presetQ);
  const [form, setForm] = useState(VACIO_FORM);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [altaAbierta, setAltaAbierta] = useState(accionInicial === "nuevo");
  const [refresco, setRefresco] = useState(0);

  const [presetPrevio, setPresetPrevio] = useState(presetQ);

  // Qué categorías están desplegadas. `porDefecto` arranca en true cuando hay
  // búsqueda (así los resultados se ven sin abrir una por una) y el mapa
  // guarda lo que la persona abrió o cerró a mano.
  const [apertura, setApertura] = useState({
    clave: presetQ,
    porDefecto: presetQ.trim() !== "",
    mapa: {},
  });

  const { estado, datos, detalle, recargar } = useModulo(
    () => adminApi.categoriasProductos({ busqueda }),
    [busqueda, refresco]
  );

  // Si llega otro presetQ (p. ej. desde la paleta ⌘K), se ajusta durante el render.
  if (presetQ !== presetPrevio) {
    setPresetPrevio(presetQ);
    setQ(presetQ);
    setBusqueda(presetQ);
  }
  if (apertura.clave !== busqueda) {
    setApertura({ clave: busqueda, porDefecto: busqueda.trim() !== "", mapa: {} });
  }

  const categorias = datos?.categorias ?? [];
  const estaAbierta = (cat) => apertura.mapa[cat] ?? apertura.porDefecto;
  const alternarCategoria = (cat) =>
    setApertura((a) => ({ ...a, mapa: { ...a.mapa, [cat]: !(a.mapa[cat] ?? a.porDefecto) } }));
  const abrirTodas = () => setApertura((a) => ({ ...a, porDefecto: true, mapa: {} }));
  const cerrarTodas = () => setApertura((a) => ({ ...a, porDefecto: false, mapa: {} }));

  const refrescarListados = () => {
    setRefresco((n) => n + 1);
    recargar();
  };

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
        if (form.imagen !== undefined) cambios.imagen = form.imagen.trim();
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
          imagen: form.imagen.trim(),
        });
        avisar("Producto creado.");
      }
      // La categoría tocada queda abierta para ver el resultado del guardado.
      const categoriaTocada = form.categoria || "General";
      setApertura((a) => ({ ...a, mapa: { ...a.mapa, [categoriaTocada]: true } }));
      setForm(VACIO_FORM);
      setEditando(null);
      setAltaAbierta(false);
      refrescarListados();
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
      refrescarListados();
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
              refrescarListados();
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
    setAltaAbierta(true);
    setForm({
      nombre: p.nombre ?? "",
      marca: p.marca ?? "",
      precio: p.precio ?? "",
      stock: String(p.stock ?? 0),
      descripcion: p.descripcion ?? "",
      categoria: p.categoria ?? "General",
      codigo: p.codigo ?? "",
      imagen: p.imagen ?? "",
    });
    const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: sinMovimiento ? "auto" : "smooth" });
  };

  if (estado === "cargando") return <Skeleton lineas={8} etiqueta="Cargando productos…" />;
  if (estado === "sin-permiso") return <SinPermiso modulo="Productos" />;
  if (estado === "no-disponible") return <Proximamente modulo="Productos" detalle={detalle} />;

  const mostrarForm = altaAbierta || Boolean(editando);
  const alternarAlta = () => {
    if (mostrarForm) {
      setAltaAbierta(false);
      setEditando(null);
      setForm(VACIO_FORM);
    } else {
      setAltaAbierta(true);
    }
  };

  return (
    <div>
      <Cabecera
        kicker="Catálogo"
        titulo={`Productos (${datos?.total ?? 0})`}
        acciones={
          <div className="adm-acciones-cab">
            <button type="button" className="btn-fantasma adm-btn" onClick={refrescarListados}>
              Actualizar
            </button>
            <button
              type="button"
              className={mostrarForm ? "btn-fantasma adm-btn" : "btn-primary adm-btn"}
              onClick={alternarAlta}
              aria-expanded={mostrarForm}
            >
              {mostrarForm ? <FaXmark aria-hidden="true" /> : <FaPlus aria-hidden="true" />}{" "}
              {mostrarForm ? "Cerrar" : "Nuevo producto"}
            </button>
          </div>
        }
      />

      <div className={mostrarForm ? "adm-grid-2 adm-grid-productos" : ""}>
      {mostrarForm && (
      <section className="card adm-panel" aria-label={editando ? "Editar producto" : "Nuevo producto"}>
        <div className="adm-panel-cab">
          <h2>{editando ? "Editar producto" : "Nuevo producto"}</h2>
          <button type="button" className="btn-fantasma adm-mini" onClick={alternarAlta} aria-label="Cerrar alta">
            Cerrar
          </button>
        </div>
        <form onSubmit={alGuardar} className="adm-form">
          <label>Nombre *
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required maxLength={200} />
          </label>
          <div className="adm-fila-2">
            <label>Marca
              <input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} />
            </label>
            <label>Categoría
              <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                <option value="General">General</option>
                {CATEGORIAS.map((c) => (
                  <option key={c.db} value={c.db}>
                    {c.label}
                  </option>
                ))}
              </select>
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
          <label>Imagen (URL)
            <input
              value={form.imagen}
              onChange={(e) => setForm({ ...form, imagen: e.target.value })}
              placeholder="https://…"
              inputMode="url"
            />
          </label>
          <div className="adm-fila-2">
            <label>Subir foto
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={async (e) => {
                  const archivo = e.target.files?.[0];
                  if (!archivo) return;
                  try {
                    avisar("Subiendo imagen…");
                    const r = await adminApi.subirImagenProducto(archivo);
                    setForm((f) => ({ ...f, imagen: r.url }));
                    avisar("Imagen subida.");
                  } catch (err) {
                    avisar(err?.message ?? "No se pudo subir.", { tono: "error" });
                  } finally {
                    e.target.value = "";
                  }
                }}
              />
            </label>
            {form.imagen ? (
              <span className="adm-miniatura">
                <img src={form.imagen} alt="Vista previa" width={64} height={64} loading="lazy" />
              </span>
            ) : null}
          </div>
          <div className="adm-form-acciones">
            {editando && (
              <button type="button" className="btn-fantasma adm-btn" onClick={() => { setEditando(null); setForm(VACIO_FORM); }}>
                Cancelar
              </button>
            )}
            <button type="submit" className="btn-primary adm-btn" disabled={guardando}>
              {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear producto"}
            </button>
          </div>
        </form>
      </section>
      )}

      <section className="card adm-panel" aria-label="Listado">
        <h2 className="sr-only">Listado de productos por categoría</h2>
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

        {categorias.length === 0 ? (
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
          <>
            <div className="adm-categorias-barra">
              <p className="texto-mutado">
                {categorias.length} {categorias.length === 1 ? "categoría" : "categorías"}
                {busqueda ? ` con resultados para «${busqueda}»` : ""}
              </p>
              <span className="adm-acciones">
                <button type="button" className="btn-fantasma adm-mini" onClick={abrirTodas}>
                  Abrir todas
                </button>
                <button type="button" className="btn-fantasma adm-mini" onClick={cerrarTodas}>
                  Cerrar todas
                </button>
              </span>
            </div>

            <ul className="adm-categorias">
              {categorias.map((c) => {
                const abierta = estaAbierta(c.categoria);
                const panelId = `adm-cat-${c.categoria.replace(/\s+/g, "-").toLowerCase()}`;
                return (
                  <li key={c.categoria} className={`adm-categoria${abierta ? " esta-abierta" : ""}`}>
                    <button
                      type="button"
                      className="adm-categoria-toggle"
                      onClick={() => alternarCategoria(c.categoria)}
                      aria-expanded={abierta}
                      aria-controls={panelId}
                    >
                      <FaChevronDown className="adm-caret" aria-hidden="true" />
                      <span className="adm-categoria-nombre">{etiquetaCategoria(c.categoria)}</span>
                      {c.stock_bajo > 0 && (
                        <span className="adm-categoria-alerta" title="Productos en su stock mínimo o por debajo">
                          {c.stock_bajo} con stock bajo
                        </span>
                      )}
                      <span className="adm-categoria-conteo">
                        {c.total} {c.total === 1 ? "producto" : "productos"}
                      </span>
                    </button>
                    {abierta && (
                      <div className="adm-categoria-cuerpo" id={panelId} role="region" aria-label={etiquetaCategoria(c.categoria)}>
                        <ListaCategoria
                          categoria={c.categoria}
                          busqueda={busqueda}
                          refresco={refresco}
                          onEditar={alEditar}
                          onBorrar={alBorrar}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
      </div>
    </div>
  );
}
