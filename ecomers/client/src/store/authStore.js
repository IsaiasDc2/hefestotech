import { create } from "zustand";
import { loginUsuario, registrarUsuario, obtenerUsuarioActual } from "../services/authService";

const useAuthStore = create((set) => ({
  usuario: null,
  isAuthenticated: false,
  cargando: false,
  error: null,

  login: async (email, password) => {
    set({ cargando: true, error: null });
    try {
      const data = await loginUsuario(email, password);
      localStorage.setItem("token", data.token);
      set({ usuario: data.usuario, isAuthenticated: true, cargando: false });
    } catch (err) {
      set({
        error: "Email o contraseña incorrectos",
        cargando: false,
      });
    }
  },

  registro: async (datos) => {
    set({ cargando: true, error: null });
    try {
      const data = await registrarUsuario(datos);
      localStorage.setItem("token", data.token);
      set({ usuario: data.usuario, isAuthenticated: true, cargando: false });
    } catch (err) {
      set({
        error: "No se pudo crear la cuenta",
        cargando: false,
      });
    }
  },

  cargarSesion: async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    set({ cargando: true });
    try {
      const usuario = await obtenerUsuarioActual();
      set({ usuario, isAuthenticated: true, cargando: false });
    } catch (err) {
      localStorage.removeItem("token");
      set({ usuario: null, isAuthenticated: false, cargando: false });
    }
  },

  logout: () => {
    localStorage.removeItem("token");
    set({ usuario: null, isAuthenticated: false });
  },
}));

export default useAuthStore;