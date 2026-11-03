-- HefestoTech · 018_lint_seguridad_rls.sql
-- Cierra las advertencias del linter de Supabase (`supabase db advisors`)
-- detectadas el 2026-11-03 sobre la base real:
--
--   1. auth_rls_initplan: auth.uid() se re-evaluaba por fila.
--      → se reemplaza por (select auth.uid()).
--   2. multiple_permissive_policies: políticas ALL duplicadas con SELECT.
--      → se separa cada política ALL en INSERT / UPDATE / DELETE.
--   3. rls_policy_always_true: cualquier usuario autenticado (incluido un
--      cliente) podía escribir proveedores, producto_proveedor y
--      movimientos_stock. → ahora exige permisos de staff.
--   4. duplicate_index: favoritos tenía dos índices únicos idénticos.
--   5. function_search_path_mutable: 4 funciones sin search_path fijo.
--   6. extension_in_public: pg_trgm y unaccent se mueven a `extensions`.
--   7. unindexed_foreign_keys: índices de cobertura para las FK marcadas.
--
-- Idempotente y re-ejecutable: no borra datos ni cambia columnas.
-- IMPORTANTE: después de esta migración no re-ejecutar
-- 005_admin_infra.sql, porque volvería a crear f_unaccent() apuntando a
-- public.unaccent (que ya vive en `extensions`).
-- Reversión: ver el bloque comentado al final del archivo.

-- ============ 1. EXTENSIONES FUERA DE `public` ============
-- Las extensiones en el esquema public son visibles por PostgREST y el
-- linter las marca. `extensions` ya está en el search_path de la base
-- ("$user", public, extensions), así que los operadores % y <-> siguen
-- resolviéndose sin cambios en los clientes.

create schema if not exists extensions;

-- Primero se mueven las extensiones: mover objetos de esquema no invalida
-- las funciones que ya los referencian por OID (f_unaccent y el RPC).
do $$
begin
  if exists (
    select 1 from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'unaccent' and n.nspname <> 'extensions'
  ) then
    execute 'alter extension unaccent set schema extensions';
  end if;

  if exists (
    select 1 from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pg_trgm' and n.nspname <> 'extensions'
  ) then
    execute 'alter extension pg_trgm set schema extensions';
  end if;
end $$;

