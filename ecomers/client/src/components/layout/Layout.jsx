import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import Asistente from "./Asistente";
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
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
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

      <main className="layout-main" id="contenido" tabIndex={-1}>
        <Suspense
          fallback={
            <div className="cargando-pagina" role="status" aria-label="Cargando página">
              <span className="cargando-punto" />
              <span className="cargando-punto" />
              <span className="cargando-punto" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>

      <Footer />
      <Asistente />
    </div>
  );
}

export default Layout;
