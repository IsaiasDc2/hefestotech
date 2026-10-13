# Migraciones — orden de aplicación

Estas migraciones se ejecutan a mano en **Supabase Dashboard → SQL Editor**
(no son archivos timestamp de `supabase db push`). Aplicar en este orden:

1. `001_productos.sql`
2. `002_ordenes.sql`
3. `003_negocio.sql`
4. `004_admin_roles.sql`
5. `005_admin_infra.sql`  (requiere 004_admin_roles; define `adjust_stock`,
   `aplicar_cupon`, `cambiar_estado_pedido`, `notificar` — las RPC del backend)
6. `006_checkout_servidor.sql`  (esquema canónico de `eventos_webhook`,
   `comprobantes` y columnas `acceso_token`/`expira_at`/`mp_*` de `ordenes`)
7. `005_product_specs.sql` → `006_specs_iniciales.sql` (independientes, en ese orden)
8. `007_nuevos_productos.sql`, `008_mensajes_reclamos.sql`,
   `009_suscriptores.sql`, `010_indices_api.sql` (en ese orden)

## Archivos superados — NO aplicar en bases nuevas

- **`004_checkout_real.sql`**: iteración anterior del checkout, reemplazada por
  `006_checkout_servidor.sql`. Define `eventos_webhook`/`comprobantes` con un
  esquema distinto (`mp_payment_id`/`status`/`numero`/`token_verificacion`)
  que el backend actual NO usa. Como ambos archivos usan
  `CREATE TABLE IF NOT EXISTS`, aplicar 004_checkout_real ANTES que 006 deja el
  esquema viejo y rompe webhook idempotente y comprobantes. Se conserva solo
  por referencia histórica.
- **`007_test_admin.sql`**: datos de prueba; opcional, solo en entornos de
  desarrollo.

## Colisiones de numeración

Los pares `004_*`, `005_*`, `006_*`, `007_*` comparten prefijo numérico por
tema distinto. El orden interno es el indicado arriba; las parejas son
complementarias entre sí (no tocan las mismas tablas) salvo el caso
004_checkout_real/006_checkout_servidor documentado.

Convención de campos: el flujo vigente usa `acceso_token` y `expira_at` en
`ordenes` (creados por 006_checkout_servidor). `token_verificacion`/`expira_en`
(004_checkout_real) son legacy y no deben usarse.
