/*
 * D4 · One writer per button (Button logic › Taps change state, the loop draws; Notifications › Restart the focus
 * timer from the notification).
 *
 * mode "default": the focus timer on two buttons from Button logic › One script, several buttons. The tap script
 *   writes the end time (now + 25 min) to $DESKTAP_STORAGE/focus/end, or deletes the file while a session runs, and
 *   exits. The startup script wakes on every whole second, reads the file and draws both buttons, sending a look
 *   only when it changed. The tour: tap Start → the countdown runs → the phone disconnects (both buttons show their
 *   saved looks, the agent stops the script, the file stays) → it connects again (the script starts from scratch and
 *   carries on at the right time) → tap Stop.
 * mode "notification": the one-button focus timer with its notification (Notifications page). The tap script runs
 *   with minutes=1; when the time is up the loop draws Done! and sends "Focus time is up" once; its Restart 25 min
 *   action runs like a tap of the button and writes a new end time; the loop draws it on its next pass.
 *
 * The scripts' logic is FocusSim below (no DOM, exported for the node test): the page's zsh, step by step, on a
 * made-up Mac clock. Travel times of the pulses are only there so the eye can follow them.
 *
 * mount(el, { mode, reducedMotion }) → { destroy() }
 * Test switches (face-player.js readSwitches): data-at / ?dt-at=<s>, data-view / ?dt-view=story, ?dt-motion=reduce.
 */
import { Loop, makeCell, svgEl, readSwitches, watchReducedMotion, hexToRgb, rgb, EASE, clamp01 } from '../face-player.js';
import { ensureStyle, h, uid, makeFigure, makeButton, makeSegmented, makeLegend } from '../dt-chrome.js';

// ─── The scripts, as a model ─────────────────────────────────────────────────────────────────────────────────

/** The Mac's clock (date +%s) at diagram time 0: whole seconds fall at 0.65, 1.65, … */
export const MAC0 = 1767252600.35;
/** How long each hop takes in the diagram (seconds), so the eye can follow it. */
export const HOP = { tap: 0.3, run: 0.2, write: 0.25, read: 0.25, post: 0.35, notify: 0.45, link: 0.6, start: 0.3 };
export const LOOKS = {
  start: { title: 'Start', icon: 'play', color: '#30D158' },
  stop: { title: 'Stop', icon: 'stop', color: '#FF453A' },
  focus: { title: 'Focus', icon: 'timer', color: '#8E8E93' },
  done: { title: 'Done!', icon: 'check', color: '#30D158' },
  clock: left => ({ title: clockText(left), icon: 'timer', color: '#FF453A' }),
};
/** What the buttons show when no script draws them: what you set in the editor. */
export const SAVED = {
  A: { title: 'Focus', icon: 'terminal', color: '#8E8E93' },
  B: { title: '', icon: 'dashed', color: '#8E8E93' },
  C: { title: 'Focus', icon: 'terminal', color: '#8E8E93' },
};
export const TOURS = {
  default: { length: 15.5, events: [[0.75, 'tap'], [5.2, 'disconnect'], [8.0, 'connect'], [12.2, 'tap']] },
  notification: { length: 15.2, events: [[0.7, 'tap'], [4.3, 'skip', 55], [7.8, 'action', 'again'], [12.0, 'tap']] },
};
export const STEPS = {
  default: [
    ['Tap Start.', 'The phone sends the tap to the Mac.'],
    ['The tap script writes the end time', 'to focus/end and exits. It draws nothing.'],
    ['Within a second the startup script reads the file', 'and draws both buttons: Stop and 24:59.'],
    ['Every second it draws the time left.', 'It sends a look only when it changed.'],
    ['The phone disconnects.', 'Both buttons show their saved looks, and the agent stops the script. The file stays.'],
    ['The phone connects again.', 'The script starts from scratch, reads the file and carries on at the right time.'],
    ['Tap Stop.', 'The tap script deletes the file; on its next pass the loop draws Start and Focus.'],
  ],
  notification: [
    ['Tap the button.', 'The tap script writes the end time to focus/end and exits.'],
    ['Every second the startup script draws the time left.', 'Here 55 s are skipped.'],
    ['The time is up.', 'The loop draws Done! and sends the notification, once.'],
    ['Tap Restart 25 min.', 'The action runs on the Mac like a tap and writes a new end time. It draws nothing.'],
    ['On its next pass the loop draws the new countdown.', 'The notification never touched the button.'],
    ['Tap the button again.', 'The tap script deletes the file; the loop draws Focus.'],
  ],
};
/** Moments of the tour shown in the Steps view, one per step. */
const SNAPSHOTS = {
  default: [1.0, 1.6, 2.4, 4.4, 6.5, 9.7, 14.4],
  notification: [1.5, 3.0, 6.7, 8.6, 9.5, 14.4],
};

export function clockText(left) {
  const l = Math.max(0, Math.floor(left));
  return `${Math.floor(l / 60)}:${String(l % 60).padStart(2, '0')}`;
}
const lookKey = look => `${look.title}|${look.icon}|${look.color}`;

function mixHex(a, b, f) {
  const x = hexToRgb(a), y = hexToRgb(b);
  return rgb(x[0] + (y[0] - x[0]) * f, x[1] + (y[1] - x[1]) * f, x[2] + (y[2] - x[2]) * f);
}

/** The tap script, the startup script, the file, the agent and the phone, on one clock (diagram seconds). */
export class FocusSim {
  constructor(mode = 'default') {
    this.mode = mode === 'notification' ? 'notification' : 'default';
    this.cells = this.mode === 'notification' ? ['C'] : ['A', 'B'];
    this.minutes = this.mode === 'notification' ? 1 : 25;     // the tap script's minutes= line
    this.skip = 0;                  // seconds the Mac's clock was moved on ("55 s later")
    this.skippedAt = -10;
    this.file = null;               // focus/end: null = no file
    this.fileSince = -10;
    this.told = 0;                  // notification mode: the end time a notification went out for
    this.link = 'connected';        // 'connected' | 'disconnected' | 'connecting'
    this.running = true;            // the startup script
    this.busy = null;               // 'tap' | 'action' while that script runs
    this.busySince = -10;
    this.banner = null;             // { since } while the notification shows
    this.queue = [];
    this.seq = 0;
    this.pulses = [];
    this.lit = {};                  // wire → time it was last used
    this.step = 0;
    this.phone = {};
    this.shown = {};
    const idle = this.looksFor(0, 0);
    for (const c of this.cells) {
      this.phone[c] = { look: idle[c], since: -10, from: idle[c].color };
      this.shown[c] = lookKey(idle[c]);
    }
    this.status = {
      tap: ['waits for a tap', ''],
      loop: ['reads the file', 'every second'],
      action: ['waits for a tap', 'on the notification'],
    };
    this.at(this.nextSecond(0), 'pass');
  }

