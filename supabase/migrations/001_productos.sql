-- HefestoTech · 001_productos.sql
-- Pegar completo en Supabase Dashboard → SQL Editor → Run.
-- Crea catálogo, RLS, bucket de imágenes y carga los 54 productos seed.

-- ============ TABLAS ============
create table if not exists categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text unique not null,
  descripcion text default '',
  created_at timestamptz default now()
);

create table if not exists productos (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  nombre text not null,
  descripcion text default '',
  categoria text not null default 'General',
  marca text default '',
  precio numeric(12,2) not null default 0,
  precio_con_descuento numeric(12,2),
  descuento_porcentaje numeric(5,2) not null default 0,
  stock integer not null default 0,
  stock_minimo integer not null default 5,
  envio_gratis boolean not null default false,
  destacado boolean not null default false,
  imagen text default '',
  especificaciones jsonb not null default '{}',
  activo boolean not null default true,
  created_at timestamptz default now()
);
create index if not exists idx_productos_categoria on productos (categoria);
create index if not exists idx_productos_destacado on productos (destacado) where destacado;

-- ============ RLS ============
alter table categorias enable row level security;
alter table productos enable row level security;

drop policy if exists "lectura publica" on categorias;
create policy "lectura publica" on categorias for select using (true);
drop policy if exists "lectura publica" on productos;
create policy "lectura publica" on productos for select using (true);

-- Escritura solo autenticados (endurecer con rol admin en fase 2)
drop policy if exists "escritura autenticados" on categorias;
create policy "escritura autenticados" on categorias
  for all to authenticated using (true) with check (true);
drop policy if exists "escritura autenticados" on productos;
create policy "escritura autenticados" on productos
  for all to authenticated using (true) with check (true);

-- ============ STORAGE (fotos de productos) ============
insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do nothing;

drop policy if exists "lectura publica" on storage.objects;
create policy "lectura publica" on storage.objects
  for select using (bucket_id = 'productos');
drop policy if exists "escritura autenticados" on storage.objects;
create policy "escritura autenticados" on storage.objects
  for insert to authenticated with check (bucket_id = 'productos');
drop policy if exists "actualizar autenticados" on storage.objects;
create policy "actualizar autenticados" on storage.objects
  for update to authenticated using (bucket_id = 'productos');
drop policy if exists "borrar autenticados" on storage.objects;
create policy "borrar autenticados" on storage.objects
  for delete to authenticated using (bucket_id = 'productos');

-- ============ SEED: categorías ============
insert into categorias (nombre) values
  ('Procesadores'), ('Placas de video'), ('Motherboards'),
  ('Memoria RAM'), ('Almacenamiento'), ('Fuentes'),
  ('Gabinetes'), ('Monitores'), ('Periferico'), ('Mousepad'),
  ('Coolers'), ('Auriculares'), ('Parlantes'),
  ('Silla Gamer'), ('Webcam'), ('UPS')
on conflict (nombre) do nothing;

