-- 023 · Endurecer RLS: reclamos, notificaciones y catálogo
--
-- 1) reclamos: el alta legítima pasa por POST /api/admin/reclamos, que
--    valida que la orden sea del usuario y escribe con service_role. La
--    policy de INSERT directo permitía fijar estado/created_at y adjuntar
--    una orden ajena. Se elimina el INSERT directo.
--
-- 2) reclamo_mensajes: las respuestas salen del backend (service_role). El
--    INSERT directo permitía firmar un mensaje como staff/sistema. Se
--    elimina. La lectura del dueño se limita a mensajes no internos
--    (autor <> 'staff'); las notas internas quedan solo para staff.
--
-- 3) notificaciones: el staff podía leer las de todos los clientes. Ahora
--    solo las propias o los avisos globales (user_id null) con permiso.
--
-- 4) productos: la lectura pública exponía inactivos y papelera. Ahora solo
--    activos no borrados, salvo staff con productos:leer.
--
-- 5) perfiles: el REVOKE por columna de 013 no servía porque authenticated
--    tenía UPDATE a nivel tabla. Se revoca y se otorgan solo las columnas
--    editables; rol/is_test_user/expires_at quedan fuera incluso si alguien
--    borra el trigger de guardia.
--
-- Idempotente. Verificación: supabase/verificar_rls.sql

begin;

-- 1) Reclamos: solo el backend inserta.
drop policy if exists "reclamos crea usuario" on public.reclamos;
revoke insert on public.reclamos from anon, authenticated;

-- 2) Mensajes: solo el backend inserta; el cliente no ve notas internas.
drop policy if exists "mensajes alta staff o duenio" on public.reclamo_mensajes;
revoke insert on public.reclamo_mensajes from anon, authenticated;

drop policy if exists "mensajes lectura staff o duenio" on public.reclamo_mensajes;
create policy "mensajes lectura staff o duenio" on public.reclamo_mensajes
  for select to authenticated
  using (
    public.has_permission('reclamos', 'leer')
    or (
      autor <> 'staff'
      and exists (
        select 1 from public.reclamos r
        where r.id = reclamo_mensajes.reclamo_id
          and r.user_id = (select auth.uid())
      )
    )
  );

-- 3) Notificaciones: propias o globales del staff.
drop policy if exists "notificaciones propias" on public.notificaciones;
create policy "notificaciones propias" on public.notificaciones
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (user_id is null and public.has_permission('notificaciones', 'leer'))
  );

-- 4) Catálogo: lo público solo ve productos activos y fuera de papelera.
drop policy if exists "lectura publica" on public.productos;
create policy "productos lectura" on public.productos
  for select to anon, authenticated
  using (
    (activo and deleted_at is null)
    or public.has_permission('productos', 'leer')
  );

-- 5) Perfiles: el cliente solo edita sus datos de contacto.
revoke update on public.perfiles from anon, authenticated;
grant update (nombre, telefono, direccion, ciudad, codigo_postal)
  on public.perfiles to authenticated;

commit;
