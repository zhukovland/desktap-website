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
- **Hero h1 on `/next/` (`.hero-pitch`):** two sentences, what the product is and what sets it apart; the second, in the accent gradient, starts its own line (`<br>`). Smaller than a slogan: `clamp(2rem, 4.6vw, 4.25rem)`, line-height 1.04, tracking -0.04em, `text-wrap: balance`
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
| Live widgets on `/next/` | Button faces, drawn by `face-player.js` | as a script would send them | linear or easeInOut | A page of eight buttons on a patch of phone screen (`.ww-deck`, 4×3, gap a tenth of a column): Now Playing (Large, a gradient per track, level bars, progress), Claude Code needing input, a CI build, BTC price with a scrolling chart (Wide), weather, CPU ring, Pomodoro, GitHub stars. Only SVG the phone draws (shapes, gradients, text; no images or filters); made-up data. They come alive when the section is on screen and stop off screen; with Reduce Motion one still frame. Before the script loads: empty glass buttons. Under the deck, "Browse the widget recipes" links to `/docs?p=recipes-widgets`. |
| Cosmos blobs | Continuous drift | ~20–25s cycle | sine/cosine | Position, size wobble, rotation |
| Green badge dot | Pulse | 2s infinite | ease-in-out | Opacity 1→0.4 |
| Floating tags | Vertical bob | 6s infinite | ease-in-out | translateY 0→-6px, staggered delays |
| Marquee | Linear scroll | 30s infinite | linear | translateX 0→-50% |

---

## Responsive Breakpoints

| Breakpoint | Changes |
|-----------|---------|
| ≤1024px | Hero → single column centered. MCP → stacked. Features header → single column. |
| ≤768px | Bento → single column (all spans become 1). Steps → stacked. Nav: section links hidden, Docs and the CTA stay (`.nav-compact` on `/next/`; the other pages hide all nav links). Float tags hidden. Footer stacked centered. |
| ≤480px | Hero h1 → 2rem. Buttons stack vertically. |
| Phone or tablet (any width) | On `/next/` the download buttons read "Send to Mac" / "Send link to Mac" and open the share sheet with the `/download/` link (`mailto:` without Web Share). iPhone, iPad and Android: `html.handheld`, set in `<head>` before the first paint; each button carries both labels, `.only-mac` / `.only-handheld`. |

---

## Grain / Texture

A subtle noise overlay covers the entire page via `body::before`:
- SVG-based `feTurbulence` fractal noise
- `opacity: 0.025`
- `position: fixed`, `pointer-events: none`, `z-index: 9999`
- Adds subtle texture to the otherwise smooth dark background

---

## Docs

The documentation is one shell, `docs.html` + `assets/docs/docs.js`, that loads `assets/docs/pages/<slug>.md` for `docs?p=<slug>` and renders it with marked. Same tokens, fonts and black canvas as the landing; the extra tokens are `--warn: #FBBF24` and `--phone-screen: #0D0D0D`.

### Layout

| Width | Columns |
|-------|---------|
| ≥ 1200px | page list (232px) · content (≤ 760px) · "On this page" rail (200px, H2 + H3, sticky) |
| 900–1199px | page list · content; "On this page" is a closed dropdown above the content |
| < 900px | content only, 24px gutter (16px ≤ 640px). A sticky sub-bar under the site nav, "☰ Pages · <page title>" with ‹ › for prev/next, opens one slide-in panel from the left: the page list with the current page expanded to its H2s and H3s |

- **Page list:** five groups (Start, Learn, Build, Look up, AI) as mono uppercase labels; the current page has the accent-subtle fill with a 2px accent bar and lists its H2s under it.
- **Page header:** eyebrow = the page's group (mono, accent, 24px rule), the H1, then an "Updated <date>" pill from the page's `<!-- updated: … -->` line.
- **Prev / next:** two cards at the end of every page, in manifest order.
- **Headings:** a `#` link appears on hover for every H2/H3 (hidden on touch).
- Nothing scrolls sideways except code blocks and tables, which fade at the right edge while more is hidden.

### Callouts (GitHub-alert syntax)

| Markdown | Look | Use |
|----------|------|-----|
| `> [!NOTE]` | neutral rule, info icon | context |
| `> [!TIP]` | accent rule and label | an optional better way |
| `> [!WARNING]` | amber rule and label | real risk only |
| `> [!SEE]` | green rule, eye icon, label "What you'll see" | the moment the reader checks success |
| `> [!STEP] 2 · Title` | card with a numbered circle; consecutive steps are joined by a thin accent line | numbered setup steps |

Text on the marker line becomes the title (`> [!TIP] A faster way`). In step cards and see-boxes:
- an image standing on its own line (or at the start or end of a paragraph) moves into a picture column: right of the text in a step card, left of it in a see-box; it stacks under the text ≤ 640px. If any image in the box is wider than 280px (`width` attribute), all stay in the text flow at full width;
- a paragraph starting with "Done when" gets a green check (steps);
- a line starting with "Not seeing it?" becomes the box's small footer line (see-boxes), also when it follows another line of the same paragraph.

### Code blocks

