/*
 * D2 · The round trip.
 *   simple  Get started: tap → the agent runs the Hello script on the Mac → the update changes the button →
 *           3 s later "reset" brings the saved look back (the page's own script, step by step).
 *   full    Live widgets › The live look, Script API › Answers: one update of the free-disk widget and what the
 *           agent answers: on screen (200), hidden (200 "visible": false, held, shown at once when the button is
 *           on screen), phone not reading (200 "dropped": true, held, slow down), refused (400 with the reason,
 *           checked even with no phone; the phone's ⚠ count and Errors list it) and no phone (503).
 * The answers, the order of the agent's checks and the alert-free outcomes follow the agent's update-button handler
 * (MCPHTTPServer.handleUpdateButtonRequest); the node test in the docs' scratch folder pins the texts.
 * Plain faces follow the app's DeckButton: glass card, icon in the button's Color, label in white 0.7, the Color as a
 * faint tint; a new title rolls into place, a held one appears at once.
 *
 * mount(el, { mode, reducedMotion }) → { destroy() }
 * Test switches (face-player.js readSwitches): data-at / ?dt-at=<s>, data-view / ?dt-view=story, ?dt-motion=reduce.
 */
import { Loop, makeCell, svgEl, rgb, hexToRgb, readSwitches, watchReducedMotion, clamp01, EASE } from '../face-player.js';
import { ensureStyle, h, uid, makeFigure, makeButton, makeSegmented, makeLegend, setChip } from '../dt-chrome.js';

// ─── Facts the diagram shows (the node test checks them) ────────────────────────────────────────────────────────

/** The agent's answers, verbatim. Key order varies on the wire; these are the shapes the docs print. */
export const ANSWERS = Object.freeze({
  ok: '{"status":"ok"}',
  hidden: '{"status":"ok","visible":false}',
  dropped: '{"status":"ok","dropped":true}',
  badColor: '{"status":"error","message":"Invalid color format. Expected #RRGGBB."}',
  noPhone: '{"status":"error","message":"No device connected"}',
});

/** The agent's checks in the order it makes them; a failed one decides the answer. */
export const CHECKS = Object.freeze([
  { id: 'valid', text: 'The update is valid', fail: '400: refused, with the reason' },
  { id: 'phone', text: 'A phone is connected', fail: '503: no phone' },
  { id: 'shown', text: 'The button is on screen', fail: 'kept on the Mac: "visible": false' },
  { id: 'reading', text: 'The phone is reading', fail: 'kept on the Mac: "dropped": true' },
]);

export const BLUE = '#3478F6';       // a new button's Color
export const GREEN = '#30D158';      // the Hello script's color
const ORANGE = '#FF9F0A';
/** exclamationmark.triangle.fill in a 20 × 18 box, the "!" cut out (as in script-lifecycle.js). */
const WARN_D = 'M 8.80 2.98 Q 10 0.9 11.20 2.98 L 18.20 15.12 Q 19.4 17.2 17.00 17.20 L 3.00 17.20 Q 0.6 17.2 1.80 15.12 Z' +
  ' M 8.85 6.7 A 1.15 1.15 0 0 1 11.15 6.7 L 10.85 11.4 A 0.85 0.85 0 0 1 9.15 11.4 Z' +
  ' M 8.7 14.2 A 1.3 1.3 0 1 0 11.3 14.2 A 1.3 1.3 0 1 0 8.7 14.2 Z';

// ─── Plain faces (shared with script-lifecycle.js) ──────────────────────────────────────────────────────────────

