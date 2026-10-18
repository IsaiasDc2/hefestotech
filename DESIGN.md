---
name: HefestoTech
description: Tienda de hardware con estética "oscuro premium". Negro carbón y el celeste eléctrico del logo; fotos de producto en pozos claros.
colors:
  background: "#0A0B0D"
  surface: "#111317"
  surface-elevated: "#16191E"
  surface-elevated-2: "#1D2127"
  border: "#272B33"
  border-strong: "#3A3F48"
  text: "#F3F5F8"
  text-muted: "#A5ACB8"
  text-faint: "#7F8794"
  accent: "#38B6F5"
  accent-hover: "#67C9FA"
  on-accent: "#04121B"
  well: "#F2F3F5"
  success: "#34D399"
  warning: "#FBBF24"
  danger: "#F87171"
  light-background: "#F5F6F8"
  light-accent: "#0A78B5"
typography:
  familia: "Geist Variable (todo el sitio) + Geist Mono Variable (eyebrows, marcas, códigos)"
  display: "clamp(2rem, 1.35rem + 2.6vw, 3.5rem) · 650 · -0.025em a -0.04em · sentence case"
  body: "0.9375rem · 400 · 1.55"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  full: "999px"
spacing: "escala de 4px: 4, 8, 12, 16, 24, 32, 48, 64"
---

# Sistema de diseño: "Carbón"

## Idea

La marca es el logo: chip plateado con trazas celestes sobre gris carbón. El sitio usa exactamente eso. Fondo casi negro, superficies apenas más claras, **un solo acento** (el celeste del logo) para acción, foco, ofertas y estado activo. Nada de dorados, degradados violetas, glow permanente ni titulares en mayúsculas condensadas.

Las fotos de producto vienen con fondo blanco de fábrica. En vez de pegarlas como recuadros blancos sobre negro, viven en un **pozo claro** (`--well`, radio propio, `mix-blend-mode: multiply`) dentro de cards oscuras. Eso hace que todas las fotos, de proveedores distintos, se vean parejas.

## Tokens

Definidos en `ecomers/client/src/styles/index.css` (`:root` oscuro y `:root[data-theme="light"]`). Los nombres viejos (`--bg`, `--primary`, `--oro`, `--card`…) se mantienen como alias para no romper componentes, pero apuntan a la paleta nueva.

| Token | Oscuro | Claro | Uso |
|---|---|---|---|
| `--background` | `#0A0B0D` | `#F5F6F8` | Fondo de página |
| `--surface` | `#111317` | `#FFFFFF` | Cards, inputs, header |
| `--surface-elevated` / `-2` | `#16191E` / `#1D2127` | `#FFF` / `#EEF0F3` | Hover, chips activos |
| `--border` / `--border-strong` | `#272B33` / `#3A3F48` | `#DDE1E7` / `#C5CBD4` | Bordes de 1px |
| `--text` / `--text-muted` / `--text-faint` | `#F3F5F8` / `#A5ACB8` / `#7F8794` | `#0B0D12` / `#4B5361` / `#6B7280` | Texto (todo AA o mejor) |
| `--accent` | `#38B6F5` | `#0A78B5` | Botón principal, foco, ofertas |
| `--on-accent` | `#04121B` | `#FFFFFF` | Texto sobre el acento |
| `--well` | `#F2F3F5` | `#F4F5F7` | Pozo de fotos |

El tema por defecto es **oscuro**. El claro existe como opción del cliente (botón sol/luna); no sigue al sistema operativo.

## Tipografía

- **Geist Variable** para todo; **Geist Mono** para eyebrows, marcas de producto, códigos y etiquetas técnicas.
- Titulares en *sentence case*, peso 650, tracking negativo. Un solo `h1` por página.
- Precios en peso 700 con `tabular-nums`, siempre en el color de texto (no en el acento).

## Componentes clave

- **Header** (`Navbar.jsx`): franja de beneficios, barra sticky con blur (logo, buscador redondeado con botón de acento, favoritos con contador, cuenta, carrito con contador) y fila de categorías reales con scroll horizontal.
- **Tarjeta de producto** (`ProductCard.jsx`): pozo claro 1:1 con badge de descuento y favorito, marca en mono + stock, nombre en 2 líneas, precio, botón que se tiñe del acento al hover. Toda la card navega a la ficha.
- **Hero de la home**: textos + cifras reales del catálogo a la izquierda; vitrina con el producto destacado y dos más, a la derecha. Sin banners de terceros.
- **Ficha**: foto grande en pozo (sticky en escritorio), columna de compra con precio grande y CTA de acento; en celular la barra de cantidad + carrito queda fija abajo.

## Reglas

- **Un acento.** Si algo no es acción, foco u oferta, no usa celeste.
- **Plano en reposo.** Bordes de 1px; elevación solo como respuesta (hover: borde más fuerte y `translateY(-2px)`).
- **Movimiento corto** (120–280 ms, `ease-out`), solo `transform` y `opacity`, y nada con `prefers-reduced-motion`.
- **Táctil**: objetivos de 44px como mínimo.
- **Sin texto inventado**: cifras del hero salen del catálogo; promesas comerciales solo las que ya publica el comercio.
