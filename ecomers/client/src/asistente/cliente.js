/**
 * HefestoTech · Asistente · Cliente HTTP del chat (/api/chat por SSE).
 *
 * La clave del LLM vive solo en el backend: el front manda el historial
 * visible, el id de sesión y el carrito (ids + cantidades) y recibe
 * eventos. Los errores previos al stream vuelven como `ErrorChat` con un
 * tipo que la UI traduce (limite, validacion, caido, sin-conexion).
 */
import { crearLectorSSE } from "./sse.js";

export class ErrorChat extends Error {
  constructor(tipo, detalle = "") {
    super(detalle || tipo);
    this.tipo = tipo;
    this.detalle = detalle;
  }
}

export function urlApi() {
  return String(import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
}

function detalleDe(json) {
  const d = json?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d[0]?.msg) return String(d[0].msg).replace(/^Value error,\s*/i, "");
  return "";
}

/**
 * Envía la conversación y llama a `alEvento(evento, datos)` por cada
 * evento del stream. Resuelve cuando llega `fin` o se corta el body.
 */
export async function enviarChat({ mensajes, sesion, carrito = [], signal, alEvento, fetcher = fetch }) {
  let respuesta;
  try {
    respuesta = await fetcher(`${urlApi()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ mensajes, sesion, carrito }),
      signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new ErrorChat("caido");
  }

  const tipo = respuesta.headers.get("content-type") || "";
  if (!respuesta.ok || !tipo.includes("text/event-stream")) {
    const json = await respuesta.json().catch(() => null);
    if (respuesta.status === 429) throw new ErrorChat("limite", detalleDe(json));
    if (respuesta.status === 422) throw new ErrorChat("validacion", detalleDe(json));
    throw new ErrorChat("caido");
  }

  const lector = respuesta.body.getReader();
  const decodificador = new TextDecoder();
  let terminado = false;
  const sse = crearLectorSSE((evento, datos) => {
    if (evento === "fin") terminado = true;
    alEvento(evento, datos);
  });
  for (;;) {
    const { value, done } = await lector.read();
    if (done) break;
    sse.alimentar(decodificador.decode(value, { stream: true }));
  }
  sse.alimentar(decodificador.decode());
  sse.cerrar();
  if (!terminado) throw new ErrorChat("interrumpido");
}

export async function enviarFeedback({ sesion, mensajeId, valor, fetcher = fetch }) {
  try {
    await fetcher(`${urlApi()}/api/chat/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sesion, mensaje_id: mensajeId, valor }),
    });
  } catch {
    /* El feedback es opcional: si no llega, la conversación sigue igual. */
  }
}
