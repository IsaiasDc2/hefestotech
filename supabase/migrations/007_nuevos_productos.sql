-- HefestoTech · 007_nuevos_productos.sql
-- Alta de 15 productos nuevos (requiere 001 y 005). Todo inferido/no
-- verificado: precio=0 y stock=0 hasta que el duenio los complete.
-- Idempotente: ON CONFLICT DO NOTHING en productos y product_specs.
--
-- FOTOS: la columna imagen usa la ruta PENDIENTE 'NUEVO/<archivo>' (el
-- archivo esta en ecomers/client/public/productos-optimizados/nuevos/ y
-- el duenio debe subirlo al bucket `productos`). Los 4 productos sin foto
-- (Ryzen 7 9800X3D, Core Ultra 7 265K, B850M-PLUS y SN850X 2TB) llevan
-- imagen='' hasta que el duenio provea la imagen.
--   * B850M-PLUS: su URL oficial devuelve pagina de bloqueo, no imagen
--     (verificado 2026-10-10; ver scripts/procesar-fotos.py).
--
-- SPECS: product_specs solo con claves validas del motor
-- (ecomers/client/src/armador/adaptar.js), source='inferred',
-- verified=false. Monitor y periferico no tienen claves de motor:
-- entran solo en productos.especificaciones (JSONB libre).

-- ============ PRODUCTOS (15) ============
insert into productos
  (codigo, nombre, marca, precio, stock, descripcion, categoria, imagen,
   especificaciones, activo)
values
('HT-0055', 'RTX 5070 ASUS Dual 12GB GDDR7', 'ASUS', 0, 0,
 'Placa de video (precio y stock a confirmar por el duenio).',
 'Placa de video', 'NUEVO/rtx5070-asus-dual-12gb.webp',
 '{"memoria": "12GB GDDR7", "bus": "192-bit", "frecuenciaBoost": "2572MHz", "longitud": "249mm", "conectores": "1x16-pin", "fuenteRecomendada": "750W"}'::jsonb,
 true),
('HT-0056', 'RX 9070 XT ASUS TUF 16GB GDDR6', 'ASUS', 0, 0,
 'Placa de video (precio y stock a confirmar por el duenio).',
 'Placa de video', 'NUEVO/rx9070xt-asus-tuf-16gb.webp',
 '{"memoria": "16GB GDDR6", "bus": "256-bit", "frecuenciaBoost": "3080MHz", "longitud": "330mm", "conectores": "3x8-pin", "fuenteRecomendada": "850W"}'::jsonb,
 true),
('HT-0057', 'Ryzen 7 9800X3D', 'AMD', 0, 0,
 'Procesador (precio y stock a confirmar por el duenio).',
 'Procesador', '',
 '{"socket": "AM5"}'::jsonb,
 true),
('HT-0058', 'Intel Core Ultra 7 265K', 'Intel', 0, 0,
 'Procesador (precio y stock a confirmar por el duenio).',
 'Procesador', '',
 '{"socket": "LGA1851"}'::jsonb,
 true),
('HT-0059', 'ASUS TUF B850M-PLUS WIFI', 'ASUS', 0, 0,
 'Motherboard (precio y stock a confirmar por el duenio).',
 'Motherboard', '',
 '{"socket": "AM5", "memoria": "DDR5", "formato": "Micro-ATX", "puertosM2": 3, "pcie": "5.0"}'::jsonb,
 true),
('HT-0060', 'ASUS TUF B860M-PLUS WIFI', 'ASUS', 0, 0,
 'Motherboard (precio y stock a confirmar por el duenio).',
 'Motherboard', 'NUEVO/asus-tuf-b860m-plus-wifi.webp',
 '{"socket": "LGA1851", "memoria": "DDR5", "formato": "Micro-ATX", "puertosM2": 3}'::jsonb,
 true),
('HT-0061', 'Corsair Vengeance 32GB DDR5-6400', 'Corsair', 0, 0,
 'Memoria RAM (precio y stock a confirmar por el duenio).',
 'Memoria RAM', 'NUEVO/corsair-vengeance-32gb-ddr5-6400.webp',
 '{"tipo": "DDR5", "capacidad": "32GB (2x16GB)", "velocidad": "6400MT/s", "latencia": "CL32", "formatoModulo": "UDIMM"}'::jsonb,
 true),
('HT-0062', 'Corsair Dominator 32GB DDR5-6000', 'Corsair', 0, 0,
 'Memoria RAM (precio y stock a confirmar por el duenio).',
 'Memoria RAM', 'NUEVO/corsair-dominator-32gb-ddr5-6000.webp',
 '{"tipo": "DDR5", "capacidad": "32GB (2x16GB)", "velocidad": "6000MT/s", "latencia": "CL30", "formatoModulo": "UDIMM"}'::jsonb,
 true),
