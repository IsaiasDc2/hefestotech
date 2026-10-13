# Riesgos Remanentes, Limitaciones y Decisiones

## Riesgos residuales aceptados / pendientes

| # | Riesgo | Severidad | Estado / acción sugerida |
|---|---|---|---|
| R1 | Rate-limit solo en memoria (por proceso) | Baja | Con múltiples workers/instancias en Render el límite se multiplica y se resetea al reiniciar. Migrar a Redis/Upstash o middleware compartido cuando haya más de 1 instancia. |
| R2 | `/api/checkout/liberar-expiradas` abierto si `CRON_SECRET` no se configura | Baja | Definir `CRON_SECRET` en producción y llamarlo con `X-Cron-Secret`; el endpoint es idempotente pero fuerza trabajo de BD (hasta 100 órdenes/llamada). |
| R3 | Publishable key de Supabase en historial + `.env.example` local | Baja | Es la anon key (pública por diseño; RLS es el control real). Mantener placeholder en el repo; rotar si el equipo la trató como secreta; purgar historial solo por higiene. **No se tocó el cambio local del usuario en `.env.example`.** |
| R4 | Dependencias del cliente con 11 vulns (npm audit) | Baja-media | `react-router-dom` fija requiere major bump (breaking). Playwright/source-map-js/esbuild son dev-tooling. Decisión del equipo front; no se actualizó nada para no romper compatibilidad. |
| R5 | Migraciones aplicadas a mano | Media | El orden ya está documentado (`supabase/migrations/README.md`) pero una DB existente pudo haber aplicado `004_checkout_real` antes que `006_checkout_servidor` → esquema viejo de `eventos_webhook`/`comprobantes`. **Acción pendiente**: inspeccionar la DB real (`\d eventos_webhook`) y reconciliar a mano si difiere. No se hizo: exige acceso a la DB que no fue autorizado. |
| R6 | Doble escritura pesos/centavos en `ordenes` | Baja | El código mantiene columnas `subtotal` y `subtotal_centavos` por compatibilidad; riesgo de desincronización futura. Consolidar cuando el esquema se estabilice. |
| R7 | CORS `allow_credentials=True` + allowlist por env | Baja | Un `FRONTEND_URL` mal configurado expondría credenciales a ese origen. Mantener la lista mínima. |
| R8 | `.venv` contaminado por herramientas de auditoría | Baja (entorno) | `semgrep`/`pip-audit`/`pytest` se instalaron en el venv del proyecto y downgradearon `opentelemetry-*` (warning del resolver de pip; el backend importa y funciona igual — semgrep pinnéa `~=1.37` vs fastapi `>=1.44`). Recomendado: venv separado para herramientas o reinstalar `opentelemetry-api>=1.44` si fastapi-otel se usa. |
| R9 | Sin HSTS/CSP en el backend | Baja | API JSON pura; aplicar si se sirve HTML. HSTS es responsabilidad del TLS frontal (Render/GH Pages). |

## Falsos positivos aclarados

- **Semgrep dynamic-urllib (`pagos_mp.py` ×3)**: el host venía de env del
  operador o de la API fija de MP, no del usuario → riesgo real bajo;
  de todos modos el archivo se eliminó (código muerto).
- **`/api/buscar` 401 público**: no es fuga ni bug de acceso — es endpoint
  admin por diseño y el cliente no lo usa.
- **Webhook 200 sin firma**: acepta el POST pero no procesa nada sin
  `data.id` válido ni firma verificable (fail-closed a 503 sin secret).

## Limitaciones de la auditoría

- Sin credenciales de Supabase de staging: los flujos que tocan BD se
  verificaron por código + tests mockeados, no E2E reales.
- Sin Java/Docker: ZAP y Trivy no corrieron; se usó DAST manual equivalente.
- No se probó con pagos reales ni credenciales de MercadoPago.
- El estado real del esquema en Supabase producción es desconocido (R5);
  si la DB aplicó migraciones en orden distinto, pueden existir columnas
  legacy (`token_verificacion`, `expira_en`, `numero`) que el código ya
  no escribe — inofensivas pero confirmar.
- No se evaluó el frontend como superficie (fuera del alcance pedido:
  backend). Las vulns de deps front quedan listadas sin remediar.

## Recomendaciones futuras (no bloqueantes)

1. Provisionar proyecto Supabase de staging + `CRON_SECRET` + cron job
   documentado para `liberar-expiradas`.
2. Reconciliar la DB real contra el orden canónico de migraciones (R5).
3. Rate-limit distribuido si se escala a >1 instancia (R1).
4. Consolidar `_sb`/`_sb_get`/`_sb_post`/`_sb_patch` en un cliente único
   (hoy hay dos implementaciones: `checkout_api` y `comprobantes`).
5. Evaluar upgrade de `react-router-dom` en el cliente (R4).
