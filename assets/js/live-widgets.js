/*
 * live-widgets.js: the landing's "Live widgets" section, a page of four live buttons drawn with the docs' face
 * player. Each face is a docs recipe's own drawing, sent the way its script sends it:
 *   Analog clock (Large)   the current time every second, linear 1.25 s; the hands swing in from 10:10
 *   CPU ring (Normal)      a made-up load every 2 s, easeInOut 0.6 s, green / orange from 50% / red from 80%
 *   Pomodoro (Normal)      the countdown ring, one frame a second, linear 1.25 s; work → break → ready
 *   Network speed (Wide)   a made-up speed every 2 s: a rest frame at once, then a linear slide one step left
 * The faces wake up when the section comes on screen and stop off screen. With Reduce Motion: one still frame.
 *
 * Markup: <div class="ww-deck" data-live-widgets> with four <div class="ww-slot" data-face="clock | cpu | pomodoro |
 * network"> (each holds a still picture until this module replaces it).
 */
import { FaceModel, Loop, frame, hexToRgb, rgb, makeCell, svgEl, watchReducedMotion } from '../docs/js/face-player.js';

const UNIT = 160, GAP = 16, PAD = Math.round(UNIT * 0.09);   // the cell's own geometry (face-player makeCell)
const PI = 3.14159265;

// ─── CPU ring (SVG faces › Your first live SVG widget) ───────────────────────────────────────────────────────

const CPU_C = 2 * PI * 78;
const CPU_DASH = CPU_C.toFixed(2);
const CPU_LOADS = [23, 31, 18, 42, 57, 64, 38, 27, 83, 71, 46, 29, 15, 22, 36, 52, 44, 91, 68, 33];

function cpuFrame(pct, rest = false) {
  const color = rest ? '#8E8E93' : pct < 50 ? '#34C759' : pct < 80 ? '#FF9F0A' : '#FF453A';
  const [r, g, b] = hexToRgb(color);
  return frame(['track', 'ring', 'value', 'label'], { offset: +(CPU_C * (1 - pct / 100)).toFixed(2), r, g, b },
    { value: rest ? '–' : String(pct) });
}

function cpuTree(host) {
  const root = svgEl('g', {}, host);
  svgEl('circle', { cx: 100, cy: 100, r: 78, fill: 'none', stroke: '#FFFFFF', 'stroke-opacity': 0.15,
    'stroke-width': 16 }, root);
  const ring = svgEl('circle', { cx: 100, cy: 100, r: 78, fill: 'none', 'stroke-width': 16, 'stroke-linecap': 'round',
    'stroke-dasharray': `${CPU_DASH} ${CPU_DASH}`, transform: 'rotate(-90 100 100)' }, root);
  const value = svgEl('text', { x: 100, y: 116, 'font-size': 56, 'font-weight': 'bold', 'text-anchor': 'middle',
    fill: '#FFFFFF' }, root);
  svgEl('text', { x: 100, y: 146, 'font-size': 28, 'text-anchor': 'middle', fill: '#FFFFFF', 'fill-opacity': 0.6 },
    root).textContent = 'cpu %';
  return { root, draw(v, texts) {
    ring.setAttribute('stroke', rgb(v.r, v.g, v.b));
    ring.setAttribute('stroke-dashoffset', v.offset.toFixed(2));
    if (value.textContent !== texts.value) value.textContent = texts.value;
  } };
}

// ─── Pomodoro countdown (Recipes: alerts › Pomodoro on two buttons) ──────────────────────────────────────────

const POMO_C = 490.09;
const WORK = 25 * 60, REST = 5 * 60;
const PHASES = {
  work: { total: WORK, color: '#FF453A', label: 'focus' },
  rest: { total: REST, color: '#30D158', label: 'break' },
  idle: { total: WORK, color: '#8E8E93', label: 'ready' },
};

function pomoFrame(phase, left) {
  const { total, color, label } = PHASES[phase];
  const [r, g, b] = hexToRgb(color);
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  return frame(['track', 'ring', 'clock', 'label'], { offset: +(POMO_C * (1 - left / total)).toFixed(2), r, g, b },
    { clock, label });
}

