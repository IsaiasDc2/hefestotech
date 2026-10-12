# 00 Baseline — night/2026-10-06

Fecha: 2026-10-06 02:53 UTC (rama `night/2026-10-06`, base `main@a912efa`)
Proyecto real detectado: **HefestoTech ecommerce gaming** (`ecomers/client` React 18 + Vite 5 + Zustand + React Router 6, `ecomers/server` FastAPI esqueleto). NO es POS NestJS/Prisma — el brief de POS no aplica tal cual; se adapta al repo real.

## Tests base
- `ecomers/client`: `npm run lint` ✅ (sin errores), `npm run build` ✅ (143 módulos, 1.84s, dist OK)
- Sin suite unit/e2e (no hay script `test`, no hay `*.test.*` ni config Playwright activa pese a dependencia instalada)
- `ecomers/server`: solo `.env.example` + `requirements.txt` vacío — sin tests

## Cobertura
- 0% (sin tests). Objetivo 80% no aplicable aún sin suite; se prioriza auditoría visual/responsive/animación según pedido.

## Mapa rápido
- Rutas en `ecomers/client/src/App.jsx`: `/`, `/productos`, `/producto/:id`, `/carrito`, `/cuenta`, `/acerca`, `/contactanos`
- Design tokens en `ecomers/client/src/styles/index.css` (:root con --bg, --primary, --dur-1/2/3, --ease, breakpoints dispersos en cada CSS)
- Deploy: GitHub Pages `base: "/hefestotech/"`

## Estado git
- Rama nueva `night/2026-10-06` creada desde `main`
- Cambios sin commitear heredados de `main` (22 CSS/JSX de responsive gamer) — se commitean como punto de partida, tag `night-start` a continuación.
