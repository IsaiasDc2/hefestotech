import { useState } from "react";
import { Link } from "react-router-dom";

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
              Recibí ofertas y novedades
            </h3>
            <p>
              Componentes, periféricos y PCs armadas con garantía oficial.
              Equipá tu setup con productos de calidad.
            </p>
          </div>
          {suscrito ? (
            <p className="footer-news-ok" role="status">
              <FaCircleCheck aria-hidden="true" />
              ¡Listo! Revisá tu correo para confirmar la suscripción.
            </p>
          ) : (
            <form className="footer-news-form" onSubmit={suscribir}>
              <label className="sr-only" htmlFor="newsletter-email">
                Correo electrónico
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
                Suscribirme
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="footer-content">


        <div className="footer-col footer-brand">

          <h3 className="footer-logo">
            Hefesto<span>Tech</span>
          </h3>


          <p>
            Componentes, periféricos y PCs armadas con garantía oficial.
            Equipá tu setup con productos de calidad.
          </p>

          <ul className="footer-confianza">
            <li>
              <FaShieldHalved aria-hidden="true" />
              Garantía oficial
            </li>
            <li>
              <FaTruckFast aria-hidden="true" />
              Envíos a todo el país
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
            Navegación
          </h4>


          <ul>

            <li>
              <Link to="/">
                Inicio
              </Link>
            </li>


            <li>
              <Link to="/productos">
                Productos
              </Link>
            </li>


            <li>
              <Link to="/cuenta">
                Mi cuenta
              </Link>
            </li>


            <li>
              <Link to="/contactanos">
                Armá tu PC
              </Link>
            </li>


          </ul>


        </div>




        <div className="footer-col">

          <h4>
            Ayuda
          </h4>


          <ul>

            <li>
              <Link to="/acerca">
                Ayuda
              </Link>
            </li>

            <li>
              <Link to="/contactanos">
                Posventa
              </Link>
            </li>

            <li>
              <Link to="/contactanos">
                Envíos
              </Link>
            </li>


            <li>
              <Link to="/contactanos">
                Cambios y devoluciones
              </Link>
            </li>


            <li>
              <Link to="/acerca">
                Preguntas frecuentes
              </Link>
            </li>


          </ul>


        </div>




        <div className="footer-col">


          <h4>
            Contacto
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



          <div className="pagos" aria-label="Métodos de pago">

            <FaCcVisa aria-label="Visa" />

            <FaCcMastercard aria-label="Mastercard" />

            <span className="pago-pill">Mercado Pago</span>
            <span className="pago-pill">Transferencia</span>

          </div>



        </div>



      </div>




      <div className="footer-bottom">

        <p>
          © {new Date().getFullYear()} Tienda de Hardware • Todos los derechos reservados
        </p>
        <p className="footer-bottom-sub">
          <Link to="/acerca">Nosotros</Link>
          <span aria-hidden="true">•</span>
          <Link to="/contactanos">Contactanos</Link>
          <span aria-hidden="true">•</span>
          <span>Hecho en Argentina</span>
        </p>

      </div>


    </footer>

  );

}


export default Footer;
