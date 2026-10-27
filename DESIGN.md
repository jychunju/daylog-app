---
name: Serene Botanical Editorial
colors:
  surface: '#f9f9ff'
  surface-dim: '#d3daef'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3ff'
  surface-container: '#e9edff'
  surface-container-high: '#e1e8fd'
  surface-container-highest: '#dce2f7'
  on-surface: '#141b2b'
  on-surface-variant: '#3e4943'
  inverse-surface: '#293040'
  inverse-on-surface: '#edf0ff'
  outline: '#6e7a73'
  outline-variant: '#bdc9c1'
  surface-tint: '#006c4e'
  primary: '#005d42'
  on-primary: '#ffffff'
  primary-container: '#047857'
  on-primary-container: '#9ffdd3'
  inverse-primary: '#7bd8b1'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#005d42'
  on-tertiary: '#ffffff'
  tertiary-container: '#007857'
  on-tertiary-container: '#8fffd0'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#97f5cc'
  primary-fixed-dim: '#7bd8b1'
  on-primary-fixed: '#002115'
  on-primary-fixed-variant: '#00513a'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#80f9c8'
  tertiary-fixed-dim: '#62dcad'
  on-tertiary-fixed: '#002115'
  on-tertiary-fixed-variant: '#00513a'
  background: '#f9f9ff'
  on-background: '#141b2b'
  surface-variant: '#dce2f7'
typography:
  display:
    fontFamily: Newsreader
    fontSize: 48px
    fontWeight: '400'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-mobile:
    fontFamily: Newsreader
    fontSize: 36px
    fontWeight: '400'
    lineHeight: 44px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Newsreader
    fontSize: 32px
    fontWeight: '500'
    lineHeight: 40px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Newsreader
    fontSize: 26px
    fontWeight: '500'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Newsreader
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Newsreader
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  title-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 3rem
  margin-tablet: 2rem
  margin-mobile: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.75rem
  space-xl: 2.5rem
---

## Brand & Style

This design system embodies mindful productivity, intellectual calm, and effortless clarity. Built for thoughtful planning and personal documentation, the interface behaves like an immaculate physical notebook bound in linen and illuminated by soft morning light. It prioritizes emotional deceleration: reducing cognitive friction, eliminating visual noise, and turning daily capture into a grounding ritual.

The design movement combines **Minimalism** with an **Editorial Tactile** sensitivity. It merges the functional utility of high-end workspace tools with the warmth and deliberate restraint of contemporary Swiss book design. Surfaces feel spacious, natural, and airy rather than sterile. Every element earns its place through utility and balance, relying on generous negative space, crisp typographic weight shifts, and understated botanical tones rather than gratuitous decorations or loud gradients.

## Colors

The palette establishes an organic, quiet atmosphere anchored in deep botanical greens and soft, desaturated leaf undertones. 

- **Primary Canvas & Surfaces:** The root backdrop is pale mint-tinted alabaster (`#f6f9f7`), preventing harsh optical glare. Elevated work surfaces and active entry sheets shift to crisp pure white (`#ffffff`) to define focused writing planes.
- **Accents:** 
  - Primary (`#047857`): Deep, authoritative forest sage used for key actions, committed states, and primary focal anchors.
  - Secondary (`#10b981`): Vibrant botanical emerald for positive progress states, success badges, and interactive active touches.
  - Tertiary (`#6ee7b7`): Gentle eucalyptus wash for subtle selection highlights, badge fills, and active day markers.
- **Neutrals & Text:** Deep charcoal (`#111827`) provides sharp, ink-like contrast for headings and primary body content. Neutral body text sits at graphite (`#374151`), while secondary annotations and structure labels use muted stone (`#6b7280`). Structural dividers and hairline borders use a dilute botanical grey (`#e5ebe7`).

## Typography

The typographical hierarchy creates intentional rhythm through a pairing of literary warmth and precise functional clarity.

- **Headlines & Editorial Focus (Newsreader):** Headlines evoke the calm discipline of essays and classic journals. It features soft transitional serifs, gentle italics for dates and metadata, and comfortable proportions that invite extended contemplation.
- **Interface & Content Body (Plus Jakarta Sans):** Neutral, modern, and open, this typeface ensures zero eye fatigue across checklists, sidebars, dense schedules, and rapid inline notes.
- **Handling & Pacing:** Headings should not be styled in loud, heavy bolding; medium (`500`) weights preserve airiness. All metadata labels (`label-md`, `label-sm`) use subtle uppercase tracking to delineate system information without interrupting narrative flow.

## Layout & Spacing

