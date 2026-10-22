import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  FaBars,
  FaBagShopping,
  FaMagnifyingGlass,
  FaRegHeart,
  FaRegUser,
  FaShieldHalved,
  FaMoon,
  FaScrewdriverWrench,
  FaSun,
  FaBolt,
} from "react-icons/fa6";
import Marca from "../brand/Marca";
import { FILA_CATEGORIAS, IDIOMAS, esClaveActiva } from "./navLinks";
import MobileDrawer from "./MobileDrawer";
import { supabase } from "../lib/supabaseClient";
import { useCantidadFavoritos } from "../../services/favoritos";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import useTema from "../../hooks/useTema";
import "./Navbar.css";

function Navbar({ cantidadCarrito, abrirCarrito }) {
  const [texto, setTexto] = useState("");
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [esAdmin, setEsAdmin] = useState(false);
  const [pop, setPop] = useState({ cantidad: cantidadCarrito, activo: false });
  const fijoRef = useRef(null);
  const idioma = useIdiomaStore((s) => s.idioma);
  const setIdioma = useIdiomaStore((s) => s.setIdioma);
  const { tema, alternar } = useTema();
  const favoritos = useCantidadFavoritos();
  const navigate = useNavigate();
  const location = useLocation();

  const abrirMenu = useCallback(() => setMenuAbierto(true), []);
  const cerrarMenu = useCallback(() => setMenuAbierto(false), []);

  // Pulso del contador cuando cambia la cantidad (ajuste durante el render).
  if (pop.cantidad !== cantidadCarrito) {
    setPop({ cantidad: cantidadCarrito, activo: cantidadCarrito > pop.cantidad });
  }
  useEffect(() => {
    if (!pop.activo) return undefined;
    const id = setTimeout(() => setPop((p) => ({ ...p, activo: false })), 320);
    return () => clearTimeout(id);
  }, [pop.activo]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user || !vivo) return;
        const { data } = await supabase
          .from("perfiles")
          .select("rol")
          .eq("id", session.user.id)
          .maybeSingle();
        if (vivo && (data?.rol === "owner" || data?.rol === "admin")) setEsAdmin(true);
      } catch {
        /* sin sesión o sin red: sin botón de panel */
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // Altura real del header fijo para los elementos sticky de las páginas.
  useEffect(() => {
    const el = fijoRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const obs = new ResizeObserver(([entrada]) => {
      const alto = Math.round(entrada.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight);
      document.documentElement.style.setProperty("--head-h", `${alto}px`);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const buscar = (e) => {
    e.preventDefault();
    const q = texto.trim();
    navigate(q ? `/productos?q=${encodeURIComponent(q)}` : "/productos");
  };

  const etiquetaCantidad = cantidadCarrito > 99 ? "99+" : String(cantidadCarrito);
  const etiquetaTema = t(idioma, tema === "light" ? "nav.temaClaro" : "nav.temaOscuro");
  const unidad = cantidadCarrito === 1 ? t(idioma, "nav.productoSing") : t(idioma, "nav.productos");

  return (
    <>
      <div className="hd-aviso">
        <p className="contenedor">{t(idioma, "hd.aviso")}</p>
      </div>

      <header ref={fijoRef} className="hd">
        <div className="hd-main contenedor">
          <button
            type="button"
            className="hd-icono hd-menu"
            onClick={abrirMenu}
            aria-expanded={menuAbierto}
            aria-controls="menu-movil"
            aria-label={t(idioma, "nav.menu")}
          >
            <FaBars aria-hidden="true" />
          </button>

          <Link to="/" className="hd-logo" aria-label={t(idioma, "nav.logoAria")}>
            <Marca variante="simbolo" ancho={32} alto={32} eager alt="" decorativa />
            <span>
              Hefesto<b>Tech</b>
            </span>
          </Link>

          <form className="hd-buscador" onSubmit={buscar} role="search">
            <FaMagnifyingGlass className="hd-buscador-icono" aria-hidden="true" />
            <input
              type="search"
              enterKeyHint="search"
              placeholder={t(idioma, "nav.buscarPh")}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              aria-label={t(idioma, "nav.buscarAria")}
            />
            <button type="submit" className="hd-buscador-btn">
              {t(idioma, "nav.buscar")}
            </button>
          </form>

          <nav className="hd-acciones" aria-label={t(idioma, "nav.cuentaYCarrito")}>
            <span className="hd-idiomas" role="group" aria-label={t(idioma, "topbar.idioma")}>
              {IDIOMAS.map((op) => (
                <button
                  key={op.codigo}
                  type="button"
                  lang={op.codigo}
                  aria-label={op.etiqueta}
                  title={op.etiqueta}
                  aria-pressed={idioma === op.codigo}
                  onClick={() => setIdioma(op.codigo)}
                >
                  {op.codigo.toUpperCase()}
                </button>
              ))}
            </span>
            <button
              type="button"
              className="hd-icono hd-solo-escritorio"
              onClick={alternar}
              aria-pressed={tema === "light"}
              aria-label={etiquetaTema}
              title={etiquetaTema}
            >
              {tema === "light" ? <FaMoon aria-hidden="true" /> : <FaSun aria-hidden="true" />}
            </button>
            <Link
              to="/cuenta?tab=favoritos"
              className="hd-icono hd-solo-escritorio"
              aria-label={`${t(idioma, "nav.favoritos")}: ${favoritos}`}
              title={t(idioma, "nav.favoritos")}
            >
              <FaRegHeart aria-hidden="true" />
              {favoritos > 0 && (
                <span className="hd-contador hd-contador--suave" aria-hidden="true">
                  {favoritos > 99 ? "99+" : favoritos}
                </span>
              )}
            </Link>
            <Link
              to="/cuenta"
              className="hd-icono"
              aria-label={t(idioma, "nav.sesion")}
              title={t(idioma, "nav.sesion")}
            >
              <FaRegUser aria-hidden="true" />
            </Link>
            {esAdmin && (
              <Link to="/admin" className="hd-panel" aria-label={t(idioma, "nav.panel")}>
                <FaShieldHalved aria-hidden="true" />
                <span>{t(idioma, "nav.panelCorto")}</span>
              </Link>
            )}
            <button
              type="button"
              className={`hd-carrito${pop.activo ? " is-pop" : ""}`}
              onClick={abrirCarrito}
              aria-label={`${t(idioma, "nav.carrito")}, ${etiquetaCantidad} ${unidad}`}
            >
              <FaBagShopping aria-hidden="true" />
              <span className="hd-carrito-texto">{t(idioma, "nav.carritoCorto")}</span>
              {cantidadCarrito > 0 && (
                <span className="hd-contador" aria-hidden="true">
                  {etiquetaCantidad}
                </span>
              )}
            </button>
            <span className="sr-only" aria-live="polite" aria-atomic="true">
              {`${t(idioma, "nav.carrito")}: ${etiquetaCantidad} ${unidad}`}
            </span>
          </nav>
        </div>

        <nav className="hd-cats" aria-label={t(idioma, "nav.categorias")}>
          <ul className="contenedor">
            {FILA_CATEGORIAS.map((c) => {
              const activa = esClaveActiva(location.pathname, location.search, c.clave);
              return (
                <li key={c.clave}>
                  <Link
                    to={c.to}
                    className={`hd-cat hd-cat--${c.tipo}${activa ? " activo" : ""}`}
                    aria-current={activa ? "page" : undefined}
                  >
                    {c.tipo === "armar" && <FaScrewdriverWrench aria-hidden="true" />}
                    {c.tipo === "ofertas" && <FaBolt aria-hidden="true" />}
                    {c.labelKey ? t(idioma, c.labelKey) : c.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
      <MobileDrawer abierto={menuAbierto} alCerrar={cerrarMenu} />
    </>
  );
}

export default Navbar;
