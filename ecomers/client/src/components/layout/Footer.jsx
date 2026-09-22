import { Link } from "react-router-dom";

import {
  FaLocationDot,
  FaPhone,
  FaEnvelope,
  FaFacebook,
  FaInstagram,
  FaWhatsapp
} from "react-icons/fa6";

import {
  FaCcVisa,
  FaCcMastercard
} from "react-icons/fa";

import "./Footer.css";


function Footer() {

  return (

    <footer className="footer">


      <div className="footer-content">


        <div className="footer-col footer-brand">

          <h3>
            Tienda de Hardware
          </h3>


          <p>
            Componentes, periféricos y PCs armadas con garantía oficial.
            Equipá tu setup con productos de calidad.
          </p>


          <div className="redes">

            <a href="#">
              <FaFacebook />
            </a>

            <a href="#">
              <FaInstagram />
            </a>

            <a href="#">
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
              <Link to="/acerca">
                Nosotros
              </Link>
            </li>


            <li>
              <Link to="/contactanos">
                Contacto
              </Link>
            </li>


            <li>
              <Link to="/arma-tu-pc">
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
              <Link to="/envios">
                Envíos
              </Link>
            </li>


            <li>
              <Link to="/cambios-devoluciones">
                Cambios y devoluciones
              </Link>
            </li>


            <li>
              <Link to="/preguntas-frecuentes">
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

              <FaLocationDot />

              Salta Capital, Argentina

            </li>



            <li>

              <FaPhone />

              +54 11 1234-5678

            </li>




            <li>

              <FaEnvelope />

              contacto@hefestotech.com

            </li>


          </ul>




          <div className="pagos">

            <FaCcVisa />

            <FaCcMastercard />

          </div>



        </div>



      </div>





      <div className="footer-bottom">

        <p>
          © {new Date().getFullYear()} Tienda de Hardware • Todos los derechos reservados
        </p>

      </div>


    </footer>

  );

}


export default Footer;