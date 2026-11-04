-- 020 · Permisos del módulo Categorías
--
-- La migración 019 normalizó `productos.categoria`, pero la matriz
-- `admin_permisos` todavía no tenía el módulo "categorias". Sin esto, el panel
-- no puede filtrar el módulo ni el backend autorizar sus endpoints cuando se
-- sumen en la próxima fase.
--
-- Aditivo e idempotente: no borra ni pisa permisos existentes.

begin;

insert into public.admin_permisos (rol, modulo, accion) values
  ('owner', 'categorias', 'leer'),
  ('owner', 'categorias', 'crear'),
  ('owner', 'categorias', 'editar'),
  ('owner', 'categorias', 'borrar'),
  ('admin', 'categorias', 'leer'),
  ('admin', 'categorias', 'crear'),
  ('admin', 'categorias', 'editar'),
  ('admin', 'categorias', 'borrar'),
  ('operador', 'categorias', 'leer'),
  ('operador', 'categorias', 'crear'),
  ('operador', 'categorias', 'editar'),
  ('soporte', 'categorias', 'leer'),
  ('solo_lectura', 'categorias', 'leer')
on conflict (rol, modulo, accion) do nothing;

commit;

-- Verificación:
--   select rol, count(*) from public.admin_permisos
--   where modulo = 'categorias' group by rol order by rol;