-- f_unaccent es IMMUTABLE y alimenta la columna generada `busqueda`:
-- queda calificada contra `extensions` y con search_path fijo.
create or replace function public.f_unaccent(text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select extensions.unaccent($1);
$$;

-- El RPC usa los operadores de pg_trgm y similarity(): search_path con
-- `extensions` para que siga funcionando y para que un futuro
-- create or replace no falle al resolver los nombres.
create or replace function public.buscar_productos(q text, limite int default 20)
returns setof public.productos
language sql
stable
security definer
set search_path = public, extensions
as $$
  select *
  from public.productos p
  where p.deleted_at is null
    and (
      p.busqueda @@ plainto_tsquery('spanish', public.f_unaccent(coalesce(q, '')))
      or p.nombre % coalesce(q, '')
      or p.nombre ilike '%' || coalesce(q, '') || '%'
    )
  order by similarity(p.nombre, coalesce(q, '')) desc
  limit greatest(1, least(coalesce(limite, 20), 50));
$$;

-- ============ 2. FUNCIONES CON search_path MUTABLE ============

create or replace function public.audit_no_mod()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log es append-only: % no permitido', TG_OP;
  return null;
end $$;

create or replace function public.pedido_transicion_ok(de text, a text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when de = a then false
    when de = 'pendiente'    and a in ('pagada','cancelada') then true
    when de = 'pagada'       and a in ('preparacion','cancelada','reembolsada') then true
    when de = 'preparacion'  and a in ('enviada','cancelada') then true
    when de = 'enviada'      and a in ('entregada') then true
    when de = 'entregada'    and a in ('reembolsada') then true
    else false
  end;
$$;

create or replace function public.tocar_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ============ 3. PERFILES: initplan ============

drop policy if exists "perfil propio lectura" on public.perfiles;
create policy "perfil propio lectura" on public.perfiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "perfil propio alta" on public.perfiles;
create policy "perfil propio alta" on public.perfiles
  for insert to authenticated
  with check (id = (select auth.uid()) and rol = 'cliente');

drop policy if exists "perfil propio edicion" on public.perfiles;
create policy "perfil propio edicion" on public.perfiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ============ 4. PRODUCTOS: duplicado + initplan ============
-- `productos admin` (tabla legacy `admins`) era inefectivo: `admins` tiene
-- RLS sin políticas, así que el EXISTS nunca veía filas. Se elimina.
-- `escritura admin` (ALL) se separa por acción y usa la matriz de permisos.

drop policy if exists "productos admin" on public.productos;
drop policy if exists "escritura admin" on public.productos;
drop policy if exists "productos alta staff" on public.productos;
drop policy if exists "productos edicion staff" on public.productos;
drop policy if exists "productos borrado staff" on public.productos;

create policy "productos alta staff" on public.productos
  for insert to authenticated
  with check (has_permission('productos', 'crear'));

create policy "productos edicion staff" on public.productos
  for update to authenticated
  using (has_permission('productos', 'editar'))
  with check (has_permission('productos', 'editar'));

create policy "productos borrado staff" on public.productos
  for delete to authenticated
  using (has_permission('productos', 'borrar'));

-- ============ 5. CATEGORÍAS: duplicado + initplan ============

drop policy if exists "categorias admin" on public.categorias;
drop policy if exists "escritura admin" on public.categorias;
drop policy if exists "categorias alta admin" on public.categorias;
drop policy if exists "categorias edicion admin" on public.categorias;
drop policy if exists "categorias borrado admin" on public.categorias;

create policy "categorias alta admin" on public.categorias
  for insert to authenticated
  with check (is_admin());

create policy "categorias edicion admin" on public.categorias
  for update to authenticated
  using (is_admin())
  with check (is_admin());

create policy "categorias borrado admin" on public.categorias
  for delete to authenticated
  using (is_admin());

-- ============ 6. BANNERS: ALL + SELECT público ============
-- Antes la política ALL de staff también servía para leer banners
-- inactivos. Ahora la lectura es una sola política que cubre ambos casos.

drop policy if exists "banners escribe staff" on public.banners;
drop policy if exists "banners lectura publica" on public.banners;
drop policy if exists "banners lectura" on public.banners;
drop policy if exists "banners alta staff" on public.banners;
drop policy if exists "banners edicion staff" on public.banners;
drop policy if exists "banners borrado staff" on public.banners;

create policy "banners lectura" on public.banners
  for select to public
  using (
    (activo and deleted_at is null)
    or has_permission('banners', 'leer')
  );

create policy "banners alta staff" on public.banners
  for insert to authenticated
  with check (has_permission('banners', 'crear'));

create policy "banners edicion staff" on public.banners
  for update to authenticated
  using (has_permission('banners', 'editar'))
  with check (has_permission('banners', 'editar'));

create policy "banners borrado staff" on public.banners
  for delete to authenticated
  using (has_permission('banners', 'borrar'));

-- ============ 7. CUPONES: ALL + SELECT ============
-- La política ALL usaba 'crear' también para editar y borrar.

drop policy if exists "cupones escribe staff" on public.cupones;
drop policy if exists "cupones alta staff" on public.cupones;
drop policy if exists "cupones edicion staff" on public.cupones;
drop policy if exists "cupones borrado staff" on public.cupones;

create policy "cupones alta staff" on public.cupones
  for insert to authenticated
  with check (has_permission('cupones', 'crear'));

create policy "cupones edicion staff" on public.cupones
  for update to authenticated
  using (has_permission('cupones', 'editar'))
  with check (has_permission('cupones', 'editar'));

create policy "cupones borrado staff" on public.cupones
  for delete to authenticated
  using (has_permission('cupones', 'borrar'));

-- ============ 8. ENVÍOS: ALL + SELECT ============

drop policy if exists "envios escribe staff" on public.envios;
drop policy if exists "envios alta staff" on public.envios;
drop policy if exists "envios edicion staff" on public.envios;
drop policy if exists "envios borrado staff" on public.envios;

create policy "envios alta staff" on public.envios
  for insert to authenticated
  with check (has_permission('pedidos', 'cambiar_estado'));

create policy "envios edicion staff" on public.envios
  for update to authenticated
  using (has_permission('pedidos', 'cambiar_estado'))
  with check (has_permission('pedidos', 'cambiar_estado'));

create policy "envios borrado staff" on public.envios
  for delete to authenticated
  using (has_permission('pedidos', 'cambiar_estado'));

-- ============ 9. WHATSAPP_CFG: ALL + SELECT ============

drop policy if exists "whatsapp escribe owner" on public.whatsapp_cfg;
drop policy if exists "whatsapp alta owner" on public.whatsapp_cfg;
drop policy if exists "whatsapp edicion owner" on public.whatsapp_cfg;
drop policy if exists "whatsapp borrado owner" on public.whatsapp_cfg;

create policy "whatsapp alta owner" on public.whatsapp_cfg
  for insert to authenticated
  with check (has_permission('config', 'gestionar'));

create policy "whatsapp edicion owner" on public.whatsapp_cfg
  for update to authenticated
  using (has_permission('config', 'gestionar'))
  with check (has_permission('config', 'gestionar'));

create policy "whatsapp borrado owner" on public.whatsapp_cfg
  for delete to authenticated
  using (has_permission('config', 'gestionar'));

-- ============ 10. PRODUCT_SPECS: ALL + SELECT público ============

drop policy if exists "specs escribe staff" on public.product_specs;
drop policy if exists "specs alta staff" on public.product_specs;
drop policy if exists "specs edicion staff" on public.product_specs;
drop policy if exists "specs borrado staff" on public.product_specs;

create policy "specs alta staff" on public.product_specs
  for insert to authenticated
  with check (has_permission('productos', 'editar'));

create policy "specs edicion staff" on public.product_specs
  for update to authenticated
  using (has_permission('productos', 'editar'))
  with check (has_permission('productos', 'editar'));

create policy "specs borrado staff" on public.product_specs
  for delete to authenticated
  using (has_permission('productos', 'editar'));

-- ============ 11. PRODUCTO_LOTES: ALL + SELECT ============

drop policy if exists "lotes escribe staff" on public.producto_lotes;
drop policy if exists "lotes alta staff" on public.producto_lotes;
drop policy if exists "lotes edicion staff" on public.producto_lotes;
drop policy if exists "lotes borrado staff" on public.producto_lotes;

create policy "lotes alta staff" on public.producto_lotes
  for insert to authenticated
  with check (has_permission('productos', 'editar'));

create policy "lotes edicion staff" on public.producto_lotes
  for update to authenticated
  using (has_permission('productos', 'editar'))
  with check (has_permission('productos', 'editar'));

create policy "lotes borrado staff" on public.producto_lotes
  for delete to authenticated
  using (has_permission('productos', 'editar'));

-- ============ 12. PROVEEDORES: política always-true (crítico) ============
-- `escritura autenticados` permitía a CUALQUIER usuario logueado (un
-- cliente) insertar, editar y borrar proveedores. Se elimina.

drop policy if exists "escritura autenticados" on public.proveedores;
drop policy if exists "escritura admin" on public.proveedores;
drop policy if exists "proveedores alta staff" on public.proveedores;
drop policy if exists "proveedores edicion staff" on public.proveedores;
drop policy if exists "proveedores borrado staff" on public.proveedores;

create policy "proveedores alta staff" on public.proveedores
  for insert to authenticated
  with check (has_permission('proveedores', 'crear'));

create policy "proveedores edicion staff" on public.proveedores
  for update to authenticated
  using (has_permission('proveedores', 'editar'))
  with check (has_permission('proveedores', 'editar'));

create policy "proveedores borrado staff" on public.proveedores
  for delete to authenticated
  using (has_permission('proveedores', 'borrar'));

-- ============ 13. PRODUCTO_PROVEEDOR: política always-true (crítico) ============

drop policy if exists "escritura autenticados" on public.producto_proveedor;
drop policy if exists "escritura admin" on public.producto_proveedor;
drop policy if exists "producto_proveedor alta staff" on public.producto_proveedor;
drop policy if exists "producto_proveedor edicion staff" on public.producto_proveedor;
drop policy if exists "producto_proveedor borrado staff" on public.producto_proveedor;

create policy "producto_proveedor alta staff" on public.producto_proveedor
  for insert to authenticated
  with check (has_permission('proveedores', 'crear'));

create policy "producto_proveedor edicion staff" on public.producto_proveedor
  for update to authenticated
  using (has_permission('proveedores', 'editar'))
  with check (has_permission('proveedores', 'editar'));

create policy "producto_proveedor borrado staff" on public.producto_proveedor
  for delete to authenticated
  using (has_permission('proveedores', 'borrar'));

-- ============ 14. MOVIMIENTOS_STOCK: INSERT always-true (crítico) ============
-- La escritura directa desde el cliente queda para staff con permiso de
-- ajuste. Las altas reales las hacen adjust_stock() y recibir_orden_compra()
-- (SECURITY DEFINER) y el backend con service_role.
-- También se elimina `lectura autenticados` (true): cualquier cliente podía
-- leer todo el historial de stock; queda la política de staff.

drop policy if exists "escritura autenticados" on public.movimientos_stock;
drop policy if exists "lectura autenticados" on public.movimientos_stock;
drop policy if exists "escritura admin" on public.movimientos_stock;
drop policy if exists "movimientos alta staff" on public.movimientos_stock;

create policy "movimientos alta staff" on public.movimientos_stock
  for insert to authenticated
  with check (has_permission('stock', 'ajustar'));

-- ============ 15. FAVORITOS: initplan + índice duplicado ============

drop policy if exists "favoritos propios" on public.favoritos;
create policy "favoritos propios" on public.favoritos
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- favoritos_pkey ya cubre (user_id, producto_id).
drop index if exists public.uq_favoritos_user_producto;

-- ============ 16. NOTIFICACIONES / ÓRDENES / RECLAMOS: initplan ============

drop policy if exists "notificaciones propias" on public.notificaciones;
create policy "notificaciones propias" on public.notificaciones
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or has_permission('notificaciones', 'leer')
  );

-- Órdenes: una sola política de lectura (propias + staff) en vez de dos.
drop policy if exists "ordenes propias" on public.ordenes;
drop policy if exists "ordenes lectura staff" on public.ordenes;
drop policy if exists "ordenes lectura" on public.ordenes;
create policy "ordenes lectura" on public.ordenes
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or has_permission('pedidos', 'leer')
  );

