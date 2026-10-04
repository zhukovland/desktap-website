/*
 * D5 · Pick the rhythm (SVG faces › Cost on the phone; Scenes and sound › Motion that never stops).
 * Three faces get frames from a script, in a 6-second pattern that repeats:
 *   settle  a level bar: a new value every 3 s, easeInOut 0.6 s. It glides, then rests.
 *   tight   a dot going round: a frame a second, 60° each, linear, duration 1 s (= the interval).
 *   loose   the same dot and frames, linear, duration 1.25 s (1.25 × the interval).
 * The frame due at 3 s comes 0.2 s late, as Wi-Fi does now and then: "tight" stops until it comes, "loose" keeps
 * moving. A switch sends every frame on time instead.
 * Each plot shows how fast its face moves over the 6 s: on the zero line the face stands still.
 * Where each face is at any moment comes from face-player.js's FaceModel (the phone's rules for a glide that a new
 * frame re-aims), sampled once per setting; the plots and the cells draw those samples. The faces are the frames
 * frames/gen.zsh in the docs' scratch folder writes; the HEAD svgdiff says consecutive frames glide.
 *
 * mount(el, { mode, reducedMotion }) → { destroy() }
 * Test switches (face-player.js readSwitches): data-at / ?dt-at=<s>, data-view / ?dt-view=story, ?dt-motion=reduce.
 */
import { FaceModel, Loop, frame, makeCell, svgEl, readSwitches, watchReducedMotion } from '../face-player.js';
import { ensureStyle, h, makeFigure, makeButton, makeSegmented, makeLegend, setChip } from '../dt-chrome.js';

export const PERIOD = 6;                 // the pattern repeats every 6 s
export const STEP = 60;                  // degrees per frame: 6 frames make one turn
export const LATE_AT = 3;                // the frame due at 3 s …
export const LATE_BY = 0.2;              // … arrives 0.2 s late
export const RATE = 200;                 // samples per second
export const SETTLE_TIMES = [0.5, 3.5];
export const SETTLE_VALUES = [72, 45];
const STORY_TIMES = {
  settle: [0.4, 0.6, 0.8, 1.1, 2.5],
  tight: [2.8, 2.95, 3.1, 3.2, 3.35],
  loose: [2.8, 2.95, 3.1, 3.2, 3.35],
};
const FREEZE_AT = 3.1;                   // reduced motion, live view: the moment the late frame is due

export const TRACKS = [
  { key: 'settle', kind: 'bar', duration: 0.6, easing: 'easeInOut', label: 'A value that settles',
    settings: '<code>easeInOut</code> · 0.6 s · a frame every 3 s' },
  { key: 'tight', kind: 'orbit', duration: 1, easing: 'linear', label: 'Endless motion, duration = the interval',
    settings: '<code>linear</code> · 1 s · a frame every second' },
  { key: 'loose', kind: 'orbit', duration: 1.25, easing: 'linear',
    label: 'Endless motion, duration = 1.25 × the interval',
    settings: '<code>linear</code> · 1.25 s · a frame every second' },
];

/** The bar face at `pct`, as frames/gen.zsh writes it (bar width 144 × pct / 100). */
export function barFrame(pct) {
  return frame(['track', 'bar', 'value', 'label'], { w: +(144 * pct / 100).toFixed(1) }, { value: `${pct}%` }, { pct });
}

/** The orbit face at `deg`, as frames/gen.zsh writes it: one group turned by rotate(deg 100 100), deg 0…359. */
export function orbitFrame(deg) {
  const d = ((deg % 360) + 360) % 360;
  return frame(['ring', 'turn', 'tail2', 'tail1', 'dot'], { a: d }, {}, { deg: d });
}

const mod = (x, m) => ((x % m) + m) % m;

