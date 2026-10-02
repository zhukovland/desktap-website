/*
 * D1 · Glide or cross-fade (SVG faces › Frames that glide).
 * Two CPU-ring scripts send 35 → 72 → 88 → 35% every 2.5 s with the ring's own settings (easeInOut, 0.6 s).
 * Script A keeps a red "hot" dot in every frame and hides it with opacity 0: every step glides.
 * Script B adds the dot only at 80% and above: 72 → 88 and 88 → 35 cross-fade.
 * The ring's numbers are the CPU-ring recipe's awk (widget_template.zsh frame()); the verdicts are the app's
 * engine's (svgdiff), pinned by the node test in the docs' scratch folder.
 *
 * mount(el, { mode, reducedMotion }) → { destroy() }
 * Test switches (face-player.js readSwitches): data-at / ?dt-at=<s>, data-view / ?dt-view=story, ?dt-motion=reduce.
 */
import {
  FaceModel, Loop, frame, hexToRgb, rgb, makeCell, svgEl, replay, readSwitches, watchReducedMotion,
} from '../face-player.js';
import { ensureChrome, h, makeFigure, makeButton, makeSegmented, makeLegend, setChip } from '../dt-chrome.js';

export const RING_C = 2 * 3.14159265 * 78;          // as the recipe's awk: 2 × π × r
const RING_DASH = RING_C.toFixed(2);
export const PERIOD = 2.5;
export const DURATION = 0.6;
export const SEQUENCE = [35, 72, 88];
const STORY_SAMPLES = [0, 0.15, 0.3, 0.45, 0.6];
const STORY_STEPS = [[72, 88], [88, 35]];

const SCRIPTS = {
  A: { label: 'Script A', title: 'The dot is in every frame', note: 'hidden with <code>opacity="0"</code> below 80%' },
  B: { label: 'Script B', title: 'The dot is added at 80%', note: 'left out of the frame below 80%' },
};

/** One frame of script A or B at `pct`, as the script sends it. */
export function ringFrame(pct, script) {
  const color = pct < 50 ? '#34C759' : pct < 80 ? '#FF9F0A' : '#FF453A';
  const hot = pct >= 80;
  const elements = ['track', 'ring'];
  if (script === 'A' || hot) elements.push('hot');
  elements.push('value', 'label');
  const [r, g, b] = hexToRgb(color);
  const offset = +(RING_C * (1 - pct / 100)).toFixed(2);
  return frame(elements, { offset, r, g, b, hot: script === 'A' ? (hot ? 1 : 0) : 1 }, { value: String(pct) },
    { pct, color, script, hotShown: hot });
}

/** The agent's crossFade wording for the step from prev to next (the first difference). */
export function crossFadeDifference(prev, next) {
  return next.elements.length > prev.elements.length
    ? `element 3 (#hot, a circle) is new: ${prev.elements.length} elements → ${next.elements.length}`
    : `element 3 (#hot, a circle) of the previous frame is gone: ${prev.elements.length} elements → ${next.elements.length}`;
}

// ─── Drawing ─────────────────────────────────────────────────────────────────────────────────────────────────

/** A tree for one structure, in the recipe's drawing order (texts last: the phone draws text above shapes). */
function treeMaker(host) {
  return f => {
    const root = svgEl('g', {}, host);
    svgEl('circle', { cx: 100, cy: 100, r: 78, fill: 'none', stroke: '#FFFFFF', 'stroke-opacity': 0.15,
      'stroke-width': 16 }, root);
    const ring = svgEl('circle', { cx: 100, cy: 100, r: 78, fill: 'none', 'stroke-width': 16, 'stroke-linecap': 'round',
      'stroke-dasharray': `${RING_DASH} ${RING_DASH}`, transform: 'rotate(-90 100 100)' }, root);
    const hot = f.elements.includes('hot') ? svgEl('circle', { cx: 100, cy: 54, r: 7, fill: '#FF453A' }, root) : null;
    const value = svgEl('text', { x: 100, y: 116, 'font-size': 56, 'font-weight': 'bold', 'text-anchor': 'middle',
      fill: '#FFFFFF' }, root);
    const label = svgEl('text', { x: 100, y: 146, 'font-size': 28, 'text-anchor': 'middle', fill: '#FFFFFF',
      'fill-opacity': 0.6 }, root);
    label.textContent = 'cpu %';
    return { root, ring, hot, value };
  };
}

function draw(model, t) {
  for (const { tree, values: v, texts, opacity } of model.stateAt(t)) {
    tree.root.setAttribute('opacity', opacity.toFixed(4));
    tree.ring.setAttribute('stroke', rgb(v.r, v.g, v.b));
    tree.ring.setAttribute('stroke-dashoffset', v.offset.toFixed(2));
    if (tree.hot) tree.hot.setAttribute('opacity', v.hot.toFixed(4));
    if (tree.value.textContent !== texts.value) tree.value.textContent = texts.value;
  }
}

const newModel = host => new FaceModel({ makeTree: treeMaker(host), dropTree: tree => tree.root.remove() });

