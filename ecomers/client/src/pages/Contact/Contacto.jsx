import { useState } from "react";
import { FaEnvelope, FaPhone, FaLocationDot, FaClock, FaUser, FaTag, FaMessage, FaWhatsapp } from "react-icons/fa6";
import { whatsappUrl } from "../../constants/whatsapp";
import "./Contacto.css"

const WHATSAPP_GENERAL = "Hola HefestoTech, ¿me ayudás con una consulta?";
const WHATSAPP_CANALES = [
  {
    id: "ventas",
    titulo: "Ventas",
    detalle: "Asesoramiento para armar tu PC o elegir un producto.",
    mensaje: "Hola, quiero asesoramiento para una compra. ¿Me ayudás?",
  },
  {
    id: "soporte",
    titulo: "Soporte",
    detalle: "Ayuda con tu equipo o tu compra.",
    mensaje: "Hola, necesito soporte con mi equipo. ¿Me ayudás?",
  },
  {
    id: "pedido",
    titulo: "Estado de pedido",
    detalle: "Consultá en qué punto está tu pedido.",
    mensaje: "Hola, quiero consultar el estado de mi pedido.",
  },
];

function Contactanos() {
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setErrorEnvio("");
    try {
      const datos = Object.fromEntries(new FormData(e.target).entries());
      const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";
      const respuesta = await fetch(`${API_URL}/api/contacto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
      if (!respuesta.ok) throw new Error();
      setEnviado(true);
      e.target.reset();
    } catch {
      setErrorEnvio("No pudimos enviar tu mensaje. Probá de nuevo o escribinos por WhatsApp.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="contacto-container">
      <header className="contacto-hero anim-entrada">
        <p className="badge badge-info hero-kicker">Respondemos en menos de 24 hs</p>
        <h1>Contactanos</h1>
        <p>
          ¿Tenés dudas sobre un producto o querés armar tu PC?
          Escribinos y te respondemos en menos de 24 hs.
        </p>
      </header>

      <div className="contacto-grid">
        <aside className="contacto-info card" aria-label="Datos de contacto">
          <div className="info-item">
            <FaEnvelope className="info-icono" aria-hidden="true" />
            <div>
              <h3>Email</h3>
              <p>contacto@hefestotech.com</p>
            </div>
          </div>

          <div className="info-item">
            <FaPhone className="info-icono" aria-hidden="true" />
            <div>
              <h3>Teléfono</h3>
              <p>+54 11 1234-5678</p>
            </div>
          </div>

          <div className="info-item">
            <FaLocationDot className="info-icono" aria-hidden="true" />
            <div>
              <h3>Ubicación</h3>
              <p>Salta Capital, Argentina</p>
            </div>
          </div>

          <div className="info-item">
            <FaClock className="info-icono" aria-hidden="true" />
            <div>
              <h3>Horario de atención</h3>
              <p>Lun a Vie, 9 a 18hs</p>
            </div>
          </div>

          <div className="contacto-whatsapp">
            <div className="contacto-whatsapp-encabezado">
              <span className="contacto-whatsapp-icono" aria-hidden="true">
                <FaWhatsapp />
              </span>
              <div>
                <h3>WhatsApp</h3>
                <p>Escribinos y te respondemos a la brevedad.</p>
              </div>
            </div>

            <a
              className="contacto-whatsapp-cta"
              href={whatsappUrl(WHATSAPP_GENERAL)}
              target="_blank"
              rel="noreferrer"
            >
              <FaWhatsapp aria-hidden="true" />
              Escribinos por WhatsApp
            </a>

            <ul className="contacto-whatsapp-canales" aria-label="Canales de WhatsApp">
              {WHATSAPP_CANALES.map((canal) => (
                <li key={canal.id}>
                  <a
                    className="contacto-whatsapp-canal"
                    href={whatsappUrl(canal.mensaje)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="contacto-whatsapp-canal-titulo">{canal.titulo}</span>
                    <span className="contacto-whatsapp-canal-detalle">{canal.detalle}</span>
                    <span className="contacto-whatsapp-canal-accion" aria-hidden="true">Abrir chat →</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <form className="formulario card anim-entrada" onSubmit={handleSubmit}>
          <p className="badge badge-aviso">HefestoTech · Soporte</p>
          <h2>Envianos tu consulta</h2>

          <div className="grupo">
            <label htmlFor="nombre">Nombre completo</label>
            <div className="input-con-icono">
              <FaUser className="input-icono" aria-hidden="true" />
              <input
                id="nombre"
                name="nombre"
                type="text"
                placeholder="Tu nombre"
                required
                minLength={3}
              />
            </div>
          </div>

          <div className="grupo">
            <label htmlFor="email">Correo electrónico</label>
            <div className="input-con-icono">
              <FaEnvelope className="input-icono" aria-hidden="true" />
              <input
                id="email"
                name="email"
                type="email"
                placeholder="tu@email.com"
                required
              />
            </div>
          </div>

          <div className="grupo">
            <label htmlFor="asunto">Asunto</label>
            <div className="input-con-icono">
              <FaTag className="input-icono" aria-hidden="true" />
              <input
                id="asunto"
                name="asunto"
                type="text"
                placeholder="¿En qué te podemos ayudar?"
                required
                minLength={5}
              />
            </div>
          </div>

          <div className="grupo">
            <label htmlFor="mensaje">Mensaje</label>
            <div className="input-con-icono input-con-icono-area">
              <FaMessage className="input-icono" aria-hidden="true" />
              <textarea
                id="mensaje"
                name="mensaje"
                placeholder="Contanos los detalles de tu consulta..."
                rows={5}
                required
                minLength={10}
              ></textarea>
            </div>
          </div>

          {enviando && (
            <div className="contacto-cargando" aria-hidden="true">
              <span className="skeleton" />
              <span className="skeleton" />
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={enviando}>
            {enviando ? "Enviando..." : "Enviar mensaje →"}
          </button>

          {enviado && (
            <p className="badge badge-ok mensaje-exito" role="status">
              ¡Listo! Recibimos tu mensaje y te respondemos en menos de 24 hs.
            </p>
          )}
          {errorEnvio && (
            <p className="badge badge-peligro" role="alert">
              {errorEnvio}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

export default Contactanos;
