import { SITE_URL } from "../../seo/sitio";

// Inyecta un bloque JSON-LD en el <head> vía script serializado.
// Solo se construye con campos reales del producto (nada inventado:
// sin reviews, sin aggregateRating, sin GTIN/MPN porque no existen
// en la tabla productos; sku solo si hay codigo; offers solo si el
// precio final es mayor a 0, porque precio 0 significa "a confirmar").
export function construirJsonLdProducto(producto) {
  if (!producto || !producto.nombre) return null;

  const precioFinal = Number(
    producto.precio_con_descuento ?? producto.precio ?? 0
  );
  const urlProducto = `${SITE_URL}/producto/${producto.id}`;

  const oferta =
    Number.isFinite(precioFinal) && precioFinal > 0
      ? {
          "@type": "Offer",
          url: urlProducto,
          priceCurrency: "ARS",
          price: precioFinal,
          availability:
            producto.stock > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
        }
      : undefined;

  const schemaProducto = {
    "@type": "Product",
    name: producto.nombre,
    url: urlProducto,
    ...(producto.imagen ? { image: [producto.imagen] } : {}),
    ...(producto.descripcion ? { description: producto.descripcion } : {}),
    ...(producto.marca
      ? { brand: { "@type": "Brand", name: producto.marca } }
      : {}),
    ...(producto.categoria ? { category: producto.categoria } : {}),
    ...(producto.codigo ? { sku: producto.codigo } : {}),
    ...(oferta ? { offers: oferta } : {}),
  };

  const migas = {
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Inicio",
        item: `${SITE_URL}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Catálogo",
        item: `${SITE_URL}/productos`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: producto.nombre,
        item: urlProducto,
      },
    ],
  };

  return {
    "@context": "https://schema.org",
    "@graph": [schemaProducto, migas],
  };
}

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
