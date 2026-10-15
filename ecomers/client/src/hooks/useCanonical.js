import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { canonicalPara } from "../seo/sitio";

// Mantiene <link rel="canonical"> sincronizado con la ruta actual:
// URL absoluta de producción, sin query/hash ni barra final.
export function useCanonical() {
  const { pathname } = useLocation();

  useEffect(() => {
    const href = canonicalPara(pathname);
    let enlace = document.querySelector('link[rel="canonical"]');
    if (!enlace) {
      enlace = document.createElement("link");
      enlace.setAttribute("rel", "canonical");
      document.head.appendChild(enlace);
    }
    enlace.setAttribute("href", href);
  }, [pathname]);
}

export default useCanonical;