const ICONS = {
  terminal(g, c) {
    svgEl('rect', { x: -30, y: -23, width: 60, height: 46, rx: 9, fill: 'none', stroke: c, 'stroke-width': 5 }, g);
    svgEl('path', { d: 'M -17 -9 L -6 0 L -17 9 M 0 11 L 15 11', fill: 'none', stroke: c, 'stroke-width': 5,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
  },
  'internaldrive.fill'(g, c) {
    svgEl('path', { d: 'M -22 -20 L 22 -20 Q 26 -20 27.5 -16 L 31 -4 L -31 -4 L -27.5 -16 Q -26 -20 -22 -20 Z', fill: c }, g);
    svgEl('rect', { x: -32, y: -1, width: 64, height: 24, rx: 6, fill: c }, g);
    svgEl('circle', { cx: 21, cy: 11, r: 3.6, fill: '#0D0D0D', 'fill-opacity': 0.55 }, g);
    svgEl('rect', { x: -22, y: 9, width: 24, height: 4, rx: 2, fill: '#0D0D0D', 'fill-opacity': 0.55 }, g);
  },
  'circle.dashed'(g, c) {
    svgEl('circle', { r: 26, fill: 'none', stroke: c, 'stroke-width': 5, 'stroke-dasharray': '9.2 7.1',
      'stroke-linecap': 'round' }, g);
  },
  clock(g, c) {
    svgEl('circle', { r: 27, fill: 'none', stroke: c, 'stroke-width': 5 }, g);
    svgEl('path', { d: 'M 0 -15 L 0 0 L 11 7', fill: 'none', stroke: c, 'stroke-width': 5, 'stroke-linecap': 'round',
      'stroke-linejoin': 'round' }, g);
  },
  'music.note'(g, c) {
    svgEl('ellipse', { cx: -9, cy: 17, rx: 12, ry: 9.5, fill: c, transform: 'rotate(-18 -9 17)' }, g);
    svgEl('path', { d: 'M 1.5 15 L 1.5 -27 L 21 -20 L 21 -9 L 6 -14', fill: c }, g);
  },
  'speaker.wave.2.fill'(g, c) {
    svgEl('path', { d: 'M -30 -9 L -18 -9 L -3 -23 L -3 23 L -18 9 L -30 9 Z', fill: c, 'stroke-linejoin': 'round' }, g);
    svgEl('path', { d: 'M 7 -10 Q 13 0 7 10 M 16 -19 Q 28 0 16 19', fill: 'none', stroke: c, 'stroke-width': 5,
      'stroke-linecap': 'round' }, g);
  },
  'lock.fill'(g, c) {
    svgEl('path', { d: 'M -14 -6 L -14 -15 A 14 14 0 0 1 14 -15 L 14 -6', fill: 'none', stroke: c, 'stroke-width': 5 }, g);
    svgEl('rect', { x: -22, y: -7, width: 44, height: 33, rx: 6, fill: c }, g);
  },
};

const mixHex = (a, b, k) => {
  const x = hexToRgb(a), y = hexToRgb(b);
  return rgb(x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k);
};

/**
 * A plain face (name, icon or emoji, Color) in a 200 × 200 face box, laid out like the app's DeckButton at the iPhone
 * size (1 pt = 2.5 units): icon 28 pt, label 11 pt bold in white 0.7, 6 pt apart, the Color as a faint tint.
 * render({ label, icon, emoji, color, from }) where from = { label, color, k } is the look it is rolling away from
 * (k 0 → 1); without `from` the look is shown at once.
 */
export function plainFace(parent) {
  const root = svgEl('g', {}, parent);
  const tint = svgEl('rect', { width: 200, height: 200, 'fill-opacity': 0.075 }, root);
  const iconG = svgEl('g', { transform: 'translate(100 76)' }, root);
  const emojiT = svgEl('text', { x: 100, y: 80, 'font-size': 76, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, root);
  const lab = [0, 1].map(() => svgEl('text', { x: 100, y: 150, 'font-size': 27.5, 'font-weight': 700,
    'text-anchor': 'middle', fill: '#FFFFFF', 'fill-opacity': 0.7 }, root));
  let drawn = { icon: null, color: null, emoji: null };
  const cache = new Map();
  const set = (el, k, v) => { const key = el; const m = cache.get(key) || {}; if (m[k] !== v) { m[k] = v; cache.set(key, m); el.setAttribute(k, v); } };
  const text = (el, s) => { if (el.textContent !== s) el.textContent = s; };
  return {
    root,
    render({ label = '', icon = null, emoji = null, color = BLUE, from = null }) {
      const k = from ? EASE.easeInOut(clamp01(from.k)) : 1;
      const c = from && from.color && from.color !== color ? mixHex(from.color, color, k) : color;
      set(tint, 'fill', c);
      if (emoji) {
        text(emojiT, emoji);
        set(emojiT, 'opacity', '1');
        if (drawn.icon !== null) { iconG.replaceChildren(); drawn.icon = null; }
      } else {
        set(emojiT, 'opacity', '0');
        if (drawn.icon !== icon || drawn.color !== c) {
          iconG.replaceChildren();
          if (icon && ICONS[icon]) ICONS[icon](iconG, c);
          drawn = { icon, color: c };
        }
      }
      const rolling = from && from.label !== undefined && from.label !== label && k < 1;
      text(lab[0], label);
      set(lab[0], 'transform', rolling ? `translate(0 ${(14 * (1 - k)).toFixed(2)})` : 'translate(0 0)');
      set(lab[0], 'fill-opacity', rolling ? (0.7 * k).toFixed(3) : '0.7');
      text(lab[1], rolling ? from.label : '');
      set(lab[1], 'transform', rolling ? `translate(0 ${(-14 * k).toFixed(2)})` : 'translate(0 0)');
      set(lab[1], 'fill-opacity', rolling ? (0.7 * (1 - k)).toFixed(3) : '0');
    },
  };
}

/** A glass button of `size` pt at (x, y) inside an SVG, with a plain face. Returns { g, face, rect }. */
export function glassButton(parent, defs, x, y, size = 80) {
  const id = uid('rtg');
  const r = +(0.2237 * size).toFixed(2);
  svgEl('rect', { x, y, width: size, height: size, rx: r }, svgEl('clipPath', { id }, defs));
  const g = svgEl('g', {}, parent);
  svgEl('rect', { x, y, width: size, height: size, rx: r, fill: '#FFFFFF', 'fill-opacity': 0.08 }, g);
  const inner = svgEl('g', { 'clip-path': `url(#${id})` }, g);
  const faceG = svgEl('g', { transform: `translate(${x} ${y}) scale(${size / 200})` }, inner);
  svgEl('rect', { x: x + 0.4, y: y + 0.4, width: size - 0.8, height: size - 0.8, rx: r - 0.4, fill: 'none',
    stroke: `url(#${rimGradient(defs)})`, 'stroke-width': 0.8 }, g);
  return { g, face: plainFace(faceG), clipId: id };
}

function rimGradient(defs) {
  if (defs.__rim) return defs.__rim;
  const id = uid('rtrim');
  const lg = svgEl('linearGradient', { id, x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
  [['0', '0.18'], ['0.5', '0.06'], ['1', '0']].forEach(([o, a]) =>
    svgEl('stop', { offset: o, 'stop-color': '#FFFFFF', 'stop-opacity': a }, lg));
  defs.__rim = id;
  return id;
}

/** A big phone cell (face-player makeCell) with a plain face and the light that circles the border while a
 * tap script runs. Returns { cell, face, pulse(on, t, color) }. */
export function plainCell({ unit = 150, label = '' } = {}) {
  const cell = makeCell({ unit, label });
  const face = plainFace(cell.host);
  const pad = Math.round(unit * 0.09), R = +(0.2237 * unit).toFixed(2);
  const perim = 4 * (unit - 2 * R) + 2 * Math.PI * R;
  const light = svgEl('rect', { x: pad + 1.2, y: pad + 1.2, width: unit - 2.4, height: unit - 2.4, rx: R - 1.2,
    fill: 'none', 'stroke-width': 2.4, 'stroke-linecap': 'round', opacity: 0,
    'stroke-dasharray': `${(perim * 0.22).toFixed(1)} ${(perim * 0.78).toFixed(1)}` }, cell.svg);
  let lightOn = null;
  return {
    cell, face, pad, unit,
    pulse(on, t, color) {
      const v = on ? '1' : '0';
      if (lightOn !== v) { light.setAttribute('opacity', v); lightOn = v; }
      if (on) {
        light.setAttribute('stroke', color);
        light.setAttribute('stroke-dashoffset', (-(t % 1.4) / 1.4 * perim).toFixed(1));
      }
    },
  };
}

// ─── Shared helpers ─────────────────────────────────────────────────────────────────────────────────────────────

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** An answer as HTML that wraps after its commas, never inside a key. */
const answerHTML = s => esc(s).replace(/,/g, ',<wbr>');
const between = (t, a, b) => t >= a && t < b;
const TRAVEL = 0.7;     // how long a packet takes along one lane, in diagram seconds
const CHECK = 0.24;     // one check of the agent lighting up

const CSS = `
.dt-diagram .rt-stage { display: grid; align-items: stretch; gap: 0; }
.dt-diagram .rt-stage.simple { grid-template-columns: minmax(0, 0.9fr) minmax(88px, 0.55fr) minmax(0, 1.25fr); }
.dt-diagram .rt-stage.full { grid-template-columns: minmax(0, 1.12fr) 42px minmax(0, 1fr) 42px minmax(0, 1fr); }
.dt-diagram .rt-node {
  min-width: 0; border: 1px solid var(--dt-border); border-radius: 12px; padding: 12px 12px 11px;
  background: var(--dt-panel); display: flex; flex-direction: column; gap: 8px;
  transition: border-color .25s, box-shadow .25s;
}
.dt-diagram .rt-node.hot { border-color: color-mix(in srgb, var(--dt-accent) 45%, transparent);
  box-shadow: 0 0 0 3px var(--dt-accent-subtle); }
.dt-diagram .rt-node.hot-warn { border-color: color-mix(in srgb, var(--dt-warn) 45%, transparent);
  box-shadow: 0 0 0 3px var(--dt-warn-subtle); }
.dt-diagram .rt-node-head { display: flex; flex-direction: column; gap: 1px; }
.dt-diagram .rt-sub { font-family: var(--dt-mono); font-size: 0.625rem; letter-spacing: 0.04em; color: var(--dt-muted); }
.dt-diagram .rt-node .dt-code { margin: 0; white-space: pre; }
.dt-diagram .rt-stage.full .rt-node .dt-code { font-size: 0.625rem; padding: 8px 8px; }
.dt-diagram .rt-node .dt-code .dt-row.on { color: var(--dt-ink); background: var(--dt-accent-subtle); }
.dt-diagram .rt-node .dt-code .dt-row.bad .val { color: var(--dt-warn); font-weight: 600; }
.dt-diagram .rt-node .dt-code .cellid { color: var(--dt-accent); }
.dt-diagram .rt-node .dt-code .cellid.lit { background: var(--dt-accent-subtle); border-radius: 3px; box-shadow: 0 0 0 2px var(--dt-accent-subtle); }
.dt-diagram .rt-answer {
  font-family: var(--dt-mono); font-size: 0.6875rem; line-height: 1.55; border-radius: 8px; padding: 7px 9px;
  border: 1px dashed var(--dt-border-strong); color: var(--dt-muted); min-height: 3.6em;
  white-space: normal; overflow-wrap: break-word;
}
.dt-diagram .rt-answer b { font-weight: 700; margin-right: 6px; }
.dt-diagram .rt-answer.ok { border-style: solid; border-color: color-mix(in srgb, var(--dt-ok) 40%, transparent); background: var(--dt-ok-subtle); color: var(--dt-ink); }
.dt-diagram .rt-answer.ok b { color: var(--dt-ok); }
.dt-diagram .rt-answer.err { border-style: solid; border-color: color-mix(in srgb, var(--dt-warn) 40%, transparent); background: var(--dt-warn-subtle); color: var(--dt-ink); }
.dt-diagram .rt-answer.err b { color: var(--dt-warn); }
.dt-diagram .rt-next { font-size: 0.75rem; line-height: 1.5; min-height: 3em; }
.dt-diagram .dt-btn:disabled { opacity: 0.4; cursor: default; }
.dt-diagram .rt-checks { display: grid; gap: 5px; }
.dt-diagram .rt-check {
  display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 7px; align-items: start;
  font-size: 0.75rem; line-height: 1.35; color: var(--dt-muted);
}
.dt-diagram .rt-check i {
  font-style: normal; width: 16px; height: 16px; border-radius: 50%; border: 1px solid var(--dt-border-strong);
  display: inline-flex; align-items: center; justify-content: center; font-size: 0.625rem; font-weight: 700;
  margin-top: 1px; color: transparent;
}
.dt-diagram .rt-check.pass { color: var(--dt-body); }
.dt-diagram .rt-check.pass i { border-color: var(--dt-ok); color: var(--dt-ok); background: var(--dt-ok-subtle); }
.dt-diagram .rt-check.fail { color: var(--dt-ink); }
.dt-diagram .rt-check.fail i { border-color: var(--dt-warn); color: var(--dt-warn); background: var(--dt-warn-subtle); }
.dt-diagram .rt-check.skip { opacity: 0.45; }
.dt-diagram .rt-check small { display: block; font-family: var(--dt-mono); font-size: 0.625rem; color: var(--dt-warn); margin-top: 1px; }
.dt-diagram .rt-tray {
  border: 1px solid var(--dt-border); border-radius: 8px; padding: 7px 9px; display: grid; gap: 4px;
}
.dt-diagram .rt-tray-head { font-family: var(--dt-mono); font-size: 0.5625rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--dt-muted); }
.dt-diagram .rt-tray-body { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; min-height: 22px; font-size: 0.75rem; color: var(--dt-muted); }
.dt-diagram .rt-look {
  font-family: var(--dt-mono); font-size: 0.6875rem; padding: 2px 7px; border-radius: 5px; color: var(--dt-ink);
  background: var(--dt-accent-subtle); border: 1px solid color-mix(in srgb, var(--dt-accent) 35%, transparent);
}
.dt-diagram .rt-look.gone { text-decoration: line-through; color: var(--dt-muted); background: transparent; border-color: var(--dt-border); }
.dt-diagram .rt-note { font-size: 0.75rem; line-height: 1.5; color: var(--dt-body); min-height: 3em; }
.dt-diagram .rt-phone-wrap { display: flex; justify-content: center; }
.dt-diagram .rt-phone-svg { display: block; width: 100%; max-width: 230px; height: auto; }
.dt-diagram .rt-phone-svg text { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif; }
.dt-diagram .rt-big { display: flex; justify-content: center; padding: 6px 0 2px; cursor: pointer; }
.dt-diagram .rt-big .dt-cell { width: min(168px, 100%); transition: transform .12s; }
.dt-diagram .rt-big.pressed .dt-cell { transform: scale(0.95); }

.dt-diagram .rt-lane { position: relative; min-height: 40px; }
.dt-diagram .rt-wire { position: absolute; left: 6px; right: 6px; top: 50%; border-top: 1px dashed var(--dt-border-strong); }
.dt-diagram .rt-lane.off .rt-wire { opacity: 0.35; }
.dt-diagram .rt-packet {
  position: absolute; top: 50%; left: calc(6px + var(--p, 0) * (100% - 12px));
  transform: translate(calc(var(--p, 0) * -100%), -50%); opacity: 0; pointer-events: none;
  font-family: var(--dt-mono); font-size: 0.5625rem; font-weight: 700; letter-spacing: 0.04em; line-height: 1;
  white-space: nowrap;
}
.dt-diagram .rt-packet.dot { width: 12px; height: 12px; border-radius: 50%; background: var(--dt-accent);
  box-shadow: 0 0 0 4px var(--dt-accent-subtle), 0 0 14px color-mix(in srgb, var(--dt-accent) 60%, transparent); }
.dt-diagram .rt-packet.pill { padding: 4px 6px; border-radius: 999px; color: #FFFFFF; background: var(--dt-accent); }
.dt-diagram .rt-packet.pill.ok { background: color-mix(in srgb, var(--dt-ok) 85%, #000); }
.dt-diagram .rt-packet.pill.err { background: color-mix(in srgb, var(--dt-warn) 85%, #000); color: #111; }
.dt-diagram .rt-stage.full .rt-packet.back { top: calc(50% + 15px); }
.dt-diagram .rt-stage.full .rt-packet.out { top: calc(50% - 1px); }
.dt-diagram .rt-stage.simple .rt-packet.out { top: calc(50% - 16px); }
.dt-diagram .rt-stage.simple .rt-packet.back { top: calc(50% + 16px); }
.dt-diagram .rt-lane-label {
  position: absolute; left: 0; right: 0; text-align: center; font-family: var(--dt-mono); font-size: 0.5625rem;
  letter-spacing: 0.08em; text-transform: uppercase; color: var(--dt-muted);
}
.dt-diagram .rt-lane-label.top { top: calc(50% - 40px); }
.dt-diagram .rt-lane-label.bottom { top: calc(50% + 30px); }
.dt-diagram .rt-lane-label.top::after { content: ' →'; }
.dt-diagram .rt-lane-label.bottom::before { content: '← '; }

.dt-diagram .rt-steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 14px; padding: 0; list-style: none; counter-reset: rt; }
.dt-diagram .rt-steps li {
  counter-increment: rt; border-top: 2px solid var(--dt-border-strong); padding-top: 7px; font-size: 0.75rem; line-height: 1.45;
  color: var(--dt-muted); transition: color .2s, border-color .2s;
}
.dt-diagram .rt-steps li::before { content: counter(rt); font-family: var(--dt-mono); font-size: 0.625rem; font-weight: 700; margin-right: 6px; color: var(--dt-muted); }
.dt-diagram .rt-steps li.on { color: var(--dt-ink); border-color: var(--dt-accent); }
.dt-diagram .rt-steps li.on::before { color: var(--dt-accent); }
.dt-diagram .rt-steps li.done { border-color: color-mix(in srgb, var(--dt-accent) 40%, transparent); }

.dt-diagram .rt-picker { display: flex; flex-wrap: wrap; gap: 6px; }
.dt-diagram .rt-picker button {
  font: inherit; font-size: 0.75rem; color: var(--dt-body); background: transparent; cursor: pointer; margin: 0;
  border: 1px solid var(--dt-border-strong); border-radius: 999px; padding: 5px 11px 5px 6px; min-height: 32px;
  display: inline-flex; align-items: center; gap: 7px; line-height: 1.2;
}
.dt-diagram .rt-picker button b {
  font-family: var(--dt-mono); font-size: 0.625rem; padding: 3px 6px; border-radius: 999px;
  color: var(--dt-ok); background: var(--dt-ok-subtle);
}
.dt-diagram .rt-picker button b.err { color: var(--dt-warn); background: var(--dt-warn-subtle); }
.dt-diagram .rt-picker button[aria-pressed="true"] { color: var(--dt-ink); border-color: var(--dt-muted); background: var(--dt-panel); }
.dt-diagram .rt-pickrow { margin: -6px 0 16px; }

.dt-diagram .rt-story { display: grid; gap: 10px; }
.dt-diagram .rt-story-row {
  display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.3fr) minmax(0, 1.2fr); gap: 12px;
  border: 1px solid var(--dt-border); border-radius: 12px; padding: 12px; align-items: start;
}
.dt-diagram .rt-story-row .dt-pane-title { margin: 6px 0 0; }
.dt-diagram .rt-story-row p { font-size: 0.75rem; line-height: 1.5; }
.dt-diagram .rt-story-row p + p { margin-top: 4px; }
.dt-diagram .rt-story-row .rt-k { font-family: var(--dt-mono); font-size: 0.5625rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--dt-muted); display: block; }
.dt-diagram .rt-strip4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.dt-diagram .rt-strip4 figure { text-align: center; min-width: 0; }
.dt-diagram .rt-strip4 .dt-cell { width: 100%; max-width: 128px; margin: 0 auto; }
.dt-diagram .rt-strip4 figcaption { font-size: 0.75rem; line-height: 1.45; margin-top: 6px; }
.dt-diagram .rt-strip4 figcaption b { font-family: var(--dt-mono); font-size: 0.625rem; color: var(--dt-accent); margin-right: 5px; }

@container dt (max-width: 560px) {
  .dt-diagram .rt-stage.simple, .dt-diagram .rt-stage.full { grid-template-columns: minmax(0, 1fr); }
  .dt-diagram .rt-lane { min-height: 52px; }
  .dt-diagram .rt-wire { left: 50%; right: auto; top: 6px; bottom: 6px; border-top: 0; border-left: 1px dashed var(--dt-border-strong); }
  .dt-diagram .rt-packet { left: 50%; top: calc(6px + var(--p, 0) * (100% - 12px));
    transform: translate(-50%, calc(var(--p, 0) * -100%)); }
  .dt-diagram .rt-stage.full .rt-packet.out, .dt-diagram .rt-stage.simple .rt-packet.out { top: calc(6px + var(--p, 0) * (100% - 12px)); left: calc(50% - 22px); }
  .dt-diagram .rt-stage.full .rt-packet.back, .dt-diagram .rt-stage.simple .rt-packet.back { top: calc(6px + var(--p, 0) * (100% - 12px)); left: calc(50% + 22px); }
  .dt-diagram .rt-lane-label.top { top: 50%; left: auto; right: calc(50% + 62px); transform: translateY(-50%); text-align: right; }
  .dt-diagram .rt-lane-label.bottom { top: 50%; left: calc(50% + 62px); right: auto; transform: translateY(-50%); text-align: left; }
  .dt-diagram .rt-lane-label.top::after { content: ' ↓'; }
  .dt-diagram .rt-lane-label.bottom::before { content: '↑ '; }
  .dt-diagram .rt-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dt-diagram .rt-story-row { grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .dt-diagram .rt-strip4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dt-diagram .rt-phone-svg { max-width: 250px; }
}
`;

/** setAttribute / textContent / class only when the value changed (the loop calls these every frame). */
function writer() {
  const memo = new WeakMap();
  const get = el => { let m = memo.get(el); if (!m) { m = {}; memo.set(el, m); } return m; };
  return {
    attr(el, k, v) { const m = get(el); if (m['a:' + k] !== v) { m['a:' + k] = v; el.setAttribute(k, v); } },
    text(el, s) { if (el.textContent !== s) el.textContent = s; },
    html(el, s) { const m = get(el); if (m.html !== s) { m.html = s; el.innerHTML = s; } },
    cls(el, s) { if (el.className !== s) el.className = s; },
    prop(el, k, v) { const m = get(el); if (m['p:' + k] !== v) { m['p:' + k] = v; el.style.setProperty(k, v); } },
  };
}

function packetAt(w, el, t, start, end, reverse = false) {
  const on = t >= start && t < end + 0.12;
  const p = clamp01((t - start) / (end - start));
  w.attr(el, 'style', `--p:${(reverse ? 1 - EASE.easeInOut(p) : EASE.easeInOut(p)).toFixed(3)};opacity:${on ? 1 : 0}`);
}

// ─── Simple mode: the Hello button ──────────────────────────────────────────────────────────────────────────────

export const HELLO = Object.freeze({
  saved: { label: 'Hello', icon: 'terminal', color: BLUE },
  shown: { label: 'Hello!', emoji: '👋', color: GREEN },
  // diagram seconds of one run: tap, the script starts, the update lands, reset is sent, the saved look is back
  tap: 0.8, start: 1.5, land: 2.4, reset: 5.4, back: 6.1, end: 6.25, period: 9,
});

/** What the Hello run shows at local time t (pure; the storyboard and the node test use it). */
export function helloAt(t) {
  const H = HELLO;
  const look = t >= H.land && t < H.back ? 'shown' : 'saved';
  const changedAt = look === 'shown' ? H.land : t >= H.back ? H.back : -1;
  const step = t < H.tap ? 0 : t < H.start ? 1 : t < H.land ? 2 : t < H.reset ? 3 : 4;
  const line = t >= H.start && t < H.land ? 0 : t >= H.land && t < H.reset ? 1 : t >= H.reset && t < H.end ? 2 : -1;
  return { look, changedAt, step, line, running: t >= H.tap && t < H.end };
}

function mountSimple(ctx) {
  const { body, controls, legend, caption, announce, sw, w } = ctx;
  const stage = h('div', { class: 'rt-stage simple' });
  const story = h('div', { class: 'rt-strip4', hidden: '' });
  const steps = h('ol', { class: 'rt-steps', attrs: { 'aria-label': 'Steps' } });
  body.append(stage, steps, story);

  // The phone.
  const big = plainCell({ unit: 150, label: 'The Hello button' });
  const bigWrap = h('div', { class: 'rt-big', attrs: { role: 'button', tabindex: '0', 'aria-label': 'Tap the Hello button' } }, big.cell.svg);
  const phoneNode = h('section', { class: 'rt-node', attrs: { 'aria-label': 'Your iPhone or iPad' } },
    h('div', { class: 'rt-node-head' }, h('div', { class: 'dt-pane-label', text: 'Your iPhone or iPad' }),
      h('span', { class: 'rt-sub', text: 'the button you tap' })),
    bigWrap);

  // The lane: tap goes to the Mac, updates come back.
  const tapPk = h('span', { class: 'rt-packet dot out' });
  const updPk = h('span', { class: 'rt-packet pill back', text: 'update' });
  const lane = h('div', { class: 'rt-lane', attrs: { 'aria-hidden': 'true' } }, h('span', { class: 'rt-wire' }),
    h('span', { class: 'rt-lane-label top', text: 'tap' }), h('span', { class: 'rt-lane-label bottom', text: 'update' }),
    tapPk, updPk);

  // The Mac.
  const rows = [
    `post '{"cellId":"<span class="cellid">{{CELL_ID}}</span>",\n  "title":"Hello!","emoji":"👋",\n  "color":"#30D158"}'`,
    'sleep 3',
    `post '{"cellId":"<span class="cellid">{{CELL_ID}}</span>",\n  "reset":true}'`,
  ];
  const code = h('div', { class: 'dt-code', attrs: { role: 'group', 'aria-label': 'The Hello script' } });
  code.innerHTML = rows.map(r => `<span class="dt-row">${r}</span>`).join('');
  const codeRows = [...code.querySelectorAll('.dt-row')];
  const cellIds = [...code.querySelectorAll('.cellid')];
  const macNote = h('p', { class: 'rt-note' });
  const macNode = h('section', { class: 'rt-node', attrs: { 'aria-label': 'Your Mac' } },
    h('div', { class: 'rt-node-head' }, h('div', { class: 'dt-pane-label', text: 'Your Mac' }),
      h('span', { class: 'rt-sub', text: 'Desktap Agent runs the script' })),
    code, macNote);
  stage.append(phoneNode, lane, macNode);

  const STEP_TEXT = [
    'You tap the button.',
    'The agent runs its script on your Mac, with this button’s ID in place of {{CELL_ID}}.',
    'The script sends an update; the agent passes it to the phone, and the button changes.',
    'After 3 s, "reset": true brings back the look you saved.',
  ];
  const stepEls = STEP_TEXT.map(s => { const li = h('li', { text: s }); steps.appendChild(li); return li; });

  const NOTES = [
    'Waiting for a tap.',
    'The tap reaches the agent.',
    'The script starts and sends its first update.',
    'The script waits 3 seconds. The light on the border means it is still running.',
    'The script sends "reset": true and ends.',
  ];

  function render(t) {
    const H = HELLO, s = helloAt(t);
    const look = s.look === 'shown' ? H.shown : H.saved, other = s.look === 'shown' ? H.saved : H.shown;
    const k = s.changedAt >= 0 ? (t - s.changedAt) / 0.3 : 1;
    big.face.render({ ...look, from: k < 1 ? { label: other.label, color: other.color, k } : null });
    big.pulse(s.running, t, s.look === 'shown' ? GREEN : BLUE);
    w.cls(bigWrap, between(t, H.tap, H.tap + 0.16) ? 'rt-big pressed' : 'rt-big');
    big.cell.setLabel(s.look === 'shown' ? 'The Hello button, green, showing Hello! and a waving hand' : 'The Hello button with its saved look');
    packetAt(w, tapPk, t, H.tap, H.start);
    if (t < H.reset) { w.text(updPk, 'update'); packetAt(w, updPk, t, H.start + 0.2, H.land, true); }
    else { w.text(updPk, 'reset'); packetAt(w, updPk, t, H.reset, H.back, true); }
    codeRows.forEach((r, i) => w.cls(r, i === s.line ? 'dt-row on' : 'dt-row'));
    cellIds.forEach(c => w.cls(c, between(t, H.start - 0.05, H.start + 0.7) ? 'cellid lit' : 'cellid'));
    w.cls(macNode, s.running && t >= H.start ? 'rt-node hot' : 'rt-node');
    w.cls(phoneNode, between(t, H.land, H.land + 0.6) || between(t, H.back, H.back + 0.6) ? 'rt-node hot' : 'rt-node');
    stepEls.forEach((li, i) => w.cls(li, i + 1 === s.step ? 'on' : i + 1 < s.step ? 'done' : ''));
    w.text(macNote, t >= H.end ? 'Done: the button shows its saved look again.' : NOTES[s.step]);
  }

  // Storyboard: four moments of the run.
  function buildStory() {
    const shots = [
      [HELLO.tap + 0.1, 'You tap the button: the light starts to circle its border.'],
      [HELLO.start + 0.3, 'The agent runs the script on your Mac.'],
      [HELLO.land + 0.5, 'The update arrives: green, “Hello!” and 👋.'],
      [HELLO.back + 0.5, 'After 3 s, reset: the saved look is back.'],
    ];
    shots.forEach(([t, text], i) => {
      const c = plainCell({ unit: 150, label: text });
      const s = helloAt(t);
      c.face.render(s.look === 'shown' ? HELLO.shown : HELLO.saved);
      c.pulse(s.running, 0.35, s.look === 'shown' ? GREEN : BLUE);
      story.appendChild(h('figure', {}, c.cell.svg, h('figcaption', {}, h('b', { text: String(i + 1) }), text)));
    });
  }

  let playing = false, base = 0, view = 'live';
  const frozen = sw.at !== null;
  const local = time => time - base;

  const loop = new Loop({
    root: ctx.figure,
    onFrame(time) {
      let t = local(time);
      if (playing && t >= HELLO.period) { base += HELLO.period * Math.floor(t / HELLO.period); t = local(time); }
      if (!playing && t > HELLO.period) t = HELLO.period;
      render(t);
      return playing || t < HELLO.end + 0.4;
    },
  });

  const playBtn = makeButton({ label: '❚❚ Pause', pressed: true, onClick: () => setPlaying(!playing) });
  const tapBtn = makeButton({ label: 'Tap the button', primary: true, onClick: tap });
  const viewSeg = makeSegmented({ label: 'View', options: [['live', 'Live'], ['story', 'Storyboard']], value: 'live', onChange: setView });
  controls.append(playBtn, tapBtn, h('span', { class: 'dt-spacer' }), viewSeg.el);
  bigWrap.addEventListener('click', tap);
  bigWrap.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(); } });

  function setPlaying(on) {
    playing = on && !frozen && !ctx.reduce();
    playBtn.setAttribute('aria-pressed', String(playing));
    playBtn.textContent = playing ? '❚❚ Pause' : '▶ Play';
    playBtn.disabled = ctx.reduce();
    playBtn.title = ctx.reduce() ? 'Reduce Motion is on: tap the button to see each step' : '';
    if (playing) { if (local(loop.time) >= HELLO.period) base = loop.time; loop.wake(); }
  }
  function tap() {
    if (view !== 'live') setView('live');
    const t = local(loop.time);
    if (ctx.reduce()) {
      // Reduce Motion: each tap shows the next state at once, nothing moves by itself.
      const shown = helloAt(t).look === 'shown';
      base = loop.time - (shown ? HELLO.period : HELLO.land + 0.5);
      announce(shown ? 'Reset: the button shows its saved look again.' : 'The button turns green with Hello and a waving hand.');
      loop.renderNow();
      return;
    }
    if (t >= HELLO.tap && t < HELLO.end) return;          // the phone ignores taps while the script runs
    base = loop.time - HELLO.tap + 0.02;
    announce('Tapped. The button turns green with Hello and a waving hand, and 3 seconds later shows its saved look again.');
    loop.renderNow();
    if (!frozen) loop.wake();
  }
  function setView(next) {
    view = next === 'story' ? 'story' : 'live';
    if (view === 'story' && !story.childElementCount) buildStory();
    story.hidden = view !== 'story';
    stage.hidden = steps.hidden = view === 'story';
    viewSeg.set(view);
  }

  makeLegend([
    { swatch: 'glide', text: 'The tap and each update' },
    { swatch: 'ok', text: 'The button changes' },
  ], legend);
  caption.innerHTML =
    '<strong>A tap runs the button’s script on your Mac, and the script changes the button.</strong> ' +
    'The agent puts the button’s ID where the script says <code>{{CELL_ID}}</code>. Each <code>post</code> ' +
    'sends an update to the agent at <code>127.0.0.1:9848</code>, which passes it to the phone, and ' +
    '<code>"reset": true</code> brings back the look you saved in the editor.';

  if (frozen) { loop.time = sw.at % HELLO.period; loop.speed = 0; setPlaying(false); }
  else if (ctx.reduce()) { setPlaying(false); loop.time = HELLO.period; setView('story'); }
  else setPlaying(true);
  if (sw.view === 'story') setView('story');

  return { loop, onReduce() { setPlaying(false); setView('story'); }, onMotion() { setPlaying(false); } };
}

// ─── Full mode: where an update goes ────────────────────────────────────────────────────────────────────────────

const DISK = { label: '412 GB free', icon: 'internaldrive.fill', color: BLUE };
const body = (title, bad = false) => bad
  ? [`{"cellId":"$cell",`, ` "color":"<span class="val">#F00</span>"}`]
  : [`{"cellId":"$cell",`, ` "title":"${title}"}`];

/**
 * The five outcomes. posts: what the script sends, at local time `at`, and the check that fails (null = all pass).
 * flush: the held look goes to the phone at `at` (the button is on screen again / the phone reads again).
 */
export const SCENARIOS = Object.freeze([
  {
    id: 'shown', code: 200, name: 'On screen', answer: ANSWERS.ok, duration: 6,
    posts: [{ at: 0.3, title: '411 GB free', fails: null }],
    phone: { page: 'Main' },
    next: 'Sent. The script remembers the value and sends again only when it changes.',
    agent: 'Every check passed: the update goes to the phone.',
    see: 'The title rolls to the new value.',
  },
  {
    id: 'hidden', code: 200, name: 'Hidden', answer: ANSWERS.hidden, duration: 9.2,
    posts: [{ at: 0.3, title: '411 GB free', fails: 2 }, { at: 3.3, title: '410 GB free', fails: 2 }],
    flush: { at: 5.9, title: '410 GB free', once: true },
    phone: { page: 'Apps', pageAt: 5.9 },
    next: 'Keep sending as usual. The agent keeps only the newest look.',
    agent: 'The button is not on screen: the agent keeps the newest look until it is.',
    see: 'Another page is open (or Desktap is in the background). When the button is on screen again, it shows the newest look at once.',
  },
  {
    id: 'dropped', code: 200, name: 'Not reading', answer: ANSWERS.dropped, duration: 7.6,
    posts: [{ at: 0.3, title: '411 GB free', fails: 3 }],
    flush: { at: 4.7, title: '411 GB free', once: false },
    phone: { page: 'Main', readsAt: 4.7 },
    next: 'Slow down: <code>(( dropped )) &amp;&amp; sleep 4</code>. Nothing needs sending again.',
    agent: 'The phone is not reading right now: the agent keeps the newest look and sends it when it reads again.',
    see: 'When the phone reads again, the newest look arrives by itself.',
  },
  {
    id: 'refused', code: 400, name: 'Refused', answer: ANSWERS.badColor, duration: 6.2, bad: true, listed: true,
    posts: [{ at: 0.3, title: '', fails: 0, bad: true }],
    phone: { page: 'Main' },
    next: '<code>call</code> prints the reason to stderr, so it is in the error text if the script fails. Fix the body: <code>#FF0000</code>.',
    agent: 'Refused: nothing is drawn. This check comes first and works with no phone connected; with one, the phone lists the reason.',
    see: 'Nothing changes on the button. ⚠ 1 appears next to the Mac’s name: Errors lists the update as Drawing rejected, with this reason.',
  },
  {
    id: 'nophone', code: 503, name: 'No phone', answer: ANSWERS.noPhone, duration: 6.2,
    posts: [{ at: 0.3, title: '411 GB free', fails: 1 }],
    phone: { page: 'Main', disconnected: true },
    next: '<code>post</code> fails, so the script keeps the old value and sends it again on the next pass.',
    agent: 'No phone is connected, so there is nowhere to send it.',
    see: 'The phone is away. A script you try in Terminal gets this answer too.',
  },
]);

/** When each part of a post happens: the packet reaches the agent, each check, the decision, the answer arrives. */
export function postTimes(post) {
  const arrive = post.at + TRAVEL;
  const runs = post.fails === null ? CHECKS.length : post.fails + 1;
  const decide = arrive + runs * CHECK;
  return { arrive, decide, answered: decide + TRAVEL, landed: post.fails === null ? decide + TRAVEL : null, runs };
}

/** Everything the full diagram shows at local time t of a scenario (pure). */
export function roundTripAt(sc, t) {
  const sent = sc.posts.filter(p => p.at <= t);
  const post = sent[sent.length - 1] || sc.posts[0];
  const pt = postTimes(post);
  const checks = CHECKS.map((c, i) => {
    if (post.at > t || t < pt.arrive + i * CHECK + CHECK * 0.6) return 'pending';
    if (post.fails === null || i < post.fails) return 'pass';
    return i === post.fails ? 'fail' : 'skip';
  });
  const answered = post.at <= t && t >= pt.answered;
  // The button: the newest title that landed on the phone.
  let title = DISK.label, changedAt = -1, prev = DISK.label, rolls = true;
  for (const p of sc.posts) {
    const q = postTimes(p);
    if (q.landed !== null && t >= q.landed) { prev = title; title = p.title; changedAt = q.landed; rolls = true; }
  }
  if (sc.flush && t >= sc.flush.at + TRAVEL) { prev = title; title = sc.flush.title; changedAt = sc.flush.at + TRAVEL; rolls = !sc.flush.once; }
  // The tray on the Mac: held looks, newest last.
  const held = sc.posts.filter(p => (p.fails === 2 || p.fails === 3) && t >= postTimes(p).decide).map(p => p.title);
  const flushed = sc.flush && t >= sc.flush.at;
  const page = sc.phone.pageAt !== undefined && t >= sc.phone.pageAt ? 'Main' : sc.phone.page;
  const reading = sc.phone.readsAt === undefined ? true : t >= sc.phone.readsAt;
  return { post, pt, checks, answered, title, prev, changedAt, rolls, held: flushed ? [] : held, page, reading,
    decided: post.at <= t && t >= pt.decide };
}

function makeMiniPhone() {
  const W = 200, H = 232, X0 = 14, Y0 = 44, S = 80, G = 12;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'rt-phone-svg', role: 'img', width: W, height: H });
  const defs = svgEl('defs', {}, svg);
  svgEl('rect', { width: W, height: H, rx: 22, fill: '#0D0D0D' }, svg);
  // Top bar: the connection badge in the middle, the page name at the right.
  const badge = svgEl('g', {}, svg);
  svgEl('rect', { x: 52, y: 11, width: 96, height: 21, rx: 10.5, fill: '#FFFFFF', 'fill-opacity': 0.08 }, badge);
  const badgeDot = svgEl('circle', { cx: 64, cy: 21.5, r: 3, fill: '#30D158' }, badge);
  const badgeText = svgEl('text', { x: 72, y: 25, 'font-size': 9.5, 'font-weight': 600, fill: '#FFFFFF', 'fill-opacity': 0.85 }, badge);
  badgeText.textContent = 'MacBook Pro';
  // The ⚠ count right of the Mac's name, for an update the agent refused (Errors lists it as Drawing rejected).
  // While it shows, the name and the count sit together left of the page name, as the app centers them.
  const count = svgEl('g', { opacity: 0 }, svg);
  svgEl('rect', { x: 125, y: 13, width: 25, height: 17, rx: 8.5, fill: ORANGE, 'fill-opacity': 0.16 }, count);
  svgEl('path', { d: WARN_D, 'fill-rule': 'evenodd', fill: ORANGE, transform: 'translate(129.5 17.4) scale(0.45)' }, count);
  const countText = svgEl('text', { x: 144, y: 25, 'font-size': 9.5, 'font-weight': 600, 'text-anchor': 'middle', fill: ORANGE }, count);
  countText.textContent = '1';
  const pageText = svgEl('text', { x: 178, y: 25, 'font-size': 10.5, 'font-weight': 600, 'text-anchor': 'end', fill: '#FFFFFF', 'fill-opacity': 0.9 }, svg);
  svgEl('path', { d: 'M 181.5 19.5 L 184.5 22.5 L 187.5 19.5', fill: 'none', stroke: '#FFFFFF', 'stroke-opacity': 0.6, 'stroke-width': 1.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
  const at = i => [X0 + (i % 2) * (S + G), Y0 + Math.floor(i / 2) * (S + G)];
  // Page "Main": the free-disk button and three ordinary ones.
  const main = svgEl('g', {}, svg);
  const target = glassButton(main, defs, ...at(0), S);
  [['Music', 'music.note', '#FF375F'], ['Volume', 'speaker.wave.2.fill', '#BF5AF2'], ['Lock', 'lock.fill', '#8E8E93']]
    .forEach(([label, icon, color], i) => glassButton(main, defs, ...at(i + 1), S).face.render({ label, icon, color }));
  // Page "Apps": other buttons, the free-disk button is not among them.
  const apps = svgEl('g', {}, svg);
  [['Mail', '#0A84FF'], ['Notes', '#FFD60A'], ['Safari', '#64D2FF'], ['Terminal', '#3A3A3C']].forEach(([label, color], i) => {
    const b = glassButton(apps, defs, ...at(i), S);
    b.face.render({ label, icon: null, color });
    const [x, y] = at(i);
    svgEl('rect', { x: x + 24, y: y + 14, width: 32, height: 32, rx: 7.2, fill: color }, b.g);
    svgEl('rect', { x: x + 24, y: y + 14, width: 32, height: 16, rx: 7.2, fill: '#FFFFFF', 'fill-opacity': 0.14 }, b.g);
  });
  // A veil for "not reading" and "not connected".
  const veil = svgEl('g', { opacity: 0 }, svg);
  svgEl('rect', { x: 0, y: 38, width: W, height: H - 38, rx: 0, fill: '#0D0D0D', 'fill-opacity': 0.72 }, veil);
  const veilText = svgEl('text', { x: W / 2, y: 141, 'font-size': 11, 'font-weight': 600, 'text-anchor': 'middle', fill: '#FFFFFF', 'fill-opacity': 0.9 }, veil);
  const w = writer();
  return {
    svg,
    render({ page, title, prev, changedAt, rolls, t, reading, disconnected, listed = 0 }) {
      w.text(pageText, page);
      const lk = EASE.easeInOut(clamp01(listed));
      w.attr(count, 'opacity', lk.toFixed(3));
      w.attr(badge, 'transform', `translate(${(-27 * lk).toFixed(2)} 0)`);
      w.attr(main, 'opacity', page === 'Main' ? '1' : '0');
      w.attr(apps, 'opacity', page === 'Apps' ? '1' : '0');
      const k = changedAt >= 0 && rolls ? (t - changedAt) / 0.35 : 1;
      target.face.render({ ...DISK, label: title, from: k < 1 ? { label: prev, k } : null });
      w.text(badgeText, disconnected ? 'Not connected' : 'MacBook Pro');
      w.attr(badgeDot, 'fill', disconnected ? '#8E8E93' : '#30D158');
      const veiled = disconnected || !reading;
      w.attr(veil, 'opacity', veiled ? '1' : '0');
      w.text(veilText, disconnected ? 'Not connected' : 'Not reading right now');
      svg.setAttribute('aria-label', disconnected ? 'The phone, not connected'
        : page !== 'Main' ? 'The phone with another page open: the free disk button is not on screen'
          : !reading ? 'The phone, not reading right now'
            : `The phone: the free disk button shows ${title}${lk > 0.5 ? ', and ⚠ 1 next to the Mac’s name' : ''}`);
    },
  };
}

function mountFull(ctx) {
  const { body: bodyEl, controls, legend, caption, announce, sw, w } = ctx;
  const pickRow = h('div', { class: 'rt-pickrow' });
  const stage = h('div', { class: 'rt-stage full' });
  const story = h('div', { class: 'rt-story', hidden: '' });
  bodyEl.append(pickRow, stage, story);

  // Script.
  const code = h('div', { class: 'dt-code', attrs: { role: 'group', 'aria-label': 'The update the script sends' } });
  const answer = h('div', { class: 'rt-answer', attrs: { 'aria-live': 'off' } });
  const next = h('p', { class: 'rt-next' });
  const scriptNode = h('section', { class: 'rt-node', attrs: { 'aria-label': 'The script' } },
    h('div', { class: 'rt-node-head' }, h('div', { class: 'dt-pane-label', text: 'Script' }),
      h('span', { class: 'rt-sub', text: 'free disk space' })),
    h('span', { class: 'rt-sub', text: 'post BODY' }), code,
    h('span', { class: 'rt-sub', text: 'the answer' }), answer, next);

  // Lane 1: update out, answer back.
  const out1 = h('span', { class: 'rt-packet dot out' });
  const back1 = h('span', { class: 'rt-packet pill back ok', text: '200' });
  const lane1 = h('div', { class: 'rt-lane', attrs: { 'aria-hidden': 'true' } }, h('span', { class: 'rt-wire' }), out1, back1);

  // Agent.
  const checkEls = CHECKS.map(c => {
    const small = h('small');
    const el = h('div', { class: 'rt-check' }, h('i', { text: '' }), h('span', {}, c.text, small));
    return { el, small, mark: el.firstChild };
  });
  const trayBody = h('div', { class: 'rt-tray-body' });
  const agentNote = h('p', { class: 'rt-note' });
  const agentNode = h('section', { class: 'rt-node', attrs: { 'aria-label': 'Desktap Agent' } },
    h('div', { class: 'rt-node-head' }, h('div', { class: 'dt-pane-label', text: 'Desktap Agent' }),
      h('span', { class: 'rt-sub', text: '127.0.0.1:9848' })),
    h('div', { class: 'rt-checks' }, checkEls.map(c => c.el)),
    h('div', { class: 'rt-tray' }, h('span', { class: 'rt-tray-head', text: 'Kept on the Mac' }), trayBody),
    agentNote);

  // Lane 2: to the phone.
  const out2 = h('span', { class: 'rt-packet dot out' });
  const lane2 = h('div', { class: 'rt-lane', attrs: { 'aria-hidden': 'true' } }, h('span', { class: 'rt-wire' }), out2);

  // Phone.
  const phone = makeMiniPhone();
  const see = h('p', { class: 'rt-note' });
  const phoneNode = h('section', { class: 'rt-node', attrs: { 'aria-label': 'The phone' } },
    h('div', { class: 'rt-node-head' }, h('div', { class: 'dt-pane-label', text: 'Your iPhone or iPad' }),
      h('span', { class: 'rt-sub', text: 'page Main, top left' })),
    h('div', { class: 'rt-phone-wrap' }, phone.svg), see);

  stage.append(scriptNode, lane1, agentNode, lane2, phoneNode);

  // Scenario picker.
  const pick = h('div', { class: 'rt-picker', attrs: { role: 'group', 'aria-label': 'What is happening on the phone' } });
  const pickBtns = SCENARIOS.map((sc, i) => {
    const b = h('button', { type: 'button', attrs: { 'aria-pressed': 'false' } },
      h('b', { class: sc.code === 200 ? '' : 'err', text: String(sc.code) }), sc.name);
    b.addEventListener('click', () => choose(i, true));
    pick.appendChild(b);
    return b;
  });
  pickRow.appendChild(pick);

  let index = 0, base = 0, cycling = false, view = 'live', lastIndex = -1;
  const frozen = sw.at !== null;

  function render(time) {
    const sc = SCENARIOS[index];
    const t = Math.min(time - base, sc.duration);
    const s = roundTripAt(sc, t);
    if (index !== lastIndex) {
      pickBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === index)));
      lastIndex = index;
    }
    // Script.
    const lines = s.post.bad ? body('', true) : body(s.post.title);
    const sending = t >= s.post.at && t < s.pt.arrive;
    w.html(code, lines.map(l => `<span class="dt-row${sending ? ' on' : ''}${s.post.bad ? ' bad' : ''}">${l}</span>`).join(''));
    if (s.answered) {
      w.cls(answer, sc.code === 200 ? 'rt-answer ok' : 'rt-answer err');
      w.html(answer, `<b>${sc.code}</b>${answerHTML(sc.answer)}`);
      w.html(next, sc.next);
    } else {
      w.cls(answer, 'rt-answer');
      w.html(answer, t >= s.post.at ? 'waiting for the answer…' : '');
      w.html(next, '');
    }
    w.cls(scriptNode, s.answered && between(t, s.pt.answered, s.pt.answered + 0.6)
      ? (sc.code === 200 ? 'rt-node hot' : 'rt-node hot-warn') : 'rt-node');
    // Lane 1.
    packetAt(w, out1, t, s.post.at, s.pt.arrive);
    w.cls(back1, `rt-packet pill back ${sc.code === 200 ? 'ok' : 'err'}`);
    w.text(back1, String(sc.code));
    packetAt(w, back1, t, s.pt.decide, s.pt.answered, true);
    // Agent.
    s.checks.forEach((st, i) => {
      const c = checkEls[i];
      w.cls(c.el, `rt-check ${st === 'pending' ? '' : st}`);
      w.text(c.mark, st === 'pass' ? '✓' : st === 'fail' ? '✕' : '');
      w.text(c.small, st === 'fail' ? CHECKS[i].fail : '');
    });
    const working = t >= s.pt.arrive && t < s.pt.decide + 0.1;
    w.cls(agentNode, working ? 'rt-node hot' : s.decided && between(t, s.pt.decide, s.pt.decide + 0.7) && sc.code !== 200
      ? 'rt-node hot-warn' : 'rt-node');
    const heldHtml = s.held.map((x, i) => `<span class="rt-look${i < s.held.length - 1 ? ' gone' : ''}">${esc(x)}</span>`).join('');
    w.html(trayBody, heldHtml || (sc.flush && t >= sc.flush.at ? 'sent to the phone' : 'nothing'));
    w.text(agentNote, s.decided ? sc.agent : '');
    // Lane 2.
    if (sc.flush && t >= sc.flush.at - 0.05) packetAt(w, out2, t, sc.flush.at, sc.flush.at + TRAVEL);
    else if (s.post.fails === null) packetAt(w, out2, t, s.pt.decide, s.pt.decide + TRAVEL);
    else packetAt(w, out2, t, -9, -8);
    w.cls(lane2, sc.phone.disconnected ? 'rt-lane off' : 'rt-lane');
    // Phone.
    phone.render({ page: s.page, title: s.title, prev: s.prev, changedAt: s.changedAt, rolls: s.rolls, t,
      reading: s.reading, disconnected: !!sc.phone.disconnected,
      listed: sc.listed && s.decided ? (t - s.pt.decide - TRAVEL) / 0.3 : 0 });
    const landed = s.changedAt >= 0 && t >= s.changedAt;
    w.cls(phoneNode, landed && between(t, s.changedAt, s.changedAt + 0.7) ? 'rt-node hot' : 'rt-node');
    w.text(see, sc.id === 'hidden' ? (t >= sc.flush.at ? 'The page is open again: the newest look, at once.' : 'Another page is open (or Desktap is in the background).')
      : sc.id === 'dropped' ? (t >= sc.flush.at ? 'Reading again: the newest look arrives by itself.' : 'Desktap is not reading right now.')
        : sc.id === 'shown' ? (landed ? 'The title rolls to the new value.' : 'The button is on screen.')
          : sc.see);
  }

  const loop = new Loop({
    root: ctx.figure,
    onFrame(time) {
      let t = time - base;
      if (cycling && t >= SCENARIOS[index].duration) {
        while (t >= SCENARIOS[index].duration) { t -= SCENARIOS[index].duration; base += SCENARIOS[index].duration; index = (index + 1) % SCENARIOS.length; }
      }
      render(time);
      return cycling || t < SCENARIOS[index].duration;
    },
  });

  const playBtn = makeButton({ label: '❚❚ Pause', pressed: true, onClick: () => setCycling(!cycling) });
  const againBtn = makeButton({ label: 'Send again', primary: true, onClick: () => choose(index, true) });
  const viewSeg = makeSegmented({ label: 'View', options: [['live', 'Live'], ['story', 'All answers']], value: 'live', onChange: setView });
  controls.append(playBtn, againBtn, h('span', { class: 'dt-spacer' }), viewSeg.el);

  function setCycling(on) {
    cycling = on && !frozen && !ctx.reduce();
    playBtn.setAttribute('aria-pressed', String(cycling));
    playBtn.textContent = cycling ? '❚❚ Pause' : '▶ Play all';
    playBtn.disabled = ctx.reduce();
    playBtn.title = ctx.reduce() ? 'Reduce Motion is on: pick an answer to see its outcome' : '';
    if (cycling) {
      if (loop.time - base >= SCENARIOS[index].duration) { index = (index + 1) % SCENARIOS.length; base = loop.time; }
      loop.wake();
    }
  }
  function choose(i, spoken) {
    if (view !== 'live') setView('live');
    index = i;
    base = loop.time;
    if (ctx.reduce()) base = loop.time - SCENARIOS[i].duration;    // Reduce Motion: the outcome at once
    setCycling(false);
    const sc = SCENARIOS[i];
    if (spoken) announce(`${sc.name}: the agent answers ${sc.code} ${sc.answer}. ${sc.see} ${sc.next.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&')}`);
    loop.renderNow();
    if (!frozen) loop.wake();
  }
  function setView(next) {
    view = next === 'story' ? 'story' : 'live';
    if (view === 'story' && !story.childElementCount) buildStory();
    story.hidden = view !== 'story';
    stage.hidden = pickRow.hidden = view === 'story';
    viewSeg.set(view);
  }
  function buildStory() {
    for (const sc of SCENARIOS) {
      story.appendChild(h('section', { class: 'rt-story-row', attrs: { 'aria-label': `${sc.code} ${sc.name}` } },
        h('div', {}, h('span', { class: `dt-chip ${sc.code === 200 ? 'ok' : 'fade'}`, text: String(sc.code) }),
          h('p', { class: 'dt-pane-title', text: sc.name }), h('p', { class: 'dt-pane-note', text: sc.see })),
        h('div', {}, h('span', { class: 'rt-k', text: 'The agent answers' }),
          h('div', { class: `rt-answer ${sc.code === 200 ? 'ok' : 'err'}`, html: `<b>${sc.code}</b>${answerHTML(sc.answer)}` })),
        h('div', {}, h('span', { class: 'rt-k', text: 'On the Mac' }), h('p', { text: sc.agent }),
          h('span', { class: 'rt-k', text: 'Your script' }), h('p', { html: sc.next }))));
    }
  }

  makeLegend([
    { swatch: 'glide', text: 'The update' },
    { swatch: 'ok', text: '200: the agent has it' },
    { swatch: 'fade', text: '400 or 503: it does not' },
  ], legend);
  caption.innerHTML =
    '<strong>Read the answer, not only the button, and keep sending.</strong> A 200 means the agent has your update: ' +
    'the button shows it now, or the moment it is on screen again (<code>"visible": false</code>), or when the phone ' +
    'reads again (<code>"dropped": true</code>: slow down). A 400 names the mistake, with or without a phone, and a ' +
    'connected phone lists it under Errors; a 503 ' +
    'means no phone is connected. After either, nothing changes on the button, so send the value again on the next pass.' +
    '<p class="dt-note">The keys of an answer come in any order: look for a part of it, as <code>post</code> does, ' +
    'or read it with jq.</p>';

  if (frozen) {
    let t = sw.at;
    while (t >= SCENARIOS[index].duration) { t -= SCENARIOS[index].duration; index = (index + 1) % SCENARIOS.length; }
    loop.time = sw.at; base = sw.at - t; loop.speed = 0;
    setCycling(false);
  } else if (ctx.reduce()) {
    setCycling(false); loop.time = SCENARIOS[0].duration; setView('story');
  } else setCycling(true);
  if (sw.view === 'story') setView('story');

  return { loop, onReduce() { setCycling(false); setView('story'); }, onMotion() { setCycling(false); } };
}

