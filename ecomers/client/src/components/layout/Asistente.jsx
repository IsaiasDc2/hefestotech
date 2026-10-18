import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import {
  FaXmark,
  FaArrowRight,
  FaRotateRight,
  FaTriangleExclamation,
  FaWhatsapp,
  FaPenToSquare,
  FaThumbsUp,
  FaThumbsDown,
} from "react-icons/fa6";
import Marca from "../brand/Marca.jsx";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import useCartStore from "../../store/cartStore";
import { whatsappUrl } from "../../constants/whatsapp";
import { renderRico } from "../../asistente/textoRico.jsx";
import TarjetaChat from "../../asistente/TarjetaChat.jsx";
import ArmadoChat from "../../asistente/ArmadoChat.jsx";
import { enviarChat, enviarFeedback } from "../../asistente/cliente";
import {
  borrarConversacion,
  cargarConversacion,
  guardarConversacion,
  historialParaApi,
  limpiarTarjetas,
  nuevaSesion,
  productoParaCarrito,
} from "../../asistente/conversacion";
import "./Asistente.css";

const MAX_LARGO = 2000;
const BASE = import.meta.env.BASE_URL || "/";

// Estado de cada herramienta mientras el asistente consulta datos.
const ESTADO_HERRAMIENTA = {
  search_products: "as.hBuscando",
  get_product: "as.hBuscando",
  check_stock: "as.hBuscando",
  check_compatibility: "as.hCompat",
  recommend_build: "as.hArmado",
  get_shipping_estimate: "as.hEnvio",
  get_order_status: "as.hPedido",
  get_store_policies: "as.hPoliticas",
  escalate_to_human: "as.hDerivando",
};

let contador = 0;
// Fuera del componente: id y hora se generan al enviar, nunca en el render.
function nuevoMensaje(rol, texto, extra = {}) {
  contador += 1;
  return { id: `m-${Date.now().toString(36)}-${contador}`, rol, texto, hora: Date.now(), ...extra };
}

