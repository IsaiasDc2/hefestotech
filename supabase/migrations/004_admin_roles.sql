-- HefestoTech · 004_admin_roles.sql
-- Roles admin/cliente + cierre de escrituras abiertas. Lectura pública intacta.
-- Requiere 001, 002 y 003 aplicados. Pegar en SQL Editor → Run.
-- NO ejecutar contra producción sin aprobación del dueño.
-- El primer admin se otorga por SQL del dueño (ver AUDITORIA.md "Qué falta").

-- ============ 1. ROL EN PERFILES ============
alter table perfiles
  add column if not exists rol text not null default 'cliente'
  check (rol in ('admin', 'cliente'));

-- ============ 2. FUNCIONES BASE (SECURITY DEFINER, search_path fijo) ============
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = auth.uid() and p.rol = 'admin'
  );
$$;

-- Base extensible: hoy delega en is_admin(); mañana mapea matriz de permisos.
create or replace function public.has_permission(perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin();
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_permission(text) to authenticated;

-- ============ 3. CIERRE DE ESCRITURAS (solo admin escribe) ============
-- Lectura pública intacta: no se tocan las policies de SELECT público.

-- ---- productos ----
drop policy if exists "escritura autenticados" on productos;
drop policy if exists "escritura admin" on productos;
create policy "escritura admin" on productos
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- categorias ----
drop policy if exists "escritura autenticados" on categorias;
drop policy if exists "escritura admin" on categorias;
create policy "escritura admin" on categorias
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- proveedores ----
drop policy if exists "escritura autenticados" on proveedores;
drop policy if exists "escritura admin" on proveedores;
create policy "escritura admin" on proveedores
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- producto_proveedor ----
drop policy if exists "escritura autenticados" on producto_proveedor;
drop policy if exists "escritura admin" on producto_proveedor;
create policy "escritura admin" on producto_proveedor
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- storage.objects (bucket productos; lectura pública intacta) ----
drop policy if exists "escritura autenticados" on storage.objects;
drop policy if exists "actualizar autenticados" on storage.objects;
drop policy if exists "borrar autenticados" on storage.objects;
drop policy if exists "escritura admin" on storage.objects;
drop policy if exists "actualizar admin" on storage.objects;
drop policy if exists "borrar admin" on storage.objects;
create policy "escritura admin" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'productos' and public.is_admin());
create policy "actualizar admin" on storage.objects
  for update to authenticated
  using (bucket_id = 'productos' and public.is_admin());
create policy "borrar admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'productos' and public.is_admin());

-- ---- movimientos_stock (lectura autenticada intacta; escribe solo admin) ----
drop policy if exists "escritura autenticados" on movimientos_stock;
drop policy if exists "escritura admin" on movimientos_stock;
drop policy if exists "actualizar admin" on movimientos_stock;
drop policy if exists "borrar admin" on movimientos_stock;
create policy "escritura admin" on movimientos_stock
  for insert to authenticated
  with check (public.is_admin());
create policy "actualizar admin" on movimientos_stock
  for update to authenticated
  using (public.is_admin());
create policy "borrar admin" on movimientos_stock
  for delete to authenticated
  using (public.is_admin());

-- ============ 4. FAVORITOS: índice único (user_id, producto_id) si falta ============
-- (La PK compuesta ya lo garantiza; índice explícito por contrato de auditoría.)
create unique index if not exists uq_favoritos_user_producto
  on favoritos (user_id, producto_id);

-- ============ 5. ÍNDICES DE CONSULTA ============
create index if not exists idx_ordenes_user on ordenes (user_id);
create index if not exists idx_orden_items_orden on orden_items (orden_id);
create index if not exists idx_movimientos_producto on movimientos_stock (producto_id);
create index if not exists idx_movimientos_created on movimientos_stock (created_at desc);
create index if not exists idx_movimientos_producto_created
  on movimientos_stock (producto_id, created_at desc);

-- ============ 6. BÚSQUEDA TRIGRAM EN productos(nombre) ============
create extension if not exists pg_trgm;
create index if not exists idx_productos_nombre_trgm
  on productos using gin (nombre gin_trgm_ops);

-- ============ VERIFICACIÓN ============
-- select column_name, data_type, column_default from information_schema.columns
--   where table_schema = 'public' and table_name = 'perfiles' and column_name = 'rol';
-- select policyname, cmd, roles from pg_policies
--   where schemaname = 'public'
--   and tablename in ('productos','categorias','proveedores','producto_proveedor','movimientos_stock')
--   order by tablename, policyname;
-- select indexname from pg_indexes
--   where schemaname = 'public'
--   and indexname in ('uq_favoritos_user_producto','idx_ordenes_user','idx_orden_items_orden',
--     'idx_movimientos_producto','idx_movimientos_created','idx_movimientos_producto_created',
--     'idx_productos_nombre_trgm')
--   order by 1;
