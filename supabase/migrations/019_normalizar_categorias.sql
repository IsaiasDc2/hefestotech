-- 019 · Normalizar las categorías de productos
--
-- Problema: `productos.categoria` es texto libre y el admin lo editaba a mano.
-- Quedaron valores en plural ("Procesadores", "Motherboards", "Fuentes",
-- "Memorias", "Refrigeración"…) mientras el frontend filtra por el valor
-- canónico de `src/constants/categorias.js` ("Procesador", "Motherboard",
-- "Fuente", "Memoria RAM", "Cooler"…). Resultado: 111 de 137 productos no
-- aparecían al entrar por su categoría, y el armador de PC tampoco los veía.
--
-- Deja los dos lados con el mismo vocabulario. Idempotente: se puede correr
-- las veces que haga falta.

begin;

-- 1) Productos: cada variante pasa a su valor canónico.
with mapa(origen, canonica) as (
  values
    ('procesador',    'Procesador'),
    ('procesadores',  'Procesador'),
    ('placa de video','Placa de video'),
    ('placas de video','Placa de video'),
    ('placa de vídeo','Placa de video'),
    ('motherboard',   'Motherboard'),
    ('motherboards',  'Motherboard'),
    ('memoria',       'Memoria RAM'),
    ('memoria ram',   'Memoria RAM'),
    ('memorias',      'Memoria RAM'),
    ('memorias ram',  'Memoria RAM'),
    ('almacenamiento','Almacenamiento'),
    ('disco',         'Almacenamiento'),
    ('discos',        'Almacenamiento'),
    ('fuente',        'Fuente'),
    ('fuentes',       'Fuente'),
    ('gabinete',      'Gabinete'),
    ('gabinetes',     'Gabinete'),
    ('cooler',        'Cooler'),
    ('coolers',       'Cooler'),
    ('refrigeración', 'Cooler'),
    ('refrigeracion', 'Cooler'),
    ('monitor',       'Monitor'),
    ('monitores',     'Monitor'),
    ('periferico',    'Periferico'),
    ('periférico',    'Periferico'),
    ('perifericos',   'Periferico'),
    ('periféricos',   'Periferico'),
    ('mousepad',      'Mousepad'),
    ('mousepads',     'Mousepad'),
    ('auriculares',   'Auriculares'),
    ('auricular',     'Auriculares'),
    ('parlantes',     'Parlantes'),
    ('parlante',      'Parlantes'),
    ('silla gamer',   'Silla Gamer'),
    ('sillas gamer',  'Silla Gamer'),
    ('webcam',        'Webcam'),
    ('webcams',       'Webcam'),
    ('ups',           'UPS'),
    ('notebook',      'Notebook'),
    ('notebooks',     'Notebook')
)
update public.productos p
set categoria = m.canonica
from mapa m
where lower(btrim(p.categoria)) = m.origen
  and p.categoria is distinct from m.canonica;

-- 2) Tabla `categorias`: mismo vocabulario. Hoy nada del sitio la lee (el
--    frontend usa constantes), pero el admin la mostraba como referencia y
--    tenía los mismos plurales sueltos.
insert into public.categorias (nombre)
select v.nombre
from (values
  ('Procesador'), ('Placa de video'), ('Motherboard'), ('Memoria RAM'),
  ('Almacenamiento'), ('Fuente'), ('Gabinete'), ('Cooler'), ('Monitor'),
  ('Periferico'), ('Mousepad'), ('Auriculares'), ('Parlantes'),
  ('Silla Gamer'), ('Webcam'), ('UPS'), ('Notebook')
) as v(nombre)
on conflict (nombre) do nothing;

delete from public.categorias c
where c.nombre not in (
  'Procesador', 'Placa de video', 'Motherboard', 'Memoria RAM',
  'Almacenamiento', 'Fuente', 'Gabinete', 'Cooler', 'Monitor',
  'Periferico', 'Mousepad', 'Auriculares', 'Parlantes',
  'Silla Gamer', 'Webcam', 'UPS', 'Notebook'
);

commit;