function horaCorta(marca) {
  try {
    return new Date(marca).toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function Asistente() {
  const idioma = useIdiomaStore((s) => s.idioma);
  const carrito = useCartStore((s) => s.carrito);
  const agregarAlCarrito = useCartStore((s) => s.agregarAlCarrito);
  const agregarVarios = useCartStore((s) => s.agregarVarios);
  const { pathname } = useLocation();
  const enCheckout = /\/checkout\/?$/.test(pathname);
  // Ficha de producto y armador tienen una barra de compra fija abajo.
  const sobreBarra = /\/producto\/|\/armar\/?$/.test(pathname);

  const ATAJOS = [
    { etiqueta: t(idioma, "as.at1"), texto: "Quiero armar una PC gamer" },
    { etiqueta: t(idioma, "as.at2"), texto: "Quiero saber si dos componentes son compatibles" },
    { etiqueta: t(idioma, "as.at3"), texto: "Quiero saber el estado de mi pedido" },
    { etiqueta: t(idioma, "as.at4"), texto: "¿Cómo funcionan los envíos?" },
    { etiqueta: t(idioma, "as.at5"), texto: "¿Qué medios de pago aceptan?" },
  ];
  const AVISOS = {
    error: { titulo: t(idioma, "as.avErrorT"), detalle: t(idioma, "as.avErrorD") },
    "sin-conexion": { titulo: t(idioma, "as.avSinT"), detalle: t(idioma, "as.avSinD") },
    limite: { titulo: t(idioma, "as.avLimT"), detalle: t(idioma, "as.avLimD") },
    caido: { titulo: t(idioma, "as.avCaiT"), detalle: t(idioma, "as.avCaiD") },
    interrumpido: { titulo: t(idioma, "as.avIntT"), detalle: t(idioma, "as.avErrorD") },
    validacion: { titulo: t(idioma, "as.avValT"), detalle: "" },
  };

  const [abierto, setAbierto] = useState(false);
  // En el checkout el asistente queda minimizado: solo se abre si se pidió ahí.
  const [rutaApertura, setRutaApertura] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [conversacion, setConversacion] = useState(
    () => cargarConversacion() ?? { sesion: nuevaSesion(), mensajes: [] },
  );
  const [estado, setEstado] = useState("listo");
  const [herramienta, setHerramienta] = useState(null);
  const [aviso, setAviso] = useState(null);
  const botonRef = useRef(null);
  const panelRef = useRef(null);
  const mensajesRef = useRef(null);
  const areaRef = useRef(null);
  const abortRef = useRef(null);

  const { sesion, mensajes: chat, modo = "" } = conversacion;
  const setModo = (valor) => setConversacion((c) => (c.modo === valor ? c : { ...c, modo: valor }));
  const visible = abierto && (!enCheckout || rutaApertura === pathname);
  const sinEmpezar = !chat.some((m) => m.rol === "usuario");
  const escribiendo = estado === "escribiendo";
  const ultimoUsuario = [...chat].reverse().find((m) => m.rol === "usuario");

  const setChat = (actualizar) =>
    setConversacion((c) => ({ ...c, mensajes: typeof actualizar === "function" ? actualizar(c.mensajes) : actualizar }));

  useEffect(() => {
    guardarConversacion(conversacion);
  }, [conversacion]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const enviar = async (texto, previos) => {
    const limpio = limpiarTarjetas(String(texto ?? "").trim()).slice(0, MAX_LARGO);
    if (!limpio || escribiendo) return;
    const usuario = nuevoMensaje("usuario", limpio);
    const base = [...previos, usuario];
    setAviso(null);

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setChat(base);
      setAviso({ tipo: "sin-conexion" });
      return;
    }

    let respuesta = nuevoMensaje("ia", "", { pendiente: true });
    const mostrar = () => setChat([...base, respuesta]);
    mostrar();
    setEstado("escribiendo");
    const control = new AbortController();
    abortRef.current = control;
    let fallo = null;
    try {
      await enviarChat({
        mensajes: historialParaApi(base),
        sesion,
        carrito: carrito.slice(0, 50).map((i) => ({ id: String(i.id), cantidad: Math.min(100, Number(i.cantidad) || 1) })),
        signal: control.signal,
        alEvento: (evento, datos) => {
          if (evento === "inicio") {
            setModo(datos.modo);
            respuesta = { ...respuesta, idServidor: datos.id };
          } else if (evento === "herramienta") {
            setHerramienta(datos.nombre);
          } else if (evento === "texto") {
            setHerramienta(null);
            respuesta = { ...respuesta, texto: respuesta.texto + datos.delta };
          } else if (evento === "productos") {
            respuesta = { ...respuesta, productos: datos.productos };
          } else if (evento === "armado") {
            respuesta = { ...respuesta, armado: datos };
          } else if (evento === "derivacion") {
            respuesta = { ...respuesta, derivacion: datos };
          } else if (evento === "error") {
            fallo = { tipo: datos.tipo === "interrumpido" ? "interrumpido" : "caido", detalle: datos.mensaje };
          }
          mostrar();
        },
      });
    } catch (error) {
      if (error?.name === "AbortError") return;
      fallo = { tipo: error?.tipo || "error", detalle: error?.detalle || "" };
    } finally {
      if (abortRef.current === control) abortRef.current = null;
      setEstado("listo");
      setHerramienta(null);
    }
    const conTexto = respuesta.texto.trim().length > 0;
    respuesta = { ...respuesta, pendiente: false };
    setChat(conTexto || respuesta.productos || respuesta.armado ? [...base, respuesta] : base);
    if (fallo) setAviso({ ...fallo, derivar: true });
  };

  const enviarTexto = (texto) => enviar(texto, chat);

  const reintentar = () => {
    if (!ultimoUsuario) return;
    const indice = chat.lastIndexOf(ultimoUsuario);
    enviar(ultimoUsuario.texto, chat.slice(0, indice));
  };

  const nuevaConversacion = () => {
    abortRef.current?.abort();
    borrarConversacion();
    setConversacion((c) => ({ sesion: nuevaSesion(), mensajes: [], modo: c.modo }));
    setAviso(null);
    setMensaje("");
    setEstado("listo");
    areaRef.current?.focus();
  };

  const darFeedback = (m, valor) => {
    setChat((lista) => lista.map((x) => (x.id === m.id ? { ...x, feedback: valor } : x)));
    if (m.idServidor) enviarFeedback({ sesion, mensajeId: m.idServidor, valor });
  };

  const agregarTarjeta = (tarjeta) => agregarAlCarrito(productoParaCarrito(tarjeta, BASE), 1, { abrir: false });
  const agregarArmado = (tarjetas) =>
    agregarVarios(tarjetas.map((x) => productoParaCarrito(x, BASE)), { abrir: false });
  const alNavegar = () => {
    if (window.matchMedia("(max-width: 640px)").matches) setAbierto(false);
  };

  const alternar = () => {
    if (visible) {
      setAbierto(false);
    } else {
      setRutaApertura(pathname);
      setAbierto(true);
    }
  };

  // Foco: al abrir va al panel; al cerrar vuelve al botón que abrió.
  const yaMonto = useRef(false);
  useEffect(() => {
    if (visible) {
      panelRef.current?.focus();
    } else if (yaMonto.current) {
      botonRef.current?.focus();
    }
    yaMonto.current = true;
  }, [visible]);

  // Scroll de mensajes al fondo + autogrow del campo.
  useEffect(() => {
    mensajesRef.current?.scrollTo({
      top: mensajesRef.current.scrollHeight,
      behavior: "auto",
    });
  }, [chat, estado, aviso, visible]);
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [mensaje, visible]);

  // Móvil: scroll lock + altura según visualViewport (teclado abierto).
  useEffect(() => {
    if (!visible) return;
    const esMovil = window.matchMedia("(max-width: 640px)");
    const vv = window.visualViewport;
    const panel = panelRef.current;
    const aplicar = () => {
      if (!panel || !esMovil.matches || !vv) return;
      panel.style.top = `${Math.max(8, vv.offsetTop + 8)}px`;
      panel.style.height = `${Math.max(320, vv.height - 16)}px`;
    };
    if (esMovil.matches) {
      document.body.style.overflow = "hidden";
      aplicar();
    }
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
  }, [visible]);

  const alTeclaPanel = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      setAbierto(false);
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    const lista = [
      ...panelRef.current.querySelectorAll(
        'button:not(:disabled), [href], textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
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

  const enviarCampo = () => {
    if (escribiendo || !mensaje.trim()) return;
    enviarTexto(mensaje);
    setMensaje("");
  };

  const alTeclaCampo = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarCampo();
    }
  };

  const avisoInfo = aviso ? AVISOS[aviso.tipo] ?? AVISOS.error : null;
  const derivacionTexto = (motivo) => `Hola, vengo del asistente de la web. ${motivo || ""}`.trim();

  return (
    <div className={`asistente${enCheckout ? " es-mini" : ""}${sobreBarra ? " es-sobre-barra" : ""}`}>
      {visible && (
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
              {modo === "mock" && (
                <span className="asistente-sub" title={t(idioma, "as.demoDetalle")}>
                  {t(idioma, "as.demo")}
                </span>
              )}
            </div>
            <div className="asistente-acciones">
              <button
                type="button"
                onClick={nuevaConversacion}
                aria-label={t(idioma, "as.nueva")}
                title={t(idioma, "as.nueva")}
                disabled={sinEmpezar && !aviso}
              >
                <FaPenToSquare aria-hidden="true" />
              </button>
              <button type="button" onClick={() => setAbierto(false)} aria-label={t(idioma, "as.cerrar")}>
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
            aria-busy={escribiendo}
            aria-label={t(idioma, "as.conversacion")}
            ref={mensajesRef}
          >
            <div className="asistente-msg es-ia">
              <span className="asistente-msg-avatar" aria-hidden="true">
                <Marca variante="simbolo" ancho={18} alto={18} decorativa />
              </span>
              <span className="asistente-msg-texto">{t(idioma, "as.saludo")}</span>
            </div>

            {chat.map((msg) => msg.pendiente && !msg.texto && !msg.armado && !msg.productos ? null : (
              <div key={msg.id} className={`asistente-msg${msg.rol === "ia" ? " es-ia" : " es-usuario"}`}>
                {msg.rol === "ia" && (
                  <span className="asistente-msg-avatar" aria-hidden="true">
                    <Marca variante="simbolo" ancho={18} alto={18} decorativa />
                  </span>
                )}
                <div className="asistente-msg-cuerpo">
                  {(msg.texto || msg.rol === "usuario") && (
                    <span className="asistente-msg-texto">
                      {msg.rol === "ia" ? renderRico(msg.texto) : msg.texto}
                      {msg.hora && !msg.pendiente ? (
                        <time dateTime={new Date(msg.hora).toISOString()}>{horaCorta(msg.hora)}</time>
                      ) : null}
                    </span>
                  )}
                  {msg.armado && (
                    <ArmadoChat armado={msg.armado} alAgregarTodo={agregarArmado} alNavegar={alNavegar} />
                  )}
                  {msg.productos?.length > 0 && (
                    <div className="asistente-tarjetas">
                      {msg.productos.map((p) => (
                        <TarjetaChat key={p.id} tarjeta={p} alAgregar={agregarTarjeta} alNavegar={alNavegar} />
                      ))}
                    </div>
                  )}
                  {msg.derivacion && (
                    <a
                      className="asistente-derivar"
                      href={whatsappUrl(derivacionTexto(msg.derivacion.motivo))}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <FaWhatsapp aria-hidden="true" /> {t(idioma, "as.whatsapp")}
                    </a>
                  )}
                  {msg.rol === "ia" && !msg.pendiente && msg.idServidor && (
                    <div className="asistente-feedback" role="group" aria-label={t(idioma, "as.feedback")}>
                      <button
                        type="button"
                        aria-label={t(idioma, "as.util")}
                        aria-pressed={msg.feedback === "positivo"}
                        onClick={() => darFeedback(msg, "positivo")}
                        disabled={Boolean(msg.feedback)}
                      >
                        <FaThumbsUp aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={t(idioma, "as.noUtil")}
                        aria-pressed={msg.feedback === "negativo"}
                        onClick={() => darFeedback(msg, "negativo")}
                        disabled={Boolean(msg.feedback)}
                      >
                        <FaThumbsDown aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {escribiendo && !chat.at(-1)?.texto && (
              <div className="asistente-msg es-ia" aria-hidden="true">
                <span className="asistente-msg-avatar">
                  <Marca variante="simbolo" ancho={18} alto={18} decorativa />
                </span>
                <span className="asistente-escribiendo">
                  <span />
                  <span />
                  <span />
                </span>
                {herramienta && ESTADO_HERRAMIENTA[herramienta] && (
                  <span className="asistente-herramienta">{t(idioma, ESTADO_HERRAMIENTA[herramienta])}</span>
                )}
              </div>
            )}
          </div>
          <span className="asistente-sr" role="status">
            {escribiendo
              ? t(idioma, herramienta && ESTADO_HERRAMIENTA[herramienta] ? ESTADO_HERRAMIENTA[herramienta] : "as.escribiendo")
              : ""}
          </span>

          {avisoInfo && (
            <div className={`asistente-aviso es-${aviso.tipo}`} role="alert">
              <FaTriangleExclamation aria-hidden="true" />
              <div>
                <strong>{avisoInfo.titulo}</strong>
                {(aviso.detalle || avisoInfo.detalle) && <p>{aviso.detalle || avisoInfo.detalle}</p>}
                <div className="asistente-aviso-acciones">
                  {ultimoUsuario && aviso.tipo !== "validacion" && (
                    <button type="button" onClick={reintentar} disabled={escribiendo}>
                      <FaRotateRight aria-hidden="true" /> {t(idioma, "as.reintentar")}
                    </button>
                  )}
                  <a href={whatsappUrl(derivacionTexto(ultimoUsuario?.texto?.slice(0, 200)))} target="_blank" rel="noopener noreferrer">
                    <FaWhatsapp aria-hidden="true" /> WhatsApp
                  </a>
                </div>
              </div>
            </div>
          )}

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
              enviarCampo();
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
            />
            {mensaje.length > MAX_LARGO * 0.8 && (
              <span className="asistente-contador" aria-live="polite">
                {mensaje.length}/{MAX_LARGO}
              </span>
            )}
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
        className={`asistente-bola${visible ? " es-abierto" : ""}`}
        onClick={alternar}
        ref={botonRef}
        aria-label={visible ? t(idioma, "as.cerrarAbierto") : t(idioma, "as.abrir")}
        aria-expanded={visible}
        aria-controls="asistente-panelo"
      >
        {visible ? (
          <FaXmark aria-hidden="true" />
        ) : (
          <Marca variante="simbolo" ancho={enCheckout ? 24 : 32} alto={enCheckout ? 24 : 32} decorativa />
        )}
        {!visible && !enCheckout && <span className="asistente-punto" aria-hidden="true" />}
      </button>
    </div>
  );
}

export default Asistente;
