/*
 * D10 · Clock hands (Recipes › Analog clock).
 * Two Large clock buttons get the Analog clock recipe's frame every second, from 10:09:54 to 10:10:06, then
 * the diagram starts again. Each hand is a <line> turned with rotate(angle 100 88); only the angles change.
 * The sweep glides linear for 1.25 s (the recipe's setting), the tick easeInOut for 0.3 s (its "Make it yours"
 * example). The phone turns a rotation the short way, so 354° → 0° goes 6° forward (face-player
 * unwrapDegrees). The time plot shows where each second hand points over time, sampled from the same models.
 * The numbers are the recipe's awk: hour (h % 12) × 30 + m × 0.5, minute m × 6 + s × 0.1, second s × 6.
 *
 * mount(el, { mode, reducedMotion }) → { destroy() }
 * Test switches (face-player.js readSwitches): data-at / ?dt-at=<s>, data-view / ?dt-view=story, ?dt-motion=reduce.
 */
import { FaceModel, Loop, frame, makeCell, svgEl, replay, readSwitches, watchReducedMotion } from '../face-player.js';
import { ensureStyle, h, makeFigure, makeButton, makeSegmented, makeLegend, setChip } from '../dt-chrome.js';

export const START = { h: 10, m: 9, s: 54 };
export const FRAMES = 13;                            // 10:09:54 … 10:10:06, one a second
export const CYCLE = FRAMES;                         // seconds before the diagram starts again
export const KINDS = {
  sweep: { label: 'Sweep', title: 'linear, 1.25 s', setting: 'glide=1.25 easing=linear', duration: 1.25, easing: 'linear' },
  tick: { label: 'Tick', title: 'easeInOut, 0.3 s, for example', setting: 'glide=0.3 easing=easeInOut', duration: 0.3,
    easing: 'easeInOut' },
};
const ORANGE = '#FF9500';                            // the button's Color, Orange
const STORY_AT = [0, 0.15, 0.3, 0.6, 0.9];           // seconds after the 0° frame arrives
const ELEMENTS = ['dial', 'marks', 'hour', 'minute', 'second', 'center', 'date'];

/** The time of frame k (0 = 10:09:54). */
export function timeOf(k) {
  const total = START.h * 3600 + START.m * 60 + START.s + k;
  return { h: Math.floor(total / 3600) % 24, m: Math.floor(total / 60) % 60, s: total % 60 };
}

/** One frame of the recipe at h:m:s, as its awk prints the angles. */
export function clockFrame(k) {
  const { h: hh, m, s } = timeOf(k);
  const hour = +((hh % 12) * 30 + m * 0.5).toFixed(1), minute = +(m * 6 + s * 0.1).toFixed(1), second = s * 6;
  return frame(ELEMENTS, { hour, minute, second }, { date: 'Thu, Oct 1' }, { k, hh, m, s });
}

const two = n => String(n).padStart(2, '0');
const clockText = f => `${f.hh}:${two(f.m)}:${two(f.s)}`;

// ─── Drawing ─────────────────────────────────────────────────────────────────────────────────────────────────

/** The twelve marks, as the recipe's awk draws them once. */
function drawMarks(parent) {
  for (let a = 0; a < 360; a += 30) {
    const big = a % 90 === 0, r = big ? 62 : 66, t = (a * 3.14159265) / 180;
    svgEl('line', { x1: (100 + 72 * Math.sin(t)).toFixed(1), y1: (88 - 72 * Math.cos(t)).toFixed(1),
      x2: (100 + r * Math.sin(t)).toFixed(1), y2: (88 - r * Math.cos(t)).toFixed(1), stroke: '#FFFFFF',
      'stroke-opacity': big ? 0.9 : 0.35, 'stroke-width': big ? 4 : 2, 'stroke-linecap': 'round' }, parent);
  }
}

