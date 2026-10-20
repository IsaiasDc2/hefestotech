import { useState } from "react";
import { FaEnvelope, FaPhone, FaLocationDot, FaClock, FaUser, FaTag, FaMessage, FaWhatsapp } from "react-icons/fa6";
import { whatsappUrl } from "../../constants/whatsapp";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import "./Contacto.css"

function Contactanos() {
  const idioma = useIdiomaStore((s) => s.idioma);
  const WHATSAPP_GENERAL = t(idioma, "wa.general");
  const WHATSAPP_CANALES = [
    {
      id: "ventas",
      titulo: t(idioma, "cont.ventasT"),
      detalle: t(idioma, "cont.ventasD"),
      mensaje: t(idioma, "wa.ventas"),
    },
    {
      id: "soporte",
      titulo: t(idioma, "cont.sopT"),
      detalle: t(idioma, "cont.sopD"),
      mensaje: t(idioma, "wa.soporte"),
    },
    {
      id: "pedido",
      titulo: t(idioma, "cont.pedT"),
      detalle: t(idioma, "cont.pedD"),
      mensaje: t(idioma, "wa.pedido"),
    },
  ];
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
      setErrorEnvio(t(idioma, "cont.error"));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="contacto-container">
      <header className="contacto-hero anim-entrada">
        <p className="badge badge-info hero-kicker">{t(idioma, "cont.kicker")}</p>
        <h1>{t(idioma, "cont.titulo")}</h1>
        <p>
          {t(idioma, "cont.sub")}
        </p>
      </header>

      <div className="contacto-grid">
        <aside className="contacto-info card" aria-label={t(idioma, "cont.datos")}>
          <div className="info-item">
            <FaEnvelope className="info-icono" aria-hidden="true" />
            <div>
              <h3>{t(idioma, "cont.email")}</h3>
              <p>contacto@hefestotech.com</p>
            </div>
          </div>

          <div className="info-item">
            <FaPhone className="info-icono" aria-hidden="true" />
            <div>
              <h3>{t(idioma, "cont.telefono")}</h3>
              <p>+54 11 1234-5678</p>
            </div>
          </div>

          <div className="info-item">
            <FaLocationDot className="info-icono" aria-hidden="true" />
            <div>
              <h3>{t(idioma, "cont.ubicacion")}</h3>
              <p>Salta Capital, Argentina</p>
            </div>
          </div>

          <div className="info-item">
            <FaClock className="info-icono" aria-hidden="true" />
            <div>
              <h3>{t(idioma, "cont.horario")}</h3>
              <p>{t(idioma, "cont.horarioV")}</p>
            </div>
          </div>

          <div className="contacto-whatsapp">
            <div className="contacto-whatsapp-encabezado">
              <span className="contacto-whatsapp-icono" aria-hidden="true">
                <FaWhatsapp />
              </span>
              <div>
                <h3>{t(idioma, "cont.wa")}</h3>
                <p>{t(idioma, "cont.waSub")}</p>
              </div>
            </div>

            <a
              className="contacto-whatsapp-cta"
              href={whatsappUrl(WHATSAPP_GENERAL)}
              target="_blank"
              rel="noreferrer"
            >
              <FaWhatsapp aria-hidden="true" />
              {t(idioma, "cont.waCta")}
            </a>

            <ul className="contacto-whatsapp-canales" aria-label={t(idioma, "cont.waCanales")}>
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
                    <span className="contacto-whatsapp-canal-accion" aria-hidden="true">{t(idioma, "cont.abrirChat")} →</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <form className="formulario card anim-entrada" onSubmit={handleSubmit}>
          <p className="badge badge-aviso">{t(idioma, "cont.soporte")}</p>
          <h2>{t(idioma, "cont.formT")}</h2>

          <div className="grupo">
            <label htmlFor="nombre">{t(idioma, "cont.nombre")}</label>
            <div className="input-con-icono">
              <FaUser className="input-icono" aria-hidden="true" />
              <input
                id="nombre"
                name="nombre"
                type="text"
                placeholder={t(idioma, "cont.nombrePh")}
                required
                minLength={3}
              />
            </div>
          </div>

          <div className="grupo">
            <label htmlFor="email">{t(idioma, "cont.emailL")}</label>
            <div className="input-con-icono">
              <FaEnvelope className="input-icono" aria-hidden="true" />
              <input
                id="email"
                name="email"
                type="email"
                placeholder={t(idioma, "cont.emailPh")}
                required
              />
            </div>
          </div>

          <div className="grupo">
            <label htmlFor="asunto">{t(idioma, "cont.asunto")}</label>
            <div className="input-con-icono">
              <FaTag className="input-icono" aria-hidden="true" />
              <input
                id="asunto"
                name="asunto"
                type="text"
                placeholder={t(idioma, "cont.asuntoPh")}
                required
                minLength={5}
              />
            </div>
          </div>

          <div className="grupo">
            <label htmlFor="mensaje">{t(idioma, "cont.mensaje")}</label>
            <div className="input-con-icono input-con-icono-area">
              <FaMessage className="input-icono" aria-hidden="true" />
              <textarea
                id="mensaje"
                name="mensaje"
                placeholder={t(idioma, "cont.mensajePh")}
                rows={5}
                required
                minLength={10}
              ></textarea>
            </div>
          </div>

          {enviando && (
            <div className="contacto-cargando" role="status">
              <span className="sr-only">{t(idioma, "cont.enviando")}</span>
              <span className="skeleton" aria-hidden="true" />
              <span className="skeleton" aria-hidden="true" />
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={enviando}>
            {enviando ? t(idioma, "cont.enviando") : `${t(idioma, "cont.enviar")} →`}
          </button>

          {enviado && (
            <p className="badge badge-ok mensaje-exito" role="status">
              {t(idioma, "cont.ok")}
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
