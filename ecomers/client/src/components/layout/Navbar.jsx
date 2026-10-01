import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FaMicrochip, FaCartShopping, FaMagnifyingGlass, FaUser, FaTruckFast } from "react-icons/fa6";
import { CATEGORIAS, linkOfertas } from "../../constants/categorias";
import "./Navbar.css";

// Subconjunto visible en la barra, resuelto contra el mapa central.
const SLUGS_RAPIDOS = [
  "procesadores",
  "placas-de-video",
  "memorias",
  "almacenamiento",
  "perifericos",
];
const ENLACES_RAPIDOS = SLUGS_RAPIDOS.map(
  (slug) => CATEGORIAS.find((c) => c.slug === slug) || { slug, label: slug }
);

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

  // Badge animado al cambiar la cantidad (solo visual).
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
  const enProductos = location.pathname === "/productos";
  const esActivo = (slug) =>
    enProductos && categoriaActual === slug ? "activo" : "";
  const productosActivo =
    enProductos && !categoriaActual ? "activo" : "";
  const ofertasActivo =
    enProductos && (categoriaActual === "oferta" || categoriaActual === "ofertas")
      ? "activo"
      : "";

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
          <span className="topbar-sep" aria-hidden="true" />
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
          Hefesto<span>Tech</span>
        </Link>

        <form className="buscador-head" onSubmit={buscar} role="search">
          <FaMagnifyingGlass className="buscador-icono" aria-hidden="true" />
          <input
            type="text"
            placeholder="¿Qué estás buscando?"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            aria-label="Buscar productos"
          />
          <button type="submit" aria-label="Buscar">
            <FaMagnifyingGlass aria-hidden="true" />
          </button>
        </form>

        <nav className="nav-cuenta" aria-label="Cuenta y carrito">
          <Link to="/cuenta" className="link-cuenta" aria-label="Mi cuenta">
            <FaUser aria-hidden="true" />
            <span>
              Iniciá sesión
            </span>
          </Link>

          <button className="carrito-btn" onClick={abrirCarrito} aria-label={`Abrir carrito, ${cantidadCarrito} productos`}>
            <FaCartShopping aria-hidden="true" />
            <span className={`carrito-count${pop ? " is-pop" : ""}`} aria-hidden="true">{cantidadCarrito}</span>
          </button>
        </nav>
      </div>

      <nav className="nav-categorias" aria-label="Categorías">
        <div className="nav-categorias-inner">
          <Link to="/productos" className={productosActivo} aria-current={productosActivo ? "page" : undefined}>Productos</Link>
          {ENLACES_RAPIDOS.map((c) => (
            <Link key={c.slug} to={`/productos?categoria=${c.slug}`} className={esActivo(c.slug)} aria-current={esActivo(c.slug) ? "page" : undefined}>
              {c.label}
            </Link>
          ))}
          <Link to={linkOfertas} className={`nav-ofertas ${ofertasActivo}`} aria-current={ofertasActivo ? "page" : undefined}>Ofertas</Link>
          <span className="nav-ayuda">
            <Link to="/acerca">Nosotros</Link>
            <Link to="/contactanos">Contactanos</Link>
          </span>
        </div>
      </nav>
    </header>
    </>
  );
}

export default Navbar;
