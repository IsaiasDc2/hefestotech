import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router";
import { FaMinus, FaPlus, FaWhatsapp, FaCartPlus } from "react-icons/fa6";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import useDocumentTitle from "../../hooks/useDocumentTitle";
import useCatalogo from "../../hooks/useCatalogo";
import { obtenerProductoPorId, precioFinal as calcularPrecioFinal } from "../../services/productService";
import { CATEGORIAS, nombreCategoria } from "../../constants/categorias";
import { whatsappUrl } from "../../constants/whatsapp";
import { topeDeStock } from "../../store/cartStore";
import { nombreSpec, valorSpec } from "../../utils/specs";
import { JsonLd } from "../seo/JsonLd";
import { construirJsonLdProducto } from "../seo/jsonLdProducto";
import { NOMBRE_SITIO } from "../../seo/sitio";
import CotizadorEnvio from "../../pages/Carrito/CotizadorEnvio";
import Beneficios from "./Beneficios";
import Destacados from "./Destacados";
import PanelPrecio from "./PanelPrecio";
import ProductCard from "./ProductCard";
import "./ProductCard.css";
import "./ProductoDetalle.css";
import "./CalculadoraCuotas.css";

const ULTIMAS_UNIDADES = 3;

/* Producto por id con estado derivado del intento (sin setState sincrónico
   en el efecto). `null` = no existe o no está publicado → 404 amable. */
function useProducto(id) {
  const [intento, setIntento] = useState(0);
  const clave = `${id}#${intento}`;
  const [res, setRes] = useState({ clave: null, producto: null, error: null });

  useEffect(() => {
    let vivo = true;
    obtenerProductoPorId(id).then(
      (producto) => vivo && setRes({ clave, producto, error: null }),
      (error) => vivo && setRes({ clave, producto: null, error })
    );
    return () => {
      vivo = false;
    };
  }, [id, clave]);

  const cargando = res.clave !== clave;
  return {
    producto: cargando ? null : res.producto,
    error: cargando ? null : res.error,
    cargando,
    reintentar: () => setIntento((n) => n + 1),
  };
}

function SelectorCantidad({ cantidad, maximo, onCambio, idioma }) {
  return (
    <div className="detalle-cantidad" role="group" aria-label={t(idioma, "pd.cantidad")}>
      <button
        type="button"
        aria-label={t(idioma, "pd.menos")}
        disabled={cantidad <= 1}
        onClick={() => onCambio(cantidad - 1)}
      >
        <FaMinus aria-hidden="true" />
      </button>
      <output aria-live="polite">{cantidad}</output>
      <button
        type="button"
        aria-label={t(idioma, "pd.mas")}
        disabled={cantidad >= maximo}
        onClick={() => onCambio(cantidad + 1)}
      >
        <FaPlus aria-hidden="true" />
      </button>
    </div>
  );
}

