import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/hefestotech/",
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
});
