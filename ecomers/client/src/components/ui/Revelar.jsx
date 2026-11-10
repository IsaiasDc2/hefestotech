import useVisibleUnaVez from "../../hooks/useVisibleUnaVez";

// Aparición al entrar en pantalla, una sola vez. `escalonado` hace entrar a
// los hijos uno detrás de otro (clases .reveal / .stagger de index.css, que
// ya respetan prefers-reduced-motion).
export default function Revelar({ as: Etiqueta = "div", escalonado = false, className = "", children, ...resto }) {
  const [ref, visible] = useVisibleUnaVez();
  const base = escalonado ? "stagger" : "reveal";
  return (
    <Etiqueta ref={ref} className={`${base}${visible ? " es-visible" : ""} ${className}`.trim()} {...resto}>
      {children}
    </Etiqueta>
  );
}
