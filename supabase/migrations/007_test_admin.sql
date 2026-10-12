-- HefestoTech · 007_test_admin.sql
-- Columnas para cuentas de prueba con vencimiento. Revisar en SQL Editor, no ejecutar en prod sin leer.
alter table perfiles
  add column if not exists is_test_user boolean not null default false,
  add column if not exists expires_at timestamptz;
create index if not exists idx_perfiles_test_expires on perfiles (is_test_user, expires_at)
  where is_test_user;
