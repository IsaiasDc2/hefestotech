import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";

function Layout({ cantidadCarrito, abrirCarrito }) {
  return (
    <>
      <Navbar
        cantidadCarrito={cantidadCarrito}
        abrirCarrito={abrirCarrito}
      />

      <main>
        <Outlet />
      </main>

      <Footer />
    </>
  );
}

export default Layout;