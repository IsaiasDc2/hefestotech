import { Link } from "react-router-dom";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import "./Acerca.css";

function Acerca() {
  const idioma = useIdiomaStore((s) => s.idioma);
  return (
    <div className="acerca">
      <header className="acerca-hero anim-entrada">
        <p className="badge badge-info hero-kicker">{t(idioma, "acerca.kicker")}</p>
        <h1>
          {t(idioma, "acerca.de")} <span className="titulo-degradado">HefestoTech</span>
        </h1>
        <p>
          {t(idioma, "acerca.sub")}
        </p>
      </header>

      <section className="acerca-stats" aria-label={t(idioma, "acerca.numeros")}>
        <div className="stat card">
          <strong>5000+</strong>
          <span>{t(idioma, "acerca.clientes")}</span>
        </div>
        <div className="stat card">
          <strong>2020</strong>
          <span>{t(idioma, "acerca.fundacion")}</span>
        </div>
        <div className="stat card">
          <strong>24-48hs</strong>
          <span>{t(idioma, "acerca.envio")}</span>
        </div>
        <div className="stat card">
          <strong>4.8★</strong>
          <span>{t(idioma, "acerca.valoracion")}</span>
        </div>
      </section>

      <section className="acerca-seccion">
        <h2>{t(idioma, "acerca.historia")}</h2>
        <p>
          {t(idioma, "acerca.historiaT")}
        </p>
      </section>

      <section className="acerca-valores">
        <h2>{t(idioma, "acerca.guia")}</h2>

        <div className="valores-grid">
          <div className="valor-card card">
            <span className="valor-icono" aria-hidden="true">01</span>
            <h3>{t(idioma, "acerca.calidad")}</h3>
            <p>
              {t(idioma, "acerca.calidadT")}
            </p>
          </div>

          <div className="valor-card card">
            <span className="valor-icono" aria-hidden="true">02</span>
            <h3>{t(idioma, "acerca.envios")}</h3>
            <p>
              {t(idioma, "acerca.enviosT")}
            </p>
          </div>

          <div className="valor-card card">
            <span className="valor-icono" aria-hidden="true">03</span>
            <h3>{t(idioma, "acerca.soporte")}</h3>
            <p>
              {t(idioma, "acerca.soporteT")}
            </p>
          </div>

          <div className="valor-card card">
            <span className="valor-icono" aria-hidden="true">04</span>
            <h3>{t(idioma, "acerca.precios")}</h3>
            <p>
              {t(idioma, "acerca.preciosT")}
            </p>
          </div>
        </div>
      </section>

      <section className="acerca-cta">
        <div className="acerca-cta-panel card">
          <h2>{t(idioma, "acerca.cta")}</h2>
          <p>{t(idioma, "acerca.ctaT")}</p>
          <div className="acerca-cta-botones">
            <Link to="/productos" className="btn-primary">
              {t(idioma, "acerca.verProd")}
            </Link>
            <Link to="/contactanos" className="btn-fantasma">
              {t(idioma, "acerca.arma")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Acerca;
