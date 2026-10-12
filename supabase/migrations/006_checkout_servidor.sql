-- HefestoTech · 006_checkout_servidor.sql
-- Checkout con cálculo en servidor + webhook Mercado Pago.
-- Requiere 001–005 aplicados. Pegar en Dashboard → SQL Editor → Run.
-- PROHIBIDO ejecutar contra producción sin aprobación del dueño.
-- Idempotente: re-ejecutable (IF NOT EXISTS / DROP IF EXISTS).
-- Sin seeds productivos: solo estructura.

-- ============ 1. ORDENES: columnas de pago + expiración + token invitado ============
-- user_id pasa a nullable: el checkout servidor acepta invitados (sin sesión);
-- esas filas solo se leen vía backend con `acceso_token` (nunca por RLS directa).
alter table ordenes alter column user_id drop not null;

alter table ordenes
  add column if not exists mp_preference_id text not null default '',
  add column if not exists mp_payment_id text not null default '',
  add column if not exists mp_external_reference text not null default '',
  add column if not exists costo_envio_centavos integer not null default 0,
  add column if not exists expira_at timestamptz,
  add column if not exists acceso_token text;

create index if not exists idx_ordenes_mp_ext on ordenes (mp_external_reference);
create index if not exists idx_ordenes_expira on ordenes (estado, expira_at);

-- ============ 2. EVENTOS_WEBHOOK (idempotencia del webhook) ============
-- Un row por (fuente, evento_id). Ante reintento del proveedor el INSERT
-- choca con 409 y el backend responde 200 sin reprocesar.
create table if not exists eventos_webhook (
  id uuid primary key default gen_random_uuid(),
  fuente text not null default '',
  evento_id text not null,
  orden_id uuid references ordenes (id) on delete set null,
  estado text not null default 'recibido',
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (fuente, evento_id)
);
create index if not exists idx_eventos_orden on eventos_webhook (orden_id);

alter table eventos_webhook enable row level security;
-- Sin policies: solo service_role (backend). Denegado a anon/authenticated.

-- ============ 3. COMPROBANTES (uno por orden pagada) ============
-- El webhook lo inserta al acreditar; el UNIQUE en orden_id lo hace idempotente.
create table if not exists comprobantes (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null unique references ordenes (id) on delete cascade,
  total_centavos integer not null default 0 check (total_centavos >= 0),
  mp_payment_id text not null default '',
  emitida_at timestamptz not null default now()
);

alter table comprobantes enable row level security;
-- Sin policies: solo service_role (backend). Denegado a anon/authenticated.

-- ============ VERIFICACIÓN (solo lectura) ============
-- select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'ordenes'
--   and column_name in ('mp_preference_id','mp_payment_id','mp_external_reference',
--     'costo_envio_centavos','expira_at','acceso_token');
-- select tablename from pg_tables
--   where schemaname = 'public' and tablename in ('eventos_webhook','comprobantes');
