# 00 Diagnóstico responsive — fix/responsive-2026-10-06

Matriz: 8 casos (360, 390, 640≈zoom200, 768, 844x390 horizontal, 1024, 1280, 1920) × 8 rutas (/, /productos, /producto/:id, /carrito, /checkout, /cuenta, /admin, /acerca) = 64 combos, Chromium + axe. Harness: `responsive/scripts/matriz-responsive.cjs`.

## Hallazgos (severidad)
| ID | Problema | Dónde | Sev | Causa raíz | Estado |
|---|---|---|---|---|---|
| R1 | Shift +8px y overflow en ≥768 (scrollW = W+8) | todas las rutas | Alta | `body{margin:8px}`: faltaba el selector `*` del reset global (`index.css:99` vacía) → sin reset ni `box-sizing` | ✅ `e53126f` (restaura `*`) |
| R2 | 404s en consola (×4 por ruta) | todas | Media | favicon relativo `./favicon.svg` se rompe en rutas anidadas | ✅ `e53126f` (absoluto con base) |
| R3 | `aria-allowed-role(5)` en todas | pills `role=tab` sin tablist, etc. | Media | ARIA incorrecto | ⏳ |
| R4 | `aria-hidden-focus(1)` en todas | slides inactivos con focos | Media | `aria-hidden` + hijos enfocables | ⏳ (plan: `visibility:hidden` CSS) |
| R5 | `color-contrast(4)` en home | por detallar nodos | Media | — | ⏳ |
| R6 | `heading-order` / `page-has-heading-one` | productos, carrito, checkout, cuenta | Baja | estados vacíos sin h1 | ⏳ |
| R7 | Táctil <44px: logo (38h), ver-todo (22h), skip-link (40h), nav-categorias links (35h), link-cuenta (35w), inputs (43h), buscador btn (43h), varios AA | header + varias | Media | sin mínimos base | ⏳ |
| R8 | Drawer `.cart` y SVGs flagged como "fuera de viewport" | — | — | Falsos positivos (off-canvas + viewBox), no son bugs | ✔ descartado |

Limpios sin issues: 0/64 (todos tienen al menos táctil/axe/404 menores). Sin `pageerror` JS en ningún combo.
Firefox/WebKit, Lighthouse, zoom 400%, teclado virtual: NO ejecutados (solo Chromium instalado) → ver PROBLEMAS_ABIERTOS.
