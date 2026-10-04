// Desktap docs shell: routes ?p=<slug> to assets/docs/pages/<slug>.md, renders it with marked
// and applies the site's Markdown conventions (callouts, step cards, code tabs, chips, diagrams).
// Page list, legacy anchors and recipe cards come from assets/docs/pages.json.

const MARKED_URL = 'https://cdn.jsdelivr.net/npm/marked@14.1.3/+esm';
const MANIFEST_URL = 'assets/docs/pages.json';
const SITE = 'https://desktap.app/docs';
const HELPERS_START = '# ── Desktap helpers (the same in every recipe) ──';
const HELPERS_END = '# ── end of helpers ──';
const LONG_CODE = 30;              // visible lines before a block folds
const VERSION = new URL(import.meta.url).search;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// GitHub-style slug: lowercase, drop non-word/space/hyphen, spaces → hyphen (keeps "_": the-cell_id-placeholder)
function slugify(text) {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
}

const ui = {
  head: $('#docsPageHead'), content: $('#docsContent'), pager: $('#docsPager'), main: $('#main'),
  nav: $('#docsNav'), navPages: $('#docsNavPages'), rail: $('#docsRail'),
  railList: $('#docsRailList'), dropdown: $('#docsOtpDropdown'), toggle: $('#docsPanelToggle'),
  close: $('#docsPanelClose'), backdrop: $('#docsBackdrop'), subTitle: $('#docsSubbarTitle'),
  subPrev: $('#docsSubbarPrev'), subNext: $('#docsSubbarNext'), footer: $('.footer'),
};

/* ---------- Code blocks: light highlighting, chips, folding ---------- */

const CHIPS = {
  '{{CELL_ID}}': 'The agent puts this button\u2019s ID here before the script runs. Leave it as it is.',
  '{{DESKTAP_TOKEN}}': 'curl\u2019s own placeholder: curl puts $DESKTAP_TOKEN here, so the token never appears on a command line.',
  '$DESKTAP_TOKEN': 'The script token. The agent gives it to every script it starts. Never paste it into a script or print it.',
  '$DESKTAP_STORAGE': 'The storage folder: files your scripts keep between runs go here.',
};
const CHIP_RE = /\{\{(?:CELL_ID|DESKTAP_TOKEN)\}\}|\$\{DESKTAP_(?:TOKEN|STORAGE)\}|\$DESKTAP_(?:TOKEN|STORAGE)\b/g;
const chips = html => html.replace(CHIP_RE, m => {
  const tip = CHIPS[m.replace(/^\$\{(.*)\}$/, '$$$1')];
  return `<span class="chip" tabindex="0" data-tip="${esc(tip)}">${m}</span>`;
});

