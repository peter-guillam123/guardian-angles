// Deep dive — a single-topic view showing every Guardian headline in a
// chosen range, the shape of coverage, and the tags it tends to travel
// with.
//
// Architecture note: the summary strip renders instantly from the
// already-loaded monthly indexes (no shard I/O). The headline list
// streams in as shards load, newest-first — so the user sees the shape
// of the answer immediately and the detail fills in behind it.

import {
  loadIndex, loadTagIndex, loadTagCatalog, loadSections, loadShard,
  makeWordMatcher,
} from './data.js';
import { sectionLabel, sectionColor } from './sections.js';
import { isUsefulTag } from './skip-tags.js';

// ───────────────── State ─────────────────
const state = {
  mode: 'tags',                    // 'tags' | 'words'
  query: null,                     // { kind, id|term, label }
  yearFrom: 2012,
  yearTo: new Date().getUTCFullYear(),
  headlines: [],                   // accumulated results, newest-first
  cancelToken: 0,                  // increment to cancel in-flight streams
  tagCatalog: null,                // lazy-loaded when tags mode is active
  cotags: new Map(),               // tag id → count, live
  words: new Map(),                // word → count of *headlines* containing it
  peakMonth: null,                 // YYYY-MM of the current peak
  peakExpanded: false,             // whether the peak drilldown is open
};

// Light stopword set for the headline-word-frequency block. Kept
// small and boring — the goal is to surface content words, not tune
// the list. Plus common Guardian headline verbs ("says", "said")
// that add little editorial signal.
const STOPWORDS = new Set((`
a an the and or but if so as of in on at to for from by with about into over under
is are was were be been being am
it its their his her my our your this that these those they them we us i me
has have had do does did will would could should may might can must
not no nor only just also more most less so than then
new over after before during up down out off out
one two three four five ten
says said say saying
who what when where why how which
s t re ve ll d
`).trim().split(/\s+/));

// ───────────────── Elements ─────────────────
const modeBtns = document.querySelectorAll('.mode-toggle .mode-btn');
const inputEl = document.getElementById('dd-input');
const labelEl = document.getElementById('dd-label');
const formEl = document.getElementById('dd-form');
const clearEl = document.getElementById('dd-clear');
const yearFromInp = document.getElementById('dd-year-from');
const yearToInp = document.getElementById('dd-year-to');
const yearFromDisp = document.getElementById('dd-year-from-display');
const yearToDisp = document.getElementById('dd-year-to-display');
const rangeFill = document.getElementById('dd-range-fill');
const promptEl = document.getElementById('dd-prompt');
const summaryEl = document.getElementById('dd-summary');
const bodyEl = document.getElementById('dd-body');
const headlineEl = document.getElementById('dd-headline');
const subEl = document.getElementById('dd-sub');
const statTotal = document.getElementById('dd-stat-total');
const statPeak = document.getElementById('dd-stat-peak');
const statFirst = document.getElementById('dd-stat-first');
const statLast = document.getElementById('dd-stat-last');
const sparkEl = document.getElementById('dd-spark');
const sectionsEl = document.getElementById('dd-sections');
const listCountEl = document.getElementById('dd-list-count');
const filterEl = document.getElementById('dd-filter');
const exportEl = document.getElementById('dd-export');
const progressEl = document.getElementById('dd-progress');
const headlinesEl = document.getElementById('dd-headlines');
const cotagsEl = document.getElementById('dd-cotags');
const wordsEl = document.getElementById('dd-words');
const statBig = document.getElementById('stat-big');
const heatmapEl = document.getElementById('dd-heatmap');
const dispatchesEl = document.getElementById('dd-dispatches');
const dispatchFirstEl = document.querySelector('#dd-dispatch-first .dd-dispatch-body');
const dispatchLatestEl = document.querySelector('#dd-dispatch-latest .dd-dispatch-body');
const peakBtn = document.getElementById('dd-stat-peak-btn');
const peakDrill = document.getElementById('dd-peak-drill');
const peakLabel = document.getElementById('dd-peak-label');
const peakList = document.getElementById('dd-peak-list');