  mac(t) { return MAC0 + t + this.skip; }
  sec(t) { return Math.floor(this.mac(t) + 1e-6); }
  nextSecond(t) { return this.sec(t) + 1 - MAC0 - this.skip; }

  /** What the startup script draws for an end time (0 = no file) at Mac second `now`. */
  looksFor(end, now) {
    const left = end - now;
    const timer = end === 0 ? LOOKS.focus : left > 0 ? LOOKS.clock(left) : LOOKS.done;
    if (this.mode === 'notification') return { C: timer };
    return { A: end !== 0 && left > 0 ? LOOKS.stop : LOOKS.start, B: timer };
  }

  at(time, kind, data = {}) {
    this.queue.push({ time, kind, data, seq: this.seq++ });
    this.queue.sort((a, b) => a.time - b.time || a.seq - b.seq);
  }
  pulse(wire, t0, dur) { this.pulses.push({ wire, t0, dur }); this.lit[wire] = t0 + dur; }

  advance(t) {
    while (this.queue.length && this.queue[0].time <= t + 1e-9) {
      const e = this.queue.shift();
      this.handle(e.time, e.kind, e.data);
    }
    this.pulses = this.pulses.filter(p => p.t0 + p.dur > t);
  }

  handle(t, kind, data) {
    if (kind === 'pass') this.pass(t);
    else if (kind === 'run') { this.status[data.who] = ['running…', '']; this.at(t + HOP.run, 'done', data); }
    else if (kind === 'done') this.scriptDone(t, data);
    else if (kind === 'file') { this.file = data.value; this.fileSince = t; }
    else if (kind === 'paint') { if (this.link === 'connected') this.paint(data.cell, data.look, t); }
    else if (kind === 'banner') { if (this.link === 'connected') this.banner = { since: t }; }
    else if (kind === 'linkUp') { this.link = 'connected'; this.at(t + HOP.start, 'start'); }
    else if (kind === 'start') {
      this.running = true;
      this.shown = {};
      this.status.loop = ['started from scratch', ''];
      this.queue = this.queue.filter(e => e.kind !== 'pass');
      this.pass(t, true);
    }
  }

  paint(cell, look, t) {
    const p = this.phone[cell];
    p.from = this.colorAt(cell, t);
    p.look = look;
    p.since = t;
  }

  /** The look a button shows: what the script drew, or its saved look. */
  lookOf(cell) { return this.phone[cell].look || SAVED[cell]; }

  /** Its color at t: the app blends a new color in over 0.3 s. */
  colorAt(cell, t, instant = false) {
    const p = this.phone[cell], to = this.lookOf(cell).color;
    const f = instant ? 1 : EASE.easeInOut(clamp01((t - p.since) / 0.3));
    return f >= 1 ? to : mixHex(p.from.startsWith('#') ? p.from : '#8E8E93', to, f);
  }

  pass(t, first = false) {
    if (!this.running) return;
    const now = this.sec(t), end = this.file ?? 0, left = end - now;
    const looks = this.looksFor(end, now);
    this.pulse('read', t, HOP.read);
    const drew = [];
    for (const c of this.cells) {
      const key = lookKey(looks[c]);
      if (key === this.shown[c]) continue;
      this.shown[c] = key;
      drew.push(looks[c].title);
      this.pulse(`post${c}`, t + HOP.read, HOP.post);
      this.at(t + HOP.read + HOP.post, 'paint', { cell: c, look: looks[c] });
    }
    let notified = false;
    if (this.mode === 'notification' && end > 0 && left <= 0 && end !== this.told) {
      this.told = end;
      notified = true;
      this.pulse('notify', t + HOP.read, HOP.notify);
      this.at(t + HOP.read + HOP.notify, 'banner');
    }
    this.status.loop = [end ? `read ${end}` : 'read: no file',
      drew.length ? `drew ${drew.join(' · ')}${notified ? ', notified' : ''}` : 'nothing new to draw'];
    // Which step of the story this pass belongs to
    if (this.mode === 'default') {
      if (first) this.step = 6;
      else if (this.step === 2 && drew.length) this.step = 3;
      else if (this.step === 3) this.step = 4;
    } else if (notified) this.step = 3;
    else if (this.step === 1 && drew.length) this.step = 2;
    else if (this.step === 4 && drew.length) this.step = 5;
    this.at(this.nextSecond(t), 'pass');
  }

  scriptDone(t, { who, id }) {
    const now = this.sec(t);
    let value;
    if (who === 'tap') value = this.file !== null && this.file > now ? null : now + this.minutes * 60;
    else value = id === 'again' ? now + 25 * 60 : null;
    this.status[who] = [value === null ? 'deleted the file' : 'wrote the end time', 'exit 0'];
    this.busy = null;
    if (who === 'tap' && value !== null && this.mode === 'default') this.step = 2;
    this.pulse(who === 'tap' ? 'write' : 'write2', t, HOP.write);
    this.at(t + HOP.write, 'file', { value });
  }

  // ── What a reader (or the tour) does ──

  tap(t) {
    if (this.link !== 'connected' || this.busy) return false;
    const runningNow = this.file !== null && this.file > this.sec(t);
    this.step = runningNow ? (this.mode === 'notification' ? 6 : 7) : 1;
    this.busy = 'tap';
    this.busySince = t;
    this.status.tap = ['tapped', ''];
    this.pulse('tap', t, HOP.tap);
    this.at(t + HOP.tap, 'run', { who: 'tap' });
    return true;
  }

  action(t, id) {
    if (!this.banner || this.busy || this.link !== 'connected') return false;
    this.banner = null;
    this.busy = 'action';
    this.busySince = t;
    this.step = 4;
    this.status.action = ['tapped', ''];
    this.pulse('action', t, HOP.tap);
    this.at(t + HOP.tap, 'run', { who: 'action', id });
    return true;
  }

  disconnect(t) {
    if (this.link !== 'connected') return false;
    this.link = 'disconnected';
    this.running = false;
    this.busy = null;
    this.banner = null;
    this.queue = this.queue.filter(e => e.kind === 'file');
    this.pulses = this.pulses.filter(p => p.wire === 'write' || p.wire === 'write2' || p.wire === 'read');
    for (const c of this.cells) this.paint(c, null, t);
    this.shown = {};
    this.status.loop = ['stopped by the agent', 'its trap: reset, exit 0'];
    if (this.status.tap[0] === 'running…' || this.status.tap[0] === 'tapped') this.status.tap = ['stopped', ''];
    this.step = 5;
    return true;
  }

