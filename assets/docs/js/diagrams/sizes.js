/*
 * D8 · Sizes (SVG faces › Sizes and the turned phone; SVG reference › Sizes and scale).
 * The four button sizes at their true relative scale on an iPhone, an 11-inch and a 13-inch iPad: the viewBox
 * each one takes, what the rounded corner cuts off a face, a margin of about 16 units and the smallest text.
 * "Faces" puts the docs' own recipes into the same buttons (CPU ring, Network speed, Memory gauge, System
 * dashboard): their frames are what the recipes' --frame prints.
 *
 * Geometry, from the app: a cell of 80 pt with a 16.7 pt gap on an iPhone (the docs' GET /api/view example),
 * about 115 pt and 140 pt with 12 pt gaps on iPads; the corner radius is 0.2237 × the cell side for every size;
 * a face is fitted whole and centered (Fit), and clipped to its viewBox and to the button's corners.
 *
 * mount(el, { mode, reducedMotion }) → { destroy() }
 * Test switches: ?dt-motion=reduce, data-device / ?dt-device=ipad13, data-show / ?dt-show=faces.
 */
import { EASE, Loop, svgEl, readSwitches, watchReducedMotion } from '../face-player.js';
import { ensureStyle, h, makeFigure, makeSegmented, makeLegend, uid } from '../dt-chrome.js';

export const CORNER = 0.2237;          // the button's corner radius, × the cell side
export const MARGIN = 16;              // units of clear margin the docs ask for (about 8% of 200)

export const DEVICES = {
  iphone: { label: 'iPhone', cell: 80, gap: 16.7 },
  ipad11: { label: 'iPad 11″', cell: 115, gap: 12 },
  ipad13: { label: 'iPad 13″', cell: 140, gap: 12 },
};

/** The four sizes, where this diagram puts them on a 3 × 3 patch of the grid, and their text minimums. */
export const SIZES = [
  { key: 'normal', name: 'Normal', span: '1×1', cols: 1, rows: 1, row: 0, col: 0, vb: [200, 200], label: 28, value: null, face: 'ring' },
  { key: 'wide', name: 'Wide', span: '2×1', cols: 2, rows: 1, row: 0, col: 1, vb: [400, 200], label: 28, value: null, face: 'network' },
  { key: 'tall', name: 'Tall', span: '1×2', cols: 1, rows: 2, row: 1, col: 0, vb: [200, 400], label: 28, value: null, face: 'memory' },
  { key: 'large', name: 'Large', span: '2×2', cols: 2, rows: 2, row: 1, col: 1, vb: [200, 200], label: 16, value: 22, face: 'dashboard' },
];

/** A button's size in points. */
export function buttonSize(size, { cell, gap }) {
  return { w: size.cols * cell + (size.cols - 1) * gap, h: size.rows * cell + (size.rows - 1) * gap };
}

/** Points per viewBox unit when the face is fitted whole (Fit). */
export function faceScale(size, device) {
  const { w, h } = buttonSize(size, device);
  return Math.min(w / size.vb[0], h / size.vb[1]);
}

// ─── The docs' recipe frames (what --frame prints), shared with D9 ──────────────────────────────────────────

