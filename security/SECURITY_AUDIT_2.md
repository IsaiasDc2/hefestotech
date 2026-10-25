# SECURITY_AUDIT_2.md — Re-auditoría con toolchain completo (ZAP incluido)

> Fecha: 2026-10-21
> Base: rama `IAGroncha` (post-auditoría 1, con cambios nuevos: migración a Groq, cadena
> de failover Groq→Gemini→OpenRouter, `historial` en `/api/chat`, `ver_modelos.py`,
> hardening de `MensajePrevio`/`historial`).
> Auditoría previa: `security/SECURITY_AUDIT.md` (fix/security-audit, base 62e4b83).
> Diferencia clave vs. auditoría 1: **ahora hay Java 21** → se compiló OWASP ZAP desde
> el repo fuente `~/proyecto/zaproxy` (antes documentado como riesgo R7: sin DAST real).

---

## 1. Alcance y diferencias respecto a auditoría 1

### Cambios en el código desde entonces (`git diff` sobre rama actual)

| Archivo | Cambio | Superficie nueva |
|---|---|---|
| `backend/main.py` | +146/−83 | Cadena de failover `PROVEEDORES_IA` (Groq/Gemini/OpenRouter), modelo `MensajeUsuario` con `historial`, validadores nuevos, `HTTPException` respetado en el catch-all |
| `backend/ver_modelos.py` | nuevo | Utilidad local para listar modelos Groq; no expone secretos, sin endpoints |
| `ecomers/client/src/components/layout/Asistente.jsx` | modificado | Envía `historial` (últimos 10 msgs, ≤500 chars c/u) a `/api/chat` |
| `checkout_api.py`, `comprobantes.py`, `admin_api.py` | sin cambios | Los fixes F1–F8 siguen vigentes tal cual |
| `backend/.env` (no versionado) | actualizado | URL Supabase corregida (`trsj`→`trsjl` typo), `sb_secret`, GROQ+OPENROUTER keys |

### Novedad de infraestructura

- El **"proyecto Supabase muerto" era un typo de URL** (`ewqwmzwtrsj1...` → `ewqwmzwtrsjl...`).
  El proyecto existe; REST responde con la publishable key: 54 productos con
  categorías en singular (match exacto con `ArmadorPc`). No hubo pérdida de datos.
- Java 21 presente → ZAP compilado desde fuente (`:zap:distCrossplatform`).

---

## 2. Metodología

1. Re-lectura de `SECURITY_AUDIT.md` + `REMAINING_RISKS.md` → alcance del retest.
2. Diff del código post-auditoría → superficie nueva.
3. SAST: Semgrep `p/python` (venv limpio, ver §6 — R8 resuelto por separación de envs).
4. SCA: `pip-audit` (requirements.txt pineado), `npm audit` (frontend).
5. Regresión: `pytest tests/test_checkout_api_security.py` (suite dejada por auditoría 1).
6. DAST manual: vectores de la auditoría 1 contra backend vivo en :8000.
7. DAST con OWASP ZAP 2.17.0 (release oficial; el build desde fuente no
   arranca sin add-ons — ver §7b): ver §7.
8. Verificación real del esquema Supabase con `sb_secret` (R5, antes sin credenciales).

---

## 3. Verificación del esquema real (R5 → CERRADO)

Auditoría 1 no pudo verificar si la DB seguía el orden canónico `006_checkout_servidor`
porque faltaban credenciales. Con `sb_secret` se consultó el esquema vía PostgREST
(la API devuelve 200 si la columna existe, 400 si no):

```
eventos_webhook: fuente=200  evento_id=200  estado=200  payload=200
                 mp_payment_id=400  numero=400  token_verificacion=400
ordenes:         acceso_token=200  expira_at=200  total_centavos=200
                 token_verificacion=400  expira_en=400
```

**Resultado: la DB real coincide con el esquema canónico.** `ordenes` tiene
`acceso_token`/`expira_at`/`total_centavos` (006), `eventos_webhook` tiene
`fuente`/`evento_id`/`estado`/`payload`. Las columnas legacy no existen.
R5 de la auditoría 1 pasa a **verificado/cerrado**. Las migraciones fueron
aplicadas en el orden del README de `supabase/migrations/`.

