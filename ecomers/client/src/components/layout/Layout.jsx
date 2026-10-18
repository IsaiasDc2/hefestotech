import { Suspense } from "react";
import { Outlet } from "react-router";
import Navbar from "./Navbar";
import Footer from "./Footer";
import Asistente from "./Asistente";
import Marca from "../brand/Marca";
import CarritoLateral from "../../pages/Carrito/CarritoLateral";
import { usePausaPestana } from "../../hooks/useMotion";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import { MODO_DEMO } from "../lib/supabaseClient";
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
  // Pausa global de loops CSS cuando la pestana se oculta.
  usePausaPestana();
  const idioma = useIdiomaStore((s) => s.idioma);
  return (
    <div className="layout">
      <a className="skip-link" href="#contenido">
        {t(idioma, "lay.saltar")}
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
            <div className="cargando-pagina cargando-marca" role="status" aria-label={t(idioma, "lay.cargando")}>
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
      {MODO_DEMO && (
        <p className="aviso-demo" role="note" title={t(idioma, "demo.detalle")}>
          {t(idioma, "demo.etiqueta")}
        </p>
      )}
    </div>
  );
}

export default Layout;
