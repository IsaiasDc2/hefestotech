import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import CarritoLateral from "../../pages/Carrito/CarritoLateral";
import "./Layout.css";

function Layout({
  cantidadCarrito,
  abrirCarrito,
  isCartOpen,
  cerrarCarrito,
  carrito,
  eliminarDelCarrito,
  aumentarCantidad,
  disminuirCantidad
}) {
  return (
    <div className="layout">
      <Navbar
        cantidadCarrito={cantidadCarrito}
        abrirCarrito={abrirCarrito}
      />

      <CarritoLateral
        isOpen={isCartOpen}
        onClose={cerrarCarrito}
        carrito={carrito}
        eliminarDelCarrito={eliminarDelCarrito}
        aumentarCantidad={aumentarCantidad}
        disminuirCantidad={disminuirCantidad}
      />

      <main className="layout-main">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}

export default Layout;