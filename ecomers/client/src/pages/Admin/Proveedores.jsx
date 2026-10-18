// HefestoTech · Admin · Proveedores: ficha (CUIT con dígito verificador,
// IVA, contactos, condiciones de pago, datos bancarios enmascarados, estado),
// productos que abastece con costo y proveedor principal, y sus órdenes de
// compra. Borrado lógico; el backend impide borrar con órdenes abiertas.
import { useState } from "react";
import { adminApi, fechaCorta } from "./adminApi";
import {
  CONDICIONES_IVA,
  CONDICIONES_PAGO,
  ESTADOS_OC,
  ESTADOS_PROVEEDOR,
  aCentavos,
  centavosATexto,
  cuitValido,
  formatearCuit,
  formatoMoneda,
} from "./compras";
import { Cabecera, Proximamente, SinPermiso, Skeleton, Tabla, Vacio } from "./ui";
import { useModulo } from "./hooks";

const VACIO_FORM = {
  nombre: "", nombre_comercial: "", cuit: "", condicion_iva: "responsable_inscripto",
  email: "", telefono: "", whatsapp: "", sitio_web: "", direccion: "", provincia: "", ciudad: "",
  condicion_pago: "contado", moneda: "ARS", plazo_entrega_dias: "7", pedido_minimo: "",
  descuento_pct: "0", cbu: "", alias_cbu: "", notas: "", etiquetas: "", calificacion: "",
  estado: "activo", contactos: [],
};

const CONTACTO_VACIO = { nombre: "", cargo: "", email: "", telefono: "" };

function formDesde(p) {
  return {
    ...VACIO_FORM,
    ...Object.fromEntries(Object.keys(VACIO_FORM).map((k) => [k, p[k] ?? VACIO_FORM[k]])),
    cuit: formatearCuit(p.cuit),
    plazo_entrega_dias: String(p.plazo_entrega_dias ?? 7),
    pedido_minimo: p.pedido_minimo_centavos ? centavosATexto(p.pedido_minimo_centavos) : "",
    descuento_pct: String(p.descuento_pct ?? 0),
    calificacion: p.calificacion ? String(p.calificacion) : "",
    etiquetas: (p.etiquetas ?? []).join(", "),
    contactos: (p.contactos ?? []).map((c) => ({ ...CONTACTO_VACIO, ...c })),
    cbu: "",
  };
}

function Opciones({ mapa }) {
  return Object.entries(mapa).map(([valor, etiqueta]) => (
    <option key={valor} value={valor}>{etiqueta}</option>
  ));
}

function EstadoProveedor({ estado }) {
  const clase = estado === "activo" ? "es-ok" : estado === "en_evaluacion" ? "es-aviso" : "";
  return <span className={`adm-insignia ${clase}`}>{ESTADOS_PROVEEDOR[estado] ?? estado}</span>;
}

