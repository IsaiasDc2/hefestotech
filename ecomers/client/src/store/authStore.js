import { create } from "zustand";
import { loginUsuario, registrarUsuario, obtenerSesion, cerrarSesion, suscribirCambiosAuth } from "../services/authService";

const useAuthStore = create((set) => ({
  usuario: null,
  isAuthenticated: false,
  cargando: false,
  error: null,

  login: async (email, password) => {
    set({ cargando: true, error: null });
    try {
      const data = await loginUsuario(email, password);
      // La sesión la persiste Supabase (sb-*-auth-token); solo se guarda
      // el token como respaldo para interceptores que lo lean.
      if (data.token) localStorage.setItem("token", data.token);
      set({ usuario: data.usuario, isAuthenticated: true, cargando: false });
    } catch (err) {
      set({
        error: err.message || "Email o contraseña incorrectos",
        cargando: false,
      });
    }
  },

  registro: async (datos) => {
    set({ cargando: true, error: null });
    try {
      const data = await registrarUsuario(datos);
      if (data.token) localStorage.setItem("token", data.token);
      // Sin token (confirmación por email) no hay sesión todavía.
      if (data.token) {
        set({ usuario: data.usuario, isAuthenticated: true, cargando: false });
      } else {
        set({ usuario: null, isAuthenticated: false, cargando: false });
      }
      return data;
    } catch (err) {
      set({
        error: err.message || "No se pudo crear la cuenta",
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
        localStorage.removeItem("token");
        set({ usuario: null, isAuthenticated: false, cargando: false });
        return;
      }
      if (sesion.token) localStorage.setItem("token", sesion.token);
      set({ usuario: sesion.usuario, isAuthenticated: true, cargando: false });
    } catch (err) {
      localStorage.removeItem("token");
      set({ usuario: null, isAuthenticated: false, cargando: false, error: err.message });
    }
  },

  // Sincroniza el store con refresh de token / logout en otra pestaña.
  // Llamar una vez al arrancar la app. Devuelve función para desuscribir.
  suscribirseACambios: () =>
    suscribirCambiosAuth((usuario) => {
      if (usuario) {
        set({ usuario, isAuthenticated: true });
      } else {
        localStorage.removeItem("token");
        set({ usuario: null, isAuthenticated: false });
      }
    }),

  logout: async () => {
    try {
      await cerrarSesion();
    } finally {
      localStorage.removeItem("token");
      set({ usuario: null, isAuthenticated: false });
    }
  },
}));

export default useAuthStore;
