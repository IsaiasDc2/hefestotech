import { lazy, useEffect, useState } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import Layout from "./components/layout/Layout";
import { supabase } from "./components/lib/supabaseClient";
import useCartStore from "./store/cartStore";
import useAuthStore from "./store/authStore";
import useIdiomaStore, { t } from "./store/idiomaStore";
import useDocumentTitle from "./hooks/useDocumentTitle";
import useCanonical from "./hooks/useCanonical";

const Home = lazy(() => import("./pages/Home/Home"));
const Productos = lazy(() => import("./components/product/Producto"));
const ProductoDetalle = lazy(() => import("./components/product/ProductList"));
const Carrito = lazy(() => import("./pages/Carrito/Carrito"));
const Checkout = lazy(() => import("./pages/Checkout/Checkout"));
const PagoResultado = lazy(() => import("./pages/Checkout/PagoResultado"));
const PedidoDetalle = lazy(() => import("./pages/Checkout/PedidoDetalle"));
const Cuenta = lazy(() => import("./pages/Profile/Cuenta"));
const Admin = lazy(() => import("./pages/Admin/Admin"));
const ReclamoPublico = lazy(() => import("./pages/Admin/ReclamoPublico"));
const Acerca = lazy(() => import("./pages/About/Acerca"));
const Contactanos = lazy(() => import("./pages/Contact/Contacto"));
const Armador = lazy(() => import("./armador/Armador"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Guard de rutas con rol (sin logica admin: solo decide acceso).
// - Lee el rol desde public.perfiles.rol (migracion 004; 005 agrega mas
//   roles pero aun no esta aplicada: ver AUDITORIA.md "Que falta").
// - Niega por defecto cuando no hay rol: invitados y usuarios sin perfil
//   ven "denegado" en /admin; en /cuenta los invitados pasan al login y
//   los autenticados sin rol se deniegan.
// - Roles con acceso total: owner y admin. Cualquier otro rol se deniega
//   en /admin hasta que la matriz de permisos este vigente.
const ROLES_ADMIN = ["owner", "admin"];

function GuardiaRol({ soloAdmin = false, children }) {
  const [estado, setEstado] = useState("cargando");
  const idioma = useIdiomaStore((s) => s.idioma);

  useEffect(() => {
    let viva = true;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) {
          if (viva) setEstado(soloAdmin ? "denegado" : "invitado");
          return;
        }
        const { data, error } = await supabase
          .from("perfiles")
          .select("rol")
          .eq("id", session.user.id)
          .maybeSingle();
        if (error) throw error;
        const rol = data?.rol || null;
        if (!rol) {
          if (viva) setEstado("denegado");
          return;
        }
        if (soloAdmin && !ROLES_ADMIN.includes(rol)) {
          if (viva) setEstado("denegado");
          return;
        }
        if (viva) setEstado("ok");
      } catch (_) {
        // Error de red o RLS: negar por defecto, nunca abrir por error.
        if (viva) setEstado("denegado");
      }
    })();
    return () => {
      viva = false;
    };
  }, [soloAdmin]);

  if (estado === "cargando") {
    return (
      <p className="detalle-estado" role="status">
        {t(idioma, "app.verificando")}
      </p>
    );
  }
  if (estado === "invitado" || estado === "ok") return children;
  return (
    <div className="detalle-estado" role="alert">
      <p className="vacio-titulo">{t(idioma, "app.restringido")}</p>
      <p className="vacio-texto">
        {t(idioma, "app.restringidoT")}
      </p>
      <div className="detalle-acciones-error">
        <Link to="/">← {t(idioma, "app.volver")}</Link>
        <Link to="/cuenta">{t(idioma, "app.miCuenta")}</Link>
      </div>
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
    <>
    <SeoRuta />
    <DesplazarArriba />
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
        <Route path="cuenta" element={<GuardiaRol><Cuenta /></GuardiaRol>} />
        <Route path="pago-exito" element={<PagoResultado tipo="exito" />} />
        <Route path="pago-pendiente" element={<PagoResultado tipo="pendiente" />} />
        <Route path="pago-fallido" element={<PagoResultado tipo="fallido" />} />
        <Route path="pedido/:id" element={<PedidoDetalle />} />
        <Route path="reclamo" element={<ReclamoPublico />} />
        <Route path="admin" element={<GuardiaRol soloAdmin><Admin /></GuardiaRol>} />
        <Route path="acerca" element={<Acerca />} />
        <Route path="contactanos" element={<Contactanos />} />
        <Route path="armar" element={<Armador />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      </Routes>
    </>
  );
}

function SeoRuta() {
  // Se monta antes que las páginas: su efecto corre primero y la página
  // de detalle puede sobreescribir el título con el nombre real.
  useDocumentTitle();
  useCanonical();
  return null;
}

function DesplazarArriba() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
