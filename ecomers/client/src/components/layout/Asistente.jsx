import { useState } from "react";
import { FaRobot, FaXmark } from "react-icons/fa6";
import "./Asistente.css";

function Asistente() {
  // Función para generar la fecha y hora en formato "DD/MM HH:MM"
  const obtenerFechaHora = () => {
    const ahora = new Date();
    const dia = String(ahora.getDate()).padStart(2, "0");
    const mes = String(ahora.getMonth() + 1).padStart(2, "0");
    const hora = ahora.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${dia}/${mes} ${hora}`;
  };

  const [abierto, setAbierto] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [chat, setChat] = useState([
    {
      rol: "ia",
      texto: "¡Hola! Soy Hefesto. ¿En qué te ayudo con tu setup?",
      hora: obtenerFechaHora(),
    },
  ]);

  const enviarMensaje = async (e) => {
    e.preventDefault();
    if (!mensaje.trim()) return;

    // Agregamos el mensaje del usuario con su hora exacta
    const nuevoChat = [
      ...chat,
      { rol: "usuario", texto: mensaje, hora: obtenerFechaHora() },
    ];
    setChat(nuevoChat);
    setMensaje(""); // Limpiamos la barra de texto

    try {
      const respuesta = await fetch("http://127.0.0.1:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: mensaje }),
      });

      // Validamos si la IA devuelve exactamente el error 503 (Saturación)
      if (respuesta.status === 503) {
        setChat([
          ...nuevoChat,
          {
            rol: "ia",
            texto:
              "La forja está ardiendo. Hay muchas consultas en este momento, espera un poco y vuelve a intentarlo.",
            hora: obtenerFechaHora(),
          },
        ]);
        return;
      }

      // Si hay un error general del servidor, lo enviamos al catch
      if (!respuesta.ok) {
        throw new Error("Fallo en la comunicación con el servidor");
      }

      const data = await respuesta.json();
      setChat([
        ...nuevoChat,
        { rol: "ia", texto: data.respuesta, hora: obtenerFechaHora() },
      ]);
    } catch (error) {
      // Mensaje temático de reserva por si el backend se cae o la IA no responde
      setChat([
        ...nuevoChat,
        {
          rol: "ia",
          texto:
            "La forja está sobrecargada de trabajo. Espera unos minutos y vuelve a golpear el yunque.",
          hora: obtenerFechaHora(),
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

          <div
            className="asistente-mensajes"
            style={{
              height: "400px",
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
                  display: "flex",
                  flexDirection: "column", // Necesario para que la hora quede debajo del texto
                }}
              >
                <span>{msg.texto}</span>
                {/* Estilos inyectados para la fecha y hora */}
                <span
                  style={{
                    fontSize: "0.7rem",
                    opacity: 0.7,
                    alignSelf: "flex-end",
                    marginTop: "4px",
                  }}
                >
                  {msg.hora}
                </span>
              </div>
            ))}
          </div>

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
