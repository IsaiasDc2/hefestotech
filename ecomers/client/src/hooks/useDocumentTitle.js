import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { tituloPara } from "../seo/sitio";

// Fija document.title según la ruta actual (títulos únicos en ES).
// Acepta un título opcional que tiene prioridad (ej.: nombre real del
// producto en /producto/:id una vez cargado desde Supabase).
export function useDocumentTitle(tituloOpcional) {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = tituloOpcional || tituloPara(pathname);
  }, [pathname, tituloOpcional]);
}

export default useDocumentTitle;
