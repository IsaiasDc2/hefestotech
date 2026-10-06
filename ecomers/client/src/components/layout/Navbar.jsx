import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaMicrochip,
  FaCartShopping,
  FaMagnifyingGlass,
  FaUser,
  FaUserPlus,
  FaTruckFast,
  FaGlobe,
  FaChevronDown,
  FaCheck,
  FaMoon,
} from "react-icons/fa6";
import { linkOfertas } from "../../constants/categorias";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import "./Navbar.css";

const FILA_CATEGORIAS = [
  { labelKey: "cat.productos", to: "/productos", clave: "productos" },
  { labelKey: "cat.notebooks", to: "/productos?q=notebook", clave: "notebook" },
  { labelKey: "cat.pcs", to: "/productos?q=pc%20armada", clave: "pc armada" },
  { labelKey: "cat.arma", to: "/productos?q=combo", clave: "combo" },
  { labelKey: "cat.outlet", to: linkOfertas, clave: "outlet" },
];

const IDIOMAS = [
  { codigo: "es", etiqueta: "Español" },
  { codigo: "en", etiqueta: "English" },
];

function Navbar({ cantidadCarrito, abrirCarrito }) {
  const [texto, setTexto] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [pop, setPop] = useState(false);
  const [idiomaAbierto, setIdiomaAbierto] = useState(false);
  const idiomaRef = useRef(null);
  const idioma = useIdiomaStore((s) => s.idioma);
  const setIdioma = useIdiomaStore((s) => s.setIdioma);
  const primeraVez = useRef(true);
  const navigate = useNavigate();
  const location = useLocation();

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

  const params = new URLSearchParams(location.search);
  const categoriaActual = (params.get("categoria") || "").toLowerCase();
  const busquedaActual = (params.get("q") || "").toLowerCase();
  const enProductos = location.pathname === "/productos";
  const esOfertas =
    enProductos &&
    (categoriaActual === "oferta" || categoriaActual === "ofertas");

  const esActiva = (clave) => {
    if (!enProductos) return "";
    if (clave === "productos") return !categoriaActual && !busquedaActual ? "activo" : "";
    if (clave === "outlet") return esOfertas ? "activo" : "";
    return busquedaActual === clave ? "activo" : "";
  };

  const buscar = (e) => {
    e.preventDefault();
    const q = texto.trim();
    navigate(q ? `/productos?q=${encodeURIComponent(q)}` : "/productos");
  };

  return (
    <header className="site-head-wrap">
      <div className="topbar">
        <div className="topbar-inner">
          <span className="topbar-envio">
            <FaTruckFast aria-hidden="true" />
            {t(idioma, "topbar.envio")}
          </span>
          <span className="topbar-links">
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
              WhatsApp
            </a>
            <button
              type="button"
              className="topbar-tema"
              disabled
              aria-disabled="true"
              title="Disponible próximamente"
              aria-label="Cambiar tema (disponible próximamente)"
            >
              <FaMoon aria-hidden="true" />
            </button>
          </span>
        </div>
      </div>

      <div className={`site-head${scrolled ? " is-scrolled" : ""}`}>
        <div className="site-head-inner">
          <Link to="/" className="logo" aria-label="HefestoTech inicio">
            <span className="logo-badge" aria-hidden="true">
              <FaMicrochip className="logo-icon" />
            </span>
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
            <Link to="/cuenta" className="link-cuenta link-registro">
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
              aria-label={`${t(idioma, "nav.carrito")}, ${cantidadCarrito} ${t(idioma, "nav.productos")}`}
            >
              <FaCartShopping aria-hidden="true" />
              <span className={`carrito-count${pop ? " is-pop" : ""}`} aria-hidden="true">
                {cantidadCarrito}
              </span>
            </button>
          </nav>
        </div>

        <nav className="nav-categorias" aria-label={t(idioma, "nav.categorias")}>
          <div className="nav-categorias-inner">
            <div className="nav-categorias-lista">
              {FILA_CATEGORIAS.map((c) => {
                const activa = esActiva(c.clave);
                const esOutlet = c.clave === "outlet";
                return (
                  <Link
                    key={c.clave}
                    to={c.to}
                    className={`${esOutlet ? "nav-ofertas " : ""}${activa}`}
                    aria-current={activa ? "page" : undefined}
                  >
                    {t(idioma, c.labelKey)}
                  </Link>
                );
              })}
            </div>
            <span className="nav-ayuda">
              <Link to="/acerca">{t(idioma, "nav.ayuda")}</Link>
              <Link to="/contactanos">{t(idioma, "nav.posventa")}</Link>
            </span>
          </div>
        </nav>
      </div>
    </header>
  );
}

export default Navbar;
