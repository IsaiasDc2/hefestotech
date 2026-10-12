-- HefestoTech · 006_specs_iniciales.sql
-- Carga inicial INFERIDA de product_specs (requiere 005).
-- Generado por scripts/inferir-specs.py desde 001_productos.sql.
-- Todo entra con source='inferred', verified=false: el duenio debe
-- confirmar cada fila antes de que el motor la consuma.
-- Idempotente: ON CONFLICT (producto_id, clave) DO NOTHING.

insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'alturaMm', '159'::jsonb, 'inferred', false from productos
where nombre = 'Cooler Master Hyper 212 Black Edition'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'sockets', '["AM5", "AM4", "LGA1700", "LGA1200"]'::jsonb, 'inferred', false from productos
where nombre = 'Cooler Master Hyper 212 Black Edition'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tdpMaximoW', '150'::jsonb, 'inferred', false from productos
where nombre = 'Cooler Master Hyper 212 Black Edition'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tipo', '"aire"'::jsonb, 'inferred', false from productos
where nombre = 'Cooler Master Hyper 212 Black Edition'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'capacidadGB', '32'::jsonb, 'inferred', false from productos
where nombre = 'Corsair Dominator Platinum 64GB DDR5'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'formatoModulo', '"DIMM"'::jsonb, 'inferred', false from productos
where nombre = 'Corsair Dominator Platinum 64GB DDR5'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'modulos', '2'::jsonb, 'inferred', false from productos
where nombre = 'Corsair Dominator Platinum 64GB DDR5'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tipo', '"DDR5"'::jsonb, 'inferred', false from productos
where nombre = 'Corsair Dominator Platinum 64GB DDR5'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'capacidadGB', '8'::jsonb, 'inferred', false from productos
where nombre = 'Corsair Vengeance 16GB DDR4'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'formatoModulo', '"DIMM"'::jsonb, 'inferred', false from productos
where nombre = 'Corsair Vengeance 16GB DDR4'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'modulos', '2'::jsonb, 'inferred', false from productos
where nombre = 'Corsair Vengeance 16GB DDR4'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tipo', '"DDR4"'::jsonb, 'inferred', false from productos
where nombre = 'Corsair Vengeance 16GB DDR4'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tipo', '"NVMe"'::jsonb, 'inferred', false from productos
where nombre = 'Crucial P3 Plus 4TB NVMe'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'potenciaW', '850'::jsonb, 'inferred', false from productos
where nombre = 'Fuente Corsair RM850 850W 80 Plus Gold'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tiene12VHPWR', 'true'::jsonb, 'inferred', false from productos
where nombre = 'Fuente Corsair RM850 850W 80 Plus Gold'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'potenciaW', '650'::jsonb, 'inferred', false from productos
where nombre = 'Fuente EVGA 650W 80 Plus Bronze'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'potenciaW', '750'::jsonb, 'inferred', false from productos
where nombre = 'Fuente Seasonic Focus GX-750 80 Plus Gold'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'capacidadGB', '16'::jsonb, 'inferred', false from productos
where nombre = 'G.Skill Trident Z5 32GB DDR5'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'formatoModulo', '"DIMM"'::jsonb, 'inferred', false from productos
where nombre = 'G.Skill Trident Z5 32GB DDR5'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'modulos', '2'::jsonb, 'inferred', false from productos
where nombre = 'G.Skill Trident Z5 32GB DDR5'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tipo', '"DDR5"'::jsonb, 'inferred', false from productos
where nombre = 'G.Skill Trident Z5 32GB DDR5'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'formatosMother', '["Micro-ATX", "Mini-ITX"]'::jsonb, 'inferred', false from productos
where nombre = 'Gabinete Cooler Master MasterBox Q300L'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'radiadorMaxMm', '240'::jsonb, 'inferred', false from productos
where nombre = 'Gabinete Cooler Master MasterBox Q300L'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'formatosMother', '["ATX", "Micro-ATX", "Mini-ITX", "E-ATX"]'::jsonb, 'inferred', false from productos
where nombre = 'Gabinete Lian Li O11 Dynamic EVO'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'radiadorMaxMm', '360'::jsonb, 'inferred', false from productos
where nombre = 'Gabinete Lian Li O11 Dynamic EVO'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'formatosMother', '["ATX", "Micro-ATX", "Mini-ITX"]'::jsonb, 'inferred', false from productos
where nombre = 'Gabinete NZXT H7 Flow'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'radiadorMaxMm', '360'::jsonb, 'inferred', false from productos
where nombre = 'Gabinete NZXT H7 Flow'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'socket', '"LGA1700"'::jsonb, 'inferred', false from productos
where nombre = 'Intel Core i5 14600K'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tdpW', '125'::jsonb, 'inferred', false from productos
where nombre = 'Intel Core i5 14600K'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'socket', '"LGA1700"'::jsonb, 'inferred', false from productos
where nombre = 'Intel Core i7 14700K'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tdpW', '125'::jsonb, 'inferred', false from productos
where nombre = 'Intel Core i7 14700K'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'capacidadGB', '16'::jsonb, 'inferred', false from productos
where nombre = 'Kingston Fury Beast 32GB DDR5 6000MHz'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'formatoModulo', '"DIMM"'::jsonb, 'inferred', false from productos
where nombre = 'Kingston Fury Beast 32GB DDR5 6000MHz'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'modulos', '2'::jsonb, 'inferred', false from productos
where nombre = 'Kingston Fury Beast 32GB DDR5 6000MHz'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tipo', '"DDR5"'::jsonb, 'inferred', false from productos
where nombre = 'Kingston Fury Beast 32GB DDR5 6000MHz'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tipo', '"NVMe"'::jsonb, 'inferred', false from productos
where nombre = 'Kingston NV2 500GB NVMe'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'chipset', '"B650"'::jsonb, 'inferred', false from productos
where nombre = 'Motherboard ASUS TUF B650-PLUS'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'formato', '"ATX"'::jsonb, 'inferred', false from productos
where nombre = 'Motherboard ASUS TUF B650-PLUS'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'memoriaMaximaGB', '128'::jsonb, 'inferred', false from productos
where nombre = 'Motherboard ASUS TUF B650-PLUS'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'memoriaTipo', '"DDR5"'::jsonb, 'inferred', false from productos
where nombre = 'Motherboard ASUS TUF B650-PLUS'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'puertosM2', '2'::jsonb, 'inferred', false from productos
where nombre = 'Motherboard ASUS TUF B650-PLUS'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'ranurasRAM', '4'::jsonb, 'inferred', false from productos
where nombre = 'Motherboard ASUS TUF B650-PLUS'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'socket', '"AM5"'::jsonb, 'inferred', false from productos
where nombre = 'Motherboard ASUS TUF B650-PLUS'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'chipset', '"X670E"'::jsonb, 'inferred', false from productos
where nombre = 'Motherboard Gigabyte X670E AORUS Master'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'formato', '"ATX"'::jsonb, 'inferred', false from productos
where nombre = 'Motherboard Gigabyte X670E AORUS Master'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'memoriaMaximaGB', '128'::jsonb, 'inferred', false from productos
where nombre = 'Motherboard Gigabyte X670E AORUS Master'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'memoriaTipo', '"DDR5"'::jsonb, 'inferred', false from productos
where nombre = 'Motherboard Gigabyte X670E AORUS Master'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'puertosM2', '4'::jsonb, 'inferred', false from productos
where nombre = 'Motherboard Gigabyte X670E AORUS Master'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'ranurasRAM', '4'::jsonb, 'inferred', false from productos
where nombre = 'Motherboard Gigabyte X670E AORUS Master'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'socket', '"AM5"'::jsonb, 'inferred', false from productos
where nombre = 'Motherboard Gigabyte X670E AORUS Master'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'chipset', '"B760"'::jsonb, 'inferred', false from productos
where nombre = 'Motherboard MSI PRO B760M-A'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'formato', '"Micro-ATX"'::jsonb, 'inferred', false from productos
where nombre = 'Motherboard MSI PRO B760M-A'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'memoriaMaximaGB', '128'::jsonb, 'inferred', false from productos
where nombre = 'Motherboard MSI PRO B760M-A'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'memoriaTipo', '"DDR5"'::jsonb, 'inferred', false from productos
where nombre = 'Motherboard MSI PRO B760M-A'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'puertosM2', '2'::jsonb, 'inferred', false from productos
where nombre = 'Motherboard MSI PRO B760M-A'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'ranurasRAM', '4'::jsonb, 'inferred', false from productos
where nombre = 'Motherboard MSI PRO B760M-A'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'socket', '"LGA1700"'::jsonb, 'inferred', false from productos
where nombre = 'Motherboard MSI PRO B760M-A'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'radiadorMm', '280'::jsonb, 'inferred', false from productos
where nombre = 'NZXT Kraken 280mm AIO RGB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'sockets', '["AM5", "AM4", "LGA1700", "LGA1200"]'::jsonb, 'inferred', false from productos
where nombre = 'NZXT Kraken 280mm AIO RGB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tdpMaximoW', '280'::jsonb, 'inferred', false from productos
where nombre = 'NZXT Kraken 280mm AIO RGB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tipo', '"liquido"'::jsonb, 'inferred', false from productos
where nombre = 'NZXT Kraken 280mm AIO RGB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'conectores8pin', '1'::jsonb, 'inferred', false from productos
where nombre = 'RTX 4060 Ti 16GB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'consumoW', '165'::jsonb, 'inferred', false from productos
where nombre = 'RTX 4060 Ti 16GB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'fuenteRecomendadaW', '550'::jsonb, 'inferred', false from productos
where nombre = 'RTX 4060 Ti 16GB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'longitudMm', '242'::jsonb, 'inferred', false from productos
where nombre = 'RTX 4060 Ti 16GB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'requiere12VHPWR', 'false'::jsonb, 'inferred', false from productos
where nombre = 'RTX 4060 Ti 16GB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'conectores8pin', '0'::jsonb, 'inferred', false from productos
where nombre = 'RTX 4070 SUPER MSI 12GB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'consumoW', '220'::jsonb, 'inferred', false from productos
where nombre = 'RTX 4070 SUPER MSI 12GB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'fuenteRecomendadaW', '650'::jsonb, 'inferred', false from productos
where nombre = 'RTX 4070 SUPER MSI 12GB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'longitudMm', '267'::jsonb, 'inferred', false from productos
where nombre = 'RTX 4070 SUPER MSI 12GB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'requiere12VHPWR', 'true'::jsonb, 'inferred', false from productos
where nombre = 'RTX 4070 SUPER MSI 12GB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'conectores8pin', '0'::jsonb, 'inferred', false from productos
where nombre = 'RTX 4080 SUPER Gigabyte 16GB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'consumoW', '320'::jsonb, 'inferred', false from productos
where nombre = 'RTX 4080 SUPER Gigabyte 16GB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'fuenteRecomendadaW', '850'::jsonb, 'inferred', false from productos
where nombre = 'RTX 4080 SUPER Gigabyte 16GB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'longitudMm', '346'::jsonb, 'inferred', false from productos
where nombre = 'RTX 4080 SUPER Gigabyte 16GB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'requiere12VHPWR', 'true'::jsonb, 'inferred', false from productos
where nombre = 'RTX 4080 SUPER Gigabyte 16GB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'conectores8pin', '0'::jsonb, 'inferred', false from productos
where nombre = 'RTX 4090 ASUS ROG STRIX 24GB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'consumoW', '450'::jsonb, 'inferred', false from productos
where nombre = 'RTX 4090 ASUS ROG STRIX 24GB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'fuenteRecomendadaW', '1000'::jsonb, 'inferred', false from productos
where nombre = 'RTX 4090 ASUS ROG STRIX 24GB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'longitudMm', '357'::jsonb, 'inferred', false from productos
where nombre = 'RTX 4090 ASUS ROG STRIX 24GB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'requiere12VHPWR', 'true'::jsonb, 'inferred', false from productos
where nombre = 'RTX 4090 ASUS ROG STRIX 24GB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'conectores8pin', '2'::jsonb, 'inferred', false from productos
where nombre = 'RX 7800 XT Sapphire 16GB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'consumoW', '263'::jsonb, 'inferred', false from productos
where nombre = 'RX 7800 XT Sapphire 16GB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'fuenteRecomendadaW', '700'::jsonb, 'inferred', false from productos
where nombre = 'RX 7800 XT Sapphire 16GB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'longitudMm', '320'::jsonb, 'inferred', false from productos
where nombre = 'RX 7800 XT Sapphire 16GB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'requiere12VHPWR', 'false'::jsonb, 'inferred', false from productos
where nombre = 'RX 7800 XT Sapphire 16GB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'conectores8pin', '2'::jsonb, 'inferred', false from productos
where nombre = 'RX 7900 XTX XFX 24GB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'consumoW', '355'::jsonb, 'inferred', false from productos
where nombre = 'RX 7900 XTX XFX 24GB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'fuenteRecomendadaW', '850'::jsonb, 'inferred', false from productos
where nombre = 'RX 7900 XTX XFX 24GB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'longitudMm', '344'::jsonb, 'inferred', false from productos
where nombre = 'RX 7900 XTX XFX 24GB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'requiere12VHPWR', 'false'::jsonb, 'inferred', false from productos
where nombre = 'RX 7900 XTX XFX 24GB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'socket', '"AM5"'::jsonb, 'inferred', false from productos
where nombre = 'Ryzen 5 7600'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tdpW', '65'::jsonb, 'inferred', false from productos
where nombre = 'Ryzen 5 7600'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tieneIGPU', 'true'::jsonb, 'inferred', false from productos
where nombre = 'Ryzen 5 7600'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'socket', '"AM5"'::jsonb, 'inferred', false from productos
where nombre = 'Ryzen 5 8600G'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tdpW', '65'::jsonb, 'inferred', false from productos
where nombre = 'Ryzen 5 8600G'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tieneIGPU', 'true'::jsonb, 'inferred', false from productos
where nombre = 'Ryzen 5 8600G'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'socket', '"AM5"'::jsonb, 'inferred', false from productos
where nombre = 'Ryzen 7 7800X3D'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tdpW', '120'::jsonb, 'inferred', false from productos
where nombre = 'Ryzen 7 7800X3D'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tieneIGPU', 'true'::jsonb, 'inferred', false from productos
where nombre = 'Ryzen 7 7800X3D'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'socket', '"AM5"'::jsonb, 'inferred', false from productos
where nombre = 'Ryzen 9 7950X3D'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tdpW', '120'::jsonb, 'inferred', false from productos
where nombre = 'Ryzen 9 7950X3D'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tieneIGPU', 'true'::jsonb, 'inferred', false from productos
where nombre = 'Ryzen 9 7950X3D'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tipo', '"NVMe"'::jsonb, 'inferred', false from productos
where nombre = 'Samsung 990 PRO NVMe 2TB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tipo', '"SATA"'::jsonb, 'inferred', false from productos
where nombre = 'Seagate Barracuda 2TB HDD'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tipo', '"NVMe"'::jsonb, 'inferred', false from productos
where nombre = 'WD Black SN850X 1TB NVMe'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'alturaMm', '163'::jsonb, 'inferred', false from productos
where nombre = 'be quiet! Dark Rock Pro 4'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'sockets', '["AM5", "AM4", "LGA1700", "LGA1200"]'::jsonb, 'inferred', false from productos
where nombre = 'be quiet! Dark Rock Pro 4'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tdpMaximoW', '250'::jsonb, 'inferred', false from productos
where nombre = 'be quiet! Dark Rock Pro 4'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tipo', '"aire"'::jsonb, 'inferred', false from productos
where nombre = 'be quiet! Dark Rock Pro 4'
on conflict (producto_id, clave) do nothing;

-- Verificacion (conteo por estado; todo debe estar en inferred/false):
-- select source, verified, count(*) from product_specs group by 1, 2;
-- Cola del duenio:
-- select p.nombre, s.clave, s.valor from product_specs s
-- join productos p on p.id = s.producto_id
-- where not s.verified order by p.nombre, s.clave;
