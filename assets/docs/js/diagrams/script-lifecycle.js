/*
 * D3 · A startup script's life.
 *   short  Live widgets › Startup scripts: the four states and how the phone lists each one (the ⚠ count next to
 *          the Mac's name, orange while the button fails and gray while its script doesn't run, and its row in
 *          Errors), the waits before a failed script is started again (5, 10, 20, 40, 60 s, then every minute;
 *          Failed from the 6th failure in a row), and the minute a fixed script stays listed.
 *   full   How scripts run › Restarts and states: the same, plus the stop timeline — the agent sends SIGTERM to the
 *          script and everything it started and SIGKILL 2 s later; three traps side by side (exit 0 / no exit /
 *          an EXIT trap next to a TERM trap that both clean up).
 * Facts: StartupScriptManagerImpl (restartDelays, transientAttempts, healthyUptime), RunningScriptsView (the Mac's
 * texts), ButtonErrorsChip (count, orange/gray), ButtonErrorTexts (headlines, source lines, hints),
 * ButtonErrorsSheet (sections, actions), ButtonErrorRegistryImpl (healthyUptime 60 s), StartupScriptStatusDisplay
 * (Advanced › Status colors), ProcessRegistry (TERM, KILL after 2 s); the traps as the scripts-runtime fact sheet
 * measured them. The waits are shown sped up; the diagram says so.
 *
 * mount(el, { mode, reducedMotion }) → { destroy() }
 * Test switches (face-player.js readSwitches): data-at / ?dt-at=<s>, data-view / ?dt-view=story, ?dt-motion=reduce.
 */
import { Loop, svgEl, readSwitches, watchReducedMotion } from '../face-player.js';
import { ensureStyle, h, makeFigure, makeButton, makeSegmented, makeLegend } from '../dt-chrome.js';
import { plainCell, BLUE } from './round-trip.js';

// ─── Facts (the node test checks them) ──────────────────────────────────────────────────────────────────────────

/** Waits before the next start after failure 1, 2, 3, 4, 5; the last one repeats forever. */
export const RESTART_DELAYS = Object.freeze([5, 10, 20, 40, 60]);
/** From this failure in a row on, the script is Failed (and still retried every minute). */
export const FAILED_FROM = RESTART_DELAYS.length + 1;
/** The agent's grace between SIGTERM and SIGKILL, in seconds. */
export const KILL_AFTER = 2;
/** How long a script that failed must run again before the phone moves its row to Earlier, in seconds. */
export const HEALTHY_AFTER = 60;

/** State after the n-th failure in a row: what the phone and the Mac's Scripts list (and Running Scripts window) say. */
export function afterFailure(n) {
  const delay = RESTART_DELAYS[Math.min(n - 1, RESTART_DELAYS.length - 1)];
  return n >= FAILED_FROM
    ? { state: 'failed', delay, mac: `Failed — retrying in ${delay}s (attempt ${n})` }
    : { state: 'restarting', delay, mac: `Restarting in ${delay}s (attempt ${n})` };
}

const ERROR = 'Exit code 3';
/**
 * Each state: Advanced › Status, the ⚠ count (null = none), where the phone lists the button, the Mac's text, and
 * the button's row in Errors (headline, source line and hint as the English app shows them).
 */
export const STATES = Object.freeze({
  running: { status: 'Running', chip: null, where: 'not listed', mac: 'Running' },
  restarting: { status: 'Restarting', chip: 'orange', where: 'Not working now · orange ⚠',
    row: { section: 'Not working now', headline: 'Script crashed', source: 'Startup script',
      words: ERROR, hint: 'The agent will restart it shortly.' } },
  failed: { status: 'Failed', chip: 'orange', where: 'Not working now · orange ⚠',
    row: { section: 'Not working now', headline: 'Script keeps failing', source: 'Startup script',
      words: ERROR, hint: 'The agent keeps trying to restart it.' } },
  exited: { status: 'Not Running', chip: 'gray', where: 'Not running · gray ⚠', mac: 'Exited',
    row: { section: 'Not running', headline: 'Script finished', source: 'Startup script',
      hint: "It won't run again until you restart it." } },
  stopped: { status: 'Not Running', chip: 'gray', where: 'Not running · gray ⚠', mac: 'Stopped',
    row: { section: 'Not running', headline: 'Script stopped', source: 'Startup script',
      hint: 'It stays stopped until you restart it.' } },
});

// The phone's own colors (dark), on its fixed screen patch.
const ORANGE = '#FF9F0A';                    // statusWarning: the ⚠ count while a button fails; Restarting
const RED = '#FF453A';                       // Advanced › Status: Failed
const GRAY = 'rgba(255,255,255,0.7)';        // textSecondary: the ⚠ count while only scripts that don't run are left
const DISK = { label: '412 GB free', icon: 'internaldrive.fill', color: BLUE };
const DISK_SAVED = { label: 'Disk', icon: 'circle.dashed', color: BLUE };
const BUTTON_NAME = 'Disk';
const PLACE = 'Default › Main';
const MAC_NAME = 'MacBook Pro';

// ─── Part A: the life of the free-disk widget's startup script, as a small simulation ────────────────────────────

/** Diagram seconds standing in for the real waits (sped up), and for one run of the script. */
const SHOWN_WAIT = n => (n >= FAILED_FROM ? 2.6 : 0.6 + 0.1 * n);
const RUN = 0.8;
/** A minute, sped up as the Failed waits are: how long a fixed script stays in Not working now. */
const SHOWN_MINUTE = SHOWN_WAIT(FAILED_FROM);
/** How long Show Button outlines the button (1.5 s on the phone). */
const OUTLINE = 1.5;

export const SCENARIOS = Object.freeze([
  { id: 'fails', name: 'Fails', note: 'The script ends with exit 3 on every run.' },
  { id: 'exits', name: 'Ends with 0', note: 'The loop comes to an end and the script exits with 0.' },
  { id: 'stopped', name: 'Stopped', note: 'You click Stop on the Mac, under Scripts in the agent window.' },
]);

/** The reader's actions in the autoplay of each scenario: [diagram seconds, action]. */
function readerScript(id) {
  if (id === 'fails') {
    let t = 0, n = 0;
    while (n < FAILED_FROM) { t += RUN; n += 1; if (n < FAILED_FROM) t += SHOWN_WAIT(n); }
    const restart = t + 2.2;
    return { actions: [[t + 0.7, 'tap'], [restart, 'restart']], end: restart + SHOWN_MINUTE + 1.6 };
  }
  if (id === 'exits') return { actions: [[1.6, 'exit0'], [3.1, 'tap'], [4.9, 'restart']], end: 6.9 };
  return { actions: [[1.6, 'stop'], [3.1, 'tap'], [4.9, 'restart']], end: 6.9 };
}

const failing = state => state === 'restarting' || state === 'failed';

/** The script, the agent and the phone for one scenario, from a fresh start at time 0. Pure apart from its own state. */
export class Life {
  constructor(id) {
    this.id = id;
    this.fixed = false;
    this.state = 'running';
    this.failures = 0;
    this.live = true;
    /** The button's row in Errors: { state, count, active }; null = not listed. Inactive = in Earlier. */
    this.row = null;
    /** Errors is open. */
    this.list = false;
    /** Show Button's outline is on until this diagram time. */
    this.outlineUntil = -1;
    this.event = { text: 'The phone connects: the agent starts the script.', at: 0, kind: 'start' };
    this.queue = [];
    this.now = 0;
    const r = readerScript(id);
    this.end = r.end;
    for (const [at, kind] of r.actions) this.push(at, kind, 'reader');
    this.planRun(0);
  }

