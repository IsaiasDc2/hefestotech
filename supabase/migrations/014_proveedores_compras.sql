-- HefestoTech · 014_proveedores_compras.sql
-- Módulo de Proveedores y Compras (prompt MVP §5.3, alcance MVP):
--   1) Ficha de proveedor sobre la tabla `proveedores` de 003 (CUIT con
--      dígito verificador, condición IVA, contactos, condiciones de pago,
--      datos bancarios, estado) + borrado lógico.
--   2) `producto_proveedor` con costo en centavos, código del proveedor,
--      cantidad mínima y proveedor principal (uno por producto) + historial
--      de costos.
--   3) Órdenes de compra (borrador → enviada → confirmada → recibida
--      parcial/total, cancelada) con ítems y recepciones.
--   4) RPC `recibir_orden_compra`: suma stock vía `adjust_stock` (que deja el
--      movimiento de inventario) en una sola transacción.
--   5) Permisos `proveedores` y `compras` en `admin_permisos` y RLS solo
--      staff (antes `proveedores`/`producto_proveedor` eran de lectura
--      pública: con costos y CBU eso sería una fuga).
-- Requiere 003, 004 y 005 aplicadas. Idempotente y re-ejecutable.
-- Pegar en Dashboard → SQL Editor → Run. Reversión: al final (comentada).
-- NO ejecutar contra producción sin aprobación del dueño.

-- ============ 1. CUIT: dígito verificador ============
-- Espejo de `_cuit_valido` en backend/admin_api.py. Acepta 11 dígitos sin
-- guiones (el backend normaliza antes de guardar).
create or replace function public.cuit_valido(p_cuit text)
returns boolean
language plpgsql
immutable
set search_path = public as $$
declare
  v_pesos int[] := array[5,4,3,2,7,6,5,4,3,2];
  v_suma int := 0;
  v_resto int;
  v_dv int;
  i int;
begin
  if p_cuit is null or p_cuit !~ '^[0-9]{11}$' then
    return false;
  end if;
  if substr(p_cuit, 1, 2) not in ('20','23','24','25','26','27','30','33','34') then
    return false;
  end if;
  for i in 1..10 loop
    v_suma := v_suma + substr(p_cuit, i, 1)::int * v_pesos[i];
  end loop;
  v_resto := 11 - (v_suma % 11);
  v_dv := case when v_resto = 11 then 0 when v_resto = 10 then -1 else v_resto end;
  return v_dv >= 0 and v_dv = substr(p_cuit, 11, 1)::int;
end $$;

-- select cuit_valido('20123456786'); -- true (esperado)
-- select cuit_valido('20123456780'); -- false (esperado)

-- ============ 2. PROVEEDORES: ficha completa ============
alter table proveedores add column if not exists nombre_comercial text not null default '';
alter table proveedores add column if not exists condicion_iva text not null default 'responsable_inscripto';
alter table proveedores add column if not exists whatsapp text not null default '';
alter table proveedores add column if not exists sitio_web text not null default '';
alter table proveedores add column if not exists provincia text not null default '';
alter table proveedores add column if not exists ciudad text not null default '';
alter table proveedores add column if not exists contactos jsonb not null default '[]';
alter table proveedores add column if not exists condicion_pago text not null default 'contado';
alter table proveedores add column if not exists moneda text not null default 'ARS';
alter table proveedores add column if not exists plazo_entrega_dias integer not null default 7;
alter table proveedores add column if not exists pedido_minimo_centavos bigint not null default 0;
alter table proveedores add column if not exists descuento_pct numeric(5,2) not null default 0;
alter table proveedores add column if not exists cbu text not null default '';
alter table proveedores add column if not exists alias_cbu text not null default '';
alter table proveedores add column if not exists notas text not null default '';
alter table proveedores add column if not exists etiquetas text[] not null default '{}';
alter table proveedores add column if not exists calificacion smallint;
alter table proveedores add column if not exists estado text not null default 'activo';
alter table proveedores add column if not exists updated_at timestamptz not null default now();
alter table proveedores add column if not exists deleted_at timestamptz;
alter table proveedores add column if not exists deleted_by uuid references auth.users (id) on delete set null;