// [class, sticky regex, optional guard(src, index)] tried in order at every position
const ZSH = [
  ['com', /#[^\n]*/y, (s, i) => i === 0 || /[\s;]/.test(s[i - 1])],
  ['', /\\[\s\S]/y],
  ['str', /\$'(?:\\[\s\S]|[^'\\])*'|'[^']*'|"(?:\\[\s\S]|[^"\\])*"/y],
  ['var', /\$(?:\{[^}\n]*\}|[A-Za-z_]\w*|[0-9#?@*$!-])/y],
  ['doc', /<<(?!<)-?[ \t]*(['"]?)([A-Za-z_]\w*)\1/y, (s, i) => s[i - 1] !== '<'],
  ['kw', /\b(?:if|then|elif|else|fi|for|in|do|done|while|until|case|esac|function|return|local|export|trap|exit|print|read|zmodload|typeset|integer|float|readonly|break|continue)\b/y],
];
const XML = [
  ['com', /<!--[\s\S]*?-->/y], ['tag', /<\/?[A-Za-z][\w:.-]*|\/?>/y],
  ['attr', /[A-Za-z_:][\w:.-]*(?=\s*=\s*["'])/y],
  ['str', /"[^"]*"|'[^']*'/y, (s, i) => /=\s*$/.test(s.slice(Math.max(0, i - 4), i))],
];
const HL = {
  zsh: ZSH, sh: ZSH, bash: ZSH, shell: ZSH, svg: XML, xml: XML, html: XML,
  json: [['key', /"(?:\\.|[^"\\\n])*"(?=\s*:)/y], ['str', /"(?:\\.|[^"\\\n])*"/y],
    ['num', /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/y], ['kw', /\b(?:true|false|null)\b/y]],
  applescript: [['com', /--[^\n]*|\(\*[\s\S]*?\*\)/y], ['str', /"(?:\\.|[^"\\])*"/y],
    ['kw', /\b(?:tell|end|set|to|on|if|then|else|repeat|try|return|of|do shell script)\b/y]],
};

function highlight(src, lang) {
  const rules = HL[lang];
  if (!rules) return chips(esc(src));
  let out = '', plain = '', i = 0, heredoc = null;
  const flush = () => { out += chips(esc(plain)); plain = ''; };
  const emit = (cls, s) => { flush(); out += `<span class="t-${cls}">${chips(esc(s))}</span>`; };
  while (i < src.length) {
    if (heredoc && src[i] === '\n') {             // a heredoc body runs to its terminator line
      const re = new RegExp(`\\n[\\s\\S]*?\\n[\\t ]*${heredoc}(?=\\n|$)|\\n[\\s\\S]*`, 'y');
      re.lastIndex = i;
      const body = re.exec(src)[0];
      emit('str', body); i += body.length; heredoc = null; continue;
    }
    let hit = false;
    for (const [cls, re, ok] of rules) {
      re.lastIndex = i;
      const m = re.exec(src);
      if (!m || !m[0] || (ok && !ok(src, i))) continue;
      if (cls === 'doc') { heredoc = m[2]; emit('kw', m[0]); } else if (cls) emit(cls, m[0]); else plain += m[0];
      i += m[0].length; hit = true; break;
    }
    if (!hit) plain += src[i++];
  }
  flush();
  return out;
}

const ICONS = {
  'startup script': '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 21v-5h-5"/>',
  'shell command': '<path d="M9 11V5.5a2 2 0 0 1 4 0V11"/><path d="M13 9.5a2 2 0 0 1 4 0V12a7 7 0 0 1-7 7h-.5A5.5 5.5 0 0 1 5 16l-1.6-3a1.8 1.8 0 0 1 3-1.9L9 14"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3"/><path d="M13 15h4"/>',
  'svg drawing': '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.6 7.6"/><circle cx="11" cy="11" r="2"/>',
  body: '<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1"/><path d="M16 21h1a2 2 0 0 0 2-2v-5a2 2 0 0 1 2-2 2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>',
  applescript: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h5"/>',
};
ICONS['long press'] = ICONS['shell command'];
const HINTS = {
  'startup script': 'Advanced › Startup Script', 'shell command': 'Tap action',
  terminal: 'On your Mac', 'svg drawing': 'Icon › SVG Drawing', body: 'JSON', applescript: 'Tap action',
  'long press': 'Long Press › Command',
};
const LANG_LABEL = { zsh: 'zsh', sh: 'sh', bash: 'bash', json: 'JSON', svg: 'SVG', xml: 'XML', html: 'HTML', applescript: 'AppleScript' };
const COPY_ICON = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const CHECK_ICON = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';

let codeTexts = [];   // raw text of every code block on the page: Copy always copies all of it

function renderCode({ text, lang: info = '' }) {
  const lang = (info.match(/^\S*/)[0] || '').toLowerCase();
  const tm = /\btitle=(?:"([^"]*)"|'([^']*)')/.exec(info);
  const title = tm ? (tm[1] ?? tm[2]) : '';
  const flags = info.replace(/\btitle=(?:"[^"]*"|'[^']*')/, '').split(/\s+/).slice(1);
  const i = codeTexts.push(text) - 1;
  const lines = text.split('\n');
  const s = lines.findIndex(l => l.trim() === HELPERS_START);
  const e = s < 0 ? -1 : lines.findIndex((l, k) => k > s && l.trim() === HELPERS_END);
  let body, hidden = 0;
  if (e > s) {
    hidden = e - s;
    const before = lines.slice(0, s).join('\n') + (s ? '\n' : '');
    const after = e + 1 < lines.length ? '\n' + lines.slice(e + 1).join('\n') : '';
    body = highlight(before, lang)
      + `<button type="button" class="code-fold" aria-expanded="false">${highlight(lines[s], lang)}`
      + `<span class="code-fold-note" aria-hidden="true" data-more="show ${hidden} lines"></span>`
      + `<span class="sr-only"> (${hidden} more lines)</span></button>`
      + `<span class="code-fold-body">${highlight('\n' + lines.slice(s + 1, e + 1).join('\n'), lang)}</span>`
      + highlight(after, lang);
  } else {
    body = highlight(text, lang);
  }
  const long = !flags.includes('open') && lines.length - hidden > LONG_CODE;
  const key = title.toLowerCase();
  const icon = ICONS[key] ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[key]}</svg>` : '';
  const head = title
    ? `<span class="code-tab">${icon}${esc(title)}</span>${HINTS[key] ? `<span class="code-hint">${esc(HINTS[key])}</span>` : ''}`
    : LANG_LABEL[lang] ? `<span class="code-lang">${esc(LANG_LABEL[lang])}</span>` : '';
  const bare = !title && !LANG_LABEL[lang];
  const cls = ['code-block', bare && 'no-head', long && 'is-long is-folded', flags.includes('primary') && 'is-primary']
    .filter(Boolean).join(' ');
  return `<div class="${cls}" data-code="${i}">`
    + `<div class="code-head">${head}<button type="button" class="code-copy" aria-label="Copy code">`
    + `<span class="code-copy-icon">${COPY_ICON}</span><span class="code-copy-text">Copy</span></button></div>`
    + `<pre class="lang-${esc(lang || 'text')}"><code>${body}</code></pre>`
    + (long ? `<button type="button" class="code-more" aria-expanded="false" data-lines="${lines.length}">Show all ${lines.length} lines</button>` : '')
    + '</div>';
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for non-secure contexts or older browsers
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch {}
    document.body.removeChild(ta);
    return ok;
  }
}

async function onCopy(btn) {
  if (btn.dataset.busy) return;
  const block = btn.closest('.code-block');
  if (!(await copyText(codeTexts[+block.dataset.code] ?? ''))) return;
  btn.dataset.busy = '1';
  btn.classList.add('is-copied');
  $('.code-copy-icon', btn).innerHTML = CHECK_ICON;
  $('.code-copy-text', btn).textContent = 'Copied';
  setTimeout(() => {
    btn.classList.remove('is-copied');
    $('.code-copy-icon', btn).innerHTML = COPY_ICON;
    $('.code-copy-text', btn).textContent = 'Copy';
    delete btn.dataset.busy;
  }, 1600);
}

/* ---------- Post-render transforms ---------- */

const CALLOUTS = { NOTE: 'note', TIP: 'tip', WARNING: 'warning', SEE: 'see', STEP: 'step', IMPORTANT: 'note', CAUTION: 'warning' };
const CALLOUT_LABEL = { note: 'Note', tip: 'Tip', warning: 'Warning', see: 'What you\u2019ll see' };
const CALLOUT_ICON = {
  note: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
  tip: '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z"/>',
  warning: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  see: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
};

// Images at the start or end of a paragraph (or on their own) in a step card or a see-box move into
// its picture column. An image inside a sentence stays put, and so do all of them when one is wider
// than 280 px (a storyboard strip, a Wide face): those read best in the flow, full width.
function takeMedia(body) {
  const isImg = n => n.nodeType === 1 && (n.matches('img, picture')
    || (n.tagName === 'A' && n.children.length === 1 && n.firstElementChild.matches('img, picture') && !n.textContent.trim()));
  const blank = n => (n.nodeType === 3 && !n.textContent.trim()) || (n.nodeType === 1 && n.tagName === 'BR');
  const picks = new Set();
  for (const node of body.children) {
    if (isImg(node)) { picks.add(node); continue; }
    if (node.tagName !== 'P') continue;
    for (const [start, step] of [['firstChild', 'nextSibling'], ['lastChild', 'previousSibling']]) {
      for (let n = node[start]; n; n = n[step]) {
        if (isImg(n)) picks.add(n); else if (!blank(n)) break;
      }
    }
  }
  const list = [...picks].sort((x, y) => (x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  const width = n => +((n.matches('img') ? n : $('img', n))?.getAttribute('width') || 0);
  if (!list.length || list.some(n => width(n) > 280)) return { media: [], inline: list.length > 0 };
  for (const n of list) {
    const para = n.parentElement.tagName === 'P' ? n.parentElement : null;
    n.remove();
    if (!para) continue;
    while (para.firstChild && blank(para.firstChild)) para.firstChild.remove();
    while (para.lastChild && blank(para.lastChild)) para.lastChild.remove();
    if (!para.childNodes.length) para.remove();
  }
  return { media: list, inline: false };
}

function transformCallouts(root) {
  for (const bq of $$('blockquote', root)) {
    const p = bq.firstElementChild;
    if (!p || p.tagName !== 'P') continue;
    const m = /^\[!(\w+)\][ \t]*([^\n]*)\n?/.exec(p.innerHTML);
    const kind = m && CALLOUTS[m[1].toUpperCase()];
    if (!kind) continue;
    p.innerHTML = p.innerHTML.slice(m[0].length);
    if (!p.innerHTML.trim()) p.remove();
    const box = document.createElement(kind === 'step' ? 'section' : 'aside');
    box.className = `callout callout-${kind}`;
    const body = document.createElement('div');
    body.className = 'callout-body';
    body.append(...bq.childNodes);
    let top = '';
    if (kind === 'step') {
      const sm = /^(\d+)\s*[·.:\-–—]?\s*([\s\S]*)$/.exec(m[2].trim());
      const num = sm ? sm[1] : '';
      const title = sm ? sm[2] : m[2].trim();
      box.innerHTML = `<div class="step-num" aria-hidden="true">${esc(num)}</div>`;
      top = `<div class="step-title">${num ? `<span class="sr-only">Step ${esc(num)}: </span>` : ''}${title}</div>`;
    } else {
      top = `<div class="callout-label"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CALLOUT_ICON[kind]}</svg>${CALLOUT_LABEL[kind]}</div>`
        + (m[2].trim() ? `<div class="callout-title">${m[2].trim()}</div>` : '');
    }
    body.insertAdjacentHTML('afterbegin', top);
    box.append(body);
    if (kind === 'step' || kind === 'see') {
      const { media, inline } = takeMedia(body);
      if (media.length) {
        const col = document.createElement('div');
        col.className = 'callout-media';
        col.append(...media);
        box.append(col);
        box.classList.add('has-media');
      }
      if (inline) box.classList.add('media-inline');
      for (const para of $$(':scope > p', body)) {
        // "Not seeing it? → …" on its own line becomes the box's footer line
        const split = kind === 'see' && /\n(Not seeing it\b[\s\S]*)$/i.exec(para.innerHTML);
        if (split) {
          para.innerHTML = para.innerHTML.slice(0, split.index);
          para.insertAdjacentHTML('afterend', `<p class="see-help">${split[1]}</p>`);
        }
        const t = para.textContent.trim();
        if (kind === 'step' && /^Done when\b/i.test(t)) para.classList.add('step-done');
        if (kind === 'see' && /^Not seeing it\b/i.test(t)) para.classList.add('see-help');
      }
    }
    bq.replaceWith(box);
  }
}

function inlineCode(root) {
  for (const code of $$('code', root)) {
    if (code.closest('pre, .chip')) continue;
    // Short code never breaks (a table column keeps "-m 5" on one line); long code wraps anywhere
    if (code.textContent.length <= 24) code.classList.add('is-short');
    if (code.closest('h1, h2, h3, h4')) continue;
    CHIP_RE.lastIndex = 0;
    if (!CHIP_RE.test(code.textContent)) continue;
    const tipText = CHIPS[code.textContent.replace(/^\$\{(.*)\}$/, '$$$1')];
    if (tipText) {
      code.classList.add('chip');
      code.tabIndex = 0;
      code.dataset.tip = tipText;
    } else {
      code.innerHTML = chips(code.innerHTML);
    }
  }
}

function linkCards(root) {
  for (const a of $$('.link-cards li > a:first-child', root)) {
    const t = a.nextSibling;
    if (t && t.nodeType === 3) t.textContent = t.textContent.replace(/^\s*[—–:-]\s*/, '');
  }
}

function wrapTables(root) {
  for (const table of $$('table', root)) {
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    table.replaceWith(wrap);
    wrap.append(table);
    if (wrap.closest('.stack-table')) {
      const labels = $$('thead th', table).map(th => th.textContent.trim());
      for (const row of $$('tbody tr', table)) [...row.cells].forEach((td, k) => { td.dataset.label = labels[k] || ''; });
    }
  }
}

// Fade the right edge of anything that scrolls sideways (tables, code) while there is more to see.
const edgeObserver = 'ResizeObserver' in window ? new ResizeObserver(es => es.forEach(e => edge(e.target))) : null;
function edge(el) {
  const more = el.scrollWidth - el.clientWidth > 1;
  el.classList.toggle('is-scrollable', more);
  el.classList.toggle('is-end', !more || el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
}
function watchEdges(root) {
  for (const el of $$('.table-wrap, .code-block pre', root)) {
    edge(el);
    el.addEventListener('scroll', () => { edge(el); hideTip(); }, { passive: true });
    edgeObserver?.observe(el);
  }
}

function prepareImages(root, page) {
  for (const img of $$('img', root)) {
    if (!img.hasAttribute('loading')) img.loading = 'lazy';
    img.decoding = 'async';
    if (!img.getAttribute('width') || !img.getAttribute('height')) {
      console.warn(`Desktap docs: image without width/height on "${page.slug}": ${img.getAttribute('src')}`);
    }
  }
}

function recipeCards(root, page) {
  for (const box of $$('.recipe-cards[data-set]', root)) {
    const set = box.dataset.set;
    const list = (manifest.recipes || []).filter(r => r.set === set);
    if (!list.length) console.warn(`Desktap docs: no recipes for set "${set}" in pages.json`);
    box.innerHTML = list.map(r => {
      const size = String(r.size || '').replace(/x/i, '×');
      const thumb = !r.thumb ? '' : /[/.]/.test(r.thumb) ? r.thumb : `assets/docs/img/recipes/${r.thumb}.png`;
      const [w, h] = { '1×1': [160, 160], '2×1': [336, 160], '1×2': [160, 336], '2×2': [336, 336] }[size] || [160, 160];
      const other = r.page !== page.slug && pages.get(r.page);
      const tags = [size, ...(r.tags || [])].filter(Boolean);
      // thumbText: a recipe that lives in Terminal, not on a button, shows its command instead of a face
      return `<a class="recipe-card" href="${esc(pageHref(r.page, r.anchor))}">`
        + (thumb ? `<span class="recipe-thumb"><img src="${esc(thumb)}" width="${w}" height="${h}" alt="" loading="lazy" decoding="async"></span>`
          : r.thumbText ? `<span class="recipe-thumb is-text"><span>${esc(r.thumbText)}</span></span>` : '')
        + `<span class="recipe-body"><span class="recipe-title">${esc(r.title)}</span>`
        + `<span class="recipe-summary">${esc(r.summary || '')}</span>`
        + (tags.length ? `<span class="recipe-tags">${tags.map(t => `<span>${esc(t)}</span>`).join('')}</span>` : '')
        + (other ? `<span class="recipe-where">On ${esc(other.title)} →</span>` : '')
        + '</span></a>';
    }).join('');
  }
}

/* ---------- Diagrams: lazy modules from assets/docs/js/diagrams/<name>.js ---------- */

let diagrams = [];
let diagramObserver = null;

function destroyDiagrams() {
  diagramObserver?.disconnect();
  diagramObserver = null;
  for (const d of diagrams) {
    d.dead = true;
    try { d.handle?.destroy?.(); } catch (err) { console.warn('Desktap docs: diagram destroy failed', err); }
  }
  diagrams = [];
}

async function mountDiagram(d) {
  const { el } = d;
  const name = el.dataset.diagram || '';
  if (!/^[a-z0-9-]+$/.test(name)) { console.warn(`Desktap docs: bad diagram name "${name}"`); return; }
  const fallback = el.innerHTML;
  el.classList.add('is-loading');
  try {
    const url = new URL(`js/diagrams/${name}.js`, import.meta.url);
    url.search = VERSION;
    const mod = await import(url.href);
    if (d.dead) return;
    // The module replaces the placeholder sentence with its figure (and puts it back on destroy)
    d.handle = await mod.default(el, { mode: el.dataset.mode || 'default', reducedMotion: reducedMotion() });
    if (d.dead) { d.handle?.destroy?.(); return; }
    if ($('.dt-diagram', el)) {
      for (const n of [...el.childNodes]) if (n.nodeType === 3 && n.textContent.trim()) n.remove();
    }
    el.classList.add('is-mounted');
    if (pendingHash) jumpTo(pendingHash);       // a diagram above the target changed the layout
  } catch (err) {
    el.innerHTML = fallback;
    el.classList.add('is-failed');
    console.warn(`Desktap docs: diagram "${name}" could not be shown`, err);
  } finally {
    el.classList.remove('is-loading');
  }
}

function mountDiagrams(root) {
  diagrams = $$('.dt-mount[data-diagram]', root).map(el => ({ el, handle: null, dead: false }));
  if (!diagrams.length) return;
  if (!('IntersectionObserver' in window)) { diagrams.forEach(mountDiagram); return; }
  diagramObserver = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      diagramObserver.unobserve(e.target);
      const d = diagrams.find(x => x.el === e.target);
      if (d) mountDiagram(d);
    }
  }, { rootMargin: '600px 0px' });
  diagrams.forEach(d => diagramObserver.observe(d.el));
}

/* ---------- Tooltip for chips ---------- */

const tip = document.createElement('div');
tip.className = 'docs-tip';
tip.id = 'docsTip';
tip.setAttribute('role', 'tooltip');
tip.hidden = true;
document.body.append(tip);
let tipFor = null;

function showTip(chip) {
  if (!chip.dataset.tip) return;
  tipFor = chip;
  tip.textContent = chip.dataset.tip;
  tip.hidden = false;
  chip.setAttribute('aria-describedby', 'docsTip');
  const r = chip.getBoundingClientRect();
  const w = tip.offsetWidth, h = tip.offsetHeight;
  const left = Math.min(Math.max(16, r.left + r.width / 2 - w / 2), innerWidth - 16 - w);
  const top = r.top - h - 8 >= 64 ? r.top - h - 8 : r.bottom + 8;
  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
}
function hideTip() {
  if (!tipFor) return;
  tipFor.removeAttribute('aria-describedby');
  tipFor = null;
  tip.hidden = true;
}
document.addEventListener('pointerover', e => { const c = e.target.closest?.('.chip'); if (c) showTip(c); });
document.addEventListener('pointerout', e => { const c = e.target.closest?.('.chip'); if (c && c !== document.activeElement && !c.contains(e.relatedTarget)) hideTip(); });
document.addEventListener('focusin', e => { if (e.target.classList?.contains('chip')) showTip(e.target); });
document.addEventListener('focusout', e => { if (e.target === tipFor) hideTip(); });
addEventListener('scroll', hideTip, { passive: true });

/* ---------- Manifest, routing, rendering ---------- */

let manifest = { pages: [], legacy: {}, recipes: [] };
let pages = new Map();
const mdCache = new Map();
let current = null;          // slug on screen
let renderToken = 0;
let pendingHash = null;      // a hash still to reach while the layout settles
let headings = [];
let tocLinks = new Map();

function pageHref(slug, anchor) {
  return (slug === 'start' ? location.pathname : `${location.pathname}?p=${encodeURIComponent(slug)}`) + (anchor ? `#${anchor}` : '');
}

function loadMarkdown(file) {
  if (!mdCache.has(file)) {
    mdCache.set(file, fetch(file, { cache: 'no-cache' }).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    }).catch(err => { mdCache.delete(file); throw err; }));
  }
  return mdCache.get(file);
}

function readLocation() {
  const slug = new URLSearchParams(location.search).get('p');
  let hash = '';
  try { hash = decodeURIComponent(location.hash.slice(1)); } catch { hash = location.hash.slice(1); }
  return { slug, hash };
}

function extractMeta(md) {
  let updated = null;
  md = md.replace(/<!--\s*updated\s*:\s*([^>]+?)\s*-->[ \t]*\n?/i, (_, v) => { updated = v.trim(); return ''; });
  return { md, updated };
}

function formatDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return s;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
    .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function setMeta(title, description, url) {
  document.title = title;
  const set = (sel, attr, v) => { const n = $(sel); if (n) n.setAttribute(attr, v); };
  set('meta[name="description"]', 'content', description);
  set('link[rel="canonical"]', 'href', url);
  set('meta[property="og:url"]', 'content', url);
  set('meta[property="og:title"]', 'content', title);
  set('meta[property="og:description"]', 'content', description);
  set('meta[name="twitter:title"]', 'content', title);
  set('meta[name="twitter:description"]', 'content', description);
}

function link(text, href, cls) {
  const a = document.createElement('a');
  a.href = href;
  a.textContent = text;
  if (cls) a.className = cls;
  return a;
}

function tocList(items, withH3) {
  const ul = document.createElement('ul');
  ul.className = 'docs-toc-list';
  let last = null, sub = null;
  for (const it of items) {
    if (it.level === 3 && !withH3) continue;
    const li = document.createElement('li');
    const a = link(it.text, `#${it.id}`);
    li.append(a);
    if (!tocLinks.has(it.id)) tocLinks.set(it.id, []);
    tocLinks.get(it.id).push(a);
    if (it.level === 2 || !last) { ul.append(li); last = li; sub = null; } else {
      if (!sub) { sub = document.createElement('ul'); last.append(sub); }
      sub.append(li);
    }
  }
  return ul;
}

function buildNav(page, items) {
  tocLinks = new Map();
  active = null;
  const frag = document.createDocumentFragment();
  for (const group of manifest.groups || [...new Set(manifest.pages.map(p => p.group))]) {
    const list = manifest.pages.filter(p => p.group === group);
    if (!list.length) continue;
    const box = document.createElement('div');
    box.className = 'docs-nav-group';
    box.innerHTML = `<div class="docs-nav-group-label">${esc(group)}</div>`;
    const ul = document.createElement('ul');
    for (const p of list) {
      const li = document.createElement('li');
      const a = link(p.title, pageHref(p.slug), 'docs-nav-page');
      if (page && p.slug === page.slug) {
        a.setAttribute('aria-current', 'page');
        li.className = 'is-current';
        li.append(a);
        // H2s here; their H3s show only in the phone panel (the rail lists them on wide screens)
        if (items.length) li.append(tocList(items, true));
      } else li.append(a);
      ul.append(li);
    }
    box.append(ul);
    frag.append(box);
  }
  ui.navPages.replaceChildren(frag);
  const has = items.length > 0;
  ui.railList.replaceChildren(...(has ? tocList(items, true).childNodes : []));
  ui.rail.hidden = !has;
  ui.dropdown.hidden = !has;
  $('ul', ui.dropdown)?.remove();
  if (has) ui.dropdown.append(tocList(items, true));
}

function buildPager(page) {
  const i = manifest.pages.findIndex(p => p.slug === page.slug);
  const prev = manifest.pages[i - 1], next = manifest.pages[i + 1];
  const card = (p, dir) => p
    ? `<a class="docs-pager-link is-${dir}" href="${esc(pageHref(p.slug))}"><span class="docs-pager-dir">${dir === 'prev' ? '← Previous' : 'Next →'}</span><span class="docs-pager-title">${esc(p.title)}</span></a>`
    : '<span></span>';
  ui.pager.innerHTML = card(prev, 'prev') + card(next, 'next');
  for (const [a, p, label] of [[ui.subPrev, prev, 'Previous'], [ui.subNext, next, 'Next']]) {
    a.hidden = !p;
    if (p) { a.href = pageHref(p.slug); a.setAttribute('aria-label', `${label}: ${p.title}`); }
  }
}

function renderInto(page, md) {
  codeTexts = [];
  const { md: body, updated } = extractMeta(md);
  const html = marked.parse(body);
  const root = document.createElement('div');
  root.innerHTML = html;

  // Page title: the first H1 moves into the header (or the manifest title stands in)
  let h1 = $('h1', root);
  if ($$('h1', root).length > 1) console.warn(`Desktap docs: more than one H1 on "${page.slug}"`);
  if (h1) h1.remove(); else { h1 = document.createElement('h1'); h1.textContent = page.title; }
  h1.tabIndex = -1;

  // Heading ids: GitHub-style slugs, de-duplicated; explicit ids in the page are kept
  const used = new Set($$('[id]', root).map(n => n.id));
  for (const h of [h1, ...$$('h2, h3, h4', root)]) {
    const base = slugify(h.textContent);
    let id = base, n = 1;
    while (used.has(id)) id = `${base}-${++n}`;
    used.add(id);
    h.id = id;
  }
  const items = $$('h2, h3', root).map(h => ({ id: h.id, level: +h.tagName[1], text: h.textContent.trim() }));
  for (const h of $$('h2, h3', root)) {
    const a = link('#', `#${h.id}`, 'docs-anchor');
    a.setAttribute('aria-label', `Link to “${h.textContent.trim()}”`);
    h.append(a);
  }

  // A script already collapsed in <details> ("Show the full script") opens in full
  for (const block of $$('details .code-block.is-long', root)) {
    block.classList.remove('is-long', 'is-folded');
    $('.code-more', block)?.remove();
  }
  transformCallouts(root);
  inlineCode(root);
  linkCards(root);
  wrapTables(root);
  prepareImages(root, page);
  recipeCards(root, page);

  ui.head.innerHTML = `<div class="docs-eyebrow">${esc(page.group || 'Docs')}</div>`;
  ui.head.append(h1);
  if (updated) ui.head.insertAdjacentHTML('beforeend', `<div class="docs-meta"><span class="docs-meta-info">Updated ${esc(formatDate(updated))}</span></div>`);
  ui.content.replaceChildren(...root.childNodes);
  ui.content.classList.remove('is-error');

  watchEdges(ui.content);
  mountDiagrams(ui.content);
  headings = $$('h2[id], h3[id]', ui.content);
  buildNav(page, items);
  buildPager(page);
  ui.subTitle.textContent = page.title;
  const url = page.slug === 'start' ? SITE : `${SITE}?p=${page.slug}`;
  setMeta(`${page.title} — Desktap Docs`, page.description || '', url);
  onScroll();
}

function renderMessage(title, html) {
  destroyDiagrams();
  ui.head.innerHTML = `<div class="docs-eyebrow">Docs</div><h1 tabindex="-1">${esc(title)}</h1>`;
  ui.content.innerHTML = html;
  ui.content.classList.add('is-error');
  ui.pager.innerHTML = '';
  headings = [];
  buildNav(null, []);
  ui.subTitle.textContent = title;
  setMeta(`${title} — Desktap Docs`, '', SITE);
}

async function render(slug, hash, { focus = false, y = null } = {}) {
  const token = ++renderToken;
  const page = pages.get(slug);
  if (!page) {
    console.warn(`Desktap docs: no page "${slug}"`);
    current = slug;
    renderMessage('Page not found', `<p>There is no docs page called “${esc(slug)}”. Start with <a href="${esc(pageHref('start'))}">Get started</a> or pick a page from the list.</p>`);
    return;
  }
  ui.main.classList.add('is-loading');
  let md;
  try {
    md = await loadMarkdown(page.file);
  } catch (err) {
    if (token !== renderToken) return;
    ui.main.classList.remove('is-loading');
    console.error(`Desktap docs: could not load ${page.file}`, err);
    current = null;
    renderMessage(page.title, `<p class="docs-error">This page could not be loaded (${esc(err.message)}). Check your connection and reload.</p>`);
    return;
  }
  if (token !== renderToken) return;
  ui.main.classList.remove('is-loading');
  destroyDiagrams();
  current = slug;
  renderInto(page, md);
  if (y !== null) jump(y);
  else if (hash) {
    if (!jumpTo(hash)) {
      console.warn(`Desktap docs: no section "#${hash}" on "${slug}"`);
      jump(0);
    }
  } else jump(0);
  if (focus) $('h1', ui.head)?.focus({ preventScroll: true });
}

// Scroll at once, without the page-wide smooth behavior (reading the style applies the override)
function instantly(fn) {
  const root = document.documentElement;
  root.style.scrollBehavior = 'auto';
  void getComputedStyle(root).scrollBehavior;
  fn();
  root.style.scrollBehavior = '';
}
function jump(y) {
  instantly(() => scrollTo(0, y));
}
function jumpTo(hash) {
  const t = document.getElementById(hash);
  if (!t) { pendingHash = null; return false; }
  instantly(() => t.scrollIntoView({ block: 'start' }));
  pendingHash = hash;
  return true;
}
for (const ev of ['wheel', 'touchstart', 'keydown', 'mousedown']) addEventListener(ev, () => { pendingHash = null; }, { passive: true });

function saveScroll() {
  history.replaceState({ ...(history.state || {}), y: scrollY }, '');
}

function go(url, { push = true } = {}) {
  const slug = url.searchParams.get('p') || 'start';
  let hash = '';
  try { hash = decodeURIComponent(url.hash.slice(1)); } catch { hash = url.hash.slice(1); }
  closePanel(false);
  if (slug === (current || '') && pages.has(slug)) {
    // Same page: glide over short distances, jump over long ones (a long smooth scroll keeps
    // running after the next click in some browsers)
    const t = hash ? document.getElementById(hash) : null;
    if (hash && !t) { console.warn(`Desktap docs: no section "#${hash}" on "${slug}"`); return; }
    const dist = t ? Math.abs(t.getBoundingClientRect().top) : scrollY;
    const smooth = !reducedMotion() && dist < innerHeight * 1.5;
    const move = () => (t ? t.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' }) : scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' }));
    if (smooth) move(); else instantly(move);
    if (t?.hasAttribute('tabindex')) t.focus({ preventScroll: true });     // the skip link moves focus to #main
    history.replaceState(history.state, '', url.pathname + url.search + (hash ? url.hash : ''));
    return;
  }
  if (push) {
    saveScroll();
    history.pushState({ y: null }, '', url.pathname + url.search + url.hash);
  }
  render(slug, hash, { focus: true });
}

