import { useDeferredValue, useEffect, useRef, useState } from "react";
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

function usarVisibleUnaVez() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -8% 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return [ref, visible];
}

function Home({ agregarAlCarrito }) {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [reintento, setReintento] = useState(0);
  const [filtroTexto, setFiltroTexto] = useState("");
  const filtroTextoDif = useDeferredValue(filtroTexto);
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");
  const [marcasElegidas, setMarcasElegidas] = useState([]);
  const [refCategorias, categoriasVisibles] = usarVisibleUnaVez();
  const [refDestacados, destacadosVisibles] = usarVisibleUnaVez();
  const [refMarcas, marcasVisibles] = usarVisibleUnaVez();
  const [refBeneficios, beneficiosVisibles] = usarVisibleUnaVez();

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
        <div ref={refCategorias} className={`grid-categorias${categoriasVisibles ? " is-visible" : ""}`}>
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
            <div ref={refDestacados} className={`grid-destacados${destacadosVisibles ? " is-visible" : ""}`}>
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
        <div ref={refMarcas} className={`marcas-fila${marcasVisibles ? " is-visible" : ""}`}>
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

      <section ref={refBeneficios} className={`beneficios${beneficiosVisibles ? " is-visible" : ""}`} aria-label="Beneficios de compra">
        <div className="beneficio">
          <FaCreditCard aria-hidden="true" />
          <div>
            <strong>6 cuotas sin interés</strong>
            <span>Con todas las tarjetas</span>
          </div>
        </div>
        <div className="beneficio beneficio-envio">
          <FaTruckFast aria-hidden="true" />
          <div>
            <strong>Envío a todo el país</strong>
            <span>Gratis desde $99.999</span>
          </div>
          <span className="envio-anim" aria-hidden="true">
            <svg viewBox="0 0 200 32" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line className="env-track" x1="8" y1="24" x2="190" y2="24" />
              <line className="env-trail" x1="8" y1="24" x2="190" y2="24" />
              <g transform="translate(8,2)">
                <g className="env-cart">
                  <g transform="skewX(-8)">
                    <path d="M1 3 L-4 -3" />
                    <path d="M1 3 H17 L14.5 13 H3.5 Z" />
                    <path d="M7 3 L8 13" />
                    <circle className="env-wheel" cx="6" cy="16.5" r="2" />
                    <circle className="env-wheel" cx="12.5" cy="16.5" r="2" />
                  </g>
                  <g className="env-speed">
                    <path d="M-10 5 H-18" />
                    <path d="M-11 9 H-21" />
                    <path d="M-10 13 H-17" />
                  </g>
                </g>
              </g>
              <g transform="translate(8,15)">
                <g className="env-check">
                  <g className="env-check-pop">
                    <circle r="9" />
                    <path d="M-4 0 L-1 3.5 L4.5 -3" />
                  </g>
                </g>
              </g>
            </svg>
          </span>
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
