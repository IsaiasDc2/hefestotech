import { createClient } from "@supabase/supabase-js";
import { crearClienteDemo } from "../../demo/clienteDemo";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const configurado = Boolean(supabaseUrl && supabaseKey);

// Modo demo: catálogo local de solo lectura (src/demo). Se activa con
// VITE_DEMO=1 o, en desarrollo, cuando faltan credenciales. En un build
// de producción sin credenciales NO se activa solo: mostrar precios de
// ejemplo a clientes reales sería engañoso.
export const MODO_DEMO =
  import.meta.env.VITE_DEMO === "1" || (!configurado && import.meta.env.DEV);

const missingEnvError =
  "Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY en .env.local";

function createMissingClient() {
  const fail = () => {
    throw new Error(missingEnvError);
  };
  const proxy = new Proxy(() => {}, {
    get(_target, prop) {
      if (prop === Symbol.toPrimitive) return fail;
      return proxy;
    },
    apply: fail,
    construct: fail,
  });
  return proxy;
}

if (!configurado && !MODO_DEMO) {
  console.error(`[supabase] ${missingEnvError}`);
}

export const supabase = MODO_DEMO
  ? crearClienteDemo()
  : configurado
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : createMissingClient();
