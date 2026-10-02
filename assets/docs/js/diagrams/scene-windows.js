/*
 * D11 · Scene windows (Scenes and sound › One loop draws the whole page; Motion that never stops).
 * The ticker recipe on an iPhone: one strip of world, three texts, four Normal buttons whose viewBoxes are windows
 * onto it, spaced 200 + 200 × cellGap / cellSize apart (cellSize 80, cellGap 16.7 → 241, as the script computes).
 * Every pass (1 s) every tile gets a frame, linear over 1.25 s. Two rows run the same strip:
 *   Right order: the ticker as written. A text past the left end is hidden in place, moved while hidden on the
 *   next frame, shown in place on the frame after: nothing is seen travelling back.
 *   Wrong order: hidden and moved in the same frame. It glides back across every button while it fades: a ghost.
 * The numbers are the ticker's own arithmetic (its zsh, with fixed texts); a hidden element that moves while it
 * stays hidden is drawn at its new place at once, as the phone does.
 *
 * mount(el, { mode, reducedMotion }) → { destroy() }
 * Test switches (face-player.js readSwitches): data-at / ?dt-at=<s>, data-view / ?dt-view=story, ?dt-motion=reduce.
 */
import { FaceModel, Loop, frame, svgEl, readSwitches, watchReducedMotion } from '../face-player.js';
import { ensureStyle, h, makeFigure, makeButton, makeSegmented, makeLegend, makeChip, setChip, uid } from '../dt-chrome.js';
import { CORNER } from './sizes.js';

// The ticker's settings (Scenes and sound › A ticker across four buttons).
export const TILES = 4, STEP = 50, FONT = 48, SPACE = 360, PERIOD = 1, GLIDE = 1.25;
export const PITCH = Math.trunc(200 + 200 * 16.7 / 80);           // integer pitch, as zsh stores it: 241
export const RIGHT = (TILES - 1) * PITCH + 200;                    // where the strip ends: 923
export const TEXTS = ['12:41', 'Load 1.84', '412 GB free'];
const WIDTH = TEXTS.map(t => Math.trunc(t.length * FONT * 2 / 3)); // the script's estimate of a text's width
const LINES = '#BF5AF2';                                           // the buttons' Color (the two lines use it)

/** A fresh strip: the ticker's first pass. */
export function startState() { return { x: [0, SPACE, 2 * SPACE], shown: [1, 1, 1] }; }

/**
 * One pass of the ticker's loop. order 'right' is the script as written; 'wrong' hides and moves in one frame.
 * Returns the next state and what happened to each text: 'run' | 'hide' | 'move' | 'show' | 'hide+move'.
 */
export function pass(state, order = 'right') {
  const x = [...state.x], shown = [...state.shown], events = [];
  const jump = () => { let far = 0; for (const v of x) if (v > far) far = v; return Math.max(far + SPACE, RIGHT); };
  for (let i = 0; i < 3; i++) {
    if (x[i] + WIDTH[i] > 0) {
      if (shown[i]) { x[i] -= STEP; events.push('run'); } else { shown[i] = 1; events.push('show'); }
    } else if (shown[i]) {
      shown[i] = 0;
      if (order === 'wrong') { x[i] = jump(); events.push('hide+move'); } else events.push('hide');
    } else { x[i] = jump(); events.push('move'); }
  }
  return { state: { x, shown }, events };
}

/** The frame a state sends (the same for every tile; only the viewBox differs). */
export function stripFrame(state) {
  const nums = {};
  state.x.forEach((v, i) => { nums['x' + i] = v; nums['o' + i] = state.shown[i]; });
  return frame(['line', 'line', 'text', 'text', 'text'], nums, { t0: TEXTS[0], t1: TEXTS[1], t2: TEXTS[2] });
}

