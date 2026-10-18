import { useCallback, useEffect, useState } from "react";

const CLAVE = "ht-tema";
const OSCURO = "#0B0E14";
const CLARO = "#F4F6FB";

function temaInicial() {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado === "light" || guardado === "dark") return guardado;
  } catch {
    // localStorage bloqueado (modo privado, cookies off): se usa la preferencia del sistema.
  }
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return "dark";
}

function aplicar(tema) {
  const html = document.documentElement;
  html.dataset.theme = tema;
  html.style.colorScheme = tema;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", tema === "light" ? CLARO : OSCURO);
}


export function useTema() {
  const [tema, setTema] = useState(temaInicial);

  useEffect(() => {
    aplicar(tema);
  }, [tema]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const alCambiar = (e) => {
      let guardado = null;
      try {
        guardado = localStorage.getItem(CLAVE);
      } catch {
        // Sin acceso a localStorage: se trata como "sin eleccion guardada".
      }
      if (guardado !== "light" && guardado !== "dark") {
        setTema(e.matches ? "light" : "dark");
      }
    };
    if (mq.addEventListener) mq.addEventListener("change", alCambiar);
    else mq.addListener(alCambiar);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", alCambiar);
      else mq.removeListener(alCambiar);
    };
  }, []);

  const alternar = useCallback(() => {
    setTema((prev) => {
      const next = prev === "light" ? "dark" : "light";
      try {
        localStorage.setItem(CLAVE, next);
      } catch {
        // No se pudo persistir: el tema cambia igual, solo por esta sesion.
      }
      return next;
    });
  }, []);

  const fijarTema = useCallback((valor) => {
    if (valor !== "light" && valor !== "dark") return;
    try {
      localStorage.setItem(CLAVE, valor);
    } catch {
      // No se pudo persistir: el tema cambia igual, solo por esta sesion.
    }
    setTema(valor);
  }, []);

  return { tema, alternar, fijarTema };
}

export default useTema;
