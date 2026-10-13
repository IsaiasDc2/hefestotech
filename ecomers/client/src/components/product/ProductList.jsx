import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import "./ProductoDetalle.css";

function formatearClave(clave) {
  const conEspacios = clave.replace(/([A-Z])/g, " $1").toLowerCase();
  return conEspacios.charAt(0).toUpperCase() + conEspacios.slice(1);
}

function ProductoDetalle({ agregarAlCarrito }) {
  const { id } = useParams();
  const idioma = useIdiomaStore((s) => s.idioma);

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

        if (error) throw new Error(t(idioma, "pd.noEncontrado"));

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
    return <p className="detalle-estado">{t(idioma, "pd.cargando")}</p>;
  }

  if (error) {
    const esConexion = error !== "Producto no encontrado" && error !== "Product not found" && error !== t(idioma, "pd.noEncontrado");
    return (
      <div className="detalle-estado" role="alert">
        <p>{esConexion ? t(idioma, "pd.errorConexion") : t(idioma, "pd.noEncontrado")}</p>
        <div className="detalle-acciones-error">
          <button
            type="button"
            className="btn-limpiar"
            onClick={() => setReintento((n) => n + 1)}
          >
            ↻ {t(idioma, "pd.reintentar")}
          </button>
          <Link to="/productos">← {t(idioma, "pd.volver")}</Link>
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
      <nav className="migajas" aria-label={t(idioma, "pd.migas")}>
        <Link to="/">{t(idioma, "pd.inicio")}</Link>
        <span className="migajas-sep" aria-hidden="true">/</span>
        <Link to="/productos">{t(idioma, "pd.catalogo")}</Link>
        <span className="migajas-sep" aria-hidden="true">/</span>
        <span className="migajas-actual">{producto.nombre}</span>
      </nav>
      <Link to="/productos" className="volver">
        ← {t(idioma, "pd.volver")}
      </Link>

      <div className="detalle-grid">
        <div className="detalle-galeria">
          <div className="detalle-imagen">
            {tieneOferta && (
              <span className="detalle-oferta-flotante">
                {t(idioma, "card.oferta")} -{Math.round(Number(producto.descuento_porcentaje ?? 0))}%
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
            <p className="cuotas">{t(idioma, "pd.cuotas")}</p>
            {producto.envio_gratis && <p className="envio">{t(idioma, "pd.envio")}</p>}
          </div>

          <div className="detalle-stock">
            {producto.stock ? (
              <span className="disponible"><span className="stock-dot" aria-hidden="true" />{t(idioma, "pd.disponible")}</span>
            ) : (
              <span className="sin-stock"><span className="stock-dot" aria-hidden="true" />{t(idioma, "pd.sinStock")}</span>
            )}
          </div>

          <button
            className="btn-carrito"
            disabled={!producto.stock}
            onClick={() => agregarAlCarrito?.(producto)}
          >
            {producto.stock ? t(idioma, "pd.agregar") : t(idioma, "pd.sinStock")}
          </button>

          {Object.keys(especificaciones).length > 0 && (
            <div className="detalle-especificaciones">
              <h2>{t(idioma, "pd.caracteristicas")}</h2>
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