---

## 4. SAST — Semgrep (venv limpio)

```
$ /tmp/secvenv/bin/semgrep scan --config p/python .   (en backend/)
   → 0 findings, 45 rules, ~1s
```

Cero hallazgos en `main.py` nuevo, `checkout_api.py`, `comprobantes.py`, `admin_api.py`.

Nota de proceso: `backend/../.venv` tiene `semgrep` instalado pero **roto** por
conflicto de versiones `opentelemetry-*` (R8). Se creó `/tmp/secvenv` con
`semgrep==1.182.0` aislado → **R8 mitigado de facto** (herramientas separadas del
venv de la app). Queda recomendación: desinstalar `semgrep`/`gitleaks`/`pip-audit`
del `.venv` del proyecto, o fijarlo en docs que el venv de auditoría es aparte.

---

## 5. SCA — dependencias

| Herramienta | Objetivo | Resultado |
|---|---|---|
| `pip-audit` | `requirements.txt` (todo pineado tras F8) | **0 vulnerabilidades conocidas** |
| `npm audit` | `ecomers/client` | **2 moderate** — idénticos a auditoría 1 (R4): `react-router` ≤7.1.4 (CVE-2025-68470 open-redirect vía `\`; GHSA-337j-9hxr-rhxg constructor injection en SSR). Fix = upgrade major a react-router 7.x → decisión de producto, no se aplica automáticamente |

`gitleaks`: no está instalado en el sistema (en auditoría 1 tampoco; se verificó
manualmente que `.env` no está trackeado — verificado de nuevo: `git ls-files
*.env` vacío en repo y en `ecomers/client`).

---

## 6. Regresión — tests de seguridad

```
$ pytest tests/test_checkout_api_security.py
   → 10 passed, 1 warning in 1.38s
```

La suite de la auditoría 1 (auth de admin, CORS, rate-limit, headers, esquema
canónico con mocks) sigue verde sobre el código nuevo.

---

## 7. DAST

### 7a. Vectores manuales contra backend vivo (`:8000`, uvicorn)

| Vector | Resultado |
|---|---|
| `GET /api/admin/ordenes` sin token | **401** |
| `GET /api/admin/buscar` sin token | **401** |
| Headers en cualquier respuesta | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` ✔ |
| `OPTIONS` con `Origin: https://evil.com` | **400** (CORS rechaza origen no permitido) |
| `POST /api/chat` sin texto | **422** |
| `POST /api/chat` texto vacío/espacios | **400** "Mensaje vacío." |
| `POST /api/chat` `historial` con `rol:"system"` + texto de 900 chars | responde normal con personaje Hefesto → **rol filtrado por allowlist + texto truncado a 500** |
| `GET /docs` | 200 (OpenAPI expuesto — ver §9, hallazgo menor) |

### 7b. OWASP ZAP

**Toolchain:** el build `:zap:distCrossplatform` compilado desde fuente
(`ZAP_2.18.0-SNAPSHOT`, en `~/proyecto/zaproxy`) no arranca out-of-the-box —
las distros SNAPSHOT solo empaquetan los add-ons presentes en `plugin/` y el
repo no los incluye (BUILDING.md); sin `callhome` (add-on obligatorio) ZAP no
inicia ni puede auto-instalarlos. **Solución aplicada:** se copiaron los 51
add-ons `.zap` de la release oficial **ZAP 2.17.0 Crossplatform** al `plugin/`
del snapshot → el build de fuente quedó funcional y se **verificó contra el
backend vivo** con `-quickurl` (resultado idéntico: 1 Medium ambiental,
mismas stats 40% 2xx / 60% 4xx).

El **active scan completo** sobre el OpenAPI (los resultados de abajo) se corrió
con la release 2.17.0 en modo daemon — las reglas de scan viven en los add-ons
(mismos `.zap` en ambos), así que el resultado es equivalente al del build de
fuente. Snapshot funcional en `/tmp/zapdist/ZAP_2.18.0-SNAPSHOT` (efímero);
para hacerlo persistente copiar los `.zap` a
`~/proyecto/zaproxy/zap/src/main/dist/plugin/` antes del próximo build.

**Modo:** daemon en `127.0.0.1:8090` → import del `openapi.json` del backend
(49 URLs, 30 endpoints reales — cobertura completa de la API, no solo lo que
un spider encuentra en HTML) → **active scan completo** (`ascan`, recurse)
contra `http://localhost:8000`.

**Resultado del scan:**

| Severidad | Cantidad | Detalle |
|---|---|---|
| High | 0 | — |
| Low | 0 | — |
| Medium | 1 | `HTTP Only Site` — el backend local sirve HTTP plano. **No aplica a producción** (Render provee TLS); es ruido ambiental del target local |
| Informational | 77 | `User Agent Fuzzer` ×72 (ruido propio del scanner, no es vulnerabilidad); `Sensitive Information in URL` ×4 — params `?token=` en `/api/checkout/estado/{id}`, `/api/checkout/{id}/reintentar`, `/api/comprobantes/{cid}` y `/pdf` — **diseño conocido** (acceso por token en query, ya documentado en A1); `Session Management Response Identified` ×1 |

**Comportamiento del backend bajo ataque activo** (del log de uvicorn):

- **0 errores 500 / 0 tracebacks** en ~5.000 requests fuzzeados.
- Endpoints `/api/admin/*`: **100% 401** — el auth rechaza todo payload sin token.
- `/api/checkout/crear`, `/api/chat`, `/api/contacto`: **429** por rate-limit +
  **422** por validación pydantic — ningún payload cruzó las barreras.
- El rate-limit por IP frenó el scan (33%→100% tomó ~5 min por los 429) —
  evidencia en vivo de que el control funciona.

**Clasificación:** ningún hallazgo explotable. El único Medium es ambiental
(HTTP local). Los Informational de `?token=` quedan como diseño aceptado
(alternativa futura: token por header `Authorization` para no exponerlo en
logs de proxy; impacto bajo, los tokens son de un solo uso y expiran).

Reporte completo: `security/zap-report-2026-10-22.html`.

---

## 8. Revisión manual del código nuevo (post-auditoría 1)

### 8a. `PROVEEDORES_IA` — cadena de failover

- URLs hardcodeadas a endpoints oficiales (`api.groq.com`,
  `generativelanguage.googleapis.com`, `openrouter.ai`) — sin SSRF por config.
- Keys solo desde `os.getenv()` — nunca logueadas ni devueltas (`/` expone solo
  booleanos de presencia).
- `requests.post` con `timeout=25` + header `Authorization: Bearer` — OK.
- `asyncio.to_thread` evita bloquear el loop — decisión correcta.
- `except HTTPException: raise` antes del catch-all → los 429 propagan bien
  (fix aplicado en esta iteración, verificado en tests manuales).
- Fallthrough correcto: excepción/no-200 → siguiente proveedor; 429 solo se
  devuelve al cliente si **todos** los configurados dieron 429.

### 8b. `historial` — memoria conversacional (nuevo)

- `MensajePrevio` restringido a roles conocidos; cualquier otro valor se ignora
  al armar `mensajes` (allowlist implícita en el `for`). **Verificado en vivo:**
  inyectar `rol:"system"` en historial no altera el comportamiento.
- Truncado a 500 chars por mensaje y `[-10:]` mensajes — el prompt enviado al
  proveedor queda acotado (~10×500 + 500 del texto actual ≈ 5.5K chars máx ≈
  ~1.5K tokens de input extra).
- **Hardening aplicado durante esta auditoría:** a falta de límite en el modelo,
  un cliente podía mandar un `historial` de N×∞ chars que pydantic parseaba
  completo antes del slice. Se agregaron validadores: `MensajePrevio.texto`
  corta a 500 en parse-time y `historial` toma `v[-20:]` (máx 20 ítems).
  _Residual:_ el body JSON completo igual se parsea — un POST de 50MB consume
  memoria antes de validar. Mitigación real = límite de body-size a nivel
  uvicorn/proxy. Riesgo bajo para el caso de uso (chat de e-commerce detrás de
  rate-limit por IP), se documenta en §10.

### 8c. `ver_modelos.py`

- Script local de debug; usa `GROQ_API_KEY` del env, hace GET a `/models`, no
  imprime la key. Sin superficie (no se importa en `main.py`).

### 8d. Frontend `Asistente.jsx`

- Solo agrega `historial` al body. No toca keys (correcto — sigue sin exponer
  secretos; la GROQ_API_KEY que estuvo en `.env.local` fue removida en iteración
  anterior). `slice(-10)` en cliente + `[-20:]` en servidor = doble cap.

### 8e. Secretos fuera del código

- `.env` no versionado ✔ (verificado de nuevo).
- `ecomers/client/.env` (el "viejo") contiene todavía `SUPABASE_SERVICE_ROLE_KEY`,
  `MP_ACCESS_TOKEN`, `GROQ_API_KEY` — **archivo sin efecto** (Vite solo lee
  `.env.local` + `VITE_*`), pero es mala práctica tener secretos de backend en la
  carpeta del frontend. Recomendación: vaciar/eliminar `ecomers/client/.env`.
- **Keys expuestas en este chat/sesión:** GROQ, OPENROUTER, `sb_secret` Supabase.
  Tratadas como comprometidas por transitividad del historial → **rotar las 3**
  en los dashboards correspondientes (tarea operativa, fuera de código).

---

## 9. Hallazgos nuevos (esta auditoría)

| # | Severidad | Hallazgo | Estado |
|---|---|---|---|
| N1 | **Baja** | `historial` sin límite de parse → POST con body gigante consume memoria antes de validar | **CERRADO** — middleware global `limite_body` (§12): 413 si `Content-Length` > 1 MB y también corta bodies chunked durante el stream. Verificado en vivo: 1.5 MB → 413 |
| N2 | **Baja** | `ecomers/client/.env` con secretos de backend (service-role, MP token, Groq) | **CERRADO** — archivo eliminado; `.env.local` solo tiene `VITE_*` públicas |
| N3 | **Info** | `/docs` y `/openapi.json` expuestos en producción | **CERRADO** — FastAPI arranca con `docs_url=None`/`openapi_url=None` cuando `RENDER` o `DISABLE_API_DOCS` están definidos. Verificado: `RENDER=true` → 404 en ambos; local sigue 200 |
| N4 | **Info** | Rate-limit in-memory por IP (R1 de auditoría 1) persiste — bypasseable distribuyendo origen; aceptado por escala del proyecto | Residual aceptado |
| N5 | **Info** | Fallo de TODOS los proveedores devuelve mensaje genérico sin leak de detalle interno ✔ (verificado: el 200-degradado no expone trazas ni keys) | Buen comportamiento |

## 10. Riesgos pendientes consolidados (auditoría 1 + 2)

| Riesgo | De | Estado |
|---|---|---|
| R1 rate-limit in-memory | A1 | Residual aceptado (N4) — migrar a Redis/Upstash solo si se escala a >1 instancia |
| R2 `CRON_SECRET` opcional en `liberar-expiradas` | A1 | **CERRADO** — fail-closed: sin `CRON_SECRET` configurado el endpoint devuelve 401 (verificado en vivo). **Acción operativa**: definir `CRON_SECRET` en Render y pasarlo con `X-Cron-Secret` en el cron job, o la limpieza de órdenes expiradas queda deshabilitada |
| R3 testing E2E con staging | A1 | Pendiente — falta entorno staging para probar MP/Supabase end-to-end |
| R4 npm audit front | A1 | **CERRADO** — 0 vulnerabilidades tras upgrades (§12): react-router-dom 6→7.18.4, vite 5→8.3.5, @vitejs/plugin-react→5.2.0, gh-pages→6.1.1, playwright+source-map-js via `npm audit fix`. Build verificado |
| R5 esquema real de DB | A1 | **CERRADO** — esquema canónico verificado contra DB real (§3) |
| R6 migraciones aplicadas a mano | A1 | Parcialmente cerrado por R5 — esquema correcto, pero el procedimiento sigue siendo manual |
| R7 sin DAST real (Java faltante) | A1 | **CERRADO** — ZAP 2.17.0 + snapshot de fuente funcional (§7b) |
| R8 venv contaminado por herramientas | A1 | **CERRADO** — semgrep desinstalado del `.venv`, opentelemetry realineado (api/sdk/proto 1.45.1, instrumentation 0.66b1), `pip check` limpio. Herramientas de auditoría en `~/proyecto/secvenv` (persistente, fuera del repo) |

---

## 12. Fixes aplicados post-auditoría 2 (2026-10-22)

Cambios de código/config que cierran N1, N2, N3, R2, R4 y R8:

| Fix | Archivo | Detalle |
|---|---|---|
| Límite global de body | `backend/main.py` | Middleware `limite_body`: 413 si `Content-Length` > 1 MB; además envuelve `receive` para cortar streams chunked que superen 1 MB aunque no declaren largo |
| Docs ocultos en prod | `backend/main.py` | `docs_url`/`redoc_url`/`openapi_url` = `None` si `RENDER` o `DISABLE_API_DOCS` están en el env. Local sigue sirviendo /docs |
| `liberar-expiradas` fail-closed | `backend/checkout_api.py` | Sin `CRON_SECRET` → 401 siempre (antes quedaba abierto rate-limited). Con secret → `X-Cron-Secret` por `hmac.compare_digest` como antes |
| Secretos en carpeta del front | `ecomers/client/.env` | Eliminado (era archivo muerto con service-role/MP/Groq). `.env.local` conserva solo `VITE_*` |
| Deps del front | `ecomers/client/package.json` | react-router-dom 6.27→7.18.4 (el front solo usa APIs declarativas: `Routes`, `Link`, `useNavigate` — compatibles), vite 5→8.3.5, @vitejs/plugin-react→5.2.0, gh-pages→6.1.1, playwright+source-map-js via `npm audit fix`. `npm audit` = **0 vulns**, `npm run build` verde |
| venv del proyecto | `.venv` | `semgrep` desinstalado; opentelemetry realineado (api/sdk/proto 1.45.1, instrumentation/exporters 0.66b1); `pip check` sin conflictos. Herramientas de auditoría viven en `~/proyecto/secvenv` (persistente, fuera del repo) |

**Verificación post-fixes:** pytest 10/10 verde; en vivo: body 1.5 MB → 413,
`liberar-expiradas` sin secret → 401, `RENDER=true` → docs 404 + `/` 200,
`/api/chat` responde normal.

**Pendientes que NO son de código** (acción manual del operador):

1. **Rotar GROQ_API_KEY, OPENROUTER_API_KEY y `sb_secret` de Supabase** —
   aparecieron en texto claro en esta sesión → tratarlas como comprometidas.
2. **Definir `CRON_SECRET` en Render** y pasarlo como `X-Cron-Secret` al cron
   de `liberar-expiradas` — si no, la limpieza de órdenes expiradas queda OFF.
3. Staging Supabase + prueba E2E de pago real (R3).

---

## 11. Resumen ejecutivo

| Dimensión | Estado |
|---|---|
| SAST (Semgrep p/python) | 0 hallazgos |
| SCA backend (pip-audit) | 0 CVEs |
| SCA frontend (npm audit) | **0 vulns** — upgrades aplicados (§12) |
| Regresión pytest | 10/10 verde |
| DAST manual | todos los vectores de A1 rechazados correctamente |
| DAST ZAP 2.17.0 (OpenAPI + active scan) | 0 High / 0 Low / 1 Medium ambiental / 77 Info — sin hallazgos explotables |
| Esquema DB | canónico verificado (R5 cerrado) |
| Fixes F1–F8 | vigentes, sin regresión |
| Secretos | `.env` fuera de git; `client/.env` eliminado; **pendiente rotar** keys expuestas en sesión (§12) |

**Conclusión:** sin vulnerabilidades nuevas explotables. El código
post-auditoría (failover + historial) mantiene las garantías de F1–F8: no introduce
SSRF, no filtra secretos, no abre auth-bypass. La superficie nueva de `historial`
quedó acotada con validadores. El DAST con ZAP (active scan sobre los 30 endpoints
del OpenAPI) produjo 0 hallazgos explotables y evidenció en vivo que auth,
rate-limit y validación rechazan payloads hostiles sin errores 500.
