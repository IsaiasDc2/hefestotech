-- HefestoTech · 013_seguridad.sql
-- Fase 2 de la auditoría (2026-10-16). Cierra:
--   1) Escalada de privilegios: un cliente podía editar perfiles.rol (C1).
--   2) Escritura directa del cliente sobre sus pedidos (A1).
--   3) Escritura abierta de product_specs a cualquier autenticado (A2).
--   4) Idempotencia de checkout: columna + índice único para no duplicar
--      órdenes ante doble submit.
-- Idempotente y re-ejecutable. Pegar en Dashboard → SQL Editor → Run.
-- Requiere 007_test_admin.sql aplicada (columnas is_test_user/expires_at).
-- Reversión: al final del archivo (comentada).
-- NO ejecutar contra producción sin aprobación del dueño.

-- ============ 1. PERFILES: el rol no se edita desde el cliente ============
-- Antes: policy "perfil propio" for all con solo id = auth.uid().
-- Un cliente podía: update perfiles set rol='owner' where id = auth.uid().

drop policy if exists "perfil propio" on perfiles;

-- Lectura propia.
drop policy if exists "perfil propio lectura" on perfiles;
create policy "perfil propio lectura" on perfiles
  for select to authenticated using (id = auth.uid());

-- Alta propia (el trigger crear_perfil_nuevo ya la cubre; se deja explícita
-- solo para id propio y rol cliente).
drop policy if exists "perfil propio alta" on perfiles;
create policy "perfil propio alta" on perfiles
  for insert to authenticated
  with check (id = auth.uid() and rol = 'cliente');

-- Edición propia (datos de contacto). El trigger de guardia y el revoke de
-- columnas de abajo impiden tocar rol/is_test_user/expires_at.
drop policy if exists "perfil propio edicion" on perfiles;
create policy "perfil propio edicion" on perfiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Sin DELETE desde el cliente.

-- Guardia 1: privilegios por columna (cinturón).
revoke update (rol, is_test_user, expires_at) on perfiles from anon, authenticated;

-- Guardia 2: trigger (tiradores). El backend (service_role) no se afecta:
-- ahí auth.uid() es NULL y sale por el primer if.
create or replace function public.perfiles_proteger_columnas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;  -- service_role / SQL editor
  end if;
  if new.rol is distinct from old.rol
     or new.is_test_user is distinct from old.is_test_user
     or new.expires_at is distinct from old.expires_at then
    if not public.has_permission('usuarios', 'gestionar') then
      raise exception 'No podés cambiar rol ni banderas de la cuenta.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_perfiles_columnas on perfiles;
create trigger trg_perfiles_columnas
  before update on perfiles
  for each row execute function public.perfiles_proteger_columnas();

-- ============ 2. ORDENES: el cliente solo lee las propias ============
-- Antes: policy for all con user_id = auth.uid(): el cliente podía
-- insertar/editar/borrar sus pedidos por PostgREST (marcarse "pagada", etc.).
-- El backend opera con service_role; los flujos de compra ya pasan por él.

drop policy if exists "ordenes propias" on ordenes;
create policy "ordenes propias" on ordenes
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "items de ordenes propias" on orden_items;
create policy "items de ordenes propias" on orden_items
  for select to authenticated using (
    exists (
      select 1 from ordenes o
      where o.id = orden_items.orden_id and o.user_id = auth.uid()
    )
  );

revoke insert, update, delete on ordenes from anon, authenticated;
revoke insert, update, delete on orden_items from anon, authenticated;

-- ============ 3. PRODUCT_SPECS: escritura solo staff ============
drop policy if exists "escritura autenticados" on product_specs;
drop policy if exists "specs escribe staff" on product_specs;
create policy "specs escribe staff" on product_specs
  for all to authenticated
  using (public.has_permission('productos', 'editar'))
  with check (public.has_permission('productos', 'editar'));

revoke insert, update, delete on product_specs from anon;

-- ============ 4. IDEMPOTENCIA DE CHECKOUT ============
alter table ordenes add column if not exists idem_key text;
create unique index if not exists idx_ordenes_idem_key
  on ordenes (idem_key) where idem_key is not null;

-- ============ VERIFICACIÓN (correr aparte, solo lectura) ============
-- select policyname, cmd, qual from pg_policies
--   where tablename in ('perfiles','ordenes','orden_items','product_specs')
--   order by tablename, policyname;
-- Deben verse solo las policies nuevas ("perfil propio lectura/alta/edicion",
-- "ordenes propias" cmd=SELECT, "items de ordenes propias" cmd=SELECT,
-- "specs escribe staff").
--
-- Test manual con una sesión de CLIENTE (REST con su JWT):
--   update perfiles set rol='owner' where id = auth.uid();  -- debe fallar
--   delete from ordenes where user_id = auth.uid();          -- debe fallar
--   update ordenes set estado='pagada' where user_id = auth.uid(); -- debe fallar

-- ============ REVERSIÓN (solo si hiciera falta volver atrás) ============
-- drop trigger if exists trg_perfiles_columnas on perfiles;
-- drop function if exists public.perfiles_proteger_columnas();
-- grant update (rol, is_test_user, expires_at) on perfiles to authenticated;
-- drop policy if exists "perfil propio lectura" on perfiles;
-- drop policy if exists "perfil propio alta" on perfiles;
-- drop policy if exists "perfil propio edicion" on perfiles;
-- create policy "perfil propio" on perfiles
--   for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- drop policy if exists "ordenes propias" on ordenes;
-- create policy "ordenes propias" on ordenes
--   for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- drop policy if exists "items de ordenes propias" on orden_items;
-- create policy "items de ordenes propias" on orden_items
--   for all to authenticated
--   using (exists (select 1 from ordenes o where o.id = orden_items.orden_id and o.user_id = auth.uid()))
--   with check (exists (select 1 from ordenes o where o.id = orden_items.orden_id and o.user_id = auth.uid()));
-- grant insert, update, delete on ordenes to authenticated;
-- grant insert, update, delete on orden_items to authenticated;
-- drop policy if exists "specs escribe staff" on product_specs;
-- create policy "escritura autenticados" on product_specs
--   for all to authenticated using (true) with check (true);
-- drop index if exists idx_ordenes_idem_key;
-- alter table ordenes drop column if exists idem_key;
