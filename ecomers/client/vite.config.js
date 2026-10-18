import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// CSP de producción: la de index.html trae los hosts locales para que el
// dev server funcione. En el build se quitan y se agrega el origen real del
// backend (VITE_API_URL), así producción no habilita conexiones a localhost.
function cspDeProduccion(apiUrl) {
  const local = /\s+https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/g;
  let origenApi = "";
  try {
    origenApi = apiUrl ? new URL(apiUrl).origin : "";
  } catch {
    origenApi = "";
  }
  return {
    name: "hefestotech-csp-produccion",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace(/connect-src 'self'[^;"]*/, (directiva) => {
        const limpia = directiva.replace(local, "");
        return origenApi && !limpia.includes(origenApi) && !/localhost|127\.0\.0\.1/.test(origenApi)
          ? `${limpia} ${origenApi}`
          : limpia;
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    // En Vercel se sirve desde la raíz: VITE_BASE=/ (ver panel).
    // En GitHub Pages se mantiene /hefestotech/.
    base: process.env.VITE_BASE ?? env.VITE_BASE ?? "/hefestotech/",
    plugins: [react(), cspDeProduccion(env.VITE_API_URL)],
    server: {
      port: 5173,
      host: true,
    },
    build: {
      rolldownOptions: {
        output: {
          // Librerías que cambian poco en chunks propios: un deploy que solo
          // toca la tienda no invalida la caché de React ni de Supabase.
          codeSplitting: {
            groups: [
              { name: "react", test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/, priority: 3 },
              { name: "supabase", test: /node_modules[\\/]@supabase[\\/]/, priority: 2 },
              { name: "iconos", test: /node_modules[\\/]react-icons[\\/]/, priority: 1 },
            ],
          },
        },
      },
    },
    test: {
      environment: "node",
      include: ["src/**/*.test.{js,jsx,mjs}"],
    },
  };
});
