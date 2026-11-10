import { useMemo } from "react";
import { Link } from "react-router";
import {
  FaArrowRight,
  FaBolt,
  FaCartPlus,
  FaCreditCard,
  FaMoneyBillTransfer,
  FaScrewdriverWrench,
  FaStore,
  FaTruckFast,
  FaWhatsapp,
} from "react-icons/fa6";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import useCatalogo from "../../hooks/useCatalogo";
import { precioFinal } from "../../services/productService";
import { CATEGORIAS, linkCategoria, linkOfertas, nombreCategoria } from "../../constants/categorias";
import { whatsappUrl } from "../../constants/whatsapp";
import { formatearPesos } from "../../utils/dinero";
import ProductCard from "../../components/product/ProductCard";
import ProductCarousel from "../../components/product/ProductCarousel";
import SectionHeader from "../../components/ui/SectionHeader";
import CamionEnvio from "../../components/ui/CamionEnvio";
import Revelar from "../../components/ui/Revelar";
import "./Home.css";

const CATEGORIAS_HOME = [
  "procesadores",
  "placas-de-video",
  "motherboards",
  "memorias",
  "almacenamiento",
  "monitores",
  "perifericos",
  "sillas-gamer",
];

const vendible = (p) => precioFinal(p) > 0 && p.stock > 0;
const conFoto = (p) => Boolean(p.imagen);

function FotoPozo({ producto, tamanos, prioridad = false }) {
  return (
    <span className="ini-pozo">
      {producto?.imagen && (
        <img
          src={producto.imagen}
          alt=""
          width="600"
          height="600"
          sizes={tamanos}
          loading={prioridad ? "eager" : "lazy"}
          fetchPriority={prioridad ? "high" : "auto"}
          decoding="async"
        />
      )}
    </span>
  );
}

function Hero({ productos, cargando, idioma }) {
  const vitrina = useMemo(() => {
    const candidatos = productos.filter((p) => vendible(p) && conFoto(p));
    const principal =
      candidatos.find((p) => p.destacado) ??
      [...candidatos].sort((a, b) => precioFinal(b) - precioFinal(a))[0];
    const resto = candidatos.filter((p) => p !== principal && p.categoria !== principal?.categoria);
    const oferta = resto.find((p) => p.descuento_porcentaje > 0);
    const otro = resto.find((p) => p !== oferta && p.categoria !== oferta?.categoria);
    return { principal, secundarios: [oferta, otro].filter(Boolean) };
  }, [productos]);

  const marcas = useMemo(() => new Set(productos.map((p) => p.marca).filter(Boolean)).size, [productos]);
  const { principal, secundarios } = vitrina;

  return (
    <section className="ini-hero" aria-labelledby="ini-hero-titulo">
      <div className="ini-hero-fondo" aria-hidden="true" />
      <div className="contenedor ini-hero-grid">
        <div className="ini-hero-texto">
          <p className="ini-eyebrow">{t(idioma, "ini.eyebrow")}</p>
          <h1 id="ini-hero-titulo">{t(idioma, "ini.titulo")}</h1>
          <p className="ini-bajada">{t(idioma, "ini.bajada")}</p>
          <div className="ini-ctas">
            <Link to="/productos" className="btn-primary ini-cta">
              {t(idioma, "ini.verCatalogo")} <FaArrowRight aria-hidden="true" />
            </Link>
            <Link to="/armar" className="btn-fantasma ini-cta">
              <FaScrewdriverWrench aria-hidden="true" /> {t(idioma, "cat.arma")}
            </Link>
          </div>
          {!cargando && productos.length > 0 && (
            <dl className="ini-cifras">
              <div>
                <dt>{t(idioma, "ini.productos")}</dt>
                <dd>{productos.length}</dd>
              </div>
              <div>
                <dt>{t(idioma, "ini.marcas")}</dt>
                <dd>{marcas}</dd>
              </div>
              <div>
                <dt>{t(idioma, "ini.envios")}</dt>
                <dd>{t(idioma, "ini.todoElPais")}</dd>
              </div>
            </dl>
          )}
        </div>

        <div className="ini-vitrina" aria-hidden={!principal}>
          {principal ? (
            <>
              <Link to={`/producto/${principal.id}`} className="ini-vitrina-principal">
                <FotoPozo producto={principal} tamanos="(min-width: 1024px) 420px, 80vw" prioridad />
                <span className="ini-vitrina-info">
                  <span className="ini-vitrina-marca">{principal.marca}</span>
                  <span className="ini-vitrina-nombre">{principal.nombre}</span>
                  <span className="ini-vitrina-precio">{formatearPesos(precioFinal(principal))}</span>
                </span>
              </Link>
              {secundarios.map((p) => (
                <Link key={p.id} to={`/producto/${p.id}`} className="ini-vitrina-mini">
                  <FotoPozo producto={p} tamanos="160px" />
                  <span className="ini-vitrina-info">
                    <span className="ini-vitrina-nombre">{p.nombre}</span>
                    <span className="ini-vitrina-precio">{formatearPesos(precioFinal(p))}</span>
                  </span>
                </Link>
              ))}
            </>
          ) : (
            <span className="ini-vitrina-esqueleto" />
          )}
        </div>
      </div>
    </section>
  );
}

