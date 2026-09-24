import { useState } from "react";
import { Route, Routes } from "react-router-dom";
import Layout from "./components/layout/Layout";
import Home from "./pages/Home/Home";
import Carrito from "./pages/Carrito/Carrito";
import Cuenta from "./pages/Profile/Cuenta";
import Acerca from "./pages/About/Acerca";
import Contactanos from "./pages/Contact/Contacto";

export default function App() {
  const [carrito, setCarrito] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const abrirCarrito = () => setIsCartOpen(true);
  const cerrarCarrito = () => setIsCartOpen(false);

  const eliminarDelCarrito = (id) => {
    setCarrito(carrito.filter(item => item.id !== id));
  };

  const aumentarCantidad = (id) => {
    setCarrito(carrito.map(item =>
      item.id === id ? { ...item, cantidad: item.cantidad + 1 } : item
    ));
  };

  const disminuirCantidad = (id) => {
    setCarrito(carrito.map(item =>
      item.id === id && item.cantidad > 1
        ? { ...item, cantidad: item.cantidad - 1 }
        : item
    ));
  };

  const cantidadCarrito = carrito.reduce((acc, item) => acc + item.cantidad, 0);

  return (
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
        <Route index element={<Home />} />
        <Route path="carrito" element={<Carrito carrito={carrito} />} />
        <Route path="cuenta" element={<Cuenta />} />
        <Route path="acerca" element={<Acerca />} />
        <Route path="contactanos" element={<Contactanos />} />
      </Route>
    </Routes>
  );
}