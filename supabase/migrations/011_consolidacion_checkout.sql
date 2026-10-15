-- HefestoTech · 011_consolidacion_checkout.sql
-- Consolida 004_checkout_real vs 006_checkout_servidor (y 005_admin_infra).
-- El backend vigente (backend/checkout_api.py + admin_api.py) usa el set 005:
--   ordenes.estado in ('pendiente','pagada','preparacion','enviada','entregada','cancelada','reembolsada')
--   eventos_webhook(fuente, evento_id UNIQUE, orden_id, estado, payload)
--   comprobantes(orden_id UNIQUE, total_centavos, mp_payment_id) solo service_role
-- Pegar en Dashboard → SQL Editor → Run. Idempotente y re-ejecutable.
-- No toca seeds ni datos de negocio, solo estructura + backfill de estados legacy.

-- ============ 1. ORDENES: columnas servidor + user_id nullable ============
alter table ordenes alter column user_id drop not null;

alter table ordenes
  add column if not exists mp_preference_id text default '',
  add column if not exists mp_payment_id text default '',
  add column if not exists mp_external_reference text default '',
  add column if not exists costo_envio_centavos integer default 0,
  add column if not exists expira_at timestamptz,
  add column if not exists acceso_token text;

create index if not exists idx_ordenes_mp_ext on ordenes (mp_external_reference);
create index if not exists idx_ordenes_expira on ordenes (estado, expira_at);

-- ============ 2. ESTADOS: backfill legacy 004 -> set 005 y constraint final ============
update ordenes set estado = 'pagada'
  where estado in ('pagado', 'pagado_simulado', 'aprobado', 'completado');
update ordenes set estado = 'pendiente'
  where estado in ('pendiente_mp') or estado like 'pendiente%';
update ordenes set estado = 'cancelada'
  where estado in ('rechazado', 'rechazada', 'expirado', 'expirada', 'fallido', 'cancelado');
update ordenes set estado = 'pendiente'
  where estado in ('revision', 'en_revision');

alter table ordenes drop constraint if exists ordenes_estado_check;
alter table ordenes
  add constraint ordenes_estado_check
  check (estado in ('pendiente','pagada','preparacion','enviada','entregada','cancelada','reembolsada'));

create index if not exists idx_ordenes_estado on ordenes (estado);

-- ============ 3. EVENTOS_WEBHOOK: forma 006 sin romper forma 004 ============
alter table eventos_webhook
  add column if not exists fuente text default '',
  add column if not exists evento_id text,
  add column if not exists orden_id uuid references ordenes (id) on delete set null,
  add column if not exists estado text default 'recibido',
  add column if not exists payload jsonb default '{}';

-- Backfill desde la forma 004 (mp_payment_id + status) solo donde falta
-- y solo si esas columnas existen (orden de aplicación 004/006 ambiguo).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'eventos_webhook'
      and column_name = 'mp_payment_id'
  ) then
    update eventos_webhook
      set evento_id = 'mp:' || coalesce(mp_payment_id, '') || ':' || coalesce(status, '')
      where evento_id is null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'eventos_webhook_fuente_evento_id_key'
  ) then
    alter table eventos_webhook add constraint eventos_webhook_fuente_evento_id_key
      unique (fuente, evento_id);
  end if;
end $$;

create index if not exists idx_eventos_orden on eventos_webhook (orden_id);

alter table eventos_webhook enable row level security;
-- Sin policies: solo service_role (backend). Denegado a anon/authenticated.

-- ============ 4. COMPROBANTES: columnas servidor + solo service_role ============
alter table comprobantes
  add column if not exists total_centavos integer default 0,
  add column if not exists mp_payment_id text default '',
  add column if not exists emitida_at timestamptz default now();

alter table comprobantes enable row level security;
drop policy if exists "comprobante del comprador" on comprobantes;
-- Sin policies: solo service_role (backend). El front lee vía /api/comprobantes.

-- ============ VERIFICACIÓN (solo lectura, correr aparte) ============
-- select conname from pg_constraint where conname = 'ordenes_estado_check';
-- select distinct estado from ordenes;
-- select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'eventos_webhook'
--   and column_name in ('fuente','evento_id','orden_id','estado','payload','mp_payment_id','status');
-- select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'comprobantes'
--   and column_name in ('orden_id','total_centavos','mp_payment_id','emitida_at');
-- select policyname from pg_policies where tablename = 'comprobantes';
