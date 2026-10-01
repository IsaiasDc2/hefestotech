import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaMicrochip,
  FaMemory,
  FaHardDrive,
  FaKeyboard,
  FaDesktop,
  FaFire,
  FaTruckFast,
  FaShieldHalved,
  FaCreditCard,
} from "react-icons/fa6";
import { supabase } from "../../components/lib/supabaseClient";
import ProductCarousel from "../../components/product/ProductCarousel";
import PromoBar from "../../components/layout/PromoBar";
import Banner from "../../components/layout/Banner";
import "./Home.css";

const MARCAS = [
  "Logitech",
  "Redragon",
  "AMD",
  "Intel",
  "NVIDIA",
  "Corsair",
  "Kingston",
  "Razer",
];

const CATEGORIAS = [
  { nombre: "Procesadores", icono: <FaMicrochip /> },
  { nombre: "Placas de video", icono: <FaDesktop /> },
  { nombre: "Memorias", icono: <FaMemory /> },
  { nombre: "Almacenamiento", icono: <FaHardDrive /> },
  { nombre: "Periféricos", icono: <FaKeyboard /> },
  { nombre: "Ofertas", icono: <FaFire /> },
];

function Home({ agregarAlCarrito }) {
  const [destacados, setDestacados] = useState([]);
  const [ofertas, setOfertas] = useState([]);
  const [cargando, setCargando] = useState(true);

  const normalizar = (data) =>
    (data || []).map((p) => ({
      ...p,
      precio: Number(p.precio ?? 0),
      stock: Number(p.stock ?? 0),
      imagen: p.imagen || "",
      categoria: p.categoria || "General",
    }));

  useEffect(() => {
    async function cargar() {
      try {
        const [{ data: dest, error: e1 }, { data: ofer, error: e2 }] =
          await Promise.all([
            supabase.from("productos").select("*").limit(8),
            supabase
              .from("productos")
              .select("*")
              .gt("descuentoPorcentaje", 0)
              .limit(10),
          ]);
        if (e1) throw e1;
        if (e2) throw e2;
        setDestacados(normalizar(dest));
        setOfertas(normalizar(ofer));
      } catch {
        setDestacados([]);
        setOfertas([]);
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  return (
    <div className="home">
      <Banner />
      <PromoBar />

      <section className="seccion">
        <div className="seccion-head">
          <h2>Explorá por categoría</h2>
          <Link to="/productos">Ver todo →</Link>
        </div>
        <div className="grid-categorias">
          {CATEGORIAS.map((c) => (
            <Link
              key={c.nombre}
              to={`/productos?categoria=${encodeURIComponent(c.nombre)}`}
              className="card-categoria"
            >
              <span className="cat-icono">{c.icono}</span>
              <span>{c.nombre}</span>
            </Link>
          ))}
        </div>
      </section>

      {cargando ? (
        <p className="estado-carga">Calentando la forja...</p>
      ) : (
        <>
          <ProductCarousel
            titulo="Ofertas de la semana"
            verTodo="/productos?orden=mayor"
            productos={ofertas}
            agregarAlCarrito={agregarAlCarrito}
          />
          <ProductCarousel
            titulo="Destacados de la forja"
            verTodo="/productos"
            productos={destacados}
            agregarAlCarrito={agregarAlCarrito}
          />
          {destacados.length === 0 && ofertas.length === 0 && (
            <div className="vacio">
              <p>El catálogo se está forjando.</p>
              <span>Volvé pronto para ver los destacados.</span>
            </div>
          )}
        </>
      )}

      <section className="seccion marcas">
        <div className="seccion-head">
          <h2>Nuestras marcas</h2>
        </div>
        <div className="marcas-fila">
          {MARCAS.map((m) => (
            <Link
              key={m}
              to={`/productos?q=${encodeURIComponent(m)}`}
              className="marca-chip"
            >
              {m}
            </Link>
          ))}
        </div>
      </section>

      <section className="beneficios">
        <div className="beneficio">
          <FaCreditCard />
          <div>
            <strong>6 cuotas sin interés</strong>
            <span>Con todas las tarjetas</span>
          </div>
        </div>
        <div className="beneficio">
          <FaTruckFast />
          <div>
            <strong>Envío a todo el país</strong>
            <span>Gratis desde $99.999</span>
          </div>
        </div>
        <div className="beneficio">
          <FaShieldHalved />
          <div>
            <strong>Garantía oficial</strong>
            <span>12 meses en todos los productos</span>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
