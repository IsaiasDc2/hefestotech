import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import "./ProductoDetalle.css";

function formatearClave(clave) {
  const conEspacios = clave.replace(/([A-Z])/g, " $1").toLowerCase();
  return conEspacios.charAt(0).toUpperCase() + conEspacios.slice(1);
}

function ProductoDetalle({ agregarAlCarrito }) {
  const { id } = useParams();

  const [producto, setProducto] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [reintento, setReintento] = useState(0);

  useEffect(() => {
    async function cargarProducto() {
      try {
        setCargando(true);
        setError(null);
        setProducto(null);

        const { data, error } = await supabase
          .from("productos")
          .select("*")
          .eq("id", id)
          .single();

        if (error) throw new Error("Producto no encontrado");

        setProducto(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setCargando(false);
      }
    }

    cargarProducto();
  }, [id, reintento]);

  if (cargando) {
    return <p className="detalle-estado">Cargando producto...</p>;
  }

  if (error) {
    const esConexion = error !== "Producto no encontrado";
    return (
      <div className="detalle-estado" role="alert">
        <p>{esConexion ? "No pudimos cargar el producto. Revisá tu conexión." : error}</p>
        <div className="detalle-acciones-error">
          <button
            type="button"
            className="btn-limpiar"
            onClick={() => setReintento((n) => n + 1)}
          >
            ↻ Reintentar
          </button>
          <Link to="/productos">← Volver al catálogo</Link>
        </div>
      </div>
    );
  }

  if (!producto) return null;

  const especificaciones = producto.especificaciones || {};
  const tieneOferta = (producto.descuento_porcentaje ?? 0) > 0;
  const precio = Number(producto.precio ?? 0);
  const precioFinal = Number(producto.precio_con_descuento ?? producto.precio ?? 0);

  return (
    <section className="detalle-container">
      <nav className="migajas" aria-label="Miga de pan">
        <Link to="/">Inicio</Link>
        <span className="migajas-sep" aria-hidden="true">/</span>
        <Link to="/productos">Catálogo</Link>
        <span className="migajas-sep" aria-hidden="true">/</span>
        <span className="migajas-actual">{producto.nombre}</span>
      </nav>
      <Link to="/productos" className="volver">
        ← Volver al catálogo
      </Link>

      <div className="detalle-grid">
        <div className="detalle-galeria">
          <div className="detalle-imagen">
            {tieneOferta && (
              <span className="detalle-oferta-flotante">
                OFERTA -{Math.round(Number(producto.descuento_porcentaje ?? 0))}%
              </span>
            )}
            {producto.imagen ? (
              <img
                src={producto.imagen}
                alt={producto.nombre || "Producto"}
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            ) : (
              <div className="detalle-sin-imagen" aria-hidden="true">HefestoTech</div>
            )}
          </div>
          {producto.imagen && (
            <div className="detalle-miniaturas" aria-hidden="true">
              <span style={{ backgroundImage: `url(${producto.imagen})` }} />
              <span style={{ backgroundImage: `url(${producto.imagen})` }} />
              <span style={{ backgroundImage: `url(${producto.imagen})` }} />
              <span style={{ backgroundImage: `url(${producto.imagen})` }} />
            </div>
          )}
        </div>

        <div className="detalle-info">
          {producto.marca && (
            <span className="detalle-marca">{producto.marca}</span>
          )}

          <h1>{producto.nombre}</h1>
          <p className="detalle-categoria">{producto.categoria}</p>

          {producto.descripcion && (
            <p className="detalle-descripcion">{producto.descripcion}</p>
          )}

          <div className="detalle-precio">
            {tieneOferta ? (
              <>
                <span className="precio-anterior">
                  ${precio.toLocaleString("es-AR")}
                </span>
                <strong>
                  ${precioFinal.toLocaleString("es-AR")}
                </strong>
              </>
            ) : (
              <strong>${precio.toLocaleString("es-AR")}</strong>
            )}
            <p className="cuotas">💳 6 cuotas sin interés</p>
            {producto.envio_gratis && <p className="envio">🚚 Envío gratis</p>}
          </div>

          <div className="detalle-stock">
            {producto.stock ? (
              <span className="disponible"><span className="stock-dot" aria-hidden="true" />🟢 Disponible</span>
            ) : (
              <span className="sin-stock"><span className="stock-dot" aria-hidden="true" />🔴 Sin stock</span>
            )}
          </div>

          <button
            className="btn-carrito"
            disabled={!producto.stock}
            onClick={() => agregarAlCarrito?.(producto)}
          >
            {producto.stock ? "🛒 Agregar al carrito" : "Sin stock"}
          </button>

          {Object.keys(especificaciones).length > 0 && (
            <div className="detalle-especificaciones">
              <h2>Características</h2>
              <table>
                <tbody>
                  {Object.entries(especificaciones).map(([clave, valor]) => (
                    <tr key={clave}>
                      <td className="clave">{formatearClave(clave)}</td>
                      <td className="valor">
                        {Array.isArray(valor) ? valor.join(", ") : String(valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default ProductoDetalle;
