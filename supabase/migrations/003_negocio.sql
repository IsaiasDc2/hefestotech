-- HefestoTech · 003_negocio.sql
-- Clientes (perfiles), proveedores, stock y favoritos.
-- Requiere 001 y 002 aplicados. Pegar en SQL Editor → Run.

-- ============ PERFILES (clientes) ============
create table if not exists perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null default '',
  telefono text default '',
  direccion text default '',
  ciudad text default '',
  codigo_postal text default '',
  created_at timestamptz default now()
);

alter table perfiles enable row level security;
drop policy if exists "perfil propio" on perfiles;
create policy "perfil propio" on perfiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Crea el perfil solo al registrarse (no rompe usuarios existentes)
create or replace function public.crear_perfil_nuevo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', new.email))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil_nuevo();

-- ============ PROVEEDORES ============
create table if not exists proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text unique not null,
  cuit text default '',
  email text default '',
  telefono text default '',
  direccion text default '',
  created_at timestamptz default now()
);

alter table proveedores enable row level security;
drop policy if exists "lectura publica" on proveedores;
create policy "lectura publica" on proveedores for select using (true);
drop policy if exists "escritura autenticados" on proveedores;
create policy "escritura autenticados" on proveedores
  for all to authenticated using (true) with check (true);

-- Qué proveedor abastece cada producto y a qué costo
create table if not exists producto_proveedor (
  producto_id uuid not null references productos (id) on delete cascade,
  proveedor_id uuid not null references proveedores (id) on delete cascade,
  costo numeric(12,2) not null default 0,
  tiempo_entrega_dias integer not null default 7,
  created_at timestamptz default now(),
  primary key (producto_id, proveedor_id)
);

alter table producto_proveedor enable row level security;
drop policy if exists "lectura publica" on producto_proveedor;
create policy "lectura publica" on producto_proveedor for select using (true);
drop policy if exists "escritura autenticados" on producto_proveedor;
create policy "escritura autenticados" on producto_proveedor
  for all to authenticated using (true) with check (true);

-- ============ MOVIMIENTOS DE STOCK ============
create table if not exists movimientos_stock (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid references productos (id) on delete set null,
  tipo text not null check (tipo in ('entrada', 'salida', 'ajuste')),
  cantidad integer not null check (cantidad > 0),
  motivo text default '',
  orden_id uuid references ordenes (id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists idx_movimientos_producto on movimientos_stock (producto_id);

alter table movimientos_stock enable row level security;
drop policy if exists "lectura autenticados" on movimientos_stock;
create policy "lectura autenticados" on movimientos_stock
  for select to authenticated using (true);
drop policy if exists "escritura autenticados" on movimientos_stock;
create policy "escritura autenticados" on movimientos_stock
  for insert to authenticated with check (true);

-- ============ FAVORITOS ============
create table if not exists favoritos (
  user_id uuid not null references auth.users (id) on delete cascade,
  producto_id uuid not null references productos (id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, producto_id)
);

alter table favoritos enable row level security;
drop policy if exists "favoritos propios" on favoritos;
create policy "favoritos propios" on favoritos
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============ SEED: 2 proveedores + vínculos reales ============
insert into proveedores (nombre, email, telefono) values
  ('TechImport Mayorista', 'ventas@techimport.ejemplo', '011-4000-0001'),
  ('GamerStock Distribuidora', 'contacto@gamerstock.ejemplo', '011-4000-0002')
on conflict (nombre) do nothing;

insert into producto_proveedor (producto_id, proveedor_id, costo, tiempo_entrega_dias)
select p.id, pr.id,
  round(p.precio * 0.75, 2),
  case when pr.nombre = 'TechImport Mayorista' then 5 else 10 end
from productos p
join proveedores pr on pr.nombre in ('TechImport Mayorista', 'GamerStock Distribuidora')
where p.nombre in ('RTX 4090 ASUS ROG STRIX 24GB', 'Ryzen 7 7800X3D', 'Samsung 990 PRO NVMe 2TB')
on conflict (producto_id, proveedor_id) do nothing;