function treeMaker(host) {
  return () => {
    const root = svgEl('g', {}, host);
    svgEl('circle', { cx: 100, cy: 88, r: 78, fill: '#FFFFFF', 'fill-opacity': 0.06 }, root);
    drawMarks(root);
    const hour = svgEl('line', { x1: 100, y1: 88, x2: 100, y2: 48, stroke: '#FFFFFF', 'stroke-width': 7,
      'stroke-linecap': 'round' }, root);
    const minute = svgEl('line', { x1: 100, y1: 88, x2: 100, y2: 30, stroke: '#FFFFFF', 'stroke-width': 5,
      'stroke-linecap': 'round' }, root);
    const second = svgEl('line', { x1: 100, y1: 100, x2: 100, y2: 24, stroke: ORANGE, 'stroke-width': 2.5,
      'stroke-linecap': 'round' }, root);
    svgEl('circle', { cx: 100, cy: 88, r: 5, fill: ORANGE }, root);
    const date = svgEl('text', { x: 100, y: 188, 'font-size': 18, 'text-anchor': 'middle', fill: '#FFFFFF',
      'fill-opacity': 0.7 }, root);
    return { root, hour, minute, second, date };
  };
}

function draw(model, t) {
  for (const { tree, values: v, texts, opacity } of model.stateAt(t)) {
    tree.root.setAttribute('opacity', opacity.toFixed(4));
    tree.hour.setAttribute('transform', `rotate(${v.hour.toFixed(2)} 100 88)`);
    tree.minute.setAttribute('transform', `rotate(${v.minute.toFixed(2)} 100 88)`);
    tree.second.setAttribute('transform', `rotate(${v.second.toFixed(2)} 100 88)`);
    if (tree.date.textContent !== texts.date) tree.date.textContent = texts.date;
  }
}

const newModel = host => new FaceModel({ makeTree: host ? treeMaker(host) : undefined,
  dropTree: tree => tree.root && tree.root.remove(), angles: ['hour', 'minute', 'second'] });

/** Where a second hand points over one cycle: [[t, degrees unwrapped], …], from the same model. */
export function track(kind, step = 0.02) {
  const { duration, easing } = KINDS[kind];
  const model = newModel(null);
  const out = [];
  let k = 0;
  for (let i = 0; i <= Math.round(CYCLE / step); i++) {
    const t = i * step;
    while (k < FRAMES && k <= t + 1e-9) { model.apply(clockFrame(k), k, k === 0 ? 0 : duration, easing); k += 1; }
    out.push([t, model.stateAt(t)[0].values.second]);
  }
  return out;
}

// ─── The time plot ───────────────────────────────────────────────────────────────────────────────────────────

const PLOT_WIDE = { w: 640, h: 210, l: 46, r: 14, t: 14, b: 30, lo: 318, hi: 402, every: 2, font: 11, note: true };
const PLOT_NARROW = { w: 340, h: 230, l: 34, r: 8, t: 12, b: 28, lo: 318, hi: 402, every: 4, font: 12, note: false };

/** The plot for one geometry; setHead(t, angles) moves the playhead and its two dots. */
function makePlot(G) {
  const px = t => G.l + (t / CYCLE) * (G.w - G.l - G.r);
  const py = a => G.t + ((G.hi - a) / (G.hi - G.lo)) * (G.h - G.t - G.b);
  const svg = svgEl('svg', { viewBox: `0 0 ${G.w} ${G.h}`, class: 'dt-clock-plot', role: 'img',
    style: `font-size:${G.font}px`,
    'aria-label': 'Where each second hand points over time: the sweep is a smooth line a little behind the frames, ' +
      'the tick a staircase of short steps; both pass 12 going forward.' });
  const grid = svgEl('g', { class: 'grid' }, svg);
  for (const [a, text] of [[330, ':55'], [360, '12'], [390, ':05']]) {
    svgEl('line', { x1: G.l, x2: G.w - G.r, y1: py(a), y2: py(a), class: a === 360 ? 'twelve' : '' }, grid);
    svgEl('text', { x: G.l - 7, y: py(a) + 4, 'text-anchor': 'end' }, grid).textContent = text;
  }
  for (let s = 0; s <= CYCLE; s += G.every) {
    svgEl('text', { x: px(s), y: G.h - 9, 'text-anchor': 'middle' }, grid).textContent = `${s} s`;
  }
  if (G.note) {
    svgEl('text', { x: G.w - G.r, y: py(360) - 6, 'text-anchor': 'end', class: 'note' }, grid).textContent =
      '354° → 0°: 6° forward';
  }
  const d = pts => 'M ' + pts.map(([t, a]) => `${px(t).toFixed(1)} ${py(a).toFixed(1)}`).join(' L ');
  svgEl('path', { d: d(track('tick')), class: 'tick' }, svg);
  svgEl('path', { d: d(track('sweep')), class: 'sweep' }, svg);
  const sent = svgEl('g', { class: 'sent' }, svg);
  for (let k = 0; k < FRAMES; k++) svgEl('circle', { cx: px(k), cy: py(324 + 6 * k), r: 3.2 }, sent);
  const head = svgEl('g', { class: 'head' }, svg);
  const headLine = svgEl('line', { y1: G.t - 4, y2: G.h - G.b + 4 }, head);
  const dots = { sweep: svgEl('circle', { r: 5, class: 'sweep-dot' }, head), tick: svgEl('circle', { r: 5, class: 'tick-dot' }, head) };
  return {
    svg,
    setHead(t, angles) {
      if (t === null) { head.setAttribute('visibility', 'hidden'); return; }
      head.removeAttribute('visibility');
      headLine.setAttribute('x1', px(t)); headLine.setAttribute('x2', px(t));
      for (const k of ['sweep', 'tick']) { dots[k].setAttribute('cx', px(t)); dots[k].setAttribute('cy', py(angles[k])); }
    },
  };
}

