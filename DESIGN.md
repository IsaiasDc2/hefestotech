---
name: HefestoTech
description: Ecommerce gaming de alto contraste, acentos índigo y latón, voz rioplatense. Doble tema (noche + día propio).
colors:
  primary: "#6366F1"
  primary-deep: "#4338CA"
  primary-day: "#4F46E5"
  accent-sky: "#0EA5E9"
  accent-sky-day: "#0284C7"
  loot-brass: "#C9A86A"
  loot-brass-day: "#8C7146"
  night-bg: "#0B0E14"
  surface: "#121724"
  card: "#171E2D"
  card-2: "#1E2638"
  line: "#2A3449"
  line-soft: "#1A2233"
  ink: "#F1F5F9"
  muted: "#94A3B8"
  muted-deep: "#7A8AA3"
  day-bg: "#F4F6FB"
  day-surface: "#FFFFFF"
  day-elevated: "#EAF0F8"
  day-ink: "#0F172A"
  day-muted: "#475569"
  day-faint: "#64748B"
  day-line: "#D7DEE9"
  day-line-soft: "#E5EAF2"
  signal: "#10B981"
  signal-day: "#047857"
  alert: "#E5484D"
  alert-day: "#DC2626"
  warning: "#F59E0B"
  warning-day: "#B45309"
typography:
  display:
    fontFamily: "Oswald, Arial Narrow, Impact, system-ui, sans-serif"
    fontSize: "clamp(2rem, 1.4rem + 3vw, 3.25rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "0.015em"
  headline:
    fontFamily: "Oswald, Arial Narrow, Impact, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 1.15rem + 1.75vw, 2.25rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "0.015em"
  body:
    fontFamily: "Inter, Segoe UI, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Inter, Segoe UI, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.08em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  full: "999px"
spacing:
  space-1: "0.25rem"
  space-2: "0.5rem"
  space-3: "0.75rem"
  space-4: "1rem"
  space-5: "1.5rem"
  space-6: "2rem"
  space-7: "2.5rem"
  space-8: "3.5rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0.8rem 1.4rem"
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0.8rem 1.4rem"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.8rem 1.4rem"
  button-danger:
    backgroundColor: "{colors.alert}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0.8rem 1.4rem"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "1.4rem"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0.65rem 0.9rem"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    rounded: "{rounded.full}"
    padding: "0.7rem 1.5rem"
---

# Design System: HefestoTech

## Overview

**Creative North Star: "El Arsenal"**

HefestoTech se ve como un arsenal nocturno: superficies de grafito profundo, instrumentación precisa y dos municiones de color — índigo para la acción, latón para el botín. Nada decora por decorar; cada brillo señala algo comprable, seleccionable o alcanzable. La densidad es de catálogo (grillas de 4, carruseles, chips de marca), pero el ritmo lo marcan picos editoriales — banner, titulares condensados en mayúsculas — que separan las zonas de exploración.

La voz visual es rioplatense y directa, igual que el copy. El sistema vive en dos temas: noche táctica (default, escena de uso gaming) y día propio (papel frío con acento índigo ajustado, no negativo del oscuro).

**Key Characteristics:**
- Doble tema con tokens semánticos (`data-theme` en `<html>`): oscuro táctico + claro diurno propio.
- Dos acentos disciplinados (índigo acción, latón precio/trofeo) en ambos temas.
- Tipografía condensada en mayúsculas para titulares, Inter legible para todo lo demás.
- Cards elevadas con borde de 1px y glow solo como respuesta a hover/foco.
- Ritmo por picos: banner editorial, grillas densas, beneficios en fila.

## Colors

Fría y contenida: el índigo manda en la acción, el latón solo aparece donde hay precio, oferta o logro; los neutrales azulados sostienen el resto.

