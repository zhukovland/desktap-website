/*
 * live-widgets.js: the landing's "Live widgets" section, a page of live buttons drawn with the docs' face player.
 * Every face is an SVG frame a startup script could send (only shapes, gradients and text the phone draws), and it
 * changes the way such a script would change it: numbers, colors and angles glide, text swaps at once.
 *   Now Playing (Large)    the player's track, a progress bar and 16 level bars, about 11 frames a second
 *   Claude (Normal)        Claude Code working on a project, then waiting for you: the button turns red
 *   Build (Normal)         a CI build counting its time with a turning arc, then passed: a full green ring
 *   BTC (Wide)             a price from a web API every 2 s, the change since the open and a chart that scrolls
 *   Weather (Normal)       the temperature from a weather API over a sky, the sun's rays turning slowly
 *   CPU ring (Normal)      a load every 2 s, green / orange from 50% / red from 80% (the docs' CPU ring)
 *   Pomodoro (Normal)      the countdown ring, one frame a second (the docs' Pomodoro recipe)
 *   Stars (Normal)         a repository's GitHub stars; the star pops when a new one comes in
 * The data is made up: a web page cannot read a Mac. The faces wake up when the section comes on screen and stop off
 * screen. With Reduce Motion: one still frame.
 *
 * Markup: <div class="ww-deck" data-live-widgets> with <div class="ww-slot" data-face="NAME"> per button.
 */
import { FaceModel, Loop, frame, hexToRgb, rgbNums, rgb, makeCell, svgEl, watchReducedMotion } from '../docs/js/face-player.js';

const UNIT = 160, GAP = 16, PAD = Math.round(UNIT * 0.09);   // the cell's own geometry (face-player makeCell)
const PI = 3.14159265;
const WHITE = '#FFFFFF';
let ids = 0;
const uid = name => `ww${name}${++ids}`;