('HT-0063', 'Samsung 990 PRO 2TB', 'Samsung', 0, 0,
 'Almacenamiento (precio y stock a confirmar por el duenio).',
 'Almacenamiento', 'NUEVO/samsung-990-pro-2tb.webp',
 '{"tipo": "NVMe", "formato": "M.2", "capacidad": "2TB", "velocidadLectura": "7450MB/s"}'::jsonb,
 true),
('HT-0064', 'WD SN850X 2TB', 'Western Digital', 0, 0,
 'Almacenamiento (precio y stock a confirmar por el duenio).',
 'Almacenamiento', '',
 '{"tipo": "NVMe", "formato": "M.2"}'::jsonb,
 true),
('HT-0065', 'Seasonic FOCUS GX-850', 'Seasonic', 0, 0,
 'Fuente (precio y stock a confirmar por el duenio).',
 'Fuente', 'NUEVO/seasonic-focus-gx-850.webp',
 '{"potencia": "850W", "formato": "ATX", "conector": "12V-2x6 nativo"}'::jsonb,
 true),
('HT-0066', 'ASUS TUF LC II 360 ARGB', 'ASUS', 0, 0,
 'Cooler (precio y stock a confirmar por el duenio).',
 'Cooler', 'NUEVO/asus-tuf-lc-ii-360-argb.webp',
 '{"tipo": "AIO", "radiador": "360mm", "socketsCompatibles": ["AM5", "AM4", "LGA1851", "LGA1700"]}'::jsonb,
 true),
('HT-0067', 'ASUS TUF GT302 ARGB', 'ASUS', 0, 0,
 'Gabinete (precio y stock a confirmar por el duenio).',
 'Gabinete', 'NUEVO/asus-tuf-gt302-argb.webp',
 '{"gpuMaxima": "407mm", "radiadorMaximo": "360mm"}'::jsonb,
 true),
('HT-0068', 'ASUS TUF K3', 'ASUS', 0, 0,
 'Periferico (precio y stock a confirmar por el duenio).',
 'Periferico', 'NUEVO/asus-tuf-k3.webp',
 '{"tipo": "teclado mecanico RGB"}'::jsonb,
 true),
('HT-0069', 'ASUS VG27AQ3A 27"', 'ASUS', 0, 0,
 'Monitor (precio y stock a confirmar por el duenio).',
 'Monitor', 'NUEVO/asus-vg27aq3a-27.webp',
 '{"tamanio": "27 pulgadas", "resolucion": "QHD", "panel": "IPS", "tasaRefresco": "180Hz"}'::jsonb,
 true)
on conflict do nothing;

