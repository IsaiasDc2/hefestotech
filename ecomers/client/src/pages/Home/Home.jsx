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
import ProductCard from "../../components/product/ProductCard";
import "./Home.css";

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
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      try {
        const { data, error } = await supabase
          .from("productos")
          .select("*")
          .limit(8);
        if (error) throw error;
        setDestacados(
          (data || []).map((p) => ({
            ...p,
            precio: Number(p.precio ?? 0),
            stock: Number(p.stock ?? 0),
            imagen: p.imagen || "",
            categoria: p.categoria || "General",
          }))
        );
      } catch {
        setDestacados([]);
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-texto">
            <p className="hero-eyebrow">Hefestotech · Hardware & Gaming</p>
            <h1>
              Forjá tu próxima
              <span className="hero-fuego"> máquina</span>
            </h1>
            <p className="hero-sub">
              Procesadores, placas de video, memorias y todo lo que tu setup
              necesita para trabajar, crear y jugar a tu manera.
            </p>
            <div className="hero-acciones">
              <Link to="/productos" className="btn-hero primario">
                Ver productos
              </Link>
              <Link to="/contactanos" className="btn-hero fantasma">
                Armá tu PC
              </Link>
            </div>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="brasas">
              <span className="chip-spec s1">DDR5</span>
              <span className="chip-spec s2">NVMe Gen4</span>
              <span className="chip-spec s3">RTX Ready</span>
              <span className="chip-spec s4">AM5</span>
              <div className="yunque">HT</div>
            </div>
          </div>
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

      <section className="seccion">
        <div className="seccion-head">
          <h2>Destacados de la forja</h2>
          <Link to="/productos">Ver catálogo →</Link>
        </div>
        {cargando ? (
          <p className="estado-carga">Calentando la forja...</p>
        ) : destacados.length === 0 ? (
          <div className="vacio">
            <p>El catálogo se está forjando.</p>
            <span>Volvé pronto para ver los destacados.</span>
          </div>
        ) : (
          <div className="grid-destacados">
            {destacados.map((p) => (
              <ProductCard
                key={p.id}
                producto={p}
                agregarAlCarrito={agregarAlCarrito}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Home;
