# Design Brief

## Direction

ChillPong — a dark, video-first streaming platform built 100% on-chain; content is the star, chrome recedes into near-black surfaces.

## Tone

Bold modern dark — a cinematic, content-forward aesthetic where vivid crimson-red play signals pop against a cool near-black canvas, echoing a polished streaming app rather than a generic SaaS.

## Differentiation

A single saturated crimson-red "play" accent (hue 25) used only for action, active, and live states — the rest of the UI stays monochrome-cool so video thumbnails own the color.

## Color Palette

| Token      | OKLCH          | Role                                  |
| ---------- | -------------- | ------------------------------------- |
| background | 0.145 0.012 255| near-black cool canvas                |
| foreground | 0.95 0.01 255  | primary text                          |
| card       | 0.185 0.014 255| video cards / surfaces                |
| primary    | 0.5 0.22 25    | crimson-red brand / play / CTA        |
| accent     | 0.58 0.22 25   | active chips, live badges, highlights |
| muted      | 0.22 0.02 255  | secondary surfaces, thumb placeholders|
| border     | 0.28 0.02 255  | hairline dividers                     |

## Typography

- Display: Space Grotesk — headings, brand, section titles
- Body: DM Sans — UI labels, metadata, descriptions
- Mono: Geist Mono — durations, timestamps, view counts
- Scale: hero `text-4xl md:text-5xl font-bold tracking-tight`, h2 `text-2xl font-semibold tracking-tight`, label `text-xs font-semibold uppercase tracking-widest`, body `text-sm md:text-base`

## Elevation & Depth

Layered near-black surfaces with hairline borders and restrained elevation shadows (`shadow-subtle`, `shadow-elevated`); depth comes from surface lightness steps, not glow.

## Structural Zones

| Zone    | Background   | Border   | Notes                          |
| ------- | ------------ | -------- | ------------------------------ |
| Header  | bg-background | border-b | sticky, translucent, logo left |
| Sidebar | bg-sidebar    | border-r | collapsed rail / flyout        |
| Content | bg-background | —        | alternating muted sections     |
| Footer  | bg-muted/40   | border-t | dimmed, minimal                |

## Spacing & Rhythm

Generous 16–24px gutters; video grid `gap-4 md:gap-6`; tight 8px micro-spacing inside cards; sections separated by 32–48px for breathing room.

## Component Patterns

- Buttons: primary = crimson-red pill, `rounded-full`, white text; hover brightens
- Cards: `rounded-xl`, `bg-card`, `shadow-subtle`, hover `shadow-elevated` + lift
- Badges: `rounded-full` chips; live/active = red, neutral = muted
- Thumbnails: `rounded-lg`, 16:9, hover scale + play overlay

## Motion

- Entrance: staggered `fade-up` 0.4s on feed items
- Hover: card lift + thumbnail scale 0.3s `transition-smooth`
- Decorative: `shimmer` skeleton for loading thumbnails

## Constraints

- Dark-first; light mode is a faithful inversion, not a separate design
- Red reserved for action/play/live — never decorative bulk
- AA+ contrast on all text; thumbnails must stay color-neutral
- DaisyUI theming via CSS variables / OKLCH only; no raw hex in components

## Signature Detail

The crimson-red play accent: a single saturated hue reserved exclusively for watch/action/live moments, making every interactive element instantly scannable against the monochrome-cool dark canvas.