export const FACES = {
  // CPU ring at 72% (SVG faces › Your first live SVG widget)
  ring: { vb: [200, 200], color: '#8E8E93', svg: `
<circle id='track' cx='100' cy='100' r='78' fill='none' stroke='#FFFFFF' stroke-opacity='0.15' stroke-width='16'/>
<circle id='ring' cx='100' cy='100' r='78' fill='none' stroke='#FF9F0A' stroke-width='16' stroke-linecap='round'
  stroke-dasharray='490.09 490.09' stroke-dashoffset='137.22' transform='rotate(-90 100 100)'/>
<text id='value' x='100' y='116' font-size='56' font-weight='bold' text-anchor='middle' fill='#FFFFFF'>72</text>
<text id='label' x='100' y='146' font-size='28' text-anchor='middle' fill='#FFFFFF' fill-opacity='0.6'>cpu %</text>` },
  // Network speed at 12.3 MB/s, Blue (Recipes › Network speed)
  network: { vb: [400, 200], color: '#0A84FF', svg: `
<clipPath id='window'><rect x='212' y='0' width='176' height='200'/></clipPath>
<line x1='212' y1='165' x2='388' y2='165' stroke='#FFFFFF' stroke-opacity='0.15' stroke-width='2'/>
<g clip-path='url(#window)'><g transform='translate(-16 0)'>
<path d='M 212.0 164.0 L 212.0 146.0 L 228.0 134.0 L 244.0 140.0 L 260.0 116.0 L 276.0 128.0 L 292.0 110.0 L 308.0 122.0 L 324.0 92.0 L 340.0 104.0 L 356.0 116.0 L 372.0 98.0 L 388.0 110.0 L 404.0 90.2 L 404.0 164.0 Z' fill='currentColor' fill-opacity='0.18'/>
<polyline points='212.0,146.0 228.0,134.0 244.0,140.0 260.0,116.0 276.0,128.0 292.0,110.0 308.0,122.0 324.0,92.0 340.0,104.0 356.0,116.0 372.0,98.0 388.0,110.0 404.0,90.2' fill='none' stroke='currentColor' stroke-width='5' stroke-linejoin='round' stroke-linecap='round'/>
</g></g>
<circle cx='388' cy='90.2' r='7' fill='currentColor'/>
<text x='24' y='104' font-size='60' font-weight='bold' fill='#FFFFFF'>12.3</text>
<text x='24' y='146' font-size='28' fill='#FFFFFF' fill-opacity='0.6'>↓ MB/s</text>` },
  // its Landscape Variant
  networkLandscape: { vb: [200, 400], color: '#0A84FF', svg: `
<clipPath id='window'><rect x='12' y='0' width='176' height='400'/></clipPath>
<line x1='12' y1='365' x2='188' y2='365' stroke='#FFFFFF' stroke-opacity='0.15' stroke-width='2'/>
<g clip-path='url(#window)'><g transform='translate(-16 0)'>
<path d='M 12.0 364.0 L 12.0 338.5 L 28.0 321.5 L 44.0 330.0 L 60.0 296.0 L 76.0 313.0 L 92.0 287.5 L 108.0 304.5 L 124.0 262.0 L 140.0 279.0 L 156.0 296.0 L 172.0 270.5 L 188.0 287.5 L 204.0 259.4 L 204.0 364.0 Z' fill='currentColor' fill-opacity='0.18'/>
<polyline points='12.0,338.5 28.0,321.5 44.0,330.0 60.0,296.0 76.0,313.0 92.0,287.5 108.0,304.5 124.0,262.0 140.0,279.0 156.0,296.0 172.0,270.5 188.0,287.5 204.0,259.4' fill='none' stroke='currentColor' stroke-width='5' stroke-linejoin='round' stroke-linecap='round'/>
</g></g>
<circle cx='188' cy='259.4' r='7' fill='currentColor'/>
<text x='100' y='100' font-size='60' font-weight='bold' text-anchor='middle' fill='#FFFFFF'>12.3</text>
<text x='100' y='142' font-size='28' text-anchor='middle' fill='#FFFFFF' fill-opacity='0.6'>↓ MB/s</text>` },
  // Memory gauge at 63% (Recipes › Memory gauge)
  memory: { vb: [200, 400], color: '#8E8E93', svg: `
<rect x='60' y='68' width='80' height='192' rx='20' fill='#FFFFFF' fill-opacity='0.15'/>
<rect x='60' y='139.0' width='80' height='121.0' rx='20' fill='#34C759'/>
<text x='100' y='48' font-size='28' text-anchor='middle' fill='#FFFFFF' fill-opacity='0.6'>memory</text>
<text x='100' y='318' font-size='56' font-weight='bold' text-anchor='middle' fill='#FFFFFF'>63%</text>
<text x='100' y='352' font-size='28' text-anchor='middle' fill='#FFFFFF'>22.7 GB</text>
<text x='100' y='382' font-size='28' text-anchor='middle' fill='#FFFFFF' fill-opacity='0.6'>of 36 GB</text>` },
  // its Landscape Variant
  memoryLandscape: { vb: [400, 200], color: '#8E8E93', svg: `
<rect x='32' y='64' width='336' height='48' rx='20' fill='#FFFFFF' fill-opacity='0.15'/>
<rect x='32' y='64' width='211.7' height='48' rx='20' fill='#34C759'/>
<text x='32' y='46' font-size='28' fill='#FFFFFF' fill-opacity='0.6'>memory</text>
<text x='32' y='178' font-size='48' font-weight='bold' fill='#FFFFFF'>63%</text>
<text x='368' y='148' font-size='28' text-anchor='end' fill='#FFFFFF'>22.7 GB</text>
<text x='368' y='178' font-size='28' text-anchor='end' fill='#FFFFFF' fill-opacity='0.6'>of 36 GB</text>` },
  // System dashboard: CPU 42%, memory 63% (Recipes › System dashboard)
  dashboard: { vb: [200, 200], color: '#8E8E93', svg: `
<clipPath id='window'><rect x='16' y='100' width='165' height='90'/></clipPath>
<circle cx='62' cy='62' r='40' fill='none' stroke='#FFFFFF' stroke-opacity='0.15' stroke-width='12'/>
<circle cx='62' cy='62' r='40' fill='none' stroke='#34C759' stroke-width='12' stroke-linecap='round'
  stroke-dasharray='251.33 251.33' stroke-dashoffset='145.77' transform='rotate(-90 62 62)'/>
<rect x='122' y='88' width='62' height='10' rx='5' fill='#FFFFFF' fill-opacity='0.15'/>
<rect x='122' y='88' width='39.1' height='10' rx='5' fill='#BF5AF2'/>
<line x1='16' y1='177' x2='181' y2='177' stroke='#FFFFFF' stroke-opacity='0.15' stroke-width='2'/>
<g clip-path='url(#window)'><g transform='translate(-15 0)'>
<polyline points='16.0,168.3 31.0,164.5 46.0,166.4 61.0,156.8 76.0,159.4 91.0,147.8 106.0,151.7 121.0,156.2 136.0,142.7 151.0,145.9 166.0,153.0 181.0,150.4 196.0,149.1' fill='none' stroke='#34C759' stroke-width='4' stroke-linejoin='round' stroke-linecap='round'/>
</g></g>
<text x='62' y='69' font-size='22' font-weight='bold' text-anchor='middle' fill='#FFFFFF'>42%</text>
<text x='62' y='88' font-size='16' text-anchor='middle' fill='#FFFFFF' fill-opacity='0.6'>cpu</text>
<text x='122' y='42' font-size='16' fill='#FFFFFF' fill-opacity='0.6'>memory</text>
<text x='122' y='76' font-size='28' font-weight='bold' fill='#FFFFFF'>63%</text>` },
};