// ───────────────── Init ─────────────────
(async function init() {
  // Masthead stat — uses the same meta.json trick as other pages.
  loadSections().then(s => {
    const total = s.totals.reduce((a, b) => a + b, 0);
    if (statBig && (/^[—\-]$|^\s*$/.test(statBig.textContent))) {
      statBig.textContent = total >= 1_000_000
        ? (total / 1_000_000).toFixed(2) + 'M'
        : Math.round(total / 1000) + 'k';
    }
  });

  wireMode();
  wireRange();
  wireForm();
  wireFilter();
  wireExport();
  applyModeUI();
  // Pull query from URL so the page is deep-linkable.
  const params = new URLSearchParams(location.search);
  const tag = params.get('tag');
  const q = params.get('q');
  const from = parseInt(params.get('from'));
  const to = parseInt(params.get('to'));
  if (from) { yearFromInp.value = from; }
  if (to) { yearToInp.value = to; }
  updateYearDisplay();
  if (tag) {
    setMode('tags');
    await loadCatalogIfNeeded();
    const t = state.tagCatalog.find(x => x.id === tag);
    inputEl.value = t?.name || tag;
    inputEl.dataset.tagId = tag;
    runDeepDive();
  } else if (q) {
    setMode('words');
    inputEl.value = q;
    runDeepDive();
  }
})();

// ───────────────── Mode ─────────────────
function wireMode() {
  modeBtns.forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
}
function setMode(mode) {
  state.mode = mode;
  modeBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  applyModeUI();
  delete inputEl.dataset.tagId;
  inputEl.value = '';
}
async function applyModeUI() {
  if (state.mode === 'tags') {
    labelEl.textContent = 'Search a tag';
    inputEl.placeholder = 'e.g. donald trump, climate crisis…';
    await loadCatalogIfNeeded();
    attachSimpleAutocomplete(inputEl);
  } else {
    labelEl.textContent = 'Search headlines for a word';
    inputEl.placeholder = 'e.g. starmer, inflation…';
    detachAutocomplete(inputEl);
  }
}

async function loadCatalogIfNeeded() {
  if (!state.tagCatalog) state.tagCatalog = await loadTagCatalog();
}

// Lightweight autocomplete (reuses the same dropdown CSS as Trends).
let _acDropdown = null;
function attachSimpleAutocomplete(inp) {
  detachAutocomplete(inp);
  const dropdown = document.createElement('ul');
  dropdown.className = 'ac-dropdown';
  dropdown.hidden = true;
  inp.parentElement.style.position = 'relative';
  inp.parentElement.appendChild(dropdown);
  _acDropdown = dropdown;

  const render = () => {
    const q = inp.value.trim().toLowerCase();
    if (!q) { dropdown.hidden = true; return; }
    const matches = [];
    for (const t of state.tagCatalog) {
      if (t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)) {
        matches.push(t);
        if (matches.length >= 8) break;
      }
    }
    if (!matches.length) { dropdown.hidden = true; return; }
    dropdown.innerHTML = matches.map(t => `
      <li class="ac-item" data-id="${t.id}" data-name="${escapeAttr(t.name)}">
        <span class="ac-name">${escapeHtml(t.name)}</span>
        <span class="ac-slug">${escapeHtml(t.id)}</span>
        <span class="ac-count">${(t.n || 0).toLocaleString('en-GB')}</span>
      </li>`).join('');
    dropdown.hidden = false;
  };
  const onInput = () => render();
  const onClick = (e) => {
    const li = e.target.closest('.ac-item');
    if (!li) return;
    inp.value = li.dataset.name;
    inp.dataset.tagId = li.dataset.id;
    dropdown.hidden = true;
  };
  const onBlur = () => setTimeout(() => { dropdown.hidden = true; }, 200);
  const onFocus = () => render();
  inp.addEventListener('input', onInput);
  dropdown.addEventListener('mousedown', onClick);
  inp.addEventListener('blur', onBlur);
  inp.addEventListener('focus', onFocus);
  inp._acCleanup = () => {
    inp.removeEventListener('input', onInput);
    inp.removeEventListener('blur', onBlur);
    inp.removeEventListener('focus', onFocus);
    dropdown.remove();
    _acDropdown = null;
  };
}
function detachAutocomplete(inp) {
  if (inp._acCleanup) { inp._acCleanup(); delete inp._acCleanup; }
}

