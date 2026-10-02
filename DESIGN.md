---
name: HefestoTech
description: Ecommerce gaming oscuro de alto contraste, acentos índigo y latón, voz rioplatense.
colors:
  primary: "#6366F1"
  primary-deep: "#4338CA"
  accent-sky: "#0EA5E9"
  loot-brass: "#C9A86A"
  night-bg: "#0B0E14"
  surface: "#121724"
  card: "#171E2D"
  card-2: "#1E2638"
  line: "#2A3449"
  line-soft: "#1A2233"
  ink: "#F1F5F9"
  muted: "#94A3B8"
  muted-deep: "#7A8AA3"
  signal: "#10B981"
  alert: "#E5484D"
  warning: "#F59E0B"
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
    backgroundColor: "{colors.primary}"
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

La voz visual es rioplatense y directa, igual que el copy. El sistema vive solo en modo oscuro: la noche es la escena de uso (gaming después del trabajo), no una preferencia temática.

**Key Characteristics:**
- Oscuro táctico con dos acentos disciplinados (índigo acción, latón precio/trofeo).
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
**The Night-Only Rule.** No existe tema claro. Diseñar en oscuro siempre; derivar el texto secundario del fondo, jamás grises genéricos lavados.

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
