# Cobertura de specs para el Armador — qué se puede inferir de los nombres

Fecha: 2026-10-10 · Fuente analizada: `supabase/migrations/001_productos.sql` (54 productos seed).
Objetivo: estimar cuántos datos del motor (`src/armador/motor.js`) salen del **nombre** del producto
y cuántos exigen **carga manual** en `product_specs` (migración `004`).

> Ojo: "inferible" acá quiere decir extraíble con regex/tabla de familias, NO verificado.
> Todo lo inferido entra con `source='inferred', verified=false` y alguien lo tiene que confirmar.
> El motor jamás asume compatible por defecto: sin dato verificado, la regla da `unknown`.

## Alcance

- Productos relevantes para el motor: **33 de 54** (CPU, GPU, mother, RAM, almacenamiento, fuente, gabinete, cooler).
- Los otros 21 (monitores, periféricos, sillas, etc.) no los toca ninguna regla: cobertura N/A.

## Metodología

Por cada producto conté los campos que el motor necesita (slots) y marqué cuáles salen del nombre
con un patrón confiable o una heurística de familia (ej: chipset B650 → socket AM5).
Las heurísticas van a `inferred` y requieren verificación humana igual que todo lo demás.

## Tabla por categoría

| Categoría | Productos | Campos del motor | Inferibles del nombre | % | Detalle |
|---|---|---|---|---|---|
| Procesadores | 6 | socket, tdpW, tieneIGPU (18 slots) | ~10 | ~55% | Socket por familia (AM5/LGA1700) ✓; iGPU por sufijo F/G/K parcial; **TDP 0%** (no está en ningún nombre) |
| Placas de video | 6 | longitud, consumo, fuenteRec., 8-pin, 12VHPWR (30 slots) | 0 | **0%** | El nombre da la VRAM, que el motor no usa. Largo, consumo y conectores: todo manual |
| Motherboards | 3 | socket, memoriaTipo, ranuras, máxGB, formato, M.2, SATA, chipset (24 slots) | ~9 | ~38% | Chipset en el nombre ✓; socket y tipo de RAM por tabla chipset (heurística); ranuras, formato y slots: manual |
| Memoria RAM | 4 | tipo, formato, capacidad, módulos (16 slots) | ~12 | ~75% | DDR4/DDR5 y capacidad total en el nombre ✓; split (2x16) y DIMM: heurística; n° de módulos: manual |
| Almacenamiento | 5 | tipo NVMe/SATA (5 slots) | 5 | **100%** | "NVMe" está en 4 nombres; el Barracuda HDD → SATA por heurística |
| Fuentes | 3 | potencia, 12VHPWR, 8-pin, formato (12 slots) | 3 | 25% | Potencia ("850W") ✓; conectores y formato: manual |
| Gabinetes | 3 | formatosMother, maxGpu, maxCooler, radiador, formatosFuente (15 slots) | ~1 | ~7% | Casi todo manual; solo el Q300L sugiere micro-ATX (heurística floja) |
| Coolers | 3 | tipo, sockets, altura/radiador, TDPmáx (12 slots) | ~4 | ~33% | Tipo por modelo (heurística); "280mm" del Kraken da el radiador ✓; sockets, altura y TDP: manual |

## Resultado global

- **Slots totales: 132 · Inferibles del nombre: ~44 → ~33%.**
- **Carga manual estimada: ~88 celdas** (más verificación de las 44 inferidas).
- En productos: 0 de 33 quedan completos solo con el nombre. Los 33 necesitan al menos un dato manual.

## Patrones de extracción propuestos (todo a `inferred`)

1. `/DDR[45]/` → `RAM.tipo`. `/(\d+)GB/` → capacidad total.
2. `/(\d{3,4})W/` en fuentes → `potenciaW`.
3. Chipset en nombre (`B650`, `B760`, `X670E`) → `chipset` + tabla chipset→socket/memoria (heurística).
4. `/NVMe|HDD|SSD SATA/` → `almacenamiento.tipo`.
5. Sufijos CPU `F/KF` → `tieneIGPU=false`; `G` o Intel `K` → `true` (heurística, verificar X3D y 14va gen).
6. `/(\d{3})mm/` en AIOs → `radiadorMm`.

## Lo que esto implica

1. La GPU es el agujero negro: 30 celdas manuales (largo, consumo, conectores). Sin eso, las reglas de gabinete y fuente quedan en `unknown` y el armador no aprueba nada.
2. El TDP de CPUs y coolers tampoco existe en los nombres: sin eso no hay regla de disipación ni de potencia.
3. Recomendación: cargá primero GPU + CPU + mother (desbloquean la mayoría de las reglas), después fuente, gabinete y cooler. La RAM y el almacenamiento salen casi solos.
