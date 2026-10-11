# AUDITORÍA de seguridad — HefestoTech (rama `feat/auditoria-admin`)

Criterio: OWASP Top 10 2021. Fuentes declaradas: `DESIGN.md` (solo sistema visual,
sin efecto en esta tarea), migraciones `001/002/003`, `backend/main.py`,
`backend/.env` (no se muestra ni versiona), `npm audit` del cliente.
Prohibido cumplido: no se tocó `src/`, no se commiteó, no se ejecutó contra producción.

## Hallazgos por severidad

### ALTA

| # | OWASP | Hallazgo / evidencia | Estado |
|---|---|---|---|
| A1 | A01:2021 Control de accesos | Escritura abierta a cualquier `authenticated` en `productos`, `categorias` (`001_productos.sql:44-50`), `proveedores`, `producto_proveedor` (`003_negocio.sql:50-52,67-69`), `storage.objects` (`001:60-68`) y `movimientos_stock` (`003:87-89`). Cualquier usuario logueado podía modificar catálogo, stock e imágenes. | **Corregido** en `004_admin_roles.sql`: policies `escritura/actualizar/borrar admin` con `public.is_admin()`; `SELECT` público/autenticado intacto |
| A2 | A07:2021 Autenticación/Autorización | Sin rol admin: `perfiles` sin columna `rol`, sin `is_admin()`/`has_permission` (`003_negocio.sql:6-14`). Imposible distinguir dueño de cliente. | **Corregido** en `004`: `perfiles.rol` (`admin\|cliente`, default `cliente`), `is_admin()` + `has_permission(text)` base, `SECURITY DEFINER` con `search_path = public` fijo, `GRANT EXECUTE` a `authenticated` |
| A3 | A03:2021 Inyección | `/api/chat` aceptaba texto vacío o ilimitado (`main.py` anterior, `MensajeUsuario.texto` sin validar → abuso de costo del LLM / prompt gigante). `/api/crear-preferencia` aceptaba `cantidad <= 0` y `precio_unitario <= 0` (montos inválidos a MercadoPago). | **Corregido**: chat exige 1–2000 caracteres (strip); preferencia exige título 1–200, `1 <= cantidad <= 100`, `0 < precio <= 1e9` |
| A4 | A04:2021 Diseño inseguro | Sin rate-limit en `/api/chat` ni `/api/crear-preferencia`: automatizables para fundir cuota de IA o generar preferencias en masa. | **Corregido**: límite en memoria por IP, 20 req/min (chat) y 10 req/min (preferencia), respuesta `429` genérica |

### MEDIA

| # | OWASP | Hallazgo / evidencia | Estado |
|---|---|---|---|
| M1 | A09:2021 Fallos de registro/monitoreo | `print(f"...{e}...")` en `/api/chat` y `return {"error": str(e)}` en `/api/crear-preferencia` (`main.py` anterior): trazas y detalle del proveedor llegaban a logs/respuesta. | **Corregido**: logs genéricos sin excepción ni texto del usuario; pagos devuelven `HTTPException 502` genérico |
| M2 | A06:2021 Componentes vulnerables | `npm audit` (cliente `ecomers/client`): **11 vulnerabilidades (8 high, 3 moderate)**. Sin cambios aplicados por orden explícita. Detalle abajo. | **Pendiente** (decisión del dueño; ver "Qué falta") |
| M3 | A05:2021 Mala configuración | No existía `backend/.env.example`: riesgo de copiar/commitear el `.env` real. CORS ya correcto (orígenes cerrados, `main.py:17-27`), sin cambios. `.env` ignorado en `.gitignore` (líneas 1 y 23). | **Corregido**: `backend/.env.example` creado solo con placeholders |

### BAJA / ENDURECIMIENTO

| # | Hallazgo / evidencia | Estado |
|---|---|---|
| B1 | Faltaban índices (`movimientos_stock.created_at`, compuesto con `producto_id`) y búsqueda trigram en `productos(nombre)` (búsquedas `LIKE %..%` lentas = superficie de DoS de lectura) | **Corregido** en `004`: `pg_trgm` + GIN, `idx_movimientos_created`, `idx_movimientos_producto_created`; se reafirman `idx_ordenes_user`, `idx_orden_items_orden`, `idx_movimientos_producto` |
| B2 | `favoritos` ya tenía PK compuesta `(user_id, producto_id)` (`003:96`), unicidad garantizada | **Reafirmado** en `004` con índice único explícito `uq_favoritos_user_producto` |
| B3 | Secretos (`GEMINI_API_KEY`, `MERCADOPAGO_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`) solo en `backend/.env` local, sin valores en el repo | **OK**, sin cambios; nunca mostrar ni commitear |

