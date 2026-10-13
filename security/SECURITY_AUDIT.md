# Auditoría de Seguridad — HefestoTech (backend)

Rama: `fix/security-audit` · Base: `62e4b83` · Backend auditado: `backend/`
(~2.700 líneas, FastAPI + Supabase REST + MercadoPago + Gemini).

## Metodología y herramientas ejecutadas

| Herramienta | Resultado |
|---|---|
| Revisión manual de código (100% del backend) | completa |
| Semgrep `--config auto` (290 reglas) | 3 hallazgos → analizados (F-S1) |
| Semgrep `--config p/python` | 0 hallazgos en el código actual |
| pip-audit sobre `requirements.txt` pineado | **0 vulnerabilidades** |
| npm audit (cliente) | 11 vulns → ver F-D1 |
| gitleaks (historial completo, 201 commits) | 1 secreto ×2 apariciones → F-L1 |
| DAST manual vs `127.0.0.1:8000` | 18 pruebas → evidencia abajo |
| pytest regresión (`backend/tests/`) | 10 tests, todos verdes |

Herramientas NO ejecutadas: OWASP ZAP y Trivy (no hay Java ni Docker en el
entorno; `~/proyecto/zaproxy` es el repo fuente, no un ejecutable). El DAST
manual cubrió los mismos vectores a nivel HTTP.

## Hallazgos CONFIRMADOS y corregidos

### F1 — Estado de checkout de invitado siempre denegado (ALTA, funcional+AC)
- **Archivo**: `backend/checkout_api.py`, `estado_checkout()` (línea ~531).
- **Causa raíz**: el `select` de PostgREST no pedía la columna
  `acceso_token`; el chequeo posterior `o.get("acceso_token")` siempre era
  `""` → 403 para todo invitado con token válido.
- **Impacto**: invitados nunca podían ver el estado de su pedido tras pagar
  (el cliente `PagoResultado.jsx` llama `?token=` en ese endpoint — flujo
  real roto en producción).
- **Evidencia**: revisión de código + llamada real del cliente
  (`ecomers/client/src/services/orderService.js:56`).
- **Fix**: `acceso_token` agregado al select. Test: invitado+token→200,
  sin token→403, token malo→403, orden ajena→404.

### F2 — Reintento de orden cancelada cobraba sin stock (ALTA, lógica)
- **Archivo**: `backend/checkout_api.py`, `reintentar_checkout()`.
- **Causa raíz**: se permitía `cancelada → pendiente` creando una nueva
  preferencia de MP sin re-reservar el stock ya liberado → oversell cobrado.
- **Fix**: al reintentar una `cancelada` se re-lee `orden_items`, se
  verifica stock/activo/borrado y se llama `_reservar` antes de crear la
  preferencia; si la preferencia falla, la re-reserva se deshace con
  `_liberar` y la orden queda `cancelada`. Órdenes `pendiente` no
  re-reservan (no hay doble descuento). `mp_token` se valida antes de
  reservar para no dejar reserva huérfana en entornos sin MP.
- **Tests**: cancelada→re-reserva 200, sin stock→409 sin preferencia,
  pendiente→sin doble reserva, pagada→409.

### F3 — `_es_url_mp` rechazaba TODO init_point legítimo (ALTA, funcional)
- **Archivo**: `backend/checkout_api.py:63`.
- **Causa raíz**: `urlparse().scheme` devuelve `"https"` pero se comparaba
  con `"https:"` → siempre `False` → `crear` y `reintentar` fallaban con
  "preferencia inválida"/502 en **toda** creación de pago.
- **Impacto**: el checkout completo estaba inoperativo; detectado por el
  test de regresión (los mocks con URL válida de MP eran rechazados).
- **Fix**: `u.scheme == "https"`. Tests: acepta host MP real, rechaza
  `http://`, `*.evil.com` y `javascript:` (el allowlist anti-SSRF sigue
  firme).