// ─── Diagram CSS ─────────────────────────────────────────────────────────────────────────────────────────────

const CSS = `
.dt-diagram[data-dt-name="clock-hand"] .dt-pane-note code { white-space: nowrap; }
.dt-diagram .dt-clock-plotbox { margin-top: 14px; border: 1px solid var(--dt-border); border-radius: 12px; padding: 14px 14px 10px; }
.dt-diagram .dt-clock-plot { display: block; width: 100%; height: auto; margin-top: 8px; overflow: visible; }
.dt-diagram .dt-clock-plot text { font-family: var(--dt-mono); fill: var(--dt-muted); }
.dt-diagram .dt-clock-plot.narrow { display: none; }
@container dt (max-width: 520px) {
  .dt-diagram .dt-clock-plot.wide { display: none; }
  .dt-diagram .dt-clock-plot.narrow { display: block; }
}
.dt-diagram .dt-clock-plot text.note { fill: var(--dt-body); }
.dt-diagram .dt-clock-plot .grid line { stroke: var(--dt-border-strong); stroke-width: 1; }
.dt-diagram .dt-clock-plot .grid line.twelve { stroke: var(--dt-muted); stroke-dasharray: 4 4; }
.dt-diagram .dt-clock-plot path { fill: none; stroke-width: 2.5; stroke-linejoin: round; }
.dt-diagram .dt-clock-plot path.sweep { stroke: var(--dt-accent); }
.dt-diagram .dt-clock-plot path.tick { stroke: var(--dt-ok); }
.dt-diagram .dt-clock-plot .sent circle { fill: var(--dt-ink); }
.dt-diagram .dt-clock-plot .head line { stroke: var(--dt-ink); stroke-opacity: 0.35; stroke-width: 1; }
.dt-diagram .dt-clock-plot .sweep-dot { fill: var(--dt-accent); stroke: var(--dt-card); stroke-width: 2; }
.dt-diagram .dt-clock-plot .tick-dot { fill: var(--dt-ok); stroke: var(--dt-card); stroke-width: 2; }
.dt-diagram .dt-swatch.dot { border-radius: 50%; background: var(--dt-ink); }
.dt-diagram .dt-strip.dt-clock-strip .dt-cell { max-width: 104px; }
`;

const REASONS = {
  sweep: 'Each glide lasts a quarter longer than the second between frames, so the next frame always comes mid-glide ' +
    'and the hand never stops.',
  tick: 'Each glide is over long before the next frame, so the hand steps 6° and rests.',
};

// ─── The diagram ─────────────────────────────────────────────────────────────────────────────────────────────