// ───────────────── Year range ─────────────────
function wireRange() {
  const onInput = () => {
    let from = parseInt(yearFromInp.value);
    let to = parseInt(yearToInp.value);
    if (from > to) [from, to] = [to, from];
    state.yearFrom = from;
    state.yearTo = to;
    updateYearDisplay();
  };
  yearFromInp.addEventListener('input', onInput);
  yearToInp.addEventListener('input', onInput);
}
function updateYearDisplay() {
  const min = parseInt(yearFromInp.min), max = parseInt(yearFromInp.max);
  const span = Math.max(1, max - min);
  const fromPct = ((parseInt(yearFromInp.value) - min) / span) * 100;
  const toPct = ((parseInt(yearToInp.value) - min) / span) * 100;
  rangeFill.style.left = fromPct + '%';
  rangeFill.style.right = (100 - toPct) + '%';
  yearFromDisp.textContent = yearFromInp.value;
  yearToDisp.textContent = yearToInp.value;
  state.yearFrom = parseInt(yearFromInp.value);
  state.yearTo = parseInt(yearToInp.value);
}

// ───────────────── Form ─────────────────
function wireForm() {
  formEl.addEventListener('submit', (e) => { e.preventDefault(); runDeepDive(); });
  clearEl.addEventListener('click', () => {
    inputEl.value = '';
    delete inputEl.dataset.tagId;
    state.query = null;
    state.headlines = [];
    state.cotags.clear();
    summaryEl.hidden = true;
    bodyEl.hidden = true;
    promptEl.hidden = false;
    state.cancelToken++;
    history.replaceState(null, '', location.pathname);
  });
}

function wireFilter() {
  filterEl.addEventListener('input', () => renderHeadlines());
}
function wireExport() {
  exportEl.addEventListener('click', () => exportCsv());
}

// ───────────────── Run ─────────────────
async function runDeepDive() {
  // Determine the query.
  if (state.mode === 'tags') {
    const tagId = inputEl.dataset.tagId;
    if (!tagId) {
      // Accept a typed label that matches a catalog name exactly.
      await loadCatalogIfNeeded();
      const match = state.tagCatalog.find(t =>
        t.name.toLowerCase() === inputEl.value.trim().toLowerCase() ||
        t.id.toLowerCase() === inputEl.value.trim().toLowerCase()
      );
      if (!match) { flashError('Pick a tag from the suggestions.'); return; }
      inputEl.dataset.tagId = match.id;
      inputEl.value = match.name;
    }
    state.query = { kind: 'tag', id: inputEl.dataset.tagId, label: inputEl.value.trim() };
  } else {
    const term = inputEl.value.trim();
    if (!term) { flashError('Type a word.'); return; }
    state.query = { kind: 'word', term, label: term };
  }

  // Reset state for a new run.
  state.cancelToken++;
  const myToken = state.cancelToken;
  state.headlines = [];
  state.cotags.clear();
  state.words.clear();
  state.peakMonth = null;
  state.peakExpanded = false;
  promptEl.hidden = true;
  summaryEl.hidden = false;
  bodyEl.hidden = false;
  headlinesEl.innerHTML = '';
  cotagsEl.innerHTML = '';
  wordsEl.innerHTML = '';
  dispatchesEl.hidden = true;
  dispatchFirstEl.innerHTML = '';
  dispatchLatestEl.innerHTML = '';
  heatmapEl.innerHTML = '';
  peakDrill.hidden = true;
  peakBtn.setAttribute('aria-expanded', 'false');
  peakBtn.classList.remove('open');
  listCountEl.textContent = '';

  // Update URL for deep-linking.
  const p = new URLSearchParams();
  if (state.query.kind === 'tag') p.set('tag', state.query.id);
  else p.set('q', state.query.term);
  p.set('from', state.yearFrom);
  p.set('to', state.yearTo);
  history.replaceState(null, '', `?${p.toString()}`);

  // ─── Instant summary ───
  await renderInstantSummary();
  if (myToken !== state.cancelToken) return;

  // ─── Progressive stream ───
  await streamHeadlines(myToken);
}

function flashError(msg) {
  progressEl.textContent = msg;
  progressEl.style.color = 'var(--news-red)';
  setTimeout(() => { progressEl.style.color = ''; progressEl.textContent = ''; }, 2200);
}

// ───────────────── Instant summary (no shard I/O) ─────────────────
async function renderInstantSummary() {
  const { kind, id, term, label } = state.query;
  const [idx, sections] = await Promise.all([
    kind === 'tag' ? loadTagIndex('monthly') : loadIndex('monthly'),
    loadSections(),
  ]);
  const buckets = idx.buckets;
  const table = kind === 'tag' ? idx.tags : idx.terms;
  const key = kind === 'tag' ? id : normaliseWord(term);
  const counts = table[key] || new Array(buckets.length).fill(0);

  // Clip to year range.
  const keep = [], months = [], vals = [];
  for (let i = 0; i < buckets.length; i++) {
    const y = parseInt(buckets[i].slice(0, 4));
    if (y >= state.yearFrom && y <= state.yearTo) {
      keep.push(i);
      months.push(buckets[i]);
      vals.push(counts[i]);
    }
  }

  const total = vals.reduce((a, b) => a + b, 0);
  let peakIdx = 0;
  for (let i = 1; i < vals.length; i++) if (vals[i] > vals[peakIdx]) peakIdx = i;
  let firstIdx = vals.findIndex(v => v > 0);
  let lastIdx = vals.length - 1;
  while (lastIdx >= 0 && vals[lastIdx] === 0) lastIdx--;

  headlineEl.textContent = `${label} in Guardian headlines`;
  subEl.textContent = `${state.yearFrom}–${state.yearTo} · ${kind === 'tag' ? 'tag' : 'headline word'}`;

  // The monthly term-index only knows single words, so a phrase like
  // "noel clarke" or any term outside the top 5,000 isn't there. In
  // those cases the instant summary would read all zeros. Show a
  // "counting…" state instead and let the shard stream fill it in
  // authoritatively via updateSummaryFromHeadlines().
  const indexHasIt = kind === 'tag' || Boolean(table[key]);
  if (indexHasIt) {
    statTotal.textContent = total.toLocaleString('en-GB');
    statPeak.textContent = peakIdx >= 0 && vals[peakIdx] > 0 ? formatMonth(months[peakIdx]) : '—';
    statFirst.textContent = firstIdx >= 0 ? formatMonth(months[firstIdx]) : '—';
    statLast.textContent = lastIdx >= 0 && vals[lastIdx] > 0 ? formatMonth(months[lastIdx]) : '—';
    drawSparkline(sparkEl, vals, peakIdx);
  } else {
    statTotal.textContent = 'counting…';
    statPeak.textContent = '…';
    statFirst.textContent = '…';
    statLast.textContent = '…';
    drawSparkline(sparkEl, new Array(months.length).fill(0), -1);
  }

  renderSectionMix(sections, months);
  // Stash the month grid for recomputeFromHeadlines below.
  state._summaryMonths = months;
}

// Recompute the summary strip straight from the matched headlines
// we've loaded from shards. This supersedes the instant index-driven
// sketch once we have real data, and is the only way phrases / rare
// terms ever get authoritative stats.
function updateSummaryFromHeadlines() {
  const months = state._summaryMonths;
  if (!months || !months.length) return;
  const idx = new Map(months.map((m, i) => [m, i]));
  const vals = new Array(months.length).fill(0);

  let firstDate = null;
  let lastDate = null;

  for (const h of state.headlines) {
    const d = (h.d || '').slice(0, 7); // YYYY-MM
    const i = idx.get(d);
    if (i != null) vals[i]++;
    const full = (h.d || '').slice(0, 10); // YYYY-MM-DD
    if (full) {
      if (!firstDate || full < firstDate) firstDate = full;
      if (!lastDate || full > lastDate) lastDate = full;
    }
  }

  const total = state.headlines.length;
  let peakIdx = 0;
  for (let i = 1; i < vals.length; i++) if (vals[i] > vals[peakIdx]) peakIdx = i;

  statTotal.textContent = total.toLocaleString('en-GB');
  statPeak.textContent = vals[peakIdx] > 0 ? formatMonth(months[peakIdx]) : '—';
  statFirst.textContent = firstDate ? formatFullDate(firstDate) : '—';
  statLast.textContent = lastDate ? formatFullDate(lastDate) : '—';
  drawSparkline(sparkEl, vals, peakIdx);

  // Remember the peak so the stat's click handler knows what to
  // filter when expanded. Only enable the button if we have data.
  state.peakMonth = vals[peakIdx] > 0 ? months[peakIdx] : null;
  peakBtn.disabled = !state.peakMonth;
  // If the drill is already open, keep it in sync with the new peak.
  if (state.peakExpanded && state.peakMonth) renderPeakDrill();
}

function renderSectionMix(sections, months) {
  // Sum per-section counts across the chosen year range, using the
  // existing sections.json totals — not yet filtered to the topic.
  // Once shards start landing we recompute this for just the matched
  // articles (a more accurate picture). See streamHeadlines.
  const idx = new Map(sections.months.map((m, i) => [m, i]));
  const totals = {};
  for (const m of months) {
    const i = idx.get(m);
    if (i == null) continue;
    for (const [id, arr] of Object.entries(sections.sections)) {
      totals[id] = (totals[id] || 0) + (arr[i] || 0);
    }
  }
  drawSectionBreakdown(totals);
}

function drawSectionBreakdown(totals) {
  const rows = Object.entries(totals)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const max = rows[0]?.[1] || 1;
  const grand = rows.reduce((a, [, n]) => a + n, 0);
  sectionsEl.innerHTML = rows.map(([id, n]) => {
    const pct = grand > 0 ? (n / grand) * 100 : 0;
    const fill = (n / max) * 100;
    return `<div class="breakdown-row">
      <div class="name">${escapeHtml(sectionLabel(id))}</div>
      <div class="bar-track"><div class="bar-fill" style="background:${sectionColor(id)};width:${fill.toFixed(1)}%"></div></div>
      <div class="num">${pct.toFixed(1)}% <span class="count">· ${n.toLocaleString('en-GB')}</span></div>
    </div>`;
  }).join('') || `<p class="dd-empty">No section data in this range.</p>`;
}