// ─── The diagram ────────────────────────────────────────────────────────────────────────────────────────────────

export default function mount(el, { mode = 'full', reducedMotion = false } = {}) {
  ensureStyle('dt-round-trip', CSS);
  const sw = readSwitches(el, { reducedMotion });
  let reduce = sw.reduced;
  const original = [...el.childNodes];
  const simple = mode === 'simple';
  const fig = makeFigure(simple ? {
    name: 'round-trip',
    eyebrow: 'How a button changes itself',
    title: 'Tap, script, update.',
    lede: 'The Hello button you build on this page, step by step.',
  } : {
    name: 'round-trip',
    eyebrow: 'Where an update goes',
    title: 'Every update gets an answer.',
    lede: 'The free disk widget sends its next value. Pick what is happening on the phone and follow the update.',
  });
  const ctx = { ...fig, sw, w: writer(), reduce: () => reduce };
  const part = simple ? mountSimple(ctx) : mountFull(ctx);
  el.replaceChildren(fig.figure);
  part.loop.renderNow();
  const unwatch = watchReducedMotion(on => {
    reduce = on || sw.reduced;
    if (reduce) part.onReduce(); else part.onMotion();
  });
  return {
    destroy() {
      unwatch();
      part.loop.destroy();
      el.replaceChildren(...original);
    },
  };
}
