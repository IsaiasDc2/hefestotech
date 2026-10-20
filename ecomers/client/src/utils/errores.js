import { t } from "../store/idiomaStore";

// Mensajes de error que ve el cliente: los del backend (siempre en español,
// ver checkout_api.py / contacto_api.py) y los que arma el propio front.
// En inglés se traducen por coincidencia exacta; lo desconocido (por ejemplo
// el texto de otro servicio) se muestra tal cual, nunca se pierde.
const ERRORES_EN = {
  // Cliente (orderService.js)
  "Sin conexión con el backend.": "Can't reach the server.",
  "Backend no configurado (VITE_API_URL).": "Backend not configured (VITE_API_URL).",
  // Backend: general
  "Backend sin conexión a la base de datos.": "The backend can't reach the database.",
  "No se pudo consultar la base de datos.": "Couldn't query the database.",
  "No se pudo guardar en la base de datos.": "Couldn't save to the database.",
  "No se pudo completar la operación.": "Couldn't complete the operation.",
  "Sesión inválida o vencida.": "Invalid or expired session.",
  "No se pudo validar la sesión.": "Couldn't validate the session.",
  "Demasiadas solicitudes. Esperá un momento.": "Too many requests. Please wait a moment.",
  "Sin permiso.": "No permission.",
  "Sin permiso sobre esa orden.": "You don't have access to that order.",
  // Backend: pagos
  "Pagos no configurados.": "Payments aren't configured.",
  "Pagos no configurados (BACKEND_URL).": "Payments aren't configured.",
  "Esa compra ya fue procesada. Revisá tus pedidos.":
    "That purchase was already processed. Check your orders.",
  "No se pudo generar el link de pago. Intentá de nuevo más tarde.":
    "Couldn't generate the payment link. Please try again later.",
  "No se pudo verificar el pago.": "Couldn't verify the payment.",
  // Backend: orden
  "No se pudo crear la orden.": "Couldn't create the order.",
  "Orden inexistente.": "Order doesn't exist.",
  "La orden ya no admite reintento.": "This order can no longer be retried.",
  "La orden no tiene ítems.": "The order has no items.",
  "La orden no tiene total válido.": "The order has no valid total.",
  "La orden ya se está reintentando.": "The order is already being retried.",
  "Comprobante inexistente.": "Receipt doesn't exist.",
  // Backend: productos y cupones
  "Producto inexistente o no disponible.": "Product doesn't exist or isn't available.",
  "Producto no disponible.": "Product not available.",
  "Producto sin precio válido.": "Product has no valid price.",
  "Stock insuficiente.": "Insufficient stock.",
  "Cupón inexistente.": "Coupon doesn't exist.",
  "Cupón inactivo.": "Coupon is inactive.",
  "Cupón vencido.": "Coupon has expired.",
  "Cupón agotado.": "Coupon has no uses left.",
  "Cupón inválido.": "Invalid coupon.",
  "No alcanza el mínimo de compra.": "Minimum purchase not reached.",
  // Backend: contacto
  "Servicio no configurado.": "Service not configured.",
  "No se pudo guardar. Intentá más tarde.": "Couldn't save. Please try again later.",
  "Duplicado.": "Duplicate.",
};

export const MENSAJES_ERROR_EN = ERRORES_EN;

// Mensajes de Supabase Auth (siempre en inglés) → clave del diccionario, para
// que la persona los lea en el idioma que eligió.
const ERRORES_AUTH = [
  [/invalid login credentials/i, "auth.errLogin"],
  [/email not confirmed/i, "auth.errNoConfirmado"],
  [/already (been )?registered|already exists/i, "auth.errYaExiste"],
  [/password should be at least/i, "reg.passCorta"],
  [/invalid format|valid email|unable to validate email/i, "auth.errEmailInvalido"],
  [/rate limit|only request this after|too many requests/i, "auth.errDemasiados"],
  [/failed to fetch|network|fetch failed/i, "auth.errRed"],
];

/**
 * Texto del error de una respuesta del backend. FastAPI devuelve `detail` como
 * texto, o como lista de errores de validación ({loc, msg}) en los 422: sin
 * esto el aviso mostraba "[object Object]".
 */
export function mensajeDeError(datos, status) {
  const detalle = datos?.detail;
  if (typeof detalle === "string" && detalle.trim()) return detalle;
  if (Array.isArray(detalle) && detalle.length > 0) {
    const texto = detalle
      .map((d) => {
        const msg = String(d?.msg ?? "").replace(/^Value error,\s*/i, "");
        const campo = Array.isArray(d?.loc) ? d.loc.filter((x) => x !== "body").join(".") : "";
        return campo && msg ? `${campo}: ${msg}` : msg;
      })
      .filter(Boolean)
      .join(" · ");
    if (texto) return texto;
  }
  return `Error ${status}`;
}

/** Texto de un error de login/registro en el idioma activo (o el original). */
export function traducirErrorAuth(mensaje, idioma) {
  if (typeof mensaje !== "string") return mensaje;
  const hit = ERRORES_AUTH.find(([patron]) => patron.test(mensaje));
  return hit ? t(idioma, hit[1]) : mensaje;
}

/** Mensaje del error en el idioma activo (idioma "es" lo deja igual). */
export function traducirError(mensaje, idioma) {
  if (idioma !== "en" || typeof mensaje !== "string") return mensaje;
  return ERRORES_EN[mensaje.trim()] ?? mensaje;
}