const text = (parent, attrs, content = '') => {
  const t = svgEl('text', { fill: WHITE, ...attrs }, parent);
  t.textContent = content;
  return t;
};
const setText = (el, value) => { if (el.textContent !== value) el.textContent = value; };
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s) % 60).padStart(2, '0')}`;
const rand = (lo, hi) => lo + Math.random() * (hi - lo);

// ─── Now Playing (Large): Scenes and sound › Music levels, title and artist from the player ─────────────────

const TRACKS = [
  { title: 'Midnight Drive', artist: 'Neon Coast', length: 238, a: '#FF375F', b: '#FF9F0A' },
  { title: 'Glass Garden', artist: 'Lumen', length: 252, a: '#0A84FF', b: '#64D2FF' },
  { title: 'Low Tide', artist: 'Harbor Lights', length: 221, a: '#30D158', b: '#00C7BE' },
];
const BARS = 16, BAR_BASE = 104, BAR_MAX = 58;

function nowPlaying() {
  let track = 0, pos = 102, at = 0, nextBars = 0, beat = 0;
  const levels = Array(BARS).fill(0);

  const build = () => {
    const tr = TRACKS[track], nums = { ...rgbNums(tr.a, 'a'), ...rgbNums(tr.b, 'b'), progress: +(160 * pos / tr.length).toFixed(2) };
    levels.forEach((h, i) => { nums['h' + i] = h; });
    return frame(['bg', 'shade', 'label', 'bars', 'title', 'artist', 'track', 'progress', 'elapsed', 'left'], nums,
      { title: tr.title, artist: tr.artist, elapsed: mmss(pos), left: '-' + mmss(tr.length - pos) });
  };
  // Levels: the low end louder, a beat now and then, like the agent's 20 bands squeezed into 16.
  const listen = still => {
    beat = still ? 0.7 : Math.random() < 0.22 ? 1 : beat * 0.6;
    for (let i = 0; i < BARS; i++) {
      const shape = 1 - i / (BARS * 1.25);
      const v = still ? 0.35 + 0.45 * Math.abs(Math.sin(i * 1.7)) : rand(0.2, 1) * (0.55 + 0.45 * beat);
      levels[i] = +(Math.max(4, BAR_MAX * shape * v)).toFixed(1);
    }
  };

  return {
    cols: 2, rows: 2, label: 'Now Playing: the track, its progress and bars that follow the music',
    tree(host) {
      const bg = uid('np'), shade = uid('shade');
      const defs = svgEl('defs', {}, host);
      const grad = svgEl('linearGradient', { id: bg, x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
      const s0 = svgEl('stop', { offset: 0 }, grad), s1 = svgEl('stop', { offset: 1 }, grad);
      const sh = svgEl('linearGradient', { id: shade, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      svgEl('stop', { offset: 0.35, 'stop-color': '#000000', 'stop-opacity': 0 }, sh);
      svgEl('stop', { offset: 1, 'stop-color': '#000000', 'stop-opacity': 0.5 }, sh);
      const root = svgEl('g', {}, host);
      svgEl('rect', { width: 200, height: 200, fill: `url(#${bg})` }, root);
      svgEl('rect', { width: 200, height: 200, fill: `url(#${shade})` }, root);
      text(root, { x: 22, y: 34, 'font-size': 13, 'font-weight': 'bold', 'fill-opacity': 0.85 }, 'NOW PLAYING');
      const bars = Array.from({ length: BARS }, (_, i) =>
        svgEl('rect', { x: 22 + i * 10, width: 7, rx: 2, fill: WHITE, 'fill-opacity': 0.92 }, root));
      const title = text(root, { x: 22, y: 130, 'font-size': 20, 'font-weight': 'bold' });
      const artist = text(root, { x: 22, y: 150, 'font-size': 15, 'fill-opacity': 0.8 });
      svgEl('rect', { x: 22, y: 160, width: 156, height: 5, rx: 2.5, fill: WHITE, 'fill-opacity': 0.3 }, root);
      const progress = svgEl('rect', { x: 22, y: 160, height: 5, rx: 2.5, fill: WHITE }, root);
      const elapsed = text(root, { x: 22, y: 182, 'font-size': 12, 'fill-opacity': 0.8 });
      const left = text(root, { x: 178, y: 182, 'font-size': 12, 'fill-opacity': 0.8, 'text-anchor': 'end' });
      return { root, draw(v, t) {
        s0.setAttribute('stop-color', rgb(v.aR, v.aG, v.aB));
        s1.setAttribute('stop-color', rgb(v.bR, v.bG, v.bB));
        bars.forEach((bar, i) => {
          const h = v['h' + i];
          bar.setAttribute('y', (BAR_BASE - h).toFixed(2));
          bar.setAttribute('height', h.toFixed(2));
        });
        progress.setAttribute('width', Math.min(156, v.progress * 156 / 160).toFixed(2));
        setText(title, t.title); setText(artist, t.artist); setText(elapsed, t.elapsed); setText(left, t.left);
      } };
    },
    still(model, t) { listen(true); model.snap(build(), t); },
    start(model, t) { listen(true); model.apply(build(), t, 0); at = t; nextBars = t; },
    tick(model, t) {
      if (t < nextBars) return;
      pos += t - at; at = t;
      let duration = 0.1;
      if (pos >= TRACKS[track].length) {                    // the next track: its colors glide in
        track = (track + 1) % TRACKS.length; pos = 0; duration = 0.6;
      }
      listen(false);
      model.apply(build(), t, duration, 'linear');
      nextBars = t + Math.max(duration, 0.09);
    },
  };
}

// ─── Claude Code needs input (Normal): Recipes: alerts › Claude Code needs input ────────────────────────────

