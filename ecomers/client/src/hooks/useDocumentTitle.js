import { useEffect } from "react";
import { useLocation } from "react-router";
import { tituloPara } from "../seo/sitio";
import useIdiomaStore from "../store/idiomaStore";

// Fija document.title según la ruta actual y el idioma elegido (ES/EN).
// Acepta un título opcional que tiene prioridad (ej.: nombre real del
// producto en /producto/:id una vez cargado desde Supabase).
export function useDocumentTitle(tituloOpcional) {
  const { pathname } = useLocation();
  const idioma = useIdiomaStore((s) => s.idioma);

  useEffect(() => {
    document.title = tituloOpcional || tituloPara(pathname, idioma);
  }, [pathname, tituloOpcional, idioma]);
}

export default useDocumentTitle;