## `npm audit` — detalle (solo listado, nada actualizado)

`npm audit` en `ecomers/client` → `11 vulnerabilities (3 moderate, 8 high)`:

| Paquete | Severidad | Aviso |
|---|---|---|
| `braces` (vía `micromatch` → `fast-glob` → `globby` → `gh-pages`) | high | Stack-exhaustion DoS por patrones anidados (`GHSA-vfj7-8cjw-p6xm`); fix exigiría `gh-pages@6.1.1` (breaking) |
| `playwright < 1.55.1` | high | Instala browsers sin verificar certificado SSL (`GHSA-7mvr-c777-76hp`); fix con `npm audit fix` |
| `source-map-js 1.0.0–1.2.1` | high | DoS del event-loop por offsets (`GHSA-68fv-2mgg-jv7q`); fix con `npm audit fix` |
| Resto hasta totalizar 8 high | high | Ver salida completa de `npm audit` (cadenas de `gh-pages`/`fast-glob`) |
| `esbuild <= 0.24.2` (vía `vite`) | moderate | Dev-server acepta peticiones de cualquier sitio (`GHSA-67mh-4wv8-2f99`); fix exigiría `vite@8.3.4` (breaking) |
| `react-router 6.0.0–7.17.0` / `react-router-dom` | moderate (×2 avisos) | Open redirect por backslash (`GHSA-wrjc-x8rr-h8h6`, bypass CVE-2025-68470) e inyección de constructor en `deserializeErrors` SSR (`GHSA-337j-9hxr-rhxg`); fix exigiría `react-router-dom@7.18.4` (breaking) |

## Verificación ejecutada

- `python -c "import main"` en `backend/` → `import ok: True`; rutas `/`, `/api/productos`, `/api/chat`, `/api/crear-preferencia` presentes.
- Validadores: vacío/espacios/+2000 en chat y `titulo` vacío / `cantidad 0` / `precio 0 o negativo` → todos rechazados con `ValidationError`; caso válido aceptado.
- Rate-limit: 11 llamadas con límite 10 → `HTTPException 429` en la 11.ª.
- Migración `004` verificada solo por lectura (idempotente: `if not exists` / `drop policy if exists`); **no aplicada**: requiere SQL Editor del Dashboard.

## Qué falta (dueño)

1. **Primer admin por SQL del dueño** (las policies nuevas bloquean escrituras hasta que exista un admin):
   ```sql
   update perfiles set rol = 'admin'
   where id = (select id from auth.users where email = 'EMAIL_DEL_DUEÑO');
   ```
2. Aplicar `004_admin_roles.sql` en Dashboard → SQL Editor → Run (después de 001–003) y correr las consultas de verificación del pie del archivo.
3. Decidir `npm audit`: `npm audit fix` (playwright, source-map-js) y evaluar los breaking (`gh-pages`, `vite`, `react-router-dom`) en rama aparte con build+tests.
4. Seguimiento (no bloqueante): `back_urls` de MercadoPago aún apuntan a `localhost` (usar `FRONTEND_URL`); rate-limit en memoria no comparte estado entre instancias (si hay réplicas, pasar a Redis); `has_permission()` es base (`is_admin`) hasta definir matriz de permisos.

## Cierre (revisores + H1/H2 + cuenta prueba)
- Pentest: H1/H2 CERRADOS (checkout servidor + webhook MP con HMAC e idempotencia, migracion 006). 12 validaciones + XSS/IDOR/CSRF/JWT/CSRF/rate-limits corregidos y re-testeados 16/16.
- UX/QA: aprobado; CSP con hash del script de tema; drawer admin con Esc/foco (corregidos).
- Cuenta prueba (bloque 11): NO creada (sin service_role). Scripts + 007 + comandos npm listos.
- Sin navegador: sin Lighthouse/capturas/Playwright. Sin push/deploy por mandato.
