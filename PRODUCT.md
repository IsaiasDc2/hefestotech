# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Gamers armando / mejorando PC. Situación: comparan componentes, compatibilidad y precio antes de comprar. Audiencia secundaria: comprador casual de consolas y accesorios.

## Product Purpose

Ecommerce de venta de productos gaming (consolas, PCs, periféricos, sillas, componentes). Permite explorar catálogo, ver detalle de producto, gestionar carrito y cuenta. Éxito: compra completada sin fricción con confianza en precio y stock.

## Positioning

Catálogo gaming amplio a buen precio. Diferencia confirmada por usuario: precio + catálogo.

## Operating Context

Flujos actuales en `ecomers/client/src/App.jsx`: `/`, `/productos`, `/producto/:id`, `/carrito`, `/cuenta`, `/acerca`, `/contactanos`. Backend en `ecomers/server/app/routers/`: `auth.py`, `products.py`, `categories.py`, `orders.py`. Modelos: `user.py`, `product.py`, `category.py`, `order.py`. Idioma UI: español. Despliegue actual: GitHub Pages con `base: "/hefestotech/"` en `ecomers/client/vite.config.js`.

## Capabilities and Constraints

Confirmado:
- Frontend: React 18 + Vite 5 + Zustand + React Router 6 + Supabase JS en `ecomers/client/`.
- Backend: FastAPI + SQLAlchemy en `ecomers/server/app/`, PostgreSQL según README.
- Rutas y carrito en estado local React (`App.jsx`: agregar/eliminar/aumentar/disminuir).
- Español como idioma principal.

Decisiones abiertas:
- Usuario indicó "Hay cambios previstos" en restricciones (nombre, dominio, idioma, stack o backend) pero sin detallar. No asumir cambios; confirmar antes de renombrar, migrar deploy o cambiar stack.

## Brand Commitments

Nombre: HefestoTech / hefestotech. Referencia existente: `homepage: https://IsaiasDc2.github.io/hefestotech`. Sin assets de marca, voz formalizada ni referencias visuales vinculantes aportadas.

## Evidence on Hand

- `ecomers/README.md`: descripción ecommerce gaming y stack.
- `ecomers/client/src/App.jsx`: rutas y lógica carrito.
- `ecomers/client/package.json`: dependencias frontend.
- `ecomers/client/vite.config.js`: base `/hefestotech/`.
- `ecomers/server/app/routers/`, `ecomers/server/app/models/`: alcance backend.
- Ausencias que no deben fabricarse: testimonios, precios, stock real, métricas, garantías, tiempos de entrega, cobertura de envío.

## Product Principles

1. Precio y catálogo primero: la decisión de compra manda sobre decoración.
2. Comparación con confianza: compatibilidad, stock y detalle claros.
3. Fricción mínima hasta el carrito: pocos pasos, estados predecibles.
4. Español claro y directo, sin claims inventados.