### Primary
- **Índigo Arsenal** (#6366F1): la única voz de la acción. Botones primarios, focos, enlaces activos, gradiente de marca junto al celeste. Blanco encima (contraste 4.5:1 en controles).
- **Índigo Profundo** (#4338CA): hover, scrollbar y estados presionados del primario.

### Secondary
- **Celeste Trazadora** (#0EA5E9): segunda mitad del gradiente de marca, información y estados de progreso. Nunca compite con el índigo por la acción principal.

### Tertiary
- **Latón Botín** (#C9A86A): precio final en oferta, insignias de oferta, estrellas de rating, envíos destacados. Su rareza es su fuerza.
- **Ámbar Aviso** (#F59E0B): advertencias y rating. Comparte valor con la estrella.
- **Señal Verde** (#10B981): stock disponible, éxito, confirmaciones.
- **Alerta Roja** (#E5484D): errores, agotado, acciones destructivas.

### Neutral
- **Noche Cerrada** (#0B0E14): fondo de página.
- **Grafito Táctico** (#121724): superficies (inputs, barras, header).
- **Blindaje** (#171E2D) / **Blindaje Elevado** (#1E2638): cards y medios.
- **Línea de Trinchera** (#2A3449) / **Línea Suave** (#1A2233): bordes y separadores.
- **Humo Blanco** (#F1F5F9): texto principal (17.6:1 sobre fondo).
- **Niebla** (#94A3B8): texto secundario (7.5:1).
- **Niebla Profunda** (#7A8AA3): placeholders y metadatos (5.5:1, mínimo AA).

### Named Rules
**The Two-Ammo Rule.** Solo el índigo actúa y solo el latón celebra. Ningún otro tono reclama una región o un rol.
**Theme Rule (reemplaza Night-Only).** Diseñar en ambos temas desde el inicio; el claro es diseño propio (acento índigo-600, bordes visibles, sombras suaves tintadas), jamás inversión automática del oscuro.

### Tokens semánticos finales (contrato light/dark)

Capas: primitiva (`--primitive-*`, crudos) → semántica (esta tabla) → componente. En componentes usar siempre la columna semántica. Aliases legacy (`--bg`, `--surface`, `--card`, `--muted`, `--primary`, `--oro`, etc.) apuntan a la semántica por compatibilidad.

| Semántico | Oscuro (`dark`) | Claro (`light`) | Rol |
|---|---|---|---|
| `--background` | `#0B0E14` | `#F4F6FB` | fondo de página |
| `--surface` | `#121724` | `#FFFFFF` | superficies (inputs, header) |
| `--surface-elevated` | `#171E2D` | `#FFFFFF` | cards |
| `--surface-elevated-2` | `#1E2638` | `#EAF0F8` | medios / skeleton |
| `--text` | `#F1F5F9` | `#0F172A` | texto principal |
| `--text-muted` | `#94A3B8` | `#475569` | texto secundario |
| `--text-faint` | `#7A8AA3` | `#64748B` | placeholders / metadatos |
| `--border` | `#2A3449` | `#D7DEE9` | bordes (1px visible en ambos) |
| `--border-soft` | `#1A2233` | `#E5EAF2` | separadores |
| `--accent` | `#6366F1` | `#4F46E5` | acción |
| `--accent-hover` | `#4338CA` | `#4338CA` | hover / pressed |
| `--accent-sky` | `#0EA5E9` | `#0284C7` | info / progreso |
| `--gold` | `#C9A86A` | `#8C7146` | ofertas / precio / trofeo |
| `--success` | `#10B981` | `#047857` | stock / éxito |
| `--warning` | `#F59E0B` | `#B45309` | avisos / rating |
| `--danger` | `#E5484D` | `#DC2626` | errores / destructivo |
| `--focus-ring` | `rgba(99,102,241,.45)` | `rgba(79,70,229,.35)` | anillo de foco |

Pares de contraste verificados (AA): oscuro `ink/bg` 17.6:1, `muted/bg` 7.5:1; claro `day-ink/day-surface` ~15:1, `day-muted/white` ~7:1, `primary-day` con blanco ~6.9:1 (botón), `brass-day` sobre blanco ~4.9:1 (precio en oferta), `success-day`/`warning-day`/`danger-day` ≥4.5:1 sobre blanco.

### Tokens fundacionales (d) — aditivos, par dark/light

Nuevos en `src/styles/index.css` (capa Fundación, no rompen aliases). Superficies: `--surface-1/2/3` → `surface`/`surface-elevated`/`surface-elevated-2` en ambos temas. Overlay/scrim: `--overlay` (dark `rgba(11,14,20,.6)` / light `rgba(15,23,42,.4)`), `--scrim` (degradado a 72%/50%). Glows solo-hover: `--glow-brand`, `--glow-gold` (Flat-At-Rest: nunca en reposo). Hairline: `--hairline-top` (gradiente índigo 1px). Radio: `--radio-card: 16px`. Sombras: `--shadow-rest/lift/pop` (dark negras + marca; light tintadas slate + marca). Gradiente primario AA-safe: `--grad-primary` = índigo→índigo-profundo (equivale a `--grad-marca`; el violeta claro no da AA en texto chico). Movimiento: `--dur-150/220/450/650` + `--ease-emil: cubic-bezier(.16,1,.3,1)`. Utilidades: `.ht-btn(-primary/-ghost)` con hover/active/focus/disabled, `.ht-badge(--brand/--gold/--ok/--danger)`. Fondo con profundidad en `body::before/after` (fijo, `pointer-events: none`, opacidad reducida en ≤560px). `::selection` índigo/blanco, scrollbar fino 8px a tono, `focus-visible` unificado (outline + `box-shadow` con `--focus-ring`). Footer: entrada `ht-footer-entrada` 650ms ease-emil (solo opacity/transform) + hovers con tokens. `prefers-reduced-motion`: sin movimiento ni fondo decorativo, se conservan cambios de color/opacidad.

### Divergencias documentadas (accesibilidad primero)
- `--grad-marca` es índigo→índigo-profundo (`#6366F1→#4338CA`), no índigo→celeste: el blanco sobre índigo→celeste no llega a 4.5:1 en texto chico de CTA.
- `input::placeholder` usa Niebla (`#94A3B8`) en vez de Niebla Profunda: el placeholder chico en `#7A8AA3` no llega a 4.5:1.

## Typography

**Display Font:** Oswald (con Arial Narrow, Impact de respaldo)
**Body Font:** Inter (con Segoe UI, system-ui de respaldo)

**Character:** Titulares de armería — condensados, mayúsculos, pesados — sobre un cuerpo neutro y legible. El precio usa la voz display con números tabulares.

### Hierarchy
- **Display** (600, clamp 2–3.25rem, 1.1): héroes y títulos de página, siempre en mayúsculas.
- **Headline** (600, clamp 1.5–2.25rem, 1.1): titulares de sección.
- **Title** (600, 1.2–1.5rem, 1.1): nombres de producto y cards.
- **Body** (400, 0.9375rem, 1.55): descripción y UI general, medida 65–75ch.
- **Label** (700, 0.75rem, tracking 0.08em, mayúsculas): kickers, badges, categorías.

### Named Rules
**The Shout-Once Rule.** Un display por viewport. Si todo grita en mayúsculas, nada es titular.

## Layout

Contenedor de 1280px centrado con respiración lateral (1.5rem, 1rem en teléfonos). Grilla de catálogo de 4 columnas → 2 en tablet (1024px) → 1 en móvil (560px); categorías de 6 → 3 → 2. Ritmo vertical en múltiplos de la escala space (secciones cada 3rem). El resumen del checkout es sticky en desktop y se apila debajo en móvil (900px). Táctil: blancos mínimos de 44px en puntero grueso.

## Elevation & Depth

Híbrido: capas tonales (fondo → superficie → card) para la estructura, sombras reales solo como respuesta a estado. En reposo las superficies son planas con borde de 1px; el glow índigo y la elevación aparecen en hover, foco o apertura (drawer, dropdowns).

### Shadow Vocabulary
- **Reposo de card** (`box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45)`): profundidad base sin color.
- **Respuesta de marca** (`box-shadow: 0 6px 24px rgba(99, 102, 241, 0.25)`): hover en acciones y cards destacadas.
- **Anillo de foco** (`box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.45)` más `outline: 2px solid`): foco de teclado global.

### Named Rules
**The Flat-At-Rest Rule.** Sin glow en reposo. La luz es recompensa a la interacción, no ambiente.

## Shapes

Bordes redondeados en tres pasos (8/12/16px) más píldora total (999px) para badges, chips y contadores. Los botones usan 10–12px; las cards 12–16px con borde de 1px en tono línea. Sin recortes geométricos ni máscaras decorativas: la silueta es siempre rectángulo redondeado.

## Components

### Buttons
- **Shape:** redondeado medio (10–12px), peso 700–800.
- **Primary:** gradiente índigo→celeste sobre blanco, sombra de marca; hover eleva 1px y aclara; active escala a 0.98.
- **Hover / Focus:** anillo de foco índigo global visible en teclado.
- **Ghost:** superficie con borde de línea; hover tiñe el borde de índigo. **Danger:** tinte rojo suave con borde rojo.

### Chips
- **Style:** píldora en superficie, texto niebla, borde de línea, mayúsculas con tracking.
- **State:** hover/active invierten a tinte índigo con borde de marca.

### Cards / Containers
- **Corner Style:** grande (12–16px).
- **Background:** degradado sutil card-elevada→superficie.
- **Shadow Strategy:** reposo oscuro, glow índigo en hover.
- **Border:** 1px en tono línea; acento superior de 1px en gradiente de marca (sutil, nunca grueso).
- **Internal Padding:** 0.9–1.4rem según densidad.

### Inputs / Fields
- **Style:** superficie con borde de línea, radio 8px, icono a la izquierda cuando aplica.
- **Focus:** borde índigo más anillo suave; el icono se tiñe de índigo.
- **Error / Disabled:** badge rojo con `role="alert"`; deshabilitado en superficie sin sombra.

### Navigation
- Sticky con blur, enlaces en niebla que aclaran en hover; el activo lleva tinte índigo y subrayado en gradiente. En móvil colapsa a buscador de ancho completo y categorías con scroll horizontal.

### Banner Carousel (signature)
- Tres diapositivas fotográficas con velo para legibilidad, autoplay de 6s que se pausa en hover/foco y respeta `prefers-reduced-motion`. Flechas, puntos con progreso y contador numérico, todo operable por teclado y táctil (`touch-action: pan-y`).

## Marca

- **Logo:** original intacto en `ecomers/client/public/brand/logo-original.jpeg` (JPEG sin alfa, no se recorta ni se redibuja). Derivados con alfa: `logo-symbol.png/.webp` (chip, header/badges/estados) y `logo-lockup.png/.webp` (símbolo + texto, footer/OG/404). Componente `Marca` (`variante="simbolo"|"lockup"`, `width/height` siempre definidos, CLS=0, `eager` + `fetchPriority` solo en header).
- **Variantes:** `simbolo` legible desde 30–36px (header); `lockup` solo ≥150px de ancho (footer, OG, 404).
- **Zona de seguridad:** padding propio del derivado + aire mínimo equivalente a 1/4 del ancho del símbolo alrededor; nada invade ese aire (texto, bordes, iconos).
- **Tamaño mínimo:** símbolo 24px digital (30px recomendado en header móvil); lockup 150px de ancho. Debajo de eso, usar solo wordmark en texto.
- **Qué no hacer:** no estirar/comprimir, no rotar, no cambiar colores del logo, no ponerlo sobre fondos que maten su contraste sin velo, no agregar glows/sombras permanentes (Flat-At-Rest), no recortar el JPEG original, no inventar un tercer lockup.

## Tema (mecánica)

- `data-theme="dark"|"light"` en `<html>`; default `dark`. Sin preferencia guardada se respeta `prefers-color-scheme`. La preferencia se guarda en `localStorage("ht-tema")` y los cambios del sistema solo aplican si no hay preferencia guardada.
- Script anti-flash inline en `index.html` (antes del primer render) + `color-scheme: dark light` y dos `theme-color` por esquema (`#0B0E14` / `#F4F6FB`).
- Control único accesible: botón `.topbar-tema` en `Navbar` (hook `useTema`), con `aria-pressed`, `aria-label` bilingüe y Sol/Luna según tema. No duplicar toggles en otras vistas.

## Section (tono fijo + mapa de alternancia)

Componente `src/components/layout/Section.jsx` (+ `Section.css`), prop `tono="dark"|"light"` (default `dark`). El tono es absoluto: `section--dark` siempre noche (`#0B0E14`/`#F1F5F9`), `section--light` siempre papel (`#F4F6FB`/`#0F172A`), independiente del `data-theme` global. Estructura: `<section class="section section--{tono}"><div class="section__inner">{children}</div></section>`, prop `labelledBy` para accesibilidad.

| Orden en página | Tono | Uso |
|---|---|---|
| 1. Hero / banner impacto | `dark` | editorial nocturno, titulares display, CTA primario |
| 2. Listados / catálogo / exploración | `light` | grillas densas, lectura larga, precio latón-day |
| 3. Beneficios / confianza / cierre | `dark` | garantías, envíos, testimonios, CTA final |

Regla: nunca dos claras seguidas ni más de dos oscuras seguidas; una sola inversión fuerte por viewport. Eyebrow max 1 cada 3 secciones (Section no impone eyebrow).

## Estructura futura propuesta (SIN aplicar — requiere aprobación)

No reorganizar carpetas ahora. Propuesta a aprobar: colapsar `src/components/layout/` + `src/components/brand/` en `src/components/ui/` con subcarpetas `layout/` y `brand/`, y mover tokens a `src/styles/tokens.css` importado por `index.css`; `Section` sería el primer habitante de `ui/layout/`. Sin cambios de imports hasta aprobación.

## Do's and Don'ts

### Do:
- **Do** usar el índigo solo para lo accionable y el latón solo para precio/logro.
- **Do** mantener texto ≥4.5:1 y texto grande ≥3:1 (pares verificados en la auditoría).
- **Do** dar 44px a los blancos táctiles en puntero grueso.
- **Do** pausar el autoplay en hover, foco o `prefers-reduced-motion`.
- **Do** escribir el copy en voseo rioplatense consistente.

### Don't:
- **Don't** introducir tonos fuera de los tokens (nada de rojos o verdes improvisados en glows y sombras).
- **Don't** usar bordes de acento laterales o superiores de más de 1px en cards.
- **Don't** animar propiedades de layout (width/height/margin) salvo rellenos de progreso discretos.
- **Don't** dejar `will-change` en reposo ni glow permanente sin interacción.
- **Don't** mezclar tuteo y voseo en el mismo flujo.
