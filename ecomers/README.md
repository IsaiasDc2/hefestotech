# HefestoTech

Ecommerce de productos gaming (consolas, PCs, periféricos, sillas, componentes).

## Stack real

- **Frontend** (`ecomers/client/`): React 18 + Vite 5 + Zustand + React Router 6 + Supabase JS.
- **Backend** (`backend/`): FastAPI (checkout con Mercado Pago, panel admin, contacto, asistente). Se despliega en Render con `render.yaml`.
- **Base de datos y auth**: Supabase (Postgres + RLS). Migraciones en `supabase/migrations/`, a aplicar en orden desde el SQL Editor.

## Estructura

```
backend/            API FastAPI (main, checkout_api, admin_api, contacto_api, comprobantes) + tests/
ecomers/client/     SPA React (src/pages, src/components, src/services, src/store)
supabase/           migraciones SQL y ER.md
docs/ADMIN.md       panel admin: roles, estados y módulos
scripts/            utilidades de catálogo e imágenes
```

## Desarrollo local

```
# Frontend
cd ecomers/client && npm i && npm run dev

# Backend (copiar backend/.env.example a backend/.env y completar)
cd backend && pip install -r requirements.txt -r requirements-dev.txt
uvicorn main:app --reload
python -m pytest tests -q
```

Más contexto: `PRODUCT.md` (producto), `DESIGN.md` (sistema visual), `AUDITORIA.md` (seguridad).