-- ============ SEED: 54 productos ============
-- Columnas: nombre, marca, precio, stock, descripcion, categoria, especificaciones
insert into productos (nombre, marca, precio, stock, descripcion, categoria, especificaciones) values
('RTX 4090 ASUS ROG STRIX 24GB', 'ASUS', 2200000, 15, 'Placa de video de gama alta ideal para gaming en 4K y cargas de trabajo de creacion de contenido exigentes.', 'Placa de video', '{"memoria": "24GB GDDR6X", "interfazMemoria": "384-bit", "nucleosCuda": 16384, "frecuenciaBase": "2235 MHz", "frecuenciaBoost": "2640 MHz", "conectores": "1x 16-pin (12VHPWR)", "salidas": ["3x DisplayPort 1.4a", "2x HDMI 2.1a"], "consumo": "450W", "fuenteRecomendada": "1000W", "longitud": "357mm", "ranurasOcupadas": 3.5, "colorPrincipal": "Negro", "iluminacionRGB": true, "refrigeracion": "Triple ventilador", "peso": "1450g", "paisOrigen": "China"}'::jsonb),
('RTX 4070 SUPER MSI 12GB', 'MSI', 850000, 15, 'Excelente balance entre rendimiento y precio para gaming en 1440p con trazado de rayos.', 'Placa de video', '{"memoria": "12GB GDDR6X", "interfazMemoria": "192-bit", "nucleosCuda": 7168, "frecuenciaBase": "1980 MHz", "frecuenciaBoost": "2505 MHz", "conectores": "1x 16-pin (12VHPWR)", "salidas": ["3x DisplayPort 1.4a", "1x HDMI 2.1a"], "consumo": "220W", "fuenteRecomendada": "650W", "longitud": "267mm", "ranurasOcupadas": 2.5, "colorPrincipal": "Negro", "iluminacionRGB": true, "refrigeracion": "Triple ventilador", "peso": "1050g", "paisOrigen": "China"}'::jsonb),
('RX 7800 XT Sapphire 16GB', 'Sapphire', 720000, 15, 'Gran rendimiento en 1440p con abundante VRAM, apta para gaming y creacion de contenido.', 'Placa de video', '{"memoria": "16GB GDDR6", "interfazMemoria": "256-bit", "unidadesComputo": 60, "frecuenciaBase": "1295 MHz", "frecuenciaBoost": "2430 MHz", "conectores": "2x 8-pin", "salidas": ["3x DisplayPort 2.1", "1x HDMI 2.1"], "consumo": "263W", "fuenteRecomendada": "700W", "longitud": "320mm", "ranurasOcupadas": 2.5, "colorPrincipal": "Negro", "iluminacionRGB": true, "refrigeracion": "Triple ventilador", "peso": "1050g", "paisOrigen": "China"}'::jsonb),
('RTX 4060 Ti 16GB', 'NVIDIA (varios fabricantes)', 610000, 15, 'Placa de video eficiente en consumo, ideal para 1080p/1440p y edicion con gran cantidad de VRAM.', 'Placa de video', '{"memoria": "16GB GDDR6", "interfazMemoria": "128-bit", "nucleosCuda": 4352, "frecuenciaBase": "2310 MHz", "frecuenciaBoost": "2535 MHz", "conectores": "1x 8-pin", "salidas": ["3x DisplayPort 1.4a", "1x HDMI 2.1a"], "consumo": "165W", "fuenteRecomendada": "550W", "longitud": "242mm", "ranurasOcupadas": 2, "colorPrincipal": "Negro", "iluminacionRGB": true, "refrigeracion": "Doble ventilador", "peso": "1050g", "paisOrigen": "China"}'::jsonb),
('Ryzen 9 7950X3D', 'AMD', 850000, 15, 'Procesador insignia con tecnologia 3D V-Cache, maximo rendimiento en gaming y multitarea profesional.', 'Procesador', '{"nucleos": 16, "hilos": 32, "frecuenciaBase": "4.2 GHz", "frecuenciaTurbo": "5.7 GHz", "cacheL3": "128MB", "socket": "AM5", "tdp": "120W", "graficosIntegrados": "AMD Radeon", "litografia": "5nm", "coolerIncluido": false, "compatibilidadPCIe": "PCIe 5.0", "paisOrigen": "Malasia/Vietnam"}'::jsonb),
('Ryzen 7 7800X3D', 'AMD', 520000, 15, 'Uno de los procesadores mas eficientes para gaming gracias a su gran cache 3D V-Cache.', 'Procesador', '{"nucleos": 8, "hilos": 16, "frecuenciaBase": "4.2 GHz", "frecuenciaTurbo": "5.0 GHz", "cacheL3": "96MB", "socket": "AM5", "tdp": "120W", "graficosIntegrados": "AMD Radeon", "litografia": "5nm", "coolerIncluido": false, "compatibilidadPCIe": "PCIe 5.0", "paisOrigen": "Malasia/Vietnam"}'::jsonb),
('Intel Core i7 14700K', 'Intel', 480000, 15, 'Procesador de alto rendimiento con arquitectura hibrida, excelente para gaming y productividad.', 'Procesador', '{"nucleos": 20, "hilos": 28, "nucleosRendimiento": 8, "nucleosEficientes": 12, "frecuenciaBase": "3.4 GHz", "frecuenciaTurbo": "5.6 GHz", "cacheL3": "33MB", "socket": "LGA1700", "tdp": "125W", "litografia": "Intel 7", "coolerIncluido": false, "compatibilidadPCIe": "PCIe 5.0", "paisOrigen": "Malasia/Vietnam"}'::jsonb),
('Ryzen 5 7600', 'AMD', 340000, 15, 'Procesador de gama media con excelente relacion precio-rendimiento para armados gamer.', 'Procesador', '{"nucleos": 6, "hilos": 12, "frecuenciaBase": "3.8 GHz", "frecuenciaTurbo": "5.1 GHz", "cacheL3": "32MB", "socket": "AM5", "tdp": "65W", "graficosIntegrados": "AMD Radeon", "litografia": "5nm", "coolerIncluido": true, "compatibilidadPCIe": "PCIe 5.0", "paisOrigen": "Malasia/Vietnam"}'::jsonb),
('Kingston Fury Beast 32GB DDR5 6000MHz', 'Kingston', 180000, 15, 'Kit de memoria de alta velocidad con perfil XMP/EXPO para maximo rendimiento en plataformas modernas.', 'Memoria RAM', '{"capacidad": "32GB (2x16GB)", "tipo": "DDR5", "velocidad": "6000MHz", "latencia": "CL36", "voltaje": "1.35V", "perfiles": ["XMP 3.0", "AMD EXPO"], "disipador": true, "colorDisipador": "Negro", "paisOrigen": "Taiwan"}'::jsonb),
('Corsair Vengeance 16GB DDR4', 'Corsair', 70000, 15, 'Memoria confiable y economica, compatible con la mayoria de plataformas DDR4.', 'Memoria RAM', '{"capacidad": "16GB (2x8GB)", "tipo": "DDR4", "velocidad": "3200MHz", "latencia": "CL16", "voltaje": "1.35V", "perfiles": ["XMP 2.0"], "disipador": true, "colorDisipador": "Negro", "paisOrigen": "Taiwan"}'::jsonb),
('G.Skill Trident Z5 32GB DDR5', 'G.Skill', 195000, 15, 'Memoria premium con disipadores de aluminio y altas frecuencias para entusiastas.', 'Memoria RAM', '{"capacidad": "32GB (2x16GB)", "tipo": "DDR5", "velocidad": "6400MHz", "latencia": "CL32", "voltaje": "1.4V", "perfiles": ["XMP 3.0"], "disipador": true, "colorDisipador": "Negro", "paisOrigen": "Taiwan"}'::jsonb),
('Samsung 990 PRO NVMe 2TB', 'Samsung', 250000, 15, 'SSD NVMe de altisimo rendimiento, ideal para gaming y edicion de video profesional.', 'Almacenamiento', '{"capacidad": "2TB", "tipo": "SSD NVMe", "interfaz": "PCIe 4.0 x4", "formato": "M.2 2280", "velocidadLectura": "7450 MB/s", "velocidadEscritura": "6900 MB/s", "tbw": "1200TB", "disipadorIncluido": true, "cifrado": "AES 256-bit", "paisOrigen": "Corea del Sur"}'::jsonb),
('WD Black SN850X 1TB NVMe', 'Western Digital', 120000, 15, 'SSD orientado a gaming, compatible con almacenamiento expandible de consolas de nueva generacion.', 'Almacenamiento', '{"capacidad": "1TB", "tipo": "SSD NVMe", "interfaz": "PCIe 4.0 x4", "formato": "M.2 2280", "velocidadLectura": "7300 MB/s", "velocidadEscritura": "6300 MB/s", "tbw": "600TB", "disipadorIncluido": true, "cifrado": "AES 256-bit", "paisOrigen": "China"}'::jsonb),
('Kingston NV2 500GB NVMe', 'Kingston', 65000, 15, 'SSD NVMe economico ideal para sistema operativo y aplicaciones de uso diario.', 'Almacenamiento', '{"capacidad": "500GB", "tipo": "SSD NVMe", "interfaz": "PCIe 4.0 x4", "formato": "M.2 2280", "velocidadLectura": "3500 MB/s", "velocidadEscritura": "2100 MB/s", "tbw": "160TB", "disipadorIncluido": false, "cifrado": "AES 256-bit", "paisOrigen": "China"}'::jsonb),
('Fuente Corsair RM850 850W 80 Plus Gold', 'Corsair', 230000, 15, 'Fuente modular de alta eficiencia y bajo nivel de ruido, ideal para armados de gama alta.', 'Fuente', '{"potencia": "850W", "certificacion": "80 Plus Gold", "modular": "Full Modular", "ventilador": "135mm ZeroRPM", "conectorPCIe": "12VHPWR compatible", "garantiaFabricante": "10 anios", "proteccion": ["OVP", "UVP", "OCP", "OPP", "SCP"], "paisOrigen": "China"}'::jsonb),
('Fuente EVGA 650W 80 Plus Bronze', 'EVGA', 140000, 15, 'Fuente confiable y economica para armados de gama media.', 'Fuente', '{"potencia": "650W", "certificacion": "80 Plus Bronze", "modular": "No Modular", "ventilador": "120mm", "garantiaFabricante": "3 anios", "proteccion": ["OVP", "UVP", "OCP", "OPP", "SCP"], "paisOrigen": "China"}'::jsonb),
('Gabinete NZXT H7 Flow', 'NZXT', 260000, 15, 'Gabinete de gran flujo de aire con panel lateral de vidrio templado, ideal para builds de alto rendimiento.', 'Gabinete', '{"formato": "Mid Tower", "compatibilidadMB": ["ATX", "Micro ATX", "Mini ITX"], "ventiladoresIncluidos": 2, "panelLateral": "Vidrio templado", "bahiasSSD": 3, "radiadorMaximo": "360mm", "colorDisponible": ["Negro", "Blanco"], "pesoNeto": "8.5kg"}'::jsonb),
('Gabinete Cooler Master MasterBox Q300L', 'Cooler Master', 130000, 15, 'Gabinete compacto y economico con panel lateral acrilico, ideal para builds pequenos.', 'Gabinete', '{"formato": "Micro ATX Tower", "compatibilidadMB": ["Micro ATX", "Mini ITX"], "ventiladoresIncluidos": 1, "panelLateral": "Acrilico", "bahiasSSD": 2, "radiadorMaximo": "240mm", "colorDisponible": ["Negro", "Blanco"], "pesoNeto": "4.8kg"}'::jsonb),
('Motherboard ASUS TUF B650-PLUS', 'ASUS', 300000, 15, 'Motherboard robusta con buena entrega de energia, ideal para procesadores Ryzen de la serie 7000.', 'Motherboard', '{"socket": "AM5", "chipset": "B650", "formato": "ATX", "ranurasRAM": 4, "memoriaMaxima": "128GB DDR5", "ranuraPCIeGrafica": "PCIe 4.0 x16", "puertosM2": 2, "wifi": true, "redLAN": "2.5G LAN", "paisOrigen": "China"}'::jsonb),
('Motherboard MSI PRO B760M-A', 'MSI', 220000, 15, 'Motherboard Micro ATX confiable y versatil para procesadores Intel de 12va, 13va y 14va generacion.', 'Motherboard', '{"socket": "LGA1700", "chipset": "B760", "formato": "Micro ATX", "ranurasRAM": 4, "memoriaMaxima": "128GB DDR5", "ranuraPCIeGrafica": "PCIe 4.0 x16", "puertosM2": 2, "wifi": false, "redLAN": "2.5G LAN", "paisOrigen": "China"}'::jsonb),
('Monitor LG UltraGear 24 180Hz', 'LG', 250000, 15, 'Monitor gamer de alta frecuencia de actualizacion, ideal para juegos competitivos.', 'Monitor', '{"tamanio": "24 pulgadas", "resolucion": "1920x1080 (Full HD)", "tasaRefresco": "180Hz", "tiempoRespuesta": "1ms", "panel": "VA", "tecnologiaSync": "AMD FreeSync Premium", "conectores": ["HDMI", "DisplayPort"], "brillo": "300 nits", "ajusteAltura": false}'::jsonb),
('Monitor Gigabyte AORUS 27 QHD 165Hz', 'Gigabyte', 420000, 15, 'Monitor QHD con panel IPS de alta fidelidad de color, ideal para gaming y diseno.', 'Monitor', '{"tamanio": "27 pulgadas", "resolucion": "2560x1440 (QHD)", "tasaRefresco": "165Hz", "tiempoRespuesta": "1ms", "panel": "IPS", "tecnologiaSync": "NVIDIA G-Sync Compatible", "conectores": ["HDMI", "DisplayPort", "USB-C"], "brillo": "350 nits", "ajusteAltura": true}'::jsonb),
('Teclado Redragon Kumara RGB', 'Redragon', 60000, 15, 'Teclado mecanico compacto con retroiluminacion RGB, excelente relacion precio-calidad.', 'Periferico', '{"tipo": "Mecanico", "switches": "Outemu Blue", "conexion": "Cable USB", "retroiluminacion": "RGB", "formato": "TKL (sin numpad)", "colorPrincipal": "Negro", "paisOrigen": "China"}'::jsonb),
('Mouse Logitech G Pro X Superlight', 'Logitech', 140000, 15, 'Mouse inalambrico ultraliviano usado por jugadores profesionales de esports.', 'Periferico', '{"tipo": "Optico inalambrico", "sensor": "HERO 25K", "peso": "63g", "dpiMaximo": 25600, "bateria": "Hasta 70 horas", "conexion": "LIGHTSPEED Wireless", "colorPrincipal": "Negro", "paisOrigen": "China"}'::jsonb),
('Mouse Razer DeathAdder V3', 'Razer', 95000, 0, 'Mouse ergonomico de alto rendimiento, diseno clasico preferido por millones de jugadores.', 'Periferico', '{"tipo": "Optico con cable", "sensor": "Focus Pro 30K", "peso": "59g", "dpiMaximo": 30000, "conexion": "Cable Speedflex", "colorPrincipal": "Negro", "paisOrigen": "China"}'::jsonb),
('Teclado Corsair K70 RGB Pro', 'Corsair', 190000, 15, 'Teclado mecanico premium con estructura de aluminio y retroiluminacion RGB por tecla.', 'Periferico', '{"tipo": "Mecanico", "switches": "Cherry MX Red", "conexion": "Cable USB desmontable", "retroiluminacion": "RGB por tecla", "formato": "Full size", "reposamunecas": true, "colorPrincipal": "Negro", "paisOrigen": "China"}'::jsonb),
('RTX 4080 SUPER Gigabyte 16GB', 'Gigabyte', 1450000, 10, 'Rendimiento de gama alta para 4K con excelente eficiencia termica y RGB personalizable.', 'Placa de video', '{"memoria": "16GB GDDR6X", "interfazMemoria": "256-bit", "nucleosCuda": 10240, "frecuenciaBase": "2295 MHz", "frecuenciaBoost": "2610 MHz", "conectores": "1x 16-pin (12VHPWR)", "salidas": ["3x DisplayPort 1.4a", "2x HDMI 2.1a"], "consumo": "320W", "fuenteRecomendada": "850W", "longitud": "346mm", "colorPrincipal": "Negro", "iluminacionRGB": true, "refrigeracion": "Triple ventilador WINDFORCE", "paisOrigen": "China"}'::jsonb),
('RX 7900 XTX XFX 24GB', 'XFX', 1350000, 8, 'Flagship de AMD con 24GB de VRAM, ideal para 4K, creacion de contenido y IA local.', 'Placa de video', '{"memoria": "24GB GDDR6", "interfazMemoria": "384-bit", "unidadesComputo": 96, "frecuenciaBase": "1855 MHz", "frecuenciaBoost": "2565 MHz", "conectores": "2x 8-pin", "salidas": ["2x DisplayPort 2.1", "2x HDMI 2.1"], "consumo": "355W", "fuenteRecomendada": "850W", "longitud": "344mm", "colorPrincipal": "Negro", "iluminacionRGB": true, "refrigeracion": "Triple ventilador", "paisOrigen": "China"}'::jsonb),
('Intel Core i5 14600K', 'Intel', 390000, 20, 'Excelente relacion precio-rendimiento con arquitectura hibrida de 13va generacion refrescada.', 'Procesador', '{"nucleos": 14, "hilos": 20, "nucleosRendimiento": 6, "nucleosEficientes": 8, "frecuenciaBase": "3.5 GHz", "frecuenciaTurbo": "5.3 GHz", "cacheL3": "24MB", "socket": "LGA1700", "tdp": "125W", "litografia": "Intel 7", "coolerIncluido": false, "paisOrigen": "Malasia/Vietnam"}'::jsonb),
('Ryzen 5 8600G', 'AMD', 300000, 18, 'APU con graficos integrados potentes, ideal para PCs compactas sin placa de video dedicada.', 'Procesador', '{"nucleos": 6, "hilos": 12, "frecuenciaBase": "4.3 GHz", "frecuenciaTurbo": "5.0 GHz", "cacheL3": "16MB", "socket": "AM5", "tdp": "65W", "graficosIntegrados": "AMD Radeon 760M", "litografia": "4nm", "coolerIncluido": true, "paisOrigen": "Malasia/Vietnam"}'::jsonb),
('Corsair Dominator Platinum 64GB DDR5', 'Corsair', 340000, 12, 'Kit de memoria de altisima capacidad, ideal para estaciones de trabajo y multitarea extrema.', 'Memoria RAM', '{"capacidad": "64GB (2x32GB)", "tipo": "DDR5", "velocidad": "6000MHz", "latencia": "CL30", "voltaje": "1.4V", "perfiles": ["XMP 3.0", "AMD EXPO"], "disipador": true, "colorDisipador": "Negro con RGB", "paisOrigen": "Taiwan"}'::jsonb),
('Crucial P3 Plus 4TB NVMe', 'Crucial', 320000, 14, 'Gran capacidad a precio accesible, ideal para librerias de juegos y archivos multimedia.', 'Almacenamiento', '{"capacidad": "4TB", "tipo": "SSD NVMe", "interfaz": "PCIe 4.0 x4", "formato": "M.2 2280", "velocidadLectura": "5000 MB/s", "velocidadEscritura": "4200 MB/s", "tbw": "800TB", "disipadorIncluido": false, "paisOrigen": "China"}'::jsonb),
('Seagate Barracuda 2TB HDD', 'Seagate', 90000, 25, 'Disco rigido tradicional de alta capacidad, ideal para almacenamiento masivo y backups.', 'Almacenamiento', '{"capacidad": "2TB", "tipo": "HDD", "interfaz": "SATA III", "formato": "3.5 pulgadas", "velocidadRotacion": "7200 RPM", "cache": "256MB", "paisOrigen": "China"}'::jsonb),
('Fuente Seasonic Focus GX-750 80 Plus Gold', 'Seasonic', 210000, 16, 'Fuente compacta totalmente modular con excelente regulacion de voltaje y silenciosa.', 'Fuente', '{"potencia": "750W", "certificacion": "80 Plus Gold", "modular": "Full Modular", "ventilador": "120mm Fluid Dynamic", "garantiaFabricante": "10 anios", "proteccion": ["OVP", "UVP", "OCP", "OPP", "SCP"], "paisOrigen": "China"}'::jsonb),
('Gabinete Lian Li O11 Dynamic EVO', 'Lian Li', 340000, 9, 'Gabinete premium de doble camara, favorito de builders por su flexibilidad de layout y estetica.', 'Gabinete', '{"formato": "Mid Tower", "compatibilidadMB": ["ATX", "Micro ATX", "Mini ITX", "E-ATX"], "ventiladoresIncluidos": 0, "panelLateral": "Vidrio templado (2x)", "bahiasSSD": 4, "radiadorMaximo": "360mm (x3 posiciones)", "colorDisponible": ["Negro", "Blanco"], "pesoNeto": "11.2kg"}'::jsonb),
('Motherboard Gigabyte X670E AORUS Master', 'Gigabyte', 650000, 7, 'Motherboard de gama alta con soporte PCIe 5.0 completo, ideal para builds Ryzen tope de gama.', 'Motherboard', '{"socket": "AM5", "chipset": "X670E", "formato": "ATX", "ranurasRAM": 4, "memoriaMaxima": "128GB DDR5", "ranuraPCIeGrafica": "PCIe 5.0 x16", "puertosM2": 4, "wifi": true, "redLAN": "10G LAN", "paisOrigen": "China"}'::jsonb),
('Monitor Samsung Odyssey G7 32 240Hz', 'Samsung', 650000, 11, 'Monitor curvo QHD de alta frecuencia, ideal para gaming competitivo e inmersivo.', 'Monitor', '{"tamanio": "32 pulgadas", "resolucion": "2560x1440 (QHD)", "tasaRefresco": "240Hz", "tiempoRespuesta": "1ms", "panel": "VA Curvo 1000R", "conectores": ["HDMI", "DisplayPort", "USB-C"], "brillo": "350 nits", "ajusteAltura": true}'::jsonb),
('Teclado Logitech G915 TKL Wireless', 'Logitech', 280000, 13, 'Teclado mecanico inalambrico de perfil bajo, con switches GL y RGB LIGHTSYNC.', 'Periferico', '{"tipo": "Mecanico low-profile", "switches": "GL Tactile", "conexion": "LIGHTSPEED Wireless / Bluetooth / Cable", "retroiluminacion": "RGB LIGHTSYNC", "formato": "TKL (sin numpad)", "colorPrincipal": "Negro", "paisOrigen": "China"}'::jsonb),
('Mouse Pad SteelSeries QcK Extended', 'SteelSeries', 35000, 40, 'Mousepad de tela extendido para cubrir teclado y mouse, superficie optimizada para sensores opticos.', 'Mousepad', '{"dimensiones": "900 x 300 x 2mm", "material": "Tela microtejida + goma antideslizante", "bordesCosidos": true, "colorPrincipal": "Negro"}'::jsonb),
('Mouse Pad Razer Goliathus Extended Chroma', 'Razer', 55000, 18, 'Mousepad extendido con iluminacion RGB Chroma perimetral y superficie de tela premium.', 'Mousepad', '{"dimensiones": "920 x 294 x 3mm", "material": "Tela tejida con base de goma", "bordesCosidos": true, "iluminacionRGB": true, "colorPrincipal": "Negro"}'::jsonb),
('Cooler Master Hyper 212 Black Edition', 'Cooler Master', 55000, 30, 'Cooler por aire de referencia, excelente disipacion a precio accesible para gama media.', 'Cooler', '{"tipo": "Aire (torre)", "socketsCompatibles": ["AM5", "AM4", "LGA1700", "LGA1200"], "tdpMaximo": "150W", "ventilador": "120mm PWM", "alturaTotal": "159mm", "colorPrincipal": "Negro"}'::jsonb),
('NZXT Kraken 280mm AIO RGB', 'NZXT', 260000, 10, 'Refrigeracion liquida AIO con pantalla LCD personalizable en el bloque de bomba.', 'Cooler', '{"tipo": "Liquido (AIO)", "socketsCompatibles": ["AM5", "AM4", "LGA1700", "LGA1200"], "tdpMaximo": "280W", "radiador": "280mm", "ventiladores": "2x 140mm", "pantallaLCD": true, "colorPrincipal": "Negro"}'::jsonb),
('be quiet! Dark Rock Pro 4', 'be quiet!', 140000, 14, 'Cooler por aire de doble torre, referencia en silencio y disipacion para CPUs de alto TDP.', 'Cooler', '{"tipo": "Aire (doble torre)", "socketsCompatibles": ["AM5", "AM4", "LGA1700", "LGA1200"], "tdpMaximo": "250W", "ventilador": "2x 120/135mm Silent Wings", "alturaTotal": "163mm", "colorPrincipal": "Negro/Plata"}'::jsonb),
('HyperX Cloud II', 'HyperX', 110000, 22, 'Auriculares gamer clasicos con sonido envolvente 7.1 virtual y gran comodidad.', 'Auriculares', '{"tipo": "Cerrado, con cable", "conexion": "USB / 3.5mm", "sonido": "7.1 Virtual Surround", "driver": "53mm", "microfono": "Desmontable con cancelacion de ruido", "peso": "320g", "colorPrincipal": "Negro/Rojo"}'::jsonb),
('SteelSeries Arctis Nova Pro Wireless', 'SteelSeries', 420000, 9, 'Auriculares premium inalambricos con cancelacion activa de ruido y base de carga con pantalla.', 'Auriculares', '{"tipo": "Cerrado, inalambrico", "conexion": "2.4GHz + Bluetooth", "sonido": "Hi-Res Audio", "driver": "40mm Neodimio", "cancelacionRuido": true, "bateria": "Hasta 44 horas", "peso": "338g", "colorPrincipal": "Negro"}'::jsonb),
('Logitech G435 Lightspeed', 'Logitech', 80000, 26, 'Auriculares inalambricos ultralivianos, ideales para gaming casual y uso diario.', 'Auriculares', '{"tipo": "Abierto, inalambrico", "conexion": "LIGHTSPEED Wireless + Bluetooth", "sonido": "Estereo", "driver": "40mm", "bateria": "Hasta 18 horas", "peso": "165g", "colorPrincipal": "Negro"}'::jsonb),
('Logitech Z623 2.1', 'Logitech', 150000, 16, 'Sistema de parlantes 2.1 con subwoofer, sonido THX certificado para gaming y peliculas.', 'Parlantes', '{"configuracion": "2.1 (2 satelites + subwoofer)", "potenciaTotal": "200W RMS", "certificacion": "THX", "conectores": ["3.5mm", "RCA"], "colorPrincipal": "Negro"}'::jsonb),
('Creative Pebble V3', 'Creative', 65000, 30, 'Parlantes compactos USB-C con carga para dispositivos y sonido claro para escritorio.', 'Parlantes', '{"configuracion": "2.0 (par estereo)", "potenciaTotal": "12W RMS", "conectores": ["USB-C", "3.5mm"], "puertoCargaUSB": true, "colorPrincipal": "Blanco/Negro"}'::jsonb),
('Corsair TC100 Relaxed', 'Corsair', 260000, 12, 'Silla gamer de tela transpirable con diseno relajado, comoda para sesiones largas.', 'Silla Gamer', '{"material": "Tela transpirable", "reclinacion": "Hasta 160°", "apoyabrazos": "2D ajustables", "cargaMaxima": "120kg", "cojines": ["Lumbar", "Cervical"], "colorPrincipal": "Negro/Gris"}'::jsonb),
('Secretlab Titan Evo 2022', 'Secretlab', 650000, 6, 'Silla gamer premium con soporte lumbar integrado y materiales de alta durabilidad.', 'Silla Gamer', '{"material": "Cuero NEO Hybrid", "reclinacion": "Hasta 165°", "apoyabrazos": "4D ajustables", "cargaMaxima": "130kg", "cojines": ["Lumbar integrado ajustable", "Cervical magnetico"], "colorPrincipal": "Negro"}'::jsonb),
('Logitech C920 HD Pro', 'Logitech', 110000, 20, 'Webcam Full HD confiable para streaming, videollamadas y grabacion de contenido.', 'Webcam', '{"resolucion": "1920x1080 (Full HD) 30fps", "enfoque": "Autoenfoque", "microfono": "Dual estereo integrado", "campoVision": "78°", "conexion": "USB-A", "tripode": true, "colorPrincipal": "Negro"}'::jsonb),
('Razer Kiyo Pro', 'Razer', 220000, 11, 'Webcam con sensor de alto rango dinamico, ideal para streamers profesionales.', 'Webcam', '{"resolucion": "1920x1080 (Full HD) 60fps", "enfoque": "Autoenfoque", "sensor": "HDR de alto rango dinamico", "campoVision": "80°/90°/103° ajustable", "conexion": "USB-A", "tripode": true, "colorPrincipal": "Negro"}'::jsonb),
('APC Back-UPS 600VA', 'APC', 130000, 17, 'Sistema de alimentacion ininterrumpida basico para proteger PC y periféricos de cortes de luz.', 'UPS', '{"capacidad": "600VA / 330W", "tomasBateria": 4, "tomasProteccion": 2, "tiempoRespaldo": "Hasta 10 min (carga media)", "tipoOnda": "Onda escalonada", "display": false, "colorPrincipal": "Negro"}'::jsonb),
('Eaton 3S 700VA', 'Eaton', 170000, 13, 'UPS con mayor autonomia y estabilizador de voltaje automatico (AVR), ideal para setups gamer.', 'UPS', '{"capacidad": "700VA / 420W", "tomasBateria": 4, "tomasProteccion": 2, "tiempoRespaldo": "Hasta 15 min (carga media)", "tipoOnda": "Onda escalonada", "avr": true, "display": true, "colorPrincipal": "Negro"}'::jsonb);

