import { useEffect, useState } from "react";
import { FaRobot, FaXmark, FaArrowRight } from "react-icons/fa6";
import "./Asistente.css";

function Asistente() {
  const [abierto, setAbierto] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [chat, setChat] = useState([
    { rol: "ia", texto: "¡Hola! Soy Hefesto. ¿En qué te ayudo con tu setup?" },
  ]);

  const enviarMensaje = async (e) => {
    e.preventDefault();
    if (!mensaje.trim()) return;

    const nuevoChat = [...chat, { rol: "usuario", texto: mensaje }];
    setChat(nuevoChat);
    setMensaje("");

    try {
      const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";
      const respuesta = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: mensaje }),
      });

      const data = await respuesta.json();

      setChat([...nuevoChat, { rol: "ia", texto: data.respuesta }]);
    } catch (error) {
      setChat([
        ...nuevoChat,
        {
          rol: "ia",
          texto:
            "Mis circuitos están en mantenimiento. Intenta de nuevo más tarde.",
        },
      ]);
    }
  };

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e) => {
      if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  return (
    <div className="asistente">
      {abierto && (
        <div
          className="asistente-panel card"
          role="dialog"
          aria-label="Asistente IA"
        >
          <div className="asistente-head">
            <span className="asistente-avatar" aria-hidden="true">
              <FaRobot />
            </span>
            <div>
              <strong>Asistente Hefesto</strong>
              <span className="asistente-estado">
                <span className="asistente-dot" aria-hidden="true" />
                En línea
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar asistente"
            >
              <FaXmark aria-hidden="true" />
            </button>
          </div>
          <div
            className="asistente-mensajes"
            role="log"
            aria-live="polite"
            aria-label="Conversación con Hefesto"
          >
            {chat.map((msg, i) => (
              <div
                key={i}
                className={`asistente-msg${msg.rol === "ia" ? " es-ia" : " es-usuario"}`}
              >
                {msg.texto}
              </div>
            ))}
          </div>

          <form onSubmit={enviarMensaje} className="asistente-form">
            <input
              type="text"
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Escribí tu consulta…"
              aria-label="Escribí tu consulta"
            />
            <button
              type="submit"
              className="asistente-enviar"
              aria-label="Enviar mensaje"
            >
              <FaArrowRight aria-hidden="true" />
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        className={`asistente-bola${abierto ? " es-abierto" : ""}`}
        onClick={() => setAbierto((v) => !v)}
        aria-label={abierto ? "Cerrar asistente IA" : "Abrir asistente IA"}
        aria-expanded={abierto}
      >
        {abierto ? (
          <FaXmark aria-hidden="true" />
        ) : (
          <FaRobot aria-hidden="true" />
        )}
        {!abierto && <span className="asistente-punto" aria-hidden="true" />}
      </button>
    </div>
  );
}

export default Asistente;
