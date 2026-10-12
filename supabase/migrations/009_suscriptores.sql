-- HefestoTech · 009_suscriptores.sql
-- Newsletter del footer. Revisar en SQL Editor, no ejecutar en prod sin leer.
create table if not exists suscriptores (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz not null default now()
);
alter table suscriptores enable row level security;
-- Sin policies: solo service_role opera (panel vía backend). Nadie lee directo.
