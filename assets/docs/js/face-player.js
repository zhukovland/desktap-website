/*
 * face-player.js: the phone's rules for a button face, for the docs' animated diagrams.
 * Vanilla ES module, no dependencies. Nothing touches the DOM at import time, so node can import it for tests.
 *
 * ─── API for diagram builders ──────────────────────────────────────────────────────────────────────────────────
 *
 * 1. FRAMES. A frame is what one post to the phone carries, reduced to what decides glide or cross-fade:
 *      frame(elements, nums, texts, extra) → { elements, sig, nums, texts, ...extra }
 *        elements  the face's elements in drawing order, e.g. ['track', 'ring', 'hot', 'value', 'label'].
 *                  sig = elements.join(','): same sig as the face on screen → glide; any other → cross-fade.
 *                  Put everything that makes two frames cross-fade into an element's name (e.g. 'ring:round').
 *        nums      every number that glides: { offset: 137.22, r: 255, g: 159, b: 10, hot: 0 }.
 *                  Colors go in as three numbers (rgbNums('#FF9F0A', 'ring') → { ringR, ringG, ringB }).
 *        texts     strings: they change the moment the frame arrives, { value: '72' }.
 *      Build the numbers with the same arithmetic as the recipe's zsh/awk, so the diagram shows what the script
 *      really sends; check consecutive frames with the HEAD svgdiff and put the verdicts in your node test.
 *
 * 2. A MODEL PER BUTTON.
 *      const model = new FaceModel({ makeTree, dropTree, angles: ['hand'] });
 *        makeTree(frame) → tree    build the SVG nodes for this structure (append them to cell.host) and return
 *                                  the handles draw() needs. Called for the first frame and for every cross-fade.
 *        dropTree(tree)            remove those nodes. Called when a tree is no longer drawn.
 *        angles                    nums keys holding rotations in degrees: they turn the short way (350 → 10 is +20).
 *      model.apply(frame, t, duration, easing = 'easeInOut') → { kind, start, dur }
 *        kind 'first' | 'glide' | 'text' (same numbers, new text) | 'instant' (duration 0) | 'fade' (cross-fade).
 *        t is diagram time in seconds (loop.time). easing: 'easeInOut' or 'linear', as in the update body.
 *      model.snap(frame, t)       shown at once, no glide and no fade (a button coming back on screen).
 *      model.stateAt(t) → [{ tree, values, texts, opacity }], bottom first. During a cross-fade there are two or
 *                                 more: the old ones fully drawn, the newest fading in on top.
 *      model.busyAt(t)            true while anything moves (lets the loop sleep when nothing does).
 *      model.motionAt(t) → { kind: 'fade' | 'glide' | null, p, elapsed, dur }   what the newest face is doing
 *                                 (p 0…1; kind null and p 1 at rest). model.progressAt(t) is its p.
 *      model.last                 the last apply's result.
 *      replay(model, [[frame, t, duration, easing], …]) applies a list of sends; use it for storyboards.
 *
 * 3. DRAW. One function writes the numbers of every tree; call it from the loop:
 *      function draw(model, t) {
 *        for (const { tree, values: v, texts, opacity } of model.stateAt(t)) {
 *          tree.root.setAttribute('opacity', opacity);
 *          tree.ring.setAttribute('stroke', rgb(v.ringR, v.ringG, v.ringB));
 *          tree.ring.setAttribute('stroke-dashoffset', v.offset.toFixed(2));
 *          if (tree.value.textContent !== texts.value) tree.value.textContent = texts.value;
 *        }
 *      }
 *    Never animate path data (d, points) in the browser: show a still rendered by the app's engine instead.
 *    Draw every <text> after every shape: the phone draws text above shapes.
 *
 * 4. A PHONE CELL.
 *      const cell = makeCell({ cols: 1, rows: 1, unit: 160, viewBox: [0, 0, 200, 200], fit: 'contain', label });
 *        cell.svg   an <svg class="dt-cell"> to put on the page (CSS sizes it; it keeps its aspect ratio).
 *        cell.host  a <g> in the face's own viewBox coordinates, clipped to the button's corners and to the
 *                   viewBox: append your trees here.
 *        cell.setViewBox([x, y, w, h]), cell.setFit('contain' | 'cover' | 'stretch'), cell.setLabel(text)
 *      Sizes: Normal { cols: 1, rows: 1 }, Wide { cols: 2 }, Tall { rows: 2 }, Large { cols: 2, rows: 2 };
 *      the default viewBox follows (200×200, 400×200, 200×400, 200×200). The cell is the glass button
 *      (corner 0.2237 × the cell side) on a fixed #0D0D0D patch of phone screen that never re-themes.
 *      svgEl(name, attrs, parent) creates SVG nodes; rgb(r, g, b) writes a color.
 *
 * 5. TIME. A Loop owns requestAnimationFrame, the diagram clock and pausing:
 *      const loop = new Loop({ root: figure, onFrame(time, dt) { …; draw(…); return keepRunning; } });
 *      loop.wake()       run frames until onFrame returns false (return true while autoplay is on or
 *                        model.busyAt(time)). Call it after every user action.
 *      loop.time         diagram seconds; advances only while frames run, at loop.speed (1 or 0.25).
 *      loop.renderNow()  one onFrame(time, 0) right now, without starting (reduced motion, frozen stills).
 *      loop.destroy()
 *    The loop stops by itself while the root is off screen (IntersectionObserver) or the tab is hidden, and
 *    goes on from where it was when they come back.
 *
 * 6. MOTION AND TEST SWITCHES.
 *      readSwitches(el, { reducedMotion }) → { at, view, reduced }
 *        at       seconds to freeze at (data-at on the mount, or ?dt-at=5.3): draw that moment, never autoplay.
 *        view     'story' opens the storyboard (data-view="story" or ?dt-view=story).
 *        reduced  docs.js's reducedMotion, or ?dt-motion=reduce. With it: no autoplay, the storyboard is the
 *                 default view, and frames a reader sends apply at once (duration 0).
 *      watchReducedMotion(fn) calls fn(true | false) when the system setting changes; returns an unsubscribe.
 *
 * 7. A DIAGRAM MODULE (assets/docs/js/diagrams/NAME.js), the pattern diagrams/glide-vs-crossfade.js follows:
 *      export default function mount(el, { mode, reducedMotion } = {}) {
 *        ensureChrome();                                        // from dt-chrome.js
 *        const sw = readSwitches(el, { reducedMotion });
 *        const original = [...el.childNodes];                   // the placeholder sentence, restored by destroy()
 *        const { figure, controls, body, legend, caption, announce } = makeFigure({ name, eyebrow, title, lede });
 *        // cells, models, controls; a Loop whose onFrame autoplays (never when sw.reduced or sw.at) and draws
 *        el.replaceChildren(figure);
 *        loop.renderNow();                                      // draw the first state before the loop runs
 *        if (!sw.reduced && sw.at === null) loop.wake();
 *        const unwatch = watchReducedMotion(on => { if (on) { stopAutoplay(); showStoryboard(); } });
 *        return { destroy() { unwatch(); loop.destroy(); el.replaceChildren(...original); } };
 *      }
 *    Text rules: the caption states the rule first, in bold, then what the reader will see, then the fix.
 *    Teach how to write a face, not how the phone works inside: no frame rates, layers, caches or curves in
 *    any visible text. Export the frame builders (like D1's ringFrame) so a node test can check them.
 *    Loop also has sleep() (stop running frames; the clock keeps its time).
 *
 * Chrome (the card, buttons, segmented controls, chips, legend, caption) lives in dt-chrome.js.
 * Not modelled on purpose: the browser draws at its own frame rate; CSS corners are circular, the phone's are
 * continuous (invisible at docs sizes).
 */

