# DECISIONES (fix/errores-2026-10-06)

1. Brief adaptado: describe Next.js/NestJS/Prisma/Redis; el repo real es Vite + FastAPI + Supabase. Se audita lo real, sin inventar stack. (`00-LINEA-BASE.md`)
2. `npm ci` imposible con dev server vivo (EPERM en `esbuild.exe`). Procedimiento: matar dev antes de instalar. Documentado, no es bug del repo.
3. `npm audit`: 2 advisories moderate `react-router`. Fix oficial = upgrade breaking a v7 → NO aplicado sin autorización humana.
4. Sin Docker/Redis/buscador en el repo: no se crean; backend real es Supabase remoto + FastAPI mock. Tests e2e/carga del brief no aplicables tal cual.
5. Suite de tests con `node:test` (cero dependencias) en vez de Vitest: evita instalar framework solo para funciones puras.
6. Extracción de `utils/pago.js` desde `Checkout.jsx`: comportamiento idéntico verificado con 13 tests + lint + build.
7. Timeout 12s + `AbortSignal` en cargas Supabase: evita spinner infinito cuando no hay red; cae al estado con reintento ya existente.
8. Modelo `gemini-3.8-flash`: no se cambia sin key real para verificar; queda abierto para el compañero.
9. `MotionConfig reducedMotion="user"` global: respeta SO del usuario en todo framer-motion.
