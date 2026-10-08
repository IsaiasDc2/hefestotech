import { useEffect, useState } from "react";

export function usePrefersReducedMotion() {
  const [reducido, setReducido] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducido(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reducido;
}

export function useNumeroAnimado(valor, duracion = 500) {
  const [mostrado, setMostrado] = useState(valor);
  const reducido = usePrefersReducedMotion();

  useEffect(() => {
    if (reducido) {
      setMostrado(valor);
      return;
    }
    let raf = 0;
    const inicio = mostrado;
    if (inicio === valor) return;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / duracion);
      const e = 1 - Math.pow(1 - p, 3);
      setMostrado(Math.round(inicio + (valor - inicio) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor, duracion, reducido]);

  return mostrado;
}

export const formatoARS = (n) => `$ ${Number(n ?? 0).toLocaleString("es-AR")}`;
