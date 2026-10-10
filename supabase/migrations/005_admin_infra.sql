-- HefestoTech · 005_admin_infra.sql
-- Infra admin: matriz de roles, auditoría append-only, papelera, notificaciones,
-- búsqueda full-text, cupones, estados de pedido, envíos, reclamos, whatsapp_cfg, banners.
-- Requiere 001–004 aplicados. Pegar en Dashboard → SQL Editor → Run.
-- PROHIBIDO ejecutar contra producción sin aprobación del dueño.
-- Seeds: solo permisos y catálogos vacíos/ejemplo no productivo. Sin datos de negocio.

-- ============ 0. EXTENSIONES ============
create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- Wrapper IMMUTABLE de unaccent: las columnas generadas exigen funciones
-- inmutables y unaccent() es STABLE por defecto (la columna `busqueda`
-- fallaría al aplicar sin este wrapper).
create or replace function public.f_unaccent(text)
returns text language sql immutable parallel safe as $$
  select public.unaccent($1);
$$;

-- ============ 1. ROLES + MATRIZ has_permission(modulo, accion) ============
-- 004 dejó rol check ('admin','cliente'). Ampliamos a staff + cliente.
alter table perfiles drop constraint if exists perfiles_rol_check;
alter table perfiles
  add constraint perfiles_rol_check
  check (rol in ('cliente','owner','admin','operador','soporte','solo_lectura'));

-- Matriz declarativa rol → (módulo, acción). Fuente de verdad del permiso.
create table if not exists admin_permisos (
  rol text not null,
  modulo text not null,
  accion text not null,
  primary key (rol, modulo, accion)
);

-- Módulos: productos, pedidos, stock, reclamos, cupones, banners,
--   notificaciones, auditoria, reportes, buscar, config, usuarios.
-- Acciones: leer, crear, editar, borrar, cambiar_estado, ajustar, gestionar.
-- Seeds de PERMISOS (infra, no datos productivos). Idempotente.
insert into admin_permisos (rol, modulo, accion) values
  -- owner: todo
  ('owner','productos','leer'),('owner','productos','crear'),('owner','productos','editar'),('owner','productos','borrar'),
  ('owner','pedidos','leer'),('owner','pedidos','crear'),('owner','pedidos','editar'),('owner','pedidos','cambiar_estado'),
  ('owner','stock','leer'),('owner','stock','ajustar'),
  ('owner','reclamos','leer'),('owner','reclamos','crear'),('owner','reclamos','editar'),('owner','reclamos','cambiar_estado'),
  ('owner','cupones','leer'),('owner','cupones','crear'),('owner','cupones','editar'),('owner','cupones','borrar'),
  ('owner','banners','leer'),('owner','banners','crear'),('owner','banners','editar'),('owner','banners','borrar'),
  ('owner','notificaciones','leer'),('owner','auditoria','leer'),
  ('owner','reportes','leer'),('owner','buscar','leer'),
  ('owner','config','leer'),('owner','config','gestionar'),
  ('owner','usuarios','leer'),('owner','usuarios','gestionar'),
  -- admin: todo operativo (sin gestionar usuarios/config sensibles)
  ('admin','productos','leer'),('admin','productos','crear'),('admin','productos','editar'),('admin','productos','borrar'),
  ('admin','pedidos','leer'),('admin','pedidos','crear'),('admin','pedidos','editar'),('admin','pedidos','cambiar_estado'),
  ('admin','stock','leer'),('admin','stock','ajustar'),
  ('admin','reclamos','leer'),('admin','reclamos','crear'),('admin','reclamos','editar'),('admin','reclamos','cambiar_estado'),
  ('admin','cupones','leer'),('admin','cupones','crear'),('admin','cupones','editar'),('admin','cupones','borrar'),
  ('admin','banners','leer'),('admin','banners','crear'),('admin','banners','editar'),('admin','banners','borrar'),
  ('admin','notificaciones','leer'),('admin','auditoria','leer'),
  ('admin','reportes','leer'),('admin','buscar','leer'),
  ('admin','config','leer'),
  -- operador: catálogo + pedidos + stock
  ('operador','productos','leer'),('operador','productos','crear'),('operador','productos','editar'),
  ('operador','pedidos','leer'),('operador','pedidos','cambiar_estado'),
  ('operador','stock','leer'),('operador','stock','ajustar'),
  ('operador','reclamos','leer'),
  ('operador','cupones','leer'),('operador','banners','leer'),
  ('operador','notificaciones','leer'),('operador','reportes','leer'),('operador','buscar','leer'),
  -- soporte: reclamos + lectura
  ('soporte','productos','leer'),('soporte','pedidos','leer'),
  ('soporte','reclamos','leer'),('soporte','reclamos','crear'),('soporte','reclamos','editar'),('soporte','reclamos','cambiar_estado'),
  ('soporte','notificaciones','leer'),('soporte','buscar','leer'),
  -- solo_lectura: solo leer
  ('solo_lectura','productos','leer'),('solo_lectura','pedidos','leer'),
  ('solo_lectura','stock','leer'),('solo_lectura','reclamos','leer'),
  ('solo_lectura','cupones','leer'),('solo_lectura','banners','leer'),
  ('solo_lectura','notificaciones','leer'),('solo_lectura','auditoria','leer'),
  ('solo_lectura','reportes','leer'),('solo_lectura','buscar','leer')
on conflict (rol, modulo, accion) do nothing;

-- has_permission(modulo, accion): matriz real. Mantiene compat con has_permission(text) de 004.
create or replace function public.has_permission(p_modulo text, p_accion text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.perfiles p
    join public.admin_permisos m
      on m.rol = p.rol
     and m.modulo = p_modulo
     and m.accion = p_accion
    where p.id = auth.uid()
  );
$$;

grant execute on function public.has_permission(text, text) to authenticated;

alter table admin_permisos enable row level security;
drop policy if exists "permisos lectura staff" on admin_permisos;
create policy "permisos lectura staff" on admin_permisos
  for select to authenticated using (public.has_permission('auditoria', 'leer'));

-- ============ 2. AUDIT LOG APPEND-ONLY ============
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid references auth.users (id) on delete set null,
  modulo text not null default '',
  accion text not null default '',
  entidad text not null default '',
  entidad_id text not null default '',
  diff jsonb not null default '{}',
  meta jsonb not null default '{}'
);
create index if not exists idx_audit_created on audit_log (created_at desc);
create index if not exists idx_audit_entidad on audit_log (entidad, entidad_id);

alter table audit_log enable row level security;
drop policy if exists "auditoria lectura staff" on audit_log;
create policy "auditoria lectura staff" on audit_log
  for select to authenticated using (public.has_permission('auditoria', 'leer'));

-- Sin policy de INSERT para authenticated: solo escriben los triggers
-- SECURITY DEFINER (bypassean RLS como owner) y el backend con
-- service_role (bypass total). Así nadie puede forjar filas a mano.
drop policy if exists "auditoria inserta sistema" on audit_log;
revoke insert on audit_log from anon, authenticated;

-- Anti UPDATE/DELETE a nivel SQL: cualquier intento falla.
create or replace function public.audit_no_mod()
returns trigger
language plpgsql as $$
begin
  raise exception 'audit_log es append-only: % no permitido', TG_OP;
  return null;
end $$;

drop trigger if exists audit_sin_update on audit_log;
create trigger audit_sin_update
  before update or delete on audit_log
  for each row execute function public.audit_no_mod();

revoke update, delete on audit_log from anon, authenticated;

-- Trigger genérico: registra INSERT/UPDATE/DELETE de tablas de negocio.
create or replace function public.audit_registrar()
returns trigger
language plpgsql
security definer
set search_path = public as $$
declare
  v_diff jsonb;
begin
  if TG_OP = 'INSERT' then
    v_diff := jsonb_build_object('nuevo', to_jsonb(NEW));
  elsif TG_OP = 'DELETE' then
    v_diff := jsonb_build_object('anterior', to_jsonb(OLD));
  else
    v_diff := jsonb_build_object('anterior', to_jsonb(OLD), 'nuevo', to_jsonb(NEW));
  end if;
  insert into public.audit_log (actor_id, modulo, accion, entidad, entidad_id, diff)
  values (auth.uid(), TG_TABLE_NAME, TG_OP, TG_TABLE_NAME,
          coalesce((to_jsonb(coalesce(NEW, OLD)) ->> 'id'), ''), v_diff);
  return coalesce(NEW, OLD);
end $$;

-- Adjunta auditoría a tablas de negocio (idempotente).
drop trigger if exists aud_productos on productos;
create trigger aud_productos after insert or update or delete on productos
  for each row execute function public.audit_registrar();
drop trigger if exists aud_ordenes on ordenes;
create trigger aud_ordenes after insert or update or delete on ordenes
  for each row execute function public.audit_registrar();

-- Lectura staff de pedidos para el panel (el cliente sigue viendo solo
-- lo propio por "ordenes propias"; el backend usa service_role y no
-- depende de estas policies).
drop policy if exists "ordenes lectura staff" on ordenes;
create policy "ordenes lectura staff" on ordenes
  for select to authenticated using (public.has_permission('pedidos', 'leer'));
drop policy if exists "items lectura staff" on orden_items;
create policy "items lectura staff" on orden_items
  for select to authenticated using (public.has_permission('pedidos', 'leer'));

-- ============ 3. PAPELERA (deleted_at / deleted_by) ============
alter table productos
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users (id) on delete set null;
create index if not exists idx_productos_papelera on productos (deleted_at)
  where deleted_at is not null;

-- Purga 30 días: borra lo no referenciado; si tiene pedidos, archiva (activo=false).
create or replace function public.purga_papelera()
returns table (eliminados int, archivados int)
language plpgsql
security definer
set search_path = public as $$
declare
  v_elim int := 0; v_arch int := 0; v_tmp int := 0;
begin
  -- Con pedidos referenciados → archivar, no borrar.
  update public.productos p
  set activo = false
  where p.deleted_at is not null
    and p.deleted_at < now() - interval '30 days'
    and p.activo is distinct from false
    and exists (select 1 from public.orden_items oi where oi.producto_id = p.id);
  get diagnostics v_arch = row_count;

  -- Sin referencias → borrar definitivo.
  delete from public.productos p
  where p.deleted_at is not null
    and p.deleted_at < now() - interval '30 days'
    and not exists (select 1 from public.orden_items oi where oi.producto_id = p.id);
  get diagnostics v_elim = row_count;

  -- Banners y cupones en papelera > 30 días no tienen referencias a
  -- pedidos: borrado definitivo (suma al contador de eliminados).
  delete from public.banners b
  where b.deleted_at is not null
    and b.deleted_at < now() - interval '30 days';
  get diagnostics v_tmp = row_count;
  v_elim := v_elim + v_tmp;

  delete from public.cupones c
  where c.deleted_at is not null
    and c.deleted_at < now() - interval '30 days';
  get diagnostics v_tmp = row_count;
  v_elim := v_elim + v_tmp;

  eliminados := v_elim; archivados := v_arch; return next;
end $$;

-- ============ 3b. LOTES DE PRODUCTO ============
-- Trazabilidad de ingresos por lote (el panel los consume en
-- GET/POST /api/admin/productos/{id}/lotes).
create table if not exists producto_lotes (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos (id) on delete cascade,
  codigo_lote text not null default '',
  cantidad integer not null default 0 check (cantidad >= 0),
  vence_at date,
  created_at timestamptz not null default now(),
  unique (producto_id, codigo_lote)
);
create index if not exists idx_lotes_producto on producto_lotes (producto_id);

alter table producto_lotes enable row level security;
drop policy if exists "lotes lectura staff" on producto_lotes;
create policy "lotes lectura staff" on producto_lotes
  for select to authenticated using (public.has_permission('productos', 'leer'));
drop policy if exists "lotes escribe staff" on producto_lotes;
create policy "lotes escribe staff" on producto_lotes
  for all to authenticated
  using (public.has_permission('productos', 'editar'))
  with check (public.has_permission('productos', 'editar'));

drop trigger if exists aud_lotes on producto_lotes;
create trigger aud_lotes after insert or update or delete on producto_lotes
  for each row execute function public.audit_registrar();

-- ============ 4. NOTIFICACIONES (dedupe_key) ============
create table if not exists notificaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  titulo text not null default '',
  mensaje text not null default '',
  leida boolean not null default false,
  dedupe_key text unique,
  created_at timestamptz not null default now()
);
create index if not exists idx_notif_user on notificaciones (user_id, created_at desc);

alter table notificaciones enable row level security;
drop policy if exists "notificaciones propias" on notificaciones;
create policy "notificaciones propias" on notificaciones
  for select to authenticated using (
    user_id = auth.uid() or public.has_permission('notificaciones', 'leer'));
drop policy if exists "notificaciones inserta staff" on notificaciones;
create policy "notificaciones inserta staff" on notificaciones
  for insert to authenticated with check (public.has_permission('notificaciones', 'leer'));

-- Inserción idempotente por dedupe_key.
create or replace function public.notificar(p_user uuid, p_titulo text, p_mensaje text, p_dedupe text default null)
returns uuid
language plpgsql
security definer
set search_path = public as $$
declare v_id uuid;
begin
  insert into public.notificaciones (user_id, titulo, mensaje, dedupe_key)
  values (p_user, p_titulo, p_mensaje, p_dedupe)
  on conflict (dedupe_key) do nothing
  returning id into v_id;
  return v_id;
end $$;

-- ============ 5. BÚSQUEDA FULL-TEXT (unaccent + pg_trgm) ============
alter table productos
  add column if not exists busqueda tsvector
  generated always as (
    to_tsvector('spanish',
      public.f_unaccent(coalesce(nombre,'') || ' ' || coalesce(descripcion,'') || ' ' ||
               coalesce(marca,'') || ' ' || coalesce(categoria,'')))
  ) stored;
create index if not exists idx_productos_busqueda on productos using gin (busqueda);
create index if not exists idx_productos_marca_trgm on productos using gin (marca gin_trgm_ops);
-- idx_productos_nombre_trgm ya existe desde 004.

-- RPC de búsqueda: respeta papelera (excluye borrados) y límite.
create or replace function public.buscar_productos(q text, limite int default 20)
returns setof productos
language sql
stable
security definer
set search_path = public as $$
  select *
  from public.productos p
  where p.deleted_at is null
    and (
      p.busqueda @@ plainto_tsquery('spanish', public.f_unaccent(coalesce(q, '')))
      or p.nombre % coalesce(q, '')
      or p.nombre ilike '%' || coalesce(q, '') || '%'
    )
  order by similarity(p.nombre, coalesce(q, '')) desc
  limit greatest(1, least(coalesce(limite, 20), 50));
$$;

grant execute on function public.buscar_productos(text, int) to anon, authenticated;

-- ============ 6. CUPONES ATÓMICOS (montos en centavos) ============
create table if not exists cupones (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  tipo text not null check (tipo in ('porcentaje', 'monto')),
  valor integer not null check (valor > 0),
  min_compra_centavos integer not null default 0 check (min_compra_centavos >= 0),
  usos_max integer check (usos_max is null or usos_max > 0),
  usos integer not null default 0 check (usos >= 0),
  activo boolean not null default true,
  vence_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table cupones enable row level security;
drop policy if exists "cupones lectura staff" on cupones;
create policy "cupones lectura staff" on cupones
  for select to authenticated using (public.has_permission('cupones', 'leer'));
drop policy if exists "cupones escribe staff" on cupones;
create policy "cupones escribe staff" on cupones
  for all to authenticated
  using (public.has_permission('cupones', 'crear'))
  with check (public.has_permission('cupones', 'crear'));

-- Canje atómico: valida y suma uso en una sola transacción con bloqueo de fila.
-- Devuelve descuento en centavos. Falla con exception si no aplica.
create or replace function public.aplicar_cupon(p_codigo text, p_subtotal_centavos int)
returns int
language plpgsql
security definer
set search_path = public as $$
declare v cupones%rowtype; v_desc int;
begin
  if p_subtotal_centavos is null or p_subtotal_centavos < 0 then
    raise exception 'subtotal inválido';
  end if;
  select * into v from public.cupones
  where codigo = p_codigo for update;
  if not found then raise exception 'cupón inexistente'; end if;
  if not v.activo or v.deleted_at is not null then raise exception 'cupón inactivo'; end if;
  if v.vence_at is not null and v.vence_at < now() then raise exception 'cupón vencido'; end if;
  if v.usos_max is not null and v.usos >= v.usos_max then raise exception 'cupón agotado'; end if;
  if p_subtotal_centavos < v.min_compra_centavos then raise exception 'no alcanza el mínimo de compra'; end if;

  if v.tipo = 'porcentaje' then
    if v.valor > 100 then raise exception 'porcentaje inválido'; end if;
    v_desc := (p_subtotal_centavos * v.valor) / 100;
  else
    v_desc := least(v.valor, p_subtotal_centavos);
  end if;

  update public.cupones set usos = usos + 1 where id = v.id;
  return v_desc;
end $$;

-- ============ 7. PEDIDOS: máquina de estados + versión + historial ============
alter table ordenes
  add column if not exists version integer not null default 1,
  add column if not exists cupon_codigo text default '',
  add column if not exists descuento_centavos integer not null default 0,
  add column if not exists subtotal_centavos integer not null default 0,
  add column if not exists total_centavos integer not null default 0;

-- Normaliza estados históricos ('pendiente' ya existía en 002).
alter table ordenes drop constraint if exists ordenes_estado_check;
alter table ordenes
  add constraint ordenes_estado_check
  check (estado in ('pendiente','pagada','preparacion','enviada','entregada','cancelada','reembolsada'));

create table if not exists pedido_history (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references ordenes (id) on delete cascade,
  de text not null default '',
  a text not null default '',
  nota text not null default '',
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_pedido_history_orden on pedido_history (orden_id, created_at);

alter table pedido_history enable row level security;
drop policy if exists "historial lectura staff" on pedido_history;
create policy "historial lectura staff" on pedido_history
  for select to authenticated using (public.has_permission('pedidos', 'leer'));

-- Transiciones permitidas.
create or replace function public.pedido_transicion_ok(de text, a text)
returns boolean
language sql immutable as $$
  select case
    when de = a then false
    when de = 'pendiente'    and a in ('pagada','cancelada') then true
    when de = 'pagada'       and a in ('preparacion','cancelada','reembolsada') then true
    when de = 'preparacion'  and a in ('enviada','cancelada') then true
    when de = 'enviada'      and a in ('entregada') then true
    when de = 'entregada'    and a in ('reembolsada') then true
    else false
  end;
$$;

-- Cambio de estado con bloqueo optimista (version). Falla si version no coincide.
create or replace function public.cambiar_estado_pedido(p_id uuid, p_a text, p_nota text default '', p_version int default null)
returns int
language plpgsql
security definer
set search_path = public as $$
declare v_estado text; v_ver int; v_user uuid;
begin
  select estado, version, user_id into v_estado, v_ver, v_user
  from public.ordenes where id = p_id for update;
  if not found then raise exception 'pedido inexistente'; end if;
  if p_version is not null and p_version <> v_ver then
    raise exception 'conflicto de versión: recargá el pedido';
  end if;
  if not public.pedido_transicion_ok(v_estado, p_a) then
    raise exception 'transición inválida: % → %', v_estado, p_a;
  end if;
  update public.ordenes set estado = p_a, version = version + 1 where id = p_id;
  insert into public.pedido_history (orden_id, de, a, nota, actor_id)
  values (p_id, v_estado, p_a, coalesce(p_nota, ''), auth.uid());
  perform public.notificar(v_user, 'Tu pedido cambió a ' || p_a,
    'Pedido ' || p_id::text || ': ' || v_estado || ' → ' || p_a,
    'pedido:' || p_id::text || ':' || p_a);
  return v_ver + 1;
end $$;

drop trigger if exists aud_pedido_history on pedido_history;
create trigger aud_pedido_history after insert on pedido_history
  for each row execute function public.audit_registrar();

-- ============ 8. ENVÍOS (shipments) ============
create table if not exists envios (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references ordenes (id) on delete cascade,
  operador text not null default '',
  tracking text not null default '',
  estado text not null default 'pendiente'
    check (estado in ('pendiente','despachado','en_camino','entregado','devuelto')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_envios_orden on envios (orden_id);

alter table envios enable row level security;
drop policy if exists "envios lectura staff" on envios;
create policy "envios lectura staff" on envios
  for select to authenticated using (public.has_permission('pedidos', 'leer'));
drop policy if exists "envios escribe staff" on envios;
create policy "envios escribe staff" on envios
  for all to authenticated
  using (public.has_permission('pedidos', 'cambiar_estado'))
  with check (public.has_permission('pedidos', 'cambiar_estado'));

drop trigger if exists aud_envios on envios;
create trigger aud_envios after insert or update or delete on envios
  for each row execute function public.audit_registrar();

-- ============ 9. RECLAMOS ============
create table if not exists reclamos (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid references ordenes (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  motivo text not null default '',
  detalle text not null default '',
  estado text not null default 'abierto'
    check (estado in ('abierto','en_revision','resuelto','rechazado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_reclamos_orden on reclamos (orden_id);
create index if not exists idx_reclamos_estado on reclamos (estado);

alter table reclamos enable row level security;
drop policy if exists "reclamos propio o staff" on reclamos;
create policy "reclamos propio o staff" on reclamos
  for select to authenticated using (
    user_id = auth.uid() or public.has_permission('reclamos', 'leer'));
drop policy if exists "reclamos crea usuario" on reclamos;
create policy "reclamos crea usuario" on reclamos
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "reclamos edita staff" on reclamos;
create policy "reclamos edita staff" on reclamos
  for update to authenticated using (public.has_permission('reclamos', 'editar'));

drop trigger if exists aud_reclamos on reclamos;
create trigger aud_reclamos after insert or update or delete on reclamos
  for each row execute function public.audit_registrar();

-- ============ 10. STOCK TRANSACCIONAL (sin negativo) ============
alter table movimientos_stock
  add column if not exists actor_id uuid references auth.users (id) on delete set null,
  add column if not exists nota text not null default '';

-- Ajuste atómico: bloquea producto, impide stock negativo, registra movimiento.
create or replace function public.adjust_stock(p_producto uuid, p_delta int, p_motivo text default 'ajuste', p_nota text default '')
returns int
language plpgsql
security definer
set search_path = public as $$
declare v_nuevo int;
begin
  if p_delta = 0 then raise exception 'delta no puede ser cero'; end if;
  update public.productos set stock = stock + p_delta
  where id = p_producto and deleted_at is null
  returning stock into v_nuevo;
  if not found then raise exception 'producto inexistente o en papelera'; end if;
  if v_nuevo < 0 then raise exception 'stock insuficiente'; end if;
  insert into public.movimientos_stock (producto_id, tipo, cantidad, motivo, actor_id, nota)
  values (p_producto, 'ajuste', abs(p_delta), coalesce(p_motivo, 'ajuste'), auth.uid(), coalesce(p_nota, ''));
  return v_nuevo;
end $$;

-- ============ 11. BANNERS + WHATSAPP_CFG (sin seeds productivos) ============
create table if not exists banners (
  id uuid primary key default gen_random_uuid(),
  titulo text not null default '',
  imagen text not null default '',
  link text not null default '',
  orden integer not null default 0,
  activo boolean not null default true,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table banners enable row level security;
drop policy if exists "banners lectura publica" on banners;
create policy "banners lectura publica" on banners
  for select using (activo and deleted_at is null);
drop policy if exists "banners escribe staff" on banners;
create policy "banners escribe staff" on banners
  for all to authenticated
  using (public.has_permission('banners', 'crear'))
  with check (public.has_permission('banners', 'crear'));

drop trigger if exists aud_banners on banners;
create trigger aud_banners after insert or update or delete on banners
  for each row execute function public.audit_registrar();

-- Config WhatsApp como clave/valor. Sin seeds: el dueño la carga por panel.
create table if not exists whatsapp_cfg (
  clave text primary key,
  valor text not null default '',
  updated_at timestamptz not null default now()
);

alter table whatsapp_cfg enable row level security;
drop policy if exists "whatsapp lectura staff" on whatsapp_cfg;
create policy "whatsapp lectura staff" on whatsapp_cfg
  for select to authenticated using (public.has_permission('config', 'leer'));
drop policy if exists "whatsapp escribe owner" on whatsapp_cfg;
create policy "whatsapp escribe owner" on whatsapp_cfg
  for all to authenticated
  using (public.has_permission('config', 'gestionar'))
  with check (public.has_permission('config', 'gestionar'));

-- Audita también cupones.
drop trigger if exists aud_cupones on cupones;
create trigger aud_cupones after insert or update or delete on cupones
  for each row execute function public.audit_registrar();

-- ============ VERIFICACIÓN (solo lectura) ============
-- select rol, count(*) from admin_permisos group by 1 order by 1;
-- select has_permission('productos','leer');  -- false sin sesión staff (esperado)
-- select * from purga_papelera();            -- 0,0 en base sin papelera (esperado)
-- select pedido_transicion_ok('pendiente','pagada');   -- true (esperado)
-- select pedido_transicion_ok('entregada','pendiente'); -- false (esperado)
