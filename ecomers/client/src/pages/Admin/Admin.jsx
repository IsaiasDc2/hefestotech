import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaBoxesStacked, FaArrowRight, FaArrowLeft, FaTriangleExclamation, FaTruckFast } from "react-icons/fa6";
import { supabase } from "../../components/lib/supabaseClient";
import "./Admin.css";

function Admin() {
  const [productos, setProductos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const [productoId, setProductoId] = useState("");
  const [tipo, setTipo] = useState("entrada");
  const [cantidad, setCantidad] = useState(1);
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState("");

  const cargar = async () => {
    setCargando(true);
    setError("");
    try {
      const [{ data: prods, error: e1 }, { data: movs, error: e2 }, { data: provs }] = await Promise.all([
        supabase.from("productos").select("id,nombre,stock,stock_minimo,precio").order("nombre").limit(200),
        supabase.from("movimientos_stock").select("id,producto_id,tipo,cantidad,motivo,created_at").order("created_at", { ascending: false }).limit(50),
        supabase.from("proveedores").select("id,nombre").order("nombre").limit(50),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      setProductos(prods || []);
      setMovimientos(movs || []);
      setProveedores(provs || []);
      if (!productoId && prods?.length) setProductoId(prods[0].id);
    } catch (err) {
      setError(`${err?.message || "No se pudo cargar."} — Revisá que 001 y 003 estén aplicadas en Supabase.`);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bajoStock = useMemo(
    () => productos.filter((p) => Number(p.stock ?? 0) <= Number(p.stock_minimo ?? 5)),
    [productos]
  );

  const filtrados = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return productos;
    return productos.filter((p) => p.nombre.toLowerCase().includes(t));
  }, [productos, busqueda]);

  const nombreProducto = (id) => productos.find((p) => p.id === id)?.nombre || id?.slice?.(0, 8) || "—";

  const registrar = async (e) => {
    e.preventDefault();
    setError("");
    setOk("");
    const cant = Number(cantidad);
    if (!productoId || !cant || cant <= 0) {
      setError("Elegí producto y cantidad mayor a 0.");
      return;
    }
    const prod = productos.find((p) => p.id === productoId);
    if (!prod) return;
    const stockActual = Number(prod.stock ?? 0);
    let nuevo = stockActual;
    if (tipo === "entrada") nuevo = stockActual + cant;
    else if (tipo === "salida") nuevo = stockActual - cant;
    else nuevo = cant;
    if (nuevo < 0) {
      setError(`Stock insuficiente: tenés ${stockActual}, querés sacar ${cant}.`);
      return;
    }
    setGuardando(true);
    try {
      const { error: eMov } = await supabase.from("movimientos_stock").insert({
        producto_id: productoId,
        tipo,
        cantidad: cant,
        motivo: motivo.trim(),
      });
      if (eMov) throw eMov;
      const { error: eProd } = await supabase.from("productos").update({ stock: nuevo }).eq("id", productoId);
      if (eProd) throw eProd;
      setOk(`${tipo === "entrada" ? "Entrada" : tipo === "salida" ? "Salida" : "Ajuste"} registrada: ${prod.nombre} quedó en ${nuevo}.`);
      setMotivo("");
      await cargar();
    } catch (err) {
      setError(err?.message || "No se pudo registrar el movimiento.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="admin">
      <header className="seccion-head editorial">
        <div className="seccion-titular">
          <p className="kicker"><span className="kicker-num">Stock</span> Admin</p>
          <h1>Administrar stock</h1>
        </div>
        <span className="badge badge-aviso"><FaTriangleExclamation aria-hidden="true" /> Sin control de rol todavía</span>
      </header>

      {bajoStock.length > 0 && (
        <section className="card admin-alerta" aria-label="Stock bajo">
          <h2><FaBoxesStacked aria-hidden="true" /> Bajo stock ({bajoStock.length})</h2>
          <ul>
            {bajoStock.slice(0, 8).map((p) => (
              <li key={p.id}>
                <span>{p.nombre}</span>
                <strong>{p.stock} / mín {p.stock_minimo ?? 5}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="admin-grid">
        <section className="card admin-panel" aria-label="Registrar movimiento">
          <h2>Registrar entrada / salida</h2>
          <form onSubmit={registrar} className="admin-form">
            <label>Producto
              <select value={productoId} onChange={(e) => setProductoId(e.target.value)} required>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre} (stock {p.stock})</option>
                ))}
              </select>
            </label>
            <div className="admin-fila">
              <label>Tipo
                <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                  <option value="entrada">Entrada (compra a proveedor)</option>
                  <option value="salida">Salida (venta / baja)</option>
                  <option value="ajuste">Ajuste (inventario)</option>
                </select>
              </label>
              <label>Cantidad
                <input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} required />
              </label>
            </div>
            <label>Motivo
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: compra a TechImport, venta mostrador…" />
            </label>
            {error && <p className="badge badge-peligro admin-msg" role="alert">{error}</p>}
            {ok && <p className="badge badge-ok admin-msg" role="status">{ok}</p>}
            <button type="submit" className="btn-primary" disabled={guardando || cargando}>
              {guardando ? "Guardando…" : "Registrar movimiento"}
            </button>
          </form>
          {proveedores.length > 0 && (
            <p className="texto-mutado admin-prov">
              <FaTruckFast aria-hidden="true" /> Proveedores: {proveedores.map((p) => p.nombre).join(" · ")}
            </p>
          )}
        </section>

        <section className="card admin-panel" aria-label="Productos">
          <h2>Productos ({filtrados.length})</h2>
          <input
            className="buscador"
            placeholder="Buscar producto…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar producto"
          />
          {cargando ? (
            <p className="texto-mutado">Cargando…</p>
          ) : (
            <ul className="admin-lista">
              {filtrados.slice(0, 30).map((p) => (
                <li key={p.id} className={Number(p.stock) <= Number(p.stock_minimo ?? 5) ? "es-bajo" : ""}>
                  <span>{p.nombre}</span>
                  <strong>{p.stock}</strong>
                  <button type="button" className="btn-fantasma admin-mini" onClick={() => setProductoId(p.id)}>Elegir</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card admin-panel" aria-label="Historial">
        <h2>Últimos movimientos</h2>
        {movimientos.length === 0 ? (
          <p className="texto-mutado">Sin movimientos todavía.</p>
        ) : (
          <ul className="admin-lista admin-historial">
            {movimientos.map((m) => (
              <li key={m.id}>
                <span className={`admin-tipo es-${m.tipo}`}>{m.tipo === "entrada" ? <FaArrowRight aria-hidden="true" /> : <FaArrowLeft aria-hidden="true" />} {m.tipo}</span>
                <span>{nombreProducto(m.producto_id)} × {m.cantidad}</span>
                <span className="texto-mutado">{m.motivo || "—"}</span>
                <span className="texto-mutado">{new Date(m.created_at).toLocaleString("es-AR")}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="texto-mutado">Siguiente paso: roles admin + editar precio y alta de productos. <Link to="/productos">Ver catálogo</Link></p>
      </section>
    </div>
  );
}

export default Admin;