function pomoTree(host) {
  const root = svgEl('g', {}, host);
  svgEl('circle', { cx: 100, cy: 100, r: 78, fill: 'none', stroke: '#FFFFFF', 'stroke-opacity': 0.15,
    'stroke-width': 14 }, root);
  const ring = svgEl('circle', { cx: 100, cy: 100, r: 78, fill: 'none', 'stroke-width': 14, 'stroke-linecap': 'round',
    'stroke-dasharray': `${POMO_C} ${POMO_C}`, transform: 'rotate(-90 100 100)' }, root);
  const clock = svgEl('text', { x: 100, y: 98, 'font-size': 48, 'font-weight': 'bold', 'text-anchor': 'middle',
    'dominant-baseline': 'middle', fill: '#FFFFFF' }, root);
  const label = svgEl('text', { x: 100, y: 142, 'font-size': 28, 'text-anchor': 'middle', fill: '#FFFFFF',
    'fill-opacity': 0.6 }, root);
  return { root, draw(v, texts) {
    ring.setAttribute('stroke', rgb(v.r, v.g, v.b));
    ring.setAttribute('stroke-dashoffset', v.offset.toFixed(2));
    if (clock.textContent !== texts.clock) clock.textContent = texts.clock;
    if (label.textContent !== texts.label) label.textContent = texts.label;
  } };
}

// ─── Analog clock (Recipes: live widgets › Analog clock) ─────────────────────────────────────────────────────

const ORANGE = '#FF9500';                                  // the button's Color, Orange

/** The frame for time d; the date line reads DATE when given (the start state's "–"), else d's date. */
function clockFrame(d, date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })) {
  const h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
  return frame(['dial', 'marks', 'hour', 'minute', 'second', 'center', 'date'],
    { hour: +((h % 12) * 30 + m * 0.5).toFixed(1), minute: +(m * 6 + s * 0.1).toFixed(1), second: s * 6 }, { date });
}

function clockTree(host) {
  const root = svgEl('g', {}, host);
  svgEl('circle', { cx: 100, cy: 88, r: 78, fill: '#FFFFFF', 'fill-opacity': 0.06 }, root);
  for (let a = 0; a < 360; a += 30) {
    const big = a % 90 === 0, r = big ? 62 : 66, t = (a * PI) / 180;
    svgEl('line', { x1: (100 + 72 * Math.sin(t)).toFixed(1), y1: (88 - 72 * Math.cos(t)).toFixed(1),
      x2: (100 + r * Math.sin(t)).toFixed(1), y2: (88 - r * Math.cos(t)).toFixed(1), stroke: '#FFFFFF',
      'stroke-opacity': big ? 0.9 : 0.35, 'stroke-width': big ? 4 : 2, 'stroke-linecap': 'round' }, root);
  }
  const hand = (y1, y2, stroke, width) => svgEl('line', { x1: 100, y1, x2: 100, y2, stroke, 'stroke-width': width,
    'stroke-linecap': 'round' }, root);
  const hour = hand(88, 48, '#FFFFFF', 7), minute = hand(88, 30, '#FFFFFF', 5), second = hand(100, 24, ORANGE, 2.5);
  svgEl('circle', { cx: 100, cy: 88, r: 5, fill: ORANGE }, root);
  const date = svgEl('text', { x: 100, y: 188, 'font-size': 18, 'text-anchor': 'middle', fill: '#FFFFFF',
    'fill-opacity': 0.7 }, root);
  return { root, draw(v, texts) {
    hour.setAttribute('transform', `rotate(${v.hour.toFixed(2)} 100 88)`);
    minute.setAttribute('transform', `rotate(${v.minute.toFixed(2)} 100 88)`);
    second.setAttribute('transform', `rotate(${v.second.toFixed(2)} 100 88)`);
    if (date.textContent !== texts.date) date.textContent = texts.date;
  } };
}

// ─── Network speed (Recipes: live widgets › Network speed) ───────────────────────────────────────────────────

const X0 = 212, STEP = 16, BASE = 164, HEIGHT = 120, POINTS = 13, TOP = 20;   // MB/s: a fixed scale here
const BLUE = '#3478F6';                                    // the button's Color, Blue
const NET_START = [3, 5, 4, 8, 6, 9, 7, 12, 10, 8, 11, 9, 12.3];
let netClips = 0;