-- Normaliza CUIT viejos con guiones antes de exigir el formato.
update proveedores set cuit = regexp_replace(coalesce(cuit, ''), '[^0-9]', '', 'g')
where cuit is distinct from regexp_replace(coalesce(cuit, ''), '[^0-9]', '', 'g');
update proveedores set cuit = '' where cuit is null;
alter table proveedores alter column cuit set default '';
alter table proveedores alter column cuit set not null;

-- Checks: `not valid` para no bloquear la migración si quedaron filas
-- históricas fuera de regla; aplican a todo INSERT/UPDATE nuevo.
alter table proveedores drop constraint if exists proveedores_cuit_check;
alter table proveedores add constraint proveedores_cuit_check
  check (cuit = '' or public.cuit_valido(cuit)) not valid;
alter table proveedores drop constraint if exists proveedores_condicion_iva_check;
alter table proveedores add constraint proveedores_condicion_iva_check
  check (condicion_iva in ('responsable_inscripto','monotributo','exento','no_responsable','consumidor_final')) not valid;
alter table proveedores drop constraint if exists proveedores_condicion_pago_check;
alter table proveedores add constraint proveedores_condicion_pago_check
  check (condicion_pago in ('contado','15_dias','30_dias','60_dias')) not valid;
alter table proveedores drop constraint if exists proveedores_moneda_check;
alter table proveedores add constraint proveedores_moneda_check
  check (moneda in ('ARS','USD')) not valid;
alter table proveedores drop constraint if exists proveedores_estado_check;
alter table proveedores add constraint proveedores_estado_check
  check (estado in ('activo','inactivo','en_evaluacion')) not valid;
alter table proveedores drop constraint if exists proveedores_numeros_check;
alter table proveedores add constraint proveedores_numeros_check
  check (plazo_entrega_dias between 0 and 365
         and pedido_minimo_centavos >= 0
         and descuento_pct between 0 and 100
         and (calificacion is null or calificacion between 1 and 5)) not valid;
alter table proveedores drop constraint if exists proveedores_cbu_check;
alter table proveedores add constraint proveedores_cbu_check
  check (cbu = '' or cbu ~ '^[0-9]{22}$') not valid;
alter table proveedores drop constraint if exists proveedores_contactos_check;
alter table proveedores add constraint proveedores_contactos_check
  check (jsonb_typeof(contactos) = 'array') not valid;

-- Un CUIT no se repite entre proveedores vivos.
create unique index if not exists uq_proveedores_cuit
  on proveedores (cuit) where cuit <> '' and deleted_at is null;
create index if not exists idx_proveedores_estado on proveedores (estado) where deleted_at is null;

-- updated_at automático (reutilizable por las tablas de este módulo).
create or replace function public.tocar_updated_at()
returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_proveedores_updated on proveedores;
create trigger trg_proveedores_updated before update on proveedores
  for each row execute function public.tocar_updated_at();

-- ============ 3. PRODUCTO ↔ PROVEEDOR ============
alter table producto_proveedor add column if not exists codigo_proveedor text not null default '';
alter table producto_proveedor add column if not exists costo_centavos bigint;
alter table producto_proveedor add column if not exists moneda text not null default 'ARS';
alter table producto_proveedor add column if not exists cantidad_minima integer not null default 1;
alter table producto_proveedor add column if not exists es_principal boolean not null default false;
alter table producto_proveedor add column if not exists updated_at timestamptz not null default now();

-- Montos en centavos: se migra el `costo` numeric de 003. La columna vieja
-- queda por compatibilidad pero el backend solo usa costo_centavos.
update producto_proveedor set costo_centavos = round(coalesce(costo, 0) * 100)::bigint
where costo_centavos is null;
alter table producto_proveedor alter column costo_centavos set default 0;
alter table producto_proveedor alter column costo_centavos set not null;

