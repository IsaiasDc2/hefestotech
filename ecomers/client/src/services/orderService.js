import api from "./api";

export const crearOrden = async (datosOrden) => {
  const response = await api.post("/ordenes", datosOrden);
  return response.data;
};

export const obtenerMisOrdenes = async () => {
  const response = await api.get("/ordenes/mias");
  return response.data;
};

export const obtenerOrdenPorId = async (id) => {
  const response = await api.get(`/ordenes/${id}`);
  return response.data;
};