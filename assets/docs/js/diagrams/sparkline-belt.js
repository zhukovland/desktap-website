/*
 * D6 · Charts that scroll (SVG faces › Charts that scroll; the Network speed recipe).
 * A Wide network button keeps 13 points 16 apart: twelve fill the chart window (x 212…388), the newest waits
 * just past its right edge, inside <g transform="translate(…)">, behind a clip. For every sample (every 2 s)
 * the script sends a rest frame (each point one slot left, translate(0 0), duration 0.01) and a slide
 * (translate(-16 0), linear, as long as the loop takes). The numbers are the recipe's frame() arithmetic
 * (base 164, height 120) at a fixed scale of 20 MB/s, so only the translate and the dot glide.
 * X-ray draws what the clip hides. The "slide length" control shows a slide shorter than the period (the chart
 * stops) and longer (the rest frame pulls it back). The wrong way, shifting the values, is never drawn by the
 * browser: its moments are stills the app's engine drew (DeckSVGSnapshot.glide at HEAD, linear, one step of
 * the same chart, img/diagrams/sparkline-belt-shift-*.png). The browser would blend a changing polyline
 * differently from the phone, so the browser here never changes points in a glide: the rest frame applies at
 * once (the recipe's 0.01 s is shorter than one drawn frame).
 *
 * mount(el, { mode, reducedMotion }) → { destroy() }
 * Test switches (face-player.js readSwitches): data-at / ?dt-at=<s>, data-view / ?dt-view=story, ?dt-motion=reduce.
 */
import { FaceModel, Loop, frame, makeCell, svgEl, readSwitches, watchReducedMotion } from '../face-player.js';
import { ensureStyle, h, uid, makeFigure, makeButton, makeSegmented, makeLegend, setChip } from '../dt-chrome.js';

export const X0 = 212, STEP = 16, BASE = 164, HEIGHT = 120, POINTS = 13;
export const TOP = 20;                                // MB/s: the diagram keeps the scale fixed
export const PERIOD = 2;                              // seconds between samples, the recipe's pause=2
export const START = [3, 5, 4, 8, 6, 9, 7, 12, 10, 8, 11, 9, 12.3];
export const STREAM = [6.0, 8.4, 10.1, 7.2, 9.6, 13.5, 11.8, 14.2, 9.9, 7.7, 10.6, 12.3, 5.1, 8.8, 11.2, 9.4];
export const LENGTHS = [['1', '1×'], ['1.1', '1.1×'], ['1.5', '1.5×'], ['0.75', '0.75×']];
const MOMENTS = ['start', '1/4', '1/2', '3/4', 'end'];
const BLUE = '#3478F6';                               // the button's Color, Blue

/** A speed as the recipe prints MB/s: one decimal. */
export const speedText = v => v.toFixed(1);

/** The y of every point, as the recipe's awk: base − min(v, top) / top × height, one decimal. */
export const ys = hist => hist.map(v => +(BASE - (Math.min(v, TOP) / TOP) * HEIGHT).toFixed(1));

/** One frame: SHIFT 0 = rest, 1 = slid one step left. The dot sits at the window's right edge. */
export function beltFrame(hist, shift, text) {
  const y = ys(hist);
  const nums = { tx: -STEP * shift, dot: y[POINTS - 2 + shift] };
  y.forEach((v, i) => { nums['y' + i] = v; });
  return frame(['baseline', 'area', 'line', 'dot', 'value', 'unit'], nums, { value: text }, { hist: [...hist], shift });
}

/** The two frames of one sample: the new value goes in past the edge; only the slide carries its number. */
export function sampleFrames(hist, value, oldText) {
  const next = [...hist.slice(1), value];
  return { hist: next, rest: beltFrame(next, 0, oldText), slide: beltFrame(next, 1, speedText(value)) };
}

const pointsOf = v => Array.from({ length: POINTS }, (_, i) => `${(X0 + i * STEP).toFixed(1)},${v['y' + i].toFixed(1)}`);
const areaOf = v => `M ${X0}.0 ${BASE}.0 ` + pointsOf(v).map(p => 'L ' + p.replace(',', ' ')).join(' ') +
  ` L ${(X0 + (POINTS - 1) * STEP).toFixed(1)} ${BASE}.0 Z`;

