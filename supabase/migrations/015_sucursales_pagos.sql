-- HefestoTech · 015_sucursales_pagos.sql
-- Sucursales (para alternar el tablero) + detalle real del pago de Mercado Pago.
-- Idempotente. Requiere 005 (has_permission) aplicado.

-- ============ 1. SUCURSALES ============
create table if not exists sucursales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  direccion text not null default '',
  telefono text not null default '',
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table sucursales enable row level security;

drop policy if exists "sucursales lectura staff" on sucursales;
create policy "sucursales lectura staff" on sucursales
  for select to authenticated
  using (public.has_permission('reportes', 'leer'));

-- ============ 2. ÓRDENES: sucursal + medio de pago real ============
alter table ordenes
  add column if not exists sucursal_id uuid references sucursales (id) on delete set null,
  add column if not exists mp_payment_type text not null default '',
  add column if not exists mp_payment_method text not null default '';

create index if not exists idx_ordenes_sucursal on ordenes (sucursal_id);

-- ============ 3. MOVIMIENTOS DE STOCK: sucursal (opcional) ============
alter table movimientos_stock
  add column if not exists sucursal_id uuid references sucursales (id) on delete set null;

create index if not exists idx_movimientos_sucursal on movimientos_stock (sucursal_id);

-- ============ 4. PERMISOS (espejo de backend/admin_api.py) ============
insert into admin_permisos (rol, modulo, accion) values
  ('owner','sucursales','leer'), ('owner','sucursales','gestionar'),
  ('admin','sucursales','leer'), ('admin','sucursales','gestionar'),
  ('operador','sucursales','leer'),
  ('solo_lectura','sucursales','leer')
on conflict do nothing;

-- Sin sucursales sembradas: las carga el dueño desde el panel (datos reales).
