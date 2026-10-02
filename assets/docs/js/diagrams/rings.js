/*
 * D7 · Rings: a dashed circle vs an arc path, and the colors on the way (SVG faces › Rings and gauges).
 * Both rings jump 10 → 90 → 10% every 2.5 s with the CPU ring's settings (easeInOut, 0.6 s) and its colors.
 * The dashed circle is drawn live by the face player: only stroke-dashoffset and the color change, which the
 * phone glides exactly. The arc path is never drawn by the browser: its moments are stills the app's engine
 * drew (DeckSVGSnapshot.glide at HEAD, 5 moments of the same glide, img/diagrams/rings-*.png), and the
 * strip marks the one the live ring has reached. Below, the RGB blend strip and the CPU ring's level bands.
 * Frames: the CPU-ring recipe's geometry (r = 78, C = 2πr with π = 3.14159265, colors by level band).
 *
 * mount(el, { mode, reducedMotion }) → { destroy() }
 * Test switches (face-player.js readSwitches): data-at / ?dt-at=<s>, data-view / ?dt-view=story, ?dt-motion=reduce.
 */
import {
  FaceModel, Loop, EASE, frame, hexToRgb, rgb, makeCell, svgEl, readSwitches, watchReducedMotion,
} from '../face-player.js';
import { ensureStyle, h, makeFigure, makeButton, makeSegmented, makeLegend, setChip } from '../dt-chrome.js';

export const RING_C = 2 * 3.14159265 * 78;          // as the recipe's awk: 2 × π × r
const RING_DASH = RING_C.toFixed(2);
export const LOW = 10;
export const HIGH = 90;
export const PERIOD = 2.5;
export const DURATION = 0.6;
export const MOMENTS = ['start', '1/4', '1/2', '3/4', 'end'];   // equal shares of the way, as the engine stills
const GREEN = '#34C759', ORANGE = '#FF9F0A', RED = '#FF453A';

/** The CPU ring's color for a level. */
export const ringColor = pct => (pct < 50 ? GREEN : pct < 80 ? ORANGE : RED);

/** Halfway between two colors, channel by channel, as a glide passes it. */
export function blendMid(a, b) {
  const x = hexToRgb(a), y = hexToRgb(b);
  return x.map((v, i) => Math.round((v + y[i]) / 2));
}

/** One frame of the dashed ring at `pct`, as the recipe sends it. */
export function dashFrame(pct) {
  const color = ringColor(pct);
  const [r, g, b] = hexToRgb(color);
  const offset = +(RING_C * (1 - pct / 100)).toFixed(2);
  return frame(['track', 'ring', 'value', 'label'], { offset, r, g, b }, { value: String(pct) }, { pct, color });
}

/** The end point of the arc path for `pct` (it starts at 12 o'clock and runs clockwise). */
export function arcEnd(pct) {
  const a = (pct / 100) * 2 * 3.14159265;
  return { x: (100 + 78 * Math.sin(a)).toFixed(2), y: (100 - 78 * Math.cos(a)).toFixed(2), large: pct > 50 ? 1 : 0 };
}

/** How a moment reads in a sentence. */
const momentText = i => (i === 0 ? 'at the start' : i === MOMENTS.length - 1 ? 'at the end' : `${MOMENTS[i]} of the way`);

const IMG = name => new URL(`../../img/diagrams/${name}.png`, import.meta.url).href;
const stillSet = (kind, up) => MOMENTS.map((_, i) => IMG(`rings-${kind}-${up ? 'up' : 'down'}-${i}`));

// ─── Drawing ─────────────────────────────────────────────────────────────────────────────────────────────────