const IMG = name => new URL(`../../img/diagrams/${name}.png`, import.meta.url).href;

// ─── A Wide button with an x-ray layer ───────────────────────────────────────────────────────────────────────

function makeBelt(label) {
  const cell = makeCell({ cols: 2, rows: 1, unit: 160, label });
  cell.svg.classList.add('dt-belt-cell');
  const clip = uid('dtwin');
  const defs = svgEl('defs', {}, cell.host);
  svgEl('rect', { x: X0, y: 0, width: (POINTS - 2) * STEP, height: 200 }, svgEl('clipPath', { id: clip }, defs));

  const tree = () => {
    const root = svgEl('g', {}, cell.host);
    svgEl('line', { x1: 212, y1: 165, x2: 388, y2: 165, stroke: '#FFFFFF', 'stroke-opacity': 0.15, 'stroke-width': 2 }, root);
    const belt = svgEl('g', {}, svgEl('g', { 'clip-path': `url(#${clip})` }, root));
    const area = svgEl('path', { fill: BLUE, 'fill-opacity': 0.18 }, belt);
    const line = svgEl('polyline', { fill: 'none', stroke: BLUE, 'stroke-width': 5, 'stroke-linejoin': 'round',
      'stroke-linecap': 'round' }, belt);
    const dot = svgEl('circle', { cx: 388, r: 7, fill: BLUE }, root);
    const value = svgEl('text', { x: 24, y: 104, 'font-size': 60, 'font-weight': 'bold', fill: '#FFFFFF' }, root);
    const unit = svgEl('text', { x: 24, y: 146, 'font-size': 28, fill: '#FFFFFF', 'fill-opacity': 0.6 }, root);
    unit.textContent = '↓ MB/s';
    return { root, belt, area, line, dot, value };
  };
  const model = new FaceModel({ makeTree: tree, dropTree: t => t.root.remove() });

  // X-ray: the same belt outside the window, the window's frame and the waiting point, over the button.
  const face = cell.svg.querySelector('svg');
  const xray = svgEl('svg', { x: face.getAttribute('x'), y: face.getAttribute('y'), width: face.getAttribute('width'),
    height: face.getAttribute('height'), viewBox: '0 0 400 200', overflow: 'visible', class: 'dt-belt-xray',
    'aria-hidden': 'true' }, cell.svg);
  const out = uid('dtout');
  const outClip = svgEl('clipPath', { id: out }, svgEl('defs', {}, xray));
  svgEl('rect', { x: -60, y: -40, width: 60 + X0, height: 280 }, outClip);
  svgEl('rect', { x: 388, y: -40, width: 120, height: 280 }, outClip);
  const xbelt = svgEl('g', {}, svgEl('g', { 'clip-path': `url(#${out})` }, xray));
  const xarea = svgEl('path', { fill: '#FFFFFF', 'fill-opacity': 0.1 }, xbelt);
  const xline = svgEl('polyline', { fill: 'none', stroke: '#FFFFFF', 'stroke-opacity': 0.8, 'stroke-width': 4,
    'stroke-dasharray': '6 4', 'stroke-linejoin': 'round' }, xbelt);
  svgEl('rect', { x: 212, y: 3, width: 176, height: 194, rx: 4, fill: 'none', 'stroke-width': 2,
    'stroke-dasharray': '7 5', class: 'dt-belt-window' }, xray);
  const parkedG = svgEl('g', {}, xray);
  const parked = svgEl('circle', { cx: X0 + (POINTS - 1) * STEP, r: 11, fill: 'none', 'stroke-width': 3,
    class: 'dt-belt-parked' }, parkedG);

  function draw(t) {
    const states = model.stateAt(t);
    for (const { tree: tr, values: v, texts, opacity } of states) {
      tr.root.setAttribute('opacity', opacity.toFixed(4));
      tr.belt.setAttribute('transform', `translate(${v.tx.toFixed(2)} 0)`);
      tr.area.setAttribute('d', areaOf(v));
      tr.line.setAttribute('points', pointsOf(v).join(' '));
      tr.dot.setAttribute('cy', v.dot.toFixed(2));
      if (tr.value.textContent !== texts.value) tr.value.textContent = texts.value;
    }
    const top = states[states.length - 1];
    if (top) {
      const v = top.values;
      xbelt.setAttribute('transform', `translate(${v.tx.toFixed(2)} 0)`);
      xarea.setAttribute('d', areaOf(v));
      xline.setAttribute('points', pointsOf(v).join(' '));
      parkedG.setAttribute('transform', `translate(${v.tx.toFixed(2)} 0)`);
      parked.setAttribute('cy', v['y' + (POINTS - 1)].toFixed(1));
      parked.setAttribute('opacity', v.tx > -STEP / 2 ? 1 : 0.35);
    }
  }

  return { cell, model, draw, setXray(on) { xray.style.display = on ? '' : 'none'; } };
}

