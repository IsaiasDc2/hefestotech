import { FaChevronDown } from "react-icons/fa6";
import useIdiomaStore, { t } from "../../store/idiomaStore";

// Pie de lista larga: "Mostrando 5 de 32", barra de progreso y el botón
// "Cargar más". No se dibuja cuando ya se ve todo.
export default function CargarMas({ mostrados, total, onMas, cargando = false, className = "" }) {
  const idioma = useIdiomaStore((s) => s.idioma);
  const visibles = Math.min(Number(mostrados) || 0, Number(total) || 0);
  if (!total || visibles >= total) return null;
  const progreso = visibles / total;

  return (
    <div className={`cargar-mas ${className}`.trim()}>
      <p className="cargar-mas-texto" role="status" aria-live="polite">
        {t(idioma, "lista.mostrando")} <strong>{visibles}</strong> {t(idioma, "lista.de")} {total}
      </p>
      <span className="cargar-mas-barra" aria-hidden="true">
        <span style={{ "--progreso": progreso }} />
      </span>
      <button type="button" className="btn-fantasma cargar-mas-btn" onClick={onMas} disabled={cargando}>
        {cargando ? t(idioma, "lista.cargando") : t(idioma, "lista.cargarMas")}
        <FaChevronDown aria-hidden="true" className="cargar-mas-flecha" />
      </button>
    </div>
  );
}