// ─── Curves ──────────────────────────────────────────────────────────────────────────────────────────────────

/** The two easings an update can ask for. easeInOut is the phone's quadratic curve, not CSS ease-in-out. */
export const EASE = Object.freeze({
  linear: t => t,
  easeInOut: t => (t < 0.5 ? 2 * t * t : 1 - ((2 - 2 * t) * (2 - 2 * t)) / 2),
});

/** A CSS-style cubic-bezier timing function x → y. */
export function cubicBezier(x1, y1, x2, y2) {
  const bx = u => 3 * x1 * u * (1 - u) ** 2 + 3 * x2 * u * u * (1 - u) + u ** 3;
  const by = u => 3 * y1 * u * (1 - u) ** 2 + 3 * y2 * u * u * (1 - u) + u ** 3;
  return x => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, u = x;
    for (let i = 0; i < 40; i++) {
      u = (lo + hi) / 2;
      if (bx(u) < x) lo = u; else hi = u;
    }
    return by(u);
  };
}

/** The cross-fade's curve: the new frame's opacity over the fade, whatever easing the update asked for. */
export const FADE = cubicBezier(0.42, 0, 0.58, 1);

export const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);

/** The angle `to` moved by whole turns so that from → to is the short way (350 → 10 gives 370). */
export function unwrapDegrees(from, to) {
  let d = to - from;
  const turns = d / 360;
  d -= 360 * (Math.sign(turns) * Math.round(Math.abs(turns)));   // a half-turn tie rounds away from zero
  return from + d;
}

