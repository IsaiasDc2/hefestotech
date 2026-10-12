import { useEffect, useRef, useState } from "react";

// Utilidades de motion compartidas (HefestoTech).
// Solo transform/opacity, IntersectionObserver + rAF, sin librerias.
// Todo efecto es diferido (corre post-montaje) y respeta
// prefers-reduced-motion + pestana oculta.

export function movimientoReducido() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function punteroFino() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches
  );
}

// Marca global <html data-tab-oculta>: el CSS pausa los loops
// (camion topbar, envio, shimmer, pulsos) cuando no se ven.
export function usePausaPestana() {
  useEffect(() => {
    const html = document.documentElement;
    const actualizar = () => {
      html.dataset.tabOculta = document.hidden ? "true" : "false";
    };
    actualizar();
    const alFoco = () => actualizar();
    const alBlur = () => {
      html.dataset.tabOculta = "true";
    };
    document.addEventListener("visibilitychange", actualizar);
    window.addEventListener("blur", alBlur);
    window.addEventListener("focus", alFoco);
    return () => {
      document.removeEventListener("visibilitychange", actualizar);
      window.removeEventListener("blur", alBlur);
      window.removeEventListener("focus", alFoco);
    };
  }, []);
}

// Observa un elemento una sola vez (reveal). Devuelve [ref, visible].
export function useVisibleUnaVez(umbral = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === "undefined" || movimientoReducido()) {
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
      { threshold: umbral, rootMargin: "0px 0px -8% 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [umbral]);

  return [ref, visible];
}

// Publica si el hero esta en pantalla: <html data-hero-visible>.
// Sirve para pausar/reanudar loops (circuito, camioncito) y no
// gastar frames fuera de pantalla.
export function useHeroVisible(ref) {
  useEffect(() => {
    const el = ref.current;
    const html = document.documentElement;
    if (!el || typeof IntersectionObserver === "undefined") {
      html.dataset.heroVisible = "true";
      return undefined;
    }
    const obs = new IntersectionObserver(
      (entradas) => {
        const alguna = entradas.some((e) => e.isIntersecting);
        html.dataset.heroVisible = alguna ? "true" : "false";
      },
      { threshold: 0 }
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      html.dataset.heroVisible = "false";
    };
  }, [ref]);
}

// Scroll ligado a un elemento con rAF (pasivo, sin secuestrar scroll).
// fn(rect, viewportH, el) solo corre si el elemento esta en pantalla,
// la pestana esta visible y no hay movimiento reducido.
export function useScrollLigado(ref, fn) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    const el = ref.current;
    if (!el || movimientoReducido()) return undefined;
    let raf = 0;
    let sucio = false;
    const calcular = () => {
      sucio = false;
      if (document.hidden) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      if (rect.bottom <= 0 || rect.top >= vh) return;
      fnRef.current(rect, vh, el);
    };
    const pedir = () => {
      if (!sucio) {
        sucio = true;
        raf = requestAnimationFrame(calcular);
      }
    };
    pedir();
    window.addEventListener("scroll", pedir, { passive: true });
    window.addEventListener("resize", pedir);
    return () => {
      window.removeEventListener("scroll", pedir);
      window.removeEventListener("resize", pedir);
      cancelAnimationFrame(raf);
    };
  }, [ref]);
}

// Tilt 3D (maximo ±max grados) + posicion del brillo especular.
// Solo con puntero fino; el CSS decide via --rx/--ry/--mx/--my.
export function useTilt(ref, max = 6) {
  useEffect(() => {
    const el = ref.current;
    if (!el || movimientoReducido() || !punteroFino()) return undefined;
    let raf = 0;
    const aplicar = (rx, ry, mx, my) => {
      el.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
      el.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
      el.style.setProperty("--mx", `${mx.toFixed(1)}%`);
      el.style.setProperty("--my", `${my.toFixed(1)}%`);
    };
    const alMover = (e) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        aplicar(-py * max * 2, px * max * 2, (px + 0.5) * 100, (py + 0.5) * 100);
      });
    };
    const alSalir = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => aplicar(0, 0, 50, 50));
    };
    el.addEventListener("pointermove", alMover, { passive: true });
    el.addEventListener("pointerleave", alSalir);
    return () => {
      el.removeEventListener("pointermove", alMover);
      el.removeEventListener("pointerleave", alSalir);
      cancelAnimationFrame(raf);
    };
  }, [ref, max]);
}

// Count-up para cifras que YA muestra el sitio (data-countup).
// El HTML trae el valor final: sin JS o con movimiento reducido
// se ve el numero real. Ancho fijado al iniciar (CLS 0), pausa si
// la pestana se oculta, corre una sola vez al entrar.
export function useCountUpGrupo(ref, duracion = 900) {
  useEffect(() => {
    const zona = ref.current;
    if (!zona || movimientoReducido()) return undefined;
    const nodos = Array.from(zona.querySelectorAll("[data-countup]"));
    if (!nodos.length || typeof IntersectionObserver === "undefined") {
      return undefined;
    }
    let cancelado = false;
    const rafs = new Set();
    const timeouts = new Set();
    const formatear = (nodo, valor) => {
      const n = Math.max(0, Math.round(valor));
      if (nodo.dataset.formato === "ars") {
        return `$${n.toLocaleString("es-AR")}`;
      }
      return `${n}`;
    };
    const animar = (nodo, demora) => {
      const destino = Number(nodo.dataset.countup || "0");
      if (!Number.isFinite(destino)) return;
      const final = nodo.dataset.final || nodo.textContent;
      const ancho = nodo.offsetWidth || 0;
      if (ancho > 0) nodo.style.minWidth = `${ancho}px`;
      nodo.style.display = "inline-block";
      nodo.style.fontVariantNumeric = "tabular-nums";
      const inicio = performance.now() + demora;
      let ultimo = inicio;
      let transcurrido = 0;
      const paso = (ahora) => {
        rafs.delete(paso);
        if (cancelado) return;
        const dt = ahora - ultimo;
        ultimo = ahora;
        if (document.hidden) {
          const id = requestAnimationFrame(paso);
          rafs.add(id);
          return;
        }
        if (ahora >= inicio) transcurrido += dt;
        const t = Math.min(1, transcurrido / duracion);
        const ease = 1 - (1 - t) * (1 - t) * (1 - t);
        if (t < 1) {
          nodo.textContent = formatear(nodo, destino * ease);
          const id = requestAnimationFrame(paso);
          rafs.add(id);
        } else {
          nodo.textContent = final;
          nodo.style.minWidth = "";
        }
      };
      const id = requestAnimationFrame(paso);
      rafs.add(id);
    };
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          obs.disconnect();
          nodos.forEach((nodo, i) => {
            const t = setTimeout(() => animar(nodo, 0), i * 90);
            timeouts.add(t);
          });
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(zona);
    return () => {
      cancelado = true;
      obs.disconnect();
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      rafs.forEach((id) => cancelAnimationFrame(id));
      rafs.clear();
    };
  }, [ref, duracion]);
}
