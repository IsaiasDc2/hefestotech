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
import useIdiomaStore, { t } from "../../store/idiomaStore";
import "./Asistente.css";

const WHATSAPP_URL = "https://wa.me/5491112345678";
const MAX_LARGO = 500;

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

/* Markdown mínimo y seguro por construcción: jamás se usa
   dangerouslySetInnerHTML. El texto viaja como nodos React (escapado por
   defecto) y solo se permite **negrita**, *itálica*, `código` y listas
   "- ". Sin links ni HTML crudo no hay vector XSS y no hace falta sumar
   librerías. */
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

function Asistente() {
  const idioma = useIdiomaStore((s) => s.idioma);
  const SALUDO = t(idioma, "as.saludo");
  const ATAJOS_T = [
    { etiqueta: t(idioma, "as.at1"), texto: "Quiero armar una PC, ¿por dónde empiezo?" },
    { etiqueta: t(idioma, "as.at2"), texto: "¿Qué medios de pago aceptan?" },
    { etiqueta: t(idioma, "as.at3"), texto: "¿Cómo funcionan los envíos?" },
    { etiqueta: t(idioma, "as.at4"), texto: "Quiero saber el estado de mi pedido" },
    { etiqueta: t(idioma, "as.at5"), texto: "Quiero hablar por WhatsApp" },
  ];
  const AVISOS_T = {
    error: {
      titulo: t(idioma, "as.avErrorT"),
      detalle: t(idioma, "as.avErrorD"),
    },
    "sin-conexion": {
      titulo: t(idioma, "as.avSinT"),
      detalle: t(idioma, "as.avSinD"),
    },
    limite: {
      titulo: t(idioma, "as.avLimT"),
      detalle: t(idioma, "as.avLimD"),
    },
    caido: {
      titulo: t(idioma, "as.avCaiT"),
      detalle: t(idioma, "as.avCaiD"),
    },
  };
  const [abierto, setAbierto] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [chat, setChat] = useState([
    { rol: "ia", texto: SALUDO, hora: Date.now() },
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
      const respuesta = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: recortado }),
      });
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
        setChat([...base, { rol: "ia", texto: data.respuesta, hora: Date.now() }]);
      }
    } catch (error) {
      setAviso({ tipo: "caido", reintentable: true });
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
    setChat([{ rol: "ia", texto: SALUDO, hora: Date.now() }]);
    setAviso(null);
    setMensaje("");
    setUltimoTexto("");
  };

  // Foco: al abrir va al panel; al cerrar vuelve al botón que abrió.
  const yaMonto = useRef(false);
  useEffect(() => {
    if (abierto) {
      panelRef.current?.focus();
    } else if (yaMonto.current) {
      botonRef.current?.focus();
    }
    yaMonto.current = true;
  }, [abierto]);

  // Scroll de mensajes al fondo + autogrow del campo.
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

  // Móvil: scroll lock + altura según visualViewport (teclado abierto).
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

  const avisoInfo = aviso ? AVISOS_T[aviso.tipo] ?? AVISOS_T.error : null;

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
              <strong id="asistente-titulo">{t(idioma, "as.titulo")}</strong>
              <span className="asistente-sub">{t(idioma, "as.sub")}</span>
            </div>
            <div className="asistente-acciones">
              <button type="button" onClick={minimizar} aria-label={t(idioma, "as.minimizar")}>
                <FaMinus aria-hidden="true" />
              </button>
              <button type="button" onClick={cerrar} aria-label={t(idioma, "as.cerrar")}>
                <FaXmark aria-hidden="true" />
              </button>
            </div>
          </div>

          <div
            className="asistente-mensajes"
            role="log"
            aria-live="polite"
            aria-atomic="false"
            aria-relevant="additions"
            aria-label={t(idioma, "as.conversacion")}
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
              {escribiendo ? t(idioma, "as.escribiendo") : ""}
            </span>

            {avisoInfo && (
              <div className={`asistente-aviso es-${aviso.tipo}`} role="alert">
                <FaTriangleExclamation aria-hidden="true" />
                <div>
                  <strong>{avisoInfo.titulo}</strong>
                  <p>{aviso?.detalle || avisoInfo.detalle}</p>
                  <div className="asistente-aviso-acciones">
                    {aviso.reintentable && ultimoTexto && (
                      <button type="button" onClick={reintentar} disabled={escribiendo}>
                        <FaRotateRight aria-hidden="true" /> {t(idioma, "as.reintentar")}
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
              {ATAJOS_T.map((atajo) => (
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
              {t(idioma, "as.escribiTu")}
            </label>
            <textarea
              id="asistente-campo"
              ref={areaRef}
              rows={1}
              value={mensaje}
              maxLength={MAX_LARGO}
              onChange={(e) => setMensaje(e.target.value)}
              onKeyDown={alTeclaCampo}
              placeholder={t(idioma, "as.ph")}
              enterKeyHint="send"
              disabled={escribiendo}
            />
            <span className="asistente-contador" aria-hidden="true">
              {mensaje.length}/{MAX_LARGO}
            </span>
            <button
              type="submit"
              className="asistente-enviar"
              aria-label={t(idioma, "as.enviar")}
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
        aria-label={abierto ? t(idioma, "as.cerrarAbierto") : t(idioma, "as.abrir")}
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