function docsUrl(a) {
  if (!a.href || a.target && a.target !== '_self' || a.hasAttribute('download')) return null;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || url.pathname !== location.pathname) return null;
  return url;
}

document.addEventListener('click', e => {
  const t = e.target;
  if (!(t instanceof Element)) return;
  const copy = t.closest('.code-copy');
  if (copy) { onCopy(copy); return; }
  const fold = t.closest('.code-fold');
  if (fold) {
    const open = fold.getAttribute('aria-expanded') !== 'true';
    fold.setAttribute('aria-expanded', String(open));
    return;
  }
  const more = t.closest('.code-more');
  if (more) {
    const block = more.closest('.code-block');
    const open = block.classList.toggle('is-folded') === false;
    more.setAttribute('aria-expanded', String(open));
    more.textContent = open ? 'Show less' : `Show all ${more.dataset.lines} lines`;
    if (!open && block.getBoundingClientRect().top < 0) block.scrollIntoView({ block: 'start' });
    return;
  }
  const a = t.closest('a[href]');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const url = docsUrl(a);
  if (!url) return;
  e.preventDefault();
  go(url);
});

// Prefetch a page when a link to it is hovered or focused
function prefetch(e) {
  const a = e.target.closest?.('a[href]');
  const url = a && docsUrl(a);
  const page = url && pages.get(url.searchParams.get('p') || 'start');
  if (page && page.slug !== current) loadMarkdown(page.file).catch(() => {});
}
document.addEventListener('pointerover', prefetch, { passive: true });
document.addEventListener('focusin', prefetch);

