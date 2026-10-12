import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./styles/index.css";

const BASENAME =
  import.meta.env.VITE_BASE ?? (import.meta.env.BASE_URL === "/" ? "/" : "/hefestotech");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename={BASENAME === "/" ? undefined : BASENAME}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
