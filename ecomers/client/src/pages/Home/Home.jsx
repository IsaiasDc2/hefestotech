import { useDeferredValue, useEffect, useState } from "react";
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
import "../../components/product/ProductCard.css";
import ProductCarousel from "../../components/product/ProductCarousel";
import SectionHeader from "../../components/ui/SectionHeader";
import FilterPanel from "../../components/filters/FilterPanel";
import {
  contarCategorias,
  contarMarcas,
  filtrar,
} from "../../components/filters/filtros";
import PromoBar from "../../components/layout/PromoBar";
import Banner from "../../components/layout/Banner";
import TiraBanner from "../../components/layout/TiraBanner";
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
  { nombre: "Procesadores", slug: "procesadores", db: "Procesador", icono: <FaMicrochip />, imagen: "procesador" },
  { nombre: "Placas de video", slug: "placas-de-video", db: "Placa de video", icono: <FaDesktop />, imagen: "placa" },
  { nombre: "Memorias", slug: "memorias", db: "Memoria RAM", icono: <FaMemory />, imagen: "ram" },
  { nombre: "Almacenamiento", slug: "almacenamiento", db: "Almacenamiento", icono: <FaHardDrive />, imagen: "almacenamiento" },
  { nombre: "Periféricos", slug: "perifericos", db: "Periferico", icono: <FaKeyboard />, imagen: "periferico" },
  { nombre: "Ofertas", slug: "ofertas", db: null, icono: <FaFire />, imagen: "oferta" },
];

const BASE = import.meta.env.BASE_URL || "/";

