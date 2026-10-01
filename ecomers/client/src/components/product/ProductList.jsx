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
  }, [id]);

  if (cargando) {
    return <p className="detalle-estado">Cargando producto...</p>;
  }

  if (error) {
    return (
      <div className="detalle-estado">
        <p>{error}</p>
        <Link to="/">← Volver al catálogo</Link>
      </div>
    );
  }

  if (!producto) return null;

  const especificaciones = producto.especificaciones || {};
  const tieneOferta = (producto.descuento_porcentaje ?? 0) > 0;

  return (
    <section className="detalle-container">
      <Link to="/" className="volver">
        ← Volver al catálogo
      </Link>

      <div className="detalle-grid">
        <div className="detalle-imagen">
          <img src={producto.imagen} alt={producto.nombre} />
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
                  ${producto.precio.toLocaleString("es-AR")}
                </span>
                <strong>
                  ${producto.precio_con_descuento.toLocaleString("es-AR")}
                </strong>
              </>
            ) : (
              <strong>${producto.precio.toLocaleString("es-AR")}</strong>
            )}
            <p className="cuotas">💳 6 cuotas sin interés</p>
            {producto.envio_gratis && <p className="envio">🚚 Envío gratis</p>}
          </div>

          <div className="detalle-stock">
            {producto.stock ? (
              <span className="disponible">🟢 Disponible</span>
            ) : (
              <span className="sin-stock">🔴 Sin stock</span>
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
