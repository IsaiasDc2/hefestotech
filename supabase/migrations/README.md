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
9. `011_consolidacion_checkout.sql`, `012_comprobantes_snapshot.sql`,
   `013_seguridad.sql` (requiere 007_test_admin), `014_proveedores_compras.sql`,
   `015_sucursales_pagos.sql`, `016_reposicion_pagos.sql`,
   `017_envio_seguimiento.sql`
10. `018_lint_seguridad_rls.sql` — cierra las advertencias de
    `supabase db advisors`: initplan de RLS, políticas permisivas duplicadas,
    políticas `always true` de proveedores/stock, índice duplicado de
    `favoritos`, `search_path` de funciones, extensiones movidas a
    `extensions` e índices de FK.

> **Después de 018 no volver a ejecutar `005_admin_infra.sql`**: ese archivo
> recrea `f_unaccent()` apuntando a `public.unaccent`, y `unaccent` ya vive
> en el esquema `extensions`. Si se re-ejecuta, correr de nuevo 018.

11. `019_normalizar_categorias.sql` — pasa `productos.categoria` al valor
    canónico del frontend (`Procesador`, `Memoria RAM`, `Cooler`, …) y
    sincroniza la tabla `categorias`.

> `019_normalizar_categorias.sql` ya se aplicó (verificación: los 137
> productos visibles quedaron con categorías canónicas y las 17 categorías de
> la tabla coinciden). No re-ejecutar; es idempotente de todos modos.


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
