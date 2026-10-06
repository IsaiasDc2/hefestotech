# ERRORES

| ID | Módulo | Sev | Síntoma | Causa raíz | Estado / commit |
|---|---|---|---|---|---|
| E1 | Datos/Supabase | Crítica | Catálogo vacío, `Failed to fetch` | Typo en `VITE_SUPABASE_URL` (una `r` de menos, host inexistente) | ✅ Corregido (`.env.local` local + `.env.example`). API 200 verificado con curl |
| E2 | Backend FastAPI | Crítica | API crashea sin `.env` | `genai.Client`/`mercadopago.SDK` a import-time con `None` | ✅ Heredado de `night` (init diferido). Verificar aquí |
| E3 | Backend FastAPI | Alta | CORS inválido | `allow_origins=["*"]` + credentials | ✅ Heredado de `night`. Verificar aquí |
| E4 | Chat IA | Media | Modelo `gemini-3.8-flash` no verificado | Nombre posiblemente inexistente | ⏳ Abierto: requiere key real |
| E5 | Pagos MP | Baja | `back_urls` a localhost | Solo dev | ⏳ Abierto: pasar a env |
| E6 | Filtros catálogo | Media | Se ven desacomodados (pedido usuario ×2) | Rediseño pendiente | ⏳ Abierto |
| E7 | Deps | Media | `framer-motion@14` instalado sin uso | Instalación sin aplicación | ✅ Usado: MotionConfig global + Banner + grilla con layout (`a7093ee`) |
| E8 | Deps | Media | 2 advisories moderate `react-router` | Fix breaking (v7) | ⏳ Abierto: decisión humana |
| E9 | Tests | Alta | 0 tests, 0% cobertura | Nunca se escribió suite | 🟡 Parcial: 13 tests `node:test` en verde (`0f49fc5`), sin cobertura aún |
| E10 | Repo | Baja | `ecomers/client/.agents/` sin rastrear, origen desconocido | Directorio ajeno | ⏳ Abierto: revisar contenido |
| E11 | i18n | Baja | Solo navbar/footer en EN, resto ES | Diccionario parcial | ⏳ Abierto (documentado) |
