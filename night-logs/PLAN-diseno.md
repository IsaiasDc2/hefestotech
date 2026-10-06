# Plan unificado — Diseño + Estructura + Motion (para aprobación)

Rama: `night/2026-10-06` | Estilo: compragamer hard gaming, oscuro solo | Base: `ecomers/client/src`

## 0. Skills
Instalada: `impeccable` (incluye `animate`, `audit`, `polish`, `layout`, etc.).
Faltan las 6 pedidas: `emil-design-eng`, `improve-animations`, `review-animations`, `animation-vocabulary`, `apple-design`, `frontend-design`. Se trabajará con `impeccable` + CSS puro, sin nuevas dependencias.

## 1. Sistema único de breakpoints (mobile-first)
Base 360px 1col. Solo `min-width`:
- `560px`: 2col categorías/productos, footer 2col, beneficios 2col
- `768px`: contacto 2col, banner flechas on
- `1024px`: 4col productos, filtros sticky, banner full, detalle 2col
- `1280px`: contenedor max-width
Migración: 1) unificar `480/520/560→560`, `820/860/900→900`, fix `1024/1025` off-by-one, fix orden `380` después de `480` en `CarritoLateral.css:547/569`. 2) invertir `max-width→min-width` por archivo. 3) base táctil 44px, borrar parches `pointer:coarse` para tamaño.

## 2. Sistema de diseño base (variables en `styles/index.css :root`)
Ya existen `--bg, --primary #6366F1, --oro #C9A86A, --dur-1/2/3, --ease`. Agregar/fijar:
- `--dur-0:100ms; --stagger:60ms; --reveal-y:12px; --grad-oro:linear-gradient(135deg,#C9A86A,#8C7146)`
- Doctrina: índigo=acción/foco, latón=precio/premium/oferta (≥1.15rem u oro aclarado `#E8D5A8`), celeste=solo info. `--grad-marca: #6366F1→#4338CA` (no celeste).
- Contraste: `--muted-oscuro #7a8aa3` solo decorativo; texto <12px usa `var(--muted) #94A3B8` o `#9AA8C0`. Blanco sobre CTA con `font-weight:800` + sombra texto.
- Tipo: Oswald uppercase solo `h1,h2,kicker,marca`; `h3` cards Inter 600 normal-case. `h2` = `var(--text-h2)`.
- Espaciado/radios/sombras/foco: usar `var(--space-*)`, mapa `8px input / 12px btn-card / 16px card-cat / full pills`, reposo `sombra-suave+borde 1px`, hover solo `translateY(-2px)+borde marca`, foco único `2px #fff + 0 0 0 4px var(--anillo-foco)`, disabled `opacity .55 + not-allowed`, active `scale(.98)`.

## 3. Sistema de movimiento base
`--dur-0 100ms press, --dur-1 120ms iconos, --dur-2 200ms hovers, --dur-3 350ms entradas/drawer/modal; --ease cubic-bezier(0.22,1,0.36,1)` (ease-out entradas). Solo `transform+opacity`, 60fps, `prefers-reduced-motion` global con utilidad `.reveal/.stagger`.

## 4. Orden de ejecución (sin cambiar copy ni funcionalidad)
P0 Estructura+responsive: Layout header fragment (`Layout.jsx:19-26`), Suspense dentro de Layout (`App.jsx:49-65`), `h1` único (Banner/Home), hero solape 901-1100px → atenuar desde 1024px + `min-height:min(480px,92svh)`, detalle-grid corte a 1024px, PromoBar fallback CSS `:first-child` sin JS, sticky `top:calc(header+0.75rem)`, tablas con hint + `tabindex`, cuenta tabs scroll affordance, `overflow-x` solo en body/#root.
P1 Detalles invisibles: skeletons (Producto/Home/ProductList, reutilizar `.card-skeleton`), errores ES + Reintentar (no `error.message` crudo, `mapAuthError`), checkout `id/htmlFor+aria-invalid+focus error`, transferencia 10% off aplicar o quitar label, rating `null→Sin calificaciones`, `onError` imagen → placeholder (no `display:none`), sociales disabled + toast, `-` en cantidad 1 disabled, carrito vacío CTA → `<Link /productos>`, `role=progressbar`, toast `aria-live` al agregar, debounce buscadores 250ms + `useDeferredValue` en Home.
P2 Visual: contraste, doctrina color, hex→vars, tipografía, `space/radio/shadow` tokens, glow solo hover, foco único, disabled/active completos, flechas banner visibles desktop + puntos 44px móvil.
P3 Motion: unificar `ease/dur` a vars, stagger hero+grids (`--i`), reveals IO (`threshold .15, once`), drawer/asistente con `visibility` + montar persistente, banner progreso `scaleX` (no `width`), badge debounce 500ms, formularios solo `border-color` en transición, shimmer unificado a `transform`, `scrollBy smooth` con chequeo reduced-motion.

Verificación: `lint+build`, 360/390/768/1024/1280/1536 sin scroll-x, táctil ≥44px, `prefers-reduced-motion` sin animación, cero `undefined` visibles.