function treeMaker(host) {
  return () => {
    const root = svgEl('g', {}, host);
    svgEl('circle', { cx: 100, cy: 100, r: 78, fill: 'none', stroke: '#FFFFFF', 'stroke-opacity': 0.15,
      'stroke-width': 16 }, root);
    const ring = svgEl('circle', { cx: 100, cy: 100, r: 78, fill: 'none', 'stroke-width': 16, 'stroke-linecap': 'round',
      'stroke-dasharray': `${RING_DASH} ${RING_DASH}`, transform: 'rotate(-90 100 100)' }, root);
    const value = svgEl('text', { x: 100, y: 116, 'font-size': 56, 'font-weight': 'bold', 'text-anchor': 'middle',
      fill: '#FFFFFF' }, root);
    const label = svgEl('text', { x: 100, y: 146, 'font-size': 28, 'text-anchor': 'middle', fill: '#FFFFFF',
      'fill-opacity': 0.6 }, root);
    label.textContent = 'cpu %';
    return { root, ring, value };
  };
}

function draw(model, t) {
  for (const { tree, values: v, texts, opacity } of model.stateAt(t)) {
    tree.root.setAttribute('opacity', opacity.toFixed(4));
    tree.ring.setAttribute('stroke', rgb(v.r, v.g, v.b));
    tree.ring.setAttribute('stroke-dashoffset', v.offset.toFixed(2));
    if (tree.value.textContent !== texts.value) tree.value.textContent = texts.value;
  }
}

// ─── What the script sent ────────────────────────────────────────────────────────────────────────────────────

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = (on, text) => (on ? `<span class="num">${esc(text)}</span>` : esc(text));
const row = html => `<span class="dt-row">${html}</span>`;

function dashSource(f, prev) {
  const ch = prev && prev.pct !== f.pct;
  return row(`<span class="tag">&lt;circle id='ring'</span> stroke='${num(ch, f.color)}'`) +
    row(`    stroke-dasharray='${RING_DASH} ${RING_DASH}'`) +
    row(`    stroke-dashoffset='${num(ch, f.nums.offset.toFixed(2))}' … /&gt;`);
}

function arcSource(f, prev) {
  const ch = prev && prev.pct !== f.pct;
  const e = arcEnd(f.pct);
  return row(`<span class="tag">&lt;path id='ring'</span> stroke='${num(ch, f.color)}'`) +
    row(`    d='M 100 22 A 78 78`) +
    row(`       0 ${num(ch, e.large)} 1 ${num(ch, e.x)} ${num(ch, e.y)}' … /&gt;`);
}

// ─── Diagram CSS (on top of the shared chrome) ───────────────────────────────────────────────────────────────

const CSS = `
.dt-diagram .dt-rings-stills { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; margin: 14px 0 10px; }
.dt-diagram .dt-rings-stills > figure { margin: 0; text-align: center; min-width: 0; }
.dt-diagram .dt-rings-stills img {
  display: block; width: 100%; max-width: 110px; height: auto; margin: 0 auto; border-radius: 22%;
  outline: 2px solid transparent; outline-offset: 1px; transition: outline-color 0.12s;
}
.dt-diagram .dt-rings-stills > figure.is-now img { outline-color: var(--dt-warn); }
.dt-diagram[data-dt-name="rings"] .dt-pane-note code { white-space: nowrap; }
.dt-diagram .dt-rings-stills figcaption {
  font-family: var(--dt-mono); font-size: 0.6875rem; letter-spacing: 0.06em; color: var(--dt-muted); margin-top: 4px;
}
.dt-diagram .dt-rings-stills > figure.is-now figcaption { color: var(--dt-warn); }
.dt-diagram .dt-story .dt-rings-stills img { max-width: 120px; }
.dt-diagram .dt-story .dt-rings-stills > figure img { outline: 0; }
.dt-diagram .dt-story .dt-rings-stills > figure figcaption { color: var(--dt-muted); }
.dt-diagram .dt-rings-drawn { margin: 0; font-size: 0.75rem; line-height: 1.5; color: var(--dt-muted); }

.dt-diagram .dt-blend { margin-top: 14px; border: 1px solid var(--dt-border); border-radius: 12px; padding: 14px 14px 12px; }
.dt-diagram .dt-blend-row + .dt-blend-row { margin-top: 14px; }
.dt-diagram .dt-blend-name { margin: 4px 0 8px; color: var(--dt-ink); font-size: 0.8125rem; font-weight: 600; line-height: 1.4; }
.dt-diagram .dt-blend-bar { position: relative; height: 18px; border-radius: 9px; }
.dt-diagram .dt-blend-bar.glide-bar { background: linear-gradient(90deg, ${GREEN}, ${RED}); }
.dt-diagram .dt-blend-bar.bands { display: flex; overflow: hidden; }
.dt-diagram .dt-blend-bar.bands > span { display: block; height: 100%; }
.dt-diagram .dt-blend-mid {
  position: absolute; left: 50%; top: -4px; bottom: -4px; width: 0; border-left: 1px dashed rgba(255, 255, 255, 0.75);
}
.dt-diagram .dt-blend-marker {
  position: absolute; top: 50%; left: 0; width: 12px; height: 12px; margin: -6px 0 0 -6px; border-radius: 50%;
  border: 2px solid #FFFFFF; background: transparent; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5);
}
.dt-diagram .dt-blend-scale {
  position: relative; height: 1.6em; margin-top: 6px;
  font-family: var(--dt-mono); font-size: 0.625rem; letter-spacing: 0.04em; color: var(--dt-muted); white-space: nowrap;
}
.dt-diagram .dt-blend-scale > span { position: absolute; top: 0; }
.dt-diagram .dt-blend-scale .mid { color: var(--dt-ink); }
.dt-diagram .dt-blend-scale .mid i {
  display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; font-style: normal;
}
@container dt (max-width: 560px) {
  .dt-diagram .dt-rings-stills { gap: 4px; }
  .dt-diagram .dt-blend-scale .wide { display: none; }
}
`;

