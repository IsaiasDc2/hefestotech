import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router";
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
import useCatalogo from "../../hooks/useCatalogo";
import useVisibleUnaVez from "../../hooks/useVisibleUnaVez";
import useIdiomaStore, { t } from "../../store/idiomaStore";
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
  { nombreKey: "home.cat.procesadores", slug: "procesadores", db: "Procesador", icono: <FaMicrochip />, imagen: "procesador" },
  { nombreKey: "home.cat.placas", slug: "placas-de-video", db: "Placa de video", icono: <FaDesktop />, imagen: "placa" },
  { nombreKey: "home.cat.memorias", slug: "memorias", db: "Memoria RAM", icono: <FaMemory />, imagen: "ram" },
  { nombreKey: "home.cat.almacenamiento", slug: "almacenamiento", db: "Almacenamiento", icono: <FaHardDrive />, imagen: "almacenamiento" },
  { nombreKey: "home.cat.perifericos", slug: "perifericos", db: "Periferico", icono: <FaKeyboard />, imagen: "periferico" },
  { nombreKey: "home.cat.ofertas", slug: "ofertas", db: null, icono: <FaFire />, imagen: "oferta" },
];

const BASE = import.meta.env.BASE_URL || "/";

function Home({ agregarAlCarrito }) {
  const idioma = useIdiomaStore((s) => s.idioma);
  const { productos, cargando, error, reintentar } = useCatalogo();
  const [filtroTexto, setFiltroTexto] = useState("");
  const filtroTextoDif = useDeferredValue(filtroTexto);
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");
  const [marcasElegidas, setMarcasElegidas] = useState([]);
  const [refCategorias, categoriasVisibles] = useVisibleUnaVez();
  const [refDestacados, destacadosVisibles] = useVisibleUnaVez();
  const [refMarcas, marcasVisibles] = useVisibleUnaVez();
  const [refBeneficios, beneficiosVisibles] = useVisibleUnaVez();

  const categoriasPanel = CATEGORIAS.filter((c) => c.db).map((c) => ({
    label: t(idioma, c.nombreKey),
    value: c.db,
  }));

  // Destacados marcados por el comercio primero; se completa con el resto
  // de lo que tiene precio y stock para no dejar el carrusel corto.
  const destacados = useMemo(() => {
    const vendibles = productos.filter((p) => p.precio > 0 && p.stock > 0);
    const marcados = vendibles.filter((p) => p.destacado);
    const resto = vendibles.filter((p) => !p.destacado);
    return [...marcados, ...resto].slice(0, 8);
  }, [productos]);
  const ofertas = useMemo(
    () => productos.filter((p) => p.descuento_porcentaje > 0 && p.stock > 0).slice(0, 10),
    [productos]
  );

  const conteosCategoria = contarCategorias(productos, {
    texto: filtroTextoDif,
    marcas: marcasElegidas,
  });
  /* Conteo real por tarjeta de categoría (respeta texto+marcas del panel).
     Ofertas no es una categoría DB: se cuenta sobre el mismo base filtrada. */
  const baseConteo = filtrar(productos, {
    textoDif: filtroTextoDif,
    categoria: "Todas",
    marcas: marcasElegidas,
  });
  const conteoPorSlug = Object.fromEntries(
    CATEGORIAS.filter((c) => c.db).map((c) => [
      c.slug,
      conteosCategoria[c.db] ?? 0,
    ])
  );
  conteoPorSlug.ofertas = baseConteo.filter(
    (p) => Number(p.descuento_porcentaje ?? 0) > 0
  ).length;
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
          kicker={t(idioma, "home.explorarKicker")}
          titulo={t(idioma, "home.explorarTitulo")}
          id="home-categorias"
          verTodo="/productos"
        />
        <div ref={refCategorias} className={`grid-categorias${categoriasVisibles ? " is-visible" : ""}`}>
          {CATEGORIAS.map((c) => {
            const conteo = conteoPorSlug[c.slug] ?? 0;
            const nombreCat = t(idioma, c.nombreKey);
            const unidad = conteo === 1 ? t(idioma, "home.producto") : t(idioma, "home.productos");
            return (
              <Link
                key={c.slug}
                to={`/productos?categoria=${c.slug}`}
                className="card-categoria"
                aria-label={
                  conteo > 0
                    ? `${nombreCat}, ${conteo} ${unidad}`
                    : nombreCat
                }
              >
                <span className="cat-icono" aria-hidden="true">
                  {c.icono}
                  <img
                    src={`${BASE}banners/${c.imagen}.webp`}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width="128"
                    height="128"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </span>
                <span className="cat-nombre">{nombreCat}</span>
                {conteo > 0 && (
                  <span className="cat-conteo">
                    {conteo} {unidad}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      {cargando && productos.length === 0 ? (
        <section className="seccion" aria-label={t(idioma, "home.cargandoCat")}>
          <p className="estado-carga" role="status">{t(idioma, "home.cargandoProd")}</p>
          <div className="grid-destacados" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card-skeleton" />
            ))}
          </div>
        </section>
      ) : error ? (
        <div className="vacio" role="alert">
          <p className="vacio-titulo">{t(idioma, "home.errorTitulo")}</p>
          <p className="vacio-texto">{t(idioma, "home.errorTexto")}</p>
          <button
            type="button"
            className="btn-limpiar"
            onClick={reintentar}
          >
            ↻ {t(idioma, "home.reintentar")}
          </button>
        </div>
      ) : (
        <>
          <ProductCarousel
            titulo={t(idioma, "home.ofertaTitulo")}
            kicker={t(idioma, "home.ofertaKicker")}
            verTodo="/productos?categoria=ofertas"
            productos={ofertas}
            agregarAlCarrito={agregarAlCarrito}
          />

          <TiraBanner
            src={`${BASE}banners/tira-escritorio.webp`}
            alt={t(idioma, "tira.setup")}
          />

          <section className="seccion filtro-home" aria-labelledby="home-catalogo">
            <SectionHeader
              kicker={t(idioma, "home.catalogoKicker")}
              titulo={t(idioma, "home.catalogoTitulo")}
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
            alt={t(idioma, "tira.silla")}
            to="/productos?categoria=sillas-gamer"
            etiqueta={t(idioma, "tira.sillaEti")}
          />
          <ProductCarousel
            titulo={t(idioma, "home.destacadosTitulo")}
            kicker={t(idioma, "home.seleccionKicker")}
            verTodo="/productos"
            productos={destacados}
            agregarAlCarrito={agregarAlCarrito}
          />
          <TiraBanner
            src={`${BASE}banners/tira-placa.webp`}
            alt={t(idioma, "tira.placa")}
            to="/productos?categoria=placas-de-video"
            etiqueta={t(idioma, "tira.placaEti")}
          />
          {destacados.length === 0 && ofertas.length === 0 && (
            <div className="vacio">
              <p>{t(idioma, "home.vacioTitulo")}</p>
              <span>{t(idioma, "home.vacioTexto")}</span>
            </div>
          )}
        </>
      )}

      <section className="seccion marcas" aria-labelledby="home-marcas">
        <SectionHeader
          kicker={t(idioma, "home.marcasKicker")}
          titulo={t(idioma, "home.marcasTitulo")}
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

      <section ref={refBeneficios} className={`beneficios${beneficiosVisibles ? " is-visible" : ""}`} aria-label={t(idioma, "home.beneficios")}>
        <div className="beneficio">
          <FaCreditCard aria-hidden="true" />
          <div>
            <strong>{t(idioma, "home.cuotasT")}</strong>
            <span>{t(idioma, "home.cuotasS")}</span>
          </div>
        </div>
        <div className="beneficio beneficio-envio">
          <FaTruckFast aria-hidden="true" />
          <div>
            <strong>{t(idioma, "home.envioT")}</strong>
            <span>{t(idioma, "home.envioS")}</span>
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
            <strong>{t(idioma, "home.garantiaT")}</strong>
            <span>{t(idioma, "home.garantiaS")}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