// ─── Frames ──────────────────────────────────────────────────────────────────────────────────────────────────

/** One frame: the elements in drawing order (its structure), the numbers that glide, the texts that swap. */
export function frame(elements, nums = {}, texts = {}, extra = {}) {
  return { ...extra, elements: [...elements], sig: elements.join(','), nums: { ...nums }, texts: { ...texts } };
}

/** '#RRGGBB' or '#RGB' → [r, g, b], 0…255. */
export function hexToRgb(hex) {
  let s = String(hex).replace('#', '');
  if (s.length === 3) s = s.split('').map(c => c + c).join('');
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** A color as three glide numbers: rgbNums('#FF453A', 'ring') → { ringR: 255, ringG: 69, ringB: 58 }. */
export function rgbNums(hex, prefix = '') {
  const [r, g, b] = hexToRgb(hex);
  const k = prefix ? c => prefix + c.toUpperCase() : c => c;
  return { [k('r')]: r, [k('g')]: g, [k('b')]: b };
}

/** An SVG color from (possibly fractional) channels. */
export function rgb(r, g, b) {
  const c = v => Math.round(v < 0 ? 0 : v > 255 ? 255 : v);
  return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}

/** The numbers of a glide at time t. */
export function valuesAt(glide, t) {
  const f = EASE[glide.easing](clamp01((t - glide.start) / glide.dur));
  const out = {};
  for (const k in glide.to) {
    const a = k in glide.from ? glide.from[k] : glide.to[k];
    out[k] = a + (glide.to[k] - a) * f;
  }
  return out;
}

function sameNumbers(a, b) {
  if (!a || !b) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every(k => a[k] === b[k]);
}

// ─── The model of one button ─────────────────────────────────────────────────────────────────────────────────

const MAX_TREES = 8;

/**
 * The faces one button shows. Same structure as the face on screen → glide from where it is now (also mid-glide);
 * new structure → a new face fades in on top while the older ones stay fully drawn, each removed when the fade
 * covering it ends; duration 0 → shown at once.
 */
export class FaceModel {
  /** @param {{makeTree?: Function, dropTree?: Function, angles?: string[]} | Function} options */
  constructor(options = {}, dropTree) {
    const o = typeof options === 'function' ? { makeTree: options, dropTree } : options;
    this.makeTree = o.makeTree || (() => ({}));
    this.dropTree = o.dropTree || (() => {});
    this.angles = [...(o.angles || [])];
    this.trees = [];
    this.last = null;
  }

  get top() { return this.trees[this.trees.length - 1]; }

  apply(frame, t, duration, easing = 'easeInOut') {
    if (!(easing in EASE)) throw new Error(`face-player: unknown easing "${easing}"`);
    const dur = duration > 0 ? duration : 0;
    this.sweep(t);
    const top = this.top;
    let result;
    if (!top) {
      this.trees = [this.newTree(frame)];
      result = { kind: 'first', start: t, dur: 0 };
    } else if (frame.sig !== top.sig) {
      const tree = this.newTree(frame);
      if (dur > 0) {
        tree.fade = { begin: t, dur };
        top.removeAt = t + dur;
        this.trees.push(tree);
        while (this.trees.length > MAX_TREES) this.remove(this.trees[0]);
      } else {
        this.trees.forEach(x => this.dropTree(x));
        this.trees = [tree];
      }
      result = { kind: 'fade', start: t, dur };
    } else {
      top.texts = { ...frame.texts };                      // text changes at once, gliding or not
      if (sameNumbers(frame.nums, top.lastNums)) {
        result = { kind: 'text', start: t, dur: 0 };        // a glide under way carries on
      } else if (dur === 0) {
        top.glide = null;
        top.target = { ...frame.nums };
        top.lastNums = { ...frame.nums };
        result = { kind: 'instant', start: t, dur: 0 };
      } else {
        const from = top.glide ? valuesAt(top.glide, t) : top.target;
        const to = { ...frame.nums };
        for (const k of this.angles) if (k in to && k in from) to[k] = unwrapDegrees(from[k], to[k]);
        top.glide = { from, to, start: t, dur, easing };
        top.target = to;
        top.lastNums = { ...frame.nums };
        result = { kind: 'glide', start: t, dur };
      }
    }
    this.last = result;
    return result;
  }

  /** Shown at once with no glide and no fade, whatever the structure. */
  snap(frame, t) {
    const top = this.top;
    if (top && top.sig === frame.sig) {
      for (const tree of this.trees) if (tree !== top) this.dropTree(tree);
      Object.assign(top, { glide: null, fade: null, removeAt: null, target: { ...frame.nums },
        lastNums: { ...frame.nums }, texts: { ...frame.texts } });
      this.trees = [top];
    } else {
      this.trees.forEach(x => this.dropTree(x));
      this.trees = [this.newTree(frame)];
    }
    this.last = { kind: 'snap', start: t, dur: 0 };
    return this.last;
  }

  newTree(frame) {
    const tree = this.makeTree(frame) || {};
    Object.assign(tree, { sig: frame.sig, target: { ...frame.nums }, lastNums: { ...frame.nums },
      texts: { ...frame.texts }, glide: null, fade: null, removeAt: null });
    return tree;
  }

  remove(tree) {
    const i = this.trees.indexOf(tree);
    if (i < 0 || tree === this.top) return;
    this.trees.splice(i, 1);
    this.dropTree(tree);
  }

  /** Drops the covered trees whose fade has ended by t. */
  sweep(t) {
    for (const tree of [...this.trees]) {
      if (tree !== this.top && tree.removeAt !== null && t >= tree.removeAt) this.remove(tree);
    }
  }

  /** What each tree shows at t, bottom first. */
  stateAt(t) {
    this.sweep(t);
    return this.trees.map(tree => ({
      tree,
      values: tree.glide ? valuesAt(tree.glide, t) : tree.target,
      texts: tree.texts,
      opacity: tree.fade ? FADE(clamp01((t - tree.fade.begin) / tree.fade.dur)) : 1,
    }));
  }

  busyAt(t) {
    if (this.trees.length > 1) return true;
    const top = this.top;
    if (!top) return false;
    if (top.glide && t < top.glide.start + top.glide.dur) return true;
    return !!(top.fade && t < top.fade.begin + top.fade.dur);
  }

  /** The motion under way on the newest face at t: { kind: 'fade' | 'glide' | null, p (0…1), elapsed, dur }. */
  motionAt(t) {
    const top = this.top;
    const run = (kind, start, dur) => ({ kind, p: clamp01((t - start) / dur), elapsed: Math.max(0, t - start), dur });
    if (top && top.fade && t < top.fade.begin + top.fade.dur) return run('fade', top.fade.begin, top.fade.dur);
    if (top && top.glide && t < top.glide.start + top.glide.dur) return run('glide', top.glide.start, top.glide.dur);
    return { kind: null, p: 1, elapsed: 0, dur: 0 };
  }

  progressAt(t) { return this.motionAt(t).p; }
}

/** Applies [[frame, t, duration, easing?], …] in order; returns the model. */
export function replay(model, sends) {
  for (const [f, t, duration, easing] of sends) model.apply(f, t, duration, easing);
  return model;
}

// ─── The phone cell ──────────────────────────────────────────────────────────────────────────────────────────

const SVGNS = 'http://www.w3.org/2000/svg';
let cellCount = 0;

/** createElementNS with attributes; appended to parent when given. */
export function svgEl(name, attrs = {}, parent = null) {
  const e = document.createElementNS(SVGNS, name);
  for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, String(attrs[k]));
  if (parent) parent.appendChild(e);
  return e;
}

