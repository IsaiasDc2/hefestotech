# AGENTS.md

Instrucciones para cualquier agente de código (Codex, Cursor, Copilot, Gemini CLI, Jules, Windsurf, Aider, Claude Code u otro). Si te pidieron **desplegar**, seguí [`DEPLOY.md`](DEPLOY.md) paso a paso; este archivo es el resumen.

## Proyecto

HefestoTech: tienda online de componentes de PC (Salta, Argentina). Monorepo:

| Carpeta | Qué es | Stack |
|---|---|---|
| `ecomers/client` | Frontend SPA | React 19, Vite 8, React Router 8, Zustand 5, Supabase JS |
| `backend` | API | FastAPI (Python 3.11/3.12): checkout, webhook Mercado Pago, comprobantes, admin, asistente IA |
| `supabase/migrations` | Base de datos | Postgres + RLS (ejecutar en orden alfabético) |

Ignorá `ecomers/client/supabase/migrations/`: es una copia vieja.

## Comandos

```bash
# Frontend (Node >= 22.22, recomendado 24)
cd ecomers/client
npm ci
npm run dev:demo      # local sin credenciales, catálogo de ejemplo
npm run check         # lint + tests + build: tiene que pasar antes de desplegar

# Backend
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate   |   Linux/macOS: source .venv/bin/activate
pip install -r requirements-dev.txt
pytest -q             # tiene que pasar
uvicorn main:app --reload --port 8000
```

## Despliegue en una línea

Supabase (correr las migraciones) → Render (`render.yaml`, cargar variables) → frontend en GitHub Pages (`.github/workflows/deploy-pages.yml`) o Vercel (`Root Directory = ecomers/client`). Detalle, variables y verificación: [`DEPLOY.md`](DEPLOY.md).

Sin `VITE_SUPABASE_*` el frontend arranca igual en **modo demo**: sirve para mostrar la tienda, pero no vende.

## Reglas

1. **Secretos fuera del repo y del chat.** `SUPABASE_SERVICE_ROLE_KEY`, `MERCADOPAGO_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `CRON_SECRET` y `LLM_API_KEY` van solo en los paneles de Render/Supabase/GitHub o en `backend/.env` (ignorado por git). Las `VITE_*` son públicas: nunca pongas ahí la service_role.
2. **No inventes datos del comercio** (CUIT, WhatsApp, dirección, precios). Si faltan, dejá el placeholder y avisá.
3. **Mercado Pago primero en modo prueba** (`TEST-...`). Pasar a producción lo decide el dueño.
4. **Pedí confirmación** antes de SQL destructivo, borrar datos o cambiar dominios.
5. **No declares "desplegado" sin evidencia**: corré la sección 6 de `DEPLOY.md`.
6. Si cambiás código: `npm run check` y `pytest -q` en verde, commits chicos en español.

## Convenciones de código

- Textos de UI en español rioplatense, con claves en `src/store/idiomaStore.js` (es/en).
- Diseño "Carbón": tokens en `src/styles/index.css`; guía en `DESIGN.md`.
- ESLint con las reglas de React Compiler: nada de `setState` dentro de efectos (usar estado derivado o `useEffectEvent`).
- Los precios y el stock los valida el servidor; el frontend solo los muestra.
