# PROBLEMAS_ABIERTOS responsive

1. **Firefox / WebKit sin probar** (media): solo Chromium instalado. El CSS usado es estándar, pero no verificado en otros motores.
2. **Lighthouse no ejecutado** (media): sin instalar; métricas reales de performance/CLS pendientes. Axe: 0 violaciones en las 4 rutas auditadas.
3. **Zoom 400%, densidad 2x/3x, teclado virtual, rotación en vivo** (baja): no probados; zoom 200% aproximado con viewport 640px ✅.
4. **Tablas `proveedores` / `movimientos_stock` inexistentes** (media): el Admin muestra aviso correcto, pero crearlas requiere service key (humano, Supabase).
5. **Links inline en párrafos** (`Ver catálogo` en Admin): exentos por excepción inline de WCAG 2.2 (no se fuerza 44px para no romper ritmo de línea).
6. **Drawer `.cart` y SVGs flagged por detectores** (no-bug): falsos positivos, off-canvas con `visibility:hidden` verificado.
7. **Modo claro**: el repo es Night-Only por diseño (`DESIGN.md`); sin tema claro que probar.