// ───────────────── Word frequency ─────────────────
function renderWords() {
  const total = state.headlines.length || 1;
  const top = [...state.words.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  wordsEl.innerHTML = top.map(([word, n]) => {
    const pct = (n / total) * 100;
    return `<li>
      <span class="rising-label">${escapeHtml(word)}</span>
      <span class="rising-jump">${pct.toFixed(0)}%</span>
    </li>`;
  }).join('') || '<li class="rising-loading">(need more headlines)</li>';
}

// ───────────────── First / latest dispatch cards ─────────────────
function renderDispatches() {
  if (!state.headlines.length) return;
  // state.headlines is kept sorted newest-first in processShard.
  const latest = state.headlines[0];
  const first = state.headlines[state.headlines.length - 1];
  dispatchFirstEl.innerHTML = dispatchCard(first);
  dispatchLatestEl.innerHTML = dispatchCard(latest);
  dispatchesEl.hidden = false;
}
function dispatchCard(h) {
  if (!h) return '';
  const url = h.u ? `https://www.theguardian.com/${h.u}` : null;
  const date = formatFullDate((h.d || '').slice(0, 10));
  const section = sectionLabel(h.s || '');
  const term = state.query.kind === 'word' ? state.query.term : null;
  const title = highlightHeadline(h.t || '(untitled)', term);
  return `<p class="hl-meta">${escapeHtml(section)} · ${date}</p>
    ${url
      ? `<a class="dd-dispatch-title" href="${escapeAttr(url)}" target="_blank" rel="noopener">${title}</a>`
      : `<span class="dd-dispatch-title">${title}</span>`}`;
}

// ───────────────── Weekly heatmap ─────────────────
function renderHeatmap() {
  // Group matched headlines by ISO week key. Year by year.
  const counts = new Map(); // "YYYY-WW" → count
  for (const h of state.headlines) {
    const key = isoWeekKey((h.d || '').slice(0, 10));
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  // Find the max to drive colour intensity.
  let peak = 0;
  for (const v of counts.values()) if (v > peak) peak = v;
  if (peak === 0) { heatmapEl.innerHTML = ''; return; }

  const years = [];
  for (let y = state.yearFrom; y <= state.yearTo; y++) years.push(y);

  heatmapEl.innerHTML = years.map(y => {
    const cells = [];
    for (let w = 1; w <= 53; w++) {
      const key = `${y}-${String(w).padStart(2, '0')}`;
      const c = counts.get(key) || 0;
      const intensity = c === 0 ? 0 : (0.15 + 0.85 * (c / peak));
      const label = c === 0
        ? `Week ${w} ${y} · 0 articles`
        : `Week ${w} ${y} · ${c} article${c === 1 ? '' : 's'}`;
      cells.push(`<span class="dd-hc" style="--dd-i:${intensity.toFixed(2)}" title="${label}"></span>`);
    }
    return `<div class="dd-hm-row">
      <span class="dd-hm-year">${y}</span>
      <div class="dd-hm-cells">${cells.join('')}</div>
    </div>`;
  }).join('');
}

// ISO week key (Thursday determines ISO year). Matches the format the
// rest of the site uses ("YYYY-W##"). Returns null for empty inputs.
function isoWeekKey(iso) {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-${String(weekNum).padStart(2, '0')}`;
}

// ───────────────── Peak month drilldown ─────────────────
peakBtn.addEventListener('click', () => {
  if (!state.peakMonth) return;
  state.peakExpanded = !state.peakExpanded;
  peakBtn.setAttribute('aria-expanded', String(state.peakExpanded));
  peakBtn.classList.toggle('open', state.peakExpanded);
  if (state.peakExpanded) renderPeakDrill();
  peakDrill.hidden = !state.peakExpanded;
});

function renderPeakDrill() {
  if (!state.peakMonth) return;
  const monthHeadlines = state.headlines
    .filter(h => (h.d || '').slice(0, 7) === state.peakMonth)
    .sort((a, b) => (b.d || '').localeCompare(a.d || ''));
  peakLabel.textContent = `Headlines from ${formatMonth(state.peakMonth)} · ${monthHeadlines.length.toLocaleString('en-GB')} total`;
  const term = state.query.kind === 'word' ? state.query.term : null;
  const top = monthHeadlines.slice(0, 12);
  peakList.innerHTML = top.map(h => {
    const url = h.u ? `https://www.theguardian.com/${h.u}` : null;
    const date = formatFullDate((h.d || '').slice(0, 10));
    const section = sectionLabel(h.s || '');
    const title = highlightHeadline(h.t || '(untitled)', term);
    return `<li>
      <p class="hl-meta">${escapeHtml(section)} · ${date}</p>
      ${url
        ? `<a class="dd-peak-title" href="${escapeAttr(url)}" target="_blank" rel="noopener">${title}</a>`
        : `<span class="dd-peak-title">${title}</span>`}
    </li>`;
  }).join('');
  if (monthHeadlines.length > top.length) {
    peakList.innerHTML += `<li class="dd-peak-more">${(monthHeadlines.length - top.length).toLocaleString('en-GB')} more in the full list below.</li>`;
  }
}

// Lightweight tokeniser for the word-frequency block. Handles
// possessives ("America's" → "america"), diacritics ("Orbán" →
// "orban"), and strips numbers-only tokens.
function tokenise(text) {
  const normalised = (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2019']s\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ');
  const out = [];
  for (const w of normalised.split(' ')) {
    if (w.length < 3) continue;
    if (/^\d+$/.test(w)) continue;
    out.push(w);
  }
  return out;
}

