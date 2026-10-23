import { useEffect } from "react";

// Inyecta un bloque JSON-LD vía script serializado.
// El HTML generado en el build (scripts/generar-seo.mjs) ya trae el mismo
// bloque marcado con data-prerender para que lo lean los buscadores sin
// JavaScript; al montar, se quita ese para no duplicar el Product.
export function JsonLd({ datos }) {
  useEffect(() => {
    if (!datos) return;
    document
      .querySelectorAll('script[data-prerender="jsonld-producto"]')
      .forEach((nodo) => nodo.remove());
  }, [datos]);

  if (!datos) return null;
  return (
    <script
      type="application/ld+json"
      data-seo="jsonld-producto"
    >
      {JSON.stringify(datos)}
    </script>
  );
}

export default JsonLd;
