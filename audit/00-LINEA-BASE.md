# 00 Línea base — fix/errores-2026-10-06

Rama desde `night/2026-10-06@e60b386`. Tag `fix-start`. Fecha: 2026-10-06.

## Arquitectura real (NO la del brief)
El brief describe Next.js + NestJS + Prisma + Redis. El repo real es:
- Frontend: React 18 + Vite 5 + Zustand + React Router 6 + Supabase JS (`ecomers/client/`).
- Datos: Supabase (Postgres remoto). Sin Docker, sin Redis, sin buscador propio.
- Backend: `ecomers/server` (FastAPI esqueleto, `requirements.txt` vacío) + `backend/main.py` (FastAPI funcional: CSV, Gemini, Mercado Pago).
- Sin suite de tests (solo `lint`), sin typecheck (JS plano), Playwright instalado pero sin specs.

## Resultados base (instalación limpia `npm ci` exit 0)
| Gate | Resultado |
|---|---|
| `npm ci` | ✅ (requirió matar dev server que bloqueaba `esbuild.exe`, EPERM) |
| `npm run lint` | ✅ exit 0 |
| `npm run build` | ✅ 1.88s |
| `py_compile` (4 archivos backend) | ✅ |
| `npm audit --omit=dev` | ⚠️ 2 advisories moderate en `react-router` (CVE open-redirect backslash, constructor injection SSR). Fix = upgrade breaking a v7 → NO aplicado, ver ERRORES |
| Tests unit/e2e | ❌ no existen (0 archivos `*.test.*`, 0 specs) |
| Cobertura | 0% |
| Docker/Redis/buscador | ❌ no existen en el repo |
| Consola navegador (/, /productos, /carrito, /checkout, /cuenta) | ✅ sin errores JS (solo warnings benignos React Router future flags) |
| Carga de productos en sandbox | ❌ `ERR_TUNNEL_CONNECTION_FAILED` (proxy del entorno) + URL con typo (ver E1) |