function claude() {
  const LOOKS = {
    working: { lines: ['Claude', 'working'], bg: '#FF3B30', bgOpacity: 0, ink: '#FF9F6B', for: 7 },
    waiting: { lines: ['Needs', 'input'], bg: '#FF3B30', bgOpacity: 1, ink: WHITE, for: 5 },
  };
  let look = 'working', next = 0;
  const build = () => {
    const l = LOOKS[look];
    return frame(['bg', 'line1', 'line2', 'name'], { ...rgbNums(l.bg, 'bg'), bgOpacity: l.bgOpacity, ...rgbNums(l.ink, 'ink') },
      { line1: l.lines[0], line2: l.lines[1], name: 'my-app' });
  };
  return {
    cols: 1, rows: 1, label: 'Claude Code: red with the project name while it waits for you',
    tree(host) {
      const root = svgEl('g', {}, host);
      const bg = svgEl('rect', { width: 200, height: 200 }, root);
      const big = { 'font-size': 40, 'font-weight': 'bold', 'text-anchor': 'middle', 'dominant-baseline': 'middle' };
      const line1 = text(root, { x: 100, y: 76, ...big });
      const line2 = text(root, { x: 100, y: 118, ...big });
      const name = text(root, { x: 100, y: 160, 'font-size': 26, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'fill-opacity': 0.8 });
      return { root, draw(v, t) {
        bg.setAttribute('fill', rgb(v.bgR, v.bgG, v.bgB));
        bg.setAttribute('fill-opacity', v.bgOpacity.toFixed(3));
        line1.setAttribute('fill', rgb(v.inkR, v.inkG, v.inkB));
        setText(line1, t.line1); setText(line2, t.line2); setText(name, t.name);
      } };
    },
    still(model, t) { look = 'waiting'; model.snap(build(), t); },
    start(model, t) { look = 'working'; model.apply(build(), t, 0); next = t + LOOKS.working.for; },
    tick(model, t) {
      if (t < next) return;
      look = look === 'working' ? 'waiting' : 'working';   // Claude asks; a tap or your answer clears it
      model.apply(build(), t, 0.3, 'easeInOut');
      next = t + LOOKS[look].for;
    },
  };
}

// ─── Build (Normal): a CI run that counts its time (Recipes: alerts › Long job with a report) ────────────────

const RING_C = 2 * PI * 78;
const RING_DASH = RING_C.toFixed(2);

function build() {
  let elapsed = 143, total = 151, angle = 0, done = false, next = 0;
  const make = () => frame(['track', 'arc', 'time', 'label'], {
    ...rgbNums(done ? '#30D158' : '#0A84FF', 'c'), offset: done ? 0 : +(RING_C * 0.72).toFixed(2), angle,
  }, { time: mmss(elapsed), label: done ? '✓ passed' : 'building' });
  return {
    cols: 1, rows: 1, angles: ['angle'], label: 'Build: the time a CI run has taken, then a green ring when it passes',
    tree(host) {
      const root = svgEl('g', {}, host);
      svgEl('circle', { cx: 100, cy: 100, r: 78, fill: 'none', stroke: WHITE, 'stroke-opacity': 0.15, 'stroke-width': 14 }, root);
      const arc = svgEl('circle', { cx: 100, cy: 100, r: 78, fill: 'none', 'stroke-width': 14, 'stroke-linecap': 'round',
        'stroke-dasharray': `${RING_DASH} ${RING_DASH}` }, root);
      const time = text(root, { x: 100, y: 98, 'font-size': 44, 'font-weight': 'bold', 'text-anchor': 'middle',
        'dominant-baseline': 'middle' });
      const label = text(root, { x: 100, y: 142, 'font-size': 26, 'text-anchor': 'middle', 'fill-opacity': 0.6 });
      return { root, draw(v, t) {
        arc.setAttribute('stroke', rgb(v.cR, v.cG, v.cB));
        arc.setAttribute('stroke-dashoffset', v.offset.toFixed(2));
        arc.setAttribute('transform', `rotate(${(v.angle - 90).toFixed(2)} 100 100)`);
        setText(time, t.time); setText(label, t.label);
      } };
    },
    still(model, t) { model.snap(make(), t); },
    start(model, t) { model.apply(make(), t, 0); next = t; },
    tick(model, t) {
      while (t >= next) {
        if (done) {                                         // a new push: the next run starts
          done = false; elapsed = 0; total = Math.round(rand(140, 170));
          model.apply(make(), next, 0.6, 'easeInOut');
          next += 1;
        } else {
          elapsed += 1; angle = (angle + 120) % 360;
          if (elapsed >= total) { done = true; elapsed = total; }
          model.apply(make(), next, done ? 0.6 : 1.25, done ? 'easeInOut' : 'linear');
          next += done ? 6 : 1;                             // passed: it stays green for a while
        }
      }
    },
  };
}

