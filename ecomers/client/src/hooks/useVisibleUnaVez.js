import { useCallback, useState } from "react";

/**
 * Devuelve [ref, visible]: `visible` pasa a true la primera vez que el
 * elemento entra al viewport y no vuelve atrás.
 *
 * Usa la limpieza de ref callbacks de React 19: el observer vive y muere
 * con el nodo, así que StrictMode o un remontaje nunca dejan el contenido
 * oculto (antes el cleanup de un useEffect desconectaba el observer y la
 * grilla de /productos quedaba con opacidad 0).
 */
export default function useVisibleUnaVez({ umbral = 0.1, margen = "0px 0px -8% 0px" } = {}) {
  const [visible, setVisible] = useState(false);

  const ref = useCallback(
    (el) => {
      if (!el) return undefined;
      const sinAnimacion =
        typeof IntersectionObserver === "undefined" ||
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (sinAnimacion) {
        setVisible(true);
        return undefined;
      }
      const obs = new IntersectionObserver(
        (entradas) => {
          if (entradas.some((e) => e.isIntersecting)) {
            setVisible(true);
            obs.disconnect();
          }
        },
        { threshold: umbral, rootMargin: margen }
      );
      obs.observe(el);
      return () => obs.disconnect();
    },
    [umbral, margen]
  );

  return [ref, visible];
}