  push(at, kind, from = 'script') { this.queue.push({ at, kind, from }); this.queue.sort((a, b) => a.at - b.at); }
  drop(kinds) { this.queue = this.queue.filter(e => e.from === 'reader' || !kinds.includes(e.kind)); }
  planRun(at) { if (this.id === 'fails' && !this.fixed) this.push(at + RUN, 'fail'); }
  /** The phone keeps a failed script's row in Not working now until the script has run a minute. */
  planHealthy(at) {
    if (this.failingNow && !this.queue.some(e => e.kind === 'healthy')) this.push(at + SHOWN_MINUTE, 'healthy', 'phone');
  }

  /** The button fails now: its row is in Not working now and the ⚠ count is orange. */
  get failingNow() { return !!this.row && this.row.active && failing(this.row.state); }
  /** The ⚠ count next to the Mac's name: 'orange', 'gray' or null (none). */
  get chip() { return this.row && this.row.active ? (failing(this.row.state) ? 'orange' : 'gray') : null; }
  /** The section of Errors the button's row is in; null when it is not listed. */
  get section() { return this.row ? (this.row.active ? STATES[this.row.state].row.section : 'Earlier') : null; }
  get outlined() { return this.now < this.outlineUntil; }

  /** Applies everything up to time t. */
  advance(t) {
    while (this.queue.length && this.queue[0].at <= t) this.apply(this.queue.shift());
    this.now = t;
    return this;
  }

  apply(e, at = e.at) {
    const say = (text, kind = e.kind) => { this.event = { text, at, kind }; };
    switch (e.kind) {
      case 'fail': {
        this.failures += 1;
        const f = afterFailure(this.failures);
        this.state = f.state;
        this.drop(['healthy']);
        this.row = { state: f.state, count: this.failures, active: true };
        this.push(at + SHOWN_WAIT(this.failures), 'start');
        say(f.state === 'failed'
          ? `It ends with exit 3 again: failure ${this.failures} in a row, so it is Failed. The agent still starts it every minute.`
          : this.failures === 1
            ? 'It ends with exit 3: failure 1 in a row. The agent starts it again in 5 s, and the phone counts the button at once: an orange ⚠ 1.'
            : `It ends with exit 3: failure ${this.failures} in a row. The agent starts it again in ${f.delay} s.`);
        break;
      }
      case 'start':
        this.state = 'running';
        this.planRun(at);
        this.planHealthy(at);
        say('The agent starts it again. The ⚠ count stays until a run lasts a minute.');
        break;
      case 'exit0':
        this.drop(['fail', 'start', 'healthy']);
        this.state = 'exited';
        this.row = { state: 'exited', count: 1, active: true };
        say('It ends with exit 0: finished. The agent does not start it again. The button keeps its last look, and a gray ⚠ 1 appears.');
        break;
      case 'stop':
        this.drop(['fail', 'start', 'healthy']);
        this.state = 'stopped';
        this.live = false;
        this.row = { state: 'stopped', count: 1, active: true };
        say('You click Stop on the Mac. It stays stopped, the button shows its saved look, and a gray ⚠ 1 appears.');
        break;
      case 'tap':
        if (!this.chip || this.list) return;
        this.list = true;
        say('You tap the ⚠ count: the list says why.');
        break;
      case 'cancel':
        if (!this.list) return;
        this.list = false;
        say('Done closes the list.');
        break;
      case 'show':
        if (!this.list) return;
        this.list = false;
        this.outlineUntil = at + OUTLINE;
        say('Show Button closes the list and outlines the button on its page.');
        break;
      case 'clear':
        if (!this.row || this.row.active) return;
        this.row = null;
        say('Clear forgets what no longer holds: the list is empty.');
        break;
      case 'restart': {
        const wasRunning = this.state === 'running';
        const wasFailing = this.failingNow, wasOff = !!this.row && this.row.active && !wasFailing;
        this.drop(['fail', 'start', 'paint']);
        if (this.id === 'fails') this.fixed = true;
        this.failures = 0;
        this.state = 'running';
        if (wasRunning) this.live = false;
        if (!this.live) this.push(at + 0.4, 'paint');
        this.planRun(at);
        if (wasOff) this.row = { ...this.row, active: false };
        this.planHealthy(at);
        say(wasFailing
          ? 'You fix the script and tap Restart Script: it runs again, and the count of failures starts over. The row stays in Not working now for a minute (sped up here).'
          : wasOff
            ? 'You tap Restart Script: it runs again, sends its value, and the row moves to Earlier. The ⚠ count goes away.'
            : 'You tap Restart Script: it starts again and sends its value.');
        break;
      }
      case 'healthy':
        if (!this.failingNow) return;
        this.row = { ...this.row, active: false };
        say('A minute without a failure: the row moves to Earlier, and the ⚠ count goes away.');
        break;
      case 'paint':
        this.live = true;
        return;
      default:
    }
  }

  /** A reader's action right now (outside the autoplay). */
  act(kind, t) { this.advance(t); this.queue = this.queue.filter(e => e.from !== 'reader'); this.apply({ kind, at: t }); }

  get mac() {
    if (this.state === 'restarting' || this.state === 'failed') return afterFailure(this.failures).mac;
    return STATES[this.state].mac;
  }
}

/** The state of a scenario's autoplay at time t. */
export function lifeAt(id, t) { return new Life(id).advance(t); }

// ─── The phone's symbols (SF Symbols drawn small) ───────────────────────────────────────────────────────────────

/** A triangle with rounded corners around three points, as a path. */
function roundedTriangle(pts, r) {
  let d = '';
  pts.forEach((p, i) => {
    const prev = pts[(i + 2) % 3], next = pts[(i + 1) % 3];
    const along = q => { const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy); return [p[0] + dx / l * r, p[1] + dy / l * r]; };
    const a = along(prev), b = along(next);
    d += `${i ? ' L' : 'M'} ${a[0].toFixed(2)} ${a[1].toFixed(2)} Q ${p[0]} ${p[1]} ${b[0].toFixed(2)} ${b[1].toFixed(2)}`;
  });
  return d + ' Z';
}

/** exclamationmark.triangle.fill in a 20 × 18 box: the "!" is cut out (fill-rule evenodd). */
const WARN_D = roundedTriangle([[10, 0.9], [19.4, 17.2], [0.6, 17.2]], 2.4) +
  ' M 8.85 6.7 A 1.15 1.15 0 0 1 11.15 6.7 L 10.85 11.4 A 0.85 0.85 0 0 1 9.15 11.4 Z' +
  ' M 8.7 14.2 A 1.3 1.3 0 1 0 11.3 14.2 A 1.3 1.3 0 1 0 8.7 14.2 Z';

function warnGlyph(parent, { x = 0, y = 0, size = 20, fill = 'currentColor' } = {}) {
  const s = size / 20;
  return svgEl('path', { d: WARN_D, 'fill-rule': 'evenodd', fill, transform: `translate(${x} ${y}) scale(${s})` }, parent);
}