// ─── The diagram ─────────────────────────────────────────────────────────────────────────────────────────────

export default function mount(el, { reducedMotion = false } = {}) {
  ensureStyle('dt-rings', CSS);
  const sw = readSwitches(el, { reducedMotion });
  let reduce = sw.reduced;
  const original = [...el.childNodes];

  const { figure, controls, body, legend, caption, announce } = makeFigure({
    name: 'rings',
    eyebrow: 'Rings and gauges',
    title: 'A dashed circle slides along the ring. An arc path bends out of shape.',
    lede: `Both rings jump between ${LOW}% and ${HIGH}% with the CPU ring’s settings. ` +
      'They differ in how the script draws the colored part.',
  });

  const panesEl = h('div', { class: 'dt-panes' });
  const storyEl = h('div', { class: 'dt-story', hidden: '' });
  const blendEl = h('div', { class: 'dt-blend' });
  body.append(panesEl, storyEl, blendEl);

  // Pane A: the dashed circle, drawn live.
  const cell = makeCell({ unit: 160 });
  const model = new FaceModel({ makeTree: treeMaker(cell.host), dropTree: tree => tree.root.remove() });
  const chipA = h('span', { class: 'dt-chip' });
  const phaseA = h('span', { class: 'dt-phase' });
  const fillA = h('span');
  const barA = h('div', { class: 'dt-bar' }, fillA);
  const reasonA = h('p', { class: 'dt-reason' });
  const sourceA = h('div', { class: 'dt-code', attrs: { role: 'group', 'aria-label': 'The dashed circle’s frame' } });
  panesEl.appendChild(h('section', { class: 'dt-pane', attrs: { 'aria-label': 'Do this: a dashed circle' } },
    h('div', { class: 'dt-pane-label', text: 'Do this' }),
    h('p', { class: 'dt-pane-title', text: 'A dashed circle' }),
    h('p', { class: 'dt-pane-note', html: 'a full <code>&lt;circle&gt;</code>; the script changes <code>stroke-dashoffset</code>' }),
    h('div', { class: 'dt-cellwrap' }, cell.svg),
    h('div', { class: 'dt-status' }, h('div', { class: 'dt-chiprow' }, chipA, phaseA), barA, reasonA),
    sourceA));

  // Pane B: the arc path, as stills the app drew.
  const chipB = h('span', { class: 'dt-chip' });
  const phaseB = h('span', { class: 'dt-phase' });
  const reasonB = h('p', { class: 'dt-reason' });
  const sourceB = h('div', { class: 'dt-code', attrs: { role: 'group', 'aria-label': 'The arc path’s frame' } });
  const stillsB = h('div', { class: 'dt-rings-stills' });
  const stillFigures = MOMENTS.map(m => {
    const img = h('img', { alt: '', width: 264, height: 264, decoding: 'async' });
    const fig = h('figure', {}, img, h('figcaption', { text: m }));
    stillsB.appendChild(fig);
    return { fig, img };
  });
  panesEl.appendChild(h('section', { class: 'dt-pane', attrs: { 'aria-label': 'Not this: an arc path' } },
    h('div', { class: 'dt-pane-label', text: 'Not this' }),
    h('p', { class: 'dt-pane-title', text: 'An arc path' }),
    h('p', { class: 'dt-pane-note', html: 'a <code>&lt;path&gt;</code> arc; the script moves its end point' }),
    stillsB,
    h('p', { class: 'dt-rings-drawn', text: 'Drawn by Desktap at five moments of the same glide.' }),
    h('div', { class: 'dt-status' }, h('div', { class: 'dt-chiprow' }, chipB, phaseB), reasonB),
    sourceB));

  // The colors on the way.
  const [mr, mg, mb] = blendMid(GREEN, RED);
  const marker = h('span', { class: 'dt-blend-marker', attrs: { 'aria-hidden': 'true' } });
  blendEl.append(
    h('div', { class: 'dt-pane-label', text: 'Colors on the way' }),
    h('div', { class: 'dt-blend-row' },
      h('p', { class: 'dt-blend-name', text: 'A glide from green to red' }),
      h('div', { class: 'dt-blend-bar glide-bar', attrs: { role: 'img',
        'aria-label': `Green blending into red: halfway it is olive, rgb(${mr} ${mg} ${mb})` } },
        h('span', { class: 'dt-blend-mid' }), marker),
      h('div', { class: 'dt-blend-scale', attrs: { 'aria-hidden': 'true' } },
        h('span', { class: 'wide', text: GREEN, attrs: { style: 'left:0' } }),
        h('span', { class: 'mid', attrs: { style: 'left:50%;transform:translateX(-50%)' } },
          h('i', { attrs: { style: `background:rgb(${mr},${mg},${mb})` } }), `olive · rgb(${mr} ${mg} ${mb})`),
        h('span', { class: 'wide', text: RED, attrs: { style: 'right:0' } }))),
    h('div', { class: 'dt-blend-row' },
      h('p', { class: 'dt-blend-name', text: 'Colors picked by level, as the CPU ring does' }),
      h('div', { class: 'dt-blend-bar bands', attrs: { role: 'img',
        'aria-label': 'Green below 50%, orange from 50% to 79%, red from 80%' } },
        h('span', { attrs: { style: `flex:50;background:${GREEN}` } }),
        h('span', { attrs: { style: `flex:30;background:${ORANGE}` } }),
        h('span', { attrs: { style: `flex:20;background:${RED}` } })),
      h('div', { class: 'dt-blend-scale', attrs: { 'aria-hidden': 'true' } },
        h('span', { text: '0%', attrs: { style: 'left:0' } }),
        h('span', { text: '50%', attrs: { style: 'left:50%;transform:translateX(-50%)' } }),
        h('span', { text: '80%', attrs: { style: 'left:80%;transform:translateX(-50%)' } }),
        h('span', { text: '100%', attrs: { style: 'right:0' } }))));

  // State: which way the last jump went, and the frames sent.
  let up = true, prev = null;

  function setStills(goingUp) {
    const srcs = stillSet('arc', goingUp);
    stillFigures.forEach(({ img }, i) => {
      img.src = srcs[i];
      img.alt = `The arc path going ${goingUp ? `${LOW} to ${HIGH}` : `${HIGH} to ${LOW}`}%, ${momentText(i)}`;
    });
  }

  function describe(result, f) {
    barA.className = 'dt-bar';
    if (result.kind === 'first') {
      setChip(chipA, '', 'First frame');
      reasonA.textContent = 'Shown at once. The next frames change it.';
      setChip(chipB, '', 'First frame');
      reasonB.textContent = 'Shown at once, the same picture as the dashed circle.';
    } else if (result.kind === 'instant') {
      setChip(chipA, '', 'At once');
      reasonA.innerHTML = 'Reduce Motion is on, so this diagram shows each frame at once. The storyboard shows the glide.';
      setChip(chipB, 'fade', 'Out of shape');
      reasonB.textContent = 'On the way, the arc leaves the ring: see the moments above.';
    } else {
      setChip(chipA, 'glide', 'Glide');
      barA.classList.add('glide');
      reasonA.innerHTML = `The colored part slides along the ring; the color glides with it. “${esc(f.texts.value)}” swaps at once.`;
      setChip(chipB, 'fade', 'Out of shape');
      reasonB.textContent = 'It glides too, but on the way the arc shrinks into a loop inside the ring and grows back.';
    }
    sourceA.innerHTML = dashSource(f, prev);
    sourceB.innerHTML = arcSource(f, prev);
    cell.setLabel(`A dashed CPU ring at ${f.pct}%`);
  }

  // Clock and autoplay.
  let playing = false, k = 0, nextAt = PERIOD, view = 'live';
  const frozen = sw.at !== null;

  function send(index, t, spoken) {
    const pct = index % 2 === 0 ? LOW : HIGH;
    const f = dashFrame(pct);
    up = pct === HIGH;
    const result = model.apply(f, t, reduce ? 0 : DURATION, 'easeInOut');
    if (index > 0) setStills(up);
    describe(result, f);
    prev = f;
    if (spoken) announce(`Frame ${pct}%. The dashed circle glides; the arc path bends out of shape on the way.`);
  }

  function render(time) {
    draw(model, time);
    const m = model.motionAt(time);
    fillA.style.width = `${(m.p * 100).toFixed(1)}%`;
    phaseA.textContent = !m.kind ? 'resting' : `gliding · ${m.elapsed.toFixed(2)} / ${m.dur} s`;
    // The share of the way both rings have come, and the engine still nearest to it.
    const share = m.kind ? EASE.easeInOut(m.p) : 1;
    const moving = !!m.kind && k > 0;
    const now = k === 0 ? 0 : Math.round(share * (MOMENTS.length - 1));
    stillFigures.forEach(({ fig }, i) => fig.classList.toggle('is-now', i === now));
    phaseB.textContent = moving ? momentText(now) : (k === 0 ? 'resting' : 'resting · back on the ring');
    const colorShare = k === 0 ? 0 : up ? share : 1 - share;
    marker.style.left = `${(colorShare * 100).toFixed(2)}%`;
    const top = model.stateAt(time).at(-1);
    if (top) marker.style.background = rgb(top.values.r, top.values.g, top.values.b);
  }

  const loop = new Loop({
    root: figure,
    onFrame(time) {
      if (playing) while (time >= nextAt) { k += 1; send(k, nextAt, false); nextAt += PERIOD; }
      render(time);
      return playing || model.busyAt(time);
    },
  });

  // Controls.
  const playBtn = makeButton({ label: '❚❚ Pause', pressed: true, onClick: () => setPlaying(!playing) });
  const sendBtn = makeButton({ label: 'Send next frame', primary: true, onClick: sendNext });
  const speed = makeSegmented({ label: 'Speed', options: [['1', '1×'], ['0.25', '¼×']], value: '1',
    onChange: v => { if (!frozen) loop.speed = parseFloat(v); } });
  const viewSeg = makeSegmented({ label: 'View', options: [['live', 'Live'], ['story', 'Storyboard']], value: 'live',
    onChange: setView });
  controls.append(playBtn, sendBtn, h('span', { class: 'dt-spacer' }), speed.el, viewSeg.el);

  function setPlaying(on) {
    playing = on && !frozen;
    playBtn.setAttribute('aria-pressed', String(playing));
    playBtn.textContent = playing ? '❚❚ Pause' : '▶ Play';
    if (playing) { nextAt = loop.time + PERIOD; loop.wake(); }
  }

  function sendNext() {
    if (view !== 'live') setView('live');
    k += 1;
    send(k, loop.time, true);
    nextAt = loop.time + PERIOD;
    loop.renderNow();
    if (!frozen) loop.wake();
  }

  // Storyboard: the jump up, both ways of drawing, as the app's engine draws them.
  function buildStoryboard() {
    const rows = [
      ['dash', 'A dashed circle', 'glide', 'Glide'],
      ['arc', 'An arc path', 'fade', 'Out of shape'],
    ];
    const box = h('section', { class: 'dt-story-pane', attrs: { 'aria-label': `Storyboard: ${LOW} to ${HIGH}%` } },
      h('div', { class: 'dt-pane-label', text: `${LOW} → ${HIGH}%, drawn by Desktap` }),
      h('p', { class: 'dt-pane-title', text: 'Five moments of the same glide' }));
    for (const [kind, title, chipKind, chipText] of rows) {
      const strip = h('div', { class: 'dt-rings-stills' });
      stillSet(kind, true).forEach((src, i) => strip.appendChild(h('figure', {},
        h('img', { src, width: 264, height: 264, decoding: 'async',
          alt: `${title} going ${LOW} to ${HIGH}%, ${momentText(i)}` }),
        h('figcaption', { text: MOMENTS[i] }))));
      box.appendChild(h('div', { class: 'dt-story-row' },
        h('div', { class: 'dt-story-head' }, h('span', { class: `dt-chip ${chipKind}`, text: chipText }), title),
        strip));
    }
    storyEl.appendChild(box);
  }

  function setView(next) {
    view = next === 'story' ? 'story' : 'live';
    if (view === 'story' && !storyEl.childElementCount) buildStoryboard();
    storyEl.hidden = view !== 'story';
    panesEl.hidden = view === 'story';
    viewSeg.set(view);
  }

  makeLegend([
    { swatch: 'glide', text: 'Dash offset and color: glide' },
    { swatch: 'text', text: 'Text: swaps at once' },
    { swatch: 'fade', text: 'Arc path: out of shape on the way' },
  ], legend);
  caption.innerHTML =
    '<strong>Draw a ring as a full circle with a dash, and change only <code>stroke-dashoffset</code>.</strong> ' +
    'The colored part then slides along the ring, however far it jumps. An arc path that moves its end point ' +
    'glides too, but on the way it leaves the ring and comes back only at the end. Colors blend channel by channel: ' +
    'halfway from green to red the ring is olive. For a clear middle color, pick each frame’s color by level, ' +
    'as the CPU ring does.' +
    `<p class="dt-note">Both rings use the CPU ring’s settings, <code>easeInOut</code> over ${DURATION} s. ` +
    'The arc path is shown as stills Desktap drew, never redrawn by your browser.</p>';

  el.replaceChildren(figure);

  // Start.
  setStills(true);
  send(0, 0, false);
  if (frozen) {
    while ((k + 1) * PERIOD <= sw.at) { k += 1; send(k, k * PERIOD, false); }
    nextAt = (k + 1) * PERIOD;
    loop.time = sw.at;
    loop.speed = 0;
    setPlaying(false);
  } else if (reduce) {
    setPlaying(false);
    setView('story');
  } else {
    setPlaying(true);
  }
  if (sw.view === 'story') setView('story');
  loop.renderNow();

  const unwatch = watchReducedMotion(on => {
    reduce = on || sw.reduced;
    if (reduce) { setPlaying(false); setView('story'); }
  });

  return {
    destroy() {
      unwatch();
      loop.destroy();
      el.replaceChildren(...original);
    },
  };
}

/** The share of the way each engine still stands for (the stills are drawn at equal shares). */
export const momentShares = () => MOMENTS.map((_, i) => i / (MOMENTS.length - 1));
