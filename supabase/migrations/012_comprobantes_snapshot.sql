-- HefestoTech · 012_comprobantes_snapshot.sql
-- Enriquiza `comprobantes` (forma 006) para que coincida con el código vigente:
--   - emitida_at → emitido_en (nombre que usan backend/comprobantes.py y el front)
--   - numero, items_snapshot, totales_snapshot, token_verificacion
-- Backfill para filas existentes (la tabla suele estar vacía; si no, se
-- reconstruye el snapshot desde orden_items/productos/ordenes).
-- Pegar en Dashboard → SQL Editor → Run. Idempotente y re-ejecutable.

-- ============ 1. emitida_at → emitido_en ============
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'comprobantes'
      and column_name = 'emitida_at'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'comprobantes'
      and column_name = 'emitido_en'
  ) then
    alter table comprobantes rename column emitida_at to emitido_en;
  end if;
end $$;

-- ============ 2. Columnas del comprobante ============
alter table comprobantes
  add column if not exists emitido_en timestamptz not null default now(),
  add column if not exists numero text not null default '',
  add column if not exists items_snapshot jsonb not null default '[]',
  add column if not exists totales_snapshot jsonb not null default '{}',
  add column if not exists token_verificacion text not null default '';

-- ============ 3. Backfill (solo filas viejas) ============
update comprobantes c
  set numero = 'HT-' || upper(substr(replace(c.orden_id::text, '-', ''), 1, 8))
  where c.numero = '';

update comprobantes c
  set items_snapshot = coalesce((
    select jsonb_agg(jsonb_build_object(
      'nombre', coalesce(p.nombre, 'Producto'),
      'cantidad', oi.cantidad,
      'precio_unitario', oi.precio
    ))
    from orden_items oi
    left join productos p on p.id = oi.producto_id
    where oi.orden_id = c.orden_id
  ), '[]'::jsonb)
  where c.items_snapshot = '[]'::jsonb;

update comprobantes c
  set totales_snapshot = jsonb_build_object(
    'subtotal', round(coalesce(o.subtotal_centavos, 0) / 100.0, 2),
    'descuento', round(coalesce(o.descuento_centavos, 0) / 100.0, 2),
    'costo_envio', round(coalesce(o.costo_envio_centavos, 0) / 100.0, 2),
    'total', round(coalesce(o.total_centavos, 0) / 100.0, 2)
  )
  from ordenes o
  where o.id = c.orden_id and c.totales_snapshot = '{}'::jsonb;

update comprobantes c
  set token_verificacion = coalesce(o.acceso_token, '')
  from ordenes o
  where o.id = c.orden_id and c.token_verificacion = '';

-- ============ VERIFICACIÓN (solo lectura, correr aparte) ============
-- select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'comprobantes'
--   order by ordinal_position;
-- select id, orden_id, numero, emitido_en, jsonb_array_length(items_snapshot) as items
--   from comprobantes order by emitido_en desc limit 5;