- **Header tab** from the fence's info string: ```` ```zsh title="Startup Script" ````. Known titles get an icon and a hint: Startup Script (Advanced › Startup Script), Shell Command (Tap action), Terminal (On your Mac), SVG Drawing (Icon › SVG Drawing), Body (JSON), AppleScript (Tap action). Without a title the header shows the language (zsh, JSON, SVG, AppleScript); a `text` fence has no header and its Copy floats over the corner.
- **Copy** is always visible in the header and copies the whole block, folded parts included.
- **Helpers block:** the lines from `# ── Desktap helpers (the same in every recipe) ──` to `# ── end of helpers ──` fold into their first line with a "show N lines" pill.
- **Long code:** more than 30 visible lines (not counting a folded helpers block) folds to 20 lines with a fade and "Show all N lines". Flag `open` in the info string turns this off; a block inside `<details>` never folds. Flag `primary` gives the block the accent glow.
- **Highlighting** (no library): comments gray `#7C7C86`, strings mint `#A7D9BC`, variables, numbers and tags light blue `#93C5FD`, keywords bold white, JSON keys `#E4E4E7`, attributes `#A0A0A8`. Languages: zsh/sh/bash, json, svg/xml/html, applescript.
- **Chips:** `{{CELL_ID}}`, `{{DESKTAP_TOKEN}}`, `$DESKTAP_TOKEN` and `$DESKTAP_STORAGE` get a blue underlined chip with a tooltip, in code blocks and in inline code (not in headings).

### Other blocks

- **Tables** sit in a rounded frame and scroll inside it. Wrap one in `<div class="stack-table">` (blank lines around the table) to turn each row into a card ≤ 480px, labelled with the column names.
- **Inline code** up to 24 characters never breaks; longer code wraps anywhere.
- **`<details><summary>…</summary>`** is a bordered box with an accent ▸; use it for the full script of a recipe and for optional depth.
- **Link cards:** `<div class="link-cards">` around a list whose items start with a link ("- [SVG faces](?p=svg-faces) — draw it.") turns them into a grid of clickable cards; the dash after the link is dropped.
- **Recipe cards:** `<div class="recipe-cards" data-set="widgets"></div>` (or `alerts`) is filled from `pages.json` `recipes`: thumbnail on the `--phone-screen` patch, title, summary, tags (size first), and "On <page> →" when the recipe lives on another page. A recipe with no button (a Terminal command) shows its command in a mono pill (`thumbText`) instead of a face. 2 columns from ~640px of content width, 1 below; at 480px or less each card puts its face in a 104px column on the left, so a set of nine stays short. No animation on cards.
- **Images:** `<img src="assets/docs/img/<slug>/<name>.png" width=".." height=".." alt="..">`; `docs.js` adds lazy loading and warns in the console when `width`/`height` is missing.
- **App screenshots:** a phone screen is shown 280 px wide (`width="280"`, file at 2×, 560 px; a Mac window 760 px, file 1520 px). In a step card the picture column is capped at 240 px, in a see-box at 220 px. Two screens side by side: `<div class="shot-pair">` around two `<img>` (the second wraps under the first when the column is narrow, so a caption must not say "left" and "right"; use 240 px each). A ring over one spot of a screenshot: `<picture class="shot-ring" style="--x:78.6%;--y:8.5%;--d:9%"><img …></picture>`; `--x` and `--d` are shares of the picture's width, `--y` a share of its height. A `<picture>` (not a wrapper `<span>`) so that a step card still moves it into its picture column.

### Diagrams

`<div class="dt-mount" data-diagram="NAME" data-mode="MODE">One sentence.</div>` shows the sentence in a dashed placeholder (min-height 320px) until `assets/docs/js/diagrams/NAME.js` loads, which happens when the mount comes within 600px of the viewport. The module draws a `figure.dt-diagram` card from `dt-chrome.js`: eyebrow (mono, accent, 20px rule), title (display 600, 1.125rem), one-line lede, mono pill controls, legend, and a caption that states the rule in bold first. It reads `prefers-reduced-motion` itself (no autoplay, a static storyboard) and pauses off screen and in hidden tabs. A module that fails to load leaves the sentence in place.

### Status colors

| Color | Means |
|-------|-------|
| Accent `#3B82F6` | glide, normal, links, tips |
| Amber `#FBBF24` | cross-fade, warning |
| Green `#34D399` | success: see-boxes, "Done when", Copied |
| Phone colors (`#34C759`, `#FF9F0A`, `#FF453A`) | only inside drawn phone content, on `--phone-screen` |

---

## File Structure

```
├── index.html          — Holding page: one screen, "Coming soon" (noindex)
├── next/index.html     — The full landing, reworked here (noindex, absolute paths, nothing links to it)
├── privacy.html        — Privacy Policy (legal layout)
├── terms.html          — Terms of Use (legal layout)
├── docs.html           — Docs shell (loads assets/docs/pages/<slug>.md)
├── og-card.html        — Source of the social previews: assets/og-image.jpg, assets/og-soon.jpg (?label=Coming%20soon)
└── assets/
    ├── docs/           — docs.js, pages.json, pages/*.md, js/ (diagrams), img/
    ├── js/live-widgets.js — the live buttons of the Live widgets section on /next/ (imports docs/js/face-player.js)
    ├── style.css       — Complete stylesheet (~3100 lines; docs part at "Docs")
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