drop policy if exists "items de ordenes propias" on public.orden_items;
drop policy if exists "items lectura staff" on public.orden_items;
drop policy if exists "items lectura" on public.orden_items;
create policy "items lectura" on public.orden_items
  for select to authenticated
  using (
    has_permission('pedidos', 'leer')
    or exists (
      select 1 from public.ordenes o
      where o.id = orden_items.orden_id
        and o.user_id = (select auth.uid())
    )
  );

drop policy if exists "reclamos propio o staff" on public.reclamos;
create policy "reclamos propio o staff" on public.reclamos
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or has_permission('reclamos', 'leer')
  );

drop policy if exists "reclamos crea usuario" on public.reclamos;
create policy "reclamos crea usuario" on public.reclamos
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "mensajes lectura staff o duenio" on public.reclamo_mensajes;
create policy "mensajes lectura staff o duenio" on public.reclamo_mensajes
  for select to authenticated
  using (
    has_permission('reclamos', 'leer')
    or exists (
      select 1 from public.reclamos r
      where r.id = reclamo_mensajes.reclamo_id
        and r.user_id = (select auth.uid())
    )
  );

drop policy if exists "mensajes alta staff o duenio" on public.reclamo_mensajes;
create policy "mensajes alta staff o duenio" on public.reclamo_mensajes
  for insert to authenticated
  with check (
    has_permission('reclamos', 'crear')
    or exists (
      select 1 from public.reclamos r
      where r.id = reclamo_mensajes.reclamo_id
        and r.user_id = (select auth.uid())
    )
  );

