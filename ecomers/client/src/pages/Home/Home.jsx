import { useEffect, useRef, useState } from "react";
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
import { supabase, supabaseConfigurada } from "../../components/lib/supabaseClient";
import ProductCard from "../../components/product/ProductCard";
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
  { nombre: "Procesadores", slug: "procesadores", db: "Procesador", icono: <FaMicrochip /> },
  { nombre: "Placas de video", slug: "placas-de-video", db: "Placa de video", icono: <FaDesktop /> },
  { nombre: "Memorias", slug: "memorias", db: "Memoria RAM", icono: <FaMemory /> },
  { nombre: "Almacenamiento", slug: "almacenamiento", db: "Almacenamiento", icono: <FaHardDrive /> },
  { nombre: "Periféricos", slug: "perifericos", db: "Periferico", icono: <FaKeyboard /> },
  { nombre: "Ofertas", slug: "ofertas", db: null, icono: <FaFire /> },
];

function Home({ agregarAlCarrito }) {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");
  const pillsRef = useRef(null);

  const pills = [
    { label: "Todas", value: "Todas" },
    ...CATEGORIAS.filter((c) => c.db).map((c) => ({
      label: c.nombre,
      value: c.db,
    })),
  ];

  const desplazarPills = (dir) => {
    const el = pillsRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 220, behavior: "smooth" });
  };

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
        if (!supabaseConfigurada) {
          setProductos([]);
          return;
        }
        const { data, error } = await supabase
          .from("productos")
          .select("*")
          .limit(100);
        if (error) throw error;
        setProductos(normalizar(data));
      } catch {
        setProductos([]);
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  const destacados = productos.slice(0, 8);
  const ofertas = productos
    .filter((p) => p.descuento_porcentaje > 0)
    .slice(0, 10);

  const filtrados = productos.filter((p) => {
    const texto = filtroTexto.trim().toLowerCase();
    const coincideTexto =
      !texto ||
      p.nombre.toLowerCase().includes(texto) ||
      (p.marca || "").toLowerCase().includes(texto);
    const coincideCategoria =
      filtroCategoria === "Todas" || p.categoria === filtroCategoria;
    return coincideTexto && coincideCategoria;
  });

  return (
    <div className="home">
      <Banner />
      <PromoBar />

      <section className="seccion" aria-labelledby="home-categorias">
        <div className="seccion-head editorial">
          <div className="seccion-titular">
            <p className="kicker">
              <span className="kicker-num" aria-hidden="true">01</span>
              Explorar
            </p>
            <h2 id="home-categorias">Explorá por categoría</h2>
          </div>
          <Link to="/productos" className="ver-todo">
            Ver todo <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="grid-categorias">
          {CATEGORIAS.map((c) => (
            <Link
              key={c.nombre}
              to={`/productos?categoria=${c.slug}`}
              className="card-categoria"
            >
              <span className="cat-icono" aria-hidden="true">{c.icono}</span>
              <span>{c.nombre}</span>
            </Link>
          ))}
        </div>
      </section>

      {cargando ? (
        <p className="estado-carga">Calentando la forja...</p>
      ) : (
        <>
          <section className="seccion filtro-home" aria-labelledby="home-catalogo">
            <div className="seccion-head editorial">
              <div className="seccion-titular">
                <p className="kicker">
                  <span className="kicker-num" aria-hidden="true">02</span>
                  Destacados
                </p>
                <h2 id="home-catalogo">Conocé nuestros productos destacados</h2>
              </div>
              <span className="conteo">
                {filtrados.length} producto{filtrados.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="pills-wrap">
              <button
                type="button"
                className="pills-flecha"
                onClick={() => desplazarPills(-1)}
                aria-label="Categorías anteriores"
              >
                ‹
              </button>
              <div
                className="pills-categorias"
                ref={pillsRef}
                role="tablist"
                aria-label="Filtrá por categoría"
              >
                {pills.map((pill) => (
                  <button
                    key={pill.value}
                    type="button"
                    role="tab"
                    aria-selected={filtroCategoria === pill.value}
                    className={`pill${filtroCategoria === pill.value ? " activa" : ""}`}
                    onClick={() => setFiltroCategoria(pill.value)}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="pills-flecha"
                onClick={() => desplazarPills(1)}
                aria-label="Más categorías"
              >
                ›
              </button>
            </div>
            <div className="filtros">
              <input
                className="buscador"
                type="text"
                placeholder="🔍 Buscar por nombre o marca..."
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                aria-label="Buscar productos"
              />
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                aria-label="Filtrar por categoría"
              >
                <option value="Todas">Todas las categorías</option>
                {CATEGORIAS.filter((c) => c.db).map((c) => (
                  <option key={c.slug} value={c.db}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              {(filtroTexto || filtroCategoria !== "Todas") && (
                <button
                  className="btn-limpiar"
                  onClick={() => {
                    setFiltroTexto("");
                    setFiltroCategoria("Todas");
                  }}
                >
                  ↻ Limpiar
                </button>
              )}
            </div>
            {filtrados.length === 0 ? (
              <div className="vacio">
                <p>Sin resultados con ese filtro.</p>
                <span>Probá con otra búsqueda o categoría.</span>
              </div>
            ) : (
              <div className="grid-destacados">
                {filtrados.slice(0, 8).map((p) => (
                  <ProductCard
                    key={p.id}
                    producto={p}
                    agregarAlCarrito={agregarAlCarrito}
                  />
                ))}
              </div>
            )}
          </section>

          <ProductCarousel
            titulo="Ofertas de la semana"
            kicker="Botín semanal"
            kickerNum="03"
            verTodo="/productos?categoria=ofertas"
            productos={ofertas}
            agregarAlCarrito={agregarAlCarrito}
          />
          <ProductCarousel
            titulo="Destacados de la forja"
            kicker="Los más buscados"
            kickerNum="04"
            verTodo="/productos"
            productos={destacados}
            agregarAlCarrito={agregarAlCarrito}
          />
          {destacados.length === 0 && ofertas.length === 0 && (
            <div className="vacio">
              <p>El catálogo se está forjando.</p>
              <span>
                {supabaseConfigurada
                  ? "Volvé pronto para ver los destacados."
                  : "Falta conectar Supabase: copiá .env.example a .env.local y completá las claves."}
              </span>
            </div>
          )}
        </>
      )}

      <section className="seccion marcas" aria-labelledby="home-marcas">
        <div className="seccion-head editorial">
          <div className="seccion-titular">
            <p className="kicker">
              <span className="kicker-num" aria-hidden="true">05</span>
              Marcas
            </p>
            <h2 id="home-marcas">Nuestras marcas</h2>
          </div>
          <Link to="/productos" className="ver-todo">
            Ver todo <span aria-hidden="true">→</span>
          </Link>
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
