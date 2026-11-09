-- Verificación de la migración 022 (solo lectura).
-- Pegar en el SQL Editor después de aplicar 022.
--
-- Esperado:
--   1) la primera consulta no devuelve filas (nadie de anon/authenticated
--      puede ejecutar las RPC internas);
--   2) la segunda devuelve 0 (no queda policy de INSERT en notificaciones);
--   3) la tercera devuelve solo las versiones de 5 argumentos.

-- 1) RPC internas que todavía puede ejecutar la clave pública.
with internas(nombre) as (
  values
    ('adjust_stock'), ('aplicar_cupon'), ('cambiar_estado_pedido'),
    ('confirmar_pago_tx'), ('emitir_comprobante_tx'), ('liberar_reserva_tx'),
    ('reservar_stock_tx'), ('notificar'), ('purga_papelera'),
    ('siguiente_numero_comprobante'), ('recibir_orden_compra')
)
select p.proname as funcion,
       pg_get_function_identity_arguments(p.oid) as argumentos,
       has_function_privilege('anon', p.oid, 'execute') as anon_puede,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_puede
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join internas i on i.nombre = p.proname
where n.nspname = 'public'
  and (
    has_function_privilege('anon', p.oid, 'execute')
    or has_function_privilege('authenticated', p.oid, 'execute')
  )
order by 1, 2;

-- 2) Policy de INSERT en notificaciones (debe ser 0).
select count(*) as policies_insert
from pg_policy
where polrelid = 'public.notificaciones'::regclass
  and polcmd = 'a';

-- 3) Overloads vigentes (deben quedar solo los de 5 argumentos).
select p.proname as funcion,
       pg_get_function_identity_arguments(p.oid) as argumentos
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('adjust_stock', 'cambiar_estado_pedido')
order by 1, 2;
