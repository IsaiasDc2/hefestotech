-- HefestoTech · 005_product_specs.sql
-- Tabla curada de especificaciones normalizadas para el Armador.
-- Requiere 001 aplicada (independiente de 002/003/004). Pegar en Supabase
-- Dashboard → SQL Editor → Run, después de 004_checkout_real.sql.
--
-- POR QUÉ EXISTE: el motor del Armador (ecomers/client/src/armador/motor.js)
-- trabaja con campos normalizados (socket, tdpW, longitudMm, etc.) y NO lee
-- `productos.especificaciones` (JSONB libre, con claves inconsistentes).
-- Esta tabla es el puente: cada fila es UN dato verificado (o inferido y
-- pendiente de verificación) que el front mapea al formato del motor.
--
-- FLUJO: carga manual o inferida (source) → verified = false →
-- alguien del equipo la confirma → verified = true.
-- El motor solo debería consumir filas verified = true.

create table if not exists product_specs (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos (id) on delete cascade,
  -- Clave normalizada que entiende el motor. Ejemplos por categoría:
  --   CPU: socket, tdpW, tieneIGPU
  --   Mother: socket, memoriaTipo, ranurasRAM, memoriaMaximaGB, formato,
  --           puertosM2, puertosSata, chipset
  --   RAM: tipo, formatoModulo, capacidadGB, modulos
  --   GPU: longitudMm, consumoW, fuenteRecomendadaW, conectores8pin, requiere12VHPWR
  --   Cooler: tipo, sockets (json array), alturaMm, radiadorMm, tdpMaximoW
  --   Almacenamiento: tipo (NVMe|SATA)
  --   Fuente: potenciaW, tiene12VHPWR, conectores8pin, formato
  --   Gabinete: formatosMother (json array), maxGpuMm, maxCoolerMm,
  --              radiadorMaxMm, formatosFuente (json array)
  clave text not null,
  valor jsonb not null default '"null"',
  source text not null default 'manual'
    check (source in ('manual', 'inferred')),
  verified boolean not null default false,
  created_at timestamptz default now(),
  unique (producto_id, clave)
);
create index if not exists idx_product_specs_producto on product_specs (producto_id);
create index if not exists idx_product_specs_pending
  on product_specs (verified, source) where not verified;

-- ============ RLS (igual que productos) ============
alter table product_specs enable row level security;

drop policy if exists "lectura publica" on product_specs;
create policy "lectura publica" on product_specs for select using (true);

drop policy if exists "escritura autenticados" on product_specs;
create policy "escritura autenticados" on product_specs
  for all to authenticated using (true) with check (true);

comment on table product_specs is
  'Specs normalizadas por producto para el motor del Armador. source=manual|inferred, verified=false hasta revisión humana.';
comment on column product_specs.source is
  'manual: cargado por una persona. inferred: extraído del nombre/ficha, pendiente de verificación.';
comment on column product_specs.verified is
  'Solo las filas verified=true alimentan al motor. Jamás se asume compatible por defecto.';

-- ============ VERIFICACIÓN ============
-- Debe devolver las filas que inserte la carga inicial (0 recién creada).
-- select source, verified, count(*) from product_specs group by 1, 2;
--
-- Pendientes de verificación (cola de trabajo del dueño):
-- select p.nombre, s.clave, s.valor
-- from product_specs s join productos p on p.id = s.producto_id
-- where not s.verified order by p.nombre, s.clave;
