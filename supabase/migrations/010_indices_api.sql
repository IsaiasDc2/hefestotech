-- HefestoTech · 010_indices_api.sql
-- Índices compuestos para las consultas reales del front
-- (ver ecomers/client/src/services/productService.js).
-- REGLA DE ORDEN: columnas de igualdad primero (activo, categoria,
-- marca, destacado) y la de rango/orden al final (descuento, precio,
-- created_at). Así un solo índice resuelve filtro + límite sin sort extra.
-- Revisar en SQL Editor, no ejecutar en prod sin leer.

-- Catálogo: activo=true (+ filtro cliente por categoria/marca/precio).
create index if not exists idx_productos_activo_categoria
  on productos (activo, categoria);
create index if not exists idx_productos_activo_marca
  on productos (activo, marca);

-- Destacados: activo=true AND destacado=true (+ limit).
create index if not exists idx_productos_activo_destacado
  on productos (activo, destacado);

-- Ofertas: activo=true AND descuento_porcentaje > 0 (+ limit).
create index if not exists idx_productos_activo_descuento
  on productos (activo, descuento_porcentaje);

-- Búsqueda por texto (ilike nombre/descripcion/marca): ya cubierta por
-- idx_productos_nombre_trgm, idx_productos_marca_trgm e
-- idx_productos_busqueda (GIN). No se duplica.