alter table producto_proveedor drop constraint if exists producto_proveedor_valores_check;
alter table producto_proveedor add constraint producto_proveedor_valores_check
  check (costo_centavos >= 0 and cantidad_minima >= 1
         and tiempo_entrega_dias between 0 and 365
         and moneda in ('ARS','USD')) not valid;

-- Un solo proveedor principal por producto.
create unique index if not exists uq_producto_proveedor_principal
  on producto_proveedor (producto_id) where es_principal;
create index if not exists idx_producto_proveedor_proveedor on producto_proveedor (proveedor_id);

drop trigger if exists trg_producto_proveedor_updated on producto_proveedor;
create trigger trg_producto_proveedor_updated before update on producto_proveedor
  for each row execute function public.tocar_updated_at();

-- Historial de costos: una fila por alta o cambio de costo/moneda.
create table if not exists producto_proveedor_costos (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos (id) on delete cascade,
  proveedor_id uuid not null references proveedores (id) on delete cascade,
  costo_centavos bigint not null check (costo_centavos >= 0),
  moneda text not null default 'ARS',
  created_at timestamptz not null default now()
);
create index if not exists idx_pp_costos on producto_proveedor_costos (producto_id, proveedor_id, created_at desc);

create or replace function public.registrar_costo_proveedor()
returns trigger
language plpgsql
security definer
set search_path = public as $$
begin
  if TG_OP = 'INSERT'
     or new.costo_centavos is distinct from old.costo_centavos
     or new.moneda is distinct from old.moneda then
    insert into public.producto_proveedor_costos (producto_id, proveedor_id, costo_centavos, moneda)
    values (new.producto_id, new.proveedor_id, new.costo_centavos, new.moneda);
  end if;
  return new;
end $$;

drop trigger if exists trg_producto_proveedor_costos on producto_proveedor;
create trigger trg_producto_proveedor_costos after insert or update on producto_proveedor
  for each row execute function public.registrar_costo_proveedor();

-- ============ 4. ÓRDENES DE COMPRA ============
create table if not exists ordenes_compra (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated by default as identity unique,
  proveedor_id uuid not null references proveedores (id) on delete restrict,
  estado text not null default 'borrador'
    check (estado in ('borrador','enviada','confirmada','recibida_parcial','recibida','cancelada')),
  moneda text not null default 'ARS' check (moneda in ('ARS','USD')),
  notas text not null default '',
  fecha_esperada date,
  creado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  enviada_at timestamptz,
  recibida_at timestamptz,
  cancelada_at timestamptz
);
create index if not exists idx_oc_proveedor on ordenes_compra (proveedor_id, created_at desc);
create index if not exists idx_oc_estado on ordenes_compra (estado, created_at desc);

drop trigger if exists trg_oc_updated on ordenes_compra;
create trigger trg_oc_updated before update on ordenes_compra
  for each row execute function public.tocar_updated_at();

create table if not exists ordenes_compra_items (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references ordenes_compra (id) on delete cascade,
  producto_id uuid not null references productos (id) on delete restrict,
  cantidad integer not null check (cantidad > 0 and cantidad <= 1000000),
  cantidad_recibida integer not null default 0,
  costo_unitario_centavos bigint not null default 0 check (costo_unitario_centavos >= 0),
  created_at timestamptz not null default now(),
  unique (orden_id, producto_id),
  check (cantidad_recibida between 0 and cantidad)
);
create index if not exists idx_oc_items_producto on ordenes_compra_items (producto_id);