// ─── Diagram CSS ─────────────────────────────────────────────────────────────────────────────────────────────

const CSS = `
.dt-diagram .dt-panes.dt-one { grid-template-columns: minmax(0, 1fr); }
.dt-diagram .dt-cell.dt-belt-cell { width: min(400px, 100%); }
.dt-diagram .dt-strip .dt-cell.dt-belt-cell { width: 100%; max-width: 240px; }
.dt-diagram .dt-belt-window { stroke: var(--dt-accent); }
.dt-diagram .dt-belt-parked { stroke: var(--dt-warn); }
.dt-diagram[data-dt-name="sparkline-belt"] code { white-space: nowrap; }
.dt-diagram .dt-belt-pull:empty { display: none; }
.dt-diagram .dt-belt-length { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; margin: 0 0 12px; }
.dt-diagram .dt-belt-length .dt-pane-label { margin: 0; }
.dt-diagram .dt-belt-stills { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; margin: 14px 0 10px; }
.dt-diagram .dt-belt-stills > figure { margin: 0; text-align: center; min-width: 0; }
.dt-diagram .dt-belt-stills img {
  display: block; width: 100%; height: auto; border-radius: 18% / 36%;
  outline: 2px solid transparent; outline-offset: 1px; transition: outline-color 0.12s;
}
.dt-diagram .dt-belt-stills > figure.is-now img { outline-color: var(--dt-warn); }
.dt-diagram .dt-belt-stills figcaption {
  font-family: var(--dt-mono); font-size: 0.6875rem; letter-spacing: 0.06em; color: var(--dt-muted); margin-top: 4px;
}
.dt-diagram .dt-belt-stills > figure.is-now figcaption { color: var(--dt-warn); }
.dt-diagram .dt-story .dt-belt-stills > figure img { outline: 0; }
.dt-diagram .dt-belt-drawn { margin: 0; font-size: 0.75rem; line-height: 1.5; color: var(--dt-muted); }
.dt-diagram .dt-strip.dt-belt-strip { --dt-cols: 3; }
@container dt (max-width: 560px) {
  .dt-diagram .dt-belt-stills { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .dt-diagram .dt-belt-stills > figure.quarter { display: none; }
  .dt-diagram .dt-strip.dt-belt-strip { --dt-cols: 1; }
  .dt-diagram .dt-strip.dt-belt-strip .dt-cell.dt-belt-cell { max-width: 300px; }
}
`;

const REASONS = {
  1: 'Each slide ends as the next sample arrives, so the chart never stops. The rest frame changes nothing you can see.',
  1.1: 'The next sample comes when the slide is 91% of the way, so the rest frame pulls the chart back 9% of a step: too little to see.',
  1.5: 'The next sample comes two thirds of the way, so the rest frame pulls the chart back a third of a step: it jerks at every sample.',
  0.75: 'Each slide ends half a second early, so the chart stands still for a moment at every step.',
};

// ─── The diagram ─────────────────────────────────────────────────────────────────────────────────────────────

