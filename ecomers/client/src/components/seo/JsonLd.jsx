// Inyecta un bloque JSON-LD en el <head> vía script serializado.
export function JsonLd({ datos }) {
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
