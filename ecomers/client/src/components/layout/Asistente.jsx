import { useEffect, useRef, useState } from "react";
import {
  FaXmark,
  FaMinus,
  FaArrowRight,
  FaRotateRight,
  FaTriangleExclamation,
  FaWhatsapp,
} from "react-icons/fa6";
import Marca from "../brand/Marca.jsx";
import "./Asistente.css";

const SALUDO_INICIAL = "¡Hola! Soy Hefesto. ¿En qué te ayudo con tu setup?";
const WHATSAPP_URL = "https://wa.me/5491112345678";
const MAX_LARGO = 500;

const ATAJOS = [
  {
    etiqueta: "Armar mi PC",
    texto: "Quiero armar una PC, ¿por dónde empiezo?",
  },
  { etiqueta: "Medios de pago", texto: "¿Qué medios de pago aceptan?" },
  { etiqueta: "Envíos", texto: "¿Cómo funcionan los envíos?" },
  {
    etiqueta: "Estado de mi pedido",
    texto: "Quiero saber el estado de mi pedido",
  },
  { etiqueta: "Hablar por WhatsApp", texto: "Quiero hablar por WhatsApp" },
];

function horaCorta(marca) {
  try {
    return new Date(marca).toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_) {
    return "";
  }
}

function renderEnLinea(fragmento, clave) {
  const partes = String(fragmento).split(/(\*\*.+?\*\*|\*[^*]+?|`[^`]+?`)/g);
  return partes.map((parte, i) => {
    if (parte.startsWith("**") && parte.endsWith("**") && parte.length > 4) {
      return <strong key={`${clave}-${i}`}>{parte.slice(2, -2)}</strong>;
    }
    if (parte.startsWith("*") && parte.endsWith("*") && parte.length > 2) {
      return <em key={`${clave}-${i}`}>{parte.slice(1, -1)}</em>;
    }
    if (parte.startsWith("`") && parte.endsWith("`") && parte.length > 2) {
      return <code key={`${clave}-${i}`}>{parte.slice(1, -1)}</code>;
    }
    return <span key={`${clave}-${i}`}>{parte}</span>;
  });
}

function renderRico(texto) {
  const lineas = String(texto ?? "").split("\n");
  const bloques = [];
  let lista = [];
  const volcarLista = () => {
    if (lista.length) {
      bloques.push(
        <ul key={`lista-${bloques.length}`} className="asistente-lista">
          {lista.map((item, i) => (
            <li key={i}>{renderEnLinea(item, `li-${bloques.length}-${i}`)}</li>
          ))}
        </ul>,
      );
      lista = [];
    }
  };
  lineas.forEach((linea, i) => {
    const recortada = linea.trim();
    if (recortada.startsWith("- ")) {
      lista.push(recortada.slice(2));
    } else {
      volcarLista();
      if (recortada) {
        bloques.push(<p key={`p-${i}`}>{renderEnLinea(linea, `p-${i}`)}</p>);
      }
    }
  });
  volcarLista();
  return bloques.length ? bloques : renderEnLinea(texto, "solo");
}

const AVISOS = {
  error: {
    titulo: "No pude forjar la respuesta.",
    detalle: "Probá de nuevo o escribinos por WhatsApp.",
  },
  "sin-conexion": {
    titulo: "Sin conexión.",
    detalle: "Revisá tu red o escribinos por WhatsApp.",
  },
  limite: {
    titulo: "Demasiadas consultas seguidas.",
    detalle: "Esperá un minuto e intentá de nuevo.",
  },
  caido: {
    titulo: "Mis circuitos están en mantenimiento.",
    detalle: "Intentá de nuevo más tarde o escribinos por WhatsApp.",
  },
};

function Asistente() {
  const [abierto, setAbierto] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [chat, setChat] = useState([
    { rol: "ia", texto: SALUDO_INICIAL, hora: Date.now() },
  ]);
  const [estado, setEstado] = useState("listo");
  const [aviso, setAviso] = useState(null);
  const [ultimoTexto, setUltimoTexto] = useState("");
  const botonRef = useRef(null);
  const panelRef = useRef(null);
  const mensajesRef = useRef(null);
  const areaRef = useRef(null);

  const sinEmpezar = !chat.some((m) => m.rol === "usuario");
  const escribiendo = estado === "escribiendo";

  const enviarTexto = async (texto) => {
    const limpio = String(texto ?? "").trim();
    if (!limpio || escribiendo) return;
    const recortado = limpio.slice(0, MAX_LARGO);
    setUltimoTexto(recortado);
    const msgUsuario = { rol: "usuario", texto: recortado, hora: Date.now() };
    const base = [...chat, msgUsuario];
    setChat(base);
    setAviso(null);

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setAviso({ tipo: "sin-conexion", reintentable: true });
      return;
    }

    setEstado("escribiendo");
    try {
      const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";
      const historial = chat
        .filter((m) => m.texto !== SALUDO_INICIAL)
        .slice(-10)
        .map((m) => ({ rol: m.rol, texto: m.texto.slice(0, 500) }));
      const respuesta = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: recortado, historial }),
      });

      // TU LÓGICA: Validamos si la IA devuelve exactamente el error 503
      if (respuesta.status === 503) {
        setChat([
          ...base,
          {
            rol: "ia",
            texto:
              "La forja está ardiendo. Hay muchas consultas en este momento, espera un poco y vuelve a intentarlo.",
            hora: Date.now(),
          },
        ]);
        setEstado("listo");
        return;
      }

      let data = null;
      try {
        data = await respuesta.json();
      } catch (_) {
        data = null;
      }

      if (respuesta.status === 429) {
        setAviso({
          tipo: "limite",
          detalle: data?.detail,
          reintentable: true,
        });
      } else if (!respuesta.ok || !data?.respuesta) {
        setAviso({ tipo: "error", reintentable: true });
      } else {
        setChat([
          ...base,
          { rol: "ia", texto: data.respuesta, hora: Date.now() },
        ]);
      }
    } catch (error) {
      // TU LÓGICA: Mensaje temático por si el backend se cae totalmente
      setChat([
        ...base,
        {
          rol: "ia",
          texto:
            "La forja está sobrecargada de trabajo. Espera unos minutos y vuelve a golpear el yunque.",
          hora: Date.now(),
        },
      ]);
    } finally {
      setEstado("listo");
    }
  };

  const reintentar = () => {
    if (ultimoTexto) enviarTexto(ultimoTexto);
  };

  const minimizar = () => setAbierto(false);
  const cerrar = () => {
    setAbierto(false);
    setChat([{ rol: "ia", texto: SALUDO_INICIAL, hora: Date.now() }]);
    setAviso(null);
    setMensaje("");
    setUltimoTexto("");
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
    mensajesRef.current?.scrollTo({
      top: mensajesRef.current.scrollHeight,
      behavior: "auto",
    });
  }, [chat, estado, aviso, abierto]);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [mensaje, abierto]);

  useEffect(() => {
    if (!abierto) return;
    const esMovil = window.matchMedia("(max-width: 640px)");
    const vv = window.visualViewport;
    const panel = panelRef.current;
    const aplicar = () => {
      if (!panel || !esMovil.matches || !vv) return;
      panel.style.top = `${Math.max(8, vv.offsetTop + 8)}px`;
      panel.style.height = `${Math.max(320, vv.height - 16)}px`;
    };
    const bloquear = () => {
      if (esMovil.matches) {
        document.body.style.overflow = "hidden";
        aplicar();
      }
    };
    bloquear();
    vv?.addEventListener("resize", aplicar);
    vv?.addEventListener("scroll", aplicar);
    return () => {
      document.body.style.overflow = "";
      if (panel) {
        panel.style.top = "";
        panel.style.height = "";
      }
      vv?.removeEventListener("resize", aplicar);
      vv?.removeEventListener("scroll", aplicar);
    };
  }, [abierto]);

  const alTeclaPanel = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      setAbierto(false);
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    const lista = [
      ...panelRef.current.querySelectorAll(
        'button:not(:disabled), [href], textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ];
    if (!lista.length) return;
    const primero = lista[0];
    const ultimo = lista[lista.length - 1];
    if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  };

  const alTeclaCampo = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarTexto(mensaje);
      setMensaje("");
    }
  };

  const avisoInfo = aviso ? (AVISOS[aviso.tipo] ?? AVISOS.error) : null;

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
          onKeyDown={alTeclaPanel}
        >
          <div className="asistente-head">
            <span className="asistente-avatar" aria-hidden="true">
              <Marca variante="simbolo" ancho={28} alto={28} decorativa />
            </span>
            <div className="asistente-titulos">
              <strong id="asistente-titulo">Asistente de HefestoTech</strong>
              <span className="asistente-sub">
                Presupuestos · Soporte · Stock
              </span>
            </div>
            <div className="asistente-acciones">
              <button
                type="button"
                onClick={minimizar}
                aria-label="Minimizar asistente"
              >
                <FaMinus aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={cerrar}
                aria-label="Cerrar asistente"
              >
                <FaXmark aria-hidden="true" />
              </button>
            </div>
          </div>

          <div
            className="asistente-mensajes"
            style={{ height: "400px" }} // TU LÓGICA: Altura para mejor visualización
            role="log"
            aria-live="polite"
            aria-atomic="false"
            aria-relevant="additions"
            aria-label="Conversación con Hefesto"
            ref={mensajesRef}
          >
            {chat.map((msg, i) => (
              <div
                key={i}
                className={`asistente-msg${msg.rol === "ia" ? " es-ia" : " es-usuario"}`}
              >
                {msg.rol === "ia" && (
                  <span className="asistente-msg-avatar" aria-hidden="true">
                    <Marca variante="simbolo" ancho={18} alto={18} decorativa />
                  </span>
                )}
                <span className="asistente-msg-texto">
                  {msg.rol === "ia" ? renderRico(msg.texto) : msg.texto}
                  {msg.hora ? (
                    <time dateTime={new Date(msg.hora).toISOString()}>
                      {horaCorta(msg.hora)}
                    </time>
                  ) : null}
                </span>
              </div>
            ))}

            {escribiendo && (
              <div className="asistente-msg es-ia" aria-hidden="true">
                <span className="asistente-msg-avatar">
                  <Marca variante="simbolo" ancho={18} alto={18} decorativa />
                </span>
                <span className="asistente-escribiendo">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            )}
            <span className="asistente-sr" role="status">
              {escribiendo ? "Hefesto está escribiendo…" : ""}
            </span>

            {avisoInfo && (
              <div className={`asistente-aviso es-${aviso.tipo}`} role="alert">
                <FaTriangleExclamation aria-hidden="true" />
                <div>
                  <strong>{avisoInfo.titulo}</strong>
                  <p>{aviso?.detalle || avisoInfo.detalle}</p>
                  <div className="asistente-aviso-acciones">
                    {aviso.reintentable && ultimoTexto && (
                      <button
                        type="button"
                        onClick={reintentar}
                        disabled={escribiendo}
                      >
                        <FaRotateRight aria-hidden="true" /> Reintentar
                      </button>
                    )}
                    <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
                      <FaWhatsapp aria-hidden="true" /> WhatsApp
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {sinEmpezar && (
            <div className="asistente-chips">
              {ATAJOS.map((atajo) => (
                <button
                  key={atajo.etiqueta}
                  type="button"
                  onClick={() => enviarTexto(atajo.texto)}
                  disabled={escribiendo}
                >
                  {atajo.etiqueta}
                </button>
              ))}
            </div>
          )}

          <form
            className="asistente-form"
            onSubmit={(e) => {
              e.preventDefault();
              enviarTexto(mensaje);
              setMensaje("");
            }}
          >
            <label className="asistente-sr" htmlFor="asistente-campo">
              Escribí tu consulta
            </label>
            <textarea
              id="asistente-campo"
              ref={areaRef}
              rows={1}
              value={mensaje}
              maxLength={MAX_LARGO}
              onChange={(e) => setMensaje(e.target.value)}
              onKeyDown={alTeclaCampo}
              placeholder="Escribí tu consulta…"
              enterKeyHint="send"
              disabled={escribiendo}
            />
            <span className="asistente-contador" aria-hidden="true">
              {mensaje.length}/{MAX_LARGO}
            </span>
            <button
              type="submit"
              className="asistente-enviar"
              aria-label="Enviar mensaje"
              disabled={!mensaje.trim() || escribiendo}
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
        aria-label={
          abierto
            ? "Cerrar asistente de HefestoTech"
            : "Abrir asistente de HefestoTech"
        }
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
