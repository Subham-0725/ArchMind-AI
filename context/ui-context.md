# UI Context

## Theme

**Dark-Only Technical UI**  
ArchMind AI uses a dark-only technical workspace design language with near-black backgrounds (`#04060b`), layered glass-morphic surfaces, and vivid cyan/blue accent colors for interactive elements. The design emphasizes depth through subtle glows, backdrop blur, and ambient lighting effects.

## Colors

All components use Tailwind utility classes. The core palette is defined through consistent hex values:

| Role                    | Tailwind Classes / Hex Values                                   | Usage                                           |
| ----------------------- | --------------------------------------------------------------- | ----------------------------------------------- |
| Page background         | `#04060b`, `#050811`, `#03050a`                                 | Body, deepest backgrounds                       |
| Primary surface         | `#070c16`, `#070c18`, `#080d1a`, `#080c16`                      | Cards, panels, primary containers               |
| Secondary surface       | `#090e1b`, `#09111f`, `#0a1020`, `#0b1222`, `#0c1324`          | Nested surfaces, input backgrounds              |
| Tertiary surface        | `#0f1b33`, `#05081 3`, `#04060d`, `#04060e`                     | Hover states, active states                     |
| Primary text            | `text-white`, `text-slate-100`, `text-slate-200`                | Headlines, primary content                      |
| Secondary text          | `text-slate-300`, `text-slate-400`                              | Body text, descriptions                         |
| Muted text              | `text-slate-500`, `text-slate-600`                              | Labels, metadata, disabled states               |
| Primary accent (Cyan)   | `#06b6d4`, `text-cyan-300`, `text-cyan-400`, `border-cyan-500`  | Primary interactive elements, status indicators |
| Secondary accent (Blue) | `#3b82f6`, `text-blue-400`, `border-blue-500`                   | Secondary actions, data flow                    |
| Tertiary accent (Indigo)| `#6366f1`, `text-indigo-400`, `border-indigo-500`               | Supporting accents                              |
| Success                 | `text-emerald-400`, `bg-emerald-400`, `#34d399`                 | Success states, positive indicators             |
| Warning                 | `text-amber-400`, `bg-amber-400`                                | Warning states                                  |
| Error                   | `text-red-400`, `bg-red-400`, `#ef4444`                         | Error states, destructive actions               |
| Border default          | `border-white/5`, `border-white/8`, `border-white/10`           | Subtle separators                               |
| Border accent           | `border-cyan-500/30`, `border-cyan-400/40`                      | Interactive borders, focus states               |

### Gradient Patterns

- **Primary gradient**: `from-cyan-400 via-blue-500 to-indigo-500` (hero elements, CTAs)
- **Text gradient**: `from-cyan-300 via-blue-400 to-indigo-400` (headlines)
- **Glass surface**: `from-[#0f172a]/78 to-[#050b16]/88` with blur (modals, overlays)

## Typography

| Role      | Font Family        | Usage                                              |
| --------- | ------------------ | -------------------------------------------------- |
| UI text   | System font stack  | Body text, headlines, general UI (`font-sans`)     |
| Code/mono | Monospace          | Code snippets, technical labels (`font-mono`)      |
| Weights   | `font-medium`, `font-semibold`, `font-bold`, `font-extrabold`, `font-black` | Hierarchy across UI elements |

### Scale

- Micro text: `text-[8px]`, `text-[9px]`, `text-[10px]`, `text-[11px]`
- Small: `text-xs` (12px)
- Base: `text-sm` (14px), `text-base` (16px)
- Headings: `text-lg` (18px), `text-xl` (20px), `text-3xl` (30px), `text-5xl` (48px), `text-6xl` (60px), `text-7xl` (72px)

## Border Radius

| Context                  | Classes                                       |
| ------------------------ | --------------------------------------------- |
| Inline / small UI        | `rounded-md` (6px), `rounded-lg` (8px)        |
| Pills / badges           | `rounded-full`                                |
| Cards / panels           | `rounded-xl` (12px), `rounded-2xl` (16px)     |
| Modals / large surfaces  | `rounded-[28px]`                              |

## Component Library

**Tailwind CSS v4** with custom animations and reusable utility classes. No external component library. Components are hand-crafted in `src/components/` with Framer Motion for animations.

### Key Utility Classes

- `.archmind-glass` — Glass-morphic surface with backdrop blur
- `.archmind-gradient-text` — Animated gradient text
- `.archmind-hover` — Performance-safe hover with transform
- `.animate-aurora-*` — Ambient aurora animation variants (cyan, indigo, sky, violet, slow)
- `.animate-laser-scan` — Vertical laser scan effect
- `.animate-gradient-x` — Horizontal gradient animation
- `.animate-shimmer` — Shimmer highlight effect
- `.animate-pulse-ring` — Expanding pulse ring
- `.gpu-layer` — GPU acceleration helper

## Layout Patterns

- **Navbar**: Fixed top, glassmorphic with backdrop blur, rounded-full container with scroll-aware shadow/border changes
- **Hero Section**: Full-screen with ambient glow backgrounds, radial gradient cursor spotlight, split-pane IDE window (topology graph + code terminal)
- **Feature Cards**: Bento grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`), glass surfaces with hover lift effects and colored accent borders
- **Workflow Cards**: 3-column pipeline with horizontal connector beam (desktop), vertical stack (mobile)
- **CTA Section**: Centered card with corner brackets, top edge light, integrated input + button combo
- **Footer**: Multi-column grid with atmospheric glows, blueprint grid overlay, social icon hover tooltips

## Shadows & Glows

- **Card shadows**: `shadow-[0_15px_30px_rgba(0,0,0,0.35)]`, `shadow-[0_20px_50px_rgba(0,0,0,0.5)]`
- **Cyan glow**: `shadow-[0_0_20px_rgba(6,182,212,0.3)]`, `shadow-[0_0_25px_rgba(6,182,212,0.4)]`
- **Ambient glow**: `bg-cyan-500/[0.035] blur-[100px]` (large radius, low opacity)
- **Focus glow**: `focus-visible:ring-2 focus-visible:ring-cyan-400`

## Motion & Animation

**Framer Motion** for interactive animations. All animations respect `prefers-reduced-motion`.

### Easing

- Spring: `stiffness: 400-500, damping: 20-32`
- Cubic bezier: `[0.16, 1, 0.3, 1]` (primary ease-out)

### Common Patterns

- Hover lift: `whileHover={{ scale: 1.02-1.05, y: -1 to -3 }}`
- Tap: `whileTap={{ scale: 0.96-0.97 }}`
- Stagger reveals: `delay: index * 0.04-0.08`
- Viewport reveals: `initial={{ opacity: 0, y: 18 }}, whileInView={{ opacity: 1, y: 0 }}`

## Icons

**Inline SVG icons** with consistent stroke weights and sizes:

- Micro: `w-3 h-3`, `w-3.5 h-3.5` (status indicators, inline)
- Standard: `w-4 h-4` (buttons, cards)
- Medium: `w-5 h-5`, `w-6 h-6` (larger buttons)
- Stroke: `strokeWidth="2"`, `strokeWidth="2.2"`

Common icon colors: `text-cyan-400`, `text-blue-400`, `text-emerald-400`, `text-slate-400`