/** SHIFT 0 = rest, 1 = slid one step left; the newest point waits past the window's right edge. */
function netFrame(hist, shift, text) {
  const y = hist.map(v => +(BASE - (Math.min(v, TOP) / TOP) * HEIGHT).toFixed(1));
  const nums = { tx: -STEP * shift, dot: y[POINTS - 2 + shift] };
  y.forEach((v, i) => { nums['y' + i] = v; });
  return frame(['baseline', 'area', 'line', 'dot', 'value', 'unit'], nums, { value: text });
}

/** The next made-up reading: a walk between 4 and 18 MB/s. */
const nextSpeed = last => Math.round(Math.min(18, Math.max(4, last + (Math.random() - 0.5) * 7)) * 10) / 10;

function netTree(host) {
  const clip = 'wwwin' + (++netClips);
  svgEl('rect', { x: X0, y: 0, width: (POINTS - 2) * STEP, height: 200 },
    svgEl('clipPath', { id: clip }, svgEl('defs', {}, host)));
  const root = svgEl('g', {}, host);
  svgEl('line', { x1: 212, y1: 165, x2: 388, y2: 165, stroke: '#FFFFFF', 'stroke-opacity': 0.15, 'stroke-width': 2 }, root);
  const belt = svgEl('g', {}, svgEl('g', { 'clip-path': `url(#${clip})` }, root));
  const area = svgEl('path', { fill: BLUE, 'fill-opacity': 0.18 }, belt);
  const line = svgEl('polyline', { fill: 'none', stroke: BLUE, 'stroke-width': 5, 'stroke-linejoin': 'round',
    'stroke-linecap': 'round' }, belt);
  const dot = svgEl('circle', { cx: 388, r: 7, fill: BLUE }, root);
  const value = svgEl('text', { x: 24, y: 104, 'font-size': 60, 'font-weight': 'bold', fill: '#FFFFFF' }, root);
  svgEl('text', { x: 24, y: 146, 'font-size': 28, fill: '#FFFFFF', 'fill-opacity': 0.6 }, root).textContent = '↓ MB/s';
  return { root, draw(v, texts) {
    const pts = Array.from({ length: POINTS }, (_, i) => `${X0 + i * STEP}.0,${v['y' + i].toFixed(1)}`);
    belt.setAttribute('transform', `translate(${v.tx.toFixed(2)} 0)`);
    area.setAttribute('d', `M ${X0}.0 ${BASE}.0 L ${pts.map(p => p.replace(',', ' ')).join(' L ')} ` +
      `L ${X0 + (POINTS - 1) * STEP}.0 ${BASE}.0 Z`);
    line.setAttribute('points', pts.join(' '));
    dot.setAttribute('cy', v.dot.toFixed(2));
    if (value.textContent !== texts.value) value.textContent = texts.value;
  } };
}

// ─── The page of buttons ─────────────────────────────────────────────────────────────────────────────────────

const FACES = {
  clock: { cols: 2, rows: 2, tree: clockTree, angles: ['hour', 'minute', 'second'],
    label: 'Analog clock: the hands follow the current time, the second hand sweeps' },
  cpu: { cols: 1, rows: 1, tree: cpuTree, label: 'CPU ring: the ring fills with the CPU load' },
  pomodoro: { cols: 1, rows: 1, tree: pomoTree, label: 'Pomodoro countdown: a ring around the time left' },
  network: { cols: 2, rows: 1, tree: netTree, label: 'Network speed: the download speed and a chart that scrolls' },
};

/** A phone button in its slot: the cell's screen margin hangs outside the slot, so the slots line up as on a phone. */
function mountFace(slot, spec) {
  const cell = makeCell({ cols: spec.cols, rows: spec.rows, unit: UNIT, gap: GAP, label: spec.label });
  const w = cell.width - 2 * PAD, h = cell.height - 2 * PAD;
  Object.assign(cell.svg.style, { width: `${(cell.width / w) * 100}%`, height: `${(cell.height / h) * 100}%`,
    left: `${(-PAD / w) * 100}%`, top: `${(-PAD / h) * 100}%` });
  slot.replaceChildren(cell.svg);
  return new FaceModel({ makeTree: () => spec.tree(cell.host), dropTree: tree => tree.root.remove(), angles: spec.angles });
}