// ─── BTC price (Wide): a number from a web API with a chart that scrolls (Recipes: live widgets) ─────────────

const X0 = 212, STEP = 16, BASE = 168, HEIGHT = 112, POINTS = 13;
const OPEN = 65830, LO = 66300, HI = 68300;
const UP = '#30D158', DOWN = '#FF453A';
const PRICE_START = [66720, 66810, 66690, 66940, 66880, 67120, 67050, 67310, 67240, 67180, 67390, 67330, 67420];

function price() {
  let hist = [...PRICE_START], shown = PRICE_START[POINTS - 1], next = 0;
  const make = (shift, value) => {
    const y = hist.map(v => +(BASE - ((Math.min(HI, Math.max(LO, v)) - LO) / (HI - LO)) * HEIGHT).toFixed(1));
    const change = (value - OPEN) / OPEN * 100;
    const nums = { tx: -STEP * shift, dot: y[POINTS - 2 + shift], ...rgbNums(change >= 0 ? UP : DOWN, 'c') };
    y.forEach((v, i) => { nums['y' + i] = v; });
    return frame(['label', 'area', 'line', 'dot', 'price', 'change'], nums, {
      price: Math.round(value).toLocaleString('en-US'),
      change: `${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(2)}%`,
    });
  };
  return {
    cols: 2, rows: 1, label: 'Bitcoin price from a web API, its change today and a chart that scrolls',
    tree(host) {
      const clip = uid('win');
      svgEl('rect', { x: X0, y: 0, width: (POINTS - 2) * STEP, height: 200 },
        svgEl('clipPath', { id: clip }, svgEl('defs', {}, host)));
      const root = svgEl('g', {}, host);
      text(root, { x: 24, y: 56, 'font-size': 26, 'fill-opacity': 0.6 }, 'BTC · USD');
      const belt = svgEl('g', {}, svgEl('g', { 'clip-path': `url(#${clip})` }, root));
      const area = svgEl('path', { 'fill-opacity': 0.22 }, belt);
      const line = svgEl('polyline', { fill: 'none', 'stroke-width': 5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, belt);
      const dot = svgEl('circle', { cx: 388, r: 7 }, root);
      const value = text(root, { x: 24, y: 114, 'font-size': 50, 'font-weight': 'bold' });
      const change = text(root, { x: 24, y: 154, 'font-size': 26, 'font-weight': 'bold' });
      return { root, draw(v, t) {
        const c = rgb(v.cR, v.cG, v.cB);
        const pts = Array.from({ length: POINTS }, (_, i) => `${X0 + i * STEP}.0,${v['y' + i].toFixed(1)}`);
        belt.setAttribute('transform', `translate(${v.tx.toFixed(2)} 0)`);
        area.setAttribute('d', `M ${X0}.0 ${BASE + 12}.0 L ${pts.map(p => p.replace(',', ' ')).join(' L ')} ` +
          `L ${X0 + (POINTS - 1) * STEP}.0 ${BASE + 12}.0 Z`);
        area.setAttribute('fill', c);
        line.setAttribute('points', pts.join(' '));
        line.setAttribute('stroke', c);
        dot.setAttribute('cy', v.dot.toFixed(2));
        dot.setAttribute('fill', c);
        change.setAttribute('fill', c);
        setText(value, t.price); setText(change, t.change);
      } };
    },
    still(model, t) { model.snap(make(1, shown), t); },
    start(model, t) { model.apply(make(1, shown), t, 0); next = t + 1; },
    tick(model, t) {
      while (t >= next) {
        const v = Math.round(Math.min(HI - 60, Math.max(LO + 60, hist[POINTS - 1] + rand(-170, 175))));
        hist = [...hist.slice(1), v];
        model.apply(make(0, shown), next, 0);               // rest: one slot left, looks like the end of the slide
        shown = v;
        model.apply(make(1, shown), next, 2, 'linear');     // slide: the new price comes in
        next += 2;
      }
    },
  };
}

// ─── Weather (Normal): a number from a weather API ───────────────────────────────────────────────────────────

function weather() {
  let temp = 21, angle = 0, next = 0, nextTemp = 0;
  const make = () => frame(['sky', 'rays', 'sun', 'cloud', 'temp', 'city'], { angle }, { temp: `${temp}°` });
  return {
    cols: 1, rows: 1, angles: ['angle'], label: 'Weather from a web API: the temperature over a sunny sky',
    tree(host) {
      const sky = uid('sky');
      const grad = svgEl('linearGradient', { id: sky, x1: 0, y1: 0, x2: 0, y2: 1 }, svgEl('defs', {}, host));
      svgEl('stop', { offset: 0, 'stop-color': '#0A84FF' }, grad);
      svgEl('stop', { offset: 1, 'stop-color': '#64D2FF' }, grad);
      const root = svgEl('g', {}, host);
      svgEl('rect', { width: 200, height: 200, fill: `url(#${sky})` }, root);
      const rays = svgEl('g', {}, root);
      for (let a = 0; a < 360; a += 45) {
        const r = (a * PI) / 180;
        svgEl('line', { x1: (140 + 32 * Math.sin(r)).toFixed(1), y1: (58 - 32 * Math.cos(r)).toFixed(1),
          x2: (140 + 42 * Math.sin(r)).toFixed(1), y2: (58 - 42 * Math.cos(r)).toFixed(1),
          stroke: '#FFD60A', 'stroke-width': 6, 'stroke-linecap': 'round' }, rays);
      }
      svgEl('circle', { cx: 140, cy: 58, r: 24, fill: '#FFD60A' }, root);
      const cloud = svgEl('g', { fill: WHITE }, root);
      svgEl('circle', { cx: 104, cy: 86, r: 16 }, cloud);
      svgEl('circle', { cx: 126, cy: 78, r: 22 }, cloud);
      svgEl('circle', { cx: 148, cy: 90, r: 14 }, cloud);
      svgEl('rect', { x: 90, y: 86, width: 70, height: 18, rx: 9 }, cloud);
      const temp = text(root, { x: 24, y: 158, 'font-size': 56, 'font-weight': 'bold' });
      text(root, { x: 24, y: 184, 'font-size': 22, 'fill-opacity': 0.9 }, 'London');
      return { root, draw(v, t) {
        rays.setAttribute('transform', `rotate(${v.angle.toFixed(2)} 140 58)`);
        setText(temp, t.temp);
      } };
    },
    still(model, t) { model.snap(make(), t); },
    start(model, t) { model.apply(make(), t, 0); next = t; nextTemp = t + 20; },
    tick(model, t) {
      while (t >= next) {
        angle = (angle + 6) % 360;
        if (next >= nextTemp) { temp = Math.min(23, Math.max(19, temp + (Math.random() < 0.5 ? -1 : 1))); nextTemp += 20; }
        model.apply(make(), next, 1.25, 'linear');
        next += 1;
      }
    },
  };
}

// ─── CPU ring (Normal): SVG faces › Your first live SVG widget ───────────────────────────────────────────────

const CPU_LOADS = [23, 31, 18, 42, 57, 64, 38, 27, 83, 71, 46, 29, 15, 22, 36, 52, 44, 91, 68, 33];

function cpu() {
  let index = 0, next = 0;
  const make = (pct, rest = false) => {
    const color = rest ? '#8E8E93' : pct < 50 ? '#34C759' : pct < 80 ? '#FF9F0A' : '#FF453A';
    return frame(['track', 'ring', 'value', 'label'], { offset: +(RING_C * (1 - pct / 100)).toFixed(2), ...rgbNums(color) },
      { value: rest ? '–' : String(pct) });
  };
  return {
    cols: 1, rows: 1, label: 'CPU ring: the ring fills with the CPU load',
    tree(host) {
      const root = svgEl('g', {}, host);
      svgEl('circle', { cx: 100, cy: 100, r: 78, fill: 'none', stroke: WHITE, 'stroke-opacity': 0.15, 'stroke-width': 16 }, root);
      const ring = svgEl('circle', { cx: 100, cy: 100, r: 78, fill: 'none', 'stroke-width': 16, 'stroke-linecap': 'round',
        'stroke-dasharray': `${RING_DASH} ${RING_DASH}`, transform: 'rotate(-90 100 100)' }, root);
      const value = text(root, { x: 100, y: 116, 'font-size': 56, 'font-weight': 'bold', 'text-anchor': 'middle' });
      text(root, { x: 100, y: 146, 'font-size': 28, 'text-anchor': 'middle', 'fill-opacity': 0.6 }, 'cpu %');
      return { root, draw(v, t) {
        ring.setAttribute('stroke', rgb(v.r, v.g, v.b));
        ring.setAttribute('stroke-dashoffset', v.offset.toFixed(2));
        setText(value, t.value);
      } };
    },
    still(model, t) { model.snap(make(42), t); },
    start(model, t) { model.apply(make(0, true), t, 0); next = t + 0.6; },   // the recipe's start state: grey, "–"
    tick(model, t) {
      while (t >= next) {
        model.apply(make(CPU_LOADS[index]), next, 0.6, 'easeInOut');
        index = (index + 1) % CPU_LOADS.length;
        next += 2;
      }
    },
  };
}

// ─── Pomodoro countdown (Normal): Recipes: alerts › Pomodoro on two buttons ──────────────────────────────────

const POMO_C = 490.09;
const WORK = 25 * 60, REST = 5 * 60;
const PHASES = {
  work: { total: WORK, color: '#FF453A', label: 'focus' },
  rest: { total: REST, color: '#30D158', label: 'break' },
  idle: { total: WORK, color: '#8E8E93', label: 'ready' },
};

function pomodoro() {
  let phase = 'work', left = 18 * 60 + 42, next = 0;
  const make = (p, l) => {
    const { total, color, label } = PHASES[p];
    return frame(['track', 'ring', 'clock', 'label'], { offset: +(POMO_C * (1 - l / total)).toFixed(2), ...rgbNums(color) },
      { clock: mmss(l), label });
  };
  return {
    cols: 1, rows: 1, label: 'Pomodoro countdown: a ring around the time left',
    tree(host) {
      const root = svgEl('g', {}, host);
      svgEl('circle', { cx: 100, cy: 100, r: 78, fill: 'none', stroke: WHITE, 'stroke-opacity': 0.15, 'stroke-width': 14 }, root);
      const ring = svgEl('circle', { cx: 100, cy: 100, r: 78, fill: 'none', 'stroke-width': 14, 'stroke-linecap': 'round',
        'stroke-dasharray': `${POMO_C} ${POMO_C}`, transform: 'rotate(-90 100 100)' }, root);
      const clock = text(root, { x: 100, y: 98, 'font-size': 48, 'font-weight': 'bold', 'text-anchor': 'middle',
        'dominant-baseline': 'middle' });
      const label = text(root, { x: 100, y: 142, 'font-size': 28, 'text-anchor': 'middle', 'fill-opacity': 0.6 });
      return { root, draw(v, t) {
        ring.setAttribute('stroke', rgb(v.r, v.g, v.b));
        ring.setAttribute('stroke-dashoffset', v.offset.toFixed(2));
        setText(clock, t.clock); setText(label, t.label);
      } };
    },
    still(model, t) { model.snap(make(phase, left), t); },
    start(model, t) { model.apply(make('idle', WORK), t, 0); next = t + 0.6; },   // the start state: ready, 25:00
    tick(model, t) {
      while (t >= next) {
        const sent = phase;
        model.apply(make(phase, left), next, 1.25, 'linear');
        if (sent === 'idle') { phase = 'work'; left = WORK; }                     // a tap on Start
        else if (left > 0) left -= 1;
        else { phase = sent === 'work' ? 'rest' : 'idle'; left = phase === 'rest' ? REST : WORK; }
        next += sent === 'idle' ? 4 : 1;                                          // ready for a few seconds
      }
    },
  };
}

// ─── GitHub stars (Normal): a number from a web API ──────────────────────────────────────────────────────────

const STAR = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 ? 13 : 30, a = (i * PI) / 5;
  return `${(r * Math.sin(a)).toFixed(2)} ${(-r * Math.cos(a)).toFixed(2)}`;
});

