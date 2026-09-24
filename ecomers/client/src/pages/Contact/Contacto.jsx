import { useState } from "react";
import { FaEnvelope, FaPhone, FaLocationDot, FaClock } from "react-icons/fa6";
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
      <header className="contacto-hero">
        <h1>Contactanos</h1>
        <p>
          ¿Tenés dudas sobre un producto o necesitás ayuda para armar tu
          PC? Escribinos, te respondemos en menos de 24hs.
        </p>
      </header>

      <div className="contacto-grid">
        <aside className="contacto-info">
          <div className="info-item">
            <FaEnvelope className="info-icono" />
            <div>
              <h3>Email</h3>
              <p>soporte@hefestotech.com</p>
            </div>
          </div>

          <div className="info-item">
            <FaPhone className="info-icono" />
            <div>
              <h3>Teléfono</h3>
              <p>+54 11 4000-0000</p>
            </div>
          </div>

          <div className="info-item">
            <FaLocationDot className="info-icono" />
            <div>
              <h3>Ubicación</h3>
              <p>Buenos Aires, Argentina</p>
            </div>
          </div>

          <div className="info-item">
            <FaClock className="info-icono" />
            <div>
              <h3>Horario de atención</h3>
              <p>Lun a Vie, 9 a 18hs</p>
            </div>
          </div>
        </aside>

        <form className="formulario" onSubmit={handleSubmit}>
          <h2>Envianos tu consulta</h2>

          <div className="grupo">
            <label htmlFor="nombre">Nombre completo</label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              placeholder="Tu nombre"
              required
              minLength={3}
            />
          </div>

          <div className="grupo">
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="tu@email.com"
              required
            />
          </div>

          <div className="grupo">
            <label htmlFor="asunto">Asunto</label>
            <input
              id="asunto"
              name="asunto"
              type="text"
              placeholder="¿En qué te podemos ayudar?"
              required
              minLength={5}
            />
          </div>

          <div className="grupo">
            <label htmlFor="mensaje">Mensaje</label>
            <textarea
              id="mensaje"
              name="mensaje"
              placeholder="Contanos los detalles de tu consulta..."
              rows={5}
              required
              minLength={10}
            ></textarea>
          </div>

          <button type="submit" disabled={enviando}>
            {enviando ? "Enviando..." : "Enviar mensaje →"}
          </button>

          {enviado && (
            <p className="mensaje-exito">
              ¡Gracias! Tu mensaje fue enviado correctamente.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

export default Contactanos;