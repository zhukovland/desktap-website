# Desktap Website — Design Reference

This document describes the current design system and implementation of desktap.app, intended as a reference for design tools (Claude Design, Figma, etc.).

---

## Overview

Single-page dark-theme landing site for Desktap — a native iOS/macOS app that turns iPhone/iPad into a programmable command center for Mac. The design language mirrors the app's glass UI aesthetic on a pure black canvas.

**Live preview:** `python3 -m http.server 8000` → http://localhost:8000

---

## Typography

All fonts are Apple system fonts — zero external font loading:

| Role | Font Stack | Weight | Tracking | Usage |
|------|-----------|--------|----------|-------|
| Display headings | `-apple-system, BlinkMacSystemFont, 'SF Pro Display'` | 700 (Bold) | -0.035em to -0.04em | Hero title, section headings, CTA |
| Body text | `-apple-system, BlinkMacSystemFont, 'SF Pro Text'` | 400–500 | normal | Paragraphs, descriptions, buttons |
| Mono / technical | `'SF Mono', ui-monospace, 'Menlo'` | 400–500 | 0.05–0.12em, uppercase | Labels, badges, terminal, tags, card numbers |

### Heading styles

- **Hero h1:** `clamp(2.8rem, 6vw, 5rem)`, weight 700, line-height 1.06, tracking -0.04em
- **Section h2:** `clamp(2rem, 4vw, 3.2rem)`, weight 700, line-height 1.08, tracking -0.035em
- **Card h3:** 1.0625rem, weight 600, tracking -0.02em
- **Section labels:** SF Mono, 0.625rem, tracking 0.12em, uppercase, accent blue color, preceded by a 20px horizontal line

---

## Color System

### Base palette

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#000000` | Page background (pure black) |
| `--bg-elevated` | `#0A0A10` | Slightly raised surfaces |
| `--bg-card` | `#0E0E16` | Card backgrounds (used at 75% opacity with backdrop-blur) |
| `--border` | `rgba(255, 255, 255, 0.06)` | Default borders |
| `--border-hover` | `rgba(255, 255, 255, 0.12)` | Hover-state borders |
| `--text-primary` | `#F0F0F0` | Headings, primary text |
| `--text-secondary` | `#7A7A82` | Body text, descriptions |
| `--text-tertiary` | `#44444C` | Subtle text, card numbers, comments |
| `--accent` | `#3B82F6` | Electric blue — links, buttons, icons, labels |
| `--accent-glow` | `rgba(59, 130, 246, 0.25)` | Button shadows, radial glows |
| `--accent-subtle` | `rgba(59, 130, 246, 0.07)` | Icon backgrounds, tag highlights |
| `--green` | `#34D399` | Success states, "available" badge, terminal success text |

### Cosmos background blobs (from iOS app)

Four animated color blobs rendered on a full-screen `<canvas>`, matching the app's `BackgroundTheme.cosmos`:

| Blob | Color RGB | Position (base) | Radius | Speed |
|------|-----------|-----------------|--------|-------|
| Purple | `120, 50, 180` | (20%, 15%) | 0.35 | slow |
| Blue | `40, 100, 220` | (80%, 45%) | 0.30 | medium |
| Pink | `200, 50, 100` | (25%, 75%) | 0.32 | medium |
| Teal | `50, 180, 140` | (75%, 20%) | 0.25 | fast |

Each blob is an ellipse with a 4-stop radial gradient (0.3 → 0.15 → 0.04 → 0 opacity), wobbles in size via sine, and rotates slowly. The canvas is `position: fixed` behind all content.

---

## Layout & Structure

### Sections (top to bottom)

1. **Nav** — Fixed top, blurred black backdrop (`rgba(0,0,0,0.6)` + `backdrop-filter: blur(24px)`), 56px height. Logo left, links + CTA button right. Logo uses SF Pro Display 600.

2. **Hero** — Full viewport height, vertically centered. Two-column grid: left column has badge + h1 + subtitle + action buttons; right column has phone screenshot with floating tags. On mobile (≤1024px) collapses to single column, centered.

3. **Marquee** — Horizontal auto-scrolling ticker strip. SF Mono uppercase items separated by small blue diamond glyphs. Bordered top and bottom. 30s infinite linear scroll, seamless loop via duplicated items.

4. **Features (Bento Grid)** — Split header (title left, description right). Below: 12-column CSS grid with cards of varying spans:
   - Row 1: 8-col card (command types with tag pills) + 4-col card (AI setup)
   - Row 2: 4-col + 4-col + 4-col (live dashboards with animated bars, auto-switch, native Swift)
   - Row 3: remaining cards at 4-col each

5. **MCP Section** — Two-column: left has label + heading + description + compatibility tags; right has a terminal window mockup with animated line-by-line reveal.

6. **How It Works** — Centered header. Three-column grid with 1px gap (acts as divider). Large outline step numbers (01, 02, 03 with `-webkit-text-stroke`). Arrow circles between steps.

7. **CTA** — Centered heading + subtitle + two buttons. Subtle radial gradient glow behind (purple → blue → transparent).

8. **Footer** — Minimal. Logo + links left, copyright right. SF Mono-ish for logo.

