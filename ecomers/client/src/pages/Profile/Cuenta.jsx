import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FaBoxOpen, FaHeart, FaArrowRight, FaRightFromBracket, FaCartPlus, FaTrashCan, FaRotateLeft, FaTriangleExclamation } from "react-icons/fa6";
import Login from "../Login/Login";
import Registro from "../Login/Registro";
import Marca from "../../components/brand/Marca";
import ProductCard from "../../components/product/ProductCard";
import useAuthStore from "../../store/authStore";
import useCartStore from "../../store/cartStore";
import { obtenerProductosPorIds, useFavoritos } from "../../services/favoritos";
import "./Cuenta.css";

const VISTAS = [
  { id: "login", label: "Ingresar" },
  { id: "registro", label: "Crear cuenta" },
  { id: "pedidos", label: "Mis pedidos" },
  { id: "favoritos", label: "Favoritos" },
];

// Seccion Favoritos: mismo ProductCard del catalogo, quitar con aviso y
// deshacer, mover al carrito, vacio con acceso al catalogo y aviso para
// productos ocultos (inexistentes o dados de baja).
function SeccionFavoritos() {
  const { ids, cargando, error, ultimoQuitado, quitar, quitarMuchos, deshacerQuitado, limpiarError } = useFavoritos();
  const agregarAlCarrito = useCartStore((s) => s.agregarAlCarrito);
  const [productos, setProductos] = useState([]);
  const [ocultosIds, setOcultosIds] = useState([]);
  const [cargandoProductos, setCargandoProductos] = useState(false);
  const [errorProductos, setErrorProductos] = useState("");
  const [eliminandoId, setEliminandoId] = useState(null);

  useEffect(() => {
    let vivo = true;
    if (ids.length === 0) {
      setProductos([]);
      setOcultosIds([]);
      return undefined;
    }
    setCargandoProductos(true);
    setErrorProductos("");
    obtenerProductosPorIds(ids)
      .then(({ visibles, ocultosIds: ocultos }) => {
        if (!vivo) return;
        setProductos(visibles);
        setOcultosIds(ocultos);
      })
      .catch((err) => {
        if (vivo) setErrorProductos(err?.message || "No se pudieron cargar los favoritos.");
      })
      .finally(() => {
        if (vivo) setCargandoProductos(false);
      });
    return () => {
      vivo = false;
    };
  }, [ids]);

  const quitarAnimado = (id, nombre) => {
    setEliminandoId(String(id));
    window.setTimeout(() => {
      quitar(id, nombre).finally(() => setEliminandoId(null));
    }, 180);
  };

  const moverAlCarrito = (producto) => {
    agregarAlCarrito?.(producto);
    quitar(producto.id, producto.nombre);
  };

  const limpiarOcultos = () => {
    quitarMuchos(ocultosIds);
  };

  if (cargando || cargandoProductos) {
    return (
      <div className="panel-cuenta card anim-entrada" id="favoritos">
        <p className="badge badge-info">Guardados</p>
        <h2>Mis favoritos</h2>
        <p role="status">Cargando tus guardados…</p>
      </div>
    );
  }

  if (ids.length === 0 && !ultimoQuitado) {
    return (
      <div className="panel-cuenta card anim-entrada" id="favoritos">
        <p className="badge badge-info">Guardados</p>
        <h2>Mis favoritos</h2>
        <p>No tenés productos favoritos.</p>
        <div className="vacio">
          <span className="marca-centrada" aria-hidden="true">
            <Marca variante="simbolo" ancho={40} alto={40} decorativa />
          </span>
          <span className="vacio-icono" aria-hidden="true">
            <FaHeart />
          </span>
          <p className="vacio-titulo">Nada guardado por ahora</p>
          <p className="vacio-texto">Marcá el corazón en un producto y lo ves acá.</p>
          <Link to="/productos" className="btn-fantasma">
            Explorar catálogo <FaArrowRight aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-cuenta card anim-entrada" id="favoritos">
      <p className="badge badge-info">Guardados</p>
      <h2>Mis favoritos ({productos.length})</h2>
      {(error || errorProductos) && (
        <p className="badge badge-peligro login-error" role="alert">
          {error || errorProductos}{" "}
          <button type="button" className="registro-link" onClick={() => { limpiarError(); setErrorProductos(""); }}>
            Ocultar
          </button>
        </p>
      )}
      {ocultosIds.length > 0 && (
        <p className="badge badge-aviso" role="status">
          <FaTriangleExclamation aria-hidden="true" /> {ocultosIds.length} guardado(s) ya no están
          disponibles y se ocultaron.{" "}
          <button type="button" className="registro-link" onClick={limpiarOcultos}>
            Limpiar no disponibles
          </button>
        </p>
      )}
      {ultimoQuitado && (
        <p className="badge badge-info" role="status">
          Quitado: {ultimoQuitado.nombre}.{" "}
          <button type="button" className="registro-link" onClick={deshacerQuitado}>
            <FaRotateLeft aria-hidden="true" /> Deshacer
          </button>
        </p>
      )}
      <div className="grid-productos">
        {productos.map((producto) => (
          <div
            key={producto.id}
            style={eliminandoId === String(producto.id) ? { opacity: 0, transition: "opacity 180ms" } : undefined}
          >
            <ProductCard producto={producto} agregarAlCarrito={agregarAlCarrito} />
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button
                type="button"
                className="btn-fantasma"
                onClick={() => moverAlCarrito(producto)}
                aria-label={`Mover ${producto.nombre || "producto"} al carrito`}
              >
                <FaCartPlus aria-hidden="true" /> Mover al carrito
              </button>
              <button
                type="button"
                className="btn-fantasma"
                onClick={() => quitarAnimado(producto.id, producto.nombre)}
                aria-label={`Quitar ${producto.nombre || "producto"} de favoritos`}
              >
                <FaTrashCan aria-hidden="true" /> Quitar
              </button>
            </div>
          </div>
        ))}
      </div>
      {productos.length === 0 && ocultosIds.length > 0 && (
        <div className="vacio">
          <p className="vacio-titulo">Solo quedan no disponibles</p>
          <p className="vacio-texto">Limpiá la lista o explorá el catálogo.</p>
          <Link to="/productos" className="btn-fantasma">
            Explorar catálogo <FaArrowRight aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
}

function Cuenta() {
  const [vista, setVista] = useState("login");
  const [params] = useSearchParams();
  const usuario = useAuthStore((s) => s.usuario);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);

  // Enlace profundo para el contador del header: /cuenta?tab=favoritos
  // abre directo la seccion de guardados.
  useEffect(() => {
    const tab = params.get("tab");
    if (tab === "favoritos" || params.get("modo") === "favoritos") {
      setVista("favoritos");
    }
  }, [params]);

  return (
    <div className="cuenta">
      <p className="badge badge-info hero-kicker">HefestoTech · Mi cuenta</p>
      {isAuthenticated && usuario && (
        <div className="panel-cuenta card cuenta-sesion">
          <p className="texto-mutado">Sesión activa como <strong>{usuario.email}</strong></p>
          <button type="button" className="btn-fantasma" onClick={logout}>
            <FaRightFromBracket aria-hidden="true" /> Cerrar sesión
          </button>
        </div>
      )}
      <nav className="cuenta-tabs" aria-label="Secciones de la cuenta" role="tablist">
        {VISTAS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={vista === v.id}
            className={vista === v.id ? "activo" : ""}
            aria-current={vista === v.id ? "page" : undefined}
            onClick={() => setVista(v.id)}
          >
            {v.label}
          </button>
        ))}
      </nav>
      <div className="contenido" role="tabpanel">
        {vista === "login" && <Login onIrRegistro={() => setVista("registro")} />}

        {vista === "registro" && <Registro />}

        {vista === "pedidos" && (
          <div className="panel-cuenta card anim-entrada">
            <p className="badge badge-info">Historial</p>
            <h2>Mis pedidos</h2>
            <p>Todavía no tenés pedidos realizados.</p>
            <div className="vacio">
              <span className="marca-centrada" aria-hidden="true">
                <Marca variante="simbolo" ancho={40} alto={40} decorativa />
              </span>
              <span className="vacio-icono" aria-hidden="true">
                <FaBoxOpen />
              </span>
              <p className="vacio-titulo">Sin pedidos todavía</p>
              <p className="vacio-texto">Cuando compres, el seguimiento aparece acá.</p>
              <Link to="/productos" className="btn-fantasma">
                Ver productos <FaArrowRight aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}

        {vista === "favoritos" && <SeccionFavoritos />}
      </div>
    </div>
  );
}

export default Cuenta;
