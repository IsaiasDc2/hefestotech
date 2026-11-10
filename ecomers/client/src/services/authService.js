import { supabase } from "../components/lib/supabaseClient";

const texto = (v, max = 160) => String(v ?? "").trim().slice(0, max);

export const datosEnvioDe = (meta = {}) => ({
  direccion: texto(meta?.direccion),
  ciudad: texto(meta?.ciudad, 80),
  codigo_postal: texto(meta?.codigo_postal, 8),
});

const mapearUsuario = (user, session = null) => {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    nombre: user.user_metadata?.nombre || user.email,
    // Datos de envío cargados al registrarse (o en la última compra): el
    // checkout los completa solo. El pago nunca se guarda acá.
    envio: datosEnvioDe(user.user_metadata),
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
      data: { nombre: datos.nombre || datos.email, ...datosEnvioDe(datos) },
    },
  });
  if (error) throw new Error(error.message);
  return {
    token: data.session?.access_token || null,
    usuario: mapearUsuario(data.user, data.session),
  };
};

// Guarda los datos de envío en la cuenta (user_metadata) para que el próximo
// checkout ya los tenga. Solo dirección, ciudad y CP: nada de pagos.
export const guardarDatosEnvio = async (datos) => {
  const { data, error } = await supabase.auth.updateUser({ data: datosEnvioDe(datos) });
  if (error) throw new Error(error.message);
  return mapearUsuario(data.user);
};

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

// supabase-js emite onAuthStateChange DENTRO del lock de auth: si el callback
// vuelve a llamar a la librería (p. ej. getSession() para pedir permisos), se
// traba hasta el próximo refresco de la página. Por eso se difiere con
// setTimeout(0): corre recién cuando el lock ya se liberó.
export const suscribirCambiosAuth = (callback) => {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_evento, session) => {
    const usuario = session ? mapearUsuario(session.user, session) : null;
    setTimeout(() => callback(usuario), 0);
  });
  return () => subscription.unsubscribe();
};