-- Cada recepción queda registrada con lo recibido (snapshot) y quién.
create table if not exists recepciones_compra (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references ordenes_compra (id) on delete cascade,
  items jsonb not null default '[]',
  nota text not null default '',
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_recepciones_orden on recepciones_compra (orden_id, created_at desc);

-- ============ 5. RPC: recepción de mercadería ============
-- p_items: [{"producto_id": uuid, "cantidad": int > 0}, ...]
-- Todo o nada: si una línea excede lo pendiente o el producto está en
-- papelera (adjust_stock lanza), no se aplica ninguna.
create or replace function public.recibir_orden_compra(
  p_orden uuid,
  p_items jsonb,
  p_nota text default '',
  p_actor uuid default null,
  p_actualizar_costo boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_oc record;
  v_item jsonb;
  v_linea record;
  v_producto uuid;
  v_cant int;
  v_stock int;
  v_resultado jsonb := '[]';
  v_pendiente int;
  v_estado text;
  v_recepcion uuid;
  v_ref text;
begin
  select id, numero, estado, proveedor_id, moneda into v_oc
  from public.ordenes_compra where id = p_orden for update;
  if not found then raise exception 'orden de compra inexistente'; end if;
  if v_oc.estado not in ('enviada','confirmada','recibida_parcial') then
    raise exception 'la orden no admite recepción';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'recepción sin ítems';
  end if;

  v_ref := 'OC-' || lpad(v_oc.numero::text, 6, '0');

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_producto := (v_item ->> 'producto_id')::uuid;
    v_cant := (v_item ->> 'cantidad')::int;
    if v_cant is null or v_cant <= 0 then
      raise exception 'cantidad inválida';
    end if;

    select id, cantidad, cantidad_recibida, costo_unitario_centavos into v_linea
    from public.ordenes_compra_items
    where orden_id = p_orden and producto_id = v_producto
    for update;
    if not found then raise exception 'producto fuera de la orden'; end if;
    if v_linea.cantidad_recibida + v_cant > v_linea.cantidad then
      raise exception 'recepción excede lo pedido';
    end if;

    update public.ordenes_compra_items
    set cantidad_recibida = cantidad_recibida + v_cant
    where id = v_linea.id;

    -- adjust_stock suma stock y deja el movimiento (motivo + nota con la OC).
    v_stock := public.adjust_stock(v_producto, v_cant, 'recepcion_compra', v_ref, p_actor);

    if p_actualizar_costo then
      insert into public.producto_proveedor (producto_id, proveedor_id, costo_centavos, moneda)
      values (v_producto, v_oc.proveedor_id, v_linea.costo_unitario_centavos, v_oc.moneda)
      on conflict (producto_id, proveedor_id)
      do update set costo_centavos = excluded.costo_centavos, moneda = excluded.moneda;
    end if;

    v_resultado := v_resultado || jsonb_build_object(
      'producto_id', v_producto, 'cantidad', v_cant, 'stock', v_stock);
  end loop;

  select coalesce(sum(cantidad - cantidad_recibida), 0) into v_pendiente
  from public.ordenes_compra_items where orden_id = p_orden;
  v_estado := case when v_pendiente = 0 then 'recibida' else 'recibida_parcial' end;

  update public.ordenes_compra
  set estado = v_estado,
      recibida_at = case when v_estado = 'recibida' then now() else recibida_at end
  where id = p_orden;

  insert into public.recepciones_compra (orden_id, items, nota, actor_id)
  values (p_orden, v_resultado, coalesce(p_nota, ''), coalesce(auth.uid(), p_actor))
  returning id into v_recepcion;

  return jsonb_build_object('estado', v_estado, 'recepcion_id', v_recepcion,
                            'pendiente', v_pendiente, 'items', v_resultado);
end $$;

-- Solo el backend (service_role) recibe mercadería: la RPC es SECURITY
-- DEFINER y no valida rol por sí misma.
revoke execute on function public.recibir_orden_compra(uuid, jsonb, text, uuid, boolean) from public, anon, authenticated;

-- ============ 6. PERMISOS ============
insert into admin_permisos (rol, modulo, accion) values
  ('owner','proveedores','leer'),('owner','proveedores','crear'),('owner','proveedores','editar'),('owner','proveedores','borrar'),
  ('owner','compras','leer'),('owner','compras','crear'),('owner','compras','editar'),('owner','compras','cambiar_estado'),('owner','compras','recibir'),
  ('admin','proveedores','leer'),('admin','proveedores','crear'),('admin','proveedores','editar'),('admin','proveedores','borrar'),
  ('admin','compras','leer'),('admin','compras','crear'),('admin','compras','editar'),('admin','compras','cambiar_estado'),('admin','compras','recibir'),
  ('operador','proveedores','leer'),('operador','proveedores','crear'),('operador','proveedores','editar'),
  ('operador','compras','leer'),('operador','compras','crear'),('operador','compras','editar'),('operador','compras','cambiar_estado'),('operador','compras','recibir'),
  ('solo_lectura','proveedores','leer'),('solo_lectura','compras','leer')
on conflict (rol, modulo, accion) do nothing;

-- ============ 7. RLS: solo staff ============
-- proveedores / producto_proveedor: fuera la lectura pública de 003.
drop policy if exists "lectura publica" on proveedores;
drop policy if exists "proveedores lectura staff" on proveedores;
create policy "proveedores lectura staff" on proveedores
  for select to authenticated using (public.has_permission('proveedores', 'leer'));

drop policy if exists "lectura publica" on producto_proveedor;
drop policy if exists "producto_proveedor lectura staff" on producto_proveedor;
create policy "producto_proveedor lectura staff" on producto_proveedor
  for select to authenticated using (public.has_permission('proveedores', 'leer'));

alter table producto_proveedor_costos enable row level security;
drop policy if exists "costos lectura staff" on producto_proveedor_costos;
create policy "costos lectura staff" on producto_proveedor_costos
  for select to authenticated using (public.has_permission('proveedores', 'leer'));

-- Compras: lectura staff; la escritura va por el backend (service_role).
alter table ordenes_compra enable row level security;
drop policy if exists "oc lectura staff" on ordenes_compra;
create policy "oc lectura staff" on ordenes_compra
  for select to authenticated using (public.has_permission('compras', 'leer'));

alter table ordenes_compra_items enable row level security;
drop policy if exists "oc items lectura staff" on ordenes_compra_items;
create policy "oc items lectura staff" on ordenes_compra_items
  for select to authenticated using (public.has_permission('compras', 'leer'));

alter table recepciones_compra enable row level security;
drop policy if exists "recepciones lectura staff" on recepciones_compra;
create policy "recepciones lectura staff" on recepciones_compra
  for select to authenticated using (public.has_permission('compras', 'leer'));

-- ============ 8. AUDITORÍA ============
drop trigger if exists aud_proveedores on proveedores;
create trigger aud_proveedores after insert or update or delete on proveedores
  for each row execute function public.audit_registrar();
drop trigger if exists aud_producto_proveedor on producto_proveedor;
create trigger aud_producto_proveedor after insert or update or delete on producto_proveedor
  for each row execute function public.audit_registrar();
drop trigger if exists aud_ordenes_compra on ordenes_compra;
create trigger aud_ordenes_compra after insert or update or delete on ordenes_compra
  for each row execute function public.audit_registrar();
drop trigger if exists aud_ordenes_compra_items on ordenes_compra_items;
create trigger aud_ordenes_compra_items after insert or update or delete on ordenes_compra_items
  for each row execute function public.audit_registrar();
drop trigger if exists aud_recepciones_compra on recepciones_compra;
create trigger aud_recepciones_compra after insert on recepciones_compra
  for each row execute function public.audit_registrar();

-- ============ VERIFICACIÓN ============
-- select cuit_valido('30712345671');
-- select rol, accion from admin_permisos where modulo in ('proveedores','compras') order by 1, 2;
-- select tablename, policyname from pg_policies
--   where tablename in ('proveedores','producto_proveedor','ordenes_compra','ordenes_compra_items','recepciones_compra');

-- ============ REVERSIÓN (manual, comentada) ============
-- drop function if exists public.recibir_orden_compra(uuid, jsonb, text, uuid, boolean);
-- drop table if exists recepciones_compra, ordenes_compra_items, ordenes_compra, producto_proveedor_costos;
-- drop trigger if exists trg_producto_proveedor_costos on producto_proveedor;
-- drop function if exists public.registrar_costo_proveedor();
-- delete from admin_permisos where modulo in ('proveedores','compras');
-- (las columnas nuevas de proveedores/producto_proveedor pueden quedar: no rompen 003)