export default function mount(el, { reducedMotion = false } = {}) {
  ensureStyle('dt-sparkline-belt', CSS);
  const sw = readSwitches(el, { reducedMotion });
  let reduce = sw.reduced;
  const original = [...el.childNodes];

  const { figure, controls, body, legend, caption, announce } = makeFigure({
    name: 'sparkline-belt',
    eyebrow: 'Charts that scroll',
    title: 'Slide the whole chart one step. Don’t shift its values.',
    lede: 'A network chart gets a new sample every 2 seconds. Turn on X-ray to see what the clip hides.',
  });

  const panesEl = h('div', { class: 'dt-panes dt-one' });
  const storyEl = h('div', { class: 'dt-story', hidden: '' });
  body.append(panesEl, storyEl);

  // Pane A: the belt, live.
  const belt = makeBelt('The network button: a chart that scrolls to the left');
  const chipA = h('span', { class: 'dt-chip' });
  const phaseA = h('span', { class: 'dt-phase' });
  const fillA = h('span');
  const barA = h('div', { class: 'dt-bar' }, fillA);
  const reasonA = h('p', { class: 'dt-reason' });
  const pullA = h('p', { class: 'dt-pane-note dt-belt-pull' });
  const sourceA = h('div', { class: 'dt-code', attrs: { role: 'group', 'aria-label': 'The two frames of every sample' } });
  let factor = 1;
  const lengthSeg = makeSegmented({ label: 'Slide length, times the time between samples', options: LENGTHS, value: '1',
    onChange: v => { factor = parseFloat(v); describeLength(); } });
  panesEl.appendChild(h('section', { class: 'dt-pane', attrs: { 'aria-label': 'Do this: scroll the chart' } },
    h('div', { class: 'dt-pane-label', text: 'Do this' }),
    h('p', { class: 'dt-pane-title', text: 'Scroll the chart' }),
    h('p', { class: 'dt-pane-note', text: 'one point more than the window shows, and two frames per sample' }),
    h('div', { class: 'dt-cellwrap' }, belt.cell.svg),
    h('div', { class: 'dt-belt-length' }, h('span', { class: 'dt-pane-label', text: 'Slide length' }), lengthSeg.el),
    h('div', { class: 'dt-status' }, h('div', { class: 'dt-chiprow' }, chipA, phaseA), barA, reasonA, pullA),
    sourceA));

  // Pane B: shifting the values, as stills the app drew.
  const stills = MOMENTS.map((m, i) => {
    const img = h('img', { src: IMG(`sparkline-belt-shift-${i}`), width: 368, height: 192, decoding: 'async',
      alt: `The chart with every value shifted one slot, ${i === 0 ? 'at the start' : i === 4 ? 'at the end' : `${m} of the way`}` });
    return h('figure', { class: i === 1 || i === 3 ? 'quarter' : null }, img, h('figcaption', { text: m }));
  });
  const chipB = h('span', { class: 'dt-chip' });
  setChip(chipB, 'fade', 'Wobbles');
  panesEl.appendChild(h('section', { class: 'dt-pane', attrs: { 'aria-label': 'Not this: shift the values' } },
    h('div', { class: 'dt-pane-label', text: 'Not this' }),
    h('p', { class: 'dt-pane-title', text: 'Shift the values' }),
    h('p', { class: 'dt-pane-note', text: 'each point takes its neighbor’s value, and nothing moves sideways' }),
    h('div', { class: 'dt-belt-stills' }, ...stills),
    h('p', { class: 'dt-belt-drawn', text: 'One step of the same chart, drawn by Desktap.' }),
    h('div', { class: 'dt-status' },
      h('div', { class: 'dt-chiprow' }, chipB),
      h('p', { class: 'dt-reason', text: 'Every point moves up or down at once, so the whole line changes shape on the way ' +
        'and only the dot at the edge stays put.' }))));

  function describeLength() {
    const d = (factor * PERIOD).toFixed(2);
    sourceA.innerHTML =
      `<span class="dt-row"><span class="tag">rest </span>  translate(<span class="num">0</span> 0)</span>` +
      `<span class="dt-row">       duration 0.01</span>` +
      `<span class="dt-row"><span class="tag">slide</span>  translate(<span class="num">-16</span> 0)</span>` +
      `<span class="dt-row">       linear, duration <span class="num">${d}</span></span>`;
    reasonA.textContent = REASONS[factor];
  }

  // Clock and autoplay.
  let hist = [...START], text = speedText(START[START.length - 1]);
  let playing = false, k = 0, nextAt = PERIOD, view = 'live', xrayOn = false;
  const frozen = sw.at !== null;

  function sample(t, spoken) {
    const before = belt.model.motionAt(t);
    const pulled = belt.model.last && belt.model.last.kind === 'glide' && before.kind === 'glide' ? 1 - before.p : 0;
    const value = STREAM[k % STREAM.length];
    k += 1;
    const s = sampleFrames(hist, value, text);
    belt.model.apply(s.rest, t, 0);
    belt.model.apply(s.slide, t, reduce ? 0 : factor * PERIOD, 'linear');
    hist = s.hist;
    text = s.slide.texts.value;
    pullA.textContent = pulled > 0.005
      ? `At this sample the rest frame pulled the chart back ${Math.round(pulled * 100)}% of a step.` : '';
    if (spoken) announce(`New sample, ${text} megabytes a second: a rest frame, then a slide one step left.`);
  }

  function render(time) {
    belt.draw(time);
    const m = belt.model.motionAt(time);
    barA.className = 'dt-bar';
    if (k === 0) {
      setChip(chipA, '', 'First frame'); phaseA.textContent = 'waiting for the next sample'; fillA.style.width = '0%';
    } else if (m.kind === 'glide') {
      setChip(chipA, 'glide', 'Slide'); barA.classList.add('glide');
      phaseA.textContent = `sliding · ${m.elapsed.toFixed(2)} / ${m.dur.toFixed(2)} s`;
      fillA.style.width = `${(m.p * 100).toFixed(1)}%`;
    } else if (reduce) {
      setChip(chipA, '', 'At once'); phaseA.textContent = 'Reduce Motion: frames shown at once'; fillA.style.width = '100%';
    } else if (playing && factor < 1) {
      setChip(chipA, 'fade', 'Stopped'); barA.classList.add('fade');
      phaseA.textContent = 'the slide is over; the next sample is not here yet'; fillA.style.width = '100%';
    } else {
      setChip(chipA, '', 'Resting'); phaseA.textContent = 'waiting for the next sample'; fillA.style.width = '100%';
    }
    const now = m.kind === 'glide' ? Math.min(4, Math.floor(m.p * 4 + 0.5)) : (k === 0 ? 0 : 4);
    stills.forEach((f, i) => f.classList.toggle('is-now', i === now));
  }

  const loop = new Loop({
    root: figure,
    onFrame(time) {
      if (playing) while (time >= nextAt) { sample(nextAt, false); nextAt += PERIOD; }
      render(time);
      return playing || belt.model.busyAt(time);
    },
  });

  // Controls.
  const playBtn = makeButton({ label: '❚❚ Pause', pressed: true, onClick: () => setPlaying(!playing) });
  const sendBtn = makeButton({ label: 'Send next sample', primary: true, onClick: sendNext });
  const xraySeg = makeSegmented({ label: 'What to show', options: [['phone', 'Phone'], ['xray', 'X-ray']], value: 'phone',
    onChange: v => { xrayOn = v === 'xray'; belt.setXray(xrayOn); } });
  const viewSeg = makeSegmented({ label: 'View', options: [['live', 'Live'], ['story', 'Storyboard']], value: 'live',
    onChange: setView });
  controls.append(playBtn, sendBtn, h('span', { class: 'dt-spacer' }), xraySeg.el, viewSeg.el);

  function setPlaying(on) {
    playing = on && !frozen;
    playBtn.setAttribute('aria-pressed', String(playing));
    playBtn.textContent = playing ? '❚❚ Pause' : '▶ Play';
    if (playing) { nextAt = loop.time + PERIOD; loop.wake(); }
  }

  function sendNext() {
    if (view !== 'live') setView('live');
    sample(loop.time, true);
    nextAt = loop.time + PERIOD;
    loop.renderNow();
    if (!frozen) loop.wake();
  }

  // Storyboard: three moments of the right way in x-ray, then the wrong way as Desktap draws it.
  function buildStoryboard() {
    const box = h('section', { class: 'dt-story-pane', attrs: { 'aria-label': 'Storyboard: scroll the chart, in x-ray' } },
      h('div', { class: 'dt-pane-label', text: 'Do this · x-ray' }),
      h('p', { class: 'dt-pane-title', text: 'Scroll the chart: rest, then slide' }));
    const a = sampleFrames(START, STREAM[0], speedText(START[12]));
    const b = sampleFrames(a.hist, STREAM[1], a.slide.texts.value);
    const shots = [
      ['end of a slide', m => { m.apply(a.rest, 0, 0); m.apply(a.slide, 0, PERIOD, 'linear'); return PERIOD; }],
      ['after the next rest frame', m => { m.apply(a.slide, 0, 0); m.apply(b.rest, 1, 0); return 1; }],
      ['halfway through the slide', m => { m.apply(b.rest, 0, 0); m.apply(b.slide, 0, PERIOD, 'linear'); return PERIOD / 2; }],
    ];
    const strip = h('div', { class: 'dt-strip dt-belt-strip' });
    for (const [label, run] of shots) {
      const one = makeBelt(`The chart in x-ray, ${label}`);
      one.setXray(true);
      one.draw(run(one.model));
      strip.appendChild(h('figure', {}, one.cell.svg, h('figcaption', { text: label })));
    }
    box.appendChild(h('div', { class: 'dt-story-row' },
      h('div', { class: 'dt-story-head' }, h('span', { class: 'dt-chip glide', text: 'Slide' }),
        'the window shows the same line, one step on'), strip));
    const wrong = h('section', { class: 'dt-story-pane', attrs: { 'aria-label': 'Storyboard: shift the values' } },
      h('div', { class: 'dt-pane-label', text: 'Not this · drawn by Desktap' }),
      h('p', { class: 'dt-pane-title', text: 'Shift the values' }),
      h('div', { class: 'dt-story-row' },
        h('div', { class: 'dt-story-head' }, h('span', { class: 'dt-chip fade', text: 'Wobbles' }),
          'the line changes shape on the way'),
        h('div', { class: 'dt-belt-stills' }, ...MOMENTS.map((m, i) => h('figure', { class: i === 1 || i === 3 ? 'quarter' : null },
          h('img', { src: IMG(`sparkline-belt-shift-${i}`), width: 368, height: 192, decoding: 'async',
            alt: `The chart with every value shifted one slot, ${i === 0 ? 'at the start' : i === 4 ? 'at the end' : `${m} of the way`}` }),
          h('figcaption', { text: m }))))));
    storyEl.append(box, wrong);
  }

  function setView(next) {
    view = next === 'story' ? 'story' : 'live';
    if (view === 'story' && !storyEl.childElementCount) buildStoryboard();
    storyEl.hidden = view !== 'story';
    panesEl.hidden = view === 'story';
    xraySeg.el.hidden = view === 'story';               // the storyboard is always in x-ray
    viewSeg.set(view);
  }

  makeLegend([
    { swatch: 'glide', text: 'X-ray: the window the clip shows' },
    { swatch: 'muted', text: 'X-ray: points outside it' },
    { swatch: 'fade', text: 'X-ray: the newest point, waiting past the edge' },
  ], legend);
  caption.innerHTML =
    '<strong>Scroll a chart sideways, never shift its values.</strong> Keep one point more than the window shows, ' +
    'the newest just past the right edge, in a group with <code>translate(0 0)</code>. For each sample send a rest ' +
    'frame, every point one slot to the left, and then a slide to <code>translate(-16 0)</code>, <code>linear</code>, ' +
    'as long as the loop really takes. The window then shows one line that moves without a pause. Shift the values ' +
    'instead and every point moves up or down at once: the line wobbles.' +
    '<p class="dt-note">The chart is the Network speed recipe’s, at a fixed scale. The shifted chart is shown as ' +
    'stills Desktap drew, never redrawn by your browser.</p>';

  el.replaceChildren(figure);

  // Start: the chart as it has been for a while, then a sample every 2 s.
  describeLength();
  // data-xray / ?dt-xray=1 open the x-ray (for stills and checks).
  xrayOn = el.dataset.xray !== undefined || new URLSearchParams(typeof location === 'undefined' ? '' : location.search).has('dt-xray');
  xraySeg.set(xrayOn ? 'xray' : 'phone');
  belt.setXray(xrayOn);
  belt.model.apply(beltFrame(hist, 1, text), 0, 0);
  if (frozen) {
    while ((k + 1) * PERIOD <= sw.at) sample((k + 1) * PERIOD, false);
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
