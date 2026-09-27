import api from "./api";

export const obtenerProductos = async () => {
  const response = await api.get("/productos");
  return response.data;
};

export const obtenerProductoPorId = async (id) => {
  const response = await api.get(`/productos/${id}`);
  return response.data;
};

export const buscarProductos = async (query) => {
  const response = await api.get("/productos/buscar", {
    params: { q: query },
  });
  return response.data;
};