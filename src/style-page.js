// Style — how Guardian headlines are written, by year.
//
// Reads the headline-language index (build/build_language.py), folds
// the monthly counts into yearly rates, and renders a hero chart (the
// length of a headline) plus a grid of habit cards, each a small SVG
// line. Yearly is the honest granularity: language drifts, it doesn't
// spike, and fifteen clean points beat 174 noisy ones.
//
// All charts share a zero baseline — see the page's small print. The
// current (partial) year is drawn hollow.

import { loadLanguage } from './data.js';
import { MARKERS } from './markers.js';
import { sectionLabel } from './sections.js';
import { toneLabel } from './tones.js';

const heroNowEl = document.getElementById('sp-hero-now');
const heroThenEl = document.getElementById('sp-hero-then');
const heroChartEl = document.getElementById('sp-hero-chart');
const cardsEl = document.getElementById('sp-cards');
const statBig = document.getElementById('stat-big');
const exclusiveEl = document.getElementById('sp-exclusive');
const totalInlineEl = document.getElementById('sp-total-inline');

// The habit cards, in editorial order. Deks are FUNCTIONS: the
// editorial framing is written once, but every number in it is
// computed from the live data at render time — observations can't
// quietly go out of date as new months arrive. ctx gives them the
// first/now values, the years, and a peak-month lookup.
const oneIn = v => Math.max(1, Math.round(100 / v)).toLocaleString('en-GB');
const times = (now, first) => {
  const r = now / first;
  return r >= 9.5 ? `${Math.round(r)} times` : r >= 1.95 && r < 2.5 ? 'twice' : `${r.toFixed(1)} times`;
};

const CARDS = [
  {
    key: 'quote_start', title: 'The quote era',
    dek: c => `Headlines that open with someone talking. One in ${oneIn(c.now)} now; one in ${oneIn(c.first)} in ${c.y0}.`,
  },
  {
    key: 'first_person', title: 'First person',
    dek: c => `Headlines containing "I", "my" or "me" as a word — ${times(c.now, c.first)} as common as in ${c.y0}. The age of the personal.`,
  },
  {
    key: 'as_it_happened', title: '…as it happened',
    dek: c => `The liveblog, as the archive remembers it — closed live blogs are retitled, and they have multiplied ${times(c.now, c.first)} over.`,
  },
  {
    key: 'question', title: 'The question mark',
    dek: c => `Are headlines becoming questions? Barely — about one in ${oneIn(c.now)}, much as ever.`,
  },
  {
    key: 'colon', title: 'The colon',
    dek: c => `Eternal. About ${Math.round(c.now)}% of all headlines, every year, forever.`,
  },
  {
    key: 'short5', title: 'Five words or fewer',
    dek: c => `One in ${oneIn(c.first)} in ${c.y0}; one in ${oneIn(c.now)} now. Less a dying art than a change of job — a headline that travels alone in a feed has to say what the story actually is.`,
  },
  {
    key: 'digits', title: 'Numbers',
    dek: c => `Headlines containing a digit. Note the bump in ${c.peakYear('digits')}, when the news became counting.`,
  },
  {
    key: 'amid', title: 'Amid',
    dek: c => `Journalism’s busiest preposition, ${times(c.now, c.first)} more common than in ${c.y0}. Peak amid: ${c.peakMonth('amid')}.`,
  },
  {
    key: 'revealed', title: 'Revealed:',
    dek: c => `Rare — but ${times(c.now, c.first)} less rare than it used to be.`,
  },
];

let _lang = null;
let _scope = '';   // '' = all · section id · 'tone/<id>'

init();

async function init() {
  try {
    const lang = await loadLanguage();
    _lang = lang;

    const total = lang.totals.reduce((a, b) => a + b, 0);
    if (statBig) statBig.textContent = formatCount(total);
    if (exclusiveEl) exclusiveEl.textContent = lang.metrics.exclusive.reduce((a, b) => a + b, 0);
    if (totalInlineEl) totalInlineEl.textContent = total.toLocaleString('en-GB');

    buildScopeControl(lang);
    initLedgerToggle();
    const wanted = new URLSearchParams(location.search).get('in') || '';
    applyScope(scopeExists(lang, wanted) ? wanted : '');

    // All-headlines by design, whatever the scope — see the small print.
    renderNames(lang);
    renderFacts(lang);
  } catch (e) {
    console.error(e);
    if (heroChartEl) heroChartEl.textContent = 'Could not load data. Has the build run yet?';
  }
}

// ── Scopes ──
function scopeExists(lang, scope) {
  if (!scope) return true;
  if (scope.startsWith('tone/')) return !!lang.scopes?.tones?.[scope.slice(5)];
  return !!lang.scopes?.sections?.[scope];
}

function scopeLabelFor(scope) {
  if (!scope) return '';
  return scope.startsWith('tone/') ? toneLabel(scope) : sectionLabel(scope);
}

function sliceFor(lang, scope) {
  if (!scope) return lang;
  const s = scope.startsWith('tone/')
    ? lang.scopes.tones[scope.slice(5)]
    : lang.scopes.sections[scope];
  return {
    months: lang.months,
    totals: s.totals,
    metrics: { ...s.metrics, avg_words: s.avg_words },
  };
}

function buildScopeControl(lang) {
  const sel = document.getElementById('sp-scope-select');
  if (!sel || !lang.scopes) return;
  const group = (label, entries, prefix) => {
    const og = document.createElement('optgroup');
    og.label = label;
    for (const [id, name] of entries) {
      const o = document.createElement('option');
      o.value = prefix + id;
      o.textContent = name;
      og.appendChild(o);
    }
    sel.appendChild(og);
  };
  const secs = Object.keys(lang.scopes.sections)
    .map(id => [id, sectionLabel(id)]).sort((a, b) => a[1].localeCompare(b[1]));
  const tones = Object.keys(lang.scopes.tones)
    .map(id => [id, toneLabel('tone/' + id)]).sort((a, b) => a[1].localeCompare(b[1]));
  group('Sections', secs, '');
  group('Tones', tones, 'tone/');
  sel.addEventListener('change', () => applyScope(sel.value));
}

function applyScope(scope) {
  _scope = scope;
  const sel = document.getElementById('sp-scope-select');
  if (sel) {
    if (sel.value !== scope) sel.value = scope;
    sel.classList.toggle('active', !!scope);   // blue = filtered, as on Trends
  }
  const Y = toYearly(sliceFor(_lang, scope));
  const label = scopeLabelFor(scope);
  renderHero(Y, label);
  renderCards(Y, label);
  renderLedger(Y);
  // URL reflects reality: whatever ledger panel is open right now (the
  // deep-linked one on first render; none after a scope change).
  const openKey = document.querySelector('.sp-led-panel:not([hidden])')?.parentElement?.dataset.key || null;
  syncStyleURL(openKey);
}

// One URL writer for the page's two params, so neither clobbers the other.
function syncStyleURL(marker) {
  const p = new URLSearchParams();
  if (_scope) p.set('in', _scope);
  if (marker) p.set('marker', marker);
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

// ── The full ledger ──
// The five biggest movers show by default; search sees everything; the
// button reveals the rest. A ?marker= deep link or an open row always
// stays visible regardless.
const LEDGER_TEASER = 5;
let _ledgerExpanded = false;

function applyLedgerVisibility() {
  const listEl = document.getElementById('sp-ledger-list');
  const filterEl = document.getElementById('sp-ledger-filter');
  const q = (filterEl?.value || '').trim().toLowerCase();
  listEl.querySelectorAll('.sp-led').forEach((li, i) => {
    const matches = !q || li.dataset.text.includes(q);
    const open = !!li.querySelector('.sp-led-panel:not([hidden])');
    li.hidden = !(matches && (q || _ledgerExpanded || open || i < LEDGER_TEASER));
  });
  const btn = document.getElementById('sp-ledger-toggle');
  if (btn) {
    btn.hidden = !!q;   // searching shows everything that matches anyway
    const total = listEl.querySelectorAll('.sp-led').length;
    btn.textContent = _ledgerExpanded ? 'Show the top five ↑' : `Show all ${total} ↓`;
    btn.setAttribute('aria-expanded', String(_ledgerExpanded));
  }
}

function initLedgerToggle() {
  const btn = document.getElementById('sp-ledger-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    _ledgerExpanded = !_ledgerExpanded;
    applyLedgerVisibility();
  });
}

// Every catalogued marker as a compact expandable row, biggest movers
// first. Click a row for its full chart; ?marker=key deep-links one.
function renderLedger(Y) {
  const listEl = document.getElementById('sp-ledger-list');
  const filterEl = document.getElementById('sp-ledger-filter');
  if (!listEl) return;

  const rows = MARKERS
    .filter(m => Y.series[m.key])
    .map(m => {
      const vals = Y.series[m.key];
      const first = vals[0];
      const now = vals[vals.length - 1];
      // log-ratio movement, with a floor so dead-vs-dead doesn't explode
      const move = Math.abs(Math.log((now + 0.01) / (first + 0.01)));
      return { m, vals, first, now, move };
    })
    .sort((a, b) => b.move - a.move);

  listEl.innerHTML = rows.map(({ m, first, now }) => `
    <li class="sp-led" data-key="${m.key}" data-text="${escapeHtml((m.title + ' ' + m.def + ' ' + m.group).toLowerCase())}">
      <button type="button" class="sp-led-row" aria-expanded="false">
        <span class="sp-led-title">${escapeHtml(m.title)}</span>
        <span class="sp-led-group">${escapeHtml(m.group)}</span>
        <span class="sp-led-nums">${fmtPct(first)} <span class="sp-led-arrow">→</span> ${fmtPct(now)}</span>
      </button>
      <div class="sp-led-panel" hidden></div>
    </li>`).join('');

  const expand = (li, scroll = false) => {
    const btn = li.querySelector('.sp-led-row');
    const panel = li.querySelector('.sp-led-panel');
    const open = panel.hidden;
    // Close any other open row — one chart at a time keeps the list calm.
    listEl.querySelectorAll('.sp-led-panel:not([hidden])').forEach(p => {
      p.hidden = true;
      p.parentElement.querySelector('.sp-led-row').setAttribute('aria-expanded', 'false');
    });
    if (!open) { syncStyleURL(null); applyLedgerVisibility(); return; }
    const { m, vals } = rows.find(r => r.m.key === li.dataset.key);
    // Word-type markers link to a word-mode deep dive — the actual
    // headlines behind the line. Punctuation and format markers can't
    // be searched, so they don't pretend to be links.
    const diveLink = m.q
      ? ` <a class="dd-link" href="./deepdive.html?q=${encodeURIComponent(m.q)}">browse these headlines →</a>`
      : '';
    panel.innerHTML = `
      ${lineSVG(Y.years, vals, { w: 600, h: 110, partialFinal: Y.partialFinal, fmt: fmtPct })}
      <div class="sp-card-years" aria-hidden="true">
        <span>${Y.years[0]}</span>
        <span>${Y.years[Y.years.length - 1]}${Y.partialFinal ? ' so far' : ''}</span>
      </div>
      <p class="sp-card-dek">${escapeHtml(m.def)}${diveLink}</p>`;
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    syncStyleURL(m.key);
    applyLedgerVisibility();
    if (scroll) li.scrollIntoView({ block: 'center' });
  };

  // Assignment, not addEventListener — renderLedger re-runs on every
  // scope change and must not stack handlers.
  listEl.onclick = (e) => {
    const li = e.target.closest('.sp-led');
    if (li) expand(li);
  };

  filterEl.oninput = applyLedgerVisibility;

  // Deep-linked marker: honoured on first render only — later renders
  // are scope changes, which deliberately start the list closed.
  if (!renderLedger._initDone) {
    renderLedger._initDone = true;
    const wanted = new URLSearchParams(location.search).get('marker');
    if (wanted) {
      const li = listEl.querySelector(`.sp-led[data-key="${CSS.escape(wanted)}"]`);
      if (li) expand(li, true);
    }
  }
  applyLedgerVisibility();
}

// ── The first-name league ──
// Year chips select a year; two lists — male and female — show its top
// first names, each bar scaled to its own list's leader. Methodology is
// in the small print — the short version is that "Boris" means everyone
// called Boris.
function renderNames(lang) {
  const wrap = document.getElementById('sp-names');
  if (!wrap || !lang.names?.m) return;
  const years = Object.keys(lang.names.m).sort();
  const chipsEl = document.getElementById('sp-names-years');
  let selected = years[years.length - 1];

  chipsEl.innerHTML = years.map(y =>
    `<button type="button" class="sp-year-chip${y === selected ? ' active' : ''}" data-year="${y}">'${y.slice(2)}</button>`
  ).join('');

  const renderList = (gender, y) => {
    const listEl = document.getElementById(`sp-names-list-${gender}`);
    const top = (lang.names[gender][y] || []).slice(0, 8);
    const max = top.length ? top[0][1] : 1;
    listEl.innerHTML = top.map(([name, count, surname, tagId], i) => {
      // Dominant companion surname, when one genuinely dominates. The
      // pair links to its person's deep dive when a tag exists; without
      // one, the forename links to a word-mode dive — every headline
      // containing it, which is exactly what the row counts.
      const label = `${escapeHtml(name)}${surname ? ` <span class="sp-name-sur">${escapeHtml(surname)}</span>` : ''}`;
      const href = tagId
        ? `./deepdive.html?tag=${encodeURIComponent(tagId)}`
        : `./deepdive.html?q=${encodeURIComponent(name)}`;
      const aria = tagId
        ? `Deep dive on ${escapeHtml(name)} ${escapeHtml(surname || '')}`
        : `Every headline containing ${escapeHtml(name)}`;
      const nameCell = `<a class="sp-name sp-name-link" href="${href}" aria-label="${aria}">${label}</a>`;
      return `
      <li class="sp-name-row">
        <span class="sp-name-rank">${i + 1}</span>
        ${nameCell}
        <span class="sp-name-bar"><span style="width:${(100 * count / max).toFixed(1)}%"></span></span>
        <span class="sp-name-count">${count.toLocaleString('en-GB')}</span>
      </li>`;
    }).join('');
    listEl.setAttribute('aria-label',
      `Top ${gender === 'm' ? 'male' : 'female'} first names in ${y} headlines`);
  };

  const show = (y) => {
    selected = y;
    [...chipsEl.children].forEach(b => b.classList.toggle('active', b.dataset.year === y));
    renderList('m', y);
    renderList('f', y);
  };

  chipsEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-year]');
    if (b) show(b.dataset.year);
  });
  show(selected);
}

// ── One more thing — the fact shuffle ──
function renderFacts(lang) {
  const factEl = document.getElementById('sp-fact');
  const btn = document.getElementById('sp-fact-btn');
  if (!factEl || !btn || !lang.facts?.length) return;
  // Fisher–Yates once, then cycle — every fact appears before any repeats.
  const pool = [...lang.facts];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  let i = 0;
  const show = () => { factEl.textContent = pool[i % pool.length]; i++; };
  btn.addEventListener('click', show);
  show();
}

// ── Yearly aggregation ──
function toYearly(lang) {
  const years = [...new Set(lang.months.map(m => +m.slice(0, 4)))].sort();
  const idxByYear = years.map(y =>
    lang.months.map((m, i) => [m, i]).filter(([m]) => +m.slice(0, 4) === y).map(([, i]) => i));

  const totals = idxByYear.map(ix => ix.reduce((a, i) => a + lang.totals[i], 0));
  const series = {};
  for (const key of Object.keys(lang.metrics)) {
    const vals = lang.metrics[key];
    series[key] = idxByYear.map((ix, yi) => {
      if (!totals[yi]) return 0;
      if (key.startsWith('avg_')) {
        // weighted mean of monthly means
        return ix.reduce((a, i) => a + vals[i] * lang.totals[i], 0) / totals[yi];
      }
      return 100 * ix.reduce((a, i) => a + vals[i], 0) / totals[yi];
    });
  }
  const lastMonth = lang.months[lang.months.length - 1];
  const partialFinal = years[years.length - 1] === +lastMonth.slice(0, 4) && !lastMonth.endsWith('-12');
  return { years, totals, series, partialFinal };
}

// ── Hero ──
function renderHero(Y, scopeLabel = '') {
  const words = Y.series.avg_words;
  const now = words[words.length - 1];
  const first = words[0];
  const eyebrow = document.querySelector('#sp-hero .dd-eyebrow');
  const unit = document.querySelector('.sp-hero-unit');
  if (eyebrow) eyebrow.textContent = scopeLabel ? 'Headline length' : 'The headline became a sentence';
  if (unit) unit.textContent = scopeLabel
    ? `words in an average ${scopeLabel} headline now`
    : 'words in an average headline now';
  heroNowEl.textContent = now.toFixed(1);
  heroThenEl.textContent = `it was ${first.toFixed(1)} in ${Y.years[0]}` +
    (scopeLabel ? '' : ' — the headline stopped being a label');
  heroChartEl.innerHTML = lineSVG(Y.years, words, {
    w: 720, h: 200, partialFinal: Y.partialFinal,
    fmt: v => v.toFixed(1), big: true,
  });
}

