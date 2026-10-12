import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // En Vercel se sirve desde la raíz: VITE_BASE=/ (ver panel).
  // En GitHub Pages se mantiene /hefestotech/.
  base: process.env.VITE_BASE ?? "/hefestotech/",
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
});
