-- HefestoTech · 002_ordenes.sql
-- Pegar en Supabase Dashboard → SQL Editor → Run (después de 001).
-- Crea `ordenes` y `orden_items` usadas por orderService.crearOrden.

create table if not exists ordenes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null default '',
  email text not null default '',
  direccion text not null default '',
  ciudad text not null default '',
  codigo_postal text not null default '',
  envio text not null default 'estandar',
  pago_mock text not null default 'tarjeta',
  tarjeta_ultimos4 text,
  subtotal numeric(12,2) not null default 0,
  costo_envio numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  estado text not null default 'pendiente',
  created_at timestamptz default now()
);
create index if not exists idx_ordenes_user on ordenes (user_id);

create table if not exists orden_items (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references ordenes (id) on delete cascade,
  producto_id uuid references productos (id) on delete set null,
  cantidad integer not null default 1,
  precio numeric(12,2) not null default 0,
  created_at timestamptz default now()
);
create index if not exists idx_orden_items_orden on orden_items (orden_id);

alter table ordenes enable row level security;
alter table orden_items enable row level security;

drop policy if exists "ordenes propias" on ordenes;
create policy "ordenes propias" on ordenes
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "items de ordenes propias" on orden_items;
create policy "items de ordenes propias" on orden_items
  for all to authenticated using (
    exists (select 1 from ordenes o where o.id = orden_items.orden_id and o.user_id = auth.uid())
  ) with check (
    exists (select 1 from ordenes o where o.id = orden_items.orden_id and o.user_id = auth.uid())
  );
