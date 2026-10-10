-- HefestoTech · 004_checkout_real.sql
-- Checkout real MP + comprobantes. NO ejecutar nada desde el agente: pegar en
-- Supabase Dashboard → SQL Editor → Run (después de 002 y 003).
-- Idempotente: todo con IF NOT EXISTS / OR REPLACE.

-- ============ 1. Columnas nuevas en ordenes ============
alter table ordenes add column if not exists telefono text not null default '';
alter table ordenes add column if not exists documento text not null default '';
alter table ordenes add column if not exists provincia text not null default '';
alter table ordenes add column if not exists medio_pago text not null default 'mercadopago';
alter table ordenes add column if not exists mp_preference_id text default '';
alter table ordenes add column if not exists mp_payment_id text default '';
alter table ordenes add column if not exists token_verificacion text default '';
alter table ordenes add column if not exists expira_en timestamptz;
alter table ordenes add column if not exists comprobante_numero text default '';
alter table ordenes drop constraint if exists ordenes_estado_check;
alter table ordenes add constraint ordenes_estado_check
  check (estado in ('pendiente_mp','pagado','rechazado','expirado','revision'));
create index if not exists idx_ordenes_estado on ordenes (estado);
create index if not exists idx_ordenes_token on ordenes (token_verificacion);

-- Backfill: estados legacy -> nuevos
update ordenes set estado = 'pagado'
  where estado in ('pagado_simulado','aprobado','completado');
update ordenes set estado = 'pendiente_mp'
  where estado in ('pendiente','pendiente_mp') or estado like 'pendiente%';
update ordenes set estado = 'rechazado'
  where estado in ('rechazado','fallido','cancelado');

-- ============ 2. Eventos webhook (idempotencia) ============
create table if not exists eventos_webhook (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid references ordenes (id) on delete set null,
  mp_payment_id text unique not null,
  status text not null default '',
  created_at timestamptz default now()
);
alter table eventos_webhook enable row level security;
-- Sin políticas de lectura pública: solo service_role (backend).

-- ============ 3. Comprobantes (snapshot inmutable) ============
create table if not exists comprobantes (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid unique not null references ordenes (id) on delete cascade,
  numero text unique not null,
  items_snapshot jsonb not null default '[]',
  totales_snapshot jsonb not null default '{}',
  comercio_snapshot jsonb not null default '{}',
  token_verificacion text not null default '',
  emitido_en timestamptz default now()
);
alter table comprobantes enable row level security;

drop policy if exists "comprobante del comprador" on comprobantes;
create policy "comprobante del comprador" on comprobantes
  for select to authenticated using (
    exists (select 1 from ordenes o
            where o.id = comprobantes.orden_id and o.user_id = auth.uid())
  );

-- Secuencia correlativa por año: CMP-AAAA-NNNNNN
create sequence if not exists comprobante_seq_2026 start 1;
create or replace function public.siguiente_numero_comprobante()
returns text language plpgsql as $$
declare anio int := extract(year from (now() at time zone 'America/Argentina/Buenos_Aires'));
declare n bigint;
begin
  begin
    execute format('select nextval(%L)', 'comprobante_seq_' || anio) into n;
  exception when undefined_table then
    execute format('create sequence comprobante_seq_%s start 1', anio);
    execute format('select nextval(%L)', 'comprobante_seq_' || anio) into n;
  end;
  return 'CMP-' || anio || '-' || lpad(n::text, 6, '0');
end $$;

-- ============ 4. Transacciones (stock + pago) ============
create or replace function public.reservar_stock_tx(p_orden_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare f record;
begin
  for f in select producto_id, cantidad from orden_items where orden_id = p_orden_id loop
    update productos set stock = stock - f.cantidad
      where id = f.producto_id and stock >= f.cantidad;
    if not found then
      raise exception 'Sin stock para %', f.producto_id;
    end if;
    insert into movimientos_stock (producto_id, tipo, cantidad, motivo, orden_id)
      values (f.producto_id, 'salida', f.cantidad, 'reserva checkout', p_orden_id);
  end loop;
end $$;

create or replace function public.liberar_reserva_tx(p_orden_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare f record;
begin
  -- Solo libera si la reserva sigue vigente (no hay confirmación de pago)
  if exists (select 1 from ordenes where id = p_orden_id and estado = 'pagado') then
    return;
  end if;
  for f in select producto_id, cantidad from orden_items where orden_id = p_orden_id loop
    update productos set stock = stock + f.cantidad where id = f.producto_id;
    insert into movimientos_stock (producto_id, tipo, cantidad, motivo, orden_id)
      values (f.producto_id, 'entrada', f.cantidad, 'liberación reserva', p_orden_id);
  end loop;
end $$;

create or replace function public.confirmar_pago_tx(p_orden_id uuid, p_payment_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update ordenes set estado = 'pagado', mp_payment_id = p_payment_id
    where id = p_orden_id and estado <> 'pagado';
end $$;

create or replace function public.emitir_comprobante_tx(p_orden_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  o record; num text;
  items jsonb; totales jsonb;
begin
  if exists (select 1 from comprobantes where orden_id = p_orden_id) then
    return; -- idempotente
  end if;
  select * into o from ordenes where id = p_orden_id;
  if not found or o.estado <> 'pagado' then
    raise exception 'Orden no pagada';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'producto_id', oi.producto_id, 'cantidad', oi.cantidad,
      'precio_unitario', oi.precio, 'nombre', p.nombre)), '[]')
    into items
    from orden_items oi left join productos p on p.id = oi.producto_id
    where oi.orden_id = p_orden_id;
  totales := jsonb_build_object('subtotal', o.subtotal, 'costo_envio', o.costo_envio, 'total', o.total);
  num := public.siguiente_numero_comprobante();
  insert into comprobantes (orden_id, numero, items_snapshot, totales_snapshot, token_verificacion)
    values (p_orden_id, num, items, totales, o.token_verificacion);
  update ordenes set comprobante_numero = num where id = p_orden_id;
end $$;
