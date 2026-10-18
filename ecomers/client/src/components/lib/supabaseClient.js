import { createClient } from "@supabase/supabase-js";
import { crearClienteDemo } from "../../demo/clienteDemo";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const configurado = Boolean(supabaseUrl && supabaseKey);

// Modo demo: catálogo local de solo lectura (src/demo). Se activa con
// VITE_DEMO=1 o cuando faltan las credenciales de Supabase, también en un
// build de producción: antes ese caso dejaba la página en blanco (el
// cliente fallaba al arrancar). La etiqueta fija "Modo demo" avisa que los
// precios son de ejemplo, así que no se confunde con la tienda real.
export const MODO_DEMO = import.meta.env.VITE_DEMO === "1" || !configurado;

if (!configurado && import.meta.env.PROD) {
  console.warn(
    "[supabase] Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY: la tienda corre en modo demo."
  );
}

export const supabase = MODO_DEMO
  ? crearClienteDemo()
  : createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
