/**
 * HefestoTech · Asistente · Estado persistente de la conversación.
 *
 * La conversación sobrevive a recargas y cambios de página (localStorage,
 * 24 h). Antes de guardar o mostrar un mensaje del usuario se borran los
 * números de tarjeta (mismo criterio Luhn que el backend): el asistente
 * pide no compartirlos y no deben quedar en el navegador.
 */

const CLAVE = "hefestotech-asistente";
const VIGENCIA_MS = 24 * 60 * 60 * 1000;
const MAX_MENSAJES = 60;
export const MARCA_TARJETA = "[dato de tarjeta eliminado]";

function luhn(digitos) {
  let total = 0;
  for (let i = 0; i < digitos.length; i += 1) {
    let n = Number(digitos[digitos.length - 1 - i]);
    if (i % 2) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    total += n;
  }
  return total % 10 === 0;
}

export function limpiarTarjetas(texto) {
  let limpio = String(texto ?? "").replace(/(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g, (tramo) => {
    const digitos = tramo.replace(/\D/g, "");
    return digitos.length >= 13 && digitos.length <= 19 && luhn(digitos) ? MARCA_TARJETA : tramo;
  });
  limpio = limpio.replace(/\b(cvv|cvc|c[oó]digo de seguridad)\b\D{0,12}\d{3,4}\b/gi, `$1 ${MARCA_TARJETA}`);
  return limpio;
}

export function nuevaSesion() {
  try {
    return crypto.randomUUID();
  } catch {
    return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function cargarConversacion(almacen = globalThis.localStorage) {
  try {
    const crudo = almacen?.getItem(CLAVE);
    if (!crudo) return null;
    const datos = JSON.parse(crudo);
    if (!datos || Date.now() - Number(datos.guardado) > VIGENCIA_MS) return null;
    if (typeof datos.sesion !== "string" || !Array.isArray(datos.mensajes)) return null;
    return {
      sesion: datos.sesion,
      modo: typeof datos.modo === "string" ? datos.modo : "",
      mensajes: datos.mensajes.filter((m) => m && typeof m.texto === "string"),
    };
  } catch {
    return null;
  }
}

export function guardarConversacion({ sesion, mensajes, modo = "" }, almacen = globalThis.localStorage) {
  try {
    const persistibles = mensajes
      .filter((m) => !m.pendiente)
      .slice(-MAX_MENSAJES)
      .map(({ id, rol, texto, hora, productos, armado, derivacion, feedback }) => ({
        id, rol, texto, hora, productos, armado, derivacion, feedback,
      }));
    almacen?.setItem(CLAVE, JSON.stringify({ sesion, modo, mensajes: persistibles, guardado: Date.now() }));
  } catch {
    /* Almacenamiento lleno o privado: el chat sigue andando sin persistir. */
  }
}

export function borrarConversacion(almacen = globalThis.localStorage) {
  try {
    almacen?.removeItem(CLAVE);
  } catch {
    /* sin almacenamiento disponible */
  }
}

/** Historial que viaja al backend: solo texto visible, sin el saludo local. */
export function historialParaApi(mensajes, maximo = 20) {
  return mensajes
    .filter((m) => !m.local && !m.error && m.texto.trim())
    .slice(-maximo)
    .map((m) => ({ rol: m.rol === "usuario" ? "usuario" : "asistente", texto: m.texto.slice(0, 4000) }));
}

/** Producto del carrito a partir de una tarjeta del chat (datos de la base). */
export function productoParaCarrito(tarjeta, base = "/") {
  const imagen = tarjeta.imagen && !/^https?:\/\//.test(tarjeta.imagen) ? `${base}${tarjeta.imagen}` : tarjeta.imagen;
  const conOferta = Number(tarjeta.precio) < Number(tarjeta.precio_lista);
  return {
    id: tarjeta.id,
    codigo: tarjeta.codigo,
    nombre: tarjeta.nombre,
    marca: tarjeta.marca,
    categoria: tarjeta.categoria,
    imagen,
    stock: tarjeta.stock,
    precio: conOferta ? tarjeta.precio_lista : tarjeta.precio,
    precio_con_descuento: conOferta ? tarjeta.precio : null,
  };
}

export function comprable(tarjeta) {
  return Number(tarjeta?.stock) > 0 && !tarjeta?.precio_a_confirmar && Number(tarjeta?.precio) > 0;
}
