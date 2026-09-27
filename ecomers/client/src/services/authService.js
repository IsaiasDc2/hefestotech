import api from "./api";

export const loginUsuario = async (email, password) => {
  const response = await api.post("/auth/login", { email, password });
  return response.data;
};

export const registrarUsuario = async (datos) => {
  const response = await api.post("/auth/registro", datos);
  return response.data;
};

export const obtenerUsuarioActual = async () => {
  const response = await api.get("/auth/me");
  return response.data;
};