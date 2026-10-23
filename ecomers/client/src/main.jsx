import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App.jsx";
import ErrorGeneral from "./components/ErrorGeneral.jsx";
// Fuentes variables autoalojadas (sin Google Fonts: nada bloqueante de
// terceros y la CSP no necesita hosts externos). Solo pesos usados.
import "@fontsource-variable/geist/wght.css";
import "@fontsource-variable/geist-mono/wght.css";
import "./styles/index.css";

const BASENAME =
  import.meta.env.VITE_BASE ?? (import.meta.env.BASE_URL === "/" ? "/" : "/hefestotech");

// Fallback SPA de GitHub Pages: public/404.html guarda la ruta pedida en
// sessionStorage ("ht-redirect") y vuelve a la base; acá se restaura antes
// de montar el router para que la ruta profunda funcione al recargar o
// entrar directo (se corre en módulo propio, permitido por la CSP).
try {
  const destino = sessionStorage.getItem("ht-redirect");
  if (destino && destino.startsWith("/")) {
    sessionStorage.removeItem("ht-redirect");
    // Sin barra final: con VITE_BASE=/hefestotech/ salía /hefestotech//carrito
    // y la app mostraba "no encontrada" en rutas privadas abiertas por enlace.
    const base = BASENAME === "/" ? "" : BASENAME.replace(/\/+$/, "");
    if (window.location.pathname.replace(/\/+$/, "") === base.replace(/\/+$/, "") || window.location.pathname === `${base}/`) {
      window.history.replaceState(null, "", `${base}${destino}`);
    }
  }
} catch {
  // sessionStorage no disponible: se queda en la home, sin romper el boot.
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorGeneral>
      <BrowserRouter basename={BASENAME === "/" ? undefined : BASENAME}>
        <App />
      </BrowserRouter>
    </ErrorGeneral>
  </React.StrictMode>
);