function draw(model, t) {
  for (const { tree, values, texts, opacity } of model.stateAt(t)) {
    tree.root.setAttribute('opacity', opacity.toFixed(4));
    tree.draw(values, texts);
  }
}

export function mount(deck) {
  const models = {};
  for (const slot of deck.querySelectorAll('[data-face]')) {
    const spec = FACES[slot.dataset.face];
    if (spec) models[slot.dataset.face] = mountFace(slot, spec);
  }
  const { clock, cpu, pomodoro, network } = models;
  const reduceQuery = typeof matchMedia === 'undefined' ? null : matchMedia('(prefers-reduced-motion: reduce)');
  let reduce = !!(reduceQuery && reduceQuery.matches);

  // What each button shows now and what comes next.
  let cpuIndex = 0, cpuAt = 0;
  let pomo = { phase: 'work', left: 18 * 60 + 42 }, pomoAt = 0;
  let hist = [...NET_START], netText = '12.3', netAt = 0;
  let second = 0, live = false, liveAt = 0;

  // Still: the moment a button shows when nothing moves.
  function still(t) {
    clock && clock.snap(clockFrame(new Date()), t);
    cpu && cpu.snap(cpuFrame(CPU_LOADS[cpuIndex]), t);
    pomodoro && pomodoro.snap(pomoFrame(pomo.phase, pomo.left), t);
    network && network.snap(netFrame(hist, 1, netText), t);
  }

  // Start states, as the recipes' SVG Drawings: the first live frames grow out of them.
  function startStates(t) {
    clock && clock.apply(clockFrame(new Date(2000, 0, 1, 10, 10, 30), '–'), t, 0);
    cpu && cpu.apply(cpuFrame(0, true), t, 0);
    pomodoro && pomodoro.apply(pomoFrame('idle', WORK), t, 0);
    network && network.apply(netFrame(hist, 0, netText), t, 0);
  }

  function tick(t) {
    if (!live) {
      if (t < liveAt) return;
      live = true;
      cpuAt = pomoAt = t;
      netAt = t + 1;
    }
    if (clock) {
      const now = new Date(), s = Math.floor(now.getTime() / 1000);
      if (s !== second) {
        // Back on screen after a while: the newest frame at once, then glides again.
        if (second && s - second > 2) clock.snap(clockFrame(now), t);
        else clock.apply(clockFrame(now), t, 1.25, 'linear');
        second = s;
      }
    }
    while (cpu && t >= cpuAt) {
      cpu.apply(cpuFrame(CPU_LOADS[cpuIndex]), t, 0.6, 'easeInOut');
      cpuIndex = (cpuIndex + 1) % CPU_LOADS.length;
      cpuAt += 2;
    }
    while (pomodoro && t >= pomoAt) {
      const sent = pomo.phase;
      pomodoro.apply(pomoFrame(pomo.phase, pomo.left), t, 1.25, 'linear');
      if (sent === 'idle') pomo = { phase: 'work', left: WORK };                    // a tap on Start
      else if (pomo.left > 0) pomo.left -= 1;
      else pomo = sent === 'work' ? { phase: 'rest', left: REST } : { phase: 'idle', left: WORK };
      pomoAt += sent === 'idle' ? 4 : 1;                                           // ready for a few seconds
    }
    while (network && t >= netAt) {
      const value = nextSpeed(hist[POINTS - 1]);
      hist = [...hist.slice(1), value];
      network.apply(netFrame(hist, 0, netText), t, 0);
      netText = value.toFixed(1);
      network.apply(netFrame(hist, 1, netText), t, 2, 'linear');
      netAt += 2;
    }
  }

  const loop = new Loop({
    root: deck,
    onFrame(time) {
      if (!reduce) tick(time);
      for (const model of Object.values(models)) draw(model, time);
      return !reduce;
    },
  });

  if (reduce) still(0);
  else { startStates(0); liveAt = 0.6; }
  loop.renderNow();
  if (!reduce) loop.wake();

  const unwatch = watchReducedMotion(on => {
    reduce = on;
    if (on) { loop.sleep(); still(loop.time); loop.renderNow(); }
    else { second = 0; loop.wake(); }
  });

  return { destroy() { unwatch(); loop.destroy(); } };
}

document.querySelectorAll('[data-live-widgets]').forEach(mount);
