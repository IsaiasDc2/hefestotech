import { useCallback, useSyncExternalStore } from "react";

const CLAVE = "ht-tema";
const OSCURO = "#0A0B0D";
const CLARO = "#F5F6F8";

// Estado único de tema para toda la app (header, menú móvil): antes cada
// componente tenía su propia copia y el botón del header quedaba desfasado.
const oyentes = new Set();

// Oscuro es la identidad de la marca: claro solo si el cliente lo eligió.
function leer() {
  if (typeof document !== "undefined" && document.documentElement.dataset.theme) {
    return document.documentElement.dataset.theme === "light" ? "light" : "dark";
  }
  try {
    return localStorage.getItem(CLAVE) === "light" ? "light" : "dark";
  } catch {
    // Storage bloqueado: queda el tema de la marca.
    return "dark";
  }
}

function aplicar(tema) {
  const html = document.documentElement;
  html.dataset.theme = tema;
  html.style.colorScheme = tema;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", tema === "light" ? CLARO : OSCURO);
  try {
    localStorage.setItem(CLAVE, tema);
  } catch {
    // Sin storage el cambio vale para esta visita.
  }
  oyentes.forEach((fn) => fn());
}

function suscribir(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

export function useTema() {
  const tema = useSyncExternalStore(suscribir, leer, () => "dark");

  const alternar = useCallback(() => aplicar(leer() === "light" ? "dark" : "light"), []);
  const fijarTema = useCallback((valor) => {
    if (valor === "light" || valor === "dark") aplicar(valor);
  }, []);

  return { tema, alternar, fijarTema };
}

export default useTema;