  connect(t) {
    if (this.link !== 'disconnected') return false;
    this.link = 'connecting';
    this.at(t + HOP.link, 'linkUp');
    this.step = 6;
    return true;
  }

  /** Moves the Mac's clock on: the passes in between are skipped. */
  skipAhead(t, seconds) {
    this.skip += seconds;
    this.skippedAt = t;
    this.queue = this.queue.filter(e => e.kind !== 'pass');
    if (this.running) this.at(this.nextSecond(t), 'pass');
    return true;
  }

  act(t, kind, arg) {
    this.advance(t);
    if (kind === 'tap') return this.tap(t);
    if (kind === 'disconnect') return this.disconnect(t);
    if (kind === 'connect') return this.connect(t);
    if (kind === 'action') return this.action(t, arg);
    if (kind === 'skip') return this.skipAhead(t, arg);
    return false;
  }
}

/** A fresh model run through the tour to diagram time t. */
export function tourAt(mode, t) {
  const sim = new FocusSim(mode);
  for (const [et, kind, arg] of TOURS[sim.mode].events) if (et <= t) sim.act(et, kind, arg);
  sim.advance(t);
  return sim;
}

// ─── A plain button face: icon over title, as the app draws one ──────────────────────────────────────────────

const ICONS = {
  play: (g, c) => svgEl('path', { d: 'M84 52 L84 102 L127 77 Z', fill: c, stroke: c, 'stroke-width': 9,
    'stroke-linejoin': 'round' }, g),
  stop: (g, c) => svgEl('rect', { x: 74, y: 51, width: 52, height: 52, rx: 9, fill: c }, g),
  timer: (g, c) => {
    svgEl('circle', { cx: 100, cy: 81, r: 27, fill: 'none', stroke: c, 'stroke-width': 6.5 }, g);
    svgEl('path', { d: 'M91 44 H109', stroke: c, 'stroke-width': 6.5, 'stroke-linecap': 'round' }, g);
    svgEl('path', { d: 'M100 81 L111 66', stroke: c, 'stroke-width': 6.5, 'stroke-linecap': 'round' }, g);
  },
  check: (g, c) => {
    svgEl('circle', { cx: 100, cy: 77, r: 31, fill: c }, g);
    svgEl('path', { d: 'M86 78 L96 88 L115 66', fill: 'none', stroke: '#1F1F21', 'stroke-width': 7.5,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
  },
  terminal: (g, c) => {
    svgEl('rect', { x: 66, y: 52, width: 68, height: 52, rx: 11, fill: 'none', stroke: c, 'stroke-width': 6 }, g);
    svgEl('path', { d: 'M81 70 L91 79 L81 88 M97 89 H114', fill: 'none', stroke: c, 'stroke-width': 6,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
  },
  dashed: (g, c) => svgEl('circle', { cx: 100, cy: 100, r: 28, fill: 'none', stroke: c, 'stroke-width': 6,
    'stroke-dasharray': '8 7.6' }, g),
};

/** Draws a plain face into a cell; returns update(look, color). */
function plainFace(cell) {
  const tint = svgEl('rect', { x: 0, y: 0, width: 200, height: 200, opacity: 0.05 }, cell.host);
  const icon = svgEl('g', {}, cell.host);
  const label = svgEl('text', { x: 100, y: 152, 'font-size': 27.5, 'font-weight': 'bold', 'text-anchor': 'middle',
    fill: '#FFFFFF', 'fill-opacity': 0.7 }, cell.host);
  let drawn = '';
  return (look, color) => {
    const key = `${look.icon}|${look.title}|${color}`;
    if (key === drawn) return;
    drawn = key;
    tint.setAttribute('fill', color);
    icon.replaceChildren();
    ICONS[look.icon](icon, color);
    icon.setAttribute('transform', look.title ? '' : 'translate(0 22)');
    if (look.icon === 'dashed') icon.setAttribute('transform', '');
    label.textContent = look.title;
  };
}

// ─── Styles ──────────────────────────────────────────────────────────────────────────────────────────────────

const CSS = `
.dt-diagram .ow-stage { position: relative; display: grid; gap: 52px; }
.dt-diagram .ow-wires { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible;
  z-index: 2; }
.dt-diagram .ow-wire { fill: none; stroke: var(--dt-border-strong); stroke-width: 1.5; transition: stroke 0.25s, opacity 0.25s; }
.dt-diagram .ow-wire.ink.lit { stroke: var(--dt-ink); }
.dt-diagram .ow-wire.muted.lit { stroke: var(--dt-body); }
.dt-diagram .ow-wire.accent.lit { stroke: var(--dt-accent); }
.dt-diagram .ow-wire.off { opacity: 0.35; }
.dt-diagram .ow-pulse.ink { fill: var(--dt-ink); }
.dt-diagram .ow-pulse.muted { fill: var(--dt-body); }
.dt-diagram .ow-pulse.accent { fill: var(--dt-accent); }
.dt-diagram .ow-wire-label { font-family: var(--dt-mono); font-size: 9.5px; letter-spacing: 0.06em; fill: var(--dt-muted);
  text-transform: uppercase; }

.dt-diagram .ow-phone { position: relative; z-index: 1; background: #0D0D0D; border: 1px solid var(--dt-border);
  border-radius: 20px; padding: 12px 14px 16px; }
.dt-diagram .ow-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.dt-diagram .ow-tag { font-family: var(--dt-mono); font-size: 0.625rem; letter-spacing: 0.12em; text-transform: uppercase;
  color: rgba(255, 255, 255, 0.45); }
.dt-diagram .ow-badge { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px;
  background: rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.8); font-size: 0.6875rem; line-height: 1.5;
  white-space: nowrap; }
.dt-diagram .ow-badge i { width: 7px; height: 7px; border-radius: 50%; background: #30D158; }
.dt-diagram .ow-badge.off i { background: #FF9F0A; }
.dt-diagram .ow-badge.wait i { background: #8E8E93; }
.dt-diagram .ow-cols { display: grid; grid-template-columns: repeat(var(--ow-cols, 2), minmax(0, 1fr)); gap: 12px; }
.dt-diagram .ow-cellbox { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; }
.dt-diagram .ow-cellbox .dt-cell { width: min(150px, 100%); }
.dt-diagram .ow-cellbox .dt-cell.tappable { cursor: pointer; }
.dt-diagram .ow-cellbox .dt-cell.tappable:focus-visible { outline: 2px solid var(--dt-accent); outline-offset: 2px;
  border-radius: 26px; }
.dt-diagram .ow-cellname { font-family: var(--dt-mono); font-size: 0.5625rem; letter-spacing: 0.1em;
  text-transform: uppercase; color: rgba(255, 255, 255, 0.45); text-align: center; }

.dt-diagram .ow-slot { position: relative; min-width: 0; align-self: center; }
.dt-diagram .ow-slot-empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  border: 1px dashed rgba(255, 255, 255, 0.14); border-radius: 18px; color: rgba(255, 255, 255, 0.35);
  font-size: 0.6875rem; text-align: center; padding: 8px; transition: opacity 0.3s; }
.dt-diagram .ow-slot.filled .ow-slot-empty { opacity: 0; }
.dt-diagram .ow-banner { position: relative; transition: opacity 0.3s, transform 0.3s; }
.dt-diagram .ow-banner.hidden { opacity: 0; transform: translateY(-8px); visibility: hidden; }
.dt-diagram .ow-bn-card { background: #2A2A2D; border-radius: 18px; padding: 9px 12px 10px; color: #FFFFFF;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif; }
.dt-diagram .ow-bn-head { display: flex; align-items: center; gap: 8px; }
.dt-diagram .ow-bn-icon { width: 20px; height: 20px; border-radius: 5px; flex: none;
  background: linear-gradient(135deg, #3B82F6, #1D4ED8); }
.dt-diagram .ow-bn-title { flex: 1; min-width: 0; font-weight: 600; font-size: 0.75rem; line-height: 1.3; }
.dt-diagram .ow-bn-time { font-size: 0.625rem; color: rgba(255, 255, 255, 0.5); }
.dt-diagram .ow-bn-body { margin: 3px 0 0 28px; font-size: 0.6875rem; line-height: 1.35; color: rgba(255, 255, 255, 0.85); }
.dt-diagram .ow-bn-actions { margin-top: 5px; background: #2A2A2D; border-radius: 14px; overflow: hidden; }
.dt-diagram .ow-bn-actions button { display: block; width: 100%; text-align: left; font: inherit; font-size: 0.75rem;
  color: #FFFFFF; background: transparent; border: 0; padding: 7px 12px; cursor: pointer; line-height: 1.3;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif; }
.dt-diagram .ow-bn-actions button + button { border-top: 1px solid rgba(255, 255, 255, 0.1); }
.dt-diagram .ow-bn-actions button:hover { background: rgba(255, 255, 255, 0.06); }
.dt-diagram .ow-bn-actions button.pressed { background: rgba(255, 255, 255, 0.14); }

.dt-diagram .ow-mac { position: relative; z-index: 1; display: block; border: 1px solid var(--dt-border);
  border-radius: 14px; padding: 12px 12px 10px; background: var(--dt-panel); }
.dt-diagram .ow-mac > .ow-cols { margin-bottom: 46px; }
.dt-diagram .ow-mac .ow-tag { display: block; color: var(--dt-muted); margin: 8px 0 0; }
.dt-diagram .ow-box { min-width: 0; border: 1px solid var(--dt-border-strong); border-radius: 10px; padding: 9px 10px 8px;
  background: var(--dt-card); transition: border-color 0.25s, opacity 0.25s; }
.dt-diagram .ow-box.busy { border-color: color-mix(in srgb, var(--dt-ink) 55%, transparent); }
.dt-diagram .ow-box.off { opacity: 0.55; }
.dt-diagram .ow-kind { font-family: var(--dt-mono); font-size: 0.5625rem; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--dt-muted); }
.dt-diagram .ow-name { margin-top: 2px; color: var(--dt-ink); font-weight: 600; font-size: 0.8125rem; line-height: 1.35; }
.dt-diagram .ow-state { margin-top: 5px; font-family: var(--dt-mono); font-size: 0.625rem; line-height: 1.55;
  color: var(--dt-body); min-height: 3.1em; overflow-wrap: anywhere; }
.dt-diagram .ow-state span { display: block; }
.dt-diagram .ow-state span + span { color: var(--dt-muted); }
.dt-diagram .ow-file { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 12px; border-style: dashed; }
.dt-diagram .ow-file.has { border-style: solid; }
.dt-diagram .ow-file.fresh { border-color: var(--dt-ink); }
.dt-diagram .ow-file .ow-path { font-family: var(--dt-mono); font-size: 0.6875rem; color: var(--dt-body);
  overflow-wrap: anywhere; }
.dt-diagram .ow-file .ow-value { font-family: var(--dt-mono); font-size: 0.875rem; font-weight: 600; color: var(--dt-ink); }
.dt-diagram .ow-file .ow-value.none { font-weight: 400; color: var(--dt-muted); font-style: italic; font-size: 0.75rem; }
.dt-diagram .ow-file .dt-chip { margin-left: auto; }
.dt-diagram .ow-skip { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 3;
  font-family: var(--dt-mono); font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--dt-ink); background: var(--dt-card); border: 1px solid var(--dt-border-strong); border-radius: 999px;
  padding: 6px 12px; transition: opacity 0.3s; pointer-events: none; }
.dt-diagram .ow-skip.hidden { opacity: 0; }

.dt-diagram .ow-steps { margin: 16px 0 0; padding: 0; list-style: none; counter-reset: ow; display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 18px; }
.dt-diagram .ow-steps li { counter-increment: ow; display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 6px;
  font-size: 0.75rem; line-height: 1.5; color: var(--dt-muted); padding: 3px 0; transition: color 0.25s; }
.dt-diagram .ow-steps li::before { content: counter(ow); font-family: var(--dt-mono); font-size: 0.625rem; width: 18px;
  height: 18px; border-radius: 50%; border: 1px solid var(--dt-border-strong); display: grid; place-items: center;
  margin-top: 1px; }
.dt-diagram .ow-steps li.now { color: var(--dt-ink); }
.dt-diagram .ow-steps li.now::before { border-color: var(--dt-accent); color: var(--dt-accent);
  background: var(--dt-accent-subtle); }

.dt-diagram .ow-story { display: grid; gap: 10px; }
.dt-diagram .ow-shot { display: grid; grid-template-columns: 26px minmax(0, 1fr) auto; gap: 12px; align-items: center;
  border: 1px solid var(--dt-border); border-radius: 12px; padding: 10px 12px; }
.dt-diagram .ow-shot-n { font-family: var(--dt-mono); font-size: 0.6875rem; width: 24px; height: 24px; border-radius: 50%;
  border: 1px solid var(--dt-border-strong); display: grid; place-items: center; color: var(--dt-body); }
.dt-diagram .ow-shot-text { font-size: 0.8125rem; line-height: 1.5; }
.dt-diagram .ow-shot-text code { font-size: 0.85em; }
.dt-diagram .ow-shot-pics { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.dt-diagram .ow-shot-pics .dt-cell { width: 72px; }
.dt-diagram .ow-shot-file { font-family: var(--dt-mono); font-size: 0.625rem; color: var(--dt-muted); text-align: right;
  min-width: 92px; }
.dt-diagram .ow-shot-file b { display: block; color: var(--dt-ink); font-weight: 600; font-size: 0.6875rem; }
.dt-diagram .ow-shot-note { font-size: 0.625rem; color: rgba(255, 255, 255, 0.85); background: #2A2A2D; border-radius: 10px;
  padding: 5px 8px; max-width: 120px; line-height: 1.3; }
.dt-diagram .ow-shot-off { font-size: 0.625rem; color: #FF9F0A; }

@container dt (max-width: 560px) {
  .dt-diagram .ow-stage { gap: 46px; }
  .dt-diagram .ow-phone { padding: 10px 10px 12px; }
  .dt-diagram .ow-cols { gap: 8px; }
  .dt-diagram .ow-mac { padding: 10px 8px 8px; }
  .dt-diagram .ow-mac > .ow-cols { margin-bottom: 40px; }
  .dt-diagram .ow-box { padding: 8px 8px 7px; }
  .dt-diagram .ow-name { font-size: 0.75rem; }
  .dt-diagram .ow-state { font-size: 0.5625rem; }
  .dt-diagram .ow-steps { grid-template-columns: minmax(0, 1fr); }
  .dt-diagram .ow-shot { grid-template-columns: 26px minmax(0, 1fr); }
  .dt-diagram .ow-shot-pics { grid-column: 1 / -1; justify-content: flex-start; padding-left: 38px; }
  .dt-diagram .ow-shot-file { text-align: left; }
}
`;

// ─── The diagram ─────────────────────────────────────────────────────────────────────────────────────────────

const TEXT = {
  default: {
    eyebrow: 'One writer per button',
    title: 'The tap writes a file. Only the loop draws.',
    lede: 'The focus timer on two buttons. Its tap script stores when the session ends; its startup script reads ' +
      'that file every second and draws both buttons.',
    caption: '<strong>Let the startup script be the only one that draws, and let a tap only change the state and ' +
      'exit.</strong> Then the buttons always show what the file says: after a tap, after a reconnect, after the ' +
      'script restarts. Keep the state in a file under <code>$DESKTAP_STORAGE</code>, never only in the loop’s memory.',
    note: 'Tap Start/Stop yourself, or disconnect the phone. Play runs the tour again.',
  },
  notification: {
    eyebrow: 'One writer per button',
    title: 'An action button is one more tap.',
    lede: 'The focus timer with its notification. The tap and the notification’s Restart 25 min both change ' +
      'focus/end; the startup script reads it every second and is the only one that draws.',
    caption: '<strong>Give a notification’s action the job of a tap: change the state file and exit.</strong> The ' +
      'startup script shows the result on its next pass, as it does after a tap. The action never draws the button.',
    note: 'The tap script here runs with minutes=1, and the diagram skips 55 s of the countdown.',
  },
};

export default function mount(el, { mode = 'default', reducedMotion = false } = {}) {
  ensureStyle('dt-one-writer', CSS);
  const M = mode === 'notification' ? 'notification' : 'default';
  const T = TEXT[M];
  const sw = readSwitches(el, { reducedMotion });
  let reduce = sw.reduced;
  const frozen = sw.at !== null;
  const original = [...el.childNodes];

  const { figure, controls, body, legend, caption, announce } = makeFigure({
    name: 'one-writer', eyebrow: T.eyebrow, title: T.title, lede: T.lede,
  });

  // ── Stage: the phone above, the Mac below, wires between them ──
  const stage = h('div', { class: 'ow-stage' });
  const wiresSvg = svgEl('svg', { class: 'ow-wires', 'aria-hidden': 'true' });
  const live = h('div', { class: 'ow-live' }, stage);
  const story = h('div', { class: 'ow-story', hidden: '' });
  body.append(live, story);

  const badge = h('span', { class: 'ow-badge' }, h('i'), h('span', { text: 'Connected' }));
  const phone = h('div', { class: 'ow-phone' }, h('div', { class: 'ow-top' }, h('span', { class: 'ow-tag', text: 'Phone' }), badge));
  const phoneCols = h('div', { class: 'ow-cols' });
  phone.appendChild(phoneCols);

  const cells = {};
  const cellNames = M === 'notification'
    ? { C: 'The focus timer · you tap it' }
    : { A: 'Start/Stop · you tap it', B: 'Countdown' };
  for (const c of Object.keys(cellNames)) {
    const cell = makeCell({ unit: 160, label: cellNames[c] });
    const draw = plainFace(cell);
    const ring = svgEl('rect', { x: 0, y: 0, width: 200, height: 200, rx: 44.7, fill: 'none', stroke: '#3B82F6',
      'stroke-width': 8, opacity: 0 }, cell.host);
    const ripple = svgEl('circle', { cx: 100, cy: 100, r: 30, fill: '#FFFFFF', opacity: 0 }, cell.host);
    const box = h('div', { class: 'ow-cellbox' }, h('span', { class: 'ow-cellname', text: cellNames[c] }), cell.svg);
    phoneCols.appendChild(box);
    cells[c] = { cell, draw, ring, ripple, box, label: '' };
  }
  const tapCell = M === 'notification' ? 'C' : 'A';
  const tapSvg = cells[tapCell].cell.svg;
  tapSvg.classList.add('tappable');
  tapSvg.setAttribute('role', 'button');
  tapSvg.setAttribute('tabindex', '0');

  // The notification slot (notification mode).
  let bannerEl = null, slotEl = null, actionBtns = {};
  if (M === 'notification') {
    phoneCols.style.gridTemplateColumns = 'minmax(0, 1fr) minmax(0, 2fr)';
    actionBtns.again = h('button', { type: 'button', text: 'Restart 25 min' });
    actionBtns.reset = h('button', { type: 'button', text: 'Reset' });
    bannerEl = h('div', { class: 'ow-banner hidden', attrs: { role: 'group', 'aria-label': 'Notification' } },
      h('div', { class: 'ow-bn-card' },
        h('div', { class: 'ow-bn-head' }, h('span', { class: 'ow-bn-icon' }),
          h('span', { class: 'ow-bn-title', text: 'Focus time is up' }), h('span', { class: 'ow-bn-time', text: 'now' })),
        h('p', { class: 'ow-bn-body', text: 'Take a break, or start another round.' })),
      h('div', { class: 'ow-bn-actions' }, actionBtns.again, actionBtns.reset));
    slotEl = h('div', { class: 'ow-slot' }, h('div', { class: 'ow-slot-empty', text: 'Its notification shows here' }), bannerEl);
    phoneCols.appendChild(slotEl);
  }

  // The Mac: script boxes, then the state file.
  const mac = h('div', { class: 'ow-mac' });
  const macRow = h('div', { class: 'ow-cols' });
  const box = (kind, name) => {
    const state = h('div', { class: 'ow-state' }, h('span'), h('span'));
    const el2 = h('div', { class: 'ow-box' }, h('div', { class: 'ow-kind', text: kind }), h('div', { class: 'ow-name', text: name }), state);
    return { el: el2, state };
  };
  const boxes = {
    tap: box('Tap script', 'Shell Command'),
    loop: box('Startup script', 'A loop, once a second'),
  };
  macRow.append(boxes.tap.el, boxes.loop.el);
  if (M === 'notification') {
    boxes.action = box('Notification action', 'Restart 25 min');
    macRow.appendChild(boxes.action.el);
    macRow.style.setProperty('--ow-cols', '3');
  }
  const fileValue = h('span', { class: 'ow-value' });
  const fileChip = h('span', { class: 'dt-chip ok', text: 'Stays', hidden: '' });
  const fileBox = h('div', { class: 'ow-box ow-file' },
    h('div', { class: 'ow-kind', text: 'State file' }),
    h('span', { class: 'ow-path', text: '$DESKTAP_STORAGE/focus/end' }), fileValue, fileChip);
  mac.append(macRow, fileBox, h('span', { class: 'ow-tag', text: 'Mac · Desktap Agent runs the scripts' }));
  const skipChip = h('div', { class: 'ow-skip hidden', text: '⏩ 55 s later', attrs: { 'aria-hidden': 'true' } });
  mac.appendChild(skipChip);
  stage.append(wiresSvg, phone, mac);

  // Steps.
  const stepsEl = h('ol', { class: 'ow-steps' });
  STEPS[M].forEach(([a, b]) => stepsEl.appendChild(h('li', {}, h('span', {}, h('strong', { text: a }), ' ', b))));
  live.append(stepsEl);

  // ── Wires ──
  const markerId = uid('ow-arrow');
  const defs = svgEl('defs', {}, wiresSvg);
  for (const k of ['ink', 'muted', 'accent']) {
    const m = svgEl('marker', { id: `${markerId}-${k}`, viewBox: '0 0 8 8', refX: 6.5, refY: 4, markerWidth: 7,
      markerHeight: 7, orient: 'auto-start-reverse' }, defs);
    svgEl('path', { d: 'M1 1 L7 4 L1 7', fill: 'none', stroke: k === 'ink' ? 'var(--dt-ink)' : k === 'muted' ? 'var(--dt-body)' : 'var(--dt-accent)',
      'stroke-width': 1.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, m);
  }
  const WIRES = M === 'notification'
    ? {
      tap: { from: () => [cells.C.cell.svg, 'bottom', 0.35], to: () => [boxes.tap.el, 'top', 0.5], color: 'ink', label: 'tap' },
      postC: { from: () => [boxes.loop.el, 'top', 0.25], to: () => [cells.C.cell.svg, 'bottom', 0.72], color: 'accent', label: 'draws' },
      notify: { from: () => [boxes.loop.el, 'top', 0.75], to: () => [slotEl, 'bottom', 0.18], color: 'accent', label: 'notifies' },
      action: { from: () => [slotEl, 'bottom', 0.72], to: () => [boxes.action.el, 'top', 0.5], color: 'ink', label: 'tap' },
      write: { from: () => [boxes.tap.el, 'bottom', 0.5], to: () => [fileBox, 'top', 0.18], color: 'ink' },
      read: { from: () => [fileBox, 'top', 0.5], to: () => [boxes.loop.el, 'bottom', 0.5], color: 'muted', label: 'reads' },
      write2: { from: () => [boxes.action.el, 'bottom', 0.5], to: () => [fileBox, 'top', 0.82], color: 'ink' },
    }
    : {
      tap: { from: () => [cells.A.cell.svg, 'bottom', 0.35], to: () => [boxes.tap.el, 'top', 0.45], color: 'ink', label: 'tap' },
      postA: { from: () => [boxes.loop.el, 'top', 0.2], to: () => [cells.A.cell.svg, 'bottom', 0.72], color: 'accent', label: 'draws' },
      postB: { from: () => [boxes.loop.el, 'top', 0.62], to: () => [cells.B.cell.svg, 'bottom', 0.5], color: 'accent' },
      write: { from: () => [boxes.tap.el, 'bottom', 0.5], to: () => [fileBox, 'top', 0.25], color: 'ink', label: 'writes' },
      read: { from: () => [fileBox, 'top', 0.75], to: () => [boxes.loop.el, 'bottom', 0.5], color: 'muted', label: 'reads' },
    };
  const wireEls = {};
  for (const [name, w] of Object.entries(WIRES)) {
    const path = svgEl('path', { class: `ow-wire ${w.color}`, 'marker-end': `url(#${markerId}-${w.color})` }, wiresSvg);
    const label = w.label ? svgEl('text', { class: 'ow-wire-label' }, wiresSvg) : null;
    if (label) label.textContent = w.label;
    wireEls[name] = { path, label, len: 0 };
  }
  const pulsePool = [];
  const pulseLayer = svgEl('g', {}, wiresSvg);

  function anchor([node, side, fx]) {
    const s = stage.getBoundingClientRect(), r = node.getBoundingClientRect();
    let x = r.left - s.left + r.width * fx, y = side === 'top' ? r.top - s.top : r.bottom - s.top;
    if (node.classList && node.classList.contains('dt-cell')) {          // the glass button, not its screen margin
      const inset = r.height * 0.075;
      y += side === 'top' ? inset : -inset;
      x = r.left - s.left + r.width * (0.08 + 0.84 * fx);
    }
    return [x, y];
  }
  let layoutKey = '';
  function layoutWires() {
    const s = stage.getBoundingClientRect();
    if (s.width < 10) return;
    const key = [s.width, s.height, ...Object.keys(WIRES).map(k => anchor(WIRES[k].from()).join(','))].join('|');
    if (key === layoutKey) return;
    layoutKey = key;
    wiresSvg.setAttribute('viewBox', `0 0 ${s.width} ${s.height}`);
    for (const [name, w] of Object.entries(WIRES)) {
      const [x1, y1] = anchor(w.from()), [x2, y2] = anchor(w.to());
      const ym = (y1 + y2) / 2;
      const d = `M${x1.toFixed(1)} ${y1.toFixed(1)} C${x1.toFixed(1)} ${ym.toFixed(1)} ${x2.toFixed(1)} ${ym.toFixed(1)} ${x2.toFixed(1)} ${(y2 + (y2 > y1 ? -3 : 3)).toFixed(1)}`;
      const el2 = wireEls[name];
      el2.path.setAttribute('d', d);
      el2.len = el2.path.getTotalLength();
      if (el2.label) {
        const p = el2.path.getPointAtLength(el2.len * 0.5);
        el2.label.setAttribute('x', (p.x + 6).toFixed(1));
        el2.label.setAttribute('y', (p.y + 3).toFixed(1));
      }
    }
  }

  // ── Model and clock ──
  let sim = new FocusSim(M);
  let simBase = 0;               // diagram time at which this sim's clock started
  let touring = true, tourIdx = 0, playing = false, view = 'live';
  const tour = TOURS[M];

  function resetTour(time) {
    sim = new FocusSim(M);
    simBase = time;
    tourIdx = 0;
    touring = true;
  }

  function stepTour(time) {
    if (!touring) return;
    let tt = time - simBase;
    while (tt >= tour.length) {           // the tour is over: start again
      const end = simBase + tour.length;
      runTourTo(end);
      resetTour(end);
      tt = time - simBase;
    }
    runTourTo(time);
  }
  function runTourTo(time) {
    const tt = time - simBase;
    while (tourIdx < tour.events.length && tour.events[tourIdx][0] <= tt) {
      const [et, kind, arg] = tour.events[tourIdx++];
      sim.act(et, kind, arg);
      if (kind === 'action' && actionBtns[arg]) flashButton(actionBtns[arg]);
    }
    sim.advance(tt);
  }

  // ── Drawing ──
  const lastStatus = {};
  function setState(boxObj, lines, key) {
    const k = lines.join('\n');
    if (lastStatus[key] === k) return;
    lastStatus[key] = k;
    boxObj.state.children[0].textContent = lines[0];
    boxObj.state.children[1].textContent = lines[1];
  }
  let lastStep = -1, lastLink = '';
  function render(time) {
    const t = time - simBase;
    for (const [c, parts] of Object.entries(cells)) {
      const look = sim.lookOf(c);
      parts.draw(look, sim.colorAt(c, t, reduce));
      const label = `${cellNames[c]}: shows ${look.title || 'its icon'}${sim.phone[c].look ? '' : ' (its saved look)'}`;
      if (label !== parts.label) { parts.label = label; parts.cell.setLabel(label); }
      const busy = c === tapCell && sim.busy === 'tap';
      parts.ring.setAttribute('opacity', busy ? (reduce ? 0.8 : (0.55 + 0.45 * Math.sin((t - sim.busySince) * 9)).toFixed(3)) : 0);
      const since = t - sim.busySince;
      const rip = c === tapCell && sim.busy === 'tap' && since < 0.45 && !reduce;
      parts.ripple.setAttribute('opacity', rip ? (0.28 * (1 - since / 0.45)).toFixed(3) : 0);
      parts.ripple.setAttribute('r', (30 + since * 120).toFixed(1));
    }
    if (sim.link !== lastLink) {
      lastLink = sim.link;
      badge.className = `ow-badge${sim.link === 'disconnected' ? ' off' : sim.link === 'connecting' ? ' wait' : ''}`;
      badge.lastChild.textContent = sim.link === 'disconnected' ? 'Disconnected' : sim.link === 'connecting' ? 'Connecting…' : 'Connected';
      tapSvg.setAttribute('aria-disabled', String(sim.link !== 'connected'));
      syncButtons();
    }
    if (bannerEl) {
      const show = !!sim.banner;
      bannerEl.classList.toggle('hidden', !show);
      slotEl.classList.toggle('filled', show);       // the dashed placeholder hides behind a shown banner
      for (const b of Object.values(actionBtns)) b.disabled = !show;
    }
    setState(boxes.tap, sim.status.tap, 'tap');
    setState(boxes.loop, sim.status.loop, 'loop');
    if (boxes.action) setState(boxes.action, sim.status.action, 'action');
    boxes.tap.el.classList.toggle('busy', sim.busy === 'tap');
    if (boxes.action) boxes.action.el.classList.toggle('busy', sim.busy === 'action');
    boxes.loop.el.classList.toggle('off', !sim.running);
    const has = sim.file !== null;
    fileBox.classList.toggle('has', has);
    fileBox.classList.toggle('fresh', t - sim.fileSince < 0.6);
    const fv = has ? String(sim.file) : 'no file';
    if (fileValue.textContent !== fv) { fileValue.textContent = fv; fileValue.classList.toggle('none', !has); }
    fileChip.hidden = !(sim.link !== 'connected' && has);
    skipChip.classList.toggle('hidden', !(t - sim.skippedAt < 1.4));

    // Wires and pulses.
    for (const [name, w] of Object.entries(wireEls)) {
      w.path.classList.toggle('lit', (sim.lit[name] ?? -10) > t - (reduce ? 0.6 : 0.12));
      w.path.classList.toggle('off', sim.link !== 'connected' && /^(tap|post|notify|action)/.test(name));
    }
    const active = reduce ? [] : sim.pulses.filter(p => t >= p.t0 && t < p.t0 + p.dur && wireEls[p.wire]?.len > 0);
    while (pulsePool.length < active.length) pulsePool.push(svgEl('circle', { r: 4.2, class: 'ow-pulse' }, pulseLayer));
    pulsePool.forEach((dot, i) => {
      const p = active[i];
      if (!p) { dot.setAttribute('visibility', 'hidden'); return; }
      const w = wireEls[p.wire];
      const pt = w.path.getPointAtLength(w.len * EASE.easeInOut(clamp01((t - p.t0) / p.dur)));
      dot.setAttribute('visibility', 'visible');
      dot.setAttribute('class', `ow-pulse ${WIRES[p.wire].color}`);
      dot.setAttribute('cx', pt.x.toFixed(1));
      dot.setAttribute('cy', pt.y.toFixed(1));
    });

    if (sim.step !== lastStep) {
      lastStep = sim.step;
      [...stepsEl.children].forEach((li, i) => li.classList.toggle('now', i === sim.step - 1));
    }
  }

  const loop = new Loop({
    root: figure,
    onFrame(time) {
      if (playing) stepTour(time);
      if (!touring || !playing) sim.advance(time - simBase);
      render(time);
      return playing;
    },
  });

  // ── Controls ──
  const playBtn = makeButton({ label: '❚❚ Pause', pressed: true, onClick: () => {
    if (playing) setPlaying(false);
    else {
      if (!touring) resetTour(loop.time);
      setPlaying(true);
    }
  } });
  const tapBtn = makeButton({ label: M === 'notification' ? 'Tap the button' : 'Tap Start/Stop', primary: true,
    onClick: () => readerAct('tap') });
  const linkBtn = M === 'default' ? makeButton({ label: 'Disconnect', onClick: () => readerAct(sim.link === 'connected' ? 'disconnect' : 'connect') }) : null;
  const skipBtn = M === 'notification' ? makeButton({ label: '⏩ 55 s later', onClick: () => readerAct('skip', 55) }) : null;
  const viewSeg = makeSegmented({ label: 'View', options: [['live', 'Live'], ['story', 'Steps']], value: 'live',
    onChange: v => setView(v) });
  controls.append(playBtn, tapBtn, ...(linkBtn ? [linkBtn] : []), ...(skipBtn ? [skipBtn] : []),
    h('span', { class: 'dt-spacer' }), viewSeg.el);

  function syncButtons() {
    if (linkBtn) linkBtn.textContent = sim.link === 'connected' ? 'Disconnect' : 'Connect';
    if (linkBtn) linkBtn.disabled = sim.link === 'connecting';
    tapBtn.disabled = sim.link !== 'connected';
  }

  function readerAct(kind, arg) {
    if (frozen) return;
    if (view !== 'live') setView('live');
    touring = false;
    const t = loop.time - simBase;
    const done = sim.act(t, kind, arg);
    if (!playing) setPlaying(true);
    syncButtons();
    if (!done) {
      announce(sim.link !== 'connected' ? 'The phone is not connected.' : 'A script of this button is still running.');
    } else {
      const words = { tap: 'Tapped.', disconnect: 'The phone disconnected.', connect: 'The phone connects again.',
        skip: '55 seconds later.', action: 'Tapped Restart 25 min.' };
      announce(words[kind] || '');
    }
    loop.renderNow();
    loop.wake();
  }
  tapSvg.addEventListener('click', () => readerAct('tap'));
  tapSvg.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); readerAct('tap'); }
  });
  for (const [id, b] of Object.entries(actionBtns)) b.addEventListener('click', () => { flashButton(b); readerAct('action', id); });

  let flashTimer = 0;
  function flashButton(b) {
    b.classList.add('pressed');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => b.classList.remove('pressed'), 350);
  }

  function setPlaying(on) {
    playing = on && !frozen;
    playBtn.setAttribute('aria-pressed', String(playing));
    playBtn.textContent = playing ? '❚❚ Pause' : '▶ Play';
    playBtn.title = !playing && !touring ? 'Plays the tour from the start' : '';
    if (playing) loop.wake(); else loop.sleep();
    loop.renderNow();
  }

  // ── Steps view (the storyboard) ──
  function buildStory() {
    story.replaceChildren();
    SNAPSHOTS[M].forEach((at, i) => {
      const s = tourAt(M, at);
      const pics = h('div', { class: 'ow-shot-pics' });
      for (const c of s.cells) {
        const cell = makeCell({ unit: 80, label: `${cellNames[c]}: ${s.lookOf(c).title || 'its icon'}` });
        plainFace(cell)(s.lookOf(c), s.lookOf(c).color);
        pics.appendChild(cell.svg);
      }
      if (s.banner) pics.appendChild(h('div', { class: 'ow-shot-note' }, h('strong', { text: 'Focus time is up' }), h('br'), 'Restart 25 min · Reset'));
      if (s.link !== 'connected') pics.appendChild(h('span', { class: 'ow-shot-off', text: 'Disconnected' }));
      pics.appendChild(h('div', { class: 'ow-shot-file' }, 'focus/end', h('b', { text: s.file === null ? 'no file' : String(s.file) })));
      const [a, b] = STEPS[M][i];
      story.appendChild(h('section', { class: 'ow-shot', attrs: { 'aria-label': `Step ${i + 1}` } },
        h('span', { class: 'ow-shot-n', text: String(i + 1) }),
        h('p', { class: 'ow-shot-text' }, h('strong', { text: a }), ' ', b),
        pics));
    });
  }

  function setView(next) {
    view = next === 'story' ? 'story' : 'live';
    if (view === 'story') {
      if (playing) setPlaying(false);
      if (!story.childElementCount) buildStory();
    }
    story.hidden = view !== 'story';
    live.hidden = view === 'story';
    viewSeg.set(view);
    if (view === 'live') requestAnimationFrame(() => { layoutWires(); loop.renderNow(); });
  }

  makeLegend([
    { swatch: 'ow-ink', text: 'A tap or an action runs a script that changes the file' },
    { swatch: 'muted', text: 'The loop reads the file' },
    { swatch: 'glide', text: 'Only the loop draws' },
  ], legend);
  ensureStyle('dt-one-writer-legend', '.dt-diagram .dt-swatch.ow-ink { background: var(--dt-ink); }');
  caption.innerHTML = T.caption;
  caption.appendChild(h('p', { class: 'dt-note', text: T.note }));

  el.replaceChildren(figure);

  const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => { layoutWires(); loop.renderNow(); });
  if (ro) ro.observe(stage);
  layoutWires();

  if (frozen) {
    sim = tourAt(M, sw.at);
    tourIdx = tour.events.filter(e => e[0] <= sw.at).length;
    loop.time = sw.at;
    loop.speed = 0;
    setPlaying(false);
  } else if (reduce) {
    touring = false;
    setPlaying(false);
    setView('story');
  } else {
    setPlaying(true);
  }
  if (sw.view === 'story') setView('story');
  syncButtons();
  loop.renderNow();

  const unwatch = watchReducedMotion(on => {
    reduce = on || sw.reduced;
    if (reduce) { touring = false; setPlaying(false); setView('story'); }
  });

  return {
    destroy() {
      unwatch();
      clearTimeout(flashTimer);
      if (ro) ro.disconnect();
      loop.destroy();
      el.replaceChildren(...original);
    },
  };
}