const FIT = { contain: 'xMidYMid meet', cover: 'xMidYMid slice', stretch: 'none' };

/**
 * A button on the phone's screen: the glass card (white 0.08, rim white 0.18 → 0.06 → clear, corner 0.2237 × the
 * cell side) on a patch of the screen color, with the face drawn into `host` in viewBox coordinates.
 */
export function makeCell({ cols = 1, rows = 1, unit = 160, gap = null, viewBox = null, fit = 'contain', label = '' } = {}) {
  const g = gap === null ? Math.round(unit * 0.1) : gap;
  const w = cols * unit + (cols - 1) * g, hgt = rows * unit + (rows - 1) * g;
  const pad = Math.round(unit * 0.09), W = w + 2 * pad, H = hgt + 2 * pad;
  const R = +(0.2237 * unit).toFixed(2);
  const id = 'dtcell' + (++cellCount);
  let vb = viewBox || [0, 0, cols === 2 && rows === 1 ? 400 : 200, rows === 2 && cols === 1 ? 400 : 200];

  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'dt-cell', role: 'img', width: W, height: H });
  if (label) svg.setAttribute('aria-label', label);
  const defs = svgEl('defs', {}, svg);
  svgEl('rect', { x: pad, y: pad, width: w, height: hgt, rx: R }, svgEl('clipPath', { id: id + 'c' }, defs));
  const vbClip = svgEl('rect', {}, svgEl('clipPath', { id: id + 'v' }, defs));
  const rim = svgEl('linearGradient', { id: id + 'r', x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
  [['0', '0.18'], ['0.5', '0.06'], ['1', '0']].forEach(([o, a]) =>
    svgEl('stop', { offset: o, 'stop-color': '#FFFFFF', 'stop-opacity': a }, rim));

  svgEl('rect', { width: W, height: H, rx: R + pad * 0.6, class: 'dt-screen', fill: '#0D0D0D' }, svg);
  svgEl('rect', { x: pad, y: pad, width: w, height: hgt, rx: R, fill: '#FFFFFF', 'fill-opacity': 0.08 }, svg);
  const face = svgEl('svg', { x: pad, y: pad, width: w, height: hgt, overflow: 'hidden' },
    svgEl('g', { 'clip-path': `url(#${id}c)` }, svg));
  const host = svgEl('g', { 'clip-path': `url(#${id}v)` }, face);
  svgEl('rect', { x: pad + 0.5, y: pad + 0.5, width: w - 1, height: hgt - 1, rx: R - 0.5, fill: 'none',
    stroke: `url(#${id}r)`, 'stroke-width': 1 }, svg);

  const cell = {
    svg, host, width: W, height: H,
    setViewBox(next) {
      vb = next;
      face.setAttribute('viewBox', vb.join(' '));
      vbClip.setAttribute('x', vb[0]); vbClip.setAttribute('y', vb[1]);
      vbClip.setAttribute('width', vb[2]); vbClip.setAttribute('height', vb[3]);
    },
    setFit(next) { face.setAttribute('preserveAspectRatio', FIT[next] || FIT.contain); },
    setLabel(text) { svg.setAttribute('aria-label', text); },
  };
  cell.setViewBox(vb);
  cell.setFit(fit);
  return cell;
}

// ─── Time ────────────────────────────────────────────────────────────────────────────────────────────────────

/** requestAnimationFrame with a diagram clock that stops off screen and in hidden tabs. */
export class Loop {
  constructor({ root, onFrame, maxStep = 0.1 }) {
    this.root = root;
    this.onFrame = onFrame;
    this.maxStep = maxStep;
    this.time = 0;
    this.speed = 1;
    this.awake = false;
    this.visible = typeof IntersectionObserver === 'undefined';
    this.raf = 0;
    this.lastTs = null;
    this.step = this.step.bind(this);
    this.onVisibility = () => this.kick();
    document.addEventListener('visibilitychange', this.onVisibility);
    if (!this.visible) {
      this.observer = new IntersectionObserver(entries => {
        this.visible = entries[entries.length - 1].isIntersecting;
        this.kick();
      });
      this.observer.observe(root);
    }
  }

  get running() { return this.raf !== 0; }

  /** Run frames until onFrame returns false. */
  wake() { this.awake = true; this.kick(); }

  /** Stop running frames (the clock keeps its time). */
  sleep() { this.awake = false; this.kick(); }

  renderNow() { this.onFrame(this.time, 0); }

  kick() {
    const go = this.awake && this.visible && !document.hidden && this.root.isConnected && !this.destroyed;
    if (go && !this.raf) {
      this.lastTs = null;
      this.raf = requestAnimationFrame(this.step);
    } else if (!go && this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  step(ts) {
    this.raf = 0;
    const dt = this.lastTs === null ? 0 : Math.min(this.maxStep, (ts - this.lastTs) / 1000) * this.speed;
    this.lastTs = ts;
    this.time += dt;
    const more = this.onFrame(this.time, dt);
    if (!more) this.awake = false;
    if (this.awake && this.visible && !document.hidden && this.root.isConnected && !this.destroyed) {
      this.raf = requestAnimationFrame(this.step);
    }
  }

  destroy() {
    this.destroyed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.observer) this.observer.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
  }
}

// ─── Motion and test switches ────────────────────────────────────────────────────────────────────────────────

/** Freeze time, open the storyboard, or force reduced motion from the mount or the URL. */
export function readSwitches(el, { reducedMotion = false } = {}) {
  const q = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
  const ds = (el && el.dataset) || {};
  const rawAt = ds.at !== undefined ? ds.at : q.get('dt-at');
  const at = rawAt !== null && rawAt !== undefined && rawAt !== '' && Number.isFinite(+rawAt) ? Math.max(0, +rawAt) : null;
  const view = ds.view || q.get('dt-view') || null;
  const reduced = !!reducedMotion || ds.motion === 'reduce' || q.get('dt-motion') === 'reduce';
  return { at, view, reduced };
}

/** Calls fn(reduced) when the system's Reduce Motion setting changes. Returns an unsubscribe function. */
export function watchReducedMotion(fn) {
  if (typeof matchMedia === 'undefined') return () => {};
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  const listener = e => fn(e.matches);
  mq.addEventListener('change', listener);
  return () => mq.removeEventListener('change', listener);
}
