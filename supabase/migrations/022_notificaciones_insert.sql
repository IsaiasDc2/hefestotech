-- 022 · Cerrar SEC-02 y las RPC internas expuestas
--
-- 1) Notificaciones (SEC-02): la policy de 005 permitía a cualquier usuario
--    con permiso 'notificaciones:leer' insertar avisos con cualquier user_id
--    (o null, que ve todo el staff). Habilitaba avisos falsos o phishing
--    dentro del panel. El frontend nunca inserta: la bandeja solo lee y el
--    backend escribe con service_role. Los avisos legítimos también salen de
--    public.notificar(), que es SECURITY DEFINER y no depende de la policy.
--
-- 2) Funciones internas: Postgres concede EXECUTE a PUBLIC por defecto, así
--    que la clave publicable de Supabase podía llamar RPC de negocio. Se
--    comprobó sin efectos que `adjust_stock` y `aplicar_cupon` respondían a
--    `anon`. Con eso cualquiera podía cambiar stock, quemar cupones, cambiar
--    estados de pedidos o disparar la purga de la papelera.
--
--    Se revoca a public/anon/authenticated y se deja solo service_role (el
--    backend). No se tocan las funciones que el cliente sí necesita:
--    is_admin(), has_permission(), buscar_productos() y
--    pedido_transicion_ok().
--
--    El bloque salta las firmas que no existan (por ejemplo, en bases donde
--    la 004 no dejó las funciones transaccionales) para poder aplicarse en
--    cualquier entorno sin abortar.
--
-- 3) Overloads viejos: adjust_stock y cambiar_estado_pedido tenían versiones
--    de 4 argumentos que el backend ya no usa y volvían ambigua la
--    resolución de PostgREST (PGRST203). Se eliminan.
--
-- Idempotente. Ejecutar en el SQL Editor del Dashboard o con psql.
-- Verificación posterior: supabase/verificar_privilegios.sql

begin;

-- SEC-02: nadie inserta notificaciones directo; solo service_role/notificar().
drop policy if exists "notificaciones inserta staff" on public.notificaciones;

-- Overloads de 4 argumentos: sin uso y ambiguos.
drop function if exists public.adjust_stock(uuid, integer, text, text);
drop function if exists public.cambiar_estado_pedido(uuid, text, text, integer);

-- RPC internas: solo el backend (service_role).
do $$
declare
  firma text;
begin
  foreach firma in array array[
    'public.adjust_stock(uuid, integer, text, text, uuid)',
    'public.aplicar_cupon(text, integer)',
    'public.cambiar_estado_pedido(uuid, text, text, integer, uuid)',
    'public.confirmar_pago_tx(uuid, text)',
    'public.emitir_comprobante_tx(uuid)',
    'public.liberar_reserva_tx(uuid)',
    'public.reservar_stock_tx(uuid)',
    'public.notificar(uuid, text, text, text)',
    'public.purga_papelera()',
    'public.siguiente_numero_comprobante()',
    'public.recibir_orden_compra(uuid, jsonb, text, uuid, boolean)'
  ]
  loop
    if to_regprocedure(firma) is not null then
      execute format(
        'revoke execute on function %s from public, anon, authenticated', firma);
      execute format('grant execute on function %s to service_role', firma);
    end if;
  end loop;
end $$;

commit;
