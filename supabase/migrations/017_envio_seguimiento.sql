-- HefestoTech · 017_envio_seguimiento.sql
-- Seguimiento de envío por pedido: transportista, código y enlace de rastreo.
-- Aditiva e idempotente. El backend funciona sin esta migración (el panel avisa
-- que falta aplicarla al intentar cargar un seguimiento).
--
-- Revertir:
--   alter table ordenes drop column if exists transportista;
--   alter table ordenes drop column if exists tracking_codigo;
--   alter table ordenes drop column if exists tracking_url;
--   alter table ordenes drop column if exists enviado_at;

alter table ordenes add column if not exists transportista text;
alter table ordenes add column if not exists tracking_codigo text;
alter table ordenes add column if not exists tracking_url text;
alter table ordenes add column if not exists enviado_at timestamptz;

alter table ordenes drop constraint if exists ordenes_tracking_largos_check;
alter table ordenes add constraint ordenes_tracking_largos_check
  check (
    char_length(coalesce(transportista, '')) <= 60
    and char_length(coalesce(tracking_codigo, '')) <= 80
    and char_length(coalesce(tracking_url, '')) <= 500
  ) not valid;
