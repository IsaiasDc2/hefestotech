import { exigirSupabase } from "../components/lib/supabaseClient";

export const normalizarProducto = (p = {}) => {
  const precio = Number(p.precio ?? 0);
  const descuento = Number(p.descuento_porcentaje ?? 0);
  const conDescuento =
    p.precio_con_descuento != null
      ? Number(p.precio_con_descuento)
      : descuento > 0
        ? Math.round(precio * (1 - descuento / 100))
        : precio;
  return {
    ...p,
    precio,
    descuento_porcentaje: descuento,
    precio_con_descuento: conDescuento,
    stock: Number(p.stock ?? 0),
    imagen: p.imagen || "",
    categoria: p.categoria || "General",
    envio_gratis: Boolean(p.envio_gratis),
    destacado: Boolean(p.destacado),
  };
};

export const precioFinal = (producto = {}) => {
  if (producto.precio_con_descuento != null)
    return Number(producto.precio_con_descuento);
  const descuento = Number(producto.descuento_porcentaje ?? 0);
  const precio = Number(producto.precio ?? 0);
  if (descuento > 0) return Math.round(precio * (1 - descuento / 100));
  return precio;
};

export const obtenerProductos = async () => {
  const { data, error } = await exigirSupabase()
    .from("productos")
    .select("*")
    .eq("activo", true);
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data : []).map(normalizarProducto);
};

export const obtenerProductoPorId = async (id) => {
  const { data, error } = await exigirSupabase()
    .from("productos")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return normalizarProducto(data);
};

export const buscarProductos = async (query) => {
  const q = String(query ?? "").replace(/[%_,]/g, "").trim();
  if (!q) return obtenerProductos();
  const { data, error } = await exigirSupabase()
    .from("productos")
    .select("*")
    .eq("activo", true)
    .or(`nombre.ilike.%${q}%,descripcion.ilike.%${q}%,marca.ilike.%${q}%`);
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data : []).map(normalizarProducto);
};

export const obtenerProductosDestacados = async (limite = 8) => {
  const { data, error } = await exigirSupabase()
    .from("productos")
    .select("*")
    .eq("activo", true)
    .eq("destacado", true)
    .limit(limite);
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data : []).map(normalizarProducto);
};

export const obtenerOfertas = async (limite = 10) => {
  const { data, error } = await exigirSupabase()
    .from("productos")
    .select("*")
    .eq("activo", true)
    .gt("descuento_porcentaje", 0)
    .limit(limite);
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data : []).map(normalizarProducto);
};

export const obtenerCategorias = async () => {
  const { data, error } = await exigirSupabase()
    .from("categorias")
    .select("*")
    .order("nombre");
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data : [];
};
