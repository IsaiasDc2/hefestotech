# BUGS — ramas de compañeros (merge 8c14a4b + auditoría)

| Bug | Severidad | Causa raíz | Estado |
|---|---|---|---|
| `backend/main.py`: `genai.Client`/`mercadopago.SDK` a import-time con env `None` → crash sin `.env` | Crítico | init global sin validación | ✅ `ff393a5` (init diferido + 503 claro) |
| CORS `allow_origins=["*"]` + `allow_credentials=True` (combo inválido) | Alto | wildcard con credenciales | ✅ `ff393a5` (orígenes explícitos) |
| CSV con path relativo al cwd (`datos/...`) | Medio | depende de dónde se corre uvicorn | ✅ `ff393a5` (`Path(__file__)`) |
| Sin `requirements.txt` en `backend/` (ni deps en `ecomers/server`) | Medio | nadie puede instalar el server | ✅ `ff393a5` (creado, sin pines inventados) |
| Modelo `gemini-3.8-flash` — existencia no verificada | Medio | posible nombre incorrecto | ⏳ pendiente compañero con API key |
| `back_urls` Mercado Pago a `localhost:5173` | Bajo | solo dev | ⏳ TODO: env `VITE_MP_RETURN_URL` |
| `Asistente.jsx`: fetch hardcodeado a `127.0.0.1:8000` | Medio | URL en código | ✅ `ff393a5` (`VITE_API_URL` + fallback) |
| `Asistente.jsx`: estilos inline con hex (`#2a2a2a`, `#0d6efd`) | Medio | fuera del sistema de tokens | ✅ merge (clases + tokens + `role=log`) |
| `.env.local` versionado con publishable key | Medio | secreto en git | ✅ `ff393a5` (untrack, archivo conservado) |
| `frontend/general`: merge directo imposible (node_modules versionado + renames) | Bajo | historia con ruido | ✅ resuelto: solo `.nojekyll` + ignores |
| `frontend/navbar-cuenta`: sin commits sobre main | — | ya integrada o vacía | ✅ nada que traer |
| Typo URL Supabase (`ewqwmzwtrsjlrnrotcm`, una sola r) → productos no cargan | Crítica | URL mal copiada en env; además `throw` a import-time en `supabaseClient.js` rompía TODA la app | ✅ corregido local (`.env.local` doble-r `ewqwmzwtrsjlrrnrotcm` verificado con `curl.exe`; `supabaseClient.js` diferido + `console.error`; `.env.example` actualizado) |

Servicios `product_service.py`, `category_service.py`, schema `category.py`: limpios.
Gates: `py_compile` ✅, `eslint` ✅, `vite build` ✅.
