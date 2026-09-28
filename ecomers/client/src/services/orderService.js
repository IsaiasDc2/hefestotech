import { supabase } from "../components/lib/supabaseClient";

const sesionUsuarioId = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sin sesion activa");
  return user.id;
};

export const crearOrden = async (datosOrden) => {
  const user_id = await sesionUsuarioId();
  const { items = [], ...orden } = datosOrden;

  const { data: creada, error } = await supabase
    .from("ordenes")
    .insert({ ...orden, user_id })
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (items.length > 0) {
    const filas = items.map((item) => ({
      orden_id: creada.id,
      producto_id: item.id,
      cantidad: item.cantidad,
      precio: item.precio,
    }));
    const { error: errorItems } = await supabase
      .from("orden_items")
      .insert(filas);
    if (errorItems) throw new Error(errorItems.message);
  }

  return { ...creada, items };
};

export const obtenerMisOrdenes = async () => {
  const user_id = await sesionUsuarioId();
  const { data, error } = await supabase
    .from("ordenes")
    .select("*, orden_items(*)")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
};

export const obtenerOrdenPorId = async (id) => {
  const { data, error } = await supabase
    .from("ordenes")
    .select("*, orden_items(*)")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
};
