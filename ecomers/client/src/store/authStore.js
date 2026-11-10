import { create } from "zustand";
import { loginUsuario, registrarUsuario, obtenerSesion, cerrarSesion, suscribirCambiosAuth } from "../services/authService";
import { obtenerSesionAdmin } from "../services/sesionAdminService";
import useIdiomaStore, { t } from "./idiomaStore";
import { traducirErrorAuth } from "../utils/errores";

// Textos en el idioma activo al momento del error.
const idiomaActual = () => useIdiomaStore.getState().idioma;
const textoDe = (clave) => t(idiomaActual(), clave);
const mensajeDe = (err, clave) => traducirErrorAuth(err?.message, idiomaActual()) || textoDe(clave);

// Campos que dependen de la matriz de permisos. Se resetean juntos al salir.
const SIN_ACCESO = {
  perfil: null,
  permisos: [],
  esStaff: false,
  accesoAdmin: "desconocido",
  permisosCargando: false,
};

// Una sola revalidación en vuelo por usuario: evita pedir /api/admin/sesion
// dos veces cuando `cargarSesion` y el evento de auth llegan juntos.
let revalidacion = null;

const useAuthStore = create((set, get) => ({
  usuario: null,
  perfil: null,
  permisos: [],
  isAuthenticated: false,
  estadoAuth: "inicial", // inicial | cargando | autenticado | invitado
  esStaff: false,
  accesoAdmin: "desconocido", // desconocido | autorizado | denegado | error
  permisosCargando: false,
  cargando: false,
  error: null,

  // Permiso efectivo según el backend. No autoriza nada por sí solo.
  puede: (modulo, accion) => get().permisos.includes(`${modulo}.${accion}`),

  revalidar: async (tokenConocido = "") => {
    if (!get().isAuthenticated || !get().usuario) {
      set({ ...SIN_ACCESO });
      return;
    }
    const uid = get().usuario.id;
    if (revalidacion?.uid === uid) return revalidacion.promesa;

    set({ permisosCargando: true });
    const promesa = (async () => {
      try {
        const datos = await obtenerSesionAdmin(tokenConocido);
        // Si la sesión cambió mientras viajaba la respuesta, se descarta.
        if (!get().isAuthenticated || get().usuario?.id !== uid) return;
        set({
          perfil: datos.usuario,
          permisos: datos.permisos,
          esStaff: true,
          accesoAdmin: "autorizado",
          permisosCargando: false,
        });
      } catch (err) {
        if (!get().isAuthenticated || get().usuario?.id !== uid) return;
        const negado = err?.status === 401 || err?.status === 403;
        set({
          perfil: null,
          permisos: [],
          esStaff: false,
          accesoAdmin: negado ? "denegado" : "error",
          permisosCargando: false,
        });
      }
    })();
    revalidacion = { uid, promesa };
    try {
      await promesa;
    } finally {
      if (revalidacion?.promesa === promesa) revalidacion = null;
    }
  },

  login: async (email, password) => {
    set({ cargando: true, error: null });
    try {
      const data = await loginUsuario(email, password);
      // Sin copia del JWT en localStorage: supabase-js ya persiste la
      // sesión; duplicarla amplía la superficie de robo ante XSS.
      set({
        usuario: data.usuario,
        isAuthenticated: true,
        estadoAuth: "autenticado",
        cargando: false,
        ...SIN_ACCESO,
      });
      // No bloquea el login: si Render está despertando, el guard muestra
      // "verificando" mientras llega la respuesta. Se le pasa el token recién
      // emitido para no volver a consultar a supabase-js.
      void get().revalidar(data.token);
    } catch (err) {
      set({
        error: mensajeDe(err, "auth.errLogin"),
        cargando: false,
      });
    }
  },

  registro: async (datos) => {
    set({ cargando: true, error: null });
    try {
      const data = await registrarUsuario(datos);
      if (data.token) {
        set({
          usuario: data.usuario,
          isAuthenticated: true,
          estadoAuth: "autenticado",
          cargando: false,
          ...SIN_ACCESO,
        });
      } else {
        set({
          usuario: null,
          isAuthenticated: false,
          estadoAuth: "invitado",
          cargando: false,
          ...SIN_ACCESO,
        });
      }
      return data;
    } catch (err) {
      set({
        error: mensajeDe(err, "auth.errRegistro"),
        cargando: false,
      });
      throw err;
    }
  },

  cargarSesion: async () => {
    set({ cargando: true, estadoAuth: "cargando" });
    try {
      const sesion = await obtenerSesion();
      if (!sesion) {
        set({
          usuario: null,
          isAuthenticated: false,
          cargando: false,
          estadoAuth: "invitado",
          ...SIN_ACCESO,
        });
        return;
      }
      set({
        usuario: sesion.usuario,
        isAuthenticated: true,
        cargando: false,
        estadoAuth: "autenticado",
      });
      await get().revalidar();
    } catch (err) {
      set({
        usuario: null,
        isAuthenticated: false,
        cargando: false,
        estadoAuth: "invitado",
        error: err.message,
        ...SIN_ACCESO,
      });
    }
  },

  suscribirseACambios: () =>
    suscribirCambiosAuth((usuario) => {
      if (!usuario) {
        set({
          usuario: null,
          isAuthenticated: false,
          estadoAuth: "invitado",
          ...SIN_ACCESO,
        });
        return;
      }
      const anterior = get().usuario;
      const cambioDeCuenta = anterior?.id !== usuario.id;
      set({
        usuario,
        isAuthenticated: true,
        estadoAuth: "autenticado",
      });
      // Un refresh de token del mismo usuario no dispara otra consulta si ya
      // tiene permisos; si el intento anterior falló, sí se reintenta.
      if (cambioDeCuenta || !get().esStaff) void get().revalidar();
    }),

  logout: async () => {
    try {
      await cerrarSesion();
    } finally {
      set({
        usuario: null,
        isAuthenticated: false,
        estadoAuth: "invitado",
        cargando: false,
        error: null,
        ...SIN_ACCESO,
      });
    }
  },
}));

export default useAuthStore;
