/*
 * dt-chrome.js: the shared look of the docs' diagrams (the .dt-* card) and small DOM helpers to build it.
 * Vanilla ES module. Nothing touches the DOM at import time.
 *
 *   ensureChrome()                    injects the shared CSS once (call it first in every mount()).
 *   ensureStyle(id, css)              injects a diagram's own extra rules once; prefix them with .dt-diagram.
 *   h(tag, props, ...children)        an HTML element. props: { class, text, html, attrs: {…}, on: { click } };
 *                                     children: nodes or strings (strings become text, never HTML).
 *   uid(prefix)                       a page-unique id.
 *   makeFigure({ name, eyebrow, title, lede }) → { figure, controls, body, legend, caption, announce(text) }
 *                                     the card: eyebrow, title (a <p>, not a heading, so it stays out of the
 *                                     page's contents), lede, a controls row, the body, legend and caption slots.
 *                                     announce() speaks to screen readers (use it for reader actions only).
 *   makeButton({ label, primary, pressed, onClick, title }) → <button class="dt-btn">
 *   makeSegmented({ label, options: [[value, text], …], value, onChange }) → { el, get value(), set(value) }
 *   makeLegend([{ swatch: 'glide' | 'fade' | 'ok' | 'text' | 'muted', text }]) → <ul class="dt-legend">
 *   makeChip(kind, text) / setChip(chip, kind, text)     kind 'glide' | 'fade' | 'ok' | '' (neutral)
 *
 * Classes for bodies (all styled here): .dt-panes > .dt-pane (.dt-pane-label, .dt-pane-title, .dt-pane-note,
 * .dt-cellwrap, .dt-status > .dt-chiprow (.dt-chip, .dt-phase), .dt-bar > span, .dt-reason), .dt-code (rows
 * .dt-row, marks .num .str .add .del .tag), .dt-story > .dt-story-pane > .dt-story-row (.dt-story-head, .dt-strip
 * > figure > .dt-cell + figcaption; set --dt-cols on .dt-strip for another column count), .dt-note (a small line
 * under the caption), .dt-spacer (pushes later controls right), .dt-sr-only.
 *
 * Colors: accent (blue) = glide / normal, amber = cross-fade / warning, green = success. What is drawn on the
 * phone keeps the phone's own colors on the fixed #0D0D0D screen patch. Chrome tokens are --dt-* on :root,
 * taken from the site's tokens in assets/style.css; :root[data-theme="light"] re-tints the chrome only.
 * The card is its own size container: below 560 px of card width, panes stack (use @container dt (…) too).
 */

const CHROME_CSS = `
:root {
  --dt-ink: var(--text-primary, #F0F0F0);
  --dt-body: color-mix(in srgb, var(--text-secondary, #7A7A82) 72%, var(--text-primary, #F0F0F0));
  --dt-muted: var(--text-secondary, #7A7A82);
  --dt-card: color-mix(in srgb, var(--bg-card, #0E0E16) 75%, transparent);
  --dt-border: var(--border, rgba(255, 255, 255, 0.06));
  --dt-border-strong: var(--border-hover, rgba(255, 255, 255, 0.12));
  --dt-panel: rgba(255, 255, 255, 0.035);
  --dt-accent: var(--accent, #3B82F6);
  --dt-accent-subtle: rgba(59, 130, 246, 0.10);
  --dt-warn: #FBBF24;
  --dt-warn-subtle: rgba(251, 191, 36, 0.10);
  --dt-ok: var(--green, #34D399);
  --dt-ok-subtle: rgba(52, 211, 153, 0.10);
  --dt-phone-screen: #0D0D0D;
  --dt-mono: var(--mono, 'SF Mono', ui-monospace, Menlo, Consolas, monospace);
  --dt-sans: var(--sans, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', system-ui, sans-serif);
  --dt-display: var(--display, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', system-ui, sans-serif);
}
:root[data-theme="light"] {
  --dt-ink: #111114;
  --dt-body: #4A4A52;
  --dt-muted: #6A6A72;
  --dt-card: rgba(255, 255, 255, 0.92);
  --dt-border: rgba(0, 0, 0, 0.08);
  --dt-border-strong: rgba(0, 0, 0, 0.16);
  --dt-panel: rgba(0, 0, 0, 0.035);
  --dt-accent: #2563EB;
  --dt-accent-subtle: rgba(37, 99, 235, 0.08);
  --dt-warn: #B45309;
  --dt-warn-subtle: rgba(180, 83, 9, 0.08);
  --dt-ok: #047857;
  --dt-ok-subtle: rgba(4, 120, 87, 0.08);
}

.dt-mount { display: block; margin: 26px 0 30px; }

figure.dt-diagram {
  container: dt / inline-size;
  margin: 0; padding: 22px 22px 18px;
  background: var(--dt-card); border: 1px solid var(--dt-border); border-radius: 14px;
  color: var(--dt-body); font-family: var(--dt-sans); font-size: 0.875rem; line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
figure.dt-diagram *, figure.dt-diagram *::before, figure.dt-diagram *::after { box-sizing: border-box; }
figure.dt-diagram p, figure.dt-diagram ul, figure.dt-diagram figure { margin: 0; }
figure.dt-diagram ul { padding: 0; list-style: none; }
figure.dt-diagram li { margin: 0; }
figure.dt-diagram strong { color: var(--dt-ink); font-weight: 600; }
figure.dt-diagram code {
  font-family: var(--dt-mono); font-size: 0.92em; color: var(--dt-ink);
  background: var(--dt-panel); border: 1px solid var(--dt-border); border-radius: 4px; padding: 0 4px;
  white-space: normal; overflow-wrap: anywhere;
}
figure.dt-diagram :focus-visible { outline: 2px solid var(--dt-accent); outline-offset: 2px; }

.dt-diagram .dt-eyebrow {
  display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
  font-family: var(--dt-mono); font-size: 0.625rem; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--dt-accent);
}
.dt-diagram .dt-eyebrow::before { content: ''; width: 20px; height: 1px; background: var(--dt-accent); flex: none; }
.dt-diagram .dt-title {
  margin: 0 0 6px; color: var(--dt-ink);
  font-family: var(--dt-display); font-weight: 600; font-size: 1.125rem; letter-spacing: -0.015em; line-height: 1.3;
}
.dt-diagram .dt-lede { margin: 0 0 16px; }

.dt-diagram .dt-controls { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 18px; }
.dt-diagram .dt-controls:empty { display: none; }
.dt-diagram .dt-spacer { flex: 1; }
.dt-diagram .dt-btn, .dt-diagram .dt-seg button {
  font: inherit; font-family: var(--dt-mono); font-size: 0.6875rem; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--dt-body); background: transparent; border: 1px solid var(--dt-border-strong); border-radius: 6px;
  padding: 7px 11px; margin: 0; cursor: pointer; line-height: 1; min-height: 32px;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
}
.dt-diagram .dt-btn:hover, .dt-diagram .dt-seg button:hover { color: var(--dt-ink); border-color: var(--dt-muted); }
.dt-diagram .dt-btn.primary {
  color: var(--dt-accent); background: var(--dt-accent-subtle);
  border-color: color-mix(in srgb, var(--dt-accent) 40%, transparent);
}
.dt-diagram .dt-btn.primary:hover { color: #FFFFFF; background: var(--dt-accent); border-color: var(--dt-accent); }
.dt-diagram .dt-seg { display: inline-flex; border: 1px solid var(--dt-border-strong); border-radius: 6px; overflow: hidden; }
.dt-diagram .dt-seg button { border: 0; border-radius: 0; }
.dt-diagram .dt-seg button + button { border-left: 1px solid var(--dt-border-strong); }
.dt-diagram .dt-seg button[aria-pressed="true"] { color: var(--dt-ink); background: var(--dt-panel); }

.dt-diagram .dt-panes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.dt-diagram .dt-pane { min-width: 0; border: 1px solid var(--dt-border); border-radius: 12px; padding: 14px 14px 12px; }
.dt-diagram .dt-pane-label {
  font-family: var(--dt-mono); font-size: 0.625rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--dt-muted);
}
.dt-diagram .dt-pane-title { margin: 4px 0 0; color: var(--dt-ink); font-size: 0.875rem; font-weight: 600; line-height: 1.4; }
.dt-diagram .dt-pane-note { margin: 2px 0 0; font-size: 0.75rem; line-height: 1.5; color: var(--dt-muted); }
.dt-diagram .dt-cellwrap { display: flex; justify-content: center; padding: 14px 0 12px; }

.dt-diagram .dt-cell { display: block; width: min(176px, 100%); height: auto; overflow: visible; }
.dt-diagram .dt-cell .dt-screen { fill: var(--dt-phone-screen); }
.dt-diagram .dt-cell text {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
}

.dt-diagram .dt-status { display: grid; gap: 7px; }
.dt-diagram .dt-chiprow { display: flex; align-items: center; gap: 8px; min-height: 22px; min-width: 0; }
.dt-diagram .dt-chip {
  font-family: var(--dt-mono); font-size: 0.625rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
  padding: 4px 7px; border-radius: 4px; border: 1px solid var(--dt-border-strong); color: var(--dt-muted);
  white-space: nowrap; line-height: 1.2;
}
.dt-diagram .dt-chip.glide { color: var(--dt-accent); background: var(--dt-accent-subtle); border-color: color-mix(in srgb, var(--dt-accent) 35%, transparent); }
.dt-diagram .dt-chip.fade { color: var(--dt-warn); background: var(--dt-warn-subtle); border-color: color-mix(in srgb, var(--dt-warn) 35%, transparent); }
.dt-diagram .dt-chip.ok { color: var(--dt-ok); background: var(--dt-ok-subtle); border-color: color-mix(in srgb, var(--dt-ok) 35%, transparent); }
.dt-diagram .dt-phase {
  font-family: var(--dt-mono); font-size: 0.625rem; letter-spacing: 0.06em; color: var(--dt-muted);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;
}
.dt-diagram .dt-bar { height: 3px; border-radius: 2px; background: var(--dt-border-strong); overflow: hidden; }
.dt-diagram .dt-bar span { display: block; height: 100%; width: 0; background: var(--dt-muted); }
.dt-diagram .dt-bar.glide span { background: var(--dt-accent); }
.dt-diagram .dt-bar.fade span { background: var(--dt-warn); }
.dt-diagram .dt-bar.ok span { background: var(--dt-ok); }
.dt-diagram .dt-reason { font-size: 0.75rem; line-height: 1.5; min-height: 4.5em; }

.dt-diagram .dt-code {
  margin: 10px 0 0; padding: 9px 10px; background: var(--dt-panel); border: 1px solid var(--dt-border); border-radius: 8px;
  font-family: var(--dt-mono); font-size: 0.6875rem; line-height: 1.7; color: var(--dt-muted);
  overflow-x: auto; white-space: pre;
}
.dt-diagram .dt-code .dt-row { display: block; padding: 0 4px; margin: 0 -4px; border-radius: 3px; }
.dt-diagram .dt-code .tag { color: var(--dt-body); }
.dt-diagram .dt-code .num { color: var(--dt-accent); font-weight: 600; }
.dt-diagram .dt-code .str { color: var(--dt-ink); text-decoration: underline dotted; text-underline-offset: 3px; }
.dt-diagram .dt-code .dt-row.add { color: var(--dt-warn); background: var(--dt-warn-subtle); }
.dt-diagram .dt-code .dt-row.del { color: var(--dt-warn); background: var(--dt-warn-subtle); text-decoration: line-through; }

.dt-diagram .dt-story { display: grid; gap: 14px; }
.dt-diagram [hidden] { display: none !important; }
.dt-diagram .dt-story-pane { border: 1px solid var(--dt-border); border-radius: 12px; padding: 14px; }
.dt-diagram .dt-story-row { margin-top: 12px; }
.dt-diagram .dt-story-head {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 8px;
  font-family: var(--dt-mono); font-size: 0.6875rem; color: var(--dt-body);
}
.dt-diagram .dt-strip { display: grid; grid-template-columns: repeat(var(--dt-cols, 5), minmax(0, 1fr)); gap: 6px; }
.dt-diagram .dt-strip > figure { margin: 0; text-align: center; min-width: 0; }
.dt-diagram .dt-strip .dt-cell { width: 100%; max-width: 92px; margin: 0 auto; }
.dt-diagram .dt-strip figcaption {
  font-family: var(--dt-mono); font-size: 0.5625rem; letter-spacing: 0.06em; color: var(--dt-muted); margin-top: 3px;
}

.dt-diagram .dt-legend { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 16px 0 0; font-size: 0.75rem; }
.dt-diagram .dt-legend:empty { display: none; }
.dt-diagram .dt-legend li { display: flex; align-items: center; gap: 7px; }
.dt-diagram .dt-swatch { width: 10px; height: 10px; border-radius: 2px; flex: none; background: var(--dt-muted); }
.dt-diagram .dt-swatch.glide { background: var(--dt-accent); }
.dt-diagram .dt-swatch.fade { background: var(--dt-warn); }
.dt-diagram .dt-swatch.ok { background: var(--dt-ok); }
.dt-diagram .dt-swatch.text { background: transparent; border: 1px dotted var(--dt-ink); }

.dt-diagram .dt-caption { margin: 14px 0 0; padding-top: 12px; border-top: 1px solid var(--dt-border); font-size: 0.8125rem; line-height: 1.6; }
.dt-diagram .dt-caption:empty { display: none; }
.dt-diagram .dt-note { margin-top: 8px; font-size: 0.75rem; line-height: 1.5; color: var(--dt-muted); }

.dt-diagram .dt-sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

@container dt (max-width: 560px) {
  .dt-diagram .dt-panes { grid-template-columns: minmax(0, 1fr); }
  .dt-diagram .dt-cell { width: min(150px, 100%); }
  .dt-diagram .dt-strip .dt-cell { width: 100%; }
  .dt-diagram .dt-spacer { display: none; }
}
@media (max-width: 640px) {
  figure.dt-diagram { padding: 18px 14px 14px; }
}
`;

function injectStyle(id, css) {
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

/** Injects the shared diagram CSS once per page. */
export function ensureChrome() { injectStyle('dt-chrome', CHROME_CSS); }

/** Injects a diagram's own CSS once per page, after the shared rules. */
export function ensureStyle(id, css) { ensureChrome(); injectStyle(id, css); }

let uidCount = 0;
/** A page-unique id. */
export function uid(prefix = 'dt') { return `${prefix}-${++uidCount}`; }

/** An HTML element: h('p', { class: 'dt-note', text: 'Hi' }) or h('div', { attrs: { role: 'group' } }, child…). */
export function h(tag, props = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'attrs') for (const [a, av] of Object.entries(v)) { if (av !== undefined && av !== null) e.setAttribute(a, String(av)); }
    else if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
    else e.setAttribute(k, String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return e;
}

/** The diagram card with its slots. */
export function makeFigure({ name = '', eyebrow = '', title = '', lede = '' } = {}) {
  ensureChrome();
  const titleId = uid('dt-title');
  const figure = h('figure', { class: 'dt-diagram', attrs: { 'aria-labelledby': titleId, 'data-dt-name': name || null } });
  if (eyebrow) figure.appendChild(h('div', { class: 'dt-eyebrow', text: eyebrow }));
  figure.appendChild(h('p', { class: 'dt-title', id: titleId, text: title }));
  if (lede) figure.appendChild(h('p', { class: 'dt-lede', text: lede }));
  const controls = h('div', { class: 'dt-controls', attrs: { role: 'group', 'aria-label': 'Diagram controls' } });
  const body = h('div', { class: 'dt-body' });
  const live = h('p', { class: 'dt-sr-only', attrs: { 'aria-live': 'polite' } });
  const legend = h('ul', { class: 'dt-legend', attrs: { 'aria-label': 'Legend' } });
  const caption = h('figcaption', { class: 'dt-caption' });
  figure.append(controls, body, live, legend, caption);
  return { figure, controls, body, legend, caption, announce: text => { live.textContent = text; } };
}

/** A mono pill button. `pressed` (true/false) makes it a toggle with aria-pressed. */
export function makeButton({ label, primary = false, pressed = null, onClick = null, title = null } = {}) {
  const b = h('button', { type: 'button', class: primary ? 'dt-btn primary' : 'dt-btn', text: label, title });
  if (pressed !== null) b.setAttribute('aria-pressed', String(!!pressed));
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

/** A segmented control: one value of several. */
export function makeSegmented({ label, options, value, onChange = null }) {
  const el = h('span', { class: 'dt-seg', attrs: { role: 'group', 'aria-label': label } });
  let current = value;
  const buttons = options.map(([v, text]) => {
    const b = h('button', { type: 'button', text, attrs: { 'data-value': v, 'aria-pressed': String(v === value) } });
    b.addEventListener('click', () => { api.set(v); if (onChange) onChange(v); });
    el.appendChild(b);
    return [v, b];
  });
  const api = {
    el,
    get value() { return current; },
    set(v) { current = v; for (const [bv, b] of buttons) b.setAttribute('aria-pressed', String(bv === v)); },
  };
  return api;
}

/** A legend: [{ swatch: 'glide' | 'fade' | 'ok' | 'text' | 'muted', text }]. */
export function makeLegend(items, into = null) {
  const ul = into || h('ul', { class: 'dt-legend', attrs: { 'aria-label': 'Legend' } });
  for (const { swatch, text } of items) {
    ul.appendChild(h('li', {}, h('span', { class: `dt-swatch ${swatch || 'muted'}`, attrs: { 'aria-hidden': 'true' } }), text));
  }
  return ul;
}

/** A verdict chip. kind: 'glide' | 'fade' | 'ok' | '' (neutral). */
export function makeChip(kind, text) { return setChip(h('span', { class: 'dt-chip' }), kind, text); }

export function setChip(chip, kind, text) {
  chip.className = kind ? `dt-chip ${kind}` : 'dt-chip';
  chip.textContent = text;
  return chip;
}