function ProductoDetalle({ agregarAlCarrito }) {
  const { id } = useParams();
  const idioma = useIdiomaStore((s) => s.idioma);
  const { producto, error, cargando, reintentar } = useProducto(id);
  const { productos: catalogo } = useCatalogo();
  const [compra, setCompra] = useState({ id, cantidad: 1 });
  const [imgError, setImgError] = useState({ id: null });
  const cantidad = compra.id === id ? compra.cantidad : 1;

  // Título dinámico con el nombre real; durante la carga rige el de ruta.
  useDocumentTitle(producto?.nombre ? `${producto.nombre} | ${NOMBRE_SITIO}` : undefined);

  const relacionados = useMemo(() => {
    if (!producto) return [];
    return catalogo
      .filter(
        (p) =>
          p.id !== producto.id &&
          p.categoria === producto.categoria &&
          p.stock > 0 &&
          calcularPrecioFinal(p) > 0
      )
      .slice(0, 4);
  }, [catalogo, producto]);

  if (cargando) {
    return (
      <p className="detalle-estado" role="status">
        {t(idioma, "pd.cargando")}
      </p>
    );
  }

  if (error || !producto) {
    return (
      <div className="detalle-estado" role="alert">
        <p className="vacio-titulo">
          {error ? t(idioma, "pd.errorConexion") : t(idioma, "pd.noEncontrado")}
        </p>
        <div className="detalle-acciones-error">
          {error && (
            <button type="button" className="btn-limpiar" onClick={reintentar}>
              ↻ {t(idioma, "pd.reintentar")}
            </button>
          )}
          <Link to="/productos">← {t(idioma, "pd.volver")}</Link>
        </div>
      </div>
    );
  }

  const especificaciones = producto.especificaciones || {};
  const tieneOferta = Number(producto.descuento_porcentaje ?? 0) > 0;
  const precio = Number(producto.precio ?? 0);
  const final = calcularPrecioFinal(producto);
  const tienePrecio = final > 0;
  const stock = Number(producto.stock ?? 0);
  const hayStock = stock > 0;
  const maximo = Math.min(topeDeStock(producto), 99);
  const categoria = CATEGORIAS.find((c) => c.db === producto.categoria);
  const sinImagen = !producto.imagen || imgError.id === producto.id;
  const consulta = whatsappUrl(
    t(idioma, "wa.consulta").replace(
      "{producto}",
      `${producto.nombre}${producto.codigo ? ` (${producto.codigo})` : ""}`
    )
  );

  return (
    <section className="detalle-container">
      <JsonLd datos={construirJsonLdProducto(producto)} />
      <nav className="migajas" aria-label={t(idioma, "pd.migas")}>
        <Link to="/">{t(idioma, "pd.inicio")}</Link>
        <span className="migajas-sep" aria-hidden="true">/</span>
        <Link to="/productos">{t(idioma, "pd.catalogo")}</Link>
        {categoria && (
          <>
            <span className="migajas-sep" aria-hidden="true">/</span>
            <Link to={`/productos?categoria=${categoria.slug}`}>{nombreCategoria(categoria, idioma)}</Link>
          </>
        )}
        <span className="migajas-sep" aria-hidden="true">/</span>
        <span className="migajas-actual" aria-current="page">{producto.nombre}</span>
      </nav>

      <div className="detalle-grid">
        <div className="detalle-galeria">
          <div className="detalle-imagen">
            {tieneOferta && tienePrecio && (
              <span className="detalle-oferta-flotante">
                {t(idioma, "card.oferta")} -{Math.round(Number(producto.descuento_porcentaje ?? 0))}%
              </span>
            )}
            {sinImagen ? (
              <div className="detalle-sin-imagen" aria-hidden="true">HefestoTech</div>
            ) : (
              <img
                src={producto.imagen}
                alt={producto.nombre || t(idioma, "card.producto")}
                width="600"
                height="600"
                fetchPriority="high"
                onError={() => setImgError({ id: producto.id })}
              />
            )}
          </div>
        </div>

        <div className="detalle-info">
          {producto.marca && <span className="detalle-marca">{producto.marca}</span>}

          <h1>{producto.nombre}</h1>
          <p className="detalle-categoria">
            {nombreCategoria(categoria, idioma) || producto.categoria}
            {producto.codigo && (
              <>
                {" · "}
                <span className="detalle-codigo">
                  {t(idioma, "pd.codigo")} {producto.codigo}
                </span>
              </>
            )}
          </p>

          {producto.descripcion && <p className="detalle-descripcion">{producto.descripcion}</p>}

          <PanelPrecio
            producto={producto}
            precio={precio}
            final={final}
            tieneOferta={tieneOferta}
            descuento={Math.round(Number(producto.descuento_porcentaje ?? 0))}
            tienePrecio={tienePrecio}
            hayStock={hayStock}
          />

          {tienePrecio && hayStock ? (
            <div className="detalle-compra">
              <SelectorCantidad
                cantidad={cantidad}
                maximo={maximo}
                onCambio={(n) => setCompra({ id, cantidad: Math.min(Math.max(1, n), maximo) })}
                idioma={idioma}
              />
              <button
                type="button"
                className="btn-carrito"
                onClick={() => agregarAlCarrito?.(producto, cantidad)}
              >
                <FaCartPlus aria-hidden="true" /> {t(idioma, "pd.agregar")}
              </button>
            </div>
          ) : (
            <a className="btn-carrito btn-consultar" href={consulta} target="_blank" rel="noopener noreferrer">
              <FaWhatsapp aria-hidden="true" />{" "}
              {hayStock ? t(idioma, "catl.consultar") : t(idioma, "pd.avisarStock")}
            </a>
          )}

          <Destacados producto={producto} />
          {tienePrecio && hayStock && <CotizadorEnvio compacto subtotal={final * cantidad} />}
          <Beneficios stock={stock} ultimasUnidades={ULTIMAS_UNIDADES} envioGratis={Boolean(producto.envio_gratis)} />

          {Object.keys(especificaciones).length > 0 && (
            <div className="detalle-especificaciones">
              <h2>{t(idioma, "pd.caracteristicas")}</h2>
              <table>
                <tbody>
                  {Object.entries(especificaciones).map(([clave, valor]) => (
                    <tr key={clave}>
                      <th scope="row" className="clave">{nombreSpec(clave, idioma)}</th>
                      <td className="valor">{valorSpec(valor, { si: t(idioma, "pd.si"), no: t(idioma, "pd.no"), idioma })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {relacionados.length > 0 && (
        <section className="detalle-relacionados" aria-labelledby="detalle-relacionados">
          <h2 id="detalle-relacionados">{t(idioma, "pd.relacionados")}</h2>
          <ul>
            {relacionados.map((p) => (
              <li key={p.id}>
                <ProductCard producto={p} agregarAlCarrito={agregarAlCarrito} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

export default ProductoDetalle;
