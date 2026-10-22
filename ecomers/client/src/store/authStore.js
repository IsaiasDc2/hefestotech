import { create } from "zustand";
import { loginUsuario, registrarUsuario, obtenerSesion, cerrarSesion, suscribirCambiosAuth } from "../services/authService";
import useIdiomaStore, { t } from "./idiomaStore";
import { traducirErrorAuth } from "../utils/errores";

// Textos en el idioma activo al momento del error.
const idiomaActual = () => useIdiomaStore.getState().idioma;
const textoDe = (clave) => t(idiomaActual(), clave);
const mensajeDe = (err, clave) => traducirErrorAuth(err?.message, idiomaActual()) || textoDe(clave);

const useAuthStore = create((set) => ({
  usuario: null,
  isAuthenticated: false,
  cargando: false,
  error: null,

  login: async (email, password) => {
    set({ cargando: true, error: null });
    try {
      const data = await loginUsuario(email, password);
      // Sin copia del JWT en localStorage: supabase-js ya persiste la
      // sesión; duplicarla amplía la superficie de robo ante XSS.
      set({ usuario: data.usuario, isAuthenticated: true, cargando: false });
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
        set({ usuario: data.usuario, isAuthenticated: true, cargando: false });
      } else {
        set({ usuario: null, isAuthenticated: false, cargando: false });
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
    set({ cargando: true });
    try {
      const sesion = await obtenerSesion();
      if (!sesion) {
        set({ usuario: null, isAuthenticated: false, cargando: false });
        return;
      }
      set({ usuario: sesion.usuario, isAuthenticated: true, cargando: false });
    } catch (err) {
      set({ usuario: null, isAuthenticated: false, cargando: false, error: err.message });
    }
  },

  suscribirseACambios: () =>
    suscribirCambiosAuth((usuario) => {
      if (usuario) {
        set({ usuario, isAuthenticated: true });
      } else {
        set({ usuario: null, isAuthenticated: false });
      }
    }),

  logout: async () => {
    try {
      await cerrarSesion();
    } finally {
      set({ usuario: null, isAuthenticated: false });
    }
  },
}));

export default useAuthStore;
