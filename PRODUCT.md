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

Rutas del cliente en `ecomers/client/src/App.jsx`: `/`, `/productos`, `/producto/:id`, `/carrito`, `/checkout`, `/cuenta`, `/pedido/:id`, `/pago-*`, `/armar`, `/reclamo`, `/admin`, `/acerca`, `/contactanos`. Backend en `backend/` (FastAPI: `checkout_api.py`, `admin_api.py`, `contacto_api.py`, `comprobantes.py`) sobre Supabase (Postgres + RLS). Idioma UI: español, con inglés. Frontend actual en GitHub Pages con `base: "/hefestotech/"`; backend en Render.

## Capabilities and Constraints

Confirmado:
- Frontend: React 18 + Vite 5 + Zustand + React Router 6 + Supabase JS en `ecomers/client/`.
- Backend: FastAPI en `backend/`, datos y auth en Supabase.
- Pagos con Mercado Pago (webhook con firma HMAC e idempotencia).

Decisiones abiertas:
- Hosting definitivo del frontend (GitHub Pages o Vercel) y dominio propio.
- Número real de WhatsApp (`ecomers/client/src/constants/whatsapp.js`).

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
