// HefestoTech · sesión del panel: rol y permisos efectivos calculados por el
// backend (`GET /api/admin/sesion`). El frontend solo filtra la interfaz; cada
// endpoint vuelve a autorizar. Nunca se loguea ni se guarda el token.
import { supabase } from "../components/lib/supabaseClient";
import { mensajeDeError } from "../utils/errores";
import { API_BASE } from "./apiBase";

// `tokenConocido` evita volver a pedirle la sesión a supabase-js justo después
// de iniciar sesión, cuando el token ya lo tenemos en la mano.
export async function obtenerSesionAdmin(tokenConocido = "") {
  let token = tokenConocido || "";
  if (!token) {
    try {
      const { data } = await supabase.auth.getSession();
      token = data?.session?.access_token ?? "";
    } catch {
      /* sin sesión: token queda vacío */
    }
  }
  if (!token) {
    const e = new Error("Sesión inválida o vencida.");
    e.status = 401;
    throw e;
  }

  let respuesta;
  try {
    respuesta = await fetch(`${API_BASE}/api/admin/sesion`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    const e = new Error("Sin conexión con el backend.");
    e.status = 0;
    throw e;
  }

  let datos;
  try {
    datos = await respuesta.json();
  } catch {
    datos = {};
  }
  if (!respuesta.ok) {
    const e = new Error(mensajeDeError(datos, respuesta.status));
    e.status = respuesta.status;
    throw e;
  }

  return {
    usuario: datos?.usuario ?? null,
    permisos: Array.isArray(datos?.permisos) ? datos.permisos : [],
  };
}