/** Every frame the face receives, from three periods before the window until just after it, in arrival order. */
export function arrivals(track, late = true) {
  const out = [];
  if (track.kind === 'bar') {
    for (let k = -3; k <= 1; k++) {
      SETTLE_TIMES.forEach((s, i) => out.push({ t: k * PERIOD + s, due: k * PERIOD + s, f: barFrame(SETTLE_VALUES[i]) }));
    }
  } else {
    for (let n = -3 * PERIOD; n <= PERIOD + 1; n++) {
      const isLate = late && mod(n, PERIOD) === LATE_AT;
      out.push({ t: n + (isLate ? LATE_BY : 0), due: n, late: isLate, f: orbitFrame(n * STEP) });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

/**
 * The face over one period, [0, PERIOD], sampled RATE times a second:
 * { values, texts, speed (0 = still; the dot in frames' steps per second, the bar relative to its fastest),
 *   moving, stops: [[t0, t1]…] (stretches standing still), frames: [{ t, due, late }] }.
 * For the dot, values are degrees turned since long ago (they keep growing).
 */
export function sampleTrack(track, late = true) {
  const key = track.kind === 'bar' ? 'w' : 'a';
  const model = new FaceModel({ angles: track.kind === 'orbit' ? ['a'] : [] });
  const list = arrivals(track, late);
  const n = PERIOD * RATE;
  const values = new Float64Array(n + 2), texts = new Array(n + 2);
  let i = 0;
  for (let s = 0; s <= n + 1; s++) {
    const t = s / RATE;
    while (i < list.length && list[i].t <= t + 1e-9) {
      model.apply(list[i].f, list[i].t, track.duration, track.easing);
      i++;
    }
    const state = model.stateAt(t).slice(-1)[0];
    values[s] = state.values[key];
    texts[s] = state.texts.value || '';
  }
  const speed = new Float64Array(n + 1), moving = new Uint8Array(n + 1);
  for (let s = 0; s <= n; s++) {
    const d = Math.abs(values[s + 1] - values[s]);
    moving[s] = d > 1e-7 ? 1 : 0;
    speed[s] = d * RATE / (track.kind === 'orbit' ? STEP : 1);
  }
  if (track.kind === 'bar') {
    const top = Math.max(...speed);
    for (let s = 0; s <= n; s++) speed[s] /= top;
  }
  const stops = [];
  let start = null;
  for (let s = 0; s <= n; s++) {
    if (!moving[s] && start === null) start = s;
    if ((moving[s] || s === n) && start !== null) { stops.push([start / RATE, s / RATE]); start = null; }
  }
  const frames = list.filter(a => a.t >= 0 && a.t < PERIOD).map(({ t, due, late: l }) => ({ t, due, late: !!l }));
  return { key, values: values.subarray(0, n + 1), texts: texts.slice(0, n + 1), speed, moving,
    stops: stops.filter(([a, b]) => b - a > 0.02), frames };
}

/** The sample index for time t within the period (t may be any diagram time). */
const indexAt = t => Math.min(PERIOD * RATE, Math.max(0, Math.round(mod(t, PERIOD) * RATE)));

// ─── Drawing the faces (the frames gen.zsh writes) ───────────────────────────────────────────────────────────

function barFace(host) {
  svgEl('rect', { x: 28, y: 126, width: 144, height: 22, rx: 11, fill: '#FFFFFF', 'fill-opacity': 0.15 }, host);
  const bar = svgEl('rect', { x: 28, y: 126, width: 0, height: 22, rx: 11, fill: '#30D158' }, host);
  const value = svgEl('text', { x: 100, y: 100, 'font-size': 56, 'font-weight': 'bold', 'text-anchor': 'middle',
    fill: '#FFFFFF' }, host);
  const label = svgEl('text', { x: 100, y: 180, 'font-size': 28, 'text-anchor': 'middle', fill: '#FFFFFF',
    'fill-opacity': 0.6 }, host);
  label.textContent = 'cpu';
  return (v, text) => {
    bar.setAttribute('width', v.toFixed(2));
    if (value.textContent !== text) value.textContent = text;
  };
}

function orbitFace(host) {
  svgEl('circle', { cx: 100, cy: 100, r: 64, fill: 'none', stroke: '#FFFFFF', 'stroke-opacity': 0.15,
    'stroke-width': 8 }, host);
  const turn = svgEl('g', {}, host);
  svgEl('circle', { cx: 58.9, cy: 51.0, r: 8, fill: '#64D2FF', 'fill-opacity': 0.3 }, turn);
  svgEl('circle', { cx: 78.1, cy: 39.9, r: 11, fill: '#64D2FF', 'fill-opacity': 0.6 }, turn);
  svgEl('circle', { cx: 100, cy: 36, r: 15, fill: '#64D2FF' }, turn);
  return v => turn.setAttribute('transform', `rotate(${mod(v, 360).toFixed(2)} 100 100)`);
}

const makeFace = (kind, host) => (kind === 'bar' ? barFace(host) : orbitFace(host));

// ─── The plot: how fast the face moves ───────────────────────────────────────────────────────────────────────

const CSS = `
.dt-diagram .pc-rows { display: grid; gap: 12px; }
.dt-diagram .pc-row { border: 1px solid var(--dt-border); border-radius: 12px; padding: 12px 14px 10px; min-width: 0; }
.dt-diagram .pc-head { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; margin-bottom: 8px; }
.dt-diagram .pc-title { color: var(--dt-ink); font-weight: 600; font-size: 0.8125rem; line-height: 1.4; }
.dt-diagram .pc-set { font-size: 0.75rem; color: var(--dt-muted); }
.dt-diagram .pc-head .dt-chip { margin-left: auto; }
.dt-diagram .pc-grid { display: grid; grid-template-columns: 112px minmax(0, 1fr); gap: 16px; align-items: center; }
.dt-diagram .pc-cellcol .dt-cell { width: 100%; max-width: 112px; }
.dt-diagram .pc-plot { position: relative; min-width: 0; height: 104px; }
.dt-diagram .pc-plot svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.dt-diagram .pc-plot text { font-family: var(--dt-mono); font-size: 9.5px; letter-spacing: 0.04em; fill: var(--dt-muted); }
.dt-diagram .pc-plot text.pc-warn { fill: var(--dt-warn); }
.dt-diagram .pc-row .dt-strip { margin-top: 10px; }
.dt-diagram.pc-story .pc-cellcol { display: none; }
.dt-diagram.pc-story .pc-grid { grid-template-columns: minmax(0, 1fr); }
.dt-diagram.pc-story .pc-head .dt-chip { display: none; }
.dt-diagram .dt-swatch.pc-pace { background: transparent; border-top: 1.5px dashed var(--dt-muted); border-radius: 0;
  height: 0; width: 14px; }
.dt-diagram .dt-swatch.pc-frame { background: var(--dt-body); border-radius: 50%; width: 7px; height: 7px; }
@container dt (max-width: 560px) {
  .dt-diagram .pc-grid { grid-template-columns: 72px minmax(0, 1fr); gap: 10px; }
  .dt-diagram .pc-cellcol .dt-cell { max-width: 72px; }
  .dt-diagram .pc-plot { height: 92px; }
  .dt-diagram .pc-row { padding: 10px 10px 8px; }
  .dt-diagram .pc-head .dt-chip { margin-left: 0; }
}
`;

const M = { l: 4, r: 6, t: 14, b: 34 };    // plot margins in px; the bottom one holds the frames and the seconds

/** Draws one row's plot at its current pixel size; returns the playhead updater (t, visible). */
function drawPlot(svg, track, data, w, hgt) {
  svg.replaceChildren();
  svg.setAttribute('viewBox', `0 0 ${Math.max(1, w)} ${Math.max(1, hgt)}`);
  if (w < 40 || hgt < 30) return () => {};
  const n = PERIOD * RATE;
  const x = t => M.l + (t / PERIOD) * (w - M.l - M.r);
  const top = track.kind === 'bar' ? 1.05 : 1.45;     // the dots share one scale; 1 = the frames' pace
  const zero = hgt - M.b;
  const y = v => zero - (v / top) * (zero - M.t);
  const path = (from, to) => {
    let d = '';
    for (let s = from; s <= to; s++) d += `${d ? 'L' : 'M'}${x(s / RATE).toFixed(1)} ${y(data.speed[s]).toFixed(1)}`;
    return d;
  };

  for (let s = 0; s <= PERIOD; s++) {
    svgEl('line', { x1: x(s), x2: x(s), y1: M.t - 6, y2: zero, stroke: 'var(--dt-border)' }, svg);
  }
  svgEl('line', { x1: M.l, x2: w - M.r, y1: zero, y2: zero, stroke: 'var(--dt-border-strong)' }, svg);
  const still = svgEl('text', { x: M.l + 2, y: zero - 4 }, svg);
  still.textContent = 'still';
  const fast = svgEl('text', { x: M.l + 2, y: M.t - 5 }, svg);
  fast.textContent = 'moving';
  if (track.kind !== 'bar') {
    svgEl('line', { x1: M.l, x2: w - M.r, y1: y(1), y2: y(1), stroke: 'var(--dt-muted)', 'stroke-dasharray': '3 3',
      opacity: 0.7 }, svg);
  }

  svgEl('path', { d: path(0, n), fill: 'none', stroke: 'var(--dt-accent)', 'stroke-width': 2,
    'stroke-linejoin': 'round' }, svg);

  if (track.kind === 'bar') {
    for (const [a, b] of data.stops.filter(([p, q]) => q - p > 1)) {
      const label = svgEl('text', { x: x((a + b) / 2), y: zero - 5, 'text-anchor': 'middle' }, svg);
      label.textContent = 'rests';
    }
  } else {
    for (const [a, b] of data.stops) {
      svgEl('line', { x1: x(a), x2: x(b), y1: zero, y2: zero, stroke: 'var(--dt-warn)', 'stroke-width': 5,
        'stroke-linecap': 'round' }, svg);
      const label = svgEl('text', { x: x(a) - 5, y: zero - 5, 'text-anchor': 'end', class: 'pc-warn' }, svg);
      label.textContent = 'stops';
    }
  }

  // The frames as they arrive; a late one shows where it was due.
  const rail = zero + 12;
  for (const f of data.frames) {
    if (f.late) {
      svgEl('line', { x1: x(f.due), x2: x(f.t), y1: rail, y2: rail, stroke: 'var(--dt-warn)', 'stroke-width': 2 }, svg);
      svgEl('circle', { cx: x(f.due), cy: rail, r: 3, fill: 'var(--dt-card)', stroke: 'var(--dt-warn)',
        'stroke-width': 1.2 }, svg);
      svgEl('circle', { cx: x(f.t), cy: rail, r: 3.4, fill: 'var(--dt-warn)' }, svg);
      const room = x(f.due) - x(f.due - 1) - 12;          // left of the mark, up to the frame before
      const label = svgEl('text', { x: x(f.due) - 6, y: rail + 3.5, 'text-anchor': 'end', class: 'pc-warn' }, svg);
      label.textContent = room >= 60 ? `${LATE_BY} s late` : 'late';
    } else {
      svgEl('circle', { cx: x(f.t), cy: rail, r: 3, fill: 'var(--dt-body)' }, svg);
    }
  }

  for (let s = 0; s <= PERIOD; s += w < 300 ? 3 : 1) {
    const label = svgEl('text', { x: x(s), y: rail + 15, 'text-anchor': s === 0 ? 'start' : s === PERIOD ? 'end' : 'middle' }, svg);
    label.textContent = `${s} s`;
  }

  const head = svgEl('g', {}, svg);
  const rule = svgEl('line', { y1: M.t - 6, y2: rail, stroke: 'var(--dt-ink)', 'stroke-opacity': 0.5 }, head);
  const dot = svgEl('circle', { r: 4, fill: 'var(--dt-accent)', stroke: 'var(--dt-card)', 'stroke-width': 1.5 }, head);
  return (t, visible) => {
    head.setAttribute('visibility', visible ? 'visible' : 'hidden');
    if (!visible) return;
    const s = indexAt(t), px = x(s / RATE).toFixed(1);
    rule.setAttribute('x1', px);
    rule.setAttribute('x2', px);
    dot.setAttribute('cx', px);
    dot.setAttribute('cy', y(data.speed[s]).toFixed(1));
    dot.setAttribute('fill', data.moving[s] || track.kind === 'bar' ? 'var(--dt-accent)' : 'var(--dt-warn)');
  };
}

// ─── The diagram ─────────────────────────────────────────────────────────────────────────────────────────────

export default function mount(el, { reducedMotion = false } = {}) {
  ensureStyle('dt-pacing', CSS);
  const sw = readSwitches(el, { reducedMotion });
  let reduce = sw.reduced;
  const frozen = sw.at !== null;
  const original = [...el.childNodes];

  const { figure, controls, body, legend, caption, announce } = makeFigure({
    name: 'pacing',
    eyebrow: 'Pick the rhythm',
    title: 'Values that settle rest. Motion that never stops glides 1.25 × the interval.',
    lede: 'Three faces get their frames from a script. The bar settles on a new value every 3 s. ' +
      'Both dots go round on a frame a second: one glides for exactly the interval, the other for 1.25 times as long. ' +
      'Each plot shows how fast its face moves.',
  });

  const cache = { true: {}, false: {} };
  const dataFor = (key, late) => (cache[late][key] ||= sampleTrack(TRACKS.find(tr => tr.key === key), late));
  let late = true;

  const rowsEl = h('div', { class: 'pc-rows' });
  body.appendChild(rowsEl);
  const rows = TRACKS.map(track => {
    const cell = makeCell({ unit: 160, label: track.label });
    const draw = makeFace(track.kind, cell.host);
    const chip = h('span', { class: 'dt-chip' });
    const plotBox = h('div', { class: 'pc-plot', attrs: { 'aria-hidden': 'true' } });
    const svg = svgEl('svg', {}, plotBox);
    const strip = h('div', { class: 'dt-strip', hidden: '' });
    const said = h('p', { class: 'dt-sr-only' });
    rowsEl.appendChild(h('section', { class: 'pc-row', attrs: { 'aria-label': track.label } }, said,
      h('div', { class: 'pc-head' },
        h('span', { class: 'pc-title', text: track.label }),
        h('span', { class: 'pc-set', html: track.settings }),
        chip),
      h('div', { class: 'pc-grid' }, h('div', { class: 'pc-cellcol' }, cell.svg), plotBox),
      strip));
    return { track, cell, draw, chip, plotBox, svg, strip, said, head: () => {}, state: null };
  });
  const SAID = {
    settle: () => 'The bar glides for 0.6 seconds after each frame, then rests until the next one.',
    tight: () => (late ? `The dot moves evenly, stops for ${LATE_BY} seconds while the frame due at ${LATE_AT} seconds ` +
      'is late, then hurries to catch up.' : 'The dot moves evenly.'),
    loose: () => (late ? 'The dot never stops; it slows a little while the late frame is due.' : 'The dot moves evenly.'),
  };
  const describe = () => { for (const row of rows) row.said.textContent = SAID[row.track.key](); };
  describe();

  let laidOut = '';
  function layoutPlots(force = false) {
    const sizes = rows.map(r => `${r.plotBox.clientWidth}x${r.plotBox.clientHeight}`).join(',') + late + view;
    if (!force && sizes === laidOut) return;
    laidOut = sizes;
    for (const row of rows) {
      row.head = drawPlot(row.svg, row.track, dataFor(row.track.key, late), row.plotBox.clientWidth,
        row.plotBox.clientHeight);
    }
    render(loop.time);
  }

  function render(t) {
    for (const row of rows) {
      const data = dataFor(row.track.key, late);
      const s = indexAt(t);
      row.draw(data.values[s], data.texts[s]);
      row.head(t, view === 'live');
      const moving = data.moving[s] === 1;
      const state = row.track.kind === 'bar' ? (moving ? 'glides' : 'rests') : (moving ? 'moving' : 'stopped');
      if (state !== row.state) {
        row.state = state;
        setChip(row.chip, { glides: 'glide', rests: 'ok', moving: 'glide', stopped: 'fade' }[state],
          { glides: 'Glides', rests: 'Rests', moving: 'Moving', stopped: 'Stopped' }[state]);
      }
    }
  }

  // Storyboard: the plots without the playhead, and a strip of moments under each row.
  function buildStrips() {
    for (const row of rows) {
      row.strip.replaceChildren();
      const data = dataFor(row.track.key, late);
      for (const t of STORY_TIMES[row.track.key]) {
        const s = indexAt(t);
        const cell = makeCell({ unit: 160, label: `${row.track.label}, ${t} s` });
        makeFace(row.track.kind, cell.host)(data.values[s], data.texts[s]);
        const still = row.track.kind === 'orbit' && !data.moving[s];
        row.strip.appendChild(h('figure', {}, cell.svg,
          h('figcaption', { text: `${t} s${still ? ' · stopped' : ''}` })));
      }
    }
  }

  let playing = false, view = 'live';
  const loop = new Loop({ root: figure, onFrame(time) { render(time); return playing; } });

  const playBtn = makeButton({ label: '❚❚ Pause', pressed: true, onClick: () => setPlaying(!playing) });
  const lateSeg = makeSegmented({
    label: 'Frames', options: [['late', 'One frame late'], ['steady', 'All on time']], value: 'late',
    onChange: v => {
      late = v === 'late';
      for (const row of rows) row.state = null;
      layoutPlots(true);
      if (rows[0].strip.childElementCount) buildStrips();
      setNote();
      describe();
      announce(late ? `The frame due at ${LATE_AT} seconds comes ${LATE_BY} seconds late.` : 'Every frame arrives on time.');
    },
  });
  const speed = makeSegmented({ label: 'Speed', options: [['1', '1×'], ['0.25', '¼×']], value: '1',
    onChange: v => { if (!frozen) loop.speed = parseFloat(v); } });
  const viewSeg = makeSegmented({ label: 'View', options: [['live', 'Live'], ['story', 'Storyboard']], value: 'live',
    onChange: v => setView(v) });
  controls.append(playBtn, lateSeg.el, h('span', { class: 'dt-spacer' }), speed.el, viewSeg.el);

  function setPlaying(on) {
    playing = on && !frozen;
    playBtn.setAttribute('aria-pressed', String(playing));
    playBtn.textContent = playing ? '❚❚ Pause' : '▶ Play';
    if (playing) {
      if (view !== 'live') setView('live');
      loop.wake();
    } else {
      loop.sleep();
    }
    loop.renderNow();
  }

  function setView(next) {
    view = next === 'story' ? 'story' : 'live';
    if (view === 'story') {
      if (playing) setPlaying(false);
      if (!rows[0].strip.childElementCount) buildStrips();
    }
    figure.classList.toggle('pc-story', view === 'story');
    for (const row of rows) row.strip.hidden = view !== 'story';
    viewSeg.set(view);
    layoutPlots();
    loop.renderNow();
  }

  makeLegend([
    { swatch: 'glide', text: 'How fast the face moves' },
    { swatch: 'pc-pace', text: 'The pace the frames set' },
    { swatch: 'pc-frame', text: 'A frame arrives' },
    { swatch: 'fade', text: 'Stopped: the next frame is late' },
  ], legend);
  const note = h('p', { class: 'dt-note' });
  function setNote() {
    note.textContent = late
      ? `Here the frame due at ${LATE_AT} s comes ${LATE_BY} s late, as Wi-Fi does now and then. ` +
        'Pick “All on time” to compare.'
      : 'With every frame on time, both dots move evenly. Wi-Fi is rarely that steady.';
  }
  setNote();
  caption.innerHTML =
    '<strong>For a value that settles, use <code>easeInOut</code> over 0.4–0.8 s and send a frame only when the value ' +
    'changes. For motion that never stops, use <code>linear</code> with a <code>duration</code> 1.25 × the time ' +
    'between two frames.</strong> The bar glides to each new value, then rests. With glides only as long as the ' +
    'interval, the dot stops whenever a frame comes late; at 1.25 × it keeps going, a little behind its frames.';
  caption.appendChild(note);

  el.replaceChildren(figure);

  const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => layoutPlots());
  if (ro) ro.observe(rowsEl);
  layoutPlots(true);

  if (frozen) {
    loop.time = sw.at;
    loop.speed = 0;
    setPlaying(false);
  } else if (reduce) {
    loop.time = FREEZE_AT;                  // a Live view opened by hand shows the moment the late frame is due
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
      if (ro) ro.disconnect();
      loop.destroy();
      el.replaceChildren(...original);
    },
  };
}
