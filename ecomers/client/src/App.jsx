import { Suspense, lazy, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/layout/Layout";

const Home = lazy(() => import("./pages/Home/Home"));
const Productos = lazy(() => import("./components/product/Producto"));
const ProductoDetalle = lazy(() => import("./components/product/ProductList"));
const Carrito = lazy(() => import("./pages/Carrito/Carrito"));
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
  const [carrito, setCarrito] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const abrirCarrito = () => setIsCartOpen(true);
  const cerrarCarrito = () => setIsCartOpen(false);

  const agregarAlCarrito = (producto) => {
    setCarrito((prev) => {
      const existe = prev.find((item) => item.id === producto.id);
      if (existe) {
        return prev.map((item) =>
          item.id === producto.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        );
      }
      return [...prev, { ...producto, cantidad: 1 }];
    });
    setIsCartOpen(true);
  };

  const eliminarDelCarrito = (id) => {
    setCarrito((prev) => prev.filter((item) => item.id !== id));
  };

  const aumentarCantidad = (id) => {
    setCarrito((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, cantidad: item.cantidad + 1 } : item
      )
    );
  };

  const disminuirCantidad = (id) => {
    setCarrito((prev) =>
      prev.map((item) =>
        item.id === id && item.cantidad > 1
          ? { ...item, cantidad: item.cantidad - 1 }
          : item
      )
    );
  };

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
        <Route path="cuenta" element={<Cuenta />} />
        <Route path="acerca" element={<Acerca />} />
        <Route path="contactanos" element={<Contactanos />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
      </Routes>
    </Suspense>
  );
}
