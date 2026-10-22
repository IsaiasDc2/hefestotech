-- HefestoTech · 016_reposicion_pagos.sql
-- Reposición automática de stock + comprobantes de pago subidos por el cliente.
--
--   1) `productos.stock_objetivo`: hasta qué cantidad se pide al proveedor.
--      El disparador es `stock_minimo` (punto de reposición); 0 lo desactiva.
--   2) `ordenes_compra.origen`: distingue las órdenes creadas por el motor de
--      reposición (`reposicion`) de las cargadas a mano (`manual`).
--   3) `comprobantes_pago`: archivo que sube el cliente desde el seguimiento
--      del pedido. Va a un bucket privado; el backend lo firma al mostrarlo.
--   4) Bucket privado `comprobantes-pago` (PDF/JPEG/PNG/WebP, hasta 8 MB).
--
-- Requiere 001, 002, 004, 005 y 014 aplicadas. Idempotente y re-ejecutable.
-- Pegar en Dashboard → SQL Editor → Run. NO ejecutar contra producción sin
-- aprobación del dueño.

-- ============ 1. PUNTO DE REPOSICIÓN ============
alter table productos
  add column if not exists stock_objetivo integer not null default 0;

alter table productos drop constraint if exists productos_stock_objetivo_check;
alter table productos add constraint productos_stock_objetivo_check
  check (stock_objetivo between 0 and 1000000) not valid;

-- ============ 2. ORIGEN DE LA ORDEN DE COMPRA ============
alter table ordenes_compra
  add column if not exists origen text not null default 'manual';

alter table ordenes_compra drop constraint if exists ordenes_compra_origen_check;
alter table ordenes_compra add constraint ordenes_compra_origen_check
  check (origen in ('manual', 'reposicion')) not valid;

create index if not exists idx_oc_origen on ordenes_compra (origen, created_at desc);

-- ============ 3. COMPROBANTES DE PAGO DEL CLIENTE ============
create table if not exists comprobantes_pago (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references ordenes (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  archivo_path text not null,
  archivo_nombre text not null default '',
  mime text not null default '',
  monto_centavos bigint not null default 0 check (monto_centavos >= 0),
  nota text not null default '',
  subido_por text not null default 'cliente'
    check (subido_por in ('cliente', 'staff')),
  created_at timestamptz not null default now()
);
create index if not exists idx_comprobantes_pago_orden
  on comprobantes_pago (orden_id, created_at desc);

alter table comprobantes_pago enable row level security;

-- Solo staff con permiso de pedidos puede leer el registro. El archivo se
-- entrega con una URL firmada del backend; no hay lectura directa del bucket.
drop policy if exists "comprobantes pago lectura staff" on comprobantes_pago;
create policy "comprobantes pago lectura staff" on comprobantes_pago
  for select to authenticated using (public.has_permission('pedidos', 'leer'));

-- ============ 4. BUCKET PRIVADO ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes-pago', 'comprobantes-pago', false, 8388608,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = 8388608,
      allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

-- Sin políticas de storage para clientes: sube y firma solo el backend con
-- service_role. Las URLs firmadas vencen a la hora.

-- ============ 5. AUDITORÍA ============
drop trigger if exists aud_comprobantes_pago on comprobantes_pago;
create trigger aud_comprobantes_pago after insert or update or delete on comprobantes_pago
  for each row execute function public.audit_registrar();

-- ============ VERIFICACIÓN ============
-- select column_name from information_schema.columns
--   where table_name = 'productos' and column_name = 'stock_objetivo';
-- select column_name from information_schema.columns
--   where table_name = 'ordenes_compra' and column_name = 'origen';
-- select id, public, file_size_limit from storage.buckets
--   where id = 'comprobantes-pago';

-- ============ REVERSIÓN (manual, comentada) ============
-- drop table if exists comprobantes_pago;
-- delete from storage.objects where bucket_id = 'comprobantes-pago';
-- delete from storage.buckets where id = 'comprobantes-pago';
-- drop index if exists idx_oc_origen;
-- alter table ordenes_compra drop column if exists origen;
-- alter table productos drop column if exists stock_objetivo;
