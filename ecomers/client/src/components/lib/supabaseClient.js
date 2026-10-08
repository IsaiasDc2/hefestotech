import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigurada = Boolean(supabaseUrl && supabaseKey);

if (!supabaseConfigurada) {
  console.warn(
    "[HefestoTech] Falta VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY en .env.local. " +
      "La app arranca igual, pero el catálogo y la cuenta quedan deshabilitados."
  );
}

export const supabase = supabaseConfigurada
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// Llamar al inicio de cada operación contra Supabase: lanza un error claro
// (los componentes ya lo capturan y muestran estado vacío/error).
export function exigirSupabase() {
  if (!supabase) {
    throw new Error(
      "Supabase no está configurada. Copiá .env.example a .env.local y completá las claves."
    );
  }
  return supabase;
}