### F4 — Comprobantes/PDF apuntaban al esquema legacy (MEDIA, funcional+AC)
- **Archivo**: `backend/comprobantes.py`.
- **Causa raíz**: usaba `pagos_mp._sb` (implementación vieja) y campos del
  esquema `004_checkout_real` (`token_verificacion`, `numero`,
  `items_snapshot`, `emitido_en`, `documento`, `provincia`) que no son los
  del esquema vigente `006_checkout_servidor` (`acceso_token`,
  `total_centavos`, `emitida_at`). El link de verificación del PDF salía
  con token vacío y los campos, vacíos; en una DB canónica el `select`
  de columnas inexistentes devuelve 400.
- **Fix**: helper `_sb` propio con `httpx` (se retira la dependencia de
  `pagos_mp`), select alineado a columnas escritas por el código vigente
  (incluye `acceso_token` y `orden_items` anidados), PDF con fallbacks
  (`emitida_at`, `mp_payment_id` como número, ítems desde `orden_items`,
  total con fallback a `total_centavos`).

### F5 — `pagos_mp.py`: implementación MP duplicada y legacy (MEDIA)
- **Evidencia**: 269 líneas con endpoints/lógica del diseño anterior
  (`token_verificacion`, `expira_en`), `urllib` dinámico (3 hallazgos
  Semgrep F-S1). Solo era importada por `comprobantes.py` para `_sb`.
- **Fix**: archivo eliminado tras dar a `comprobantes` su propio helper.
  Cierra los 3 findings de Semgrep y una segunda superficie de pago.

### F6 — Migraciones duplicadas con esquemas divergentes (MEDIA, release)
- **Archivos**: `supabase/migrations/` (parejas 004/005/006/007) y
  `ecomers/client/supabase/migrations/002_ordenes_y_perfiles.sql` (eliminada).
- **Evidencia**: `004_checkout_real` y `006_checkout_servidor` crean
  `eventos_webhook`/`comprobantes` con columnas distintas;
  `CREATE TABLE IF NOT EXISTS` hace que gane la primera aplicada y el
  backend actual solo funciona con el esquema de 006 (usa
  `fuente/evento_id/estado/payload` y `total_centavos`). La copia en el
  cliente divergía de `002_ordenes.sql`+`003_negocio.sql`.
- **Fix**: `ecomers/client/supabase/` eliminada; `README.md` en
  `supabase/migrations/` documenta el orden canónico y marca
  `004_checkout_real` y `007_test_admin` como no aplicables a bases nuevas.

### F7 — Endpoints/código muerto o desalineado (BAJA)
- `/api/productos` en `main.py` leía un CSV inexistente → devolvía error
  (verificado en vivo). Eliminado junto con `pandas` de requirements y la
  función huérfana `_sdk_mp`/`import mercadopago`.
- `/api/buscar` exige permiso admin: el cliente nunca lo llama (grep de
  `ecomers/client/src`), no es fuga pública; se documenta, no se abre.

### F8 — Hardening aplicado (BAJA)
- Middleware de headers: `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` (antes: ninguno).
- `/api/checkout/liberar-expiradas` acepta `X-Cron-Secret` cuando
  `CRON_SECRET` está definido (retrocompatible: sin env, sigue abierto pero
  rate-limited y solo actúa sobre órdenes ya expiradas).
- `requirements.txt` pineado a versiones instaladas (fastapi 0.142.2,
  httpx 0.28.1, uvicorn 0.54.0, pydantic 2.13.5, python-dotenv 1.2.4,
  google-genai 2.29.0, mercadopago 3.6.0); `pandas` removido.

## Hallazgos / falsos positivos

### F-S1 — Semgrep `dynamic-urllib-use` en `pagos_mp.py` ×3
Host construido desde env del operador o API fija de MP → riesgo real de
SSRF/LFI **bajo**, no controlable por el cliente. **Resuelto por
eliminación** del archivo (F5).

