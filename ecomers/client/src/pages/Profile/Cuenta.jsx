import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { FaBoxOpen, FaHeart, FaArrowRight, FaRightFromBracket, FaCartPlus, FaTrashCan, FaRotateLeft, FaTriangleExclamation } from "react-icons/fa6";
import Login from "../Login/Login";
import Registro from "../Login/Registro";
import Marca from "../../components/brand/Marca";
import ProductCard from "../../components/product/ProductCard";
import useAuthStore from "../../store/authStore";
import useCartStore from "../../store/cartStore";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import { obtenerProductosPorIds, useFavoritos } from "../../services/favoritos";
import { obtenerMisOrdenes } from "../../services/orderService";
import { supabase } from "../../components/lib/supabaseClient";
import useCarga from "../../hooks/useCarga";
import { formatearPesos } from "../../utils/dinero";
import "./Cuenta.css";

// Con sesión no tiene sentido ofrecer "Ingresar"/"Crear cuenta"; sin
// sesión, "Mis pedidos" no tiene de dónde leer (RLS por usuario).
const VISTAS_INVITADO = [
  { id: "login", key: "cuenta.ingresar" },
  { id: "registro", key: "cuenta.crear" },
  { id: "favoritos", key: "cuenta.favoritos" },
  { id: "reclamos", key: "cuenta.reclamos" },
];
const VISTAS_SESION = [
  { id: "pedidos", key: "cuenta.pedidos" },
  { id: "favoritos", key: "cuenta.favoritos" },
  { id: "reclamos", key: "cuenta.reclamos" },
];

// Con comprobante (pagada en adelante) se abre el comprobante; si no, la
// pantalla de estado del checkout, que permite seguir o reintentar.
const ESTADOS_CON_COMPROBANTE = ["pagada", "preparacion", "enviada", "entregada", "reembolsada"];

const totalDeOrden = (o) =>
  o.total_centavos != null ? Number(o.total_centavos) / 100 : Number(o.total ?? 0);

