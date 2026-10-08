import { useEffect, useRef, useState } from "react";
import { FaXmark, FaArrowRight } from "react-icons/fa6";
import Marca from "../brand/Marca.jsx";
import "./Asistente.css";

function Asistente() {
  const [abierto, setAbierto] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const botonRef = useRef(null);
  const panelRef = useRef(null);
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
            "Mis circuitos están en mantenimiento. Intentá de nuevo más tarde.",
        },
      ]);
    }
  };

  const yaMonto = useRef(false);
  useEffect(() => {
    if (abierto) {
      panelRef.current?.focus();
    } else if (yaMonto.current) {
      botonRef.current?.focus();
    }
    yaMonto.current = true;
  }, [abierto]);

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
          id="asistente-panelo"
          role="dialog"
          aria-modal="false"
          aria-labelledby="asistente-titulo"
          ref={panelRef}
          tabIndex={-1}
        >
          <div className="asistente-head">
            <span className="asistente-avatar" aria-hidden="true">
              <Marca variante="simbolo" ancho={28} alto={28} decorativa />
            </span>
            <div>
              <strong id="asistente-titulo">Asistente de HefestoTech</strong>
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
                {msg.rol === "ia" && (
                  <span className="asistente-msg-avatar" aria-hidden="true">
                    <Marca variante="simbolo" ancho={20} alto={20} decorativa />
                  </span>
                )}
                <span className="asistente-msg-texto">{msg.texto}</span>
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
        ref={botonRef}
        aria-label={abierto ? "Cerrar asistente de HefestoTech" : "Abrir asistente de HefestoTech"}
        aria-expanded={abierto}
        aria-controls="asistente-panelo"
      >
        {abierto ? (
          <FaXmark aria-hidden="true" />
        ) : (
          <Marca variante="simbolo" ancho={32} alto={32} decorativa />
        )}
        {!abierto && <span className="asistente-punto" aria-hidden="true" />}
      </button>
    </div>
  );
}

export default Asistente;