-- ============ PRODUCT_SPECS (solo claves del motor, inferred/false) ============
-- GPU: RTX 5070 ASUS Dual (1x16-pin -> requiere12VHPWR, 0x8-pin).
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'conectores8pin', '0'::jsonb, 'inferred', false from productos
where nombre = 'RTX 5070 ASUS Dual 12GB GDDR7'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'fuenteRecomendadaW', '750'::jsonb, 'inferred', false from productos
where nombre = 'RTX 5070 ASUS Dual 12GB GDDR7'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'longitudMm', '249'::jsonb, 'inferred', false from productos
where nombre = 'RTX 5070 ASUS Dual 12GB GDDR7'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'requiere12VHPWR', 'true'::jsonb, 'inferred', false from productos
where nombre = 'RTX 5070 ASUS Dual 12GB GDDR7'
on conflict (producto_id, clave) do nothing;
-- GPU: RX 9070 XT TUF (3x8-pin, sin 12VHPWR).
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'conectores8pin', '3'::jsonb, 'inferred', false from productos
where nombre = 'RX 9070 XT ASUS TUF 16GB GDDR6'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'fuenteRecomendadaW', '850'::jsonb, 'inferred', false from productos
where nombre = 'RX 9070 XT ASUS TUF 16GB GDDR6'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'longitudMm', '330'::jsonb, 'inferred', false from productos
where nombre = 'RX 9070 XT ASUS TUF 16GB GDDR6'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'requiere12VHPWR', 'false'::jsonb, 'inferred', false from productos
where nombre = 'RX 9070 XT ASUS TUF 16GB GDDR6'
on conflict (producto_id, clave) do nothing;
-- CPU: Ryzen 7 9800X3D (solo socket con respaldo).
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'socket', '"AM5"'::jsonb, 'inferred', false from productos
where nombre = 'Ryzen 7 9800X3D'
on conflict (producto_id, clave) do nothing;
-- CPU: Core Ultra 7 265K (solo socket con respaldo).
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'socket', '"LGA1851"'::jsonb, 'inferred', false from productos
where nombre = 'Intel Core Ultra 7 265K'
on conflict (producto_id, clave) do nothing;
-- Mother: B850M-PLUS WIFI.
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'formato', '"Micro-ATX"'::jsonb, 'inferred', false from productos
where nombre = 'ASUS TUF B850M-PLUS WIFI'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'memoriaTipo', '"DDR5"'::jsonb, 'inferred', false from productos
where nombre = 'ASUS TUF B850M-PLUS WIFI'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'puertosM2', '3'::jsonb, 'inferred', false from productos
where nombre = 'ASUS TUF B850M-PLUS WIFI'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'socket', '"AM5"'::jsonb, 'inferred', false from productos
where nombre = 'ASUS TUF B850M-PLUS WIFI'
on conflict (producto_id, clave) do nothing;
-- Mother: B860M-PLUS WIFI.
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'formato', '"Micro-ATX"'::jsonb, 'inferred', false from productos
where nombre = 'ASUS TUF B860M-PLUS WIFI'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'memoriaTipo', '"DDR5"'::jsonb, 'inferred', false from productos
where nombre = 'ASUS TUF B860M-PLUS WIFI'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'puertosM2', '3'::jsonb, 'inferred', false from productos
where nombre = 'ASUS TUF B860M-PLUS WIFI'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'socket', '"LGA1851"'::jsonb, 'inferred', false from productos
where nombre = 'ASUS TUF B860M-PLUS WIFI'
on conflict (producto_id, clave) do nothing;
-- RAM: Vengeance 32GB DDR5-6400.
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'capacidadGB', '32'::jsonb, 'inferred', false from productos
where nombre = 'Corsair Vengeance 32GB DDR5-6400'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'formatoModulo', '"UDIMM"'::jsonb, 'inferred', false from productos
where nombre = 'Corsair Vengeance 32GB DDR5-6400'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'modulos', '2'::jsonb, 'inferred', false from productos
where nombre = 'Corsair Vengeance 32GB DDR5-6400'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tipo', '"DDR5"'::jsonb, 'inferred', false from productos
where nombre = 'Corsair Vengeance 32GB DDR5-6400'
on conflict (producto_id, clave) do nothing;
-- RAM: Dominator 32GB DDR5-6000.
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'capacidadGB', '32'::jsonb, 'inferred', false from productos
where nombre = 'Corsair Dominator 32GB DDR5-6000'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'formatoModulo', '"UDIMM"'::jsonb, 'inferred', false from productos
where nombre = 'Corsair Dominator 32GB DDR5-6000'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'modulos', '2'::jsonb, 'inferred', false from productos
where nombre = 'Corsair Dominator 32GB DDR5-6000'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tipo', '"DDR5"'::jsonb, 'inferred', false from productos
where nombre = 'Corsair Dominator 32GB DDR5-6000'
on conflict (producto_id, clave) do nothing;
-- Almacenamiento: Samsung 990 PRO 2TB / WD SN850X 2TB.
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tipo', '"NVMe"'::jsonb, 'inferred', false from productos
where nombre = 'Samsung 990 PRO 2TB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tipo', '"NVMe"'::jsonb, 'inferred', false from productos
where nombre = 'WD SN850X 2TB'
on conflict (producto_id, clave) do nothing;
-- Fuente: Seasonic FOCUS GX-850 (12V-2x6 nativo -> tiene12VHPWR).
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'formato', '"ATX"'::jsonb, 'inferred', false from productos
where nombre = 'Seasonic FOCUS GX-850'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'potenciaW', '850'::jsonb, 'inferred', false from productos
where nombre = 'Seasonic FOCUS GX-850'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tiene12VHPWR', 'true'::jsonb, 'inferred', false from productos
where nombre = 'Seasonic FOCUS GX-850'
on conflict (producto_id, clave) do nothing;
-- Cooler: TUF LC II 360 ARGB (AIO liquida 360mm).
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'radiadorMm', '360'::jsonb, 'inferred', false from productos
where nombre = 'ASUS TUF LC II 360 ARGB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'sockets', '["AM5", "AM4", "LGA1851", "LGA1700"]'::jsonb, 'inferred', false from productos
where nombre = 'ASUS TUF LC II 360 ARGB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'tipo', '"liquido"'::jsonb, 'inferred', false from productos
where nombre = 'ASUS TUF LC II 360 ARGB'
on conflict (producto_id, clave) do nothing;
-- Gabinete: TUF GT302 ARGB.
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'maxGpuMm', '407'::jsonb, 'inferred', false from productos
where nombre = 'ASUS TUF GT302 ARGB'
on conflict (producto_id, clave) do nothing;
insert into product_specs (producto_id, clave, valor, source, verified)
select id, 'radiadorMaxMm', '360'::jsonb, 'inferred', false from productos
where nombre = 'ASUS TUF GT302 ARGB'
on conflict (producto_id, clave) do nothing;
-- NOTA: 'ASUS TUF K3' (Periferico) y 'ASUS VG27AQ3A 27"' (Monitor) no
-- tienen claves de motor en adaptar.js: solo viven en especificaciones.

-- Verificacion (tras aplicar en Dashboard: 15 productos nuevos con
-- precio=0/stock=0, 38 filas inferred/false solo de estos productos):
-- select count(*) from productos where codigo between 'HT-0055' and 'HT-0069';
-- select p.nombre, s.clave, s.valor from product_specs s
-- join productos p on p.id = s.producto_id
-- where p.codigo between 'HT-0055' and 'HT-0069'
--   and not s.verified order by p.nombre, s.clave;