function Home({ agregarAlCarrito }) {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [reintento, setReintento] = useState(0);
  const [filtroTexto, setFiltroTexto] = useState("");
  const filtroTextoDif = useDeferredValue(filtroTexto);
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");
  const [marcasElegidas, setMarcasElegidas] = useState([]);

  const categoriasPanel = CATEGORIAS.filter((c) => c.db).map((c) => ({
    label: c.nombre,
    value: c.db,
  }));

  const normalizar = (data) =>
    (data || []).map((p) => ({
      ...p,
      precio: Number(p.precio ?? 0),
      stock: Number(p.stock ?? 0),
      descuento_porcentaje: Number(p.descuento_porcentaje ?? 0),
      imagen: p.imagen || "",
      categoria: p.categoria || "General",
    }));

  useEffect(() => {
    async function cargar() {
      try {
        setError(false);
        const { data, error } = await supabase
          .from("productos")
          .select("*")
          .limit(100);
        if (error) throw error;
        setProductos(normalizar(data));
      } catch {
        setProductos([]);
        setError(true);
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [reintento]);

  const destacados = productos.slice(0, 8);
  const ofertas = productos
    .filter((p) => p.descuento_porcentaje > 0)
    .slice(0, 10);

  const conteosCategoria = contarCategorias(productos, {
    texto: filtroTextoDif,
    marcas: marcasElegidas,
  });
  const marcasDisponibles = Object.entries(
    contarMarcas(productos, {
      texto: filtroTextoDif,
      categoria: filtroCategoria,
    })
  ).map(([nombre, conteo]) => ({ nombre, conteo }));
  const filtrados = filtrar(productos, {
    textoDif: filtroTextoDif,
    categoria: filtroCategoria,
    marcas: marcasElegidas,
  });
  const limpiarFiltros = () => {
    setFiltroTexto("");
    setFiltroCategoria("Todas");
    setMarcasElegidas([]);
  };

  return (
    <div className="home">
      <Banner />
      <PromoBar />

      <section className="seccion" aria-labelledby="home-categorias">
        <SectionHeader
          kicker="Explorar"
          titulo="Explorá por categoría"
          id="home-categorias"
          verTodo="/productos"
        />
        <div className="grid-categorias">
          {CATEGORIAS.map((c) => (
            <Link
              key={c.nombre}
              to={`/productos?categoria=${c.slug}`}
              className="card-categoria"
            >
              <span className="cat-icono" aria-hidden="true">
                {c.icono}
                <img
                  src={`${BASE}banners/${c.imagen}.webp`}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  width="64"
                  height="64"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </span>
              <span>{c.nombre}</span>
            </Link>
          ))}
        </div>
      </section>

      {cargando ? (
        <section className="seccion" aria-label="Cargando catálogo">
          <p className="estado-carga" role="status">Cargando productos…</p>
          <div className="grid-destacados" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card-skeleton" />
            ))}
          </div>
        </section>
      ) : error ? (
        <div className="vacio" role="alert">
          <p className="vacio-titulo">No pudimos cargar los productos</p>
          <p className="vacio-texto">Revisá tu conexión a internet e intentá de nuevo.</p>
          <button
            type="button"
            className="btn-limpiar"
            onClick={() => {
              setCargando(true);
              setReintento((n) => n + 1);
            }}
          >
            ↻ Reintentar
          </button>
        </div>
      ) : (
        <>
          <ProductCarousel
            titulo="En oferta"
            kicker="Precios rebajados"
            verTodo="/productos?categoria=ofertas"
            productos={ofertas}
            agregarAlCarrito={agregarAlCarrito}
          />

          <TiraBanner
            src={`${BASE}banners/tira-escritorio.webp`}
            alt="Setup gamer con monitor sobre escritorio"
          />

          <section className="seccion filtro-home" aria-labelledby="home-catalogo">
            <SectionHeader
              kicker="Destacados"
              titulo="Explorá el catálogo"
              id="home-catalogo"
              verTodo="/productos"
            />
            <FilterPanel
              texto={filtroTexto}
              onTexto={setFiltroTexto}
              categoria={filtroCategoria}
              onCategoria={setFiltroCategoria}
              marcas={marcasElegidas}
              onMarcas={setMarcasElegidas}
              categorias={categoriasPanel}
              marcasDisponibles={marcasDisponibles}
              conteosCategoria={conteosCategoria}
              total={filtrados.length}
              totalCatalogo={productos.length}
              onLimpiar={limpiarFiltros}
            />
            <div className="grid-destacados">
              {filtrados.slice(0, 8).map((p) => (
                <ProductCard
                  key={p.id}
                  producto={p}
                  agregarAlCarrito={agregarAlCarrito}
                />
              ))}
            </div>
          </section>

          <TiraBanner
            src={`${BASE}banners/tira-silla.webp`}
            alt="Silla gamer"
            to="/productos?categoria=sillas-gamer"
            etiqueta="Ver sillas gamer"
          />
          <ProductCarousel
            titulo="Destacados"
            kicker="Selección"
            verTodo="/productos"
            productos={destacados}
            agregarAlCarrito={agregarAlCarrito}
          />
          {destacados.length === 0 && ofertas.length === 0 && (
            <div className="vacio">
              <p>El catálogo está vacío por ahora.</p>
              <span>Volvé pronto o explorá el catálogo completo.</span>
            </div>
          )}
        </>
      )}

      <section className="seccion marcas" aria-labelledby="home-marcas">
        <SectionHeader
          kicker="Marcas"
          titulo="Marcas"
          id="home-marcas"
          verTodo="/productos"
        />
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

      <section className="beneficios" aria-label="Beneficios de compra">
        <div className="beneficio">
          <FaCreditCard aria-hidden="true" />
          <div>
            <strong>6 cuotas sin interés</strong>
            <span>Con todas las tarjetas</span>
          </div>
        </div>
        <div className="beneficio">
          <FaTruckFast aria-hidden="true" />
          <div>
            <strong>Envío a todo el país</strong>
            <span>Gratis desde $99.999</span>
          </div>
        </div>
        <div className="beneficio">
          <FaShieldHalved aria-hidden="true" />
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
