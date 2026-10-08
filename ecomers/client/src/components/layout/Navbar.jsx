import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaMicrochip,
  FaCartShopping,
  FaMagnifyingGlass,
  FaUser,
  FaUserPlus,
  FaTruckFast,
} from "react-icons/fa6";
import { linkOfertas } from "../../constants/categorias";
import "./Navbar.css";

const FILA_CATEGORIAS = [
  { label: "Productos", to: "/productos", clave: "productos" },
  { label: "Notebooks", to: "/productos?q=notebook", clave: "notebook" },
  { label: "PCs Armadas", to: "/productos?q=pc%20armada", clave: "pc armada" },
  { label: "Armá tu PC", to: "/arma-tu-pc", clave: "arma-tu-pc" },
  { label: "Outlet", to: linkOfertas, clave: "outlet" },
];

function Navbar({ cantidadCarrito, abrirCarrito }) {
  const [texto, setTexto] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [pop, setPop] = useState(false);
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
    if (primeraVez.current) {
      primeraVez.current = false;
      return;
    }
    setPop(true);
    const t = setTimeout(() => setPop(false), 450);
    return () => clearTimeout(t);
  }, [cantidadCarrito]);

  const params = new URLSearchParams(location.search);
  const categoriaActual = (params.get("categoria") || "").toLowerCase();
  const busquedaActual = (params.get("q") || "").toLowerCase();
  const enProductos = location.pathname === "/productos";
  const enArmador = location.pathname === "/arma-tu-pc";
  const esOfertas =
    enProductos &&
    (categoriaActual === "oferta" || categoriaActual === "ofertas");

  const esActiva = (clave) => {
    if (clave === "arma-tu-pc") return enArmador ? "activo" : "";
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
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <span className="topbar-envio">
            <FaTruckFast aria-hidden="true" />
            Envíos a todo el país
          </span>
          <span className="topbar-links">
            <Link to="/acerca">Ayuda</Link>
            <Link to="/contactanos">Posventa</Link>
            <a href="https://wa.me/5491112345678" target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          </span>
        </div>
      </div>

      <header className={`site-head${scrolled ? " is-scrolled" : ""}`}>
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
              placeholder="Buscá tu placa, notebook o periférico…"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              aria-label="Buscar productos"
            />
            <button type="submit" aria-label="Buscar">
              <FaMagnifyingGlass aria-hidden="true" />
              <span className="buscador-texto">Buscar</span>
            </button>
          </form>

          <nav className="nav-cuenta" aria-label="Cuenta y carrito">
            <Link to="/cuenta" className="link-cuenta link-registro">
              <FaUserPlus aria-hidden="true" />
              <span>Registrate</span>
            </Link>
            <Link to="/cuenta" className="link-cuenta" aria-label="Iniciá sesión">
              <FaUser aria-hidden="true" />
              <span>Iniciá sesión</span>
            </Link>
            <button
              className="carrito-btn"
              onClick={abrirCarrito}
              aria-label={`Abrir carrito, ${cantidadCarrito} productos`}
            >
              <FaCartShopping aria-hidden="true" />
              <span className={`carrito-count${pop ? " is-pop" : ""}`} aria-hidden="true">
                {cantidadCarrito}
              </span>
            </button>
          </nav>
        </div>

        <nav className="nav-categorias" aria-label="Categorías">
          <div className="nav-categorias-inner">
            <div className="nav-categorias-lista" role="list">
              {FILA_CATEGORIAS.map((c) => {
                const activa = esActiva(c.clave);
                const esOutlet = c.clave === "outlet";
                return (
                  <Link
                    key={c.clave}
                    to={c.to}
                    role="listitem"
                    className={`${esOutlet ? "nav-ofertas " : ""}${activa}`}
                    aria-current={activa ? "page" : undefined}
                  >
                    {c.label}
                  </Link>
                );
              })}
            </div>
            <span className="nav-ayuda">
              <Link to="/acerca">Ayuda</Link>
              <Link to="/contactanos">Servicio de Posventa</Link>
            </span>
          </div>
        </nav>
      </header>
    </>
  );
}

export default Navbar;