### F-L1 — gitleaks: publishable key de Supabase en el historial
- 2 apariciones de la misma `VITE_SUPABASE_PUBLISHABLE_KEY` (commits
  `a574a6d`, `86c12dc`) + copia vigente en `ecomers/client/.env.example`
  (cambio local no commiteado del usuario — **no se tocó**).
- **Análisis**: es la anon/publishable key — diseñada para ser pública
  (viaja en el bundle del navegador); la protección real es RLS. No es
  equivalente a filtrar la `service_role`. **Riesgo: bajo.**
- **Recomendación**: mantener placeholder en `.env.example`, rotarla si
  alguna vez se usó como si fuera secreta, y purgar historial solo si el
  equipo quiere higiene (no es urgente). NO se encontraron claves
  service_role, MercadoPago ni Gemini en el historial.

### F-D1 — npm audit del cliente: 11 vulns (8 high / 3 moderate)
`playwright<1.55.1` (CA en descarga de browsers), `source-map-js` (DoS por
sourcemaps), `vite`/`esbuild` (dev server), `react-router(-dom)` (open
redirect con backslash + SSR constructor injection). **No se actualizó
nada** (react-router fijo exige major bump con breaking changes). Riesgo
real bajo: son issues de tooling/dev-server y navegación, no ejecución en
el backend. Evaluación de upgrade pendiente del equipo de front.

## DAST manual — evidencia (localhost:8000, datos sintéticos)

| Prueba | Resultado |
|---|---|
| `GET /api/admin/resumen` sin token | 401 ✓ |
| idem con token basura | 503 (config local sin Supabase real — fail-closed, sin bypass) |
| `GET /api/buscar?q=` sin token | 401 ✓ |
| `POST /api/webhooks/mercadopago` sin `data.id` | 200 `{"ignorado":"sin data.id"}` (procesa nada) |
| idem con `data.id` sin `MP_WEBHOOK_SECRET` | 503 fail-closed |
| `POST /api/contacto` email inválido | 422 |
| `POST /api/checkout/crear` items vacíos | 422 |
| idem cantidad>100 / envio inválido | 422 |
| `POST /api/chat` ×21 (límite 20/min) | 429 en la req. 21 exacta |
| `OPTIONS` origen `evil.example.com` | 400, sin `allow-origin` |
| `OPTIONS` origen `localhost:5173` | 200 + allow-origin correcto |
| Headers seguridad | ausentes → **presentes tras fix** (nosniff/DENY/no-referrer) |
| `/api/productos` | `"CSV no encontrado"` → **404 tras eliminación** |
| `/docs` | 200 (expone esquema — superficie conocida) |

Limitación del DAST: sin `SUPABASE_SERVICE_ROLE_KEY` real, los endpoints
que tocan BD devuelven 503 (fail-closed) — los flujos BD se verificaron
con tests pytest que mockean `_sb_*` (misma lógica de código, sin red).

## Clasificación final

| ID | Título | Severidad | Estado |
|---|---|---|---|
| F1 | acceso_token no seleccionado → invitado 403 | Alta (funcional/AC) | Corregido+test |
| F2 | reintento cancelada sin re-reserva → oversell | Alta | Corregido+test |
| F3 | `_es_url_mp` siempre False → checkout roto | Alta (funcional) | Corregido+test |
| F4 | comprobantes/PDF sobre esquema legacy | Media | Corregido |
| F5 | `pagos_mp.py` duplicado + urllib dinámico | Media | Eliminado |
| F6 | migraciones divergentes (002 cliente, 004/006) | Media | Corregido+doc |
| F7 | `/api/productos` CSV muerto, `_sdk_mp` huérfano | Baja | Eliminado |
| F8 | sin security headers / cron abierto / reqs sin pin | Baja | Endurecido |
| F-L1 | publishable key en historial | Baja (diseño) | Documentado |
| F-D1 | deps del cliente (npm audit) | Baja (front/dev) | Pendiente equipo front |
| F-S1 | dynamic-urllib (semgrep) | Baja real | Resuelto por F5 |