-- ============ 17. ÍNDICES DE COBERTURA PARA FK ============

create index if not exists idx_audit_log_actor        on public.audit_log (actor_id);
create index if not exists idx_banners_deleted_by     on public.banners (deleted_by);
create index if not exists idx_comprobantes_pago_user on public.comprobantes_pago (user_id);
create index if not exists idx_favoritos_producto     on public.favoritos (producto_id);
create index if not exists idx_movimientos_actor      on public.movimientos_stock (actor_id);
create index if not exists idx_movimientos_orden      on public.movimientos_stock (orden_id);
create index if not exists idx_orden_items_producto   on public.orden_items (producto_id);
create index if not exists idx_ordenes_compra_creado  on public.ordenes_compra (creado_por);
create index if not exists idx_pedido_history_actor   on public.pedido_history (actor_id);
create index if not exists idx_pp_costos_proveedor    on public.producto_proveedor_costos (proveedor_id);
create index if not exists idx_productos_deleted_by   on public.productos (deleted_by);
create index if not exists idx_proveedores_deleted_by on public.proveedores (deleted_by);
create index if not exists idx_recepciones_actor      on public.recepciones_compra (actor_id);
create index if not exists idx_reclamos_user          on public.reclamos (user_id);

-- ============ 18. VERIFICACIÓN RÁPIDA ============
-- Debe devolver cero filas: políticas ALL con SELECT implícito.
-- (Las políticas ALL deben ser solo de favoritos, que es la única tabla
--  donde el dueño de la fila necesita las cuatro acciones.)
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and cmd = 'ALL'
  and tablename <> 'favoritos'
order by 1, 2;

-- Reversión (manual, solo si hace falta volver atrás):
--   begin;
--   alter extension unaccent set schema public;
--   alter extension pg_trgm set schema public;
--   create or replace function public.f_unaccent(text)
--     returns text language sql immutable parallel safe
--     as $$ select public.unaccent($1); $$;
--   rollback; -- o commit si se confirma
