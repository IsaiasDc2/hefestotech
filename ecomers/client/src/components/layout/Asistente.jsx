import { useState } from "react";
import { FaRobot, FaXmark } from "react-icons/fa6";
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

    // Agregamos lo que el usuario escribió al chat visualmente
    const nuevoChat = [...chat, { rol: "usuario", texto: mensaje }];
    setChat(nuevoChat);
    setMensaje(""); // Limpiamos la barra de texto

    try {
      // Hacemos la petición a tu servidor FastAPI
      const respuesta = await fetch("http://127.0.0.1:8000/api/asistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: mensaje }),
      });

      const data = await respuesta.json();

      // Agregamos la respuesta real de OpenAI al chat
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

          {/* Caja de mensajes dinámicos */}
          <div
            className="asistente-mensajes"
            style={{
              height: "250px",
              overflowY: "auto",
              padding: "15px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {chat.map((msg, i) => (
              <div
                key={i}
                style={{
                  alignSelf: msg.rol === "ia" ? "flex-start" : "flex-end",
                  backgroundColor: msg.rol === "ia" ? "#2a2a2a" : "#0d6efd",
                  color: "white",
                  padding: "10px 14px",
                  borderRadius: "12px",
                  maxWidth: "85%",
                  fontSize: "0.9rem",
                  lineHeight: "1.4",
                }}
              >
                {msg.texto}
              </div>
            ))}
          </div>

          {/* Formulario real que reemplaza a la caja "fake" */}
          <form
            onSubmit={enviarMensaje}
            className="asistente-fake"
            style={{ display: "flex", padding: "0 5px", margin: "10px" }}
          >
            <input
              type="text"
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Escribí tu consulta…"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                color: "white",
                padding: "10px",
                outline: "none",
              }}
            />
            <button
              type="submit"
              className="asistente-enviar"
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                cursor: "pointer",
                fontSize: "1.2rem",
                padding: "0 10px",
              }}
            >
              →
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