/** A lane: its model and its passes. Sends pass k at time k × PERIOD. */
export function makeLane(order) {
  const model = new FaceModel();
  let state = startState(), k = 0;
  const log = [];
  model.apply(stripFrame(state), 0, 0);
  return {
    order, model, log,
    get pass() { return k; },
    get state() { return state; },
    /** Sends the next pass at time t. */
    next(t) {
      const before = model.top.target;
      const r = pass(state, order);
      state = r.state;
      k += 1;
      model.apply(stripFrame(state), t, GLIDE, 'linear');
      // An element that stays hidden while it moves is shown at its new place at once: nothing to see.
      const g = model.top.glide;
      if (g) {
        for (let i = 0; i < 3; i++) {
          if (before['o' + i] === 0 && state.shown[i] === 0 && before['x' + i] !== state.x[i]) {
            g.from['x' + i] = g.to['x' + i];
            g.from['o' + i] = 0;
          }
        }
      }
      const ev = r.events.map((e, i) => [e, i]).filter(([e]) => e !== 'run');
      log.push({ t, pass: k, events: ev });
      return ev;
    },
  };
}

/** Values on screen at time t: { x: [..], o: [..], hidden: [..] (target opacity 0) }. */
export function laneAt(lane, t) {
  const { values: v } = lane.model.stateAt(t).at(-1);
  const target = lane.model.top.target;
  return { x: [v.x0, v.x1, v.x2], o: [v.o0, v.o1, v.o2], hidden: [0, 1, 2].map(i => target['o' + i] === 0) };
}

/** A text on its way back is in sight: some opacity, moving right, inside one of the windows. */
export function ghostAt(lane, t) {
  const g = lane.model.top.glide;
  if (!g || t >= g.start + g.dur) return false;
  const s = laneAt(lane, t);
  return [0, 1, 2].some(i => {
    if (s.o[i] < 0.04 || g.to['x' + i] <= g.from['x' + i]) return false;
    for (let k = 0; k < TILES; k++) {
      const a = k * PITCH, b = a + 200;
      if (s.x[i] < b && s.x[i] + WIDTH[i] * 0.8 > a) return true;
    }
    return false;
  });
}

// ─── Drawing one lane: the strip seen from above, the four buttons below ─────────────────────────────────────

const WORLD = [-440, 1320];                // the part of the world the live strip shows
const STORY_WORLD = [-240, 1120];          // the storyboard's: room for the first text's jump only
const VBW = 1000, T = 150, G = T * (PITCH - 200) / 200;
const TX = (VBW - (TILES * T + (TILES - 1) * G)) / 2;

function drawWorld(parent, outlines) {
  const g = svgEl('g', {}, parent);
  for (const y of [30, 164]) svgEl('rect', { x: -200, y, width: RIGHT + 400, height: 6, fill: 'currentColor' }, g);
  const texts = TEXTS.map(t => {
    const n = svgEl('text', { y: 100, 'font-size': FONT, 'font-weight': 'bold', fill: 'white', 'dominant-baseline': 'middle' }, g);
    n.textContent = t;
    return n;
  });
  const boxes = outlines ? WIDTH.map(w => svgEl('rect', { y: 64, width: w, height: 72, rx: 10, class: 'dts-hidden',
    'vector-effect': 'non-scaling-stroke' }, g)) : null;
  return { texts, boxes };
}

