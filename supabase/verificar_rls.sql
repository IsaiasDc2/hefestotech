-- Verificación de la migración 023 (solo lectura).
-- Pegar en el SQL Editor después de aplicar 023.
--
-- Esperado:
--   1) productos: una sola policy de SELECT, solo activos y no borrados
--      (o staff con productos:leer);
--   2) reclamos y reclamo_mensajes: sin INSERT para anon/authenticated;
--   3) notificaciones: propias o globales del staff;
--   4) perfiles: sin UPDATE a nivel tabla y sin columnas de rol.

-- 1) Policies de las tablas tocadas.
select tablename, policyname, cmd, roles::text, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('productos', 'notificaciones', 'reclamos', 'reclamo_mensajes')
order by tablename, policyname;

-- 2) Insert directo: todo debe dar false.
select has_table_privilege('anon', 'public.reclamos', 'INSERT') as reclamos_anon,
       has_table_privilege('authenticated', 'public.reclamos', 'INSERT') as reclamos_auth,
       has_table_privilege('anon', 'public.reclamo_mensajes', 'INSERT') as mensajes_anon,
       has_table_privilege('authenticated', 'public.reclamo_mensajes', 'INSERT') as mensajes_auth;

-- 3) Perfiles: tabla false; nombre/telefono true; rol false.
select has_table_privilege('authenticated', 'public.perfiles', 'UPDATE') as tabla,
       has_column_privilege('authenticated', 'public.perfiles', 'nombre', 'UPDATE') as nombre,
       has_column_privilege('authenticated', 'public.perfiles', 'telefono', 'UPDATE') as telefono,
       has_column_privilege('authenticated', 'public.perfiles', 'rol', 'UPDATE') as rol,
       has_column_privilege('authenticated', 'public.perfiles', 'is_test_user', 'UPDATE') as test_user,
       has_column_privilege('authenticated', 'public.perfiles', 'expires_at', 'UPDATE') as expires_at;

-- 4) Cuántos productos ve la clave pública. Debe coincidir con los activos
--    y no borrados (hoy 137 de 153). Se restaura el rol al terminar.
set role anon;
select count(*) as productos_visibles_anon from public.productos;
reset role;
