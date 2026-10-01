import { supabase } from "../components/lib/supabaseClient";

const mapearUsuario = (user, session = null) => {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    nombre: user.user_metadata?.nombre || user.email,
    ...(session ? { token: session.access_token } : {}),
  };
};

export const loginUsuario = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(error.message);
  if (!data.session) throw new Error("Sin sesion activa");
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
  // Con confirmación de email activada, session viene null: no es error.
  return {
    token: data.session?.access_token || null,
    usuario: mapearUsuario(data.user, data.session),
  };
};

// Fuente de verdad de la sesión: Supabase persiste solo en localStorage
// (sb-<ref>-auth-token). No usar el "token" manual anterior.
export const obtenerSesion = async () => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  if (!session) return null;
  return {
    token: session.access_token,
    usuario: mapearUsuario(session.user, session),
  };
};

export const obtenerUsuarioActual = async () => {
  const sesion = await obtenerSesion();
  if (!sesion) throw new Error("Sin sesion activa");
  return sesion.usuario;
};

export const cerrarSesion = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
};

// Suscripción a cambios de auth (login/logout/refresh). Devuelve unsubscribe.
export const suscribirCambiosAuth = (callback) => {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_evento, session) => {
    callback(session ? mapearUsuario(session.user, session) : null);
  });
  return () => subscription.unsubscribe();
};
