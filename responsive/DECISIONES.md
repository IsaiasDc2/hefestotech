# DECISIONES responsive

1. Alcance adaptado: repo real es Vite + React (no Next.js/Tailwind); "admin" = página `/admin` existente. Sin Docker/Redis: dev server local + Supabase remoto.
2. Solo Chromium: Firefox/WebKit no instalados; no se agregan navegadores (costo) — queda abierto.
3. Sin Lighthouse: no instalado; se usa axe-core (devDep legítima) + inspección manual. Lighthouse queda para CI futuro.
4. Zoom 200% aproximado con viewport 640px (misma cantidad de CSS px).
5. Drawer `.cart` off-canvas y SVGs: falsos positivos del detector, no se tocan.
6. `overflow-x: hidden` en body preexistente: se mantiene (no lo agregué yo); el fix real fue la causa (reset).
7. Scripts de harness versionados en `responsive/scripts/` como evidencia y regresión.
