import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
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
    const base = BASENAME === "/" ? "" : BASENAME;
    if (window.location.pathname.replace(/\/+$/, "") === base.replace(/\/+$/, "") || window.location.pathname === `${base}/`) {
      window.history.replaceState(null, "", `${base}${destino}`);
    }
  }
} catch {
  // sessionStorage no disponible: se queda en la home, sin romper el boot.
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename={BASENAME === "/" ? undefined : BASENAME}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
