-- 021 · Restituir el permiso de reclamos para clientes
--
-- El espejo Python de admin_api.py siempre otorgó ('cliente','reclamos','crear')
-- para que el formulario público /reclamo funcione con sesión iniciada, pero
-- los seeds de 005 no lo incluyeron. Ahora que la matriz de la base manda,
-- sin esta fila el POST /api/admin/reclamos devolvería 403 a los clientes.
--
-- Aditivo e idempotente.

begin;

insert into public.admin_permisos (rol, modulo, accion) values
  ('cliente', 'reclamos', 'crear')
on conflict (rol, modulo, accion) do nothing;

commit;

-- Verificación:
--   select * from public.admin_permisos where rol = 'cliente';
