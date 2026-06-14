# DropZone Admin Dashboard - Design System

## Global Aesthetic
**Editorial Corporate Minimalist (Inspired by Lumena Partners)**
High-end, authoritative, clean, and extremely high contrast. Zero glassmorphism. Flat colors, incredibly clean typography, and precise grid layouts. It must look like a premium corporate consultancy or high-end architectural firm's dashboard.

## Color Palette (Light/Dark Mode Support)
We rely on Tailwind's `dark:` classes for toggling between the two modes.

### Backgrounds
- **Light Mode:** Warm, creamy beige/off-white (`bg-[#F7F5EE]`)
- **Dark Mode:** Deep forest green/almost black (`dark:bg-[#0A2522]`)
- **Panels/Cards (Light):** Solid pure white (`bg-white`) or flat light beige (`bg-[#EFECE3]`). No translucency.
- **Panels/Cards (Dark):** Solid deep dark green (`dark:bg-[#061816]`).

### Typography Colors
- **Light Mode Primary:** Deep forest green (`text-[#0A2522]`) or pure black (`text-black`).
- **Dark Mode Primary:** Warm beige (`dark:text-[#F7F5EE]`) or soft white.
- **Accents:** A muted, sophisticated yellow/gold (`#D9C999`) or bright lime/neon green (`#B4F26B`) used *very sparingly* for active states or critical badges.

### Borders
- Ultra-thin, solid 1px borders. 
- **Light Mode:** `border-[#0A2522]/10` or pure black lines.
- **Dark Mode:** `dark:border-[#F7F5EE]/10` or solid white lines.

## Typography
- Use grotesque sans-serif fonts (e.g., `font-sans` with tight tracking `-tracking-tighter` for large headers).
- Headlines must be massive, clean, and high-contrast. (e.g., "Humanizing Performance. Backed by Insight.")
- Labels must be small, capitalized, and tracked out (`text-[10px] uppercase tracking-widest`).

## UI Elements
- **Buttons:** Pill-shaped or sharp rectangular. Solid fill. High contrast hover states (e.g., in light mode, a button is dark green `bg-[#0A2522] text-white`. On hover, it flips or fades).
- **Tables:** Extremely clean. No alternating row colors, just 1px solid horizontal dividing lines.
- **Badges (Severity):** 
    - CRITICAL: Solid red/orange (`bg-[#FF3B30] text-white`)
    - HIGH: Solid bright yellow (`bg-[#FFCC00] text-black`)
    - MEDIUM/LOW: Muted solid gray or beige.

## Layout
- Strict 12-column grid feel. 
- Ample negative space (padding). 
- Do not use shadows (`shadow-none`) to keep the design completely flat.

## Animations
- Subtle, smooth transitions (`transition-all duration-300 ease-in-out`). No glowing pulses or neon effects, except maybe a tiny pure red dot for "Live Connection".