// ── Cards ──
// The deks are written about all headlines; under a scope their claims
// could lie, so they step aside for a plain statement of what's counted.
function dekContext(Y) {
  const y0 = Y.years[0];
  const solid = _lang.totals.map((n, i) => n >= 1000 ? i : -1).filter(i => i >= 0);
  const rate = (key, i) => _lang.metrics[key][i] / _lang.totals[i];
  return {
    y0,
    peakMonth(key) {
      const i = solid.reduce((a, b) => rate(key, a) >= rate(key, b) ? a : b);
      const [y, m] = _lang.months[i].split('-');
      return ['January', 'February', 'March', 'April', 'May', 'June', 'July',
        'August', 'September', 'October', 'November', 'December'][m - 1] + ' ' + y;
    },
    peakYear(key) {
      const vals = Y.series[key];
      return Y.years[vals.indexOf(Math.max(...vals))];
    },
  };
}

function renderCards(Y, scopeLabel = '') {
  const ctx = scopeLabel ? null : dekContext(Y);
  cardsEl.innerHTML = CARDS.map(c => {
    const vals = Y.series[c.key];
    const now = vals[vals.length - 1];
    const first = vals[0];
    // Scoped views drop the dek entirely — the captions are written
    // about all headlines, and the scope control already says what's
    // being counted.
    const dek = scopeLabel ? '' : `<p class="sp-card-dek">${escapeHtml(c.dek({ ...ctx, now, first }))}</p>`;
    return `
      <article class="sp-card">
        <h2 class="sp-card-title">${escapeHtml(c.title)}</h2>
        <p class="sp-card-now">${fmtPct(now)}<span class="sp-card-then"> · ${fmtPct(first)} in ${Y.years[0]}</span></p>
        ${lineSVG(Y.years, vals, { w: 300, h: 84, partialFinal: Y.partialFinal, fmt: fmtPct })}
        <div class="sp-card-years" aria-hidden="true">
          <span>${Y.years[0]}</span>
          <span>${Y.years[Y.years.length - 1]}${Y.partialFinal ? ' so far' : ''}</span>
        </div>
        ${dek}
      </article>`;
  }).join('');
}

function fmtPct(v) {
  return (v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2)) + '%';
}

// ── SVG line (zero baseline, hollow final dot when the year is partial) ──
// Card SVGs carry NO text: SVG text scales with the viewBox, so a 10px
// tick becomes a 23px monster when a card stretches to a narrow
// viewport's full width. Year labels live in an HTML row underneath.
// The path uses non-scaling-stroke for the same reason.
function lineSVG(years, vals, { w, h, partialFinal, fmt, big = false }) {
  const padL = big ? 34 : 6, padR = big ? 16 : 6, padT = 14, padB = big ? 22 : 8;
  const max = Math.max(...vals) * 1.12 || 1;
  const x = i => padL + (w - padL - padR) * (i / (vals.length - 1));
  const y = v => padT + (h - padT - padB) * (1 - v / max);

  const path = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const lastI = vals.length - 1;

  // The hero renders ~1:1, so in-SVG text is safe there — and it needs
  // the axis values.
  const yearLabels = big
    ? years.map((yr, i) => (i % 2 === 0 || i === lastI)
        ? `<text class="sp-tick" x="${x(i).toFixed(1)}" y="${h - 6}" text-anchor="middle">${i === 0 ? yr : `'${String(yr).slice(2)}`}</text>`
        : '').join('')
    : '';

  const grid = big
    ? [0.25, 0.5, 0.75, 1].map(f =>
        `<line class="sp-gline" x1="${padL}" y1="${y(max * f).toFixed(1)}" x2="${w - padR}" y2="${y(max * f).toFixed(1)}"/>
         <text class="sp-tick" x="${padL - 5}" y="${(y(max * f) + 3).toFixed(1)}" text-anchor="end">${fmt(max * f)}</text>`).join('')
    : '';

  const r = big ? 3.5 : 2.5;
  const endDot = partialFinal
    ? `<circle class="sp-dot-hollow" cx="${x(lastI).toFixed(1)}" cy="${y(vals[lastI]).toFixed(1)}" r="${r}"/>`
    : `<circle class="sp-dot" cx="${x(lastI).toFixed(1)}" cy="${y(vals[lastI]).toFixed(1)}" r="${r}"/>`;

  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    ${grid}
    <path class="sp-line" d="${path}" vector-effect="non-scaling-stroke"/>
    <circle class="sp-dot" cx="${x(0).toFixed(1)}" cy="${y(vals[0]).toFixed(1)}" r="${big ? 3 : 2.5}"/>
    ${endDot}
    ${yearLabels}
  </svg>`;
}

function formatCount(n) {
  return n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