addEventListener('popstate', e => {
  const { slug, hash } = readLocation();
  const target = slug || 'start';
  const y = e.state && typeof e.state.y === 'number' ? e.state.y : null;
  if (target === current) {
    if (y !== null) jump(y);
    else if (hash && !jumpTo(hash)) console.warn(`Desktap docs: no section "#${hash}" on "${target}"`);
    else if (!hash) jump(0);
    return;
  }
  render(target, hash, { y });
});
addEventListener('pagehide', saveScroll);

/* ---------- Scroll-spy ---------- */

let spyQueued = false, active = null;
function onScroll() {
  if (spyQueued) return;
  spyQueued = true;
  requestAnimationFrame(() => {
    spyQueued = false;
    let id = headings[0]?.id || null;
    for (const h of headings) {
      if (h.getBoundingClientRect().top <= 140) id = h.id; else break;
    }
    if (id === active) return;
    tocLinks.get(active)?.forEach(a => { a.classList.remove('active'); a.removeAttribute('aria-current'); });
    active = id;
    for (const a of tocLinks.get(id) || []) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'location');
      // Keep the active link visible inside its own scrolling list; never scroll the window.
      const box = a.closest('.docs-rail-inner, .docs-nav-inner');
      if (!box || box.offsetParent === null) continue;
      const lr = a.getBoundingClientRect(), br = box.getBoundingClientRect();
      if (lr.top < br.top) box.scrollTop -= br.top - lr.top + 8;
      else if (lr.bottom > br.bottom) box.scrollTop += lr.bottom - br.bottom + 8;
    }
  });
}
addEventListener('scroll', onScroll, { passive: true });