function stars() {
  let count = 1284, next = 0, settle = null;
  const make = scale => frame(['star', 'count', 'label'], { scale }, { count: count.toLocaleString('en-US') });
  return {
    cols: 1, rows: 1, label: "GitHub stars of a repository: the star pops when a new one comes in",
    tree(host) {
      const root = svgEl('g', {}, host);
      const star = svgEl('g', {}, root);
      svgEl('path', { d: `M ${STAR.join(' L ')} Z`, fill: '#FFD60A', 'stroke-linejoin': 'round' }, star);
      const value = text(root, { x: 100, y: 136, 'font-size': 44, 'font-weight': 'bold', 'text-anchor': 'middle' });
      text(root, { x: 100, y: 168, 'font-size': 24, 'text-anchor': 'middle', 'fill-opacity': 0.6 }, 'GitHub stars');
      return { root, draw(v, t) {
        star.setAttribute('transform', `translate(100 64) scale(${v.scale.toFixed(3)})`);
        setText(value, t.count);
      } };
    },
    still(model, t) { model.snap(make(1), t); },
    start(model, t) { model.apply(make(1), t, 0); next = t + 3; },
    tick(model, t) {
      if (settle !== null && t >= settle) { model.apply(make(1), settle, 0.45, 'easeInOut'); settle = null; }
      if (t >= next) {
        count += 1;
        model.apply(make(1.3), next, 0.18, 'easeInOut');
        settle = next + 0.2;
        next += rand(5, 11);
      }
    },
  };
}

