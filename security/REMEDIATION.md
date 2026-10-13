# Remediación — parches aplicados en `fix/security-audit`

Todos los cambios son mínimos, revisables y con test de regresión donde el
comportamiento es verificable sin Supabase real.

## backend/checkout_api.py

1. **`estado_checkout()`** — agregado `acceso_token` al `select` de
   `ordenes` (F1). Sin él la comparación `compare_digest` siempre fallaba.
2. **`_es_url_mp()`** — `u.scheme == "https"` (antes `"https:"`, siempre
   False → todo pago fallaba) (F3).
3. **`reintentar_checkout()`** — para órdenes `cancelada`:
   - valida `MERCADOPAGO_ACCESS_TOKEN` **antes** de reservar;
   - re-lee `orden_items`, re-verifica `stock`/`activo`/`deleted_at` en
     `productos` (409 si no alcanza);
   - llama `_reservar()` (misma RPC `adjust_stock` del flujo de crear);
   - si la preferencia MP falla después, `_liberar()` revierte la
     re-reserva (la orden permanece `cancelada`) — evita stock huérfano.
   Órdenes `pendiente` siguen sin re-reservar (su reserva está vigente).
4. **`liberar_expiradas()`** — si `CRON_SECRET` está en env, exige header
   `X-Cron-Secret` con `compare_digest` (F8).

## backend/comprobantes.py (F4/F5)

- `_sb` propio con `httpx` (elimina import de `pagos_mp`).
- `obtener_comprobante`: select alineado al esquema vigente
  (`acceso_token`, `orden_items(cantidad,precio,productos(nombre))`
  anidado; se quitaron `documento`/`provincia` que provienen de la
  migración superada y pueden no existir).
- `comprobante_pdf`: número = `numero || mp_payment_id || id[:8]`;
  fecha = `emitida_at || emitido_en || created_at`; ítems desde
  `orden_items` anidados (fallback `items_snapshot`); total con fallback
  `total_centavos/100`; link de verificación usa `acceso_token` real.

## backend/main.py (F7/F8)

- Middleware: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer`.
- Eliminado `GET /api/productos` (CSV inexistente) y sus imports
  (`pandas`, `Path`, `urllib.parse`), más `_sdk_mp()`/`import mercadopago`
  huérfanos.

## backend/pagos_mp.py — ELIMINADO (F5)

269 líneas de la implementación anterior de MP (`urllib` dinámico,
campos `token_verificacion`/`expira_en`). Sin importadores tras el cambio
de `comprobantes`.

## backend/requirements.txt (F8)

Versiones pineadas a lo instalado/verificado; `pandas` removido.

## supabase/migrations/README.md — NUEVO (F6)

Orden canónico de aplicación + marca `004_checkout_real.sql` como
**superado** (su esquema de `eventos_webhook`/`comprobantes` es
incompatible con el backend actual) y `007_test_admin.sql` como solo-dev.

## ecomers/client/supabase/ — ELIMINADO (F6)

`002_ordenes_y_perfiles.sql` divergía de las migraciones canónicas; con
`CREATE TABLE IF NOT EXISTS` ganaba la primera aplicada → drift silencioso.

## backend/tests/test_seguridad.py — NUEVO

10 tests con `TestClient` + monkeypatch de `_sb_get`/`_sb_patch`/
`_reservar`/`mercadopago.SDK` (sin red ni credenciales):
- invitado + token → 200 y el select pide `acceso_token` (regresión F1);
- sin token / token incorrecto → 403; orden ajena → 404 (IDOR);
- cancelada → `_reservar` llamado y 200; sin stock → 409; pendiente → sin
  doble reserva; pagada → 409;
- `_es_url_mp`: acepta MP real; rechaza http, `*.evil.com`, `javascript:`.

## Riesgo residual de los parches

- La re-reserva del reintento confía en la atomicidad de `adjust_stock`
  (RPC con `FOR UPDATE` implícita en la migración). Dos reintentos
  concurrentes podrían pasar la verificación de stock; el RPC falla en el
  segundo si no alcanza — el propio `_reservar` hace rollback parcial.
- `CRON_SECRET` es opt-in: sin env el endpoint sigue abierto (rate-limited,
  acotado a 100 órdenes ya expiradas por llamada).
- Los headers no incluyen HSTS/CSP: el backend sirve solo JSON; si se
  expone contenido HTML propio, evaluar CSP.
