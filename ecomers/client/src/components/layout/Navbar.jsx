import { Link } from "react-router-dom";
import { FaMicrochip, FaCartShopping } from "react-icons/fa6";
import "./Navbar.css";

function Navbar({ cantidadCarrito, abrirCarrito }) {
  return (
    <header className="site-head">
      <div className="site-head-inner">
        <Link to="/" className="logo">
          <FaMicrochip className="logo-icon" />
          Hefesto<span>Tech</span>
        </Link>

        <nav className="nav-link">
          <Link to="/">Inicio</Link>
          <Link to="/acerca">Acerca</Link>
          <Link to="/contactanos">Contactanos</Link>
          <Link to="/cuenta">Mi Cuenta</Link>

          <button className="carrito-btn" onClick={abrirCarrito}>
            <FaCartShopping />
            Carrito
            <span>{cantidadCarrito}</span>
          </button>
        </nav>
      </div>
    </header>
  );
}

export default Navbar;