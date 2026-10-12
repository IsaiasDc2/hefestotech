-- HefestoTech · 008_mensajes_reclamos: hilo interno de cada reclamo.
-- Sin mensajes no hay hilos inventados: la bandeja muestra el detalle del
-- reclamo como contexto y solo lista mensajes reales de esta tabla.
-- El envío por WhatsApp sigue siendo manual (wa.me, Nivel 1): nada se manda solo.

create table if not exists reclamo_mensajes (
  id uuid primary key default gen_random_uuid(),
  reclamo_id uuid not null references reclamos (id) on delete cascade,
  autor text not null default 'staff'
    check (autor in ('cliente', 'staff', 'sistema')),
  texto text not null default ''
    check (char_length(texto) > 0 and char_length(texto) <= 2000),
  created_at timestamptz not null default now()
);
create index if not exists idx_reclamo_mensajes_reclamo on reclamo_mensajes (reclamo_id, created_at);

alter table reclamo_mensajes enable row level security;

-- Lectura: staff con permiso de reclamos, o el cliente dueño del reclamo.
drop policy if exists "mensajes lectura staff o duenio" on reclamo_mensajes;
create policy "mensajes lectura staff o duenio" on reclamo_mensajes
  for select to authenticated using (
    public.has_permission('reclamos', 'leer')
    or exists (
      select 1 from public.reclamos r
      where r.id = reclamo_mensajes.reclamo_id
        and r.user_id = auth.uid()
    ));

-- Alta: staff (nota interna) o el cliente dueño de su propio reclamo.
drop policy if exists "mensajes alta staff o duenio" on reclamo_mensajes;
create policy "mensajes alta staff o duenio" on reclamo_mensajes
  for insert to authenticated with check (
    public.has_permission('reclamos', 'crear')
    or exists (
      select 1 from public.reclamos r
      where r.id = reclamo_mensajes.reclamo_id
        and r.user_id = auth.uid()
    ));

-- Edición/borrado: solo staff (las notas internas se corrigen, no se forjan).
drop policy if exists "mensajes edita staff" on reclamo_mensajes;
create policy "mensajes edita staff" on reclamo_mensajes
  for update to authenticated using (public.has_permission('reclamos', 'editar'));
drop policy if exists "mensajes borra staff" on reclamo_mensajes;
create policy "mensajes borra staff" on reclamo_mensajes
  for delete to authenticated using (public.has_permission('reclamos', 'editar'));

-- Auditoría igual que reclamos (005): append-only vía audit_registrar().
drop trigger if exists aud_reclamo_mensajes on reclamo_mensajes;
create trigger aud_reclamo_mensajes after insert or update or delete on reclamo_mensajes
  for each row execute function public.audit_registrar();
