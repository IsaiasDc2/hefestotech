# Modelo de Amenazas — HefestoTech

Fecha: auditoría `fix/security-audit` (commit base `62e4b83`).

## Arquitectura

```
React/Vite (5173 / GH Pages)
   ├── Supabase REST + Auth (anon/publishable key, RLS) ──► Postgres Supabase
   └── FastAPI backend (:8000 / Render)
         ├── Supabase REST con SERVICE_ROLE_KEY (bypasa RLS)
         ├── MercadoPago (preferencias + webhook con firma HMAC)
         └── Google Gemini (chat)
```

El backend es el único poseedor de `SUPABASE_SERVICE_ROLE_KEY`,
`MERCADOPAGO_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` y `GEMINI_API_KEY`.
La base de datos real es Postgres detrás de Supabase; el backend nunca
expone SQL, solo REST/Auth/RPC.

## Superficie de ataque

| Entrada | Auth | Riesgo principal |
|---|---|---|
| `POST /api/checkout/crear` | opcional (invitado o JWT) | manipulación de precio/stock, abuso de reservas |
| `GET /api/checkout/estado/{id}` | `acceso_token` (invitado) o JWT dueño | IDOR de datos de pedido |
| `POST /api/checkout/{id}/reintentar` | igual que estado | oversell, pagos por órdenes inválidas |
| `POST /api/webhooks/mercadopago` | firma `x-signature` HMAC + consulta a MP | spoofing de pagos, replay |
| `POST /api/checkout/liberar-expiradas` | ninguna (opcional `CRON_SECRET`) | liberación de reservas de terceros |
| `GET /api/comprobantes/{id}` (+`/pdf`) | token/JWT vía `_orden_visible` | IDOR de comprobantes |
| `POST /api/chat` | ninguna + rate-limit | abuso de cuota Gemini, prompt injection |
| `POST /api/contacto`, `/api/newsletter` | ninguna + rate-limit | spam, inyección en almacenamiento |
| `/api/admin/*` (28 endpoints) | JWT + `perfiles.rol` + `PERMISOS` | escalamiento de privilegios |
| `GET /api/buscar` | JWT admin | info disclosure si se abriera |
| `GET /` , `/docs` | pública | fingerprinting (aceptable) |

## Activos y flujos sensibles

- **Service role key**: en env del backend; si se filtra = control total de la
  BD (bypasa RLS). Ruta de fuga: logs, repo, respuestas de error.
- **Datos personales**: nombre/email/dirección/CP en `ordenes`; acceso vía
  `acceso_token` (guessable? `secrets`-generado, comparado con
  `hmac.compare_digest`).
- **Dinero**: `total_centavos` recalculado en servidor; el precio que envía el
  cliente se ignora (verificado en código).
- **Stock**: reservas vía RPC `adjust_stock` con rollback por compensación.
- **Webhook MP**: sin firma válida no se procesa nada (fail-closed → 503);
  la firma se verifica con `compare_digest`; idempotencia por
  `eventos_webhook (fuente, evento_id)`.

## Actores de amenaza

1. Comprador malicioso: intenta pagar menos, reusar tokens, IDOR de pedidos.
2. Atacante externo sin cuenta: fuerza bruta de tokens, abuso de endpoints
   públicos (chat/contacto), webhook spoofing.
3. Usuario autenticado con rol bajo: intenta endpoints admin (`requiere()`).
4. Insider/operador: exfiltración vía `service_role` mal manejada.

## Controles existentes verificados

- JWT validado contra Supabase `/auth/v1/user`; rol leído de `perfiles`
  (nunca del cliente). Matriz `PERMISOS` por rol.
- Firma de webhook HMAC-SHA256 (`manifest id=...,ts=...`) + `compare_digest`
  + verificación del pago contra la API de MP antes de mutar estado.
- Precios/stock recalculados server-side; centavos enteros.
- Rate-limit en memoria por IP/endpoint (chat 20/min, checkout 10/min, etc.).
- Pydantic validators en todos los bodies (límites 1–100 uds, 1–50 líneas).
- IDOR: órdenes con `user_id` devuelven 404 a quien no es dueño (no revela
  existencia).
- `_es_url_mp`: allowlist de hosts para `init_point` (anti open-redirect).
- Errores genéricos hacia el cliente; detalles solo en logs del servidor.

## Riesgos estructurales

- Rate-limit en memoria: no sobrevive reinicio ni multi-instancia.
- Migraciones aplicadas a mano (SQL Editor): orden ambiguo histórico
  (documentado en `supabase/migrations/README.md`).
- Sin CSP/HSTS gestionados por el backend (API JSON; el front en GH Pages
  queda fuera del alcance de estos headers).
- CORS con `allow_credentials=True` y allowlist de orígenes (localhost +
  FRONTEND_URL): aceptable, pero un origen mal configurado en env abriría
  credenciales a ese origen.
