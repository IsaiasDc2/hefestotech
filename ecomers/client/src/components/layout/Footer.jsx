import { useState } from "react";
import { Link } from "react-router-dom";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import Marca from "../brand/Marca";

import {
  FaLocationDot,
  FaPhone,
  FaEnvelope,
  FaFacebook,
  FaInstagram,
  FaWhatsapp,
  FaPaperPlane,
  FaCircleCheck,
  FaShieldHalved,
  FaTruckFast,
} from "react-icons/fa6";

import {
  FaCcVisa,
  FaCcMastercard
} from "react-icons/fa";

import "./Footer.css";


function Footer() {
  const [email, setEmail] = useState("");
  const [suscrito, setSuscrito] = useState(false);
  const idioma = useIdiomaStore((s) => s.idioma);

  const suscribir = (e) => {
    e.preventDefault();
    if (email.trim().length > 3 && email.includes("@")) {
      setSuscrito(true);
    }
  };

  return (

    <footer className="footer">


      <div className="footer-news">
        <div className="footer-news-inner">
          <div className="footer-news-texto">
            <h3>
              {t(idioma, "ft.newsTitulo")}
            </h3>
            <p>
              {t(idioma, "ft.newsTexto")}
            </p>
          </div>
          {suscrito ? (
            <p className="footer-news-ok" role="status">
              <FaCircleCheck aria-hidden="true" />
              {t(idioma, "ft.newsOk")}
            </p>
          ) : (
            <form className="footer-news-form" onSubmit={suscribir}>
              <label className="sr-only" htmlFor="newsletter-email">
                {t(idioma, "ft.newsEmail")}
              </label>
              <input
                id="newsletter-email"
                type="email"
                required
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button type="submit">
                <FaPaperPlane aria-hidden="true" />
                {t(idioma, "ft.suscribir")}
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="footer-content">


        <div className="footer-col footer-brand">

          <p className="footer-marca">
            <Marca variante="lockup" ancho={190} alto={148} alt="HefestoTech" />
            <span className="sr-only">HefestoTech</span>
          </p>


          <p>
            {t(idioma, "ft.marcaTexto")}
          </p>

          <ul className="footer-confianza">
            <li>
              <FaShieldHalved aria-hidden="true" />
              {t(idioma, "ft.garantia")}
            </li>
            <li>
              <FaTruckFast aria-hidden="true" />
              {t(idioma, "ft.envioPais")}
            </li>
          </ul>


          <div className="redes">

            <a
              href="https://facebook.com/hefestotech"
              target="_blank"
              rel="noreferrer"
              aria-label="Facebook"
            >
              <FaFacebook />
            </a>

            <a
              href="https://instagram.com/hefestotech"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
            >
              <FaInstagram />
            </a>

            <a
              href="https://wa.me/5491112345678"
              target="_blank"
              rel="noreferrer"
              aria-label="WhatsApp"
            >
              <FaWhatsapp />
            </a>

          </div>


        </div>




        <div className="footer-col">

          <h4>
            {t(idioma, "ft.nav")}
          </h4>


          <ul>


            <li>
              <Link to="/">
                {t(idioma, "ft.inicio")}
              </Link>
            </li>


            <li>
              <Link to="/productos">
                {t(idioma, "ft.productos")}
              </Link>
            </li>


            <li>
              <Link to="/cuenta">
                {t(idioma, "ft.cuenta")}
              </Link>
            </li>


            <li>
              <Link to="/contactanos">
                {t(idioma, "ft.arma")}
              </Link>
            </li>


          </ul>


        </div>




        <div className="footer-col">

          <h4>
            {t(idioma, "ft.ayuda")}
          </h4>


          <ul>

            <li>
              <Link to="/acerca">
                {t(idioma, "ft.ayudaLink")}
              </Link>
            </li>

            <li>
              <Link to="/contactanos">
                {t(idioma, "ft.posventa")}
              </Link>
            </li>

            <li>
              <Link to="/contactanos">
                {t(idioma, "ft.envios")}
              </Link>
            </li>


            <li>
              <Link to="/contactanos">
                {t(idioma, "ft.cambios")}
              </Link>
            </li>


            <li>
              <Link to="/acerca">
                {t(idioma, "ft.faq")}
              </Link>
            </li>


          </ul>


        </div>




        <div className="footer-col">


          <h4>
            {t(idioma, "ft.contacto")}
          </h4>



          <ul className="contacto-lista">


            <li>

              <FaLocationDot aria-hidden="true" />

              Salta Capital, Argentina

            </li>



            <li>

              <FaPhone aria-hidden="true" />

              +54 11 1234-5678

            </li>




            <li>

              <FaEnvelope aria-hidden="true" />

              contacto@hefestotech.com

            </li>


          </ul>



          <div className="pagos" aria-label={t(idioma, "ft.pagos")}>

            <FaCcVisa aria-label="Visa" />

            <FaCcMastercard aria-label="Mastercard" />

            <span className="pago-pill">Mercado Pago</span>
            <span className="pago-pill">Transferencia</span>

          </div>



        </div>



      </div>




      <div className="footer-bottom">

        <p>
          © {new Date().getFullYear()} Tienda de Hardware • {t(idioma, "ft.derechos")}
        </p>
        <p className="footer-bottom-sub">
          <Link to="/acerca">{t(idioma, "ft.nosotros")}</Link>
          <span aria-hidden="true">•</span>
          <Link to="/contactanos">{t(idioma, "ft.contactanos")}</Link>
          <span aria-hidden="true">•</span>
          <span>{t(idioma, "ft.hechoEn")}</span>
        </p>

      </div>


    </footer>

  );

}


export default Footer;
