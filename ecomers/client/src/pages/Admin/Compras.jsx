// HefestoTech · Admin · Compras: sugerencias de reposición (stock < mínimo
// por proveedor principal) y órdenes de compra borrador → enviada →
// confirmada → recibida parcial/total, cancelada. La recepción suma stock en
// el servidor (RPC con adjust_stock) y deja el movimiento de inventario.
import { useState } from "react";
import { FaPlus, FaXmark } from "react-icons/fa6";
import { adminApi, fechaCorta } from "./adminApi";
import {
  ACCIONES_OC,
  ESTADOS_OC,
  OC_RECIBIBLES,
  aCentavos,
  centavosATexto,
  formatoMoneda,
} from "./compras";
import { Cabecera, Proximamente, SinPermiso, Skeleton, Tabla, Vacio } from "./ui";
import { useModulo } from "./hooks";

const PESTANAS = [
  { id: "reposicion", etiqueta: "Reposición" },
  { id: "ordenes", etiqueta: "Órdenes de compra" },
];

function EstadoOC({ estado }) {
  return <span className={`adm-estado es-${estado}`}>{ESTADOS_OC[estado] ?? estado}</span>;
}

function GrupoSugerido({ grupo, avisar, onCreada }) {
  const [cantidades, setCantidades] = useState(() =>
    Object.fromEntries(grupo.items.map((i) => [i.producto_id, String(i.sugerida)]))
  );
  const [creando, setCreando] = useState(false);
  const prov = grupo.proveedor;
  const moneda = prov?.moneda ?? "ARS";
  const total = grupo.items.reduce(
    (acc, i) => acc + Number(cantidades[i.producto_id] || 0) * i.costo_unitario_centavos,
    0
  );

  const crear = async () => {
    const items = grupo.items
      .map((i) => ({
        producto_id: i.producto_id,
        cantidad: Number(cantidades[i.producto_id] || 0),
        costo_unitario_centavos: i.costo_unitario_centavos,
      }))
      .filter((i) => i.cantidad > 0);
    if (!items.length) {
      avisar("Todas las cantidades están en cero.", { tono: "error" });
      return;
    }
    setCreando(true);
    try {
      const r = await adminApi.crearOrdenCompra({ proveedor_id: prov.id, items });
      avisar(`Borrador ${r?.orden?.codigo ?? ""} creado.`);
      onCreada(r?.orden?.id);
    } catch (err) {
      avisar(err?.message ?? "No se pudo crear la orden.", { tono: "error" });
    } finally {
      setCreando(false);
    }
  };

  return (
    <section className="card adm-panel" aria-label={prov ? `Reposición de ${prov.nombre}` : "Sin proveedor principal"}>
      <div className="adm-ficha-cab">
        <h2>{prov ? prov.nombre : "Sin proveedor principal"}</h2>
        {prov && prov.estado !== "activo" && (
          <span className="adm-insignia es-aviso">{prov.estado === "inactivo" ? "Inactivo" : "En evaluación"}</span>
        )}
      </div>
      <Tabla
        columnas={[
          { clave: "nombre", titulo: "Producto", ver: (i) => <><strong>{i.nombre}</strong><br /><span className="texto-mutado">{i.codigo}{i.codigo_proveedor ? ` · prov. ${i.codigo_proveedor}` : ""}</span></> },
          { clave: "stock", titulo: "Stock", ver: (i) => `${i.stock} / mín ${i.stock_minimo}` },
          { clave: "en_ordenes", titulo: "En órdenes", ver: (i) => i.en_ordenes || "—" },
          {
            clave: "cantidad", titulo: "Pedir",
            ver: (i) => (
              <input
                className="adm-celda-input"
                type="number"
                min="0"
                value={cantidades[i.producto_id]}
                onChange={(e) => setCantidades({ ...cantidades, [i.producto_id]: e.target.value })}
                aria-label={`Cantidad a pedir de ${i.nombre}`}
                disabled={!prov}
              />
            ),
          },
          { clave: "costo", titulo: "Costo", ver: (i) => (prov ? formatoMoneda(i.costo_unitario_centavos, moneda) : "—") },
        ]}
        filas={grupo.items}
        filaKey={(i) => i.producto_id}
      />
      {prov && (
        <div className="adm-form-acciones adm-pie-grupo">
          <span>
            Total estimado: <strong>{formatoMoneda(total, moneda)}</strong>
            {prov.pedido_minimo_centavos > 0 && total < prov.pedido_minimo_centavos && (
              <span className="adm-insignia es-aviso">Bajo el pedido mínimo ({formatoMoneda(prov.pedido_minimo_centavos, moneda)})</span>
            )}
          </span>
          <button
            type="button"
            className="btn-primary adm-btn"
            onClick={crear}
            disabled={creando || prov.estado === "inactivo"}
          >
            {creando ? "Creando…" : "Crear borrador"}
          </button>
        </div>
      )}
    </section>
  );
}