export default function mount(el, { reducedMotion = false } = {}) {
  ensureStyle('dt-clock-hand', CSS);
  const sw = readSwitches(el, { reducedMotion });
  let reduce = sw.reduced;
  const original = [...el.childNodes];

  const { figure, controls, body, legend, caption } = makeFigure({
    name: 'clock-hand',
    eyebrow: 'Analog clock',
    title: 'A hand turns the short way, so at 12 it goes on forward.',
    lede: 'Both clocks get a frame every second with each hand’s angle, from 0 to 359. Only their glide differs.',
  });

  const panesEl = h('div', { class: 'dt-panes' });
  const storyEl = h('div', { class: 'dt-story', hidden: '' });
  const plotBox = h('div', { class: 'dt-clock-plotbox' });
  body.append(panesEl, storyEl, plotBox);

  const panes = Object.entries(KINDS).map(([key, kind]) => {
    const cell = makeCell({ cols: 2, rows: 2, unit: 80, label: `${kind.label} clock` });
    const chip = h('span', { class: 'dt-chip' });
    const phase = h('span', { class: 'dt-phase' });
    const fill = h('span');
    const bar = h('div', { class: 'dt-bar' }, fill);
    const reason = h('p', { class: 'dt-reason' });
    const source = h('div', { class: 'dt-code', attrs: { role: 'group', 'aria-label': `The ${kind.label} clock’s second hand` } });
    panesEl.appendChild(h('section', { class: 'dt-pane', attrs: { 'aria-label': `${kind.label}: ${kind.title}` } },
      h('div', { class: 'dt-pane-label', text: kind.label }),
      h('p', { class: 'dt-pane-title', text: kind.title }),
      h('p', { class: 'dt-pane-note', html: `<code>${kind.setting}</code>` }),
      h('div', { class: 'dt-cellwrap' }, cell.svg),
      h('div', { class: 'dt-status' }, h('div', { class: 'dt-chiprow' }, chip, phase), bar, reason),
      source));
    return { key, kind, cell, model: newModel(cell.host), chip, phase, fill, bar, reason, source };
  });

  // Two shapes of the plot: the taller one shows on a narrow card (a phone), so its labels stay readable.
  const plots = [makePlot(PLOT_WIDE), makePlot(PLOT_NARROW)];
  plots[0].svg.classList.add('wide');
  plots[1].svg.classList.add('narrow');
  const plot = { setHead: (t, angles) => plots.forEach(p => p.setHead(t, angles)) };
  plotBox.append(h('div', { class: 'dt-pane-label', text: 'Where the second hand points' }), plots[0].svg, plots[1].svg);

  function describe(pane, result, f, prev) {
    pane.bar.className = 'dt-bar';
    if (result.kind === 'first' || result.kind === 'snap') {
      setChip(pane.chip, '', result.kind === 'snap' ? 'Again' : 'First frame');
      pane.reason.textContent = result.kind === 'snap' ? 'The diagram starts again at 10:09:54.' : 'Shown at once.';
    } else if (result.kind === 'instant') {
      setChip(pane.chip, '', 'At once');
      pane.reason.textContent = 'Reduce Motion is on, so this diagram shows each frame at once. The storyboard shows the glides.';
    } else {
      setChip(pane.chip, 'glide', 'Glide');
      pane.bar.classList.add('glide');
      pane.reason.textContent = f.s === 0
        ? `354° → 0°: the hand goes 6° forward, the short way, not 354° back. ${pane.key === 'sweep' ? 'It sweeps on.' : 'It ticks on.'}`
        : REASONS[pane.key];
    }
    const ch = prev && prev.nums.second !== f.nums.second;
    pane.source.innerHTML = `<span class="dt-row">${clockText(f)}</span>` +
      `<span class="dt-row"><span class="tag">&lt;line</span> … transform='rotate(${ch ? `<span class="num">${f.nums.second}</span>` : f.nums.second} 100 88)'/&gt;</span>`;
    pane.cell.setLabel(`${pane.kind.label} clock at ${clockText(f)}`);
  }

  // Clock: a frame every second; the cycle starts again after FRAMES seconds.
  let playing = false, k = 0, cycleStart = 0, nextAt = 1, view = 'live';
  const frozen = sw.at !== null;
  let prevFrame = null;

  function send(t) {
    const f = clockFrame(k);
    for (const pane of panes) {
      const result = k === 0 && prevFrame ? pane.model.snap(f, t)
        : pane.model.apply(f, t, reduce || k === 0 ? 0 : pane.kind.duration, pane.kind.easing);
      describe(pane, result, f, prevFrame && k > 0 ? prevFrame : null);
    }
    prevFrame = f;
  }

  function step(t) {                                   // the next scheduled frame
    k += 1;
    if (k >= FRAMES) { k = 0; cycleStart = t; }
    send(t);
  }

  function render(time) {
    const angles = {};
    for (const pane of panes) {
      draw(pane.model, time);
      const m = pane.model.motionAt(time);
      pane.fill.style.width = `${(m.p * 100).toFixed(1)}%`;
      pane.phase.textContent = !m.kind ? 'resting' : `gliding · ${m.elapsed.toFixed(2)} / ${m.dur} s`;
      angles[pane.key] = pane.model.stateAt(time).at(-1).values.second;
    }
    // Plot angles are unwrapped from 10:09:54 (324°): add the turns the hand has made since.
    for (const key in angles) { while (angles[key] < 300) angles[key] += 360; }
    plot.setHead(view === 'live' ? Math.min(CYCLE, time - cycleStart) : null, angles);
  }

  const loop = new Loop({
    root: figure,
    onFrame(time) {
      if (playing) while (time >= nextAt) { step(nextAt); nextAt += 1; }
      render(time);
      return playing;
    },
  });

  // Controls. Pause freezes the clocks where they are; the frames keep their one-second rhythm.
  const playBtn = makeButton({ label: '❚❚ Pause', pressed: true, onClick: () => setPlaying(!playing) });
  const speed = makeSegmented({ label: 'Speed', options: [['1', '1×'], ['0.25', '¼×']], value: '1',
    onChange: v => { if (!frozen) loop.speed = parseFloat(v); } });
  const viewSeg = makeSegmented({ label: 'View', options: [['live', 'Live'], ['story', 'Storyboard']], value: 'live',
    onChange: setView });
  controls.append(playBtn, h('span', { class: 'dt-spacer' }), speed.el, viewSeg.el);

  function setPlaying(on) {
    playing = on && !frozen && !reduce;
    playBtn.setAttribute('aria-pressed', String(playing));
    playBtn.textContent = playing ? '❚❚ Pause' : '▶ Play';
    if (playing) loop.wake(); else loop.sleep();
    if (on && reduce && !frozen) {                     // Reduce Motion: Play steps one frame, shown at once
      if (view !== 'live') setView('live');
      step(loop.time); nextAt = loop.time + 1; loop.renderNow();
    }
  }

  // Storyboard: the moments after the 0° frame arrives, both clocks.
  function buildStoryboard() {
    const box = h('section', { class: 'dt-story-pane', attrs: { 'aria-label': 'Storyboard: the second hand passing 12' } },
      h('div', { class: 'dt-pane-label', text: '10:09:59 → 10:10:00' }),
      h('p', { class: 'dt-pane-title', text: 'The frame with 0° arrives at 0 s' }));
    for (const [key, kind] of Object.entries(KINDS)) {
      const strip = h('div', { class: 'dt-strip dt-clock-strip' });
      for (const s of STORY_AT) {
        const cell = makeCell({ cols: 2, rows: 2, unit: 80, label: `${kind.label} clock, ${s} s after the 0° frame` });
        const model = newModel(cell.host);
        const sends = [];
        for (let i = 0; i <= 6; i++) sends.push([clockFrame(i), i, i === 0 ? 0 : kind.duration, kind.easing]);
        replay(model, sends);
        draw(model, 6 + s);
        strip.appendChild(h('figure', {}, cell.svg, h('figcaption', { text: `${s.toFixed(2)} s` })));
      }
      box.appendChild(h('div', { class: 'dt-story-row' },
        h('div', { class: 'dt-story-head' }, h('span', { class: 'dt-chip glide', text: kind.label }), kind.title),
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
    loop.renderNow();
  }

  makeLegend([
    { swatch: 'dot', text: 'An angle the script sends, once a second' },
    { swatch: 'glide', text: 'Sweep: linear, 1.25 s' },
    { swatch: 'ok', text: 'Tick: easeInOut, 0.3 s' },
  ], legend);
  caption.innerHTML =
    '<strong>Turn each hand with <code>rotate(angle 100 88)</code>, send angles from 0 to 359, and change only the ' +
    'angle.</strong> A hand always turns the short way, so at 12 the second hand goes on forward, from 354° to 0°. ' +
    'For a sweep, glide <code>linear</code> for 1.25 × the time between frames: the hand never stops, even when a ' +
    'frame comes a little late. For a tick, use a short <code>easeInOut</code> glide, such as 0.3 s.' +
    '<p class="dt-note">The frames are the Analog clock recipe’s, one a second from 10:09:54 to 10:10:06.</p>';

  el.replaceChildren(figure);

  // Start.
  send(0);
  if (frozen) {
    while (nextAt <= sw.at) { step(nextAt); nextAt += 1; }
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
