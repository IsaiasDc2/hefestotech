import { useState } from "react";
import { Link } from "react-router";
import {
  FaLocationDot,
  FaEnvelope,
  FaFacebook,
  FaInstagram,
  FaWhatsapp,
  FaCircleCheck,
  FaArrowRight,
} from "react-icons/fa6";
import { FaCcVisa, FaCcMastercard } from "react-icons/fa";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import Marca from "../brand/Marca";
import { WHATSAPP_URL } from "../../constants/whatsapp";
import { linkOfertas } from "../../constants/categorias";
import { IDIOMAS } from "./navLinks";
import "./Footer.css";

const ANIO = new Date().getFullYear();

function Newsletter({ idioma }) {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState("inicial");

  const suscribir = async (e) => {
    e.preventDefault();
    if (!(email.trim().length > 3 && email.includes("@")) || estado === "enviando") return;
    setEstado("enviando");
    try {
      const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";
      const respuesta = await fetch(`${API_URL}/api/newsletter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!respuesta.ok) throw new Error();
      setEstado("ok");
    } catch {
      setEstado("error");
    }
  };

  return (
    <section className="ft-news" aria-labelledby="ft-news-titulo">
      <div>
        <h2 id="ft-news-titulo">{t(idioma, "ft.newsTitulo")}</h2>
        <p>{t(idioma, "ft.newsTextoCorto")}</p>
      </div>
      {estado === "ok" ? (
        <p className="ft-news-ok" role="status">
          <FaCircleCheck aria-hidden="true" />
          {t(idioma, "ft.newsOk")}
        </p>
      ) : (
        <form className="ft-news-form" onSubmit={suscribir}>
          <label className="sr-only" htmlFor="newsletter-email">
            {t(idioma, "ft.newsEmail")}
          </label>
          <input
            id="newsletter-email"
            type="email"
            autoComplete="email"
            required
            placeholder={t(idioma, "ft.newsPh")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={estado === "error" || undefined}
            aria-describedby={estado === "error" ? "newsletter-error" : undefined}
          />
          <button type="submit" disabled={estado === "enviando"}>
            {t(idioma, "ft.suscribir")} <FaArrowRight aria-hidden="true" />
          </button>
          {estado === "error" && (
            <p id="newsletter-error" className="ft-news-error" role="alert">
              {t(idioma, "ft.newsError")}
            </p>
          )}
        </form>
      )}
    </section>
  );
}

function Footer() {
  const idioma = useIdiomaStore((s) => s.idioma);
  const setIdioma = useIdiomaStore((s) => s.setIdioma);

  return (
    <footer className="ft">
      <div className="contenedor">
        <Newsletter idioma={idioma} />

        <div className="ft-columnas">
          <div className="ft-marca">
            <Link to="/" className="ft-logo" aria-label={t(idioma, "nav.logoAria")}>
              <Marca variante="simbolo" ancho={32} alto={32} alt="" decorativa />
              <span>
                Hefesto<b>Tech</b>
              </span>
            </Link>
            <p>{t(idioma, "ft.marcaTexto")}</p>
            <div className="ft-redes">
              <a href="https://facebook.com/hefestotech" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                <FaFacebook aria-hidden="true" />
              </a>
              <a href="https://instagram.com/hefestotech" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                <FaInstagram aria-hidden="true" />
              </a>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
                <FaWhatsapp aria-hidden="true" />
              </a>
            </div>
          </div>

          <nav className="ft-col" aria-labelledby="ft-tienda">
            <h2 id="ft-tienda">{t(idioma, "ft.nav")}</h2>
            <ul>
              <li><Link to="/productos">{t(idioma, "ft.productos")}</Link></li>
              <li><Link to={linkOfertas}>{t(idioma, "cat.outlet")}</Link></li>
              <li><Link to="/armar">{t(idioma, "cat.arma")}</Link></li>
              <li><Link to="/cuenta">{t(idioma, "ft.cuenta")}</Link></li>
            </ul>
          </nav>

          <nav className="ft-col" aria-labelledby="ft-ayuda">
            <h2 id="ft-ayuda">{t(idioma, "ft.ayuda")}</h2>
            <ul>
              <li><Link to="/contactanos">{t(idioma, "ft.envios")}</Link></li>
              <li><Link to="/contactanos">{t(idioma, "ft.cambios")}</Link></li>
              <li><Link to="/acerca">{t(idioma, "ft.faq")}</Link></li>
              <li><Link to="/reclamo">{t(idioma, "recl.titulo")}</Link></li>
            </ul>
          </nav>

          <div className="ft-col">
            <h2>{t(idioma, "ft.contacto")}</h2>
            <ul className="ft-contacto">
              <li>
                <FaLocationDot aria-hidden="true" /> Salta Capital, Argentina
              </li>
              <li>
                <FaWhatsapp aria-hidden="true" />
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">WhatsApp</a>
              </li>
              <li>
                <FaEnvelope aria-hidden="true" />
                <a href="mailto:contacto@hefestotech.com">contacto@hefestotech.com</a>
              </li>
            </ul>
            <ul className="ft-pagos" aria-label={t(idioma, "ft.pagos")}>
              <li><FaCcVisa aria-label="Visa" role="img" /></li>
              <li><FaCcMastercard aria-label="Mastercard" role="img" /></li>
              <li className="ft-pago-texto">Mercado Pago</li>
              <li className="ft-pago-texto">{t(idioma, "ft.transferencia")}</li>
            </ul>
          </div>
        </div>

        <div className="ft-base">
          <p>
            © {ANIO} HefestoTech · {t(idioma, "ft.derechos")}
          </p>
          <div className="ft-base-links">
            <Link to="/acerca">{t(idioma, "ft.nosotros")}</Link>
            <Link to="/contactanos">{t(idioma, "ft.contactanos")}</Link>
            <span className="ft-idiomas" role="group" aria-label={t(idioma, "topbar.idioma")}>
              {IDIOMAS.map((op) => (
                <button
                  key={op.codigo}
                  type="button"
                  aria-pressed={idioma === op.codigo}
                  onClick={() => setIdioma(op.codigo)}
                >
                  {op.codigo.toUpperCase()}
                </button>
              ))}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