---

## Cards & Surfaces

- **Background:** `rgba(14, 14, 22, 0.75)` — semi-transparent so cosmos blobs show through
- **Backdrop filter:** `blur(16px)` — glass effect matching iOS `ultraThinMaterial`
- **Border:** 1px `rgba(255, 255, 255, 0.06)`, on hover `rgba(255, 255, 255, 0.12)`
- **Border radius:** 14px for cards, 12px for terminal, 8px for buttons, 4px for tags/badges
- **Hover:** translateY(-2px) + border lightens
- **Mouse-follow glow:** Radial gradient (`600px circle`) at cursor position, blue accent at 7% opacity, revealed on hover via CSS custom properties `--mouse-x` / `--mouse-y` set by JS

---

## Interactive Elements

### Buttons

| Type | Background | Text | Border | Hover |
|------|-----------|------|--------|-------|
| Primary | `#3B82F6` (accent) | white | none | translateY(-1px), blue glow shadow |
| Secondary | transparent | `--text-secondary` | 1px `--border` | text brightens, border lightens, faint white bg |
| Nav CTA | `--text-primary` (white) | black | none | opacity 0.85 |

All buttons: SF Pro Text weight 500, 0.9375rem, padding 14px 28px, border-radius 8px. Primary has a subtle `linear-gradient(135deg, rgba(255,255,255,0.1), transparent)` overlay.

### Tags / Badges

- **Hero badge:** Green dot (pulsing animation) + SF Mono uppercase, green text on green 5% bg, 4px radius
- **Command tags:** SF Mono 0.5625rem, default has faint border; `.active` variant has blue border + blue text + blue 7% bg
- **Compatibility tags:** SF Mono 0.5625rem uppercase, neutral border, secondary text

---

## Animations

| Element | Type | Duration | Easing | Details |
|---------|------|----------|--------|---------|
| Hero elements | Staggered fadeUp | 0.7s each | cubic-bezier(0.16,1,0.3,1) | Badge→h1→subtitle→buttons→visual, delays 0.1–0.6s |
| Scroll reveals | fadeUp on intersect | 0.8s | cubic-bezier(0.16,1,0.3,1) | IntersectionObserver, threshold 0.08, -60px rootMargin |
| Bento cards | Staggered reveal | +100ms each | same | Children delayed 0–500ms |
| Terminal lines | Sequential reveal | 0.3s each | default | Delays 0.3–3.2s, triggered on scroll into view |
| Live bars | Pulsing | 1.5s infinite | ease-in-out | scaleY 1→1.15, opacity 0.4→0.8, staggered delays |
| Cosmos blobs | Continuous drift | ~20–25s cycle | sine/cosine | Position, size wobble, rotation |
| Green badge dot | Pulse | 2s infinite | ease-in-out | Opacity 1→0.4 |
| Floating tags | Vertical bob | 6s infinite | ease-in-out | translateY 0→-6px, staggered delays |
| Marquee | Linear scroll | 30s infinite | linear | translateX 0→-50% |

---

## Responsive Breakpoints

| Breakpoint | Changes |
|-----------|---------|
| ≤1024px | Hero → single column centered. MCP → stacked. Features header → single column. |
| ≤768px | Bento → single column (all spans become 1). Steps → stacked. Nav links hidden. Float tags hidden. Footer stacked centered. |
| ≤480px | Hero h1 → 2rem. Buttons stack vertically. |

---

## Grain / Texture

A subtle noise overlay covers the entire page via `body::before`:
- SVG-based `feTurbulence` fractal noise
- `opacity: 0.025`
- `position: fixed`, `pointer-events: none`, `z-index: 9999`
- Adds subtle texture to the otherwise smooth dark background

---

## File Structure

```
├── index.html          — Landing page (all sections)
├── privacy.html        — Privacy Policy (legal layout)
├── terms.html          — Terms of Use (legal layout)
└── assets/
    ├── style.css       — Complete stylesheet (~1050 lines)
    ├── screenshot.png  — iPhone app screenshot (1206×2622, Retina)
    ├── icon.png        — App icon (256×256)
    └── favicon.ico     — Favicon
```

No build tools, no frameworks, no external CSS libraries. Pure HTML + CSS + vanilla JS (~115 lines for canvas animation, scroll observer, mouse tracking, terminal animation).

---

## Key Design Decisions

1. **Pure black background (#000)** — matches the iOS app's canvas and makes the Cosmos blobs pop
2. **System fonts only** — SF Pro renders natively on Apple devices (the target audience), zero FOIT/FOUT, instant paint
3. **Semi-transparent cards with backdrop-blur** — cosmos blob light bleeds through, creating the same glass effect as the iOS app's `ultraThinMaterial`
4. **Bento grid (not uniform cards)** — creates visual hierarchy; the 8+4 first row draws attention to the core value prop (8 command types)
5. **Terminal mockup for MCP** — speaks directly to the developer audience, more memorable than generic chat bubbles
6. **Monospace used sparingly** — only for technical labels, badges, terminal, and tags; all headings and body in system sans for Apple-clean readability
7. **No external dependencies** — entire site loads from 4 files (HTML, CSS, 2 images), under 100KB excluding images
