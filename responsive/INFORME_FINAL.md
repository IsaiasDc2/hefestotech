# INFORME_FINAL responsive — fix/responsive-2026-10-06

## 1. ANTES vs DESPUÉS (matriz 64 combos: 8 anchos × 8 rutas, Chromium)
| Métrica | Antes | Después |
|---|---|---|
| Scroll horizontal | 40/64 combos (todo ≥768, shift +8px) | **0/64** |
| Violaciones axe (4 rutas × 390) | 3-4 por ruta (roles, hidden-focus, contraste, headings) | **0** |
| Targets <44px | ~15 recurrentes (logo, ver-todo, skip-link, nav links, inputs 41-43px, footer, newsletter, admin) | **0** fuera de links inline exentos |
| Errores consola JS | 0 `pageerror` | 0 |
| 404 red | favicon en rutas anidadas + tablas Admin inexistentes | favicon ✅; tablas → aviso UI correcto (pendiente humano) |

## 2. Corregidos (causa raíz + commit)
- **R1 shift +8px global**: faltaba el selector `*` del reset (línea vacía) → sin reset ni border-box (`e53126f`).
- **R2 favicon 404**: path relativo roto en rutas anidadas → absoluto con base (`e53126f`).
- **R3 roles ARIA**: `role=list/listitem` en links + tabs falsos en pills/banner → roles honestos (`033e83c` + agentes).
- **R4 drawer con foco oculto**: `.cart` cerrado solo trasladado → `visibility` con delay (`033e83c`).
- **R5 contraste**: links `--primary` 3.3:1 → token `--link` `#a5b4fc` (~7:1) (`033e83c`).
- **R6 headings**: h1 en vacíos (checkout/cuenta), h2 sr-only en resultados (`033e83c`).
- **R7 táctil**: 44px base en logo, nav, buscador, inputs, botones, newsletter, admin, footer full-width (`033e83c`, `446a808`, +1).
- **Banner** (agente skills): art-direction por breakpoint, stagger tokenizado, teclado con flechas, CTA-sec a link, reduced-motion completo.
- **Carousel** (agente skills): affordance táctil, flechas visibles sin hover, snap sin trampa de foco.

## 3. Abiertos
Ver `responsive/PROBLEMAS_ABIERTOS.md`. Ninguno crítico.

## 4. Cobertura de prueba
✅ 8 anchos (360→1920 + horizontal + zoom200-proxy), 8 rutas, overflow/aria/táctil/consola por combo, screenshots en temp. ❌ Firefox/WebKit, Lighthouse, zoom 400%, teclado virtual, rotación física.

## 5. Riesgos y decisiones humanas
Supabase: crear tablas `proveedores`/`movimientos_stock` (migraciones 001/003). `npm audit` react-router (rama fix). Harness versionado en `responsive/scripts/`.

## 6. Reproducir
`git checkout fix/responsive-2026-10-06`, `cd ecomers/client && npm ci && npm run dev -- --port 5199`, `node ../../responsive/scripts/matriz-responsive.cjs`. Gates: `npm run lint`, `npm run build`.
