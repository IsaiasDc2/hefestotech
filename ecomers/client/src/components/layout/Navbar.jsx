import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaMicrochip, FaCartShopping, FaMagnifyingGlass, FaUser } from "react-icons/fa6";
import "./Navbar.css";

const CATEGORIAS = [
  { label: "Productos", to: "/productos" },
  { label: "Procesadores", to: "/productos?categoria=Procesadores" },
  { label: "Placas de video", to: "/productos?categoria=Placas de video" },
  { label: "Memorias", to: "/productos?categoria=Memorias" },
  { label: "Almacenamiento", to: "/productos?categoria=Almacenamiento" },
  { label: "Ofertas", to: "/productos?orden=mayor" },
];

function Navbar({ cantidadCarrito, abrirCarrito }) {
  const [texto, setTexto] = useState("");
  const navigate = useNavigate();

  const buscar = (e) => {
    e.preventDefault();
    navigate(`/productos?q=${encodeURIComponent(texto.trim())}`);
  };

  return (
    <header className="site-head">
      <div className="site-head-inner">
        <Link to="/" className="logo">
          <FaMicrochip className="logo-icon" />
          Hefesto<span>Tech</span>
        </Link>

        <form className="buscador-head" onSubmit={buscar} role="search">
          <input
            type="text"
            placeholder="¿Qué estás buscando?"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            aria-label="Buscar productos"
          />
          <button type="submit" aria-label="Buscar">
            <FaMagnifyingGlass />
          </button>
        </form>

        <nav className="nav-cuenta">
          <Link to="/cuenta" className="link-cuenta">
            <FaUser />
            <span>
              Iniciá sesión
            </span>
          </Link>

          <button className="carrito-btn" onClick={abrirCarrito}>
            <FaCartShopping />
            <span className="carrito-count">{cantidadCarrito}</span>
          </button>
        </nav>
      </div>

      <nav className="nav-categorias" aria-label="Categorías">
        <div className="nav-categorias-inner">
          {CATEGORIAS.map((c) => (
            <Link key={c.label} to={c.to}>
              {c.label}
            </Link>
          ))}
          <span className="nav-ayuda">
            <Link to="/acerca">Ayuda</Link>
            <Link to="/contactanos">Posventa</Link>
          </span>
        </div>
      </nav>
    </header>
  );
}

export default Navbar;
