import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import Asistente from "./Asistente";
import Marca from "../brand/Marca";
import CarritoLateral from "../../pages/Carrito/CarritoLateral";
import "../brand/Marca.css";
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
            <div className="cargando-pagina cargando-marca" role="status" aria-label="Cargando página">
              <Marca variante="simbolo" ancho={48} alto={48} decorativa />
              <span className="cargando-marca-fila" aria-hidden="true">
                <span className="cargando-punto" />
                <span className="cargando-punto" />
                <span className="cargando-punto" />
              </span>
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