// ─── What the script sent, with the changes marked ───────────────────────────────────────────────────────────

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const mark = (on, cls, text) => (on ? `<span class="${cls}">${esc(text)}</span>` : esc(text));

function sourceHTML(f, prev) {
  const both = k => prev && prev.elements.includes(k) && f.elements.includes(k);
  const rows = [];
  const row = (cls, html) => rows.push(`<span class="dt-row${cls ? ' ' + cls : ''}">${html}</span>`);
  row('', `<span class="tag">&lt;circle id='track'</span> … /&gt;`);
  row('', `<span class="tag">&lt;circle id='ring'</span> stroke='${mark(both('ring') && prev.color !== f.color, 'num', f.color)}'`);
  row('', `    stroke-dashoffset='${mark(both('ring') && prev.nums.offset !== f.nums.offset, 'num', f.nums.offset.toFixed(2))}' … /&gt;`);
  const here = f.elements.includes('hot'), before = prev && prev.elements.includes('hot');
  if (here && f.script === 'A') {
    row('', `<span class="tag">&lt;circle id='hot'</span> opacity='${mark(both('hot') && prev.nums.hot !== f.nums.hot, 'num', String(f.nums.hot))}' … /&gt;`);
  } else if (here) {
    row(prev && !before ? 'add' : '', `${prev && !before ? '+ ' : ''}&lt;circle id='hot' … /&gt;`);
  } else if (before) {
    row('del', `− &lt;circle id='hot' … /&gt;`);
  }
  row('', `<span class="tag">&lt;text id='value'</span> …&gt;${mark(prev && prev.texts.value !== f.texts.value, 'str', f.texts.value)}&lt;/text&gt;`);
  row('', `<span class="tag">&lt;text id='label'</span> …&gt;cpu %&lt;/text&gt;`);
  return rows.join('');
}

// ─── The diagram ─────────────────────────────────────────────────────────────────────────────────────────────