function FormProveedor({ editando, cbuMascara, form, setForm, guardando, onGuardar, onCancelar }) {
  const cuitMal = form.cuit.trim() !== "" && !cuitValido(form.cuit);
  const campo = (k) => ({ value: form[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }) });
  const setContacto = (i, k, v) =>
    setForm({ ...form, contactos: form.contactos.map((c, j) => (j === i ? { ...c, [k]: v } : c)) });

  return (
    <section className="card adm-panel" aria-label={editando ? "Editar proveedor" : "Nuevo proveedor"}>
      <h2>{editando ? "Editar proveedor" : "Nuevo proveedor"}</h2>
      <form onSubmit={onGuardar} className="adm-form">
        <label>Razón social *
          <input {...campo("nombre")} required maxLength={200} />
        </label>
        <label>Nombre comercial
          <input {...campo("nombre_comercial")} maxLength={300} />
        </label>
        <div className="adm-fila-2">
          <label>CUIT
            <input
              {...campo("cuit")}
              inputMode="numeric"
              maxLength={13}
              placeholder="30-12345678-9"
              aria-invalid={cuitMal}
              aria-describedby={cuitMal ? "cuit-error" : undefined}
            />
            {cuitMal && <span id="cuit-error" className="adm-error-campo">Dígito verificador inválido.</span>}
          </label>
          <label>Condición IVA
            <select {...campo("condicion_iva")}><Opciones mapa={CONDICIONES_IVA} /></select>
          </label>
        </div>
        <div className="adm-fila-2">
          <label>Email
            <input {...campo("email")} type="email" maxLength={200} />
          </label>
          <label>Teléfono
            <input {...campo("telefono")} type="tel" maxLength={300} />
          </label>
        </div>
        <div className="adm-fila-2">
          <label>WhatsApp
            <input {...campo("whatsapp")} type="tel" maxLength={300} />
          </label>
          <label>Sitio web
            <input {...campo("sitio_web")} inputMode="url" placeholder="https://…" maxLength={300} />
          </label>
        </div>
        <label>Dirección
          <input {...campo("direccion")} maxLength={300} />
        </label>
        <div className="adm-fila-2">
          <label>Provincia
            <input {...campo("provincia")} maxLength={300} />
          </label>
          <label>Ciudad
            <input {...campo("ciudad")} maxLength={300} />
          </label>
        </div>
        <div className="adm-fila-3">
          <label>Pago
            <select {...campo("condicion_pago")}><Opciones mapa={CONDICIONES_PAGO} /></select>
          </label>
          <label>Moneda
            <select {...campo("moneda")}><option value="ARS">ARS</option><option value="USD">USD</option></select>
          </label>
          <label>Entrega (días)
            <input {...campo("plazo_entrega_dias")} type="number" min="0" max="365" />
          </label>
        </div>
        <div className="adm-fila-3">
          <label>Pedido mínimo
            <input {...campo("pedido_minimo")} inputMode="decimal" placeholder="0,00" />
          </label>
          <label>Descuento %
            <input {...campo("descuento_pct")} type="number" min="0" max="100" step="0.01" />
          </label>
          <label>Calificación
            <select {...campo("calificacion")}>
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
        <div className="adm-fila-2">
          <label>CBU
            <input
              {...campo("cbu")}
              inputMode="numeric"
              maxLength={26}
              placeholder={cbuMascara || "22 dígitos"}
              autoComplete="off"
            />
          </label>
          <label>Alias
            <input {...campo("alias_cbu")} maxLength={20} autoComplete="off" />
          </label>
        </div>
        <div className="adm-fila-2">
          <label>Estado
            <select {...campo("estado")}><Opciones mapa={ESTADOS_PROVEEDOR} /></select>
          </label>
          <label>Etiquetas
            <input {...campo("etiquetas")} placeholder="gpu, importado" />
          </label>
        </div>
        <label>Notas
          <textarea {...campo("notas")} maxLength={2000} />
        </label>

        <fieldset className="adm-fieldset">
          <legend>Contactos</legend>
          {form.contactos.map((c, i) => (
            <div key={i} className="adm-contacto">
              <input aria-label={`Nombre del contacto ${i + 1}`} placeholder="Nombre" value={c.nombre} onChange={(e) => setContacto(i, "nombre", e.target.value)} required maxLength={200} />
              <input aria-label={`Cargo del contacto ${i + 1}`} placeholder="Cargo" value={c.cargo} onChange={(e) => setContacto(i, "cargo", e.target.value)} maxLength={200} />
              <input aria-label={`Email del contacto ${i + 1}`} placeholder="Email" type="email" value={c.email} onChange={(e) => setContacto(i, "email", e.target.value)} maxLength={200} />
              <input aria-label={`Teléfono del contacto ${i + 1}`} placeholder="Teléfono" type="tel" value={c.telefono} onChange={(e) => setContacto(i, "telefono", e.target.value)} maxLength={200} />
              <button
                type="button"
                className="btn-fantasma adm-mini es-peligro"
                aria-label={`Quitar contacto ${i + 1}`}
                onClick={() => setForm({ ...form, contactos: form.contactos.filter((_, j) => j !== i) })}
              >
                Quitar
              </button>
            </div>
          ))}
          {form.contactos.length < 20 && (
            <button
              type="button"
              className="btn-fantasma adm-mini"
              onClick={() => setForm({ ...form, contactos: [...form.contactos, { ...CONTACTO_VACIO }] })}
            >
              Agregar contacto
            </button>
          )}
        </fieldset>

        <div className="adm-form-acciones">
          <button type="submit" className="btn-primary adm-btn" disabled={guardando || cuitMal}>
            {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear proveedor"}
          </button>
          {editando && (
            <button type="button" className="btn-fantasma adm-btn" onClick={onCancelar}>
              Cancelar
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

const VINCULO_VACIO = { producto_id: "", codigo_proveedor: "", costo: "", moneda: "ARS", cantidad_minima: "1", tiempo_entrega_dias: "7", es_principal: false };

function ProductosDelProveedor({ proveedor, vinculos, avisar, pedirConfirm, onCambio }) {
  const [form, setForm] = useState({ ...VINCULO_VACIO, moneda: proveedor.moneda ?? "ARS" });
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const catalogo = useModulo(() => adminApi.productos({ limit: 200 }), []);
  const productos = catalogo.datos?.productos ?? [];
  const vinculados = new Set(vinculos.map((v) => v.producto_id));

  const guardar = async (e) => {
    e.preventDefault();
    const costo = aCentavos(form.costo);
    if (costo === null) {
      avisar("Costo inválido.", { tono: "error" });
      return;
    }
    setGuardando(true);
    try {
      await adminApi.vincularProducto(proveedor.id, form.producto_id, {
        codigo_proveedor: form.codigo_proveedor.trim(),
        costo_centavos: costo,
        moneda: form.moneda,
        cantidad_minima: Number(form.cantidad_minima || 1),
        tiempo_entrega_dias: Number(form.tiempo_entrega_dias || 0),
        es_principal: form.es_principal,
      });
      avisar(editando ? "Vínculo actualizado." : "Producto vinculado.");
      setForm({ ...VINCULO_VACIO, moneda: proveedor.moneda ?? "ARS" });
      setEditando(false);
      onCambio();
    } catch (err) {
      avisar(err?.message ?? "No se pudo guardar.", { tono: "error" });
    } finally {
      setGuardando(false);
    }
  };

  const quitar = async (v) => {
    const ok = await pedirConfirm({
      titulo: "Desvincular producto",
      texto: `«${v.productos?.nombre ?? "Producto"}» deja de figurar entre los productos de ${proveedor.nombre}. El historial de costos se conserva.`,
      confirmar: "Desvincular",
      peligro: true,
    });
    if (!ok) return;
    try {
      await adminApi.desvincularProducto(proveedor.id, v.producto_id);
      avisar("Producto desvinculado.");
      onCambio();
    } catch (err) {
      avisar(err?.message ?? "No se pudo desvincular.", { tono: "error" });
    }
  };

  return (
    <div className="adm-panel-interno">
      <Tabla
        columnas={[
          { clave: "producto", titulo: "Producto", ver: (v) => <><strong>{v.productos?.nombre ?? "—"}</strong><br /><span className="texto-mutado">{v.productos?.codigo ?? ""}{v.codigo_proveedor ? ` · prov. ${v.codigo_proveedor}` : ""}</span></> },
          { clave: "costo", titulo: "Costo", ver: (v) => formatoMoneda(v.costo_centavos, v.moneda) },
          { clave: "stock", titulo: "Stock", ver: (v) => `${v.productos?.stock ?? 0} · mín ${v.productos?.stock_minimo ?? 5}` },
          { clave: "minima", titulo: "Mín. compra", ver: (v) => v.cantidad_minima ?? 1 },
          { clave: "principal", titulo: "Principal", ver: (v) => (v.es_principal ? <span className="adm-insignia es-ok">Principal</span> : "—") },
          { clave: "actualizado", titulo: "Actualizado", ver: (v) => fechaCorta(v.updated_at) },
          {
            clave: "acciones", titulo: "Acciones",
            ver: (v) => (
              <span className="adm-acciones">
                <button
                  type="button"
                  className="btn-fantasma adm-mini"
                  onClick={() => {
                    setEditando(true);
                    setForm({
                      producto_id: v.producto_id,
                      codigo_proveedor: v.codigo_proveedor ?? "",
                      costo: centavosATexto(v.costo_centavos),
                      moneda: v.moneda ?? "ARS",
                      cantidad_minima: String(v.cantidad_minima ?? 1),
                      tiempo_entrega_dias: String(v.tiempo_entrega_dias ?? 7),
                      es_principal: Boolean(v.es_principal),
                    });
                  }}
                >
                  Editar
                </button>
                <button type="button" className="btn-fantasma adm-mini es-peligro" onClick={() => quitar(v)}>Quitar</button>
              </span>
            ),
          },
        ]}
        filas={vinculos}
        filaKey={(v) => v.producto_id}
        vacio="Sin productos vinculados."
      />

      <form onSubmit={guardar} className="adm-form" aria-label={editando ? "Editar vínculo" : "Vincular producto"}>
        <h3 className="adm-detalle-subtitulo">{editando ? "Editar vínculo" : "Vincular producto"}</h3>
        <label>Producto *
          <select
            value={form.producto_id}
            onChange={(e) => setForm({ ...form, producto_id: e.target.value })}
            required
            disabled={editando || catalogo.estado !== "ok"}
          >
            <option value="">{catalogo.estado === "cargando" ? "Cargando…" : "Elegí un producto"}</option>
            {productos
              .filter((p) => editando || !vinculados.has(p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>{p.nombre} ({p.codigo})</option>
              ))}
          </select>
        </label>
        <div className="adm-fila-3">
          <label>Costo *
            <input value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} inputMode="decimal" placeholder="0,00" required />
          </label>
          <label>Moneda
            <select value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })}>
              <option value="ARS">ARS</option><option value="USD">USD</option>
            </select>
          </label>
          <label>SKU proveedor
            <input value={form.codigo_proveedor} onChange={(e) => setForm({ ...form, codigo_proveedor: e.target.value })} maxLength={80} />
          </label>
        </div>
        <div className="adm-fila-2">
          <label>Cantidad mínima
            <input type="number" min="1" value={form.cantidad_minima} onChange={(e) => setForm({ ...form, cantidad_minima: e.target.value })} />
          </label>
          <label>Entrega (días)
            <input type="number" min="0" max="365" value={form.tiempo_entrega_dias} onChange={(e) => setForm({ ...form, tiempo_entrega_dias: e.target.value })} />
          </label>
        </div>
        <label className="adm-check">
          <input type="checkbox" checked={form.es_principal} onChange={(e) => setForm({ ...form, es_principal: e.target.checked })} />
          Proveedor principal de este producto
        </label>
        <div className="adm-form-acciones">
          <button type="submit" className="btn-primary adm-btn" disabled={guardando || !form.producto_id}>
            {guardando ? "Guardando…" : editando ? "Guardar vínculo" : "Vincular"}
          </button>
          {editando && (
            <button type="button" className="btn-fantasma adm-btn" onClick={() => { setEditando(false); setForm({ ...VINCULO_VACIO, moneda: proveedor.moneda ?? "ARS" }); }}>
              Cancelar
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function Resumen({ p }) {
  const filas = [
    ["Razón social", p.nombre],
    ["Nombre comercial", p.nombre_comercial],
    ["CUIT", formatearCuit(p.cuit)],
    ["Condición IVA", CONDICIONES_IVA[p.condicion_iva]],
    ["Email", p.email],
    ["Teléfono", p.telefono],
    ["WhatsApp", p.whatsapp],
    ["Sitio web", p.sitio_web],
    ["Dirección", [p.direccion, p.ciudad, p.provincia].filter(Boolean).join(", ")],
    ["Pago", CONDICIONES_PAGO[p.condicion_pago]],
    ["Moneda", p.moneda],
    ["Entrega", p.plazo_entrega_dias != null ? `${p.plazo_entrega_dias} días` : ""],
    ["Pedido mínimo", p.pedido_minimo_centavos ? formatoMoneda(p.pedido_minimo_centavos, p.moneda) : ""],
    ["Descuento", Number(p.descuento_pct) ? `${p.descuento_pct}%` : ""],
    ["CBU", p.cbu_mascara],
    ["Alias", p.alias_cbu],
    ["Calificación", p.calificacion ? `${p.calificacion}/5` : ""],
    ["Etiquetas", (p.etiquetas ?? []).join(", ")],
  ].filter(([, v]) => v);

  return (
    <div className="adm-panel-interno">
      <dl className="adm-detalle-grid">
        {filas.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      {(p.contactos ?? []).length > 0 && (
        <>
          <h3 className="adm-detalle-subtitulo">Contactos</h3>
          <ul className="adm-lista-chica">
            {p.contactos.map((c, i) => (
              <li key={i}>
                <strong>{c.nombre}</strong>
                {c.cargo ? ` · ${c.cargo}` : ""}
                {c.email ? <> · <a href={`mailto:${c.email}`}>{c.email}</a></> : ""}
                {c.telefono ? ` · ${c.telefono}` : ""}
              </li>
            ))}
          </ul>
        </>
      )}
      {p.notas && (
        <>
          <h3 className="adm-detalle-subtitulo">Notas</h3>
          <p className="adm-texto-pre">{p.notas}</p>
        </>
      )}
    </div>
  );
}

function Ficha({ id, avisar, pedirConfirm, onEditar, onCerrar, onIr }) {
  const [pestana, setPestana] = useState("resumen");
  const { estado, datos, recargar } = useModulo(() => adminApi.proveedor(id), [id]);

  if (estado === "cargando") return <Skeleton lineas={5} etiqueta="Cargando ficha…" />;
  if (estado !== "ok") return <Proximamente modulo="Ficha del proveedor" />;

  const p = datos.proveedor;
  const pestanas = [
    { id: "resumen", etiqueta: "Resumen" },
    { id: "productos", etiqueta: `Productos (${datos.productos.length})` },
    ...(datos.ordenes ? [{ id: "ordenes", etiqueta: `Órdenes de compra (${datos.ordenes.length})` }] : []),
  ];

  const alTeclar = (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = pestanas.findIndex((t) => t.id === pestana);
    const sig = pestanas[(i + (e.key === "ArrowRight" ? 1 : pestanas.length - 1)) % pestanas.length];
    setPestana(sig.id);
    document.getElementById(`prov-tab-${sig.id}`)?.focus();
  };

  return (
    <section className="card adm-panel" aria-label={`Ficha de ${p.nombre}`}>
      <div className="adm-ficha-cab">
        <div>
          <h2>{p.nombre}</h2>
          {p.nombre_comercial && <p className="texto-mutado">{p.nombre_comercial}</p>}
        </div>
        <span className="adm-acciones">
          <EstadoProveedor estado={p.estado} />
          {!p.deleted_at && (
            <button type="button" className="btn-fantasma adm-mini" onClick={() => onEditar(p)}>Editar</button>
          )}
          <button type="button" className="btn-fantasma adm-mini" onClick={onCerrar} aria-label="Cerrar ficha">Cerrar</button>
        </span>
      </div>
      <div className="ht-tabs" role="tablist" aria-label="Secciones del proveedor" onKeyDown={alTeclar}>
        {pestanas.map((t) => (
          <button
            key={t.id}
            id={`prov-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={pestana === t.id}
            aria-controls={`prov-panel-${t.id}`}
            tabIndex={pestana === t.id ? 0 : -1}
            className={`ht-tab${pestana === t.id ? " es-activo" : ""}`}
            onClick={() => setPestana(t.id)}
          >
            {t.etiqueta}
          </button>
        ))}
      </div>
      <div id={`prov-panel-${pestana}`} role="tabpanel" aria-labelledby={`prov-tab-${pestana}`}>
        {pestana === "resumen" && <Resumen p={p} />}
        {pestana === "productos" && (
          <ProductosDelProveedor proveedor={p} vinculos={datos.productos} avisar={avisar} pedirConfirm={pedirConfirm} onCambio={recargar} />
        )}
        {pestana === "ordenes" && (
          <div className="adm-panel-interno">
            <Tabla
              columnas={[
                { clave: "codigo", titulo: "Orden" },
                { clave: "estado", titulo: "Estado", ver: (o) => <span className={`adm-estado es-${o.estado}`}>{ESTADOS_OC[o.estado] ?? o.estado}</span> },
                { clave: "total", titulo: "Total", ver: (o) => formatoMoneda(o.total_centavos, o.moneda) },
                { clave: "avance", titulo: "Recibido", ver: (o) => `${o.unidades_recibidas}/${o.unidades_pedidas}` },
                { clave: "fecha", titulo: "Creada", ver: (o) => fechaCorta(o.created_at) },
              ]}
              filas={datos.ordenes}
              filaKey={(o) => o.id}
              vacio="Sin órdenes de compra."
            />
            <div className="adm-form-acciones">
              <button type="button" className="btn-fantasma adm-btn" onClick={() => onIr("compras")}>Ir a Compras</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default function Proveedores({ avisar, pedirConfirm, onIr }) {
  const [q, setQ] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [papelera, setPapelera] = useState(false);
  const [form, setForm] = useState(VACIO_FORM);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [seleccionado, setSeleccionado] = useState(null);
  const [versionFicha, setVersionFicha] = useState(0);

  const { estado, datos, recargar } = useModulo(
    () => adminApi.proveedores({ busqueda, estado: filtroEstado, papelera }),
    [busqueda, filtroEstado, papelera]
  );
  const lista = datos?.proveedores ?? [];

  const alGuardar = async (e) => {
    e.preventDefault();
    const pedidoMinimo = aCentavos(form.pedido_minimo);
    if (pedidoMinimo === null) {
      avisar("Pedido mínimo inválido.", { tono: "error" });
      return;
    }
    const cuerpo = {
      nombre: form.nombre.trim(),
      nombre_comercial: form.nombre_comercial,
      cuit: form.cuit,
      condicion_iva: form.condicion_iva,
      email: form.email,
      telefono: form.telefono,
      whatsapp: form.whatsapp,
      sitio_web: form.sitio_web,
      direccion: form.direccion,
      provincia: form.provincia,
      ciudad: form.ciudad,
      contactos: form.contactos,
      condicion_pago: form.condicion_pago,
      moneda: form.moneda,
      plazo_entrega_dias: Number(form.plazo_entrega_dias || 0),
      pedido_minimo_centavos: pedidoMinimo,
      descuento_pct: Number(form.descuento_pct || 0),
      alias_cbu: form.alias_cbu,
      notas: form.notas,
      etiquetas: form.etiquetas.split(",").map((t) => t.trim()).filter(Boolean),
      calificacion: form.calificacion ? Number(form.calificacion) : null,
      estado: form.estado,
    };
    // El CBU nunca vuelve del servidor: se manda solo si se escribió uno nuevo.
    if (form.cbu.trim()) cuerpo.cbu = form.cbu;
    setGuardando(true);
    try {
      if (editando) {
        await adminApi.editarProveedor(editando.id, cuerpo);
        avisar("Proveedor actualizado.");
        setVersionFicha((v) => v + 1);
      } else {
        const r = await adminApi.crearProveedor(cuerpo);
        avisar("Proveedor creado.");
        if (r?.proveedor?.id) setSeleccionado(r.proveedor.id);
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

  const alEditar = (p) => {
    setEditando({ id: p.id, cbuMascara: p.cbu_mascara ?? "" });
    setForm(formDesde(p));
    const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: sinMovimiento ? "auto" : "smooth" });
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
      await adminApi.borrarProveedor(p.id);
      if (seleccionado === p.id) setSeleccionado(null);
      avisar(`«${p.nombre}» movido a papelera.`, { tono: "aviso" });
      recargar();
    } catch (err) {
      avisar(err?.message ?? "No se pudo borrar.", { tono: "error" });
    }
  };

  const alRestaurar = async (p) => {
    try {
      await adminApi.restaurarProveedor(p.id);
      avisar("Proveedor restaurado.");
      recargar();
    } catch (err) {
      avisar(err?.message ?? "No se pudo restaurar.", { tono: "error" });
    }
  };

  if (estado === "cargando" && !datos) return <Skeleton lineas={8} etiqueta="Cargando proveedores…" />;
  if (estado === "sin-permiso") return <SinPermiso modulo="Proveedores" />;
  if (estado === "no-disponible") return <Proximamente modulo="Proveedores" />;

  return (
    <div>
      <Cabecera
        kicker="Abastecimiento"
        titulo={`Proveedores (${lista.length})`}
        acciones={
          <button type="button" className="btn-fantasma adm-btn" onClick={recargar}>
            Actualizar
          </button>
        }
      />

      {seleccionado && (
        <Ficha
          key={`${seleccionado}-${versionFicha}`}
          id={seleccionado}
          avisar={avisar}
          pedirConfirm={pedirConfirm}
          onEditar={alEditar}
          onCerrar={() => setSeleccionado(null)}
          onIr={onIr}
        />
      )}

      <div className="adm-grid-2 adm-grid-productos">
        <FormProveedor
          editando={Boolean(editando)}
          cbuMascara={editando?.cbuMascara ?? ""}
          form={form}
          setForm={setForm}
          guardando={guardando}
          onGuardar={alGuardar}
          onCancelar={() => { setEditando(null); setForm(VACIO_FORM); }}
        />

        <section className="card adm-panel" aria-label="Listado">
          <h2 className="sr-only">Listado de proveedores</h2>
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
              placeholder="Razón social, nombre o CUIT"
              aria-label="Buscar proveedores"
            />
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} aria-label="Filtrar por estado">
              <option value="">Todos</option>
              <Opciones mapa={ESTADOS_PROVEEDOR} />
            </select>
            <button type="submit" className="btn-fantasma adm-btn">Buscar</button>
            <button
              type="button"
              className="btn-fantasma adm-btn"
              aria-pressed={papelera}
              onClick={() => setPapelera((v) => !v)}
            >
              {papelera ? "Ver activos" : "Papelera"}
            </button>
          </form>
          {lista.length === 0 ? (
            <Vacio
              titulo={papelera ? "Papelera vacía" : "Sin proveedores"}
              texto={busqueda || filtroEstado ? "Ninguno coincide con el filtro." : ""}
              accion={
                busqueda || filtroEstado ? (
                  <button type="button" className="btn-fantasma adm-btn" onClick={() => { setQ(""); setBusqueda(""); setFiltroEstado(""); }}>
                    Limpiar filtros
                  </button>
                ) : null
              }
            />
          ) : (
            <Tabla
              columnas={[
                { clave: "nombre", titulo: "Proveedor", ver: (p) => <><strong>{p.nombre}</strong>{p.nombre_comercial ? <><br /><span className="texto-mutado">{p.nombre_comercial}</span></> : null}</> },
                { clave: "cuit", titulo: "CUIT", ver: (p) => (p.cuit ? formatearCuit(p.cuit) : "—") },
                { clave: "provincia", titulo: "Provincia", ver: (p) => p.provincia || "—" },
                { clave: "pago", titulo: "Pago", ver: (p) => `${CONDICIONES_PAGO[p.condicion_pago] ?? "—"} · ${p.moneda ?? "ARS"}` },
                { clave: "estado", titulo: "Estado", ver: (p) => <EstadoProveedor estado={p.estado} /> },
                {
                  clave: "acciones", titulo: "Acciones",
                  ver: (p) => papelera ? (
                    <button type="button" className="btn-fantasma adm-mini" onClick={() => alRestaurar(p)}>Restaurar</button>
                  ) : (
                    <span className="adm-acciones">
                      <button type="button" className="btn-fantasma adm-mini" onClick={() => setSeleccionado(p.id)} aria-pressed={seleccionado === p.id}>Ficha</button>
                      <button type="button" className="btn-fantasma adm-mini" onClick={() => alEditar(p)}>Editar</button>
                      <button type="button" className="btn-fantasma adm-mini es-peligro" onClick={() => alBorrar(p)}>Papelera</button>
                    </span>
                  ),
                },
              ]}
              filas={lista}
              filaKey={(p) => p.id}
            />
          )}
        </section>
      </div>
    </div>
  );
}