// ─── The page of buttons ─────────────────────────────────────────────────────────────────────────────────────

const FACES = { 'now-playing': nowPlaying, claude, build, price, weather, cpu, pomodoro, stars };

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
  const buttons = [];
  for (const slot of deck.querySelectorAll('[data-face]')) {
    const make = FACES[slot.dataset.face];
    if (!make) continue;
    const spec = make();
    buttons.push({ spec, model: mountFace(slot, spec) });
  }
  const reduceQuery = typeof matchMedia === 'undefined' ? null : matchMedia('(prefers-reduced-motion: reduce)');
  let reduce = !!(reduceQuery && reduceQuery.matches), started = false;

  const loop = new Loop({
    root: deck,
    onFrame(time) {
      if (!reduce) {
        if (!started) { started = true; buttons.forEach(b => b.spec.start(b.model, time)); }
        buttons.forEach(b => b.spec.tick(b.model, time));
      }
      buttons.forEach(b => draw(b.model, time));
      return !reduce;
    },
  });

  // Live: the start states are drawn now and the first frames go out once the page is on screen.
  if (reduce) buttons.forEach(b => b.spec.still(b.model, 0));
  else { started = true; buttons.forEach(b => b.spec.start(b.model, 0)); }
  loop.renderNow();
  if (!reduce) loop.wake();

  const unwatch = watchReducedMotion(on => {
    reduce = on;
    if (on) { loop.sleep(); buttons.forEach(b => b.spec.still(b.model, loop.time)); loop.renderNow(); }
    else { started = false; loop.wake(); }
  });

  return { destroy() { unwatch(); loop.destroy(); } };
}

document.querySelectorAll('[data-live-widgets]').forEach(mount);
