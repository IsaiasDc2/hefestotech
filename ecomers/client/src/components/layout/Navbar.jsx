import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaBars,
  FaCartShopping,
  FaMagnifyingGlass,
  FaShieldHalved,
  FaUser,
  FaTruckFast,
  FaMoon,
  FaScrewdriverWrench,
  FaSun,
} from "react-icons/fa6";
import Marca from "../brand/Marca";
import { FILA_CATEGORIAS, esClaveActiva } from "./navLinks";
import MobileDrawer from "./MobileDrawer";
import { supabase } from "../lib/supabaseClient";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import useTema from "../../hooks/useTema";
import "./Navbar.css";

function Navbar({ cantidadCarrito, abrirCarrito }) {
  const [texto, setTexto] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [pop, setPop] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [esAdmin, setEsAdmin] = useState(false);
  const refHead = useRef(null);
  const idioma = useIdiomaStore((s) => s.idioma);
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
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    const head = refHead.current;
    // Altura fijada una vez: el compacto cambia padding sin refluir (CLS 0).
    const fijarAltura = () => {
      if (!head) return;
      head.style.minHeight = "";
      head.style.minHeight = `${head.offsetHeight}px`;
    };
    const medir = () => {
      if (!head || document.hidden) return;
      const y = window.scrollY || 0;
      setScrolled(y > 8);
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const p = total > 0 ? Math.min(1, Math.max(0, y / total)) : 0;
      head.style.setProperty("--scroll-p", p.toFixed(4));
    };
    let raf = 0;
    let sucio = false;
    const pedir = () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setScrolled((window.scrollY || 0) > 8);
        return;
      }
      if (!sucio) {
        sucio = true;
        raf = requestAnimationFrame(() => {
          sucio = false;
          medir();
        });
      }
    };
    fijarAltura();
    medir();
    window.addEventListener("scroll", pedir, { passive: true });
    window.addEventListener("resize", pedir);
    window.addEventListener("resize", fijarAltura);
    return () => {
      window.removeEventListener("scroll", pedir);
      window.removeEventListener("resize", pedir);
      window.removeEventListener("resize", fijarAltura);
      cancelAnimationFrame(raf);
    };
  }, []);

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
          <span className="topbar-camion" aria-hidden="true">
            <FaTruckFast aria-hidden="true" />
          </span>
        </div>
      </div>

      <div ref={refHead} className={`site-head${scrolled ? " is-scrolled" : ""}`}>
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
            <button
              type="button"
              className="link-cuenta"
              onClick={abrirMenu}
              aria-expanded={menuAbierto}
              aria-controls="menu-movil"
              aria-label={idioma === "en" ? "More options" : "Más opciones"}
              title={idioma === "en" ? "More options" : "Más opciones"}
            >
              <FaBars aria-hidden="true" />
            </button>
            <Link
              to="/cuenta"
              className="link-cuenta link-cuenta-icono"
              aria-label={t(idioma, "nav.sesion")}
              title={t(idioma, "nav.sesion")}
            >
              <FaUser aria-hidden="true" />
            </Link>
            {esAdmin && (
              <Link
                to="/admin"
                className="link-cuenta link-panel"
                aria-label={idioma === "en" ? "Admin panel" : "Panel de control"}
              >
                <FaShieldHalved aria-hidden="true" />
                <span>{idioma === "en" ? "Admin" : "Panel"}</span>
              </Link>
            )}
            <button
              className={`carrito-btn${pop ? " is-pop" : ""}`}
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
        <span className="site-head-progreso" aria-hidden="true" />
      </div>
      <MobileDrawer abierto={menuAbierto} alCerrar={cerrarMenu} />
    </header>
  );
}

export default Navbar;