function buildLane(label, { withTiles = true, span = WORLD } = {}) {
  const [X0, X1] = span;
  const S1 = VBW / (X1 - X0), SH = 200 * S1, TY = SH + 40, VBH = withTiles ? TY + T + 4 : SH + 1;
  const svg = svgEl('svg', { class: 'dts-lane', viewBox: `0 0 ${VBW} ${VBH.toFixed(1)}`, role: 'img', 'aria-label': label });
  const defs = svgEl('defs', {}, svg);
  const stripClip = uid('dts-strip');
  svgEl('rect', { x: 0, y: -12, width: VBW, height: SH + 24 }, svgEl('clipPath', { id: stripClip }, defs));
  const rimId = uid('dts-rim');
  const rim = svgEl('linearGradient', { id: rimId, x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
  [['0', '0.18'], ['0.5', '0.06'], ['1', '0']].forEach(([o, a]) =>
    svgEl('stop', { offset: o, 'stop-color': '#FFFFFF', 'stop-opacity': a }, rim));

  // The strip: the whole world dimmed, the windows bright, the window frames.
  const winClip = uid('dts-win');
  const clip = svgEl('clipPath', { id: winClip }, defs);
  for (let k = 0; k < TILES; k++) svgEl('rect', { x: k * PITCH, y: 0, width: 200, height: 200 }, clip);
  svgEl('rect', { x: 0.5, y: 0.5, width: VBW - 1, height: SH - 1, rx: 8, class: 'dts-strip' }, svg);
  const world = svgEl('g', { transform: `translate(${(-X0 * S1).toFixed(3)} 0) scale(${S1.toFixed(5)})`, style: `color: ${LINES}` },
    svgEl('g', { 'clip-path': `url(#${stripClip})` }, svg));
  const dim = drawWorld(svgEl('g', { opacity: 0.3 }, world), true);
  const lit = drawWorld(svgEl('g', { 'clip-path': `url(#${winClip})` }, world), false);
  for (let k = 0; k < TILES; k++) {
    svgEl('rect', { x: k * PITCH, y: 0, width: 200, height: 200, class: 'dts-window', 'vector-effect': 'non-scaling-stroke' }, world);
    const n = svgEl('text', { x: k * PITCH + 10, y: 26, class: 'dts-num', 'font-size': 22 }, world);
    n.textContent = String(k + 1);
  }

  // The buttons, each a window onto the same world, and a line from each window to its button.
  const tiles = [];
  for (let k = 0; withTiles && k < TILES; k++) {
    const wx = (k * PITCH - X0) * S1, ww = 200 * S1;
    const tx = TX + k * (T + G);
    svgEl('path', { d: `M ${wx.toFixed(1)} ${SH} L ${tx.toFixed(1)} ${TY} M ${(wx + ww).toFixed(1)} ${SH} L ${(tx + T).toFixed(1)} ${TY}`,
      class: 'dts-ray' }, svg);
    const clipId = uid('dts-cell');
    svgEl('rect', { x: tx, y: TY, width: T, height: T, rx: CORNER * T }, svgEl('clipPath', { id: clipId }, defs));
    svgEl('rect', { x: tx, y: TY, width: T, height: T, rx: CORNER * T, fill: '#FFFFFF', 'fill-opacity': 0.08 }, svg);
    const face = svgEl('svg', { x: tx, y: TY, width: T, height: T, viewBox: `${k * PITCH} 0 200 200`,
      preserveAspectRatio: 'none', overflow: 'hidden' }, svgEl('g', { 'clip-path': `url(#${clipId})` }, svg));
    tiles.push(drawWorld(svgEl('g', { style: `color: ${LINES}` }, face), false));
    svgEl('rect', { x: tx + 0.5, y: TY + 0.5, width: T - 1, height: T - 1, rx: CORNER * T - 0.5, fill: 'none',
      stroke: `url(#${rimId})`, 'stroke-width': 1 }, svg);
  }
  const copies = [dim, lit, ...tiles];

  return {
    svg,
    render(s) {
      for (const c of copies) {
        c.texts.forEach((n, i) => { n.setAttribute('x', s.x[i].toFixed(2)); n.setAttribute('opacity', s.o[i].toFixed(4)); });
      }
      dim.boxes.forEach((b, i) => {
        b.setAttribute('x', s.x[i].toFixed(2));
        b.style.display = s.hidden[i] ? '' : 'none';
      });
    },
  };
}

const CSS = `
.dt-diagram .dts-lanes { display: grid; gap: 14px; }
.dt-diagram .dts-lane { display: block; width: 100%; height: auto; margin-top: 10px; overflow: visible; }
.dt-diagram .dts-lane text {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif; font-variant-numeric: tabular-nums;
}
.dt-diagram .dts-strip { fill: #0D0D0D; stroke: var(--dt-border-strong); stroke-width: 1; }
.dt-diagram .dts-window { fill: none; stroke: var(--dt-accent); stroke-width: 1.5; }
.dt-diagram .dts-num { font-family: var(--dt-mono); fill: var(--dt-accent); }
.dt-diagram .dts-ray { stroke: var(--dt-accent); stroke-opacity: 0.28; stroke-width: 1; fill: none; stroke-dasharray: 3 4; }
.dt-diagram .dts-hidden { fill: none; stroke: #FFFFFF; stroke-opacity: 0.85; stroke-width: 1.2; stroke-dasharray: 4 3; }
.dt-diagram .dts-steps { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.dt-diagram .dts-steps .dt-chip { transition: background 0.2s, color 0.2s, border-color 0.2s; }
.dt-diagram .dt-swatch.dts-win { background: transparent; border: 1.5px solid var(--dt-accent); }
.dt-diagram .dt-swatch.dts-hid { background: transparent; border: 1px dashed var(--dt-ink); }
.dt-diagram .dts-story { display: grid; gap: 8px; margin-top: 4px; }
.dt-diagram .dts-story figure { margin: 0; }
.dt-diagram .dts-story figcaption {
  font-family: var(--dt-mono); font-size: 0.6875rem; letter-spacing: 0.02em; color: var(--dt-body); margin-top: 3px; line-height: 1.4;
}
`;

const SAID = { 'hide+move': 'hidden and moved', hide: 'hidden', move: 'moved while hidden', show: 'shown' };

const LANES = {
  right: { label: 'Right order', title: 'Hide it, move it, show it: three frames',
    steps: [['hide', '1 · Hide'], ['move', '2 · Move, hidden'], ['show', '3 · Show']] },
  wrong: { label: 'Wrong order', title: 'Hidden and moved in the same frame',
    steps: [['hide+move', '1 · Hide and move'], ['show', '2 · Show'], ['ghost', 'Ghost']] },
};

/** Storyboard moments: [time, caption] per lane, around the first text's jump (passes 5–10). */
export const STORY = {
  right: [[5.6, '1 · Hidden where it is, past the left end'], [6.6, '2 · On the next frame, moved while hidden'],
    [10.5, '3 · Shown where it is: it slides back in']],
  wrong: [[5.3, '1 · Hidden and moved: 0.3 s later, a ghost on button 1'], [5.7, '0.7 s later, on button 3'],
    [6.4, '2 · Shown again: the ghost brightens on its way']],
};

export default function mount(el, { reducedMotion = false } = {}) {
  ensureStyle('dt-scene-windows', CSS);
  const sw = readSwitches(el, { reducedMotion });
  let reduce = sw.reduced;
  const frozen = sw.at !== null;
  const original = [...el.childNodes];

  const { figure, controls, body, legend, caption, announce } = makeFigure({
    name: 'scene-windows',
    eyebrow: 'A scene across four buttons',
    title: 'Every tile is a window onto one world.',
    lede: 'The ticker’s strip, seen from above, with the four windows the buttons look through; ' +
      'below each strip, what the buttons show. The two rows differ only in how a text comes back.',
  });

  const lanesEl = h('div', { class: 'dts-lanes' });
  const storyEl = h('div', { class: 'dt-story', hidden: '' });
  body.append(lanesEl, storyEl);

  const lanes = ['right', 'wrong'].map(order => {
    const L = LANES[order];
    const view = buildLane(`${L.label}: four buttons showing one strip`);
    const chips = L.steps.map(([key, text]) => [key, makeChip('', text)]);
    lanesEl.appendChild(h('section', { class: 'dt-pane', attrs: { 'aria-label': `${L.label}: ${L.title}` } },
      h('div', { class: 'dt-pane-label', text: L.label }),
      h('p', { class: 'dt-pane-title', text: L.title }),
      h('div', { class: 'dts-steps' }, chips.map(([, c]) => c)),
      view.svg));
    return { order, L, view, chips, lane: makeLane(order), lastEvent: null };
  });

  function sendPass(t, spoken) {
    const said = [];
    for (const p of lanes) {
      const ev = p.lane.next(t);
      if (ev.length) {
        p.lastEvent = { key: ev[0][0], t };
        said.push(`${p.L.label}: ${ev.map(([e, i]) => `${TEXTS[i]} ${SAID[e]}`).join(', ')}`);
      }
    }
    if (spoken) announce(said.length ? said.join('. ') + '.' : 'The texts move on.');
  }

  function render(time) {
    for (const p of lanes) {
      p.view.render(laneAt(p.lane, time));
      const recent = p.lastEvent && time - p.lastEvent.t < PERIOD + 0.05 ? p.lastEvent.key : null;
      for (const [key, chip] of p.chips) {
        const on = key === 'ghost' ? ghostAt(p.lane, time) : key === recent;
        const kind = !on ? '' : key === 'ghost' ? 'fade' : p.order === 'right' ? 'glide' : 'fade';
        if (chip.className !== (kind ? `dt-chip ${kind}` : 'dt-chip')) setChip(chip, kind, chip.textContent);
      }
    }
  }

  let playing = false, nextAt = PERIOD;
  const loop = new Loop({
    root: figure,
    onFrame(time) {
      if (playing) while (time >= nextAt) { sendPass(nextAt, false); nextAt += PERIOD; }
      render(time);
      return playing || lanes.some(p => p.lane.model.busyAt(time));
    },
  });

  // Controls.
  const playBtn = makeButton({ label: '❚❚ Pause', pressed: true, onClick: () => setPlaying(!playing) });
  const sendBtn = makeButton({ label: 'Send next frame', primary: true, onClick: sendNext });
  const speed = makeSegmented({ label: 'Speed', options: [['1', '1×'], ['0.25', '¼×']], value: '1',
    onChange: v => { if (!frozen) loop.speed = parseFloat(v); } });
  const viewSeg = makeSegmented({ label: 'View', options: [['live', 'Live'], ['story', 'Storyboard']], value: 'live', onChange: setView });
  controls.append(playBtn, sendBtn, h('span', { class: 'dt-spacer' }), speed.el, viewSeg.el);

  function setPlaying(on) {
    playing = on && !frozen;
    playBtn.setAttribute('aria-pressed', String(playing));
    playBtn.textContent = playing ? '❚❚ Pause' : '▶ Play';
    if (playing) { nextAt = loop.time + PERIOD; loop.wake(); }
  }

  function sendNext() {
    if (view !== 'live') setView('live');
    if (reduce || frozen) {
      // Shown at once: send the pass and let its glides end straight away.
      sendPass(loop.time, true);
      loop.time += GLIDE;
      loop.renderNow();
      return;
    }
    sendPass(loop.time, true);
    nextAt = loop.time + PERIOD;
    loop.wake();
  }

  let view = 'live', storyBuilt = false;
  function buildStory() {
    if (storyBuilt) return;
    storyBuilt = true;
    for (const order of ['right', 'wrong']) {
      const L = LANES[order];
      const grid = h('div', { class: 'dts-story' });
      for (const [t, text] of STORY[order]) {
        const lane = makeLane(order);
        for (let k = 1; k * PERIOD <= t; k++) lane.next(k * PERIOD);
        const v = buildLane(`${L.label}: ${text}`, { withTiles: false, span: STORY_WORLD });
        v.render(laneAt(lane, t));
        grid.appendChild(h('figure', {}, v.svg, h('figcaption', { text })));
      }
      storyEl.appendChild(h('section', { class: 'dt-story-pane', attrs: { 'aria-label': `${L.label}: ${L.title}` } },
        h('div', { class: 'dt-pane-label', text: L.label }),
        h('p', { class: 'dt-pane-title', text: L.title }), grid));
    }
  }

  function setView(next) {
    view = next === 'story' ? 'story' : 'live';
    if (view === 'story') { buildStory(); if (playing) setPlaying(false); }
    storyEl.hidden = view !== 'story';
    lanesEl.hidden = view === 'story';
    viewSeg.set(view);
  }

  makeLegend([
    { swatch: 'dts-win', text: 'A button’s window: its viewBox' },
    { swatch: 'dts-hid', text: 'Hidden: opacity="0"' },
    { swatch: 'fade', text: 'Ghost: a text seen on its way back' },
  ], legend);
  caption.innerHTML =
    '<strong>To bring a mover back unseen, take three frames: hide it where it is, move it on the next frame while ' +
    'it is hidden, show it on a later one.</strong> Move it in the frame that hides it, and it glides back across ' +
    'every button while it fades. Draw the whole strip in one set of coordinates, give each button a viewBox onto ' +
    'its own part, spaced as the buttons stand, and send every button its frame on the same pass.' +
    '<p class="dt-note">Both rows send a frame every second, <code>linear</code> over 1.25 s, as the ticker does. ' +
    'The dimmed parts are drawn by the script but shown by no button.</p>';

  el.replaceChildren(figure);

  // Start.
  if (frozen) {
    for (let k = 1; k * PERIOD <= sw.at; k++) sendPass(k * PERIOD, false);
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
