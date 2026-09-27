import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages sirve el sitio en /hefestotech, no en la raiz del dominio
  base: "/hefestotech/",
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
});