function SeccionPedidos() {
  const idioma = useIdiomaStore((s) => s.idioma);
  const usuario = useAuthStore((s) => s.usuario);
  const { datos, error, cargando } = useCarga(obtenerMisOrdenes, usuario?.id ?? null);
  const pedidos = datos ?? [];

  if (cargando) {
    return (
      <div className="panel-cuenta card anim-entrada">
        <p className="badge badge-info">{t(idioma, "cuenta.historial")}</p>
        <h2>{t(idioma, "cuenta.pedidos")}</h2>
        <p role="status">{t(idioma, "cuenta.cargandoPedidos")}</p>
      </div>
    );
  }

  if (error || pedidos.length === 0) {
    return (
      <div className="panel-cuenta card anim-entrada">
        <p className="badge badge-info">{t(idioma, "cuenta.historial")}</p>
        <h2>{t(idioma, "cuenta.pedidos")}</h2>
        {error && (
          <p className="badge badge-peligro login-error" role="alert">
            {t(idioma, "cuenta.noPedidos")}
          </p>
        )}
        <div className="vacio">
          <span className="marca-centrada" aria-hidden="true">
            <Marca variante="simbolo" ancho={40} alto={40} decorativa />
          </span>
          <span className="vacio-icono" aria-hidden="true">
            <FaBoxOpen />
          </span>
          <p className="vacio-titulo">{t(idioma, "cuenta.sinPedidosT")}</p>
          <p className="vacio-texto">{t(idioma, "cuenta.seguimiento")}</p>
          <Link to="/productos" className="btn-fantasma">
            {t(idioma, "cuenta.verProd")} <FaArrowRight aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-cuenta card anim-entrada">
      <p className="badge badge-info">{t(idioma, "cuenta.historial")}</p>
      <h2>
        {t(idioma, "cuenta.pedidos")} ({pedidos.length})
      </h2>
      <ul className="adm-tarjetas cuenta-pedidos">
        {pedidos.map((o) => {
          const unidades = (o.orden_items ?? []).reduce((acc, i) => acc + Number(i.cantidad ?? 0), 0);
          const destino = ESTADOS_CON_COMPROBANTE.includes(o.estado)
            ? `/pedido/${o.id}`
            : `/checkout?orden_id=${o.id}`;
          return (
            <li key={o.id} className="card adm-pedido">
              <div className="adm-pedido-head">
                <strong>
                  {t(idioma, "chk.orden")} #{String(o.id).slice(0, 8)}
                </strong>
                <span className={`adm-estado es-${o.estado}`}>
                  {t(idioma, `chk.${o.estado}`)}
                </span>
              </div>
              <p className="texto-mutado">
                {o.created_at ? new Date(o.created_at).toLocaleDateString(idioma === "en" ? "en-US" : "es-AR") : "—"}
                {" · "}
                {unidades} {unidades === 1 ? t(idioma, "catl.producto") : t(idioma, "catl.productos")}
                {" · "}
                <strong>{formatearPesos(totalDeOrden(o))}</strong>
              </p>
              <Link to={destino} className="btn-fantasma">
                {t(idioma, "cuenta.verDetalle")} <FaArrowRight aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const leerReclamos = async () => {
  const { data, error } = await supabase
    .from("reclamos")
    .select("id,motivo,detalle,estado,orden_id,created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
};

// Posventa del cliente: sus reclamos por RLS (propios) con estado real.
// Sin sesión pide ingresar; sin datos muestra vacío con acceso a /reclamo.
function SeccionReclamos() {
  const idioma = useIdiomaStore((s) => s.idioma);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const usuario = useAuthStore((s) => s.usuario);
  const carga = useCarga(leerReclamos, isAuthenticated ? usuario?.id ?? "sesion" : null);
  const lista = carga.datos ?? [];
  const cargando = carga.cargando;
  const error = carga.error ? t(idioma, "cuenta.noReclamos") : "";

  if (!isAuthenticated) {
    return (
      <div className="panel-cuenta card anim-entrada">
        <p className="badge badge-info">{t(idioma, "cuenta.historial")}</p>
        <h2>{t(idioma, "cuenta.reclamos")}</h2>
        <p>{t(idioma, "cuenta.sinReclamos")}</p>
        <Link to="/reclamo" className="btn-fantasma">
          {t(idioma, "recl.titulo")} <FaArrowRight aria-hidden="true" />
        </Link>
      </div>
    );
  }

  if (cargando) {
    return (
      <div className="panel-cuenta card anim-entrada">
        <p className="badge badge-info">{t(idioma, "cuenta.historial")}</p>
        <h2>{t(idioma, "cuenta.reclamos")}</h2>
        <p role="status">{t(idioma, "cuenta.cargandoReclamos")}</p>
      </div>
    );
  }

  return (
    <div className="panel-cuenta card anim-entrada">
      <p className="badge badge-info">{t(idioma, "cuenta.historial")}</p>
      <h2>{t(idioma, "cuenta.reclamos")} ({lista.length})</h2>
      {error && <p className="badge badge-peligro login-error" role="alert">{error}</p>}
      {lista.length === 0 && !error ? (
        <div className="vacio">
          <p className="vacio-titulo">{t(idioma, "cuenta.sinReclamosT")}</p>
          <p className="vacio-texto">{t(idioma, "cuenta.reclamoSeguimiento")}</p>
          <Link to="/reclamo" className="btn-fantasma">
            {t(idioma, "recl.titulo")} <FaArrowRight aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <ul className="adm-tarjetas">
          {lista.map((r) => (
            <li key={r.id} className="card adm-pedido">
              <div className="adm-pedido-head">
                <strong>{String(r.motivo || "—").split("—")[0].trim().slice(0, 60) || "—"}</strong>
                <span className={`adm-estado es-${r.estado}`}>{r.estado}</span>
              </div>
              <p className="texto-mutado">
                {r.created_at ? new Date(r.created_at).toLocaleString(idioma === "en" ? "en-US" : "es-AR") : "—"}
                {r.orden_id ? ` · #${String(r.orden_id).slice(0, 8)}` : ""}
              </p>
              {r.detalle && <p>{r.detalle}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Seccion Favoritos: mismo ProductCard del catalogo, quitar con aviso y
// deshacer, mover al carrito, vacio con acceso al catalogo y aviso para
// productos ocultos (inexistentes o dados de baja).
function SeccionFavoritos() {
  const idioma = useIdiomaStore((s) => s.idioma);
  const { ids, cargando, error, ultimoQuitado, quitar, quitarMuchos, deshacerQuitado, limpiarError } = useFavoritos();
  const agregarAlCarrito = useCartStore((s) => s.agregarAlCarrito);
  const [eliminandoId, setEliminandoId] = useState(null);
  const [errorOculto, setErrorOculto] = useState(null);
  const claveIds = ids.length > 0 ? ids.join(",") : null;
  const carga = useCarga(() => obtenerProductosPorIds(ids), claveIds);
  // Mientras recarga tras quitar uno se sigue mostrando la lista anterior.
  const [ultimaLista, setUltimaLista] = useState({ visibles: [], ocultosIds: [] });
  if (carga.datos && carga.datos !== ultimaLista) setUltimaLista(carga.datos);
  const lista = claveIds == null ? { visibles: [], ocultosIds: [] } : carga.datos ?? ultimaLista;
  const productos = lista.visibles;
  const ocultosIds = lista.ocultosIds;
  const cargandoProductos = carga.cargando && ultimaLista.visibles.length === 0 && !carga.datos;
  const errorProductos =
    carga.error && errorOculto !== carga.error ? t(idioma, "cuenta.noFav") : "";

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
        <p className="badge badge-info">{t(idioma, "cuenta.guardados")}</p>
        <h2>{t(idioma, "cuenta.favoritos")}</h2>
        <p role="status">{t(idioma, "cuenta.cargandoFav")}</p>
      </div>
    );
  }

  if (ids.length === 0 && !ultimoQuitado) {
    return (
      <div className="panel-cuenta card anim-entrada" id="favoritos">
        <p className="badge badge-info">{t(idioma, "cuenta.guardados")}</p>
        <h2>{t(idioma, "cuenta.favoritos")}</h2>
        <p>{t(idioma, "cuenta.sinFav")}</p>
        <div className="vacio">
          <span className="marca-centrada" aria-hidden="true">
            <Marca variante="simbolo" ancho={40} alto={40} decorativa />
          </span>
          <span className="vacio-icono" aria-hidden="true">
            <FaHeart />
          </span>
          <p className="vacio-titulo">{t(idioma, "cuenta.nadaGuardado")}</p>
          <p className="vacio-texto">{t(idioma, "cuenta.marcaCorazon")}</p>
          <Link to="/productos" className="btn-fantasma">
            {t(idioma, "cuenta.explorar")} <FaArrowRight aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-cuenta card anim-entrada" id="favoritos">
      <p className="badge badge-info">{t(idioma, "cuenta.guardados")}</p>
      <h2>{t(idioma, "cuenta.favoritos")} ({productos.length})</h2>
      {(error || errorProductos) && (
        <p className="badge badge-peligro login-error" role="alert">
          {error || errorProductos}{" "}
          <button type="button" className="registro-link" onClick={() => { limpiarError(); setErrorOculto(carga.error); }}>
            {t(idioma, "cuenta.ocultar")}
          </button>
        </p>
      )}
      {ocultosIds.length > 0 && (
        <p className="badge badge-aviso" role="status">
          <FaTriangleExclamation aria-hidden="true" /> {ocultosIds.length} {t(idioma, "cuenta.noDisponibles")}{" "}
          <button type="button" className="registro-link" onClick={limpiarOcultos}>
            {t(idioma, "cuenta.limpiarNo")}
          </button>
        </p>
      )}
      {ultimoQuitado && (
        <p className="badge badge-info" role="status">
          {t(idioma, "cuenta.quitado")}: {ultimoQuitado.nombre}.{" "}
          <button type="button" className="registro-link" onClick={deshacerQuitado}>
            <FaRotateLeft aria-hidden="true" /> {t(idioma, "cuenta.deshacer")}
          </button>
        </p>
      )}
      <div className="cuenta-favoritos">
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
                aria-label={`${t(idioma, "cuenta.mover")} ${producto.nombre || "producto"}`}
              >
                <FaCartPlus aria-hidden="true" /> {t(idioma, "cuenta.mover")}
              </button>
              <button
                type="button"
                className="btn-fantasma"
                onClick={() => quitarAnimado(producto.id, producto.nombre)}
                aria-label={`${t(idioma, "cuenta.quitar")} ${producto.nombre || "producto"}`}
              >
                <FaTrashCan aria-hidden="true" /> {t(idioma, "cuenta.quitar")}
              </button>
            </div>
          </div>
        ))}
      </div>
      {productos.length === 0 && ocultosIds.length > 0 && (
        <div className="vacio">
          <p className="vacio-titulo">{t(idioma, "cuenta.soloNo")}</p>
          <p className="vacio-texto">{t(idioma, "cuenta.limpiaLista")}</p>
          <Link to="/productos" className="btn-fantasma">
            {t(idioma, "cuenta.explorar")} <FaArrowRight aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
}

function Cuenta() {
  const [params, setParams] = useSearchParams();
  const idioma = useIdiomaStore((s) => s.idioma);
  const usuario = useAuthStore((s) => s.usuario);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);

  // La pestaña vive en la URL (/cuenta?tab=favoritos): el contador del
  // header enlaza directo y "atrás" respeta la navegación entre secciones.
  const vistas = isAuthenticated ? VISTAS_SESION : VISTAS_INVITADO;
  const pedida = params.get("modo") === "favoritos" ? "favoritos" : params.get("tab");
  const vista = vistas.some((v) => v.id === pedida) ? pedida : vistas[0].id;
  const setVista = (id) => setParams({ tab: id }, { replace: true });

  return (
    <div className="cuenta">
      <h1 className="sr-only">{t(idioma, "cuenta.miCuenta")}</h1>
      <p className="badge badge-info hero-kicker" aria-hidden="true">{t(idioma, "cuenta.miCuenta")}</p>
      {isAuthenticated && usuario && (
        <div className="panel-cuenta card cuenta-sesion">
          <p className="texto-mutado">{t(idioma, "cuenta.sesionActiva")} <strong>{usuario.email}</strong></p>
          <button type="button" className="btn-fantasma" onClick={logout}>
            <FaRightFromBracket aria-hidden="true" /> {t(idioma, "cuenta.cerrar")}
          </button>
        </div>
      )}
      <nav className="cuenta-tabs" aria-label={t(idioma, "cuenta.secciones")} role="tablist">
        {vistas.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={vista === v.id}
            className={vista === v.id ? "activo" : ""}
            aria-current={vista === v.id ? "page" : undefined}
            onClick={() => setVista(v.id)}
          >
            {t(idioma, v.key)}
          </button>
        ))}
      </nav>
      <div className="contenido" role="tabpanel">
        {vista === "login" && <Login onIrRegistro={() => setVista("registro")} />}

        {vista === "registro" && <Registro />}

        {vista === "pedidos" && <SeccionPedidos />}

        {vista === "favoritos" && <SeccionFavoritos />}

        {vista === "reclamos" && <SeccionReclamos />}
      </div>
    </div>
  );
}

export default Cuenta;
