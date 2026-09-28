import { supabase } from "../components/lib/supabaseClient";

export const obtenerProductos = async () => {
  const { data, error } = await supabase.from("productos").select("*");
  if (error) throw new Error(error.message);
  return data;
};

export const obtenerProductoPorId = async (id) => {
  const { data, error } = await supabase
    .from("productos")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
};

export const buscarProductos = async (query) => {
  const { data, error } = await supabase
    .from("productos")
    .select("*")
    .or(`nombre.ilike.%${query}%,descripcion.ilike.%${query}%`);
  if (error) throw new Error(error.message);
  return data;
};
