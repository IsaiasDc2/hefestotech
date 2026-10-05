-- 002_ordenes_y_perfiles.sql
-- PENDIENTE DE APLICAR por el usuario (solo lectura con publishable key).
-- Ejecutar en Supabase Dashboard -> SQL Editor.
-- Crea lo que el frontend ya espera: `perfiles`, `ordenes`, `orden_items`.

-- 1) Perfiles (1:1 con auth.users)
create table if not exists public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  nombre text,
  created_at timestamptz not null default now()
);

-- 2) Órdenes
create table if not exists public.ordenes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  estado text not null default 'pendiente',
  total numeric not null default 0,
  created_at timestamptz not null default now()
);

-- 3) Ítems de cada orden
create table if not exists public.orden_items (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references public.ordenes (id) on delete cascade,
  producto_id uuid references public.productos (id) on delete set null,
  cantidad integer not null default 1 check (cantidad > 0),
  precio numeric not null default 0
);
create index if not exists idx_orden_items_orden on public.orden_items (orden_id);
create index if not exists idx_ordenes_user on public.ordenes (user_id);

-- 4) RLS: cada usuario solo ve y crea lo suyo
alter table public.perfiles enable row level security;
alter table public.ordenes enable row level security;
alter table public.orden_items enable row level security;

drop policy if exists "perfil propio" on public.perfiles;
create policy "perfil propio" on public.perfiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "ordenes propias" on public.ordenes;
create policy "ordenes propias" on public.ordenes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "items de ordenes propias" on public.orden_items;
create policy "items de ordenes propias" on public.orden_items
  for all using (
    exists (
      select 1 from public.ordenes o
      where o.id = orden_items.orden_id and o.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.ordenes o
      where o.id = orden_items.orden_id and o.user_id = auth.uid()
    )
  );

-- 5) Auto-crear perfil al registrarse
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, email, nombre)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'nombre', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_crear_perfil on auth.users;
create trigger trg_crear_perfil
  after insert on auth.users
  for each row execute function public.crear_perfil_nuevo_usuario();
