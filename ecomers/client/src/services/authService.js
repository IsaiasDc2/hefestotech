import { supabase } from "../components/lib/supabaseClient";

const mapearUsuario = (user, session = null) => ({
  id: user.id,
  email: user.email,
  nombre: user.user_metadata?.nombre || user.email,
  ...(session ? { token: session.access_token } : {}),
});

export const loginUsuario = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(error.message);
  return {
    token: data.session.access_token,
    usuario: mapearUsuario(data.user, data.session),
  };
};

export const registrarUsuario = async (datos) => {
  const { data, error } = await supabase.auth.signUp({
    email: datos.email,
    password: datos.password,
    options: {
      data: { nombre: datos.nombre || datos.email },
    },
  });
  if (error) throw new Error(error.message);
  return {
    token: data.session?.access_token || null,
    usuario: mapearUsuario(data.user, data.session),
  };
};

export const obtenerUsuarioActual = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Sin sesion activa");
  return mapearUsuario(user);
};

export const cerrarSesion = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
};
