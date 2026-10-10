import { useEffect, useRef, useState } from "react";
import { FaXmark, FaArrowRight, FaArrowDown, FaRotateRight } from "react-icons/fa6";
import Marca from "../brand/Marca.jsx";
import "./Asistente.css";

const SALUDO = "¡Hola! Soy Hefesto. ¿En qué te ayudo con tu setup?";
const ERROR_MANTENIMIENTO =
  "Mis circuitos están en mantenimiento. Intentá de nuevo más tarde.";
const ERROR_SIN_CONEXION =
  "Parece que no tenés conexión. Revisá tu internet y tocá Reintentar.";
const CLAVE_VISTO = "ht-asistente-visto";

/* Atajos: solo a funciones que el asistente ya resuelve
   (presupuesto, soporte técnico, compra, explicación de componente). */
const ATAJOS = [
  "Quiero un presupuesto",
  "Mi PC tiene un error",
  "Duda sobre mi compra",
  "¿Qué es un SSD?",
];

function horaCorta(ts) {
  try {
    return new Date(ts).toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function escaparHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* Markdown básico: negrita, cursiva, código, listas y saltos de línea.
   Solo presentación; el texto de la respuesta no se altera. */
function mdBasico(texto) {
  const enLinea = (s) =>
    escaparHtml(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  const lineas = String(texto ?? "").split("\n");
  let html = "";
  let listaAbierta = false;
  const cerrarLista = () => {
    if (listaAbierta) {
      html += "</ul>";
      listaAbierta = false;
    }
  };
  for (const linea of lineas) {
    const item = linea.match(/^\s*(?:[-•]|\d+[.)])\s+(.*)$/);
    if (item) {
      if (!listaAbierta) {
        html += '<ul class="asistente-lista">';
        listaAbierta = true;
      }
      html += `<li>${enLinea(item[1])}</li>`;
    } else if (linea.trim() === "") {
      cerrarLista();
    } else {
      cerrarLista();
      html += `<p>${enLinea(linea)}</p>`;
    }
  }
  cerrarLista();
  return html;
}

function Asistente() {
  const [abierto, setAbierto] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [chat, setChat] = useState([{ rol: "ia", texto: SALUDO, hora: Date.now() }]);
  const [pildora, setPildora] = useState(false);
  const [esNuevo, setEsNuevo] = useState(() => {
    try {
      return !window.localStorage.getItem(CLAVE_VISTO);
    } catch {
      return false;
    }
  });
  const botonRef = useRef(null);
  const panelRef = useRef(null);
  const listaRef = useRef(null);
  const campoRef = useRef(null);
  const alFondoRef = useRef(true);
  const chatRef = useRef(chat);
  chatRef.current = chat;

  /* Envío: mismo contrato con el backend (POST /api/chat {texto}). */
  const enviarTexto = async (texto) => {
    const limpio = texto.trim();
    if (!limpio || cargando) return;
    const sinError = chatRef.current.filter((m) => m.rol !== "error");
    const conUsuario = [...sinError, { rol: "usuario", texto: limpio, hora: Date.now() }];
    chatRef.current = conUsuario;
    setChat(conUsuario);
    setMensaje("");
    setCargando(true);
    alFondoRef.current = true;
    setPildora(false);

    try {
      const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";
      const respuesta = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: limpio }),
      });

      const data = await respuesta.json();

      const actualizado = [
        ...conUsuario,
        { rol: "ia", texto: data.respuesta, hora: Date.now() },
      ];
      chatRef.current = actualizado;
      setChat(actualizado);
    } catch (error) {
      const sinConexion =
        typeof navigator !== "undefined" && navigator.onLine === false;
      const actualizado = [
        ...conUsuario,
        {
          rol: "error",
          texto: sinConexion ? ERROR_SIN_CONEXION : ERROR_MANTENIMIENTO,
          fallido: limpio,
          hora: Date.now(),
        },
      ];
      chatRef.current = actualizado;
      setChat(actualizado);
    } finally {
      setCargando(false);
    }
  };

  const enviarMensaje = (e) => {
    e.preventDefault();
    enviarTexto(mensaje);
  };

  const onTeclaCampo = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarTexto(mensaje);
    }
  };

  const autoCrecer = () => {
    const el = campoRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  useEffect(() => {
    autoCrecer();
  }, [mensaje, abierto]);

  /* Scroll auto: baja solo si el usuario ya estaba al fondo;
     si subió, muestra la píldora para volver. */
  const onScrollLista = () => {
    const el = listaRef.current;
    if (!el) return;
    const alFondo = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    alFondoRef.current = alFondo;
    if (alFondo) setPildora(false);
    else setPildora(true);
  };

  const bajarAlFondo = () => {
    const el = listaRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    alFondoRef.current = true;
    setPildora(false);
  };

  useEffect(() => {
    if (!abierto) return;
    if (alFondoRef.current) {
      const el = listaRef.current;
      if (el) el.scrollTop = el.scrollHeight;
      setPildora(false);
    } else {
      setPildora(true);
    }
  }, [chat, cargando, abierto]);

  const yaMonto = useRef(false);
  useEffect(() => {
    if (abierto) {
      try {
        window.localStorage.setItem(CLAVE_VISTO, "1");
      } catch {
        /* sin almacenamiento: no se persiste la visita */
      }
      setEsNuevo(false);
      campoRef.current?.focus();
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

  /* Móvil: panel a 100dvh con visualViewport (teclado) + scroll lock. */
  useEffect(() => {
    if (!abierto) return;
    const esMovil = window.matchMedia("(max-width: 560px)").matches;
    if (!esMovil) return;
    const vv = window.visualViewport;
    const aplicar = () => {
      if (panelRef.current && vv) {
        panelRef.current.style.height = `${vv.height}px`;
      }
    };
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    aplicar();
    vv?.addEventListener("resize", aplicar);
    return () => {
      document.body.style.overflow = previo;
      vv?.removeEventListener("resize", aplicar);
      if (panelRef.current) panelRef.current.style.height = "";
    };
  }, [abierto]);

  /* Foco trap dentro del diálogo. */
  const onTeclaPanel = (e) => {
    if (e.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const focos = panel.querySelectorAll(
      'button:not([disabled]), textarea, [href], [tabindex]:not([tabindex="-1"])'
    );
    if (focos.length === 0) return;
    const primero = focos[0];
    const ultimo = focos[focos.length - 1];
    if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  };

  const abrirCerrar = () => setAbierto((v) => !v);

  return (
    <div className={`asistente${abierto ? " es-abierto" : ""}`}>
      {abierto && (
        <div
          className="asistente-panel"
          id="asistente-panelo"
          role="dialog"
          aria-modal="false"
          aria-labelledby="asistente-titulo"
          ref={panelRef}
          tabIndex={-1}
          onKeyDown={onTeclaPanel}
        >
          <div className="asistente-head">
            <span className="asistente-avatar" aria-hidden="true">
              <Marca variante="simbolo" ancho={28} alto={28} decorativa />
            </span>
            <div>
              <strong id="asistente-titulo">Asistente de HefestoTech</strong>
              <span className="asistente-sub">Hardware · presupuestos · soporte</span>
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
            ref={listaRef}
            onScroll={onScrollLista}
          >
            {chat.map((msg, i) =>
              msg.rol === "error" ? (
                <div key={i} className="asistente-msg es-error" role="alert">
                  <span className="asistente-msg-texto">{msg.texto}</span>
                  <span className="asistente-hora">{horaCorta(msg.hora)}</span>
                  <button
                    type="button"
                    className="asistente-reintentar"
                    onClick={() => enviarTexto(msg.fallido || "")}
                    disabled={cargando}
                  >
                    <FaRotateRight aria-hidden="true" /> Reintentar
                  </button>
                </div>
              ) : (
                <div
                  key={i}
                  className={`asistente-msg${msg.rol === "ia" ? " es-ia" : " es-usuario"}`}
                >
                  {msg.rol === "ia" && (
                    <span className="asistente-msg-avatar" aria-hidden="true">
                      <Marca variante="simbolo" ancho={20} alto={20} decorativa />
                    </span>
                  )}
                  <span className="asistente-msg-texto">
                    {msg.rol === "ia" ? (
                      <span
                        dangerouslySetInnerHTML={{ __html: mdBasico(msg.texto) }}
                      />
                    ) : (
                      msg.texto
                    )}
                  </span>
                  <span className="asistente-hora">{horaCorta(msg.hora)}</span>
                </div>
              )
            )}
            {cargando && (
              <div className="asistente-msg es-ia es-escribiendo" aria-hidden="true">
                <span className="asistente-msg-avatar" aria-hidden="true">
                  <Marca variante="simbolo" ancho={20} alto={20} decorativa />
                </span>
                <span className="asistente-puntos" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            )}
          </div>

          {pildora && (
            <button
              type="button"
              className="asistente-pildora"
              onClick={bajarAlFondo}
              aria-label="Bajar a los mensajes nuevos"
            >
              <FaArrowDown aria-hidden="true" />
            </button>
          )}

          <div
            className="asistente-atajos"
            role="group"
            aria-label="Consultas rápidas"
          >
            {ATAJOS.map((texto) => (
              <button
                key={texto}
                type="button"
                className="asistente-atajo"
                onClick={() => enviarTexto(texto)}
                disabled={cargando}
              >
                {texto}
              </button>
            ))}
          </div>

          <form onSubmit={enviarMensaje} className="asistente-form">
            <textarea
              ref={campoRef}
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              onKeyDown={onTeclaCampo}
              placeholder="Escribí tu consulta…"
              aria-label="Escribí tu consulta"
              rows={1}
              disabled={cargando}
            />
            <button
              type="submit"
              className="asistente-enviar"
              aria-label="Enviar mensaje"
              disabled={!mensaje.trim() || cargando}
            >
              <FaArrowRight aria-hidden="true" />
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        className={`asistente-bola${abierto ? " es-abierto" : ""}${esNuevo && !abierto ? " es-nuevo" : ""}`}
        onClick={abrirCerrar}
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
