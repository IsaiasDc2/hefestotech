import { useEffect } from "react";

// Marca global <html data-tab-oculta>: el CSS pausa los loops (shimmer de
// carga, animaciones del armador) cuando la pestaña no se ve.
export function usePausaPestana() {
  useEffect(() => {
    const html = document.documentElement;
    const actualizar = () => {
      html.dataset.tabOculta = document.hidden ? "true" : "false";
    };
    actualizar();
    const alBlur = () => {
      html.dataset.tabOculta = "true";
    };
    document.addEventListener("visibilitychange", actualizar);
    window.addEventListener("blur", alBlur);
    window.addEventListener("focus", actualizar);
    return () => {
      document.removeEventListener("visibilitychange", actualizar);
      window.removeEventListener("blur", alBlur);
      window.removeEventListener("focus", actualizar);
    };
  }, []);
}
