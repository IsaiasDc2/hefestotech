-- 022 · Cerrar SEC-02: inserción de notificaciones
--
-- La policy de 005 permitía a cualquier usuario autenticado con permiso
-- 'notificaciones:leer' insertar filas con cualquier user_id (o null, que
-- ve todo el staff). Eso habilitaba avisos falsos o phishing dentro del panel.
--
-- Los avisos legítimos se crean con service_role (backend) o con la función
-- public.notificar(), que es SECURITY DEFINER y no depende de esta policy.
-- No hay ningún insert directo desde el frontend: se puede cerrar del todo.
--
-- Idempotente. Ejecutar en el SQL Editor del Dashboard (o con psql).

begin;

drop policy if exists "notificaciones inserta staff" on public.notificaciones;

commit;