// ───────────────── Headline stream ─────────────────
async function streamHeadlines(myToken) {
  const months = monthsInRange(state.yearFrom, state.yearTo);
  const matcher = state.query.kind === 'word'
    ? makeWordMatcher(state.query.term)
    : null;
  const tagId = state.query.kind === 'tag' ? state.query.id : null;

  // Newest-first so the most recent headlines show up first.
  months.reverse();
  const CONCURRENCY = 4;
  let loaded = 0;
  let perSectionActual = {};

  // Helper to process one shard's matching headlines.
  const processShard = async (month) => {
    if (myToken !== state.cancelToken) return;
    try {
      const shard = await loadShard(month);
      if (myToken !== state.cancelToken) return;
      const queryWord = state.query.kind === 'word' ? state.query.term.toLowerCase() : null;
      for (const h of shard.headlines) {
        const hit = tagId
          ? (h.g || []).includes(tagId)
          : matcher(h.t || '');
        if (!hit) continue;
        state.headlines.push(h);
        perSectionActual[h.s] = (perSectionActual[h.s] || 0) + 1;
        if (h.g) for (const g of h.g) {
          if (g === tagId) continue;
          if (!isUsefulTag(g)) continue;
          state.cotags.set(g, (state.cotags.get(g) || 0) + 1);
        }
        // Per-headline unique words — using a Set so a single headline
        // containing "clarke" twice doesn't double-count.
        const seen = new Set();
        for (const w of tokenise(h.t || '')) {
          if (STOPWORDS.has(w)) continue;
          if (queryWord && w === queryWord) continue;
          if (seen.has(w)) continue;
          seen.add(w);
          state.words.set(w, (state.words.get(w) || 0) + 1);
        }
      }
    } catch (_) { /* missing shards in gap months — silently skip */ }
    loaded++;
    progressEl.textContent = `Loaded ${loaded} / ${months.length} months · ${state.headlines.length.toLocaleString('en-GB')} headlines so far`;
    // Sort newest-first as we go — shards arrive out of order with concurrency.
    state.headlines.sort((a, b) => (b.d || '').localeCompare(a.d || ''));
    renderHeadlines();
    renderCotags();
    // Recompute actual section mix from matched articles rather than
    // whole-month totals once we have enough data.
    if (state.headlines.length > 20) drawSectionBreakdown(perSectionActual);
    // Always recompute summary stats + sparkline from matched headlines
    // so phrases / out-of-index terms get authoritative numbers rather
    // than the zero-filled sketch.
    updateSummaryFromHeadlines();
    renderWords();
    renderHeatmap();
    renderDispatches();
  };

  // Simple worker pool.
  const queue = [...months];
  const workers = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push((async () => {
      while (queue.length && myToken === state.cancelToken) {
        const m = queue.shift();
        await processShard(m);
      }
    })());
  }
  await Promise.all(workers);
  if (myToken !== state.cancelToken) return;

  progressEl.textContent = `Loaded ${loaded} months · ${state.headlines.length.toLocaleString('en-GB')} headlines total`;
  // Final actual-section-mix swap.
  drawSectionBreakdown(perSectionActual);
}

// ───────────────── Render: headlines + cotags ─────────────────
function renderHeadlines() {
  const filter = filterEl.value.trim().toLowerCase();
  const filtered = filter
    ? state.headlines.filter(h => (h.t || '').toLowerCase().includes(filter))
    : state.headlines;

  listCountEl.textContent = `· ${filtered.length.toLocaleString('en-GB')}${filter ? ' matching' : ''}`;

  // Simple cap on rendered rows for performance — 500 visible is plenty
  // for a scan; the full set is available via CSV.
  const MAX_RENDER = 500;
  const slice = filtered.slice(0, MAX_RENDER);
  const overflow = filtered.length - slice.length;

  const term = state.query.kind === 'word' ? state.query.term : null;
  headlinesEl.innerHTML = slice.map(h => {
    const url = h.u ? `https://www.theguardian.com/${h.u}` : null;
    const date = formatDate(h.d);
    const section = sectionLabel(h.s);
    const title = highlightHeadline(h.t || '(untitled)', term);
    return `<article class="dd-h">
      <p class="hl-meta">${escapeHtml(section)} · ${date}</p>
      ${url
        ? `<a class="dd-h-title" href="${escapeAttr(url)}" target="_blank" rel="noopener">${title}</a>`
        : `<span class="dd-h-title">${title}</span>`}
    </article>`;
  }).join('');
  if (overflow > 0) {
    headlinesEl.innerHTML += `<p class="dd-overflow">Showing the first ${MAX_RENDER.toLocaleString('en-GB')} · ${overflow.toLocaleString('en-GB')} more available via export.</p>`;
  }
}

