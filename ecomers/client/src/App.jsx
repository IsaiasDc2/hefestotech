import { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/layout/Layout";
import useCartStore from "./store/cartStore";
import useAuthStore from "./store/authStore";

const Home = lazy(() => import("./pages/Home/Home"));
const Productos = lazy(() => import("./components/product/Producto"));
const ProductoDetalle = lazy(() => import("./components/product/ProductList"));
const Carrito = lazy(() => import("./pages/Carrito/Carrito"));
const Checkout = lazy(() => import("./pages/Checkout/Checkout"));
const Cuenta = lazy(() => import("./pages/Profile/Cuenta"));
const Acerca = lazy(() => import("./pages/About/Acerca"));
const Contactanos = lazy(() => import("./pages/Contact/Contacto"));

function CargandoPagina() {
  return (
    <div className="cargando-pagina" role="status" aria-label="Cargando página">
      <span className="cargando-punto" />
      <span className="cargando-punto" />
      <span className="cargando-punto" />
    </div>
  );
}

export default function App() {
  const carrito = useCartStore((s) => s.carrito);
  const isCartOpen = useCartStore((s) => s.isCartOpen);
  const abrirCarrito = useCartStore((s) => s.abrirCarrito);
  const cerrarCarrito = useCartStore((s) => s.cerrarCarrito);
  const agregarAlCarrito = useCartStore((s) => s.agregarAlCarrito);
  const eliminarDelCarrito = useCartStore((s) => s.eliminarDelCarrito);
  const aumentarCantidad = useCartStore((s) => s.aumentarCantidad);
  const disminuirCantidad = useCartStore((s) => s.disminuirCantidad);
  const vaciarCarrito = useCartStore((s) => s.vaciarCarrito);
  const cargarSesion = useAuthStore((s) => s.cargarSesion);
  const suscribirseACambios = useAuthStore((s) => s.suscribirseACambios);

  useEffect(() => {
    cargarSesion?.();
    const desuscribir = suscribirseACambios?.();
    return () => desuscribir?.();
  }, [cargarSesion, suscribirseACambios]);

  const cantidadCarrito = carrito.reduce((acc, item) => acc + item.cantidad, 0);

  return (
    <Suspense fallback={<CargandoPagina />}>
      <Routes>
      <Route
        path="/"
        element={
          <Layout
            cantidadCarrito={cantidadCarrito}
            abrirCarrito={abrirCarrito}
            isCartOpen={isCartOpen}
            cerrarCarrito={cerrarCarrito}
            carrito={carrito}
            eliminarDelCarrito={eliminarDelCarrito}
            aumentarCantidad={aumentarCantidad}
            disminuirCantidad={disminuirCantidad}
          />
        }
      >
        <Route index element={<Home agregarAlCarrito={agregarAlCarrito} />} />
        <Route
          path="productos"
          element={<Productos agregarAlCarrito={agregarAlCarrito} />}
        />
        <Route
          path="producto/:id"
          element={<ProductoDetalle agregarAlCarrito={agregarAlCarrito} />}
        />
        <Route
          path="carrito"
          element={
            <Carrito
              carrito={carrito}
              eliminarDelCarrito={eliminarDelCarrito}
              aumentarCantidad={aumentarCantidad}
              disminuirCantidad={disminuirCantidad}
            />
          }
        />
        <Route
          path="checkout"
          element={
            <Checkout carrito={carrito} vaciarCarrito={vaciarCarrito} />
          }
        />
        <Route path="cuenta" element={<Cuenta />} />
        <Route path="acerca" element={<Acerca />} />
        <Route path="contactanos" element={<Contactanos />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
      </Routes>
    </Suspense>
  );
}