/* ---------- Mobile panel ---------- */

function openPanel() {
  ui.nav.classList.add('open');
  document.documentElement.classList.add('docs-panel-open');
  ui.toggle.setAttribute('aria-expanded', 'true');
  ui.backdrop.hidden = false;
  ui.main.inert = true;
  if (ui.footer) ui.footer.inert = true;
  requestAnimationFrame(() => {
    const cur = $('[aria-current="page"]', ui.nav);
    const inner = $('.docs-nav-inner', ui.nav);
    if (cur && inner) inner.scrollTop = Math.max(0, cur.offsetTop - 96);
    (cur || ui.close).focus({ preventScroll: true });
  });
}
function closePanel(refocus = true) {
  if (!ui.nav.classList.contains('open')) return;
  ui.nav.classList.remove('open');
  document.documentElement.classList.remove('docs-panel-open');
  ui.toggle.setAttribute('aria-expanded', 'false');
  ui.backdrop.hidden = true;
  ui.main.inert = false;
  if (ui.footer) ui.footer.inert = false;
  if (refocus) ui.toggle.focus({ preventScroll: true });
}
ui.toggle.addEventListener('click', () => (ui.nav.classList.contains('open') ? closePanel() : openPanel()));
ui.close.addEventListener('click', () => closePanel());
ui.backdrop.addEventListener('click', () => closePanel());
addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  hideTip();
  if (ui.nav.classList.contains('open')) closePanel();
  if (ui.dropdown.open) ui.dropdown.open = false;
});
matchMedia('(max-width: 899px)').addEventListener('change', () => closePanel(false));
ui.dropdown.addEventListener('click', e => { if (e.target.closest('a')) ui.dropdown.open = false; });