-- ============ CÓDIGOS (HT-0001…) ============
with numerados as (
  select id, row_number() over (order by nombre) as rn
  from productos where codigo is null
)
update productos p
set codigo = 'HT-' || lpad(n.rn::text, 4, '0')
from numerados n where n.id = p.id;

alter table productos alter column codigo set not null;

-- ============ OFERTAS (para el carrusel) ============
update productos set descuento_porcentaje = 10,
  precio_con_descuento = round(precio * 0.90, 2)
where nombre in ('RX 7900 XTX XFX 24GB', 'Monitor Gigabyte AORUS 27 QHD 165Hz',
  'Teclado Logitech G915 TKL Wireless', 'SteelSeries Arctis Nova Pro Wireless',
  'Secretlab Titan Evo 2022', 'NZXT Kraken 280mm AIO RGB');

-- ============ DESTACADOS (para el banner) ============
update productos set destacado = true
where nombre in ('RTX 4090 ASUS ROG STRIX 24GB',
  'Monitor Samsung Odyssey G7 32 240Hz',
  'Teclado Logitech G915 TKL Wireless');

-- Verificación rápida (debe devolver 54 | 16 | 6 | 3)
select count(*) as productos,
  (select count(distinct categoria) from productos) as categorias,
  (select count(*) from productos where descuento_porcentaje > 0) as ofertas,
  (select count(*) from productos where destacado) as destacados
from productos;