export default function mount(el, { reducedMotion = false } = {}) {
  ensureChrome();
  const sw = readSwitches(el, { reducedMotion });
  let reduce = sw.reduced;
  const original = [...el.childNodes];

  const { figure, controls, body, legend, caption, announce } = makeFigure({
    name: 'glide-vs-crossfade',
    eyebrow: 'How the phone changes a face',
    title: 'Same elements glide. A new element cross-fades.',
    lede: 'Two CPU-ring scripts send the same values (35, 72 and 88%) with the same settings. ' +
      'They differ in one line: where the red “hot” dot comes from.',
  });

  // Panes: one phone cell per script, with its verdict and the frame it sent.
  const panesEl = h('div', { class: 'dt-panes' });
  const storyEl = h('div', { class: 'dt-story', hidden: '' });
  body.append(panesEl, storyEl);
  const panes = ['A', 'B'].map(key => {
    const s = SCRIPTS[key];
    const cell = makeCell({ unit: 160 });
    const chip = h('span', { class: 'dt-chip' });
    const phase = h('span', { class: 'dt-phase' });
    const fill = h('span');
    const bar = h('div', { class: 'dt-bar' }, fill);
    const reason = h('p', { class: 'dt-reason' });
    const source = h('div', { class: 'dt-code', attrs: { role: 'group', 'aria-label': `The frame ${s.label} sent` } });
    panesEl.appendChild(h('section', { class: 'dt-pane', attrs: { 'aria-label': `${s.label}: ${s.title}` } },
      h('div', { class: 'dt-pane-label', text: s.label }),
      h('p', { class: 'dt-pane-title', text: s.title }),
      h('p', { class: 'dt-pane-note', html: s.note }),
      h('div', { class: 'dt-cellwrap' }, cell.svg),
      h('div', { class: 'dt-status' }, h('div', { class: 'dt-chiprow' }, chip, phase), bar, reason),
      source));
    return { key, cell, model: newModel(cell.host), prev: null, chip, phase, bar, fill, reason, source };
  });

  function describe(pane, result, f, prev) {
    pane.bar.className = 'dt-bar';
    if (result.kind === 'first') {
      setChip(pane.chip, '', 'First frame');
      pane.reason.textContent = 'Shown at once. The next frames change it.';
    } else if (result.kind === 'fade') {
      setChip(pane.chip, 'fade', 'Cross-fade');
      pane.bar.classList.add('fade');
      pane.reason.innerHTML = `The agent’s answer carries <code>crossFade</code>: “First difference: ${esc(crossFadeDifference(prev, f))}.”`;
    } else if (result.kind === 'instant') {
      setChip(pane.chip, '', 'At once');
      pane.reason.innerHTML = 'Reduce Motion is on, so this diagram shows each frame at once, as the phone does with ' +
        '<code>duration</code> 0. The storyboard shows the motion.';
    } else {
      setChip(pane.chip, 'glide', 'Glide');
      pane.bar.classList.add('glide');
      pane.reason.innerHTML = f.script === 'A' && prev.nums.hot !== f.nums.hot
        ? `Same elements: the ring, its color and the dot’s <code>opacity</code> glide together; “${esc(f.texts.value)}” is already there.`
        : `Same elements, new numbers: the ring and its color glide; the text “${esc(f.texts.value)}” swaps at once.`;
    }
    pane.source.innerHTML = sourceHTML(f, prev);
    pane.cell.setLabel(`CPU ring at ${f.pct}%${f.hotShown ? ' with the red dot' : ''}`);
  }

  // Clock and autoplay.
  let playing = false, k = 0, nextAt = PERIOD, view = 'live';
  const frozen = sw.at !== null;

  function send(index, t, spoken) {
    const pct = SEQUENCE[index % SEQUENCE.length];
    const notes = [];
    for (const pane of panes) {
      const f = ringFrame(pct, pane.key);
      const result = pane.model.apply(f, t, reduce ? 0 : DURATION, 'easeInOut');
      describe(pane, result, f, pane.prev);
      pane.prev = f;
      notes.push(`${SCRIPTS[pane.key].label}: ${result.kind === 'fade' ? 'cross-fade' : result.kind === 'glide' ? 'glide' : 'shown at once'}`);
    }
    if (spoken) announce(`Frame ${pct}%. ${notes.join('. ')}.`);
  }

  function render(time) {
    for (const pane of panes) {
      draw(pane.model, time);
      const m = pane.model.motionAt(time);
      pane.fill.style.width = `${(m.p * 100).toFixed(1)}%`;
      pane.phase.textContent = !m.kind ? 'resting'
        : `${m.kind === 'fade' ? 'fading in' : 'gliding'} · ${m.elapsed.toFixed(2)} / ${m.dur} s`;
    }
  }

  const loop = new Loop({
    root: figure,
    onFrame(time) {
      if (playing) while (time >= nextAt) { k += 1; send(k, nextAt, false); nextAt += PERIOD; }
      render(time);
      return playing || panes.some(p => p.model.busyAt(time));
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

  // Storyboard: the two steps that differ, at five moments of the 0.6 s.
  function buildStoryboard() {
    for (const key of ['A', 'B']) {
      const box = h('section', { class: 'dt-story-pane', attrs: { 'aria-label': `${SCRIPTS[key].label}: ${SCRIPTS[key].title}` } },
        h('div', { class: 'dt-pane-label', text: SCRIPTS[key].label }),
        h('p', { class: 'dt-pane-title', text: SCRIPTS[key].title }));
      for (const [from, to] of STORY_STEPS) {
        const a = ringFrame(from, key), b = ringFrame(to, key);
        const fades = a.sig !== b.sig;
        const head = h('div', { class: 'dt-story-head' },
          h('span', { class: `dt-chip ${fades ? 'fade' : 'glide'}`, text: fades ? 'Cross-fade' : 'Glide' }),
          `${from} → ${to}%, the frame arrives at 0 s`);
        const strip = h('div', { class: 'dt-strip' });
        for (const s of STORY_SAMPLES) {
          const cell = makeCell({ unit: 160,
            label: `${from} to ${to}%, ${s.toFixed(2)} s into the ${fades ? 'cross-fade' : 'glide'}` });
          const model = replay(newModel(cell.host), [[a, 0, 0], [b, 1, DURATION, 'easeInOut']]);
          draw(model, 1 + s);
          strip.appendChild(h('figure', {}, cell.svg, h('figcaption', { text: s === 0 ? '0 s' : `${s.toFixed(2)} s` })));
        }
        box.appendChild(h('div', { class: 'dt-story-row' }, head, strip));
      }
      storyEl.appendChild(box);
    }
  }

  function setView(next) {
    view = next === 'story' ? 'story' : 'live';
    if (view === 'story' && !storyEl.childElementCount) buildStoryboard();
    storyEl.hidden = view !== 'story';
    panesEl.hidden = view === 'story';
    viewSeg.set(view);
  }

  // Legend and caption: the rule first, then what you see, then the fix.
  makeLegend([
    { swatch: 'glide', text: 'Number or color changed: glides' },
    { swatch: 'text', text: 'Text changed: swaps at once' },
    { swatch: 'fade', text: 'Element added or removed: cross-fade' },
  ], legend);
  caption.innerHTML =
    '<strong>Keep the same elements, in the same order, in every frame, and change only numbers, colors and text.</strong> ' +
    'Then every new frame glides. Add or remove an element and the face cross-fades instead: for a moment you see ' +
    'both frames, two numbers on top of each other or the old ring under the new one. To hide something, keep it in ' +
    'the frame and set <code>opacity="0"</code>.' +
    '<p class="dt-note">Both scripts use the CPU ring’s settings, <code>easeInOut</code> over 0.6 s. ' +
    'Frames follow the phone’s rules for a glide and a cross-fade.</p>';

  el.replaceChildren(figure);

  // Start.
  send(0, 0, false);
  if (frozen) {
    // A still for checks: the diagram sw.at seconds into autoplay.
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