/** The glyph inside the ⚠ count: tinted by the count's CSS color. */
function warnIcon(px) {
  const svg = svgEl('svg', { viewBox: '0 0 20 18', width: px, height: +(px * 0.9).toFixed(1), 'aria-hidden': 'true' });
  warnGlyph(svg);
  return svg;
}

/** A row's symbol: exclamationmark.triangle.fill, or stop.circle for a startup script that doesn't run. */
function rowSymbol() {
  const svg = svgEl('svg', { viewBox: '0 0 20 20', width: 17, height: 17, 'aria-hidden': 'true', class: 'lc-sym' });
  const warn = warnGlyph(svg, { y: 1 });
  const stop = svgEl('g', {}, svg);
  svgEl('circle', { cx: 10, cy: 10, r: 8.2, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.7 }, stop);
  svgEl('rect', { x: 7, y: 7, width: 6, height: 6, rx: 1.3, fill: 'currentColor' }, stop);
  return {
    svg,
    set(kind) { warn.style.display = kind === 'stop' ? 'none' : ''; stop.style.display = kind === 'stop' ? '' : 'none'; },
  };
}

/** checkmark.circle, for the empty list. */
function checkIcon() {
  const svg = svgEl('svg', { viewBox: '0 0 24 24', width: 26, height: 26, 'aria-hidden': 'true' });
  svgEl('circle', { cx: 12, cy: 12, r: 10, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6 }, svg);
  svgEl('path', { d: 'M 7.4 12.4 L 10.6 15.4 L 16.6 8.8', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
  return svg;
}

/** A 36 × 22 icon for the list of states: the ⚠ count on a patch of the phone's screen, or the bare patch. */
function countIcon(chip) {
  const svg = svgEl('svg', { viewBox: '0 0 36 22', width: 36, height: 22, 'aria-hidden': 'true', class: 'lc-icon' });
  svgEl('rect', { width: 36, height: 22, rx: 6, fill: '#0D0D0D' }, svg);
  if (chip) {
    const tint = chip === 'orange' ? ORANGE : GRAY;
    svgEl('rect', { x: 4, y: 4, width: 28, height: 14, rx: 7, fill: tint, 'fill-opacity': 0.16 }, svg);
    warnGlyph(svg, { x: 8, y: 6.5, size: 10, fill: tint });
    svgEl('text', { x: 23.5, y: 14.6, 'text-anchor': 'middle', 'font-size': 9.5, 'font-weight': 600, fill: tint,
      'font-family': '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }, svg).textContent = '1';
  }
  return svg;
}

// ─── Part B: the stop timeline ──────────────────────────────────────────────────────────────────────────────────

/** The clock button whose loop sends the time every second; Stop on the Mac at 0 s. */
export const STOP_AXIS = Object.freeze([-0.5, 2.5]);
export const STOP_TRACKS = Object.freeze([
  {
    id: 'exit', chip: 'ok', verdict: 'Ends at once', code: ['trap \'…; exit 0\' TERM INT'], end: 0.06,
    events: [{ at: 0.04, kind: 'reset', label: 'reset, ends' }],
    result: 'The trap resets the button once and the script ends. The saved look stays.',
  },
  {
    id: 'noexit', chip: 'fade', verdict: 'Paints again', code: ['trap \'…\' TERM'], end: KILL_AFTER,
    events: [
      { at: 0.04, kind: 'reset', label: 'reset', pos: 'above' },
      { at: 0.09, kind: 'paint', title: '12:41:07', label: 'paints 12:41:07', short: '12:41:07' },
      { at: 1.09, kind: 'paint', title: '12:41:08', label: 'paints 12:41:08', short: '12:41:08' },
      { at: KILL_AFTER, kind: 'kill', label: 'killed', pos: 'above', align: 'end' },
    ],
    result: 'Without exit the loop goes on and paints the time again until it is killed at 2 s. The button keeps showing 12:41:08.',
  },
  {
    id: 'pair', chip: 'fade', verdict: 'Cleans up twice', code: ['trap cleanup EXIT', 'trap \'cleanup; exit 0\' TERM'], end: 0.09,
    events: [{ at: 0.04, kind: 'reset', label: 'cleanup, twice' }, { at: 0.07, kind: 'reset' }],
    result: 'cleanup runs for TERM and once more on exit. Here that is two resets; a cleanup that saves a file or sends a notification does it twice.',
  },
]);
const LIVE_BEFORE = '12:41:06';

/** What one track's button shows at axis time x. */
export function stopAt(track, x) {
  let title = x < 0 ? LIVE_BEFORE : null;
  for (const e of track.events) if (e.kind === 'paint' && x >= e.at) title = e.title;
  return { title, live: title !== null, running: x < track.end, stopped: x >= 0 };
}

const B_SPEED = 0.5, B_HOLD = 2.4;
const B_RUN = (STOP_AXIS[1] - STOP_AXIS[0]) / B_SPEED, B_PERIOD = B_RUN + B_HOLD;
const axisPct = x => ((x - STOP_AXIS[0]) / (STOP_AXIS[1] - STOP_AXIS[0])) * 100;

// ─── Styles ─────────────────────────────────────────────────────────────────────────────────────────────────────

const PHONE_FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif";
const CSS = `
.dt-diagram .lc-pick { margin: -6px 0 16px; }
.dt-diagram .dt-btn:disabled { opacity: 0.4; cursor: default; }
.dt-diagram .lc-a { display: grid; grid-template-columns: 236px minmax(0, 1fr); gap: 22px; align-items: start; }
.dt-diagram .lc-left { display: flex; flex-direction: column; align-items: center; gap: 12px; min-width: 0; }

.dt-diagram .lc-phone {
  width: min(196px, 100%); background: #0D0D0D; border-radius: 24px; padding: 7px 3px 0;
  display: flex; flex-direction: column; align-items: center; font-family: ${PHONE_FONT};
}
.dt-diagram .lc-phone > .dt-cell { width: 100%; max-width: none; margin: 0; }
.dt-diagram .lc-bar { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 26px; width: 100%; padding: 0 6px; }
.dt-diagram .lc-mac { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; line-height: 1; color: rgba(255, 255, 255, 0.4); white-space: nowrap; }
.dt-diagram .lc-mac i { width: 7px; height: 7px; border-radius: 50%; background: #30D158; flex: none; }
.dt-diagram .lc-count {
  --tint: ${ORANGE};
  display: inline-flex; align-items: center; gap: 3px; margin: 0; padding: 3px 7px; border: 0; border-radius: 999px;
  font: 600 12px/1.15 ${PHONE_FONT}; font-variant-numeric: tabular-nums; color: var(--tint);
  background: color-mix(in srgb, var(--tint) 16%, transparent); cursor: pointer;
}
.dt-diagram .lc-count.gray { --tint: ${GRAY}; }
.dt-diagram span.lc-count { cursor: default; }
.dt-diagram .lc-count svg { display: block; flex: none; }
.dt-diagram .lc-outline { transition: opacity .2s; }

/* Keeps the room of the tallest list (the Failed row), so the page does not jump when it opens. */
.dt-diagram .lc-sheetbox { width: min(236px, 100%); min-height: 262px; display: flex; flex-direction: column; }
.dt-diagram .lc-placeholder {
  flex: 1; display: flex; align-items: center; justify-content: center; text-align: center; padding: 14px;
  border: 1px dashed var(--dt-border-strong); border-radius: 14px; font-size: 0.75rem; line-height: 1.45; color: var(--dt-muted);
}
.dt-diagram .lc-sheet {
  flex: 1; background: #1C1C1E; color: #FFFFFF; border-radius: 14px; padding: 9px 9px 11px; text-align: left;
  border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 14px 34px rgba(0, 0, 0, 0.45); font-family: ${PHONE_FONT};
}
.dt-diagram .lc-sheet button { font: inherit; margin: 0; background: none; border: 0; cursor: pointer; color: #0A84FF; }
.dt-diagram .lc-sheet button:hover { color: #409CFF; }
.dt-diagram .lc-sheet span.lc-act { color: #0A84FF; }
.dt-diagram .lc-sheet-bar { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; margin-bottom: 6px; }
.dt-diagram .lc-sheet-bar b { font-size: 13px; font-weight: 600; color: #FFFFFF; }
.dt-diagram .lc-sheet-bar .lc-act { justify-self: end; font-size: 12.5px; font-weight: 600; padding: 3px 2px; }
.dt-diagram .lc-sec {
  display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 6px 6px 4px;
  font-size: 10.5px; letter-spacing: 0.02em; color: rgba(235, 235, 245, 0.6);
}
.dt-diagram .lc-sec > span:first-child { text-transform: uppercase; }
.dt-diagram .lc-sec .lc-act { font-size: 10.5px; font-weight: 600; padding: 0 2px; }
.dt-diagram .lc-erow { background: #2C2C2E; border-radius: 10px; padding: 9px 10px 8px; display: grid; gap: 4px; }
.dt-diagram .lc-erow p { margin: 0; overflow-wrap: anywhere; }
.dt-diagram .lc-erow-head { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 8px; align-items: start; }
.dt-diagram .lc-sym { display: block; margin-top: 1px; }
.dt-diagram .lc-erow-title { font-size: 13px; font-weight: 600; line-height: 1.3; color: #FFFFFF; }
.dt-diagram .lc-erow-sub { font-size: 11px; line-height: 1.35; color: rgba(235, 235, 245, 0.6); }
.dt-diagram .lc-erow-place { font-size: 10px; line-height: 1.35; color: rgba(235, 235, 245, 0.4); }
.dt-diagram .lc-erow-words { font-family: var(--dt-mono); font-size: 11px; line-height: 1.4; color: #FFFFFF; }
.dt-diagram .lc-erow-hint { font-size: 11px; line-height: 1.4; color: rgba(235, 235, 245, 0.6); }
.dt-diagram .lc-erow-when { font-size: 10px; line-height: 1.35; color: rgba(235, 235, 245, 0.4); }
.dt-diagram .lc-erow-acts { display: flex; flex-wrap: wrap; gap: 2px 14px; margin-top: 2px; }
.dt-diagram .lc-erow-acts .lc-act { font-size: 11.5px; font-weight: 500; padding: 2px 0; }
.dt-diagram .lc-empty { display: grid; justify-items: center; gap: 4px; padding: 30px 10px 24px; text-align: center; color: rgba(235, 235, 245, 0.6); }
.dt-diagram .lc-empty b { font-size: 13px; font-weight: 600; color: #FFFFFF; margin-top: 4px; }
.dt-diagram .lc-empty span { font-size: 11px; line-height: 1.4; }

.dt-diagram .lc-states { display: grid; gap: 6px; margin-top: 6px; }
.dt-diagram .lc-state {
  display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: 10px; align-items: center; padding: 6px 10px;
  border: 1px solid var(--dt-border); border-radius: 10px; opacity: 0.6; transition: opacity .2s, border-color .2s, background .2s;
}
.dt-diagram .lc-state.on { opacity: 1; border-color: color-mix(in srgb, var(--dt-accent) 45%, transparent); background: var(--dt-accent-subtle); }
.dt-diagram .lc-state.on.warn { border-color: color-mix(in srgb, var(--dt-warn) 45%, transparent); background: var(--dt-warn-subtle); }
.dt-diagram .lc-state.on.off { border-color: var(--dt-muted); background: var(--dt-panel); }
.dt-diagram .lc-icon { display: block; }
.dt-diagram .lc-state-name { color: var(--dt-ink); font-weight: 600; font-size: 0.8125rem; line-height: 1.35; }
.dt-diagram .lc-state-name small { font-weight: 400; color: var(--dt-muted); font-size: 0.75rem; margin-left: 6px; }
.dt-diagram .lc-state-mac { font-family: var(--dt-mono); font-size: 0.6875rem; line-height: 1.4; color: var(--dt-muted); overflow-wrap: anywhere; }
.dt-diagram .lc-event { font-size: 0.8125rem; line-height: 1.5; color: var(--dt-ink); min-height: 4.5em; margin: 12px 0 10px; }
.dt-diagram .lc-track { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; margin-top: 7px; }
.dt-diagram .lc-slot {
  border: 1px solid var(--dt-border); border-radius: 8px; padding: 6px 2px 5px; text-align: center; min-width: 0;
  font-family: var(--dt-mono); font-size: 0.625rem; line-height: 1.3; color: var(--dt-muted); transition: background .2s, border-color .2s;
}
.dt-diagram .lc-slot svg { display: block; margin: 0 auto 4px; }
.dt-diagram .lc-slot b { display: block; font-weight: 600; color: var(--dt-body); }
.dt-diagram .lc-slot.lit { border-color: color-mix(in srgb, var(--dt-warn) 40%, transparent); background: var(--dt-warn-subtle); color: var(--dt-ink); }
.dt-diagram .lc-slot.now { border-color: var(--dt-warn); }
.dt-diagram .lc-slot:not(.lit) svg { opacity: 0.35; }
.dt-diagram .lc-track.idle { opacity: 0.5; }

.dt-diagram .lc-b { margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--dt-border); }
.dt-diagram .lc-b-head { display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: flex-start; justify-content: space-between; margin-bottom: 8px; }
.dt-diagram .lc-b-head > div { min-width: 0; flex: 1 1 260px; }
.dt-diagram .lc-grid { display: grid; grid-template-columns: minmax(0, 1fr) 78px; column-gap: 14px; align-items: center; }
.dt-diagram .lc-axis { position: relative; height: 30px; font-family: var(--dt-mono); font-size: 0.5625rem; letter-spacing: 0.04em; color: var(--dt-muted); }
.dt-diagram .lc-axis span { position: absolute; top: 2px; transform: translateX(-50%); text-align: center; white-space: nowrap; line-height: 1.35; }
.dt-diagram .lc-axis span b { color: var(--dt-body); font-weight: 600; }
.dt-diagram .lc-row { margin-top: 8px; border: 1px solid var(--dt-border); border-radius: 12px; padding: 10px 12px 10px; }
.dt-diagram .lc-row-head { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; margin-bottom: 2px; }
.dt-diagram .lc-row-head code { font-size: 0.6875rem; }
.dt-diagram .lc-and { font-size: 0.75rem; color: var(--dt-muted); }
.dt-diagram .lc-time { position: relative; height: 54px; }
.dt-diagram .lc-gl { position: absolute; top: 2px; bottom: 2px; width: 1px; background: var(--dt-border-strong); }
.dt-diagram .lc-gl.kill { background: color-mix(in srgb, var(--dt-warn) 40%, transparent); }
.dt-diagram .lc-rail { position: absolute; left: 0; right: 0; top: 26px; height: 2px; border-radius: 1px; background: var(--dt-border); }
.dt-diagram .lc-bar-run { position: absolute; left: 0; top: 25px; height: 4px; border-radius: 2px; background: var(--dt-accent); width: 0; }
.dt-diagram .lc-ev { position: absolute; top: 27px; width: 10px; height: 10px; border-radius: 50%; transform: translate(calc(-50% + var(--shift, 0px)), -50%); opacity: 0; transition: opacity .15s; }
.dt-diagram .lc-ev.on { opacity: 1; }
.dt-diagram .lc-ev.reset { background: var(--dt-ok); box-shadow: 0 0 0 3px var(--dt-ok-subtle); }
.dt-diagram .lc-ev.paint { background: var(--dt-warn); box-shadow: 0 0 0 3px var(--dt-warn-subtle); }
.dt-diagram .lc-ev.kill { width: 18px; height: 18px; color: var(--dt-warn); background: var(--dt-card); border: 1.5px solid var(--dt-warn); font: 700 10px/15px var(--dt-mono); text-align: center; box-shadow: 0 0 0 3px var(--dt-warn-subtle); }
.dt-diagram .lc-evl { position: absolute; font-family: var(--dt-mono); font-size: 0.5625rem; white-space: nowrap; color: var(--dt-body); opacity: 0; transition: opacity .15s; transform: translateX(-4px); }
.dt-diagram .lc-evl.on { opacity: 1; }
.dt-diagram .lc-evl.above { top: 4px; }
.dt-diagram .lc-evl.below { top: 37px; }
.dt-diagram .lc-evl.end { transform: translateX(calc(-100% + 6px)); }
.dt-diagram .lc-head { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; border-radius: 1px; background: var(--dt-ink); opacity: 0.6; }
.dt-diagram .lc-mini { display: flex; justify-content: center; }
.dt-diagram .lc-mini .dt-cell { width: 78px; }
.dt-diagram .lc-result { font-size: 0.75rem; line-height: 1.5; margin-top: 2px; color: var(--dt-body); }

.dt-diagram .lc-story .dt-strip { --dt-cols: 4; gap: 10px; }
.dt-diagram .lc-story .lc-phone { width: 100%; max-width: 150px; margin: 0 auto; border-radius: 20px; }
.dt-diagram .lc-story .dt-strip .lc-phone > .dt-cell { max-width: none; }
.dt-diagram .lc-story .lc-bar { min-height: 24px; gap: 5px; padding: 0 4px; }
.dt-diagram .lc-story .lc-mac { font-size: 10px; gap: 4px; }
.dt-diagram .lc-story .lc-count { font-size: 11px; padding: 2px 6px; }
.dt-diagram .lc-story figcaption { font-family: var(--dt-sans); font-size: 0.75rem; letter-spacing: 0; line-height: 1.45; margin-top: 6px; color: var(--dt-body); }
.dt-diagram .lc-story figcaption b { display: block; color: var(--dt-ink); }
.dt-diagram .lc-story figcaption span { display: block; color: var(--dt-muted); font-family: var(--dt-mono); font-size: 0.625rem; margin-top: 2px; }
.dt-diagram .lc-story-b { display: grid; grid-template-columns: 236px minmax(0, 1fr); gap: 22px; align-items: start; margin-top: 18px; }
.dt-diagram .lc-story-b .lc-sheet { flex: none; margin-top: 7px; }

@container dt (max-width: 560px) {
  .dt-diagram .lc-a, .dt-diagram .lc-story-b { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .dt-diagram .lc-phone { width: min(176px, 100%); }
  .dt-diagram .lc-sheetbox { width: min(280px, 100%); min-height: 236px; }
  .dt-diagram .lc-story-b .lc-sheet { width: min(280px, 100%); margin-left: auto; margin-right: auto; }
  .dt-diagram .lc-grid { grid-template-columns: minmax(0, 1fr) 62px; column-gap: 10px; }
  .dt-diagram .lc-mini .dt-cell { width: 62px; }
  .dt-diagram .lc-story .dt-strip { --dt-cols: 2; }
  .dt-diagram .lc-track { gap: 3px; }
  .dt-diagram .lc-long { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .dt-diagram .lc-outline, .dt-diagram .lc-state, .dt-diagram .lc-slot, .dt-diagram .lc-ev, .dt-diagram .lc-evl { transition: none; }
}
`;

// ─── Small DOM helpers ──────────────────────────────────────────────────────────────────────────────────────────

function writer() {
  const memo = new WeakMap();
  const m = el => { let x = memo.get(el); if (!x) { x = {}; memo.set(el, x); } return x; };
  return {
    attr(el, k, v) { const x = m(el); if (x[k] !== v) { x[k] = v; el.setAttribute(k, v); } },
    text(el, s) { if (el.textContent !== s) el.textContent = s; },
    cls(el, s) { if (el.className !== s) el.className = s; },
    style(el, k, v) { const x = m(el); if (x['s' + k] !== v) { x['s' + k] = v; el.style.setProperty(k, v); } },
    hide(el, on) { if (el.hidden !== on) el.hidden = on; },
  };
}

/**
 * The top of the deck and the free disk button: the Mac's name with the ⚠ count right of it, the button under it.
 * `interactive`: the count is a button the reader taps (the live view); otherwise a picture of it (the storyboard).
 */
function makePhone(w, { interactive = true } = {}) {
  const pc = plainCell({ unit: 150, label: 'The free disk button' });
  const u = pc.unit, p = pc.pad, R = +(0.2237 * u).toFixed(2), o = 7.5;     // the outline runs 4 pt outside the button
  const outline = svgEl('rect', { x: p - o, y: p - o, width: u + 2 * o, height: u + 2 * o, rx: R + o, fill: 'none',
    stroke: '#0A84FF', 'stroke-width': 5.6, opacity: 0, class: 'lc-outline' }, pc.cell.svg);
  const count = h(interactive ? 'button' : 'span', { class: 'lc-count', type: interactive ? 'button' : null },
    warnIcon(12), h('span', { text: '1' }));
  const bar = h('div', { class: 'lc-bar' }, h('span', { class: 'lc-mac' }, h('i'), MAC_NAME), count);
  const el = h('div', { class: 'lc-phone', attrs: { role: 'group', 'aria-label': 'The top of the deck and the free disk button' } },
    bar, pc.cell.svg);
  return {
    el, pc, count,
    setChip(chip) {
      w.hide(count, !chip);
      if (!chip) return;
      w.cls(count, `lc-count ${chip}`);
      w.attr(count, 'aria-label', `⚠ 1 next to the Mac’s name, ${chip}: 1 button not working${interactive ? '. Opens Errors' : ''}`);
    },
    setOutline(on) { w.attr(outline, 'opacity', on ? '1' : '0'); },
  };
}

/** The phone's list of errors with the free disk button's row. `interactive`: its buttons work. */
function makeSheet(w, { interactive = true } = {}) {
  const act = (text, extra = '') => h(interactive ? 'button' : 'span', { class: `lc-act${extra}`, type: interactive ? 'button' : null, text });
  const done = act('Done');
  const bar = h('div', { class: 'lc-sheet-bar' }, h('span'), h('b', { text: 'Errors' }), done);
  const empty = h('div', { class: 'lc-empty', hidden: '' }, checkIcon(), h('b', { text: 'No errors' }),
    h('span', { text: 'When a button doesn\'t work, the reason appears here.' }));
  const secTitle = h('span');
  const clear = act('Clear');
  const sec = h('div', { class: 'lc-sec' }, secTitle, clear);
  const sym = rowSymbol();
  const title = h('p', { class: 'lc-erow-title' });
  const sub = h('p', { class: 'lc-erow-sub' });
  const words = h('p', { class: 'lc-erow-words' });
  const hint = h('p', { class: 'lc-erow-hint' });
  const when = h('p', { class: 'lc-erow-when' });
  const show = act('Show Button'), restart = act('Restart Script');
  const erow = h('div', { class: 'lc-erow' },
    h('div', { class: 'lc-erow-head' }, sym.svg, h('div', {}, title, sub, h('p', { class: 'lc-erow-place', text: PLACE }))),
    words, hint, when, h('div', { class: 'lc-erow-acts' }, show, restart));
  const el = h('div', { class: 'lc-sheet', attrs: { role: 'group', 'aria-label': 'Errors, the list on the phone' } },
    bar, empty, sec, erow);

  /** row: { state, count, active } or null (nothing listed). */
  function set(row) {
    w.hide(empty, !!row);
    w.hide(sec, !row);
    w.hide(erow, !row);
    if (!row) return;
    const t = STATES[row.state].row;
    const section = row.active ? t.section : 'Earlier';
    const isFailing = row.active && failing(row.state);
    w.text(secTitle, section);
    w.hide(clear, section !== 'Earlier');
    sym.set(row.active && !isFailing ? 'stop' : 'warn');
    w.style(sym.svg, 'color', isFailing ? ORANGE : 'rgba(235,235,245,0.6)');
    w.text(title, t.headline);
    w.text(sub, `${BUTTON_NAME} · ${t.source}`);
    w.text(words, t.words || '');
    w.hide(words, !t.words);
    w.text(hint, t.hint);
    w.text(when, row.count > 1 ? `${row.count} times` : '');
    w.hide(when, row.count < 2);
  }
  return { el, set, done, clear, show, restart };
}

function slotEl(n) {
  const failed = n >= FAILED_FROM;
  const svg = svgEl('svg', { viewBox: '0 0 16 16', width: 14, height: 14, 'aria-hidden': 'true' });
  svgEl('circle', { cx: 8, cy: 8, r: 4.2, fill: failed ? RED : ORANGE }, svg);
  const wait = RESTART_DELAYS[Math.min(n - 1, RESTART_DELAYS.length - 1)];
  return h('div', { class: 'lc-slot', attrs: { 'aria-label': `Failure ${n}: ${failed ? 'Failed' : 'Restarting'}, next start after ${wait} s` } },
    svg, h('b', { text: n === 7 ? '7+' : String(n) }), `${wait} s`);
}
const TRACK_NOTE = 'Advanced › Status reads Restarting (orange) after failures 1 to 5 and Failed (red) from the 6th. ' +
  'A run that lasts a minute or more starts the count again.';

// ─── Part A view ────────────────────────────────────────────────────────────────────────────────────────────────

function partA(ctx) {
  const { w } = ctx;
  const root = h('div', { class: 'lc-a' });

  const phone = makePhone(w);
  const placeholder = h('p', { class: 'lc-placeholder' });
  const sheet = makeSheet(w);
  const sheetBox = h('div', { class: 'lc-sheetbox' }, placeholder, sheet.el);
  const left = h('div', { class: 'lc-left' }, phone.el, sheetBox);

  const rows = ['running', 'restarting', 'failed', 'notRunning'].map(key => {
    const s = key === 'notRunning' ? STATES.exited : STATES[key];
    const where = h('small', { text: s.where });
    const mac = h('div', { class: 'lc-state-mac' });
    const el = h('div', { class: 'lc-state' }, countIcon(s.chip),
      h('div', {}, h('div', { class: 'lc-state-name' }, s.status, where), mac));
    return { key, el, where, mac };
  });
  const event = h('p', { class: 'lc-event', attrs: { 'aria-live': 'off' } });
  const slots = Array.from({ length: 7 }, (_, i) => slotEl(i + 1));
  const track = h('div', { class: 'lc-track' }, slots);
  const trackNote = h('p', { class: 'dt-note' });
  const right = h('div', { style: 'min-width:0' },
    h('div', { class: 'dt-pane-label', text: 'Advanced › Status, the phone’s list of errors, and Scripts on the Mac' }),
    h('div', { class: 'lc-states' }, rows.map(r => r.el)),
    event,
    h('div', { class: 'dt-pane-label', text: 'Failures in a row · the wait before the next start (sped up here)' }),
    track, trackNote);
  root.append(left, right);

  function render(life) {
    const st = life.state;
    const key = st === 'exited' || st === 'stopped' ? 'notRunning' : st;
    const chip = life.chip;
    phone.pc.face.render(life.live ? DISK : DISK_SAVED);
    phone.setChip(chip);
    phone.setOutline(life.outlined);
    phone.pc.cell.setLabel(`The free disk button: ${life.live ? DISK.label : 'its saved look'}${life.outlined ? ', outlined' : ''}`);
    rows.forEach(r => {
      const on = r.key === key;
      w.cls(r.el, `lc-state${on ? ' on' : ''}${on && (key === 'restarting' || key === 'failed') ? ' warn' : ''}${on && key === 'notRunning' ? ' off' : ''}`);
      const text = on ? life.mac : r.key === 'running' ? 'Running' : r.key === 'restarting' ? 'Restarting in 5s (attempt 1)'
        : r.key === 'failed' ? 'Failed — retrying in 60s (attempt 6)' : 'Exited · Stopped';
      w.text(r.mac, `Mac: ${text}`);
      if (r.key === 'running') {
        w.text(r.where, !on || !life.row ? STATES.running.where
          : life.failingNow ? 'Not working now until it has run a minute · orange ⚠' : 'its row is in Earlier; no ⚠');
      }
    });
    w.text(event, life.event.text);
    const n = life.failures;
    slots.forEach((s, i) => w.cls(s, `lc-slot${i < n || (i === 6 && n > 7) ? ' lit' : ''}${(i + 1 === n || (i === 6 && n >= 7)) ? ' now' : ''}`));
    w.cls(track, life.id === 'fails' ? 'lc-track' : 'lc-track idle');
    w.text(trackNote, life.id === 'fails' ? TRACK_NOTE
      : 'Exit 0 and Stop are not failures: nothing is counted, and nothing restarts the script by itself.');
    w.hide(sheet.el, !life.list);
    w.hide(placeholder, life.list);
    if (life.list) sheet.set(life.row);
    else w.text(placeholder, chip ? 'Tap the ⚠ count to read why.' : 'No ⚠ while it runs.');
  }

  return { root, render, count: phone.count, sheet };
}

function partAStory() {
  const w = writer();
  const box = h('div', { class: 'lc-story' });
  const strip = h('div', { class: 'dt-strip' });
  const shots = [
    ['running', DISK, 'Running', 'no ⚠; it runs', 'Mac: Running', null],
    ['restarting', DISK, 'Restarting', 'orange ⚠ 1; failures 1 to 5', 'Mac: Restarting in 5s (attempt 1)', 'Tap ⚠: “Script crashed”'],
    ['failed', DISK, 'Failed', 'orange ⚠ 1; from the 6th failure in a row', 'Mac: Failed — retrying in 60s (attempt 6)', 'Tap ⚠: “Script keeps failing”'],
    ['stopped', DISK_SAVED, 'Not Running', 'gray ⚠ 1; exit 0, or Stop on the Mac', 'Mac: Exited · Stopped', 'Tap ⚠: “Script finished” or “Script stopped”'],
  ];
  for (const [state, look, name, where, mac, tap] of shots) {
    const p = makePhone(w, { interactive: false });
    p.pc.face.render(look);
    p.setChip(STATES[state].chip);
    p.pc.cell.setLabel(`${name}: the free disk button, ${STATES[state].chip ? `${STATES[state].chip} ⚠ 1 next to the Mac’s name` : 'no ⚠'}`);
    strip.appendChild(h('figure', {}, p.el,
      h('figcaption', {}, h('b', { text: name }), where, h('span', { text: mac }), tap ? h('span', { text: tap }) : null)));
  }
  const sheet = makeSheet(w, { interactive: false });
  sheet.set({ state: 'failed', count: 6, active: true });
  const track = h('div', { class: 'lc-track' }, Array.from({ length: 7 }, (_, i) => { const s = slotEl(i + 1); s.classList.add('lit'); return s; }));
  box.append(strip,
    h('div', { class: 'lc-story-b' },
      h('div', { style: 'min-width:0' }, h('div', { class: 'dt-pane-label', text: 'A tap on the ⚠ count while it is Failed' }), sheet.el),
      h('div', { style: 'min-width:0' },
        h('div', { class: 'dt-pane-label', text: 'Failures in a row · the wait before the next start' }),
        track, h('p', { class: 'dt-note', text: TRACK_NOTE }),
        h('p', { class: 'dt-note', text: 'After the fix, the row stays in Not working now until the script has run a minute; ' +
          'then it moves to Earlier and the ⚠ count goes away. Exit 0 and Stop are not failures: the script stays off ' +
          'until you restart it, and Restart Script moves its row to Earlier at once.' }))));
  return box;
}

// ─── Part B view ────────────────────────────────────────────────────────────────────────────────────────────────

function partB(ctx, { onStop }) {
  const { w } = ctx;
  const root = h('section', { class: 'lc-b', attrs: { 'aria-label': 'The 2 seconds after Stop' } });
  const stopBtn = makeButton({ label: 'Stop it again', primary: true, onClick: onStop });
  root.appendChild(h('div', { class: 'lc-b-head' },
    h('div', {}, h('div', { class: 'dt-pane-label', text: 'Stopping' }),
      h('p', { class: 'dt-pane-title', text: 'The 2 seconds after Stop' }),
      h('p', { class: 'dt-pane-note', html: 'A clock button whose startup script sends the time every second. At 0 s you ' +
        'click <strong>Stop</strong> on the Mac: the agent sends SIGTERM to the script and everything it started, and ' +
        'SIGKILL 2 s later. The phone shows the saved look at once.' })),
    stopBtn));

  const axis = h('div', { class: 'lc-axis', attrs: { 'aria-hidden': 'true' } });
  [[0, '<b>0 s</b><br>Stop: SIGTERM'], [1, '1 s'], [KILL_AFTER, '<b>2 s</b><br>SIGKILL']].forEach(([x, html]) =>
    axis.appendChild(h('span', { html, style: `left:${axisPct(x)}%` })));
  root.appendChild(h('div', { class: 'lc-grid' }, axis, h('span')));

  const rows = STOP_TRACKS.map(track => {
    const time = h('div', { class: 'lc-time', attrs: { 'aria-hidden': 'true' } });
    time.append(h('span', { class: 'lc-rail' }), h('span', { class: 'lc-gl', style: `left:${axisPct(0)}%` }),
      h('span', { class: 'lc-gl kill', style: `left:${axisPct(KILL_AFTER)}%` }));
    const bar = h('span', { class: 'lc-bar-run' });
    time.appendChild(bar);
    let prev = -9, k = 0;
    const evs = track.events.map(e => {
      k = e.at - prev < 0.15 ? k + 1 : 0;
      prev = e.at;
      const dot = h('span', { class: `lc-ev ${e.kind}`, text: e.kind === 'kill' ? '✕' : '',
        style: `left:${axisPct(e.at)}%;--shift:${k * 11}px` });
      time.appendChild(dot);
      let label = null;
      if (e.label) {
        label = h('span', { class: `lc-evl ${e.pos || 'below'}${e.align === 'end' ? ' end' : ''}`, style: `left:${axisPct(e.at)}%` },
          e.short ? [h('span', { class: 'lc-long', text: e.label.slice(0, e.label.length - e.short.length) }), e.short] : e.label);
        time.appendChild(label);
      }
      return { e, dot, label };
    });
    const head = h('span', { class: 'lc-head' });
    time.appendChild(head);
    const cell = plainCell({ unit: 64, label: 'The clock button' });
    const result = h('p', { class: 'lc-result', text: track.result });
    const codes = track.code.flatMap((c, i) => (i ? [h('span', { class: 'lc-and', text: 'and' }), h('code', { text: c })] : [h('code', { text: c })]));
    root.appendChild(h('div', { class: 'lc-row', attrs: { role: 'group', 'aria-label': `${track.code.join(' and ')}: ${track.verdict}` } },
      h('div', { class: 'lc-row-head' }, h('span', { class: `dt-chip ${track.chip}`, text: track.verdict }), ...codes),
      h('div', { class: 'lc-grid' }, time, h('div', { class: 'lc-mini' }, cell.cell.svg)),
      result));
    return { track, bar, evs, head, cell };
  });

  function render(x, { showHead = true } = {}) {
    for (const r of rows) {
      const s = stopAt(r.track, x);
      const endX = Math.min(x, r.track.end);
      w.style(r.bar, 'width', `${axisPct(endX).toFixed(2)}%`);
      r.evs.forEach(({ e, dot, label }) => {
        const on = x >= e.at;
        w.cls(dot, `lc-ev ${e.kind}${on ? ' on' : ''}`);
        if (label) w.cls(label, `lc-evl ${e.pos || 'below'}${e.align === 'end' ? ' end' : ''}${on ? ' on' : ''}`);
      });
      w.style(r.head, 'left', `${axisPct(x).toFixed(2)}%`);
      w.style(r.head, 'display', showHead ? 'block' : 'none');
      r.cell.face.render({ label: s.title || 'Clock', icon: 'clock', color: BLUE });
      r.cell.cell.setLabel(s.live ? `The clock button showing ${s.title}${s.stopped ? ', after the stop' : ''}` : 'The clock button with its saved look');
    }
  }
  return { root, render, stopBtn };
}

// ─── The diagram ────────────────────────────────────────────────────────────────────────────────────────────────

export default function mount(el, { mode = 'short', reducedMotion = false } = {}) {
  ensureStyle('dt-script-lifecycle', CSS);
  const sw = readSwitches(el, { reducedMotion });
  let reduce = sw.reduced;
  const original = [...el.childNodes];
  const full = mode === 'full';
  const w = writer();

  const { figure, controls, body, legend, caption, announce } = makeFigure({
    name: 'script-lifecycle',
    eyebrow: 'A startup script’s life',
    title: 'A script that fails runs again. One that ends with 0 stays off.',
    lede: 'The free disk widget’s startup script, three ways. Pick what the script does, or tap the ⚠ count yourself.',
  });

  // Scenario picker, live view, storyboard.
  const pickSeg = makeSegmented({ label: 'What the script does', options: SCENARIOS.map(s => [s.id, s.name]), value: 'fails',
    onChange: id => choose(id, true) });
  const pick = h('div', { class: 'lc-pick' }, pickSeg.el);
  const A = partA({ w });
  const story = h('div', { hidden: '' });
  body.append(pick, A.root, story);
  let B = null;

  // Clock and autoplay. Part A: the scenario's simulation from `baseA`. Part B: the stop timeline from `baseB`.
  let scenario = 0, life = new Life(SCENARIOS[0].id), baseA = 0, baseB = 0, playing = false, view = 'live';
  const frozen = sw.at !== null;
  const rebuild = (i, t) => { scenario = i; life = new Life(SCENARIOS[i].id); baseA = t; };

  function render(time) {
    life.advance(time - baseA);
    A.render(life);
    if (pickSeg.value !== SCENARIOS[scenario].id) pickSeg.set(SCENARIOS[scenario].id);
    if (B) {
      const tau = time - baseB;
      const x = reduce ? STOP_AXIS[1] : Math.min(STOP_AXIS[1], STOP_AXIS[0] + (playing ? tau % B_PERIOD : Math.min(tau, B_RUN)) * B_SPEED);
      B.render(x, { showHead: !reduce });
    }
  }

  const loop = new Loop({
    root: figure,
    onFrame(time) {
      if (playing && time - baseA >= life.end) {
        let start = baseA + life.end;
        rebuild((scenario + 1) % SCENARIOS.length, start);
        while (time - baseA >= life.end) { start = baseA + life.end; rebuild((scenario + 1) % SCENARIOS.length, start); }
      }
      render(time);
      const aBusy = time - baseA < life.end;
      const bBusy = B && time - baseB < B_RUN;
      return playing || aBusy || !!bBusy;
    },
  });

  const playBtn = makeButton({ label: '❚❚ Pause', pressed: true, onClick: () => setPlaying(!playing) });
  const viewSeg = makeSegmented({ label: 'View', options: [['live', 'Live'], ['story', 'Storyboard']], value: 'live', onChange: setView });
  controls.append(playBtn, h('span', { class: 'dt-spacer' }), viewSeg.el);

  function setPlaying(on) {
    playing = on && !frozen && !reduce;
    playBtn.setAttribute('aria-pressed', String(playing));
    playBtn.textContent = playing ? '❚❚ Pause' : '▶ Play';
    playBtn.disabled = reduce;
    if (B) B.stopBtn.disabled = reduce;
    playBtn.title = reduce ? 'Reduce Motion is on: pick what the script does to see where it ends' : '';
    if (playing) loop.wake();
  }
  function choose(id, spoken) {
    if (view !== 'live') setView('live');
    const i = SCENARIOS.findIndex(s => s.id === id);
    rebuild(i, loop.time);
    setPlaying(false);
    if (reduce) life.advance(life.end);
    if (spoken) announce(`${SCENARIOS[i].name}. ${SCENARIOS[i].note}`);
    loop.renderNow();
    if (!frozen) loop.wake();
  }
  function act(kind) {
    if (view !== 'live') setView('live');
    setPlaying(false);
    // From now on the reader drives: the scenario's own actions are dropped, the script keeps doing what it does.
    life.act(kind, loop.time - baseA);
    life.end = Math.max(life.end, loop.time - baseA + 4);
    announce(life.event.text);
    loop.renderNow();
    if (!frozen) loop.wake();
  }
  A.count.addEventListener('click', () => { if (life.chip && !life.list) act('tap'); });
  A.sheet.done.addEventListener('click', () => act('cancel'));
  A.sheet.restart.addEventListener('click', () => act('restart'));
  A.sheet.show.addEventListener('click', () => act('show'));
  A.sheet.clear.addEventListener('click', () => act('clear'));

  if (full) {
    B = partB({ w }, { onStop: () => { if (view !== 'live') setView('live'); baseB = loop.time; announce('Stopped again: watch the three traps.'); loop.renderNow(); if (!frozen) loop.wake(); } });
    body.appendChild(B.root);
  }

  function setView(next) {
    view = next === 'story' ? 'story' : 'live';
    if (view === 'story' && !story.childElementCount) story.appendChild(partAStory());
    story.hidden = view !== 'story';
    A.root.hidden = pick.hidden = view === 'story';
    viewSeg.set(view);
    loop.renderNow();
  }

  if (full) {
    makeLegend([
      { swatch: 'glide', text: 'The script runs' },
      { swatch: 'ok', text: 'A reset from the trap' },
      { swatch: 'fade', text: 'The loop paints the button again' },
    ], legend);
  }
  caption.innerHTML =
    '<strong>Write a startup script as a loop that never ends.</strong> When it fails, the agent starts it again ' +
    'after 5, 10, 20, 40 and 60 s, then every minute; from the 6th failure in a row it is Failed. The phone counts ' +
    'the button from the first failure: an orange ⚠ next to the Mac’s name. A script that ends with ' +
    '<code>exit 0</code> is finished and is not started again, and one stopped on the Mac stays stopped; both show a ' +
    'gray ⚠. Tap the ⚠ count to read why, fix the script, then tap <strong>Restart Script</strong>.' +
    (full ? '<p style="margin-top:10px"><strong>End the stop trap with <code>exit 0</code>.</strong> With it, the trap ' +
      'runs once and the script ends. Without it, the loop paints the button again, and that look stays after the ' +
      'stop. Use one trap: <code>trap cleanup EXIT</code> next to <code>trap \'cleanup; exit 0\' TERM</code> runs ' +
      'the cleanup twice.</p><p class="dt-note">When you quit the agent, a trap has about half a second instead of 2 s.</p>' : '');

  el.replaceChildren(figure);

  if (frozen) {
    // A still for checks: the autoplay sw.at seconds in.
    let t = sw.at, i = 0;
    while (t >= new Life(SCENARIOS[i].id).end) { t -= new Life(SCENARIOS[i].id).end; i = (i + 1) % SCENARIOS.length; }
    rebuild(i, sw.at - t);
    loop.time = sw.at; loop.speed = 0;
    baseB = sw.at - (sw.at % B_PERIOD);
    playing = true;                         // so Part B shows the autoplay moment; nothing runs (speed 0, no wake)
    render(sw.at);
    playing = false;
    playBtn.setAttribute('aria-pressed', 'false');
    playBtn.textContent = '▶ Play';
  } else if (reduce) {
    setPlaying(false);
    life.advance(life.end);
    setView('story');
  } else {
    setPlaying(true);
  }
  if (sw.view === 'story') setView('story');
  if (!frozen) loop.renderNow();

  const unwatch = watchReducedMotion(on => {
    reduce = on || sw.reduced;
    if (reduce) { setPlaying(false); life.advance(life.end); setView('story'); } else setPlaying(false);
  });

  return {
    destroy() {
      unwatch();
      loop.destroy();
      el.replaceChildren(...original);
    },
  };
}