function Reposicion({ avisar, onCreada }) {
  const { estado, datos, recargar } = useModulo(() => adminApi.sugerenciasCompra(), []);
  if (estado === "cargando") return <Skeleton lineas={5} etiqueta="Calculando reposición…" />;
  if (estado === "sin-permiso") return <SinPermiso modulo="Reposición" />;
  if (estado === "no-disponible") return <Proximamente modulo="Reposición" />;
  const grupos = datos?.grupos ?? [];
  if (!grupos.length) return <Vacio titulo="Nada para reponer" />;
  return (
    <div className="adm-pila">
      {grupos.map((g) => (
        <GrupoSugerido
          key={g.proveedor?.id ?? "sin-proveedor"}
          grupo={g}
          avisar={avisar}
          onCreada={(id) => {
            recargar();
            onCreada(id);
          }}
        />
      ))}
    </div>
  );
}

const LINEA_VACIA = { producto_id: "", cantidad: "1", costo: "" };

function NuevaOrden({ avisar, onCreada, onCancelar }) {
  const [proveedorId, setProveedorId] = useState("");
  const [lineas, setLineas] = useState([{ ...LINEA_VACIA }]);
  const [notas, setNotas] = useState("");
  const [fecha, setFecha] = useState("");
  const [guardando, setGuardando] = useState(false);
  const provs = useModulo(() => adminApi.proveedores({ limit: 200 }), []);
  const catalogo = useModulo(() => adminApi.productos({ limit: 200 }), []);
  const ficha = useModulo(
    () => (proveedorId ? adminApi.proveedor(proveedorId) : Promise.resolve(null)),
    [proveedorId]
  );
  const costos = Object.fromEntries((ficha.datos?.productos ?? []).map((v) => [v.producto_id, v.costo_centavos]));
  const proveedores = (provs.datos?.proveedores ?? []).filter((p) => p.estado !== "inactivo");
  const productos = catalogo.datos?.productos ?? [];

  const setLinea = (i, cambios) => setLineas(lineas.map((l, j) => (j === i ? { ...l, ...cambios } : l)));

  const guardar = async (e) => {
    e.preventDefault();
    const items = [];
    for (const l of lineas) {
      if (!l.producto_id) continue;
      const costo = aCentavos(l.costo);
      if (costo === null) {
        avisar("Hay un costo inválido.", { tono: "error" });
        return;
      }
      items.push({ producto_id: l.producto_id, cantidad: Number(l.cantidad || 0), costo_unitario_centavos: costo });
    }
    if (!items.length) {
      avisar("Agregá al menos un producto.", { tono: "error" });
      return;
    }
    setGuardando(true);
    try {
      const r = await adminApi.crearOrdenCompra({
        proveedor_id: proveedorId, items, notas, fecha_esperada: fecha || null,
      });
      avisar(`Borrador ${r?.orden?.codigo ?? ""} creado.`);
      onCreada(r?.orden?.id);
    } catch (err) {
      avisar(err?.message ?? "No se pudo crear la orden.", { tono: "error" });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="card adm-panel" aria-label="Nueva orden de compra">
      <h2>Nueva orden de compra</h2>
      <form className="adm-form" onSubmit={guardar}>
        <div className="adm-fila-2">
          <label>Proveedor *
            <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} required>
              <option value="">{provs.estado === "cargando" ? "Cargando…" : "Elegí un proveedor"}</option>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          <label>Fecha esperada
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
        </div>
        <fieldset className="adm-fieldset">
          <legend>Productos</legend>
          {lineas.map((l, i) => (
            <div key={i} className="adm-linea-oc">
              <select
                value={l.producto_id}
                onChange={(e) => {
                  const id = e.target.value;
                  setLinea(i, { producto_id: id, costo: costos[id] != null ? centavosATexto(costos[id]) : l.costo });
                }}
                aria-label={`Producto de la línea ${i + 1}`}
              >
                <option value="">Producto</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre} ({p.codigo}){costos[p.id] != null ? " ★" : ""}</option>
                ))}
              </select>
              <input type="number" min="1" value={l.cantidad} onChange={(e) => setLinea(i, { cantidad: e.target.value })} aria-label={`Cantidad de la línea ${i + 1}`} />
              <input inputMode="decimal" placeholder="Costo unit." value={l.costo} onChange={(e) => setLinea(i, { costo: e.target.value })} aria-label={`Costo unitario de la línea ${i + 1}`} />
              <button type="button" className="btn-fantasma adm-mini es-peligro" onClick={() => setLineas(lineas.filter((_, j) => j !== i))} disabled={lineas.length === 1} aria-label={`Quitar línea ${i + 1}`}>
                Quitar
              </button>
            </div>
          ))}
          <button type="button" className="btn-fantasma adm-mini" onClick={() => setLineas([...lineas, { ...LINEA_VACIA }])}>
            Agregar línea
          </button>
        </fieldset>
        <label>Notas
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={2000} />
        </label>
        <div className="adm-form-acciones">
          <button type="button" className="btn-fantasma adm-btn" onClick={onCancelar}>Cancelar</button>
          <button type="submit" className="btn-primary adm-btn" disabled={guardando || !proveedorId}>
            {guardando ? "Creando…" : "Crear borrador"}
          </button>
        </div>
      </form>
    </section>
  );
}

