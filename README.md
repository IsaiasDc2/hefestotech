# HefestoTech

Tienda online de hardware y gaming de Argentina: catálogo con filtros, armador de PC con chequeo de compatibilidad, carrito, checkout con Mercado Pago, cuenta de cliente y panel de administración.

| Capa | Tecnología |
|---|---|
| Frontend | React 19.3 · Vite 8 (Rolldown) · React Router 8 · Zustand 5 |
| Datos y auth | Supabase (Postgres + RLS + Storage) |
| Backend | FastAPI (checkout, webhook de Mercado Pago, comprobantes, panel admin) |
| Calidad | ESLint 10 con reglas del React Compiler · Vitest 5 · pytest · GitHub Actions |
| Deploy | GitHub Pages (frontend) · Render (backend, ver `render.yaml`) |

## Probarlo en 2 minutos (modo demo)

No necesita credenciales: usa un catálogo local generado a partir de las migraciones (69 productos, 16 categorías). Requiere Node 22.22 o superior.

```bash
cd ecomers/client
npm ci
npm run dev:demo
```

Abrir http://localhost:5173/hefestotech/. Una etiqueta **Modo demo** fija en pantalla avisa que los precios son de ejemplo. En demo no hay cuentas ni pagos: esas acciones devuelven un error explícito.

## Desarrollo con datos reales

1. **Frontend**: copiar `ecomers/client/.env.example` a `ecomers/client/.env.local` y completar `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` y `VITE_API_URL`.
2. **Backend**:
   ```bash
   cd backend
   python -m venv .venv
   .venv/Scripts/activate          # Windows (en macOS/Linux: source .venv/bin/activate)
   pip install -r requirements.txt -r requirements-dev.txt
   cp .env.example .env            # completar Supabase, Mercado Pago y URLs
   uvicorn main:app --reload
   ```
3. **Base de datos**: aplicar `supabase/migrations/` en orden desde el SQL Editor de Supabase. El modelo está en `supabase/ER.md`.

Los secretos (service role, access token de Mercado Pago, secreto del webhook) van **solo** en `backend/.env`. El frontend únicamente usa valores públicos.

## Scripts del frontend (`ecomers/client`)

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (entra solo en modo demo si faltan credenciales) |
| `npm run dev:demo` | Fuerza el modo demo |
| `npm run lint` | ESLint, falla con cualquier aviso |
| `npm test` | Vitest: armador, catálogo, modo demo, carrito, dinero, URLs de pago |
| `npm run build` | Build de producción en `dist/` |
| `npm run check` | lint + tests + build (lo mismo que corre CI) |
| `npm run demo:catalogo` | Regenera `src/demo/catalogo.json` desde las migraciones |

Backend: `python -m pytest -q` dentro de `backend/`.

## Deploy

- **Frontend**: `.github/workflows/deploy-pages.yml` publica en GitHub Pages en cada push a `main`. Configuración única: *Settings → Pages → Source: GitHub Actions* y, en *Settings → Secrets and variables → Actions → Variables*, cargar `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` y `VITE_API_URL`.
- **Backend**: Render con `render.yaml` (variables marcadas `sync: false` se cargan en el panel de Render).
- **CI**: `.github/workflows/ci.yml` corre lint, tests, build y `npm audit` del cliente, y pytest del backend.

La CSP de `index.html` incluye hosts locales para desarrollo; el build de producción los quita y agrega el origen de `VITE_API_URL`.

## Estructura

```
backend/                FastAPI: checkout, webhook MP, comprobantes, admin, contacto
ecomers/client/
  src/components/       layout, producto (catálogo, ficha, tarjeta), filtros, SEO
  src/pages/            home, carrito, checkout, cuenta, admin, contacto…
  src/armador/          armador de PC y motor de compatibilidad (con tests)
  src/demo/             cliente Supabase en memoria + catálogo de ejemplo
  src/services/         productos, órdenes, favoritos, auth
  src/hooks/ src/utils/ hooks compartidos, formato de pesos, validación de URLs de MP
supabase/migrations/    esquema, RLS, funciones y seeds
docs/                   panel admin, hoja de ruta
```

## Documentación

- [`CHANGELOG.md`](CHANGELOG.md): qué cambió en cada versión.
- [`AUDITORIA.md`](AUDITORIA.md): hallazgos de seguridad, funcionalidad y rendimiento, con su estado.
- [`DESIGN.md`](DESIGN.md): sistema de diseño (tokens, tipografía, temas).
- [`docs/ADMIN.md`](docs/ADMIN.md): panel de administración y matriz de permisos.
- [`docs/ROADMAP.md`](docs/ROADMAP.md): próximos pasos.
