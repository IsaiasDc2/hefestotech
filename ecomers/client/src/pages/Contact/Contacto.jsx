import { useState } from "react";
import { FaEnvelope, FaPhone, FaLocationDot, FaClock, FaUser, FaTag, FaMessage } from "react-icons/fa6";
import "./Contacto.css"

function Contactanos() {
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setEnviando(true);

    setTimeout(() => {
      setEnviando(false);
      setEnviado(true);
      e.target.reset();
    }, 600);
  };

  return (
    <div className="contacto-container">
      <header className="contacto-hero anim-entrada">
        <p className="badge badge-info hero-kicker">Respuesta en menos de 24hs</p>
        <h1>Contactanos</h1>
        <p>
          ¿Tenés dudas sobre un producto o necesitás ayuda para armar tu
          PC? Escribinos, te respondemos en menos de 24hs.
        </p>
      </header>

      <div className="contacto-grid">
        <aside className="contacto-info card" aria-label="Datos de contacto">
          <div className="info-item">
            <FaEnvelope className="info-icono" aria-hidden="true" />
            <div>
              <h3>Email</h3>
              <p>soporte@hefestotech.com</p>
            </div>
          </div>

          <div className="info-item">
            <FaPhone className="info-icono" aria-hidden="true" />
            <div>
              <h3>Teléfono</h3>
              <p>+54 11 4000-0000</p>
            </div>
          </div>

          <div className="info-item">
            <FaLocationDot className="info-icono" aria-hidden="true" />
            <div>
              <h3>Ubicación</h3>
              <p>Buenos Aires, Argentina</p>
            </div>
          </div>

          <div className="info-item">
            <FaClock className="info-icono" aria-hidden="true" />
            <div>
              <h3>Horario de atención</h3>
              <p>Lun a Vie, 9 a 18hs</p>
            </div>
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

          <button type="submit" className="btn-fuego" disabled={enviando}>
            {enviando ? "Enviando..." : "Enviar mensaje →"}
          </button>

          {enviado && (
            <p className="badge badge-ok mensaje-exito" role="status">
              ¡Gracias! Tu mensaje fue enviado correctamente.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

export default Contactanos;
