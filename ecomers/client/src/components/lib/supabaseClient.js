import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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

if (!supabaseUrl || !supabaseKey) {
  console.error(`[supabase] ${missingEnvError}`);
}

export const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : createMissingClient();