function renderCotags() {
  const top = [...state.cotags.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const totalMatched = state.headlines.length || 1;
  const catalogIndex = new Map((state.tagCatalog || []).map(t => [t.id, t.name]));
  cotagsEl.innerHTML = top.map(([id, n]) => {
    const pct = (n / totalMatched) * 100;
    const name = catalogIndex.get(id) || id.split('/').pop().replace(/-/g, ' ');
    return `<li data-id="${escapeAttr(id)}">
      <span class="rising-label">${escapeHtml(name)}</span>
      <span class="rising-jump">${pct.toFixed(0)}%</span>
    </li>`;
  }).join('');
}

// Click a co-tag row to re-run the dive on that tag.
cotagsEl.addEventListener('click', async (e) => {
  const li = e.target.closest('li[data-id]');
  if (!li) return;
  const id = li.dataset.id;
  setMode('tags');
  await loadCatalogIfNeeded();
  const t = state.tagCatalog.find(x => x.id === id);
  inputEl.value = t?.name || id;
  inputEl.dataset.tagId = id;
  runDeepDive();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ───────────────── CSV export ─────────────────
function exportCsv() {
  if (!state.headlines.length) return;
  const filter = filterEl.value.trim().toLowerCase();
  const rows = filter
    ? state.headlines.filter(h => (h.t || '').toLowerCase().includes(filter))
    : state.headlines;
  const head = ['date', 'section', 'headline', 'tags', 'url'];
  const lines = [head.join(',')];
  for (const h of rows) {
    const url = h.u ? `https://www.theguardian.com/${h.u}` : '';
    const tags = (h.g || []).join('|');
    lines.push([
      csv(h.d || ''),
      csv(sectionLabel(h.s || '')),
      csv(h.t || ''),
      csv(tags),
      csv(url),
    ].join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const slug = (state.query.label || 'deep-dive')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  a.download = `guardian-angles-${slug}-${state.yearFrom}-${state.yearTo}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ───────────────── Sparkline ─────────────────
function drawSparkline(canvas, counts, highlightIdx) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const W = rect.width, H = rect.height;
  if (W === 0 || H === 0) return;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (!counts.length) return;

  const max = Math.max(1, ...counts);
  const pad = 4;
  const yFor = (c) => H - pad - (c / max) * (H - pad * 2);
  const xFor = (i) => (i / Math.max(1, counts.length - 1)) * W;

  // Area fill
  ctx.beginPath();
  for (let i = 0; i < counts.length; i++) {
    const x = xFor(i), y = yFor(counts[i]);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
  ctx.fillStyle = 'rgba(5, 41, 98, 0.12)';
  ctx.fill();
  // Line
  ctx.beginPath();
  for (let i = 0; i < counts.length; i++) {
    const x = xFor(i), y = yFor(counts[i]);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = '#052962';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Highlight peak
  if (highlightIdx >= 0 && counts[highlightIdx] > 0) {
    const hx = xFor(highlightIdx), hy = yFor(counts[highlightIdx]);
    ctx.fillStyle = '#C70000';
    ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fill();
  }
}

// ───────────────── Helpers ─────────────────
function monthsInRange(from, to) {
  const out = [];
  for (let y = from; y <= to; y++) {
    for (let m = 1; m <= 12; m++) {
      out.push(`${y}-${String(m).padStart(2, '0')}`);
    }
  }
  return out;
}
function formatMonth(bucket) {
  const m = bucket.match(/^(\d{4})-(\d{2})$/);
  if (!m) return bucket;
  return new Date(Date.UTC(+m[1], +m[2] - 1, 1))
    .toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}
function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
// Pretty-print an ISO YYYY-MM-DD as "4 May 2021".
function formatFullDate(iso) {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function normaliseWord(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function csv(v) {
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

// Produce HTML for a headline with the search term wrapped in <mark>.
// Matches the Trends headline-list highlight: full-word match for
// single-word terms (plus optional possessive "s"), substring match
// for multi-word phrases. Tag-mode queries get no highlighting — the
// tag id doesn't map cleanly to headline words. Safe against HTML
// injection because we escape around the matches.
function highlightHeadline(text, term) {
  const safe = escapeHtml(text || '');
  if (!term) return safe;
  const needle = term.trim().toLowerCase();
  if (!needle) return safe;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = /\s/.test(needle)
    ? new RegExp(escaped, 'gi')
    : new RegExp(`\\b${escaped}(?:'s)?\\b`, 'gi');
  const src = text || '';
  let out = '', last = 0;
  for (const m of src.matchAll(re)) {
    out += escapeHtml(src.slice(last, m.index));
    out += '<mark>' + escapeHtml(m[0]) + '</mark>';
    last = m.index + m[0].length;
  }
  out += escapeHtml(src.slice(last));
  return out;
}