function Beneficios({ idioma }) {
  const items = [
    { icono: FaCreditCard, titulo: "promo.cuotasT", texto: "promo.cuotasS" },
    { icono: FaMoneyBillTransfer, titulo: "promo.offT", texto: "promo.offS" },
    { icono: FaTruckFast, titulo: "promo.envioT", texto: "promo.envioS" },
    { icono: FaStore, titulo: "promo.retiroT", texto: "promo.retiroS" },
  ];
  return (
    <section className="contenedor" aria-label={t(idioma, "promo.aria")}>
      <Revelar as="ul" escalonado className="ini-beneficios">
        {items.map(({ icono: Icono, titulo, texto }) => (
          <li key={titulo}>
            <span className="ini-beneficio-icono" aria-hidden="true">
              {Icono === FaTruckFast ? <CamionEnvio /> : <Icono />}
            </span>
            <span>
              <strong>{t(idioma, titulo)}</strong>
              <span>{t(idioma, texto)}</span>
            </span>
          </li>
        ))}
      </Revelar>
    </section>
  );
}

// Banner de ofertas destacadas: fondo con brillo en movimiento, texto a la
// izquierda y las tres mejores ofertas reales como tarjetas blancas con el
// ahorro marcado. Sin ofertas cargadas, no se dibuja.
function BannerOfertas({ ofertas, agregarAlCarrito, idioma }) {
  const top = useMemo(
    () =>
      [...ofertas]
        .filter(conFoto)
        .sort((a, b) => (b.precio - precioFinal(b)) - (a.precio - precioFinal(a)))
        .slice(0, 3),
    [ofertas]
  );
  if (top.length === 0) return null;

  return (
    <section className="contenedor ini-seccion" aria-labelledby="ini-banner-ofertas">
      <div className="bof">
        <span className="bof-aurora" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <div className="bof-texto">
          <span className="bof-marca" aria-hidden="true">
            <FaBolt />
          </span>
          <p className="bof-kicker">{t(idioma, "bof.kicker")}</p>
          <h2 id="ini-banner-ofertas">{t(idioma, "bof.titulo")}</h2>
          <Link to={linkOfertas} className="bof-cta">
            {t(idioma, "bof.cta")} <FaArrowRight aria-hidden="true" />
          </Link>
        </div>
        <ul className="bof-tarjetas">
          {top.map((p, i) => {
            const final = precioFinal(p);
            const ahorro = Math.max(0, Number(p.precio) - final);
            return (
              <li key={p.id} style={{ "--i": i }}>
                <Link to={`/producto/${p.id}`} className="bof-tarjeta">
                  <span className="bof-foto">
                    <img src={p.imagen} alt="" width="400" height="400" loading="lazy" decoding="async" />
                  </span>
                  <span className="bof-marca-prod">{p.marca}</span>
                  <span className="bof-nombre">{p.nombre}</span>
                  <span className="bof-precios">
                    <s>{formatearPesos(p.precio)}</s>
                    {ahorro > 0 && <span className="bof-ahorro">-{formatearPesos(ahorro)}</span>}
                  </span>
                  <strong className="bof-precio">{formatearPesos(final)}</strong>
                </Link>
                {agregarAlCarrito && (
                  <button
                    type="button"
                    className="bof-agregar"
                    onClick={() => agregarAlCarrito(p)}
                    aria-label={`${t(idioma, "bof.agregar")}: ${p.nombre}`}
                  >
                    <FaCartPlus aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Categorias({ productos, idioma }) {
  const tarjetas = useMemo(
    () =>
      CATEGORIAS_HOME.map((slug) => {
        const cat = CATEGORIAS.find((c) => c.slug === slug);
        const deLaCategoria = productos.filter((p) => p.categoria === cat.db);
        return {
          ...cat,
          conteo: deLaCategoria.length,
          foto: deLaCategoria.find((p) => conFoto(p) && vendible(p)) ?? deLaCategoria.find(conFoto),
        };
      }).filter((c) => c.conteo > 0),
    [productos]
  );

  if (tarjetas.length === 0) return null;

  return (
    <section className="contenedor ini-seccion" aria-labelledby="ini-categorias">
      <SectionHeader
        kicker={t(idioma, "ini.categoriasKicker")}
        titulo={t(idioma, "ini.categoriasTitulo")}
        id="ini-categorias"
        verTodo="/productos"
      />
      <Revelar as="ul" escalonado className="ini-categorias">
        {tarjetas.map((c) => (
          <li key={c.slug}>
            <Link to={linkCategoria(c.slug)} className="ini-categoria">
              <span className="ini-categoria-texto">
                <strong>{nombreCategoria(c, idioma)}</strong>
                <span>
                  {c.conteo} {c.conteo === 1 ? t(idioma, "catl.producto") : t(idioma, "catl.productos")}
                </span>
              </span>
              <FotoPozo producto={c.foto} tamanos="96px" />
            </Link>
          </li>
        ))}
      </Revelar>
    </section>
  );
}

function Promos({ productos, idioma }) {
  const piezas = useMemo(() => {
    const una = (db) => productos.find((p) => p.categoria === db && conFoto(p));
    return [una("Procesador"), una("Placa de video"), una("Memoria RAM")].filter(Boolean);
  }, [productos]);

  return (
    <section className="contenedor ini-seccion" aria-label={t(idioma, "ini.promosAria")}>
      <Revelar escalonado className="ini-promos">
        <Link to="/armar" className="ini-promo ini-promo--armar">
          <span className="ini-promo-texto">
            <span className="ini-eyebrow">{t(idioma, "ini.armarKicker")}</span>
            <strong>{t(idioma, "ini.armarTitulo")}</strong>
            <span>{t(idioma, "ini.armarTexto")}</span>
            <span className="ini-promo-cta">
              {t(idioma, "ini.armarCta")} <FaArrowRight aria-hidden="true" />
            </span>
          </span>
          {piezas.length > 0 && (
            <span className="ini-promo-piezas" aria-hidden="true">
              {piezas.map((p) => (
                <FotoPozo key={p.id} producto={p} tamanos="120px" />
              ))}
            </span>
          )}
        </Link>
        <a
          href={whatsappUrl(t(idioma, "ini.asesorMensaje"))}
          target="_blank"
          rel="noopener noreferrer"
          className="ini-promo ini-promo--asesor"
        >
          <span className="ini-promo-texto">
            <span className="ini-eyebrow">{t(idioma, "ini.asesorKicker")}</span>
            <strong>{t(idioma, "ini.asesorTitulo")}</strong>
            <span>{t(idioma, "ini.asesorTexto")}</span>
            <span className="ini-promo-cta">
              <FaWhatsapp aria-hidden="true" /> {t(idioma, "ini.asesorCta")}
            </span>
          </span>
        </a>
      </Revelar>
    </section>
  );
}

function Marcas({ productos, idioma }) {
  const marcas = useMemo(() => {
    const conteo = new Map();
    for (const p of productos) {
      const m = (p.marca ?? "").trim();
      if (m && !m.includes("(")) conteo.set(m, (conteo.get(m) ?? 0) + 1);
    }
    return [...conteo.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
      .slice(0, 12)
      .map(([nombre]) => nombre);
  }, [productos]);

  if (marcas.length === 0) return null;

  return (
    <section className="contenedor ini-seccion" aria-labelledby="ini-marcas">
      <SectionHeader kicker={t(idioma, "ini.marcasKicker")} titulo={t(idioma, "ini.marcasTitulo")} id="ini-marcas" />
      <div className="cinta">
        <div className="cinta-pista">
          <ul className="ini-marcas">
            {marcas.map((m) => (
              <li key={m}>
                <Link to={`/productos?marca=${encodeURIComponent(m)}`}>{m}</Link>
              </li>
            ))}
          </ul>
          {/* Copia para que la cinta gire sin corte; fuera del árbol accesible. */}
          <ul className="ini-marcas" aria-hidden="true">
            {marcas.map((m) => (
              <li key={m}>
                <Link to={`/productos?marca=${encodeURIComponent(m)}`} tabIndex={-1}>{m}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Home({ agregarAlCarrito }) {
  const idioma = useIdiomaStore((s) => s.idioma);
  const { productos, cargando, error, reintentar } = useCatalogo();

  const ofertas = useMemo(
    () => productos.filter((p) => p.descuento_porcentaje > 0 && vendible(p)).slice(0, 10),
    [productos]
  );
  // Destacados marcados por el comercio primero; se completa con lo que
  // tiene precio y stock para no dejar la grilla corta.
  const destacados = useMemo(() => {
    const vendibles = productos.filter(vendible);
    const marcados = vendibles.filter((p) => p.destacado);
    const resto = vendibles.filter((p) => !p.destacado && !ofertas.includes(p));
    return [...marcados, ...resto].slice(0, 8);
  }, [productos, ofertas]);

  return (
    <div className="ini">
      <Hero productos={productos} cargando={cargando} idioma={idioma} />
      <Beneficios idioma={idioma} />

      {error && !cargando ? (
        <div className="contenedor ini-seccion">
          <div className="vacio" role="alert">
            <p className="vacio-titulo">{t(idioma, "home.errorTitulo")}</p>
            <p className="vacio-texto">{t(idioma, "home.errorTexto")}</p>
            <button type="button" className="btn-primary" onClick={reintentar}>
              {t(idioma, "home.reintentar")}
            </button>
          </div>
        </div>
      ) : cargando && productos.length === 0 ? (
        <div className="contenedor ini-seccion" aria-busy="true">
          <p className="sr-only" role="status">
            {t(idioma, "home.cargandoProd")}
          </p>
          <div className="ini-grilla" aria-hidden="true">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="card-skeleton" />
            ))}
          </div>
        </div>
      ) : (
        <>
          <Categorias productos={productos} idioma={idioma} />

          <BannerOfertas ofertas={ofertas} agregarAlCarrito={agregarAlCarrito} idioma={idioma} />

          <div className="contenedor ini-seccion">
            <ProductCarousel
              titulo={t(idioma, "ini.ofertasTitulo")}
              kicker={t(idioma, "ini.ofertasKicker")}
              verTodo={linkOfertas}
              productos={ofertas}
              agregarAlCarrito={agregarAlCarrito}
            />
          </div>

          <Promos productos={productos} idioma={idioma} />

          {destacados.length > 0 && (
            <section className="contenedor ini-seccion" aria-labelledby="ini-destacados">
              <SectionHeader
                kicker={t(idioma, "ini.destacadosKicker")}
                titulo={t(idioma, "ini.destacadosTitulo")}
                id="ini-destacados"
                verTodo="/productos"
              />
              <Revelar as="ul" escalonado className="ini-grilla">
                {destacados.map((p) => (
                  <li key={p.id}>
                    <ProductCard producto={p} agregarAlCarrito={agregarAlCarrito} />
                  </li>
                ))}
              </Revelar>
            </section>
          )}

          <Marcas productos={productos} idioma={idioma} />
        </>
      )}
    </div>
  );
}

export default Home;