/**
 * Draws a recipe frame into `parent` (in its viewBox units). Ids get a page-unique suffix, so the same face can
 * be on the page twice; `currentColor` becomes the button's Color.
 */
export function drawFace(name, parent) {
  const face = FACES[name];
  const suffix = '-' + uid('f');
  const src = face.svg
    .replace(/id='([^']+)'/g, (m, id) => `id='${id}${suffix}'`)
    .replace(/url\(#([^)]+)\)/g, (m, id) => `url(#${id}${suffix})`);
  const doc = new DOMParser().parseFromString(`<svg xmlns='http://www.w3.org/2000/svg'>${src}</svg>`, 'image/svg+xml');
  const g = svgEl('g', { class: 'dtz-face', style: `color: ${face.color}` }, parent);
  for (const node of [...doc.documentElement.childNodes]) {
    if (node.nodeType === 1) g.appendChild(document.importNode(node, true));
  }
  return g;
}

// ─── Layout ─────────────────────────────────────────────────────────────────────────────────────────────────

const PAD = 14;                        // points of phone screen around the 3 × 3 patch

/**
 * Where everything goes for a device (cell and gap may lie between two devices while it changes). A wide card
 * keeps one width for every device, so they compare; a narrow one fits the device to its width.
 */
export function layoutFor(device, { fixedFrame = true } = {}) {
  const side = d => 3 * d.cell + 2 * d.gap;
  const grid = side(device);
  const width = fixedFrame ? side(DEVICES.ipad13) + 2 * PAD : grid + 2 * PAD;
  const height = grid + 2 * PAD;
  const ox = PAD, oy = PAD;                  // anchored top left: a larger device grows right and down
  const cells = {};
  for (const s of SIZES) {
    const { w, h } = buttonSize(s, device);
    const x = ox + s.col * (device.cell + device.gap), y = oy + s.row * (device.cell + device.gap);
    const k = Math.min(w / s.vb[0], h / s.vb[1]);
    const fw = s.vb[0] * k, fh = s.vb[1] * k;
    cells[s.key] = { x, y, w, h, r: CORNER * device.cell, k, fx: x + (w - fw) / 2, fy: y + (h - fh) / 2, fw, fh };
  }
  return { width, height, screen: { x: ox - PAD, y: 0, w: grid + 2 * PAD, h: height }, cells };
}

const CSS = `
.dt-diagram .dtz-wrap { display: grid; grid-template-columns: minmax(0, 1fr) minmax(200px, 236px); gap: 18px; align-items: start; }
.dt-diagram .dtz-stage { display: block; width: 100%; max-width: 472px; height: auto; margin: 0; }
.dt-diagram .dtz-stage text {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif; font-variant-numeric: tabular-nums;
}
.dt-diagram .dtz-stage .dtz-tag { font-family: var(--dt-mono); fill: var(--dt-accent); }
.dt-diagram .dtz-stage .dtz-inset { fill: none; stroke: var(--dt-accent); stroke-width: 1; stroke-dasharray: 4 3; }
.dt-diagram .dtz-stage .dtz-wedge { fill: var(--dt-warn); fill-opacity: 0.55; }
.dt-diagram .dtz-stage [data-layer] { transition: opacity 0.2s; }
.dt-diagram.dtz-reduce .dtz-stage [data-layer] { transition: none; }
.dt-diagram .dt-swatch.dtz-dash { background: transparent; border: 1px dashed var(--dt-accent); }
.dt-diagram .dtz-list { display: grid; gap: 8px; font-size: 0.75rem; line-height: 1.45; }
.dt-diagram .dtz-item { border: 1px solid var(--dt-border); border-radius: 10px; padding: 9px 11px; }
.dt-diagram .dtz-item b { display: block; color: var(--dt-ink); font-weight: 600; font-size: 0.8125rem; }
.dt-diagram .dtz-item code { font-size: 0.6875rem; }
.dt-diagram .dtz-item .dtz-dim { color: var(--dt-muted); }
@container dt (max-width: 600px) {
  .dt-diagram .dtz-wrap { grid-template-columns: minmax(0, 1fr); }
  .dt-diagram .dtz-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@container dt (max-width: 300px) {
  .dt-diagram .dtz-list { grid-template-columns: minmax(0, 1fr); }
}
`;

const fmt = n => String(Math.round(n));

/** What one size's readout says for a device: the button in points, and how large its smallest text comes out. */
export function readout(size, device) {
  const { w, h } = buttonSize(size, device);
  const k = faceScale(size, device);
  const text = size.value
    ? `${size.label}- and ${size.value}-unit text ≈ ${fmt(size.label * k)} and ${fmt(size.value * k)} pt`
    : `${size.label}-unit text ≈ ${fmt(size.label * k)} pt`;
  return { title: `${size.name} (${size.span})`, button: `${fmt(w)} × ${fmt(h)} pt`, text };
}

// ─── The diagram ────────────────────────────────────────────────────────────────────────────────────────────

export default function mount(el, { reducedMotion = false } = {}) {
  ensureStyle('dt-sizes', CSS);
  const sw = readSwitches(el, { reducedMotion });
  let reduce = sw.reduced;
  const q = new URLSearchParams(location.search);
  const original = [...el.childNodes];
  let deviceKey = DEVICES[el.dataset.device || q.get('dt-device')] ? (el.dataset.device || q.get('dt-device')) : 'iphone';
  let show = (el.dataset.show || q.get('dt-show')) === 'faces' ? 'faces' : 'guides';

  const { figure, controls, body, legend, caption, announce } = makeFigure({
    name: 'sizes',
    eyebrow: 'Button sizes',
    title: 'Each size has its own viewBox.',
    lede: 'Four buttons as the phone draws them, at their true sizes against each other. ' +
      'Switch devices: an iPad draws the same faces larger.',
  });
  if (reduce) figure.classList.add('dtz-reduce');

  // Stage: one patch of phone screen with the four buttons.
  const stage = svgEl('svg', { class: 'dtz-stage', role: 'img' });
  const defs = svgEl('defs', {}, stage);
  const rimId = uid('dtz-rim');
  const rim = svgEl('linearGradient', { id: rimId, x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
  [['0', '0.18'], ['0.5', '0.06'], ['1', '0']].forEach(([o, a]) =>
    svgEl('stop', { offset: o, 'stop-color': '#FFFFFF', 'stop-opacity': a }, rim));
  const screen = svgEl('rect', { fill: '#0D0D0D' }, stage);

  const cells = SIZES.map(s => {
    const clipId = uid('dtz-clip'), vbClipId = uid('dtz-vb'), maskId = uid('dtz-mask');
    const clipRect = svgEl('rect', {}, svgEl('clipPath', { id: clipId }, defs));
    const mask = svgEl('mask', { id: maskId, maskUnits: 'userSpaceOnUse' }, defs);
    const maskOn = svgEl('rect', { fill: '#FFFFFF' }, mask);
    const maskOff = svgEl('rect', { fill: '#000000' }, mask);

    const root = svgEl('g', {}, stage);
    const glass = svgEl('rect', { fill: '#FFFFFF', 'fill-opacity': 0.08 }, root);
    const clipped = svgEl('g', { 'clip-path': `url(#${clipId})` }, root);
    const face = svgEl('svg', { viewBox: `0 0 ${s.vb[0]} ${s.vb[1]}`, preserveAspectRatio: 'xMidYMid meet', overflow: 'hidden' }, clipped);
    svgEl('rect', { x: 0, y: 0, width: s.vb[0], height: s.vb[1] }, svgEl('clipPath', { id: vbClipId }, face));
    const host = svgEl('g', { 'clip-path': `url(#${vbClipId})` }, face);

    // Faces: the recipe's frame.
    const faces = svgEl('g', { 'data-layer': 'faces' }, host);
    drawFace(s.face, faces);

    // Guides: the margin, the viewBox's size and the smallest text, in the face's own units.
    const guides = svgEl('g', { 'data-layer': 'guides' }, host);
    const [vw, vh] = s.vb;
    svgEl('rect', { class: 'dtz-inset', x: MARGIN, y: MARGIN, width: vw - 2 * MARGIN, height: vh - 2 * MARGIN,
      'vector-effect': 'non-scaling-stroke' }, guides);
    const cy = vh / 2;
    const tag = svgEl('text', { class: 'dtz-tag', x: vw / 2, y: s.value ? cy - 18 : cy - 8, 'font-size': s.label,
      'text-anchor': 'middle' }, guides);
    tag.textContent = `${vw}×${vh}`;
    if (s.value) {
      const v = svgEl('text', { x: vw / 2, y: cy + 20, 'font-size': s.value, 'font-weight': 'bold', 'text-anchor': 'middle',
        fill: '#FFFFFF' }, guides);
      v.textContent = `value · ${s.value}`;
    }
    const lab = svgEl('text', { x: vw / 2, y: s.value ? cy + 46 : cy + 36, 'font-size': s.label, 'text-anchor': 'middle',
      fill: '#FFFFFF', 'fill-opacity': 0.6 }, guides);
    lab.textContent = `label · ${s.label}`;

    const rimRect = svgEl('rect', { fill: 'none', stroke: `url(#${rimId})`, 'stroke-width': 1 }, root);
    // What the rounded corner cuts off the viewBox: shown on top, outside the clip.
    const wedges = svgEl('g', { 'data-layer': 'guides' }, root);
    const wedge = svgEl('rect', { class: 'dtz-wedge', mask: `url(#${maskId})` }, wedges);
    return { s, clipRect, maskOn, maskOff, glass, face, rimRect, wedge, root, faces, guides, wedges };
  });

  // Readout.
  const list = h('div', { class: 'dtz-list', attrs: { 'aria-live': 'off' } });
  const items = SIZES.map(s => {
    const name = h('b'), button = h('span'), text = h('span', { class: 'dtz-dim' });
    list.appendChild(h('div', { class: 'dtz-item' }, name, button, h('br'), text));
    return { s, name, button, text };
  });
  body.appendChild(h('div', { class: 'dtz-wrap' }, stage, list));

  function writeReadout() {
    const d = DEVICES[deviceKey];
    for (const { s, name, button, text } of items) {
      const r = readout(s, d);
      name.textContent = r.title;
      button.textContent = r.button;
      text.textContent = r.text;
    }
    stage.setAttribute('aria-label', `The four button sizes on an ${d.label}, ${show === 'faces'
      ? 'with recipe faces' : 'with their viewBox, the margin to keep and the smallest text'}.`);
  }

  // Applying a layout (also one in between two devices).
  let fixedFrame = true;
  function apply(L) {
    stage.setAttribute('viewBox', `0 0 ${L.width.toFixed(2)} ${L.height.toFixed(2)}`);
    const sc = L.screen;
    Object.entries({ x: sc.x, y: sc.y, width: sc.w, height: sc.h }).forEach(([k, v]) => screen.setAttribute(k, v.toFixed(2)));
    screen.setAttribute('rx', (L.cells.normal.r + PAD * 0.6).toFixed(2));
    for (const c of cells) {
      const g = L.cells[c.s.key];
      const box = { x: g.x.toFixed(2), y: g.y.toFixed(2), width: g.w.toFixed(2), height: g.h.toFixed(2), rx: g.r.toFixed(2) };
      for (const n of [c.clipRect, c.glass, c.maskOff]) for (const k in box) n.setAttribute(k, box[k]);
      for (const k of ['x', 'y', 'width', 'height']) c.face.setAttribute(k, box[k]);
      const rr = { x: (g.x + 0.5).toFixed(2), y: (g.y + 0.5).toFixed(2), width: (g.w - 1).toFixed(2),
        height: (g.h - 1).toFixed(2), rx: (g.r - 0.5).toFixed(2) };
      for (const k in rr) c.rimRect.setAttribute(k, rr[k]);
      const fb = { x: g.fx.toFixed(2), y: g.fy.toFixed(2), width: g.fw.toFixed(2), height: g.fh.toFixed(2) };
      for (const n of [c.wedge, c.maskOn]) for (const k in fb) n.setAttribute(k, fb[k]);
    }
  }

  // Device changes glide unless motion is reduced.
  let from = { ...DEVICES[deviceKey] }, to = from, t0 = 0;
  const TWEEN = 0.5;
  const current = time => {
    const p = reduce ? 1 : EASE.easeInOut(Math.min(1, Math.max(0, (time - t0) / TWEEN)));
    return { cell: from.cell + (to.cell - from.cell) * p, gap: from.gap + (to.gap - from.gap) * p, p };
  };
  const loop = new Loop({
    root: figure,
    onFrame(time) {
      const d = current(time);
      apply(layoutFor(d, { fixedFrame }));
      return d.p < 1;
    },
  });

  function setDevice(key) {
    const d = current(loop.time);
    from = { cell: d.cell, gap: d.gap };
    to = DEVICES[key];
    deviceKey = key;
    t0 = loop.time;
    writeReadout();
    announce(`${DEVICES[key].label}: one button is ${fmt(DEVICES[key].cell)} points.`);
    if (reduce) loop.renderNow(); else loop.wake();
  }

  function setShow(next) {
    show = next;
    for (const c of cells) {
      c.faces.style.opacity = show === 'faces' ? 1 : 0;
      c.guides.style.opacity = show === 'guides' ? 1 : 0;
      c.wedges.style.opacity = show === 'guides' ? 1 : 0;
    }
    writeReadout();
  }

  const deviceSeg = makeSegmented({ label: 'Device', value: deviceKey, onChange: setDevice,
    options: Object.entries(DEVICES).map(([k, d]) => [k, d.label]) });
  const showSeg = makeSegmented({ label: 'Show', value: show, onChange: setShow,
    options: [['guides', 'Guides'], ['faces', 'Faces']] });
  controls.append(deviceSeg.el, h('span', { class: 'dt-spacer' }), showSeg.el);

  makeLegend([
    { swatch: 'dtz-dash', text: 'Keep inside: about 16 units from every edge' },
    { swatch: 'fade', text: 'Cut off by the rounded corner' },
    { swatch: 'text', text: 'Smallest text, in viewBox units' },
  ], legend);
  caption.innerHTML =
    '<strong>Give each size its own viewBox, keep about 16 units clear of the edges, and set no text below 28 units ' +
    '(on a Large face, 16 for labels and 22 for values).</strong> The face then fills the button, the corners cut off ' +
    'nothing that matters, and the smallest text is as large as a plain button’s label. An iPad draws the same face ' +
    'larger, so design for the iPhone.' +
    '<p class="dt-note">A Wide button is a little wider than 2 : 1 and a Tall one a little taller than 1 : 2, so their ' +
    'faces keep a thin empty strip at the ends. “Faces” shows the CPU ring, Network speed, Memory gauge and System ' +
    'dashboard recipes.</p>';

  el.replaceChildren(figure);

  // Narrow cards fit the current device to the width; wide ones keep one frame, so devices compare.
  let roFrame = 0;
  const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
    cancelAnimationFrame(roFrame);
    roFrame = requestAnimationFrame(() => {        // after layout, so a new height never re-enters the observer
      const wide = figure.clientWidth === 0 || figure.clientWidth >= 520;
      if (wide !== fixedFrame) { fixedFrame = wide; loop.renderNow(); }
    });
  });
  if (ro) ro.observe(figure);
  fixedFrame = figure.clientWidth === 0 || figure.clientWidth >= 520;

  setShow(show);
  loop.renderNow();

  const unwatch = watchReducedMotion(on => {
    reduce = on || sw.reduced;
    figure.classList.toggle('dtz-reduce', reduce);
    if (reduce) { t0 = -TWEEN; loop.renderNow(); }
  });

  return {
    destroy() {
      unwatch();
      if (ro) ro.disconnect();
      cancelAnimationFrame(roFrame);
      loop.destroy();
      el.replaceChildren(...original);
    },
  };
}