/* ---------- Start ---------- */

let marked;
async function start() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const first = readLocation();
  // The page file follows the slug, so it can load while the manifest does
  if (first.slug && /^[a-z0-9-]+$/.test(first.slug)) loadMarkdown(`assets/docs/pages/${first.slug}.md`).catch(() => {});
  else if (!first.slug && !first.hash) loadMarkdown('assets/docs/pages/start.md').catch(() => {});
  try {
    const [mod, res] = await Promise.all([import(MARKED_URL), fetch(MANIFEST_URL, { cache: 'no-cache' })]);
    if (!res.ok) throw new Error(`pages.json: HTTP ${res.status}`);
    manifest = await res.json();
    marked = mod.marked;
  } catch (err) {
    console.error('Desktap docs: could not start', err);
    ui.content.innerHTML = '<p class="docs-error">The documentation could not be loaded. Check your connection and reload the page.</p>';
    return;
  }
  pages = new Map(manifest.pages.map(p => [p.slug, p]));
  marked.use({ gfm: true, breaks: false, renderer: { code: renderCode } });

  let { slug, hash } = first;
  const legacy = hash && (manifest.legacy?.[hash] || manifest.legacy?.[hash.toLowerCase()]);
  if (!slug && legacy) {
    // An old single-page link (docs#startup-scripts-live-widgets): move it to its new page
    history.replaceState(history.state, '', location.pathname + legacy);
    ({ slug, hash } = readLocation());
  }
  const y = history.state && typeof history.state.y === 'number' ? history.state.y : null;
  await render(slug || 'start', hash, { y });
}

start();