The layout philosophy prioritizes generous margins and a focused document center. Content never crowds the edges of the display.

- **Grid Architecture:** 
  - Desktop uses a central document canvas capped at `760px` for pure writing views, nested inside an asymmetric fluid shell that accommodates a slim 240px navigation column and secondary contextual rail.
  - Tablet condenses navigation into a collapsible drawer, maintaining an ample centered reading canvas.
  - Mobile drops outer margins to `1.25rem`, relying on vertical stacked rhythm rather than multi-column structures.
- **Spacing Rhythm:** Vertical spacing defaults to generous leaps (`space-lg` to `space-xl`) between narrative blocks, daily sections, and conceptual breaks. Component-internal spacing remains tight and predictable using `space-xs` through `space-md` to preserve atomic unity.

## Elevation & Depth

This system avoids dark, heavy, or muddy drop shadows, relying instead on tonal layering, delicate surface delineation, and ambient leaf-tinted diffusion.

- **Surface Tiers:**
  - Base: Pale mint alabaster (`#f6f9f7`).
  - Container / Card: Pure paper white (`#ffffff`).
  - Overlay / Flyout: Pure white (`#ffffff`) accompanied by an ultra-fine border.
- **Low-Contrast Outlines:** Panels, inputs, and modular cards utilize a 1px crisp outline tinted with a faint organic hue: `rgba(4, 120, 87, 0.08)`.
- **Ambient Diffusion:** Floating dialogs, popovers, and contextual action menus cast a faint, wide-radius shadow tinted with sage pigment: `0 12px 36px -4px rgba(4, 120, 87, 0.06), 0 4px 12px -2px rgba(17, 24, 39, 0.02)`. Active drag states for task items elevate with an added crisp focus ring rather than heavier dark shadows.

## Shapes

The shape system employs balanced, organic corner curves that feel tactile, welcoming, and gently softened.

- Base interactive items, entry inputs, checkboxes, and inline tags feature a standard radius of `0.5rem` (`roundedness: 2`).
- Content cards, journal panels, and modal containers use `rounded-lg` (`1rem`) to mirror physical rounded-corner notebooks.
- Interactive status indicators, date pickers, and filter pills leverage fully rounded caps (pill style) to distinguish quick tags from structured content surfaces.

## Components

### Buttons
- **Primary:** Solid forest green (`#047857`) background with pure white text. Hover transitions to `#065f46`. Active state shifts subtly down via micro-scale (`scale(0.99)`). 
- **Secondary / Ghost:** Off-white or transparent surface with `#047857` label and a 1px `rgba(4, 120, 87, 0.15)` border. Hover introduces a soft eucalyptus tint (`rgba(16, 185, 129, 0.08)`).
- **Text Action:** Clean dark charcoal text (`#111827`) with no container border. Gains a soft under-bar or pale green background highlight on hover.

### Chips & Tags
- Compact height (`26px` to `28px`) with `0.5rem` or pill radii.
- Default chip uses a gentle wash (`rgba(4, 120, 87, 0.06)`) with deep sage text (`#047857`). Selected chips invert to solid `#047857` with white text.

### Lists & Note Trees
- Clean, uncluttered list rows separated by generous line-height (`space-md`) rather than heavy rules.
- Drag-and-drop handles remain muted (`#9ca3af`) until hovered. Indentations rely on light guideline strokes in `rgba(4, 120, 87, 0.1)`.

### Checkboxes & Radio Buttons
- Custom square with `4px` smooth rounding. Outline is `1.5px` in `#9ca3af`.
- On check, the container fills smoothly with `#047857`, revealing a crisp white checkmark stroke. Completed list items transition their label to `#6b7280` with a clean strikethrough.

### Input Fields & Textareas
- Distraction-free surfaces. Single-line and rich-text areas sit on pure white cards or borderless sheet canvases.
- Focused state applies an immediate border tint of `#047857` accompanied by an ambient green halo (`0 0 0 3px rgba(16, 185, 129, 0.12)`). Placeholder copy is rendered in warm stone (`#9ca3af`).

### Cards & Daily Sections
- Pure white `#ffffff` canvas surrounded by a hairline `rgba(4, 120, 87, 0.08)` border.
- Generous internal padding (`space-lg`). Header areas within cards pair an italicized serif entry title with an uppercase sans metadata indicator.

### Mood & Metric Logs
- Minimal inline trackers utilizing a 5-step monochromatic botanical scale (from soft eucalyptus `#d1fae5` to saturated forest `#047857`) for quick visual indexing without high-contrast visual clutter.