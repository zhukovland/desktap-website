/*
 * D9 · Landscape (SVG faces › Sizes and the turned phone; Scenes and sound › Where each button is;
 * SVG reference › Landscape placement).
 * An iPhone page of 4 × 8 turns sideways. Three buttons from the SVG reference's table, a Normal CPU ring at
 * row 0, column 0, a Wide Network speed at row 0, columns 2–3 and a Tall Memory gauge at rows 5–6, column 1,
 * land where the app puts them:
 *   landscape column = portrait row;  landscape row = (columns − 1) − column − (colSpan − 1)
 * which is the page turned a quarter to the left, each button set upright where it lands. Wide and Tall faces
 * show their landscape variants (the recipes' --face landscape frames). The zoom shows the Wide button turned,
 * with and without landscapeSource: without one, the wide face is fitted whole into the tall button.
 *
 * mount(el, { mode, reducedMotion }) → { destroy() }
 * Test switches (face-player.js readSwitches): data-at / ?dt-at=<s> (autoplay frozen at that moment),
 * data-view / ?dt-view=story, ?dt-motion=reduce.
 */
import { EASE, FADE, Loop, svgEl, readSwitches, watchReducedMotion, clamp01 } from '../face-player.js';
import { ensureStyle, h, makeFigure, makeButton, makeSegmented, makeLegend, makeChip, uid } from '../dt-chrome.js';
import { FACES, drawFace, CORNER } from './sizes.js';

export const COLUMNS = 4, ROWS = 8, CELL = 80, GAP = 16.7;   // an iPhone, as in the docs' /api/view example

export const BUTTONS = [
  { key: 'normal', name: 'Normal', row: 0, col: 0, rowSpan: 1, colSpan: 1, face: 'ring', variant: null },
  { key: 'wide', name: 'Wide', row: 0, col: 2, rowSpan: 1, colSpan: 2, face: 'network', variant: 'networkLandscape' },
  { key: 'tall', name: 'Tall', row: 5, col: 1, rowSpan: 2, colSpan: 1, face: 'memory', variant: 'memoryLandscape' },
];

/** Where the phone draws a button when it is turned (GridParams.position in the app). */
export function landscapePlace({ row, col, rowSpan, colSpan }, columns = COLUMNS) {
  return { col: row, row: (columns - 1) - col - (colSpan - 1), colSpan: rowSpan, rowSpan: colSpan };
}

/** Timing of one turn: the phone turns, then each button settles upright. */
export const TURN = 0.9, SETTLE = 0.6;
/** Autoplay: upright, turn, sideways, turn back. */
export const HOLD_UP = 2.4, HOLD_SIDE = 3.2;
export const CYCLE = HOLD_UP + TURN + SETTLE + HOLD_SIDE + TURN + SETTLE;

/** The autoplay at diagram time t: { from, to, tau } while turning, { at } at rest. */
export function scheduleAt(t) {
  const m = ((t % CYCLE) + CYCLE) % CYCLE;
  const T = TURN + SETTLE;
  if (m < HOLD_UP) return { at: 'portrait' };
  if (m < HOLD_UP + T) return { from: 'portrait', to: 'landscape', tau: m - HOLD_UP };
  if (m < HOLD_UP + T + HOLD_SIDE) return { at: 'landscape' };
  return { from: 'landscape', to: 'portrait', tau: m - HOLD_UP - T - HOLD_SIDE };
}

// ─── Geometry, in points, in the phone's own upright coordinates (its center at 0, 0) ──────────────────────

const GW = COLUMNS * CELL + (COLUMNS - 1) * GAP, GH = ROWS * CELL + (ROWS - 1) * GAP;
const BEZEL = { side: 16, top: 44, bottom: 28 };
const BODY = { w: GW + 2 * BEZEL.side, h: GH + BEZEL.top + BEZEL.bottom };
const GX = -BODY.w / 2 + BEZEL.side, GY = -BODY.h / 2 + BEZEL.top;
const STAGE = BODY.h + 24;

function cellRect(row, col, rowSpan = 1, colSpan = 1) {
  return { x: GX + col * (CELL + GAP), y: GY + row * (CELL + GAP),
    w: colSpan * CELL + (colSpan - 1) * GAP, h: rowSpan * CELL + (rowSpan - 1) * GAP, r: CORNER * CELL };
}

/** Points per unit of a face fitted whole into a w × h box, upright (psi 0) or turned a quarter (psi 90). */
export function fitScale(vb, w, h, psi) {
  return psi === 90 ? Math.min(w / vb[1], h / vb[0]) : Math.min(w / vb[0], h / vb[1]);
}

/** A button's look in an orientation: its face upright ('P0'), turned upright in landscape ('P90'), or its variant ('V'). */
function look(b, orientation, useVariant = true) {
  if (orientation === 'portrait') return 'P0';
  return b.variant && useVariant ? 'V' : 'P90';
}

/**
 * The layers of one button at settle progress q (0…1) from look `a` to look `b`, bottom first:
 * { face: 'P' | 'V', psi, k, opacity }. A change of variant cross-fades: the new face fades in on top of the old
 * one, which stays fully drawn; the same face turned upright turns and refits.
 */
export function layersAt(button, box, a, b, q) {
  const P = FACES[button.face].vb, V = button.variant ? FACES[button.variant].vb : null;
  const layer = l => ({
    face: l === 'V' ? 'V' : 'P',
    psi: l === 'P0' ? 0 : 90,
    k: l === 'V' ? fitScale(V, box.w, box.h, 90) : fitScale(P, box.w, box.h, l === 'P0' ? 0 : 90),
  });
  const from = layer(a), to = layer(b);
  if (a === b || q >= 1) return [{ ...to, opacity: 1 }];
  if (from.face === to.face) {
    const e = EASE.easeInOut(q);
    return [{ face: from.face, psi: from.psi + (to.psi - from.psi) * e, k: from.k + (to.k - from.k) * e, opacity: 1 }];
  }
  return [{ ...from, opacity: 1 }, { ...to, opacity: FADE(q) }];
}

// ─── Drawing ────────────────────────────────────────────────────────────────────────────────────────────────

const CSS = `
.dt-diagram .dtl-wrap { display: grid; grid-template-columns: minmax(0, 1fr) minmax(240px, 280px); gap: 18px; align-items: center; }
.dt-diagram .dtl-stage { display: block; width: 100%; max-width: 420px; height: auto; margin: 0 auto; }
.dt-diagram .dtl-wrap svg text {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif; font-variant-numeric: tabular-nums;
}
.dt-diagram .dtl-side { display: grid; gap: 12px; min-width: 0; }
.dt-diagram .dtl-zoom { border: 1px solid var(--dt-border); border-radius: 12px; padding: 12px 12px 10px; }
.dt-diagram .dtl-zoom svg { display: block; width: 100%; max-width: 250px; height: auto; margin: 6px auto 0; }
.dt-diagram .dtl-zcap {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 8px auto 0; max-width: 270px; min-height: 3.6em; position: relative;
}
.dt-diagram .dtl-zcap > div {
  display: grid; gap: 4px; align-content: start; justify-items: center; text-align: center;
  font-size: 0.6875rem; line-height: 1.4; transition: opacity 0.25s;
}
.dt-diagram .dtl-zcap > .dtl-up { position: absolute; inset: 0; grid-column: 1 / -1; }
.dt-diagram .dtl-places { display: grid; gap: 8px; margin-top: 14px; }
.dt-diagram .dtl-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; font-size: 0.75rem; line-height: 1.5; }
.dt-diagram .dtl-item { border: 1px solid var(--dt-border); border-radius: 10px; padding: 8px 11px; }
.dt-diagram .dtl-item b { color: var(--dt-ink); font-weight: 600; font-size: 0.8125rem; }
.dt-diagram .dtl-item .dtl-turned { transition: opacity 0.25s; }
.dt-diagram .dtl-item .dtl-turned.dim { opacity: 0.38; }
.dt-diagram .dtl-item .dtl-sum { font-family: var(--dt-mono); font-size: 0.6875rem; color: var(--dt-muted); }
.dt-diagram .dtl-item .dtl-sum em { font-style: normal; color: var(--dt-accent); }
.dt-diagram .dtl-formula em { font-style: normal; color: var(--dt-accent); }
.dt-diagram .dtl-formula { font-family: var(--dt-mono); font-size: 0.6875rem; line-height: 1.6; color: var(--dt-body);
  background: var(--dt-panel); border: 1px solid var(--dt-border); border-radius: 8px; padding: 7px 10px; }
.dt-diagram .dtl-storyrow {
  display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 4.2fr); gap: 14px; align-items: center; margin-top: 10px;
}
.dt-diagram .dtl-storyrow svg { display: block; width: 100%; height: auto; }
.dt-diagram .dtl-storyrow figure { margin: 0; }
.dt-diagram .dtl-arrow { font-family: var(--dt-mono); font-size: 0.6875rem; color: var(--dt-muted); text-align: center; }
.dt-diagram .dtl-storyrow figcaption {
  font-family: var(--dt-mono); font-size: 0.625rem; letter-spacing: 0.06em; color: var(--dt-muted); text-align: center; margin-top: 4px;
}
.dt-diagram .dt-swatch.dtl-row0 { background: color-mix(in srgb, var(--dt-accent) 45%, transparent); border: 1px solid var(--dt-accent); }
.dt-diagram .dt-swatch.dtl-col0 { background: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255, 255, 255, 0.45); }
@container dt (max-width: 640px) {
  .dt-diagram .dtl-wrap { grid-template-columns: minmax(0, 1fr); }
  .dt-diagram .dtl-stage { max-width: 360px; }
  .dt-diagram .dtl-list { grid-template-columns: minmax(0, 1fr); }
}
@container dt (max-width: 520px) {
  .dt-diagram .dtl-storyrow { grid-template-columns: minmax(0, 1fr); justify-items: center; }
  .dt-diagram .dtl-storyrow figure:first-child { width: 42%; }
  .dt-diagram .dtl-storyrow figure:last-child { width: 100%; }
}
`;

function rimGradient(defs) {
  const id = uid('dtl-rim');
  const g = svgEl('linearGradient', { id, x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
  [['0', '0.18'], ['0.5', '0.06'], ['1', '0']].forEach(([o, a]) =>
    svgEl('stop', { offset: o, 'stop-color': '#FFFFFF', 'stop-opacity': a }, g));
  return id;
}

/** A glass button at `box` in `parent`'s coordinates; faces go into `host`, clipped to the corners. */
function drawCell(parent, defs, rim, box, faces) {
  const clipId = uid('dtl-clip');
  svgEl('rect', { x: box.x, y: box.y, width: box.w, height: box.h, rx: box.r }, svgEl('clipPath', { id: clipId }, defs));
  svgEl('rect', { x: box.x, y: box.y, width: box.w, height: box.h, rx: box.r, fill: '#FFFFFF', 'fill-opacity': 0.08 }, parent);
  const host = svgEl('g', { 'clip-path': `url(#${clipId})` }, parent);
  const groups = {};
  for (const [kind, name] of Object.entries(faces)) {
    if (!name) continue;
    const vb = FACES[name].vb;
    const outer = svgEl('g', {}, host);
    const vbClip = uid('dtl-vb');
    svgEl('rect', { x: 0, y: 0, width: vb[0], height: vb[1] }, svgEl('clipPath', { id: vbClip }, defs));
    drawFace(name, svgEl('g', { 'clip-path': `url(#${vbClip})` }, outer));
    groups[kind] = { outer, vb };
  }
  svgEl('rect', { x: box.x + 0.5, y: box.y + 0.5, width: box.w - 1, height: box.h - 1, rx: box.r - 0.5, fill: 'none',
    stroke: `url(#${rim})`, 'stroke-width': 1 }, parent);
  return { box, host, groups };
}

/** Places a cell's faces for its layers (bottom first); faces not listed are hidden. */
function placeLayers(cell, layers) {
  const { box, groups } = cell;
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const shown = new Set();
  for (const l of layers) {
    const g = groups[l.face];
    if (!g) continue;
    shown.add(l.face);
    g.outer.setAttribute('transform', `translate(${cx.toFixed(2)} ${cy.toFixed(2)}) rotate(${l.psi.toFixed(2)}) ` +
      `scale(${l.k.toFixed(4)}) translate(${-g.vb[0] / 2} ${-g.vb[1] / 2})`);
    g.outer.setAttribute('opacity', l.opacity.toFixed(4));
    g.outer.style.display = '';
  }
  const top = layers.length > 1 && groups[layers[layers.length - 1].face];
  if (top && cell.host.lastChild !== top.outer) cell.host.appendChild(top.outer);   // the newest face on top
  for (const [kind, g] of Object.entries(groups)) if (!shown.has(kind)) g.outer.style.display = 'none';
}

/** The phone with its page: { svg, render(state) }. state = { phi, layers: { key: [...] } }. */
function buildPhone(label, tight = null) {
  const [bw, bh] = tight === 'landscape' ? [BODY.h, BODY.w] : [BODY.w, BODY.h];
  const viewBox = tight ? `${-bw / 2 - 4} ${-bh / 2 - 4} ${bw + 8} ${bh + 8}` : `${-STAGE / 2} ${-STAGE / 2} ${STAGE} ${STAGE}`;
  const svg = svgEl('svg', { class: tight ? 'dtl-tight' : 'dtl-stage', viewBox, role: 'img' });
  if (label) svg.setAttribute('aria-label', label);
  const defs = svgEl('defs', {}, svg);
  const rim = rimGradient(defs);
  const phone = svgEl('g', {}, svg);
  svgEl('rect', { x: -BODY.w / 2, y: -BODY.h / 2, width: BODY.w, height: BODY.h, rx: 58,
    fill: '#1B1B1F', stroke: 'rgba(255,255,255,0.16)', 'stroke-width': 2 }, phone);
  svgEl('rect', { x: -BODY.w / 2 + 7, y: -BODY.h / 2 + 7, width: BODY.w - 14, height: BODY.h - 14, rx: 51, fill: '#0D0D0D' }, phone);
  svgEl('rect', { x: -48, y: -BODY.h / 2 + 16, width: 96, height: 24, rx: 12, fill: '#000000' }, phone);
  // Row 0 and column 0, so the reader can follow them round.
  const r0 = cellRect(0, 0, 1, COLUMNS), c0 = cellRect(0, 0, ROWS, 1);
  svgEl('rect', { x: r0.x - 6, y: r0.y - 6, width: r0.w + 12, height: r0.h + 12, rx: r0.r + 6,
    style: 'fill: var(--dt-accent); fill-opacity: 0.16; stroke: var(--dt-accent); stroke-opacity: 0.6', 'stroke-width': 2 }, phone);
  svgEl('rect', { x: c0.x - 6, y: c0.y - 6, width: c0.w + 12, height: c0.h + 12, rx: c0.r + 6,
    fill: '#FFFFFF', 'fill-opacity': 0.06, stroke: '#FFFFFF', 'stroke-opacity': 0.4, 'stroke-width': 2, 'stroke-dasharray': '6 5' }, phone);
  const taken = new Set();
  for (const b of BUTTONS) for (let r = 0; r < b.rowSpan; r++) for (let c = 0; c < b.colSpan; c++) taken.add(`${b.row + r},${b.col + c}`);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLUMNS; c++) {
    if (taken.has(`${r},${c}`)) continue;
    const box = cellRect(r, c);
    svgEl('rect', { x: box.x + 1, y: box.y + 1, width: box.w - 2, height: box.h - 2, rx: box.r, fill: 'none',
      stroke: '#FFFFFF', 'stroke-opacity': 0.13, 'stroke-width': 2, 'stroke-dasharray': '5 5' }, phone);
  }
  const cells = {};
  for (const b of BUTTONS) {
    cells[b.key] = drawCell(phone, defs, rim, cellRect(b.row, b.col, b.rowSpan, b.colSpan), { P: b.face, V: b.variant });
  }
  return {
    svg,
    render({ phi, layers }) {
      phone.setAttribute('transform', `rotate(${phi.toFixed(3)})`);
      for (const b of BUTTONS) placeLayers(cells[b.key], layers[b.key]);
    },
  };
}

/** The phone at a moment: autoplay schedule or a reader's turn. */
function phoneState(s) {
  const angle = o => (o === 'landscape' ? -90 : 0);
  const layers = {};
  if (s.at) {
    for (const b of BUTTONS) {
      const box = cellRect(b.row, b.col, b.rowSpan, b.colSpan);
      layers[b.key] = layersAt(b, box, look(b, s.at), look(b, s.at), 1);
    }
    return { phi: angle(s.at), layers, q: 1, orientation: s.at };
  }
  const p = clamp01(s.tau / TURN), q = clamp01((s.tau - TURN) / SETTLE);
  const phi = angle(s.from) + (angle(s.to) - angle(s.from)) * EASE.easeInOut(p);
  for (const b of BUTTONS) {
    const box = cellRect(b.row, b.col, b.rowSpan, b.colSpan);
    layers[b.key] = layersAt(b, box, look(b, s.from), look(b, s.to), q);
  }
  return { phi, layers, q, orientation: q >= 1 ? s.to : s.from, toward: s.to };
}

// ─── The zoom: the Wide button, upright, and turned with and without its variant ──────────────────────────

function buildZoom(defs, svg) {
  const Z = 1.25;                                   // zoom units per point
  const wide = { w: (2 * CELL + GAP) * Z, h: CELL * Z };
  const up = svgEl('g', {}, svg), side = svgEl('g', {}, svg);
  const rim = rimGradient(defs);
  const boxUp = { x: (250 - wide.w) / 2, y: (wide.w - wide.h) / 2, w: wide.w, h: wide.h, r: CORNER * CELL * Z };
  const cellUp = drawCell(up, defs, rim, boxUp, { P: 'network' });
  placeLayers(cellUp, [{ face: 'P', psi: 0, k: fitScale(FACES.network.vb, boxUp.w, boxUp.h, 0), opacity: 1 }]);
  const tall = { w: wide.h, h: wide.w };
  const boxWith = { x: 125 - 10 - tall.w, y: 0, w: tall.w, h: tall.h, r: CORNER * CELL * Z };
  const boxWithout = { x: 125 + 10, y: 0, w: tall.w, h: tall.h, r: CORNER * CELL * Z };
  const cellWith = drawCell(side, defs, rim, boxWith, { V: 'networkLandscape' });
  const cellWithout = drawCell(side, defs, rim, boxWithout, { P: 'network' });
  placeLayers(cellWith, [{ face: 'V', psi: 0, k: fitScale(FACES.networkLandscape.vb, tall.w, tall.h, 0), opacity: 1 }]);
  placeLayers(cellWithout, [{ face: 'P', psi: 0, k: fitScale(FACES.network.vb, tall.w, tall.h, 0), opacity: 1 }]);
  svg.setAttribute('viewBox', `0 0 250 ${tall.h.toFixed(2)}`);
  return { up, side };
}

// ─── The diagram ────────────────────────────────────────────────────────────────────────────────────────────

/** Readout lines for one button: where it is upright and where it lands, with the formula worked out. */
export function placeText(b, columns = COLUMNS) {
  const L = landscapePlace(b, columns);
  const span = (a, n) => (n > 1 ? `${a}–${a + n - 1}` : `${a}`);
  const plural = n => (n > 1 ? 's' : '');
  const upright = `upright: row${plural(b.rowSpan)} ${span(b.row, b.rowSpan)}, column${plural(b.colSpan)} ${span(b.col, b.colSpan)}`;
  const turned = `turned: column${L.colSpan > 1 ? 's' : ''} ${span(L.col, L.colSpan)}, row${L.rowSpan > 1 ? 's' : ''} ${span(L.row, L.rowSpan)}`;
  const shape = L.colSpan > L.rowSpan ? 'Wide' : L.rowSpan > L.colSpan ? 'Tall' : null;
  const sum = `row = (${columns} − 1) − ${b.col} − (${b.colSpan} − 1) = ${L.row}`;
  return { upright, turned, shape, sum, L };
}

export default function mount(el, { reducedMotion = false } = {}) {
  ensureStyle('dt-landscape', CSS);
  const sw = readSwitches(el, { reducedMotion });
  let reduce = sw.reduced;
  const frozen = sw.at !== null;
  const original = [...el.childNodes];

  const { figure, controls, body, legend, caption, announce } = makeFigure({
    name: 'landscape',
    eyebrow: 'The turned phone',
    title: 'Turn the phone, and the page turns with it.',
    lede: 'Row 0 becomes the left edge and column 0 the bottom row. Wide buttons turn tall, Tall ones turn wide, ' +
      'and each draws its landscape variant.',
  });

  // Live view: the phone, the zoom and the readout.
  const phone = buildPhone('A 4 by 8 iPhone page with a Normal, a Wide and a Tall button');
  const zoomSvg = svgEl('svg', { role: 'img', 'aria-label': 'The Wide button close up' });
  const zoomDefs = svgEl('defs', {}, zoomSvg);
  const zoom = buildZoom(zoomDefs, zoomSvg);
  const capUp = h('div', { class: 'dtl-up' }, h('span', { text: 'Upright: the Wide face' }));
  const capWith = h('div', {}, makeChip('ok', 'Full-size text'), h('span', { html: 'with <code>landscapeSource</code>' }));
  const capWithout = h('div', {}, makeChip('fade', 'Half-size text'), h('span', { text: 'without: shrunk to fit' }));
  const zoomBox = h('section', { class: 'dtl-zoom', attrs: { 'aria-label': 'The Wide button close up' } },
    h('div', { class: 'dt-pane-label', text: 'The Wide button, close up' }),
    zoomSvg, h('div', { class: 'dtl-zcap' }, capWith, capWithout, capUp));

  const list = h('div', { class: 'dtl-list' });
  const rows = BUTTONS.map(b => {
    const t = placeText(b);
    const turned = h('span', { class: 'dtl-turned' }, t.turned, t.shape ? `, now ${t.shape}` : '', h('br'),
      h('span', { class: 'dtl-sum',
        html: b.colSpan > 1 ? t.sum.replace(`(${b.colSpan} − 1)`, `<em>(${b.colSpan} − 1)</em>`) : t.sum }));
    list.appendChild(h('div', { class: 'dtl-item' }, h('b', { text: `${b.name} · ` }), t.upright, h('br'), turned));
    return { b, turned };
  });
  const formula = h('div', { class: 'dtl-formula', html:
    'turned column = row<br>turned row = (columns − 1) − column − <em>(colSpan − 1)</em>' });
  const live = h('div', { class: 'dtl-wrap' }, phone.svg, h('div', { class: 'dtl-side' }, zoomBox));
  const places = h('div', { class: 'dtl-places' }, formula, list);

  // Storyboard: upright and turned, side by side.
  const story = h('div', { class: 'dt-story', hidden: '' });
  let storyBuilt = false;
  function buildStory() {
    if (storyBuilt) return;
    storyBuilt = true;
    const a = buildPhone('The page upright', 'portrait'), b = buildPhone('The page turned', 'landscape');
    a.render(phoneState({ at: 'portrait' }));
    b.render(phoneState({ at: 'landscape' }));
    const zs = svgEl('svg', { role: 'img', 'aria-label': 'The Wide button turned, with and without its landscape variant' });
    const z = buildZoom(svgEl('defs', {}, zs), zs);
    z.up.style.display = 'none';
    story.append(h('section', { class: 'dt-story-pane', attrs: { 'aria-label': 'Upright and turned' } },
      h('div', { class: 'dt-pane-label', text: 'Upright → turned' }),
      h('div', { class: 'dtl-storyrow' },
        h('figure', {}, a.svg, h('figcaption', { text: 'upright' })),
        h('div', { class: 'dtl-arrow', text: '⟲ turn' }),
        h('figure', {}, b.svg, h('figcaption', { text: 'turned' })))),
    h('div', { class: 'dtl-side' }, h('section', { class: 'dtl-zoom' },
      h('div', { class: 'dt-pane-label', text: 'The Wide button, turned' }), zs,
      h('div', { class: 'dtl-zcap' },
        h('div', {}, makeChip('ok', 'Full-size text'), h('span', { html: 'with <code>landscapeSource</code>' })),
        h('div', {}, makeChip('fade', 'Half-size text'), h('span', { text: 'without: shrunk to fit' }))))));
  }
  body.append(live, story, places);

  // Clock: autoplay follows the schedule; a reader's turn starts from where the phone is.
  let playing = false, autoStart = 0, manual = null, queued = false, resting = 'portrait', view = 'live';
  let lastSettled = 'portrait';
  function stateAt(time) {
    if (playing) return scheduleAt(time - autoStart);
    if (manual) {
      const tau = time - manual.t0;
      if (tau >= TURN + SETTLE) {
        resting = manual.to;
        manual = null;
        if (queued) {                                // a turn asked for while one was under way
          queued = false;
          manual = { from: resting, to: resting === 'landscape' ? 'portrait' : 'landscape', t0: time };
          return { from: manual.from, to: manual.to, tau: 0 };
        }
        return { at: resting };
      }
      return { from: manual.from, to: manual.to, tau };
    }
    return { at: resting };
  }

  function render(time) {
    const st = phoneState(stateAt(time));
    phone.render(st);
    const sideways = st.orientation === 'landscape';
    const zq = st.toward ? (st.toward === 'landscape' ? FADE(st.q) : 1 - FADE(st.q)) : (sideways ? 1 : 0);
    const upOn = clamp01(1 - 2 * zq), sideOn = clamp01(2 * zq - 1);   // one after the other, never both
    zoom.up.setAttribute('opacity', upOn.toFixed(3));
    zoom.side.setAttribute('opacity', sideOn.toFixed(3));
    capUp.style.opacity = String(upOn);
    capWith.style.opacity = capWithout.style.opacity = String(sideOn);
    for (const r of rows) r.turned.classList.toggle('dim', view === 'live' && zq < 0.5);
    turnBtn.textContent = (st.toward || st.orientation) === 'landscape' ? '⟲ Turn it back' : '⟲ Turn the phone';
    if (!st.toward && st.orientation !== lastSettled) {
      lastSettled = st.orientation;
      if (!playing) announce(st.orientation === 'landscape'
        ? 'Turned: the Normal button lands at column 0, row 3; the Wide one at column 0, rows 0 to 1, now Tall; ' +
          'the Tall one at columns 5 to 6, row 2, now Wide.'
        : 'Upright again.');
    }
    return st;
  }

  const loop = new Loop({
    root: figure,
    onFrame(time) {
      render(time);
      return playing || manual !== null;
    },
  });

  // Controls.
  const playBtn = makeButton({ label: '❚❚ Pause', pressed: true, onClick: () => setPlaying(!playing) });
  const turnBtn = makeButton({ label: '⟲ Turn the phone', primary: true, onClick: turn });
  const viewSeg = makeSegmented({ label: 'View', options: [['live', 'Live'], ['story', 'Storyboard']], value: 'live', onChange: setView });
  controls.append(playBtn, turnBtn, h('span', { class: 'dt-spacer' }), viewSeg.el);

  function setPlaying(on) {
    const t = loop.time;
    if (!on && playing) {                            // stop where the phone is, finishing a turn under way
      const s = scheduleAt(t - autoStart);
      if (s.at) resting = s.at;
      else manual = { from: s.from, to: s.to, t0: t - s.tau };
    }
    if (on && !playing) {                            // carry on from where the phone is, also mid-turn
      const T = TURN + SETTLE;
      if (manual) {
        const tau = Math.min(T, t - manual.t0);
        autoStart = t - tau - (manual.to === 'landscape' ? HOLD_UP : HOLD_UP + T + HOLD_SIDE);
      } else {
        autoStart = resting === 'landscape' ? t - (HOLD_UP + T) : t;
      }
      manual = null;
      queued = false;
    }
    playing = on && !frozen;
    playBtn.setAttribute('aria-pressed', String(playing));
    playBtn.textContent = playing ? '❚❚ Pause' : '▶ Play';
    if (!frozen) loop.wake();
  }

  function turn() {
    if (view !== 'live') setView('live');
    if (playing) setPlaying(false);
    if (manual && !reduce && !frozen) { queued = !queued; return; }   // turn again once this turn ends
    const to = resting === 'landscape' ? 'portrait' : 'landscape';
    if (reduce || frozen) { manual = null; resting = to; loop.renderNow(); return; }
    manual = { from: resting, to, t0: loop.time };
    loop.wake();
  }

  function setView(next) {
    view = next === 'story' ? 'story' : 'live';
    if (view === 'story') { buildStory(); if (playing) setPlaying(false); }
    story.hidden = view !== 'story';
    live.hidden = view === 'story';
    viewSeg.set(view);
    loop.renderNow();
  }

  makeLegend([
    { swatch: 'dtl-row0', text: 'Row 0: becomes the left edge' },
    { swatch: 'dtl-col0', text: 'Column 0: becomes the bottom row' },
  ], legend);
  caption.innerHTML =
    '<strong>Send <code>landscapeSource</code> with every frame of a Wide or Tall face: the same data, laid out for ' +
    'the turned shape.</strong> Turned, a Wide button is tall: with a variant it shows that layout at full size, ' +
    'without one its wide face shrinks to fit and the text comes out half as large. Normal and Large faces need ' +
    'none. A script that draws across several buttons finds each one’s place with the formula.' +
    '<p class="dt-note">Turned either way, the page looks the same: row 0 is always on the left.</p>';

  el.replaceChildren(figure);

  // Start.
  if (frozen) {
    playing = true;                                  // the autoplay, frozen at sw.at
    loop.time = sw.at;
    loop.speed = 0;
    render(sw.at);
    playing = false;
    const s = scheduleAt(sw.at);
    if (s.at) resting = s.at; else manual = { from: s.from, to: s.to, t0: sw.at - s.tau };
    playBtn.setAttribute('aria-pressed', 'false');
    playBtn.textContent = '▶ Play';
  } else if (reduce) {
    setPlaying(false);
    setView('story');
  } else {
    setPlaying(true);
  }
  if (sw.view === 'story') setView('story');
  if (!frozen) loop.renderNow();

  const unwatch = watchReducedMotion(on => {
    reduce = on || sw.reduced;
    if (reduce) {
      setPlaying(false);
      if (manual) { resting = manual.to; manual = null; }
      loop.renderNow();
      setView('story');
    }
  });

  return {
    destroy() {
      unwatch();
      loop.destroy();
      el.replaceChildren(...original);
    },
  };
}