function DetalleOrden({ id, avisar, pedirConfirm, onCambio, onCerrar }) {
  const { estado, datos, recargar } = useModulo(() => adminApi.ordenCompra(id), [id]);
  const [recibir, setRecibir] = useState({});
  const [nota, setNota] = useState("");
  const [actualizarCosto, setActualizarCosto] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [edicion, setEdicion] = useState(null);

  if (estado === "cargando" && !datos) return <Skeleton lineas={5} etiqueta="Cargando orden…" />;
  if (estado === "sin-permiso") return <SinPermiso modulo="Orden de compra" />;
  if (estado !== "ok" && !datos) return <Proximamente modulo="Orden de compra" />;

  const oc = datos.orden;
  const items = oc.ordenes_compra_items ?? [];
  const recibible = OC_RECIBIBLES.has(oc.estado);
  const pendiente = (it) => it.cantidad - it.cantidad_recibida;
  const valorRecibir = (it) => recibir[it.producto_id] ?? String(pendiente(it));

  const refrescar = () => {
    recargar();
    onCambio();
  };

  const cambiarEstado = async (accion) => {
    if (accion.peligro) {
      const ok = await pedirConfirm({
        titulo: `${accion.etiqueta} ${oc.codigo}`,
        texto: oc.estado === "recibida_parcial"
          ? "Lo pendiente deja de esperarse. Lo ya recibido queda en stock."
          : "La orden queda cancelada y no se puede reabrir.",
        confirmar: accion.etiqueta,
        peligro: true,
      });
      if (!ok) return;
    }
    setOcupado(true);
    try {
      await adminApi.estadoOrdenCompra(oc.id, accion.a);
      avisar(`${oc.codigo}: ${ESTADOS_OC[accion.a].toLowerCase()}.`);
      refrescar();
    } catch (err) {
      avisar(err?.message ?? "No se pudo cambiar el estado.", { tono: "error" });
    } finally {
      setOcupado(false);
    }
  };

  const registrarRecepcion = async (e) => {
    e.preventDefault();
    const lineas = items
      .map((it) => ({ producto_id: it.producto_id, cantidad: Number(valorRecibir(it) || 0) }))
      .filter((l) => l.cantidad > 0);
    if (!lineas.length) {
      avisar("No hay cantidades para recibir.", { tono: "error" });
      return;
    }
    const unidades = lineas.reduce((a, l) => a + l.cantidad, 0);
    const ok = await pedirConfirm({
      titulo: `Recibir mercadería · ${oc.codigo}`,
      texto: `Se suman ${unidades} unidades al stock y queda el movimiento de inventario. No se puede deshacer desde acá.`,
      confirmar: "Registrar recepción",
    });
    if (!ok) return;
    setOcupado(true);
    try {
      const r = await adminApi.recibirOrdenCompra(oc.id, { items: lineas, nota, actualizar_costo: actualizarCosto });
      avisar(`${oc.codigo}: ${ESTADOS_OC[r?.estado]?.toLowerCase() ?? "recepción registrada"}.`);
      setRecibir({});
      setNota("");
      refrescar();
    } catch (err) {
      avisar(err?.message ?? "No se pudo registrar la recepción.", { tono: "error" });
    } finally {
      setOcupado(false);
    }
  };

  const guardarBorrador = async () => {
    const lineas = [];
    for (const it of items) {
      const e = edicion[it.producto_id];
      const costo = aCentavos(e.costo);
      if (costo === null) {
        avisar("Hay un costo inválido.", { tono: "error" });
        return;
      }
      const cantidad = Number(e.cantidad || 0);
      if (cantidad > 0) lineas.push({ producto_id: it.producto_id, cantidad, costo_unitario_centavos: costo });
    }
    if (!lineas.length) {
      avisar("La orden necesita al menos un producto.", { tono: "error" });
      return;
    }
    setOcupado(true);
    try {
      await adminApi.editarOrdenCompra(oc.id, { items: lineas });
      avisar("Borrador guardado.");
      setEdicion(null);
      refrescar();
    } catch (err) {
      avisar(err?.message ?? "No se pudo guardar.", { tono: "error" });
    } finally {
      setOcupado(false);
    }
  };

  const columnas = [
    { clave: "producto", titulo: "Producto", ver: (it) => <><strong>{it.productos?.nombre ?? "—"}</strong><br /><span className="texto-mutado">{it.productos?.codigo ?? ""} · stock {it.productos?.stock ?? 0}</span></> },
    {
      clave: "cantidad", titulo: "Pedido",
      ver: (it) => edicion ? (
        <input className="adm-celda-input" type="number" min="0" value={edicion[it.producto_id].cantidad}
          onChange={(e) => setEdicion({ ...edicion, [it.producto_id]: { ...edicion[it.producto_id], cantidad: e.target.value } })}
          aria-label={`Cantidad de ${it.productos?.nombre ?? "producto"}`} />
      ) : it.cantidad,
    },
    { clave: "recibida", titulo: "Recibido", ver: (it) => it.cantidad_recibida },
    {
      clave: "costo", titulo: "Costo unit.",
      ver: (it) => edicion ? (
        <input className="adm-celda-input" inputMode="decimal" value={edicion[it.producto_id].costo}
          onChange={(e) => setEdicion({ ...edicion, [it.producto_id]: { ...edicion[it.producto_id], costo: e.target.value } })}
          aria-label={`Costo unitario de ${it.productos?.nombre ?? "producto"}`} />
      ) : formatoMoneda(it.costo_unitario_centavos, oc.moneda),
    },
    { clave: "subtotal", titulo: "Subtotal", ver: (it) => formatoMoneda(it.cantidad * it.costo_unitario_centavos, oc.moneda) },
  ];
  if (recibible) {
    columnas.push({
      clave: "recibir", titulo: "Recibir ahora",
      ver: (it) => pendiente(it) > 0 ? (
        <input className="adm-celda-input" type="number" min="0" max={pendiente(it)} value={valorRecibir(it)}
          onChange={(e) => setRecibir({ ...recibir, [it.producto_id]: e.target.value })}
          aria-label={`Unidades a recibir de ${it.productos?.nombre ?? "producto"}`} form="form-recepcion" />
      ) : "—",
    });
  }

  return (
    <section className="card adm-panel" aria-label={`Orden ${oc.codigo}`}>
      <div className="adm-ficha-cab">
        <div>
          <h2>{oc.codigo} · {oc.proveedores?.nombre ?? "—"}</h2>
          <p className="texto-mutado">
            Creada {fechaCorta(oc.created_at)}
            {oc.fecha_esperada ? ` · esperada ${oc.fecha_esperada}` : ""}
            {oc.enviada_at ? ` · enviada ${fechaCorta(oc.enviada_at)}` : ""}
          </p>
        </div>
        <span className="adm-acciones">
          <EstadoOC estado={oc.estado} />
          <button type="button" className="btn-fantasma adm-mini" onClick={onCerrar} aria-label="Cerrar orden">Cerrar</button>
        </span>
      </div>

      <Tabla columnas={columnas} filas={items} filaKey={(it) => it.id} vacio="Sin productos." />
      <p>Total: <strong>{formatoMoneda(oc.total_centavos, oc.moneda)}</strong> · {oc.unidades_recibidas}/{oc.unidades_pedidas} unidades recibidas</p>
      {oc.notas && <p className="adm-texto-pre texto-mutado">{oc.notas}</p>}

      <div className="adm-form-acciones">
        {oc.estado === "borrador" && !edicion && (
          <button type="button" className="btn-fantasma adm-btn" disabled={ocupado}
            onClick={() => setEdicion(Object.fromEntries(items.map((it) => [it.producto_id, { cantidad: String(it.cantidad), costo: centavosATexto(it.costo_unitario_centavos) }])))}>
            Editar cantidades
          </button>
        )}
        {edicion && (
          <>
            <button type="button" className="btn-fantasma adm-btn" onClick={() => setEdicion(null)}>Descartar</button>
            <button type="button" className="btn-primary adm-btn" onClick={guardarBorrador} disabled={ocupado}>Guardar borrador</button>
          </>
        )}
        {!edicion && (ACCIONES_OC[oc.estado] ?? []).map((accion) => (
          <button
            key={accion.a}
            type="button"
            className={`adm-btn ${accion.peligro ? "btn-fantasma es-peligro" : "btn-primary"}`}
            onClick={() => cambiarEstado(accion)}
            disabled={ocupado}
          >
            {accion.etiqueta}
          </button>
        ))}
      </div>

      {recibible && (
        <form id="form-recepcion" className="adm-form" onSubmit={registrarRecepcion} aria-label="Recepción de mercadería">
          <h3 className="adm-detalle-subtitulo">Recepción de mercadería</h3>
          <label>Nota (remito, observaciones)
            <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={2000} />
          </label>
          <label className="adm-check">
            <input type="checkbox" checked={actualizarCosto} onChange={(e) => setActualizarCosto(e.target.checked)} />
            Actualizar el costo del proveedor con el de esta orden
          </label>
          <div className="adm-form-acciones">
            <button type="submit" className="btn-primary adm-btn" disabled={ocupado}>
              {ocupado ? "Registrando…" : "Registrar recepción"}
            </button>
          </div>
        </form>
      )}

      {datos.recepciones?.length > 0 && (
        <>
          <h3 className="adm-detalle-subtitulo">Recepciones</h3>
          <ul className="adm-lista-chica">
            {datos.recepciones.map((r) => (
              <li key={r.id}>
                <strong>{fechaCorta(r.created_at)}</strong>
                {" · "}
                {(r.items ?? []).reduce((a, x) => a + Number(x.cantidad || 0), 0)} unidades
                {r.nota ? ` · ${r.nota}` : ""}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Ordenes({ avisar, pedirConfirm, seleccionada, onSeleccionar, creando, onCrear }) {
  const [filtro, setFiltro] = useState("");
  const { estado, datos, recargar } = useModulo(() => adminApi.ordenesCompra({ estado: filtro }), [filtro]);
  const lista = datos?.ordenes ?? [];

  if (estado === "cargando" && !datos) return <Skeleton lineas={6} etiqueta="Cargando órdenes…" />;
  if (estado === "sin-permiso") return <SinPermiso modulo="Órdenes de compra" />;
  if (estado === "no-disponible") return <Proximamente modulo="Órdenes de compra" />;

  return (
    <div className="adm-pila">
      {seleccionada && (
        <DetalleOrden
          key={seleccionada}
          id={seleccionada}
          avisar={avisar}
          pedirConfirm={pedirConfirm}
          onCambio={recargar}
          onCerrar={() => onSeleccionar(null)}
        />
      )}
      {creando && (
        <NuevaOrden
          avisar={avisar}
          onCancelar={() => onCrear(false)}
          onCreada={(id) => {
            onCrear(false);
            recargar();
            if (id) onSeleccionar(id);
          }}
        />
      )}
      <section className="card adm-panel" aria-label="Órdenes de compra">
        <div className="adm-buscador-linea">
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Filtrar por estado">
            <option value="">Todos los estados</option>
            {Object.entries(ESTADOS_OC).map(([v, e]) => <option key={v} value={v}>{e}</option>)}
          </select>
          <button type="button" className="btn-fantasma adm-btn" onClick={recargar}>
            Actualizar
          </button>
        </div>
        <Tabla
          columnas={[
            { clave: "codigo", titulo: "Orden", ver: (o) => <strong>{o.codigo}</strong> },
            { clave: "proveedor", titulo: "Proveedor", ver: (o) => o.proveedores?.nombre ?? "—" },
            { clave: "estado", titulo: "Estado", ver: (o) => <EstadoOC estado={o.estado} /> },
            { clave: "total", titulo: "Total", ver: (o) => formatoMoneda(o.total_centavos, o.moneda) },
            { clave: "avance", titulo: "Recibido", ver: (o) => `${o.unidades_recibidas}/${o.unidades_pedidas}` },
            { clave: "fecha", titulo: "Creada", ver: (o) => fechaCorta(o.created_at) },
            {
              clave: "ver", titulo: "Acciones",
              ver: (o) => (
                <button type="button" className="btn-fantasma adm-mini" onClick={() => onSeleccionar(o.id)} aria-pressed={seleccionada === o.id}>
                  Ver
                </button>
              ),
            },
          ]}
          filas={lista}
          filaKey={(o) => o.id}
          vacio={filtro ? "Ninguna orden en ese estado." : "Sin órdenes de compra."}
        />
      </section>
    </div>
  );
}

export default function Compras({ avisar, pedirConfirm }) {
  const [pestana, setPestana] = useState("reposicion");
  const [seleccionada, setSeleccionada] = useState(null);
  const [creando, setCreando] = useState(false);
  const creandoVisible = creando && pestana === "ordenes";

  const alTeclar = (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = PESTANAS.findIndex((p) => p.id === pestana);
    const sig = PESTANAS[(i + (e.key === "ArrowRight" ? 1 : PESTANAS.length - 1)) % PESTANAS.length];
    if (sig.id === "reposicion") setCreando(false);
    setPestana(sig.id);
    document.getElementById(`compras-tab-${sig.id}`)?.focus();
  };

  return (
    <div>
      <Cabecera
        kicker="Abastecimiento"
        titulo="Compras"
        acciones={
          <div className="adm-acciones-cab">
            <button
              type="button"
              className={creandoVisible ? "btn-fantasma adm-btn" : "btn-primary adm-btn"}
              onClick={() => {
                if (creandoVisible) {
                  setCreando(false);
                  return;
                }
                setPestana("ordenes");
                setSeleccionada(null);
                setCreando(true);
              }}
              aria-expanded={creandoVisible}
            >
              {creandoVisible ? <FaXmark aria-hidden="true" /> : <FaPlus aria-hidden="true" />}{" "}
              {creandoVisible ? "Cerrar" : "Nueva orden"}
            </button>
          </div>
        }
      />
      <div className="ht-tabs" role="tablist" aria-label="Secciones de compras" onKeyDown={alTeclar}>
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            id={`compras-tab-${p.id}`}
            type="button"
            role="tab"
            aria-selected={pestana === p.id}
            aria-controls={`compras-panel-${p.id}`}
            tabIndex={pestana === p.id ? 0 : -1}
            className={`ht-tab${pestana === p.id ? " es-activo" : ""}`}
            onClick={() => {
              if (p.id === "reposicion") setCreando(false);
              setPestana(p.id);
            }}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>
      <div id={`compras-panel-${pestana}`} role="tabpanel" aria-labelledby={`compras-tab-${pestana}`}>
        {pestana === "reposicion" ? (
          <Reposicion
            avisar={avisar}
            onCreada={(id) => {
              setSeleccionada(id ?? null);
              setPestana("ordenes");
            }}
          />
        ) : (
          <Ordenes
            avisar={avisar}
            pedirConfirm={pedirConfirm}
            seleccionada={seleccionada}
            onSeleccionar={setSeleccionada}
            creando={creando}
            onCrear={setCreando}
          />
        )}
      </div>
    </div>
  );
}
