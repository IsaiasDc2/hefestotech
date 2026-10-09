import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaBars,
  FaCartShopping,
  FaMagnifyingGlass,
  FaUser,
  FaUserPlus,
  FaTruckFast,
  FaGlobe,
  FaChevronDown,
  FaCheck,
  FaMoon,
  FaScrewdriverWrench,
  FaSun,
  FaWhatsapp,
} from "react-icons/fa6";
import Marca from "../brand/Marca";
import { FILA_CATEGORIAS, IDIOMAS, esClaveActiva } from "./navLinks";
import MobileDrawer from "./MobileDrawer";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import useTema from "../../hooks/useTema";
import "./Navbar.css";

function Navbar({ cantidadCarrito, abrirCarrito }) {
  const [texto, setTexto] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [pop, setPop] = useState(false);
  const [idiomaAbierto, setIdiomaAbierto] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const idiomaRef = useRef(null);
  const idioma = useIdiomaStore((s) => s.idioma);
  const setIdioma = useIdiomaStore((s) => s.setIdioma);
  const { tema, alternar } = useTema();
  const etiquetaTema = idioma === "en"
    ? (tema === "light" ? "Switch to dark mode" : "Switch to light mode")
    : (tema === "light" ? "Cambiar a modo oscuro" : "Cambiar a modo claro");
  const etiquetaMenu = idioma === "en" ? "Open menu" : "Abrir menú";
  const primeraVez = useRef(true);
  const navigate = useNavigate();
  const location = useLocation();

  const abrirMenu = useCallback(() => setMenuAbierto(true), []);
  const cerrarMenu = useCallback(() => setMenuAbierto(false), []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!idiomaAbierto) return;
    const alClick = (e) => {
      if (idiomaRef.current && !idiomaRef.current.contains(e.target)) {
        setIdiomaAbierto(false);
      }
    };
    const alTeclado = (e) => {
      if (e.key === "Escape") setIdiomaAbierto(false);
    };
    document.addEventListener("mousedown", alClick);
    document.addEventListener("keydown", alTeclado);
    return () => {
      document.removeEventListener("mousedown", alClick);
      document.removeEventListener("keydown", alTeclado);
    };
  }, [idiomaAbierto]);

  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      return;
    }
    setPop(true);
    const t = setTimeout(() => setPop(false), 200);
    return () => clearTimeout(t);
  }, [cantidadCarrito]);

  const esActiva = (clave) =>
    esClaveActiva(location.pathname, location.search, clave) ? "activo" : "";

  const buscar = (e) => {
    e.preventDefault();
    const q = texto.trim();
    navigate(q ? `/productos?q=${encodeURIComponent(q)}` : "/productos");
  };

  const etiquetaCantidad = cantidadCarrito > 99 ? "99+" : String(cantidadCarrito);

  return (
    <header className="site-head-wrap">
      <div className="topbar">
        <div className="topbar-inner ht-contenedor">
          <span className="topbar-envio">
            <FaTruckFast aria-hidden="true" />
            {t(idioma, "topbar.envio")}
          </span>
          <span className="topbar-links">
            <Link to="/acerca" className="topbar-util">
              {t(idioma, "nav.ayuda")}
            </Link>
            <Link to="/contactanos" className="topbar-util">
              {t(idioma, "nav.posventa")}
            </Link>
            <span className="topbar-idioma" ref={idiomaRef}>
              <button
                type="button"
                className="topbar-idioma-btn"
                onClick={() => setIdiomaAbierto((v) => !v)}
                aria-expanded={idiomaAbierto}
                aria-haspopup="listbox"
                aria-label={t(idioma, "topbar.idioma")}
              >
                <FaGlobe aria-hidden="true" />
                <span>{idioma.toUpperCase()}</span>
                <FaChevronDown aria-hidden="true" className={idiomaAbierto ? "gira" : ""} />
              </button>
              {idiomaAbierto && (
                <ul className="topbar-idioma-menu" role="listbox" aria-label={t(idioma, "topbar.idioma")}>
                  {IDIOMAS.map((op) => (
                    <li key={op.codigo} role="option" aria-selected={idioma === op.codigo}>
                      <button
                        type="button"
                        onClick={() => {
                          setIdioma(op.codigo);
                          setIdiomaAbierto(false);
                        }}
                      >
                        {idioma === op.codigo && <FaCheck aria-hidden="true" />}
                        {op.etiqueta}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </span>
            <a href="https://wa.me/5491112345678" target="_blank" rel="noreferrer">
              <FaWhatsapp aria-hidden="true" />
              WhatsApp
            </a>
            <button
              type="button"
              className="topbar-tema"
              onClick={alternar}
              aria-pressed={tema === "light"}
              aria-label={etiquetaTema}
              title={etiquetaTema}
            >
              {tema === "light" ? <FaSun aria-hidden="true" /> : <FaMoon aria-hidden="true" />}
            </button>
          </span>
        </div>
      </div>

      <div className={`site-head${scrolled ? " is-scrolled" : ""}`}>
        <div className="site-head-inner ht-contenedor">
          <button
            type="button"
            className="menu-btn"
            onClick={abrirMenu}
            aria-expanded={menuAbierto}
            aria-controls="menu-movil"
            aria-label={etiquetaMenu}
          >
            <FaBars aria-hidden="true" />
          </button>
          <Link to="/" className="logo" aria-label="HefestoTech, ir al inicio">
            <Marca variante="simbolo" ancho={36} alto={36} eager alt="HefestoTech" />
            <span className="logo-nombre">
              Hefesto<span>Tech</span>
            </span>
          </Link>

          <form className="buscador-head" onSubmit={buscar} role="search">
            <FaMagnifyingGlass className="buscador-icono" aria-hidden="true" />
            <input
              type="text"
              placeholder={t(idioma, "nav.buscarPh")}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              aria-label={t(idioma, "nav.buscarAria")}
            />
            <button type="submit" aria-label={t(idioma, "nav.buscar")}>
              <FaMagnifyingGlass aria-hidden="true" />
              <span className="buscador-texto">{t(idioma, "nav.buscar")}</span>
            </button>
          </form>

          <nav className="nav-cuenta" aria-label={`${t(idioma, "nav.sesion")} / ${t(idioma, "nav.carrito")}`}>
            <Link to="/cuenta?modo=registro" className="link-cuenta link-registro">
              <FaUserPlus aria-hidden="true" />
              <span>{t(idioma, "nav.registrate")}</span>
            </Link>
            <Link to="/cuenta" className="link-cuenta" aria-label={t(idioma, "nav.sesion")}>
              <FaUser aria-hidden="true" />
              <span>{t(idioma, "nav.sesion")}</span>
            </Link>
            <button
              className="carrito-btn"
              onClick={abrirCarrito}
              aria-label={`${t(idioma, "nav.carrito")}, ${etiquetaCantidad} ${t(idioma, "nav.productos")}`}
              aria-live="polite"
            >
              <FaCartShopping aria-hidden="true" />
              <span className={`carrito-count${pop ? " is-pop" : ""}`} aria-hidden="true">
                {etiquetaCantidad}
              </span>
            </button>
          </nav>
        </div>

        <nav className="nav-categorias" aria-label={t(idioma, "nav.categorias")}>
          <div className="nav-categorias-inner ht-contenedor">
            <ul className="nav-categorias-lista">
              {FILA_CATEGORIAS.map((c) => {
                const activa = esActiva(c.clave);
                const esOutlet = c.clave === "outlet";
                const esArma = c.clave === "combo";
                const clase = [
                  esOutlet ? "nav-ofertas" : "",
                  esArma ? "nav-arma" : "",
                  activa,
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <li key={c.clave}>
                    <Link
                      to={c.to}
                      className={clase || undefined}
                      aria-current={activa ? "page" : undefined}
                    >
                      {esArma && (
                        <FaScrewdriverWrench aria-hidden="true" className="nav-icono" />
                      )}
                      {t(idioma, c.labelKey)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>
      </div>
      <MobileDrawer abierto={menuAbierto} alCerrar={cerrarMenu} />
    </header>
  );
}

export default Navbar;
