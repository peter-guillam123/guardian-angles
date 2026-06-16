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
  evictShard, makeWordMatcher,
} from './data.js';
import { sectionLabel, sectionColor } from './sections.js';
import { isUsefulTone, toneLabel, toneColor, getToneCatalog } from './tones.js';
import { renderCompany, renderCompanyForHeadlines, hideCompany, setCompanyActive } from './company.js';
import { attachShareTools } from './share.js';

// ───────────────── State ─────────────────
const state = {
  mode: 'tags',                    // 'tags' | 'words'
  query: null,                     // { kind, id|term, label }
  yearFrom: 2012,
  yearTo: new Date().getUTCFullYear(),
  headlines: [],                   // accumulated results, newest-first
  cancelToken: 0,                  // increment to cancel in-flight streams
  tagCatalog: null,                // lazy-loaded when tags mode is active
  words: new Map(),                // word → count of *headlines* containing it
  peakMonth: null,                 // YYYY-MM of the current peak
  peakExpanded: false,             // whether the peak drilldown is open
  // Click-driven filter on the sidebar lists + section mix. Works
  // live during streaming — as more headlines arrive they flow into
  // the filtered view automatically.
  structuredFilter: null,          // { kind: 'tag'|'word'|'section', value, label } | null
};

// Render-scheduling counter (used by runDeepDive and scheduleRender).
// Declared up here, before the init IIFE, deliberately — see the comment
// at the Render scheduling section.
let _renderTick = 0;

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
// Scoped to the controls block — the "company it keeps" section has its
// own mode-toggle (ranking mode) that must not drive the page mode.
const modeBtns = document.querySelectorAll('.dd-controls .mode-toggle .mode-btn');
const inputEl = document.getElementById('dd-input');
const labelEl = document.getElementById('dd-label');
const formEl = document.getElementById('dd-form');
const clearEl = document.getElementById('dd-clear');
const yearFromInp = document.getElementById('dd-year-from');
const yearToInp = document.getElementById('dd-year-to');
const yearFromDisp = document.getElementById('dd-year-from-display');
const yearToDisp = document.getElementById('dd-year-to-display');
const rangeFill = document.getElementById('dd-range-fill');
const toneHintEl = document.getElementById('dd-tone-hint');
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
const tonesEl = document.getElementById('dd-tones');
const listCountEl = document.getElementById('dd-list-count');
const filterEl = document.getElementById('dd-filter');
const exportEl = document.getElementById('dd-export');
const progressEl = document.getElementById('dd-progress');
const headlinesEl = document.getElementById('dd-headlines');
const wordsEl = document.getElementById('dd-words');
const statBig = document.getElementById('stat-big');
const dispatchesEl = document.getElementById('dd-dispatches');
const dispatchFirstEl = document.querySelector('#dd-dispatch-first .dd-dispatch-body');
const dispatchPeakEl = document.querySelector('#dd-dispatch-peak .dd-dispatch-body');
const dispatchPeakLabel = document.getElementById('dd-dispatch-peak-label');
const dispatchLatestEl = document.querySelector('#dd-dispatch-latest .dd-dispatch-body');
const peakBtn = document.getElementById('dd-stat-peak-btn');
const peakDrill = document.getElementById('dd-peak-drill');
const peakLabel = document.getElementById('dd-peak-label');
const peakList = document.getElementById('dd-peak-list');
const filterWrapEl = document.getElementById('dd-filter-wrap');
const filterKindEl = document.getElementById('dd-filter-kind');
const filterClearEl = document.getElementById('dd-filter-clear');

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
  // Share tools on the monthly sparkline (single navy series = the topic).
  attachShareTools(document.getElementById('dd-actions'), () => ({
    chartCanvas: sparkEl,
    title: headlineEl.textContent || 'Guardian coverage',
    legendItems: state.query ? [{ color: '#052962', label: state.query.label }] : [],
    url: location.href,
  }));
  // Pull query from URL so the page is deep-linkable.
  const params = new URLSearchParams(location.search);
  const tag = params.get('tag');
  const tone = params.get('tone');
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
  } else if (tone) {
    setMode('tones');
    inputEl.value = toneLabel(tone);
    inputEl.dataset.toneId = tone;
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
  const prevMode = state.mode;
  state.mode = mode;
  modeBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  applyModeUI();
  delete inputEl.dataset.tagId;
  delete inputEl.dataset.toneId;
  inputEl.value = '';
  // Entering tone mode: stash the current year range so we can
  // restore it on exit, then snap to current-year only. Tones match
  // a lot — narrow default keeps the first dive stable. User can
  // drag the slider wider; the restore covers the case where they
  // flip back to Tag/Word and would otherwise be stuck at narrow.
  if (mode === 'tones' && prevMode !== 'tones') {
    state._preToneRange = {
      from: yearFromInp.value,
      to: yearToInp.value,
    };
    const thisYear = new Date().getUTCFullYear();
    yearFromInp.value = String(thisYear);
    yearToInp.value = String(thisYear);
    updateYearDisplay();
  }
  // Leaving tone mode: restore the range we stashed on entry. Any
  // adjustment the user made while in tone mode is intentionally
  // discarded — the slider returns to whatever they had for Tag/Word.
  if (mode !== 'tones' && prevMode === 'tones' && state._preToneRange) {
    yearFromInp.value = state._preToneRange.from;
    yearToInp.value = state._preToneRange.to;
    updateYearDisplay();
    state._preToneRange = null;
  }
}
async function applyModeUI() {
  // Hint sits beside the year range — only relevant in tone mode.
  toneHintEl.hidden = state.mode !== 'tones';
  if (state.mode === 'tags') {
    labelEl.textContent = 'Search a tag';
    inputEl.placeholder = 'e.g. donald trump, climate crisis…';
    await loadCatalogIfNeeded();
    attachSimpleAutocomplete(inputEl, state.tagCatalog);
  } else if (state.mode === 'tones') {
    labelEl.textContent = 'Search a tone';
    inputEl.placeholder = 'e.g. opinion, features, analysis…';
    attachSimpleAutocomplete(inputEl, getToneCatalog(), {
      hideSlug: true, hideCount: true, datasetKey: 'toneId',
    });
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
// Takes an explicit catalog so the same UI drives both tag mode
// (3,000 entries, slug + count visible) and tone mode (~25 entries,
// slug + count hidden via opts).
let _acDropdown = null;
function attachSimpleAutocomplete(inp, catalog, opts = {}) {
  const { hideSlug = false, hideCount = false, datasetKey = 'tagId' } = opts;
  detachAutocomplete(inp);
  const dropdown = document.createElement('ul');
  dropdown.className = 'ac-dropdown';
  dropdown.hidden = true;
  inp.parentElement.style.position = 'relative';
  inp.parentElement.appendChild(dropdown);
  _acDropdown = dropdown;

  const render = () => {
    const q = inp.value.trim().toLowerCase();
    const matches = [];
    // With no query and a small catalog (≤ 30), show all entries — a
    // tone picker is more useful as a full list than an empty one.
    if (!q && catalog.length <= 30) {
      matches.push(...catalog);
    } else if (q) {
      for (const t of catalog) {
        if (t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)) {
          matches.push(t);
          if (matches.length >= 8) break;
        }
      }
    }
    if (!matches.length) { dropdown.hidden = true; return; }
    dropdown.innerHTML = matches.map(t => `
      <li class="ac-item" data-id="${escapeAttr(t.id)}" data-name="${escapeAttr(t.name)}">
        <span class="ac-name">${escapeHtml(t.name)}</span>
        ${hideSlug ? '' : `<span class="ac-slug">${escapeHtml(t.id)}</span>`}
        ${hideCount ? '' : `<span class="ac-count">${(t.n || 0).toLocaleString('en-GB')}</span>`}
      </li>`).join('');
    dropdown.hidden = false;
  };
  const onInput = () => render();
  const onClick = (e) => {
    const li = e.target.closest('.ac-item');
    if (!li) return;
    inp.value = li.dataset.name;
    inp.dataset[datasetKey] = li.dataset.id;
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
  // Dual-thumb sliders let the user drag one thumb past the other,
  // producing a crossed (from > to) state. Always recompute via
  // updateYearDisplay — it's the single source of truth that swaps
  // and writes state. The previous version did its own swap then
  // called updateYearDisplay, which re-read raw inputs and un-swapped
  // — leaving state.yearFrom > state.yearTo. monthsInRange(2026,
  // 2024) returns empty, so the shard stream never runs and the
  // dive sits at "counting…" forever.
  const onInput = () => updateYearDisplay();
  yearFromInp.addEventListener('input', onInput);
  yearToInp.addEventListener('input', onInput);
}
function updateYearDisplay() {
  const min = parseInt(yearFromInp.min), max = parseInt(yearFromInp.max);
  const span = Math.max(1, max - min);
  let from = parseInt(yearFromInp.value);
  let to = parseInt(yearToInp.value);
  if (from > to) [from, to] = [to, from];
  const fromPct = ((from - min) / span) * 100;
  const toPct = ((to - min) / span) * 100;
  rangeFill.style.left = fromPct + '%';
  rangeFill.style.right = (100 - toPct) + '%';
  yearFromDisp.textContent = from;
  yearToDisp.textContent = to;
  state.yearFrom = from;
  state.yearTo = to;
}

// ───────────────── Form ─────────────────
function wireForm() {
  formEl.addEventListener('submit', (e) => { e.preventDefault(); runDeepDive(); });
  clearEl.addEventListener('click', () => {
    inputEl.value = '';
    delete inputEl.dataset.tagId;
    state.query = null;
    state.headlines = [];
    hideCompany();
    summaryEl.hidden = true;
    bodyEl.hidden = true;
    promptEl.hidden = false;
    state.cancelToken++;
    history.replaceState(null, '', location.pathname);
  });
}

function wireFilter() {
  filterEl.addEventListener('input', () => {
    // Typing replaces any structured (click-populated) filter — we're
    // now in free-text mode. Drop the kind badge and reset state, but
    // DON'T call setStructuredFilter(null) because that would wipe the
    // input contents the user is typing.
    if (state.structuredFilter) {
      state.structuredFilter = null;
      filterKindEl.hidden = true;
      filterWrapEl.classList.remove('has-filter');
      // Refresh the dependent blocks now the filter's gone.
      renderWords();
      setCompanyActive(null);
      if (state._perSectionActual) drawSectionBreakdown(state._perSectionActual);
    }
    // Show / hide the × button based on whether the field has content.
    filterClearEl.hidden = !filterEl.value;
    renderHeadlines();
  });
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
  } else if (state.mode === 'tones') {
    let toneId = inputEl.dataset.toneId;
    if (!toneId) {
      // Accept a typed label that matches a tone exactly.
      const typed = inputEl.value.trim().toLowerCase();
      const match = getToneCatalog().find(t =>
        t.name.toLowerCase() === typed || t.id.toLowerCase() === typed
      );
      if (!match) { flashError('Pick a tone from the suggestions.'); return; }
      inputEl.dataset.toneId = match.id;
      inputEl.value = match.name;
      toneId = match.id;
    }
    state.query = { kind: 'tone', id: toneId, label: inputEl.value.trim() };
  } else {
    const term = inputEl.value.trim();
    if (!term) { flashError('Type a word.'); return; }
    state.query = { kind: 'word', term, label: term };
  }

  // Reset state for a new run.
  state.cancelToken++;
  const myToken = state.cancelToken;
  state.headlines = [];
  state.words.clear();
  state.peakMonth = null;
  state.peakExpanded = false;
  state._streamDone = false;
  state._perSectionActual = null;
  state._perToneActual = null;
  state.structuredFilter = null;
  _renderTick = 0;
  promptEl.hidden = true;
  summaryEl.hidden = false;
  bodyEl.hidden = false;
  headlinesEl.innerHTML = '';
  wordsEl.innerHTML = '';
  dispatchesEl.hidden = true;
  dispatchFirstEl.innerHTML = '';
  dispatchPeakEl.innerHTML = '';
  dispatchLatestEl.innerHTML = '';
  peakDrill.hidden = true;
  peakBtn.setAttribute('aria-expanded', 'false');
  peakBtn.classList.remove('open');
  listCountEl.textContent = '';
  filterEl.value = '';
  filterKindEl.hidden = true;
  filterClearEl.hidden = true;
  filterWrapEl.classList.remove('has-filter');

  // Update URL for deep-linking.
  const p = new URLSearchParams();
  if (state.query.kind === 'tag') p.set('tag', state.query.id);
  else if (state.query.kind === 'tone') p.set('tone', state.query.id);
  else p.set('q', state.query.term);
  p.set('from', state.yearFrom);
  p.set('to', state.yearTo);
  history.replaceState(null, '', `?${p.toString()}`);

  // ─── The company it keeps ───
  // Tags render instantly from the precomputed index. Words and tones
  // have no index entry, so their companion tags are tallied from the
  // matched headlines once the stream completes (see streamHeadlines).
  // Hide it for now; it (re)appears below.
  if (state.query.kind === 'tag') {
    renderCompany({
      tagId: state.query.id,
      label: state.query.label,
      yearFrom: state.yearFrom,
      yearTo: state.yearTo,
    });
  } else {
    hideCompany();
  }

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
  // Tones aren't in either the term or the tag index (excluded by
  // SKIP_PREFIXES at build time), so a tone dive has no quick
  // sketch — load the sections artifact only and let the shard
  // stream fill in the numbers authoritatively below.
  const [idx, sections] = await Promise.all([
    kind === 'tag' ? loadTagIndex('monthly')
      : kind === 'tone' ? null
      : loadIndex('monthly'),
    loadSections(),
  ]);
  const buckets = idx ? idx.buckets : sections.months;
  const table = kind === 'tag' ? idx.tags
              : kind === 'word' ? idx.terms
              : {};  // tone: empty — every key misses, falls to "counting…"
  const key = kind === 'tag' ? id
            : kind === 'word' ? normaliseWord(term)
            : id;
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
  const kindLabel = kind === 'tag' ? 'tag'
                  : kind === 'tone' ? 'tone'
                  : 'headline word';
  subEl.textContent = `${state.yearFrom}–${state.yearTo} · ${kindLabel}`;

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
  const active = state.structuredFilter?.kind === 'section' ? state.structuredFilter.value : null;
  sectionsEl.innerHTML = rows.map(([id, n]) => {
    const pct = grand > 0 ? (n / grand) * 100 : 0;
    const fill = (n / max) * 100;
    const cls = id === active ? ' dd-fc-active' : '';
    return `<div class="breakdown-row${cls}" data-section="${escapeAttr(id)}" role="button" tabindex="0" aria-label="Filter to ${escapeAttr(sectionLabel(id))} section">
      <div class="name">${escapeHtml(sectionLabel(id))}</div>
      <div class="bar-track"><div class="bar-fill" style="background:${sectionColor(id)};width:${fill.toFixed(1)}%"></div></div>
      <div class="num">${pct.toFixed(1)}% <span class="count">· ${n.toLocaleString('en-GB')}</span></div>
    </div>`;
  }).join('') || `<p class="dd-empty">No section data in this range.</p>`;
}

// Tone breakdown — same shape as the section bars but keyed off the
// per-tone counts we collect in processShard. Note an article can
// carry multiple tones (e.g. tone/analysis + tone/comment), so the
// percentages here are "of articles with at least one tone tagged
// as X" rather than mutually-exclusive shares — and the row total
// may exceed 100% across all tones for that reason.
function drawToneBreakdown(perTone) {
  // On a tone dive the panel would either be 100% the chosen tone
  // (boring) or 100% minus a sliver of multi-tone articles (still
  // not editorially interesting). Hide it.
  if (state.query?.kind === 'tone') {
    tonesEl.innerHTML = '';
    tonesEl.parentElement.hidden = true;
    return;
  }
  tonesEl.parentElement.hidden = false;

  const rows = Object.entries(perTone || {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  if (!rows.length) {
    tonesEl.innerHTML = `<p class="dd-empty">No tone data yet.</p>`;
    return;
  }
  const max = rows[0][1];
  const totalMatched = state.headlines.length || 1;
  const active = state.structuredFilter?.kind === 'tone' ? state.structuredFilter.value : null;
  tonesEl.innerHTML = rows.map(([id, n]) => {
    const pct = (n / totalMatched) * 100;
    const fill = (n / max) * 100;
    const cls = id === active ? ' dd-fc-active' : '';
    return `<div class="breakdown-row${cls}" data-tone="${escapeAttr(id)}" role="button" tabindex="0" aria-label="Filter to ${escapeAttr(toneLabel(id))} tone">
      <div class="name">${escapeHtml(toneLabel(id))}</div>
      <div class="bar-track"><div class="bar-fill" style="background:${toneColor(id)};width:${fill.toFixed(1)}%"></div></div>
      <div class="num">${pct.toFixed(1)}% <span class="count">· ${n.toLocaleString('en-GB')}</span></div>
    </div>`;
  }).join('');
}

// ───────────────── Render scheduling ─────────────────
// One animation-frame-coalesced render pass is WAY cheaper than
// re-rendering every single block on every single shard completion.
// Especially the heatmap (795 cells) and the headline list (up to
// 500 DOM nodes) — rebuilding both dozens of times per second was
// the thing bringing iOS Chrome down.
//
// (_renderTick is declared near the state object
// at the top of the module, not here — the init IIFE can call
// runDeepDive synchronously for ?q=/?tone= URLs, which is before this
// point of the module has been evaluated. let-declarations this far
// down put those URL paths in the temporal dead zone and killed them
// with a ReferenceError.)
let _pendingRender = false;

function scheduleRender() {
  if (_pendingRender) return;
  _pendingRender = true;
  requestAnimationFrame(() => {
    _pendingRender = false;
    _renderTick++;

    // Sort once per render pass, not once per shard. Shards arrive
    // out of order because we load four in parallel; the sort was
    // previously O(n log n) per shard, O(n² log n) overall.
    state.headlines.sort((a, b) => (b.d || '').localeCompare(a.d || ''));

    renderHeadlines();
    renderWords();
    renderDispatches();
    updateSummaryFromHeadlines();
    if (state._perSectionActual && state.headlines.length > 20) {
      drawSectionBreakdown(state._perSectionActual);
    }
    if (state._perToneActual) {
      drawToneBreakdown(state._perToneActual);
    }
  });
}

// ───────────────── Word frequency ─────────────────
function renderWords() {
  // When a filter is active, recompute from the filtered subset so
  // the common-words block reflects the narrowed view — e.g. "in
  // the Opinion-tone climate articles, what words keep appearing".
  // Without a filter we use the cumulative state.words map that the
  // stream is building, which is cheaper and continuously updating.
  const sf = state.structuredFilter;
  const filtered = sf ? applyActiveFilter(state.headlines) : null;
  const total = (filtered || state.headlines).length || 1;
  let entries;
  if (filtered) {
    const queryTokens = state.query?.kind === 'word'
      ? new Set(tokenise(state.query.term))
      : new Set(tokenise(state.query?.label || ''));
    const counts = new Map();
    for (const h of filtered) {
      const seen = new Set();
      for (const w of tokenise(h.t || '')) {
        if (STOPWORDS.has(w) || queryTokens.has(w) || seen.has(w)) continue;
        seen.add(w);
        counts.set(w, (counts.get(w) || 0) + 1);
      }
    }
    entries = [...counts.entries()];
  } else {
    entries = [...state.words.entries()];
  }
  const top = entries
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    // 20 now the companion sidebar's gone and this block owns the column;
    // the mobile breakpoint hides past 10 (see styles.css).
    .slice(0, 20);
  // Highlighting the word matching an active 'word' structured filter
  // is no longer possible from this list (typing wipes the filter),
  // but kept for completeness in case it ever returns.
  wordsEl.innerHTML = top.map(([word, n]) => {
    const pct = (n / total) * 100;
    return `<li data-word="${escapeAttr(word)}">
      <span class="rising-label">${escapeHtml(word)}</span>
      <span class="rising-jump">${pct.toFixed(0)}%</span>
    </li>`;
  }).join('') || '<li class="rising-loading">(need more headlines)</li>';
}

// ───────────────── First / peak / latest dispatch cards ─────────────────
function renderDispatches() {
  // Tone dives don't have an editorial "first / peak / latest" in
  // the same sense — the first ever Opinion piece in our data isn't
  // really the start of a story. Hide the row entirely.
  if (state.query?.kind === 'tone') { dispatchesEl.hidden = true; return; }
  if (!state.headlines.length) return;
  // state.headlines is sorted newest-first in scheduleRender.
  const latest = state.headlines[0];
  const first = state.headlines[state.headlines.length - 1];
  dispatchFirstEl.innerHTML = dispatchCard(first);
  dispatchLatestEl.innerHTML = dispatchCard(latest);

  // Peak card: pick the headline from the peak month. Prefer the
  // middle article chronologically within that month — it tends to
  // be the representative piece rather than a news-lead or a
  // follow-up. Falls back to whatever we have if only one match sits
  // in the peak month.
  if (state.peakMonth) {
    const peakHeadlines = state.headlines.filter(
      h => (h.d || '').slice(0, 7) === state.peakMonth
    );
    if (peakHeadlines.length) {
      const pick = peakHeadlines[Math.floor(peakHeadlines.length / 2)];
      dispatchPeakEl.innerHTML = dispatchCard(pick);
      dispatchPeakLabel.textContent =
        `From the peak · ${formatMonth(state.peakMonth)}`;
    } else {
      dispatchPeakEl.innerHTML = '';
    }
  } else {
    dispatchPeakEl.innerHTML = '';
  }
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
  // Tag mode and tone mode both filter the shard by checking whether
  // h.g includes the chosen id. The matching logic is identical;
  // we just reuse the tagId variable for both for convenience.
  const tagId = (state.query.kind === 'tag' || state.query.kind === 'tone')
    ? state.query.id
    : null;

  // Newest-first so the most recent headlines show up first.
  months.reverse();
  const CONCURRENCY = 4;
  let loaded = 0;
  let perSectionActual = {};
  let perToneActual = {};

  // Helper to process one shard's matching headlines.
  const processShard = async (month) => {
    if (myToken !== state.cancelToken) return;
    try {
      const shard = await loadShard(month);
      if (myToken !== state.cancelToken) return;
      // Tokens to strip from the word-frequency list — the query
       // itself is noise. For a "peter mandelson" word search the
       // raw term is the whole phrase, so we tokenise it to get
       // ["peter", "mandelson"] and exclude both. For tag mode we
       // use the tag's display name ("Climate crisis" → ["climate",
       // "crisis"]) — that's typically what the headline copy will
       // echo, so the frequency list is more editorially useful
       // without it.
      const queryTokens = state.query.kind === 'word'
        ? new Set(tokenise(state.query.term))
        : new Set(tokenise(state.query.label || ''));
      for (const h of shard.headlines) {
        const hit = tagId
          ? (h.g || []).includes(tagId)
          : matcher(h.t || '');
        if (!hit) continue;
        // Flat-copy the fields we need rather than keeping a reference
        // to the shard's object. Without this the shard's whole
        // headlines[] array stays reachable via our matches, and the
        // parsed shard can't be garbage-collected even after we evict
        // it from the cache.
        state.headlines.push({
          t: h.t, d: h.d, s: h.s, u: h.u,
          g: h.g ? h.g.slice() : undefined,
        });
        perSectionActual[h.s] = (perSectionActual[h.s] || 0) + 1;
        if (h.g) for (const g of h.g) {
          if (g === tagId) continue;
          // Tones feed their own per-tone counter (the "tone mix" panel
          // below the section mix). Companion tags used to be tallied
          // here too, for a "Travels with" sidebar — that's now the job
          // of the "company it keeps" chart, which reads the headlines
          // directly.
          if (isUsefulTone(g)) {
            perToneActual[g] = (perToneActual[g] || 0) + 1;
          }
        }
        const seen = new Set();
        for (const w of tokenise(h.t || '')) {
          if (STOPWORDS.has(w)) continue;
          if (queryTokens.has(w)) continue;
          if (seen.has(w)) continue;
          seen.add(w);
          state.words.set(w, (state.words.get(w) || 0) + 1);
        }
      }
      // Drop the shard from data.js's cache now that we've harvested
      // what we need. On a high-volume dive (Taylor Swift, Peter
      // Mandelson) this keeps heap use flat rather than growing with
      // each month loaded. The GC reclaims ~1-5MB per shard evicted.
      evictShard(month);
    } catch (_) { /* missing shards in gap months — silently skip */ }
    loaded++;
    progressEl.textContent = `Loaded ${loaded} / ${months.length} months · ${state.headlines.length.toLocaleString('en-GB')} headlines so far`;
    // Don't render directly — coalesce into a single animation frame so
    // multiple shards landing in the same frame produce one paint rather
    // than a dozen. Crucial for memory pressure on mobile: a 14-year
    // Cummings dive is ~150 shards × 5 renders each without this, which
    // thrashes iOS WKWebView into an OOM kill.
    state._perSectionActual = perSectionActual;
    state._perToneActual = perToneActual;
    scheduleRender();
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
  // Final actual-section-mix swap + one guaranteed full render so the
  // heatmap is current even if the throttle skipped the last tick.
  drawSectionBreakdown(perSectionActual);
  state._streamDone = true;
  scheduleRender();

  // Word and tone dives now have every matching headline in memory —
  // tally their companion tags into the same "company it keeps" chart.
  // (Tags drew it instantly from the index up top.) A tone dive excludes
  // its own tag, which every matched headline carries.
  if (state.query && (state.query.kind === 'word' || state.query.kind === 'tone')) {
    renderCompanyForHeadlines({
      headlines: state.headlines,
      label: state.query.label,
      yearFrom: state.yearFrom,
      yearTo: state.yearTo,
      excludeId: state.query.kind === 'tone' ? state.query.id : null,
    });
  }
}

// ───────────────── Render: headlines ─────────────────
// Returns the current matched-headlines set narrowed by the active
// filter (structured OR text — they're mutually exclusive in the UI).
// Used by the headline list AND by Travels-with / common-words so all
// three reflect the same filtered view.
function applyActiveFilter(headlines) {
  const sf = state.structuredFilter;
  const textFilter = sf ? '' : filterEl.value.trim().toLowerCase();
  let filtered = headlines;
  if (sf) {
    if (sf.kind === 'tag' || sf.kind === 'tone') {
      // sf.year (set only by a company-chart cell click) narrows a tag
      // filter to a single year of the overlap.
      filtered = filtered.filter(h => (h.g || []).includes(sf.value)
        && (sf.year == null || (h.d || '').slice(0, 4) === String(sf.year)));
    } else if (sf.kind === 'section') {
      filtered = filtered.filter(h => h.s === sf.value);
    } else if (sf.kind === 'month') {
      filtered = filtered.filter(h => (h.d || '').slice(0, 7) === sf.value);
    } else if (sf.kind === 'word') {
      const esc = sf.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`\\b${esc}(?:'s)?\\b`, 'i');
      filtered = filtered.filter(h => re.test((h.t || '').toLowerCase()));
    }
  } else if (textFilter) {
    filtered = filtered.filter(h => (h.t || '').toLowerCase().includes(textFilter));
  }
  return filtered;
}

function renderHeadlines() {
  const sf = state.structuredFilter;
  const textFilter = sf ? '' : filterEl.value.trim().toLowerCase();
  // Structured filter takes precedence — if one's active, typing into
  // the field has already dropped it (see wireFilter), so we never
  // have both at once.
  let filtered = state.headlines;
  if (sf) {
    if (sf.kind === 'tag') {
      // sf.year (company-chart cell click) narrows to one year.
      filtered = filtered.filter(h => (h.g || []).includes(sf.value)
        && (sf.year == null || (h.d || '').slice(0, 4) === String(sf.year)));
    } else if (sf.kind === 'section') {
      filtered = filtered.filter(h => h.s === sf.value);
    } else if (sf.kind === 'word') {
      const re = new RegExp(`\\b${sf.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:'s)?\\b`, 'i');
      filtered = filtered.filter(h => re.test((h.t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
    } else if (sf.kind === 'tone') {
      filtered = filtered.filter(h => (h.g || []).includes(sf.value));
    } else if (sf.kind === 'month') {
      filtered = filtered.filter(h => (h.d || '').slice(0, 7) === sf.value);
    }
  } else if (textFilter) {
    filtered = filtered.filter(h => (h.t || '').toLowerCase().includes(textFilter));
  }

  const matchingSuffix = (sf || textFilter) ? ' matching' : '';
  listCountEl.textContent = `· ${filtered.length.toLocaleString('en-GB')}${matchingSuffix}`;

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

// ───────────────── Filter: unified field ─────────────────
// Single filter control. Two ways to fill it:
//   1. type into the input      → free-text substring match on headlines
//   2. click a facet in the     → structured match (tag id, section id,
//      sidebar / section mix       or word boundary)
// A kind badge appears inside the field when the filter came from a
// click, so the user can tell the difference between "tag: Labour"
// (which matches articles tagged Labour) and typing "labour" (which
// substring-matches headline text). Typing replaces a structured
// filter — the kind badge disappears and it reverts to free-text.
// A × button at the right clears everything.

function setStructuredFilter(filter) {
  state.structuredFilter = filter;
  if (filter) {
    filterEl.value = filter.label;
    filterKindEl.textContent = filter.kind;
    filterKindEl.hidden = false;
    filterWrapEl.classList.add('has-filter');
    filterClearEl.hidden = false;
  } else {
    filterEl.value = '';
    filterKindEl.hidden = true;
    filterWrapEl.classList.remove('has-filter');
    filterClearEl.hidden = true;
  }
  renderHeadlines();
  // Re-render the faceted blocks so the active row is highlighted.
  renderWords();
  redrawSpark();
  setCompanyActive(state.structuredFilter);
  if (state._perSectionActual) drawSectionBreakdown(state._perSectionActual);
  if (state._perToneActual) drawToneBreakdown(state._perToneActual);
}
function clearStructuredFilter() {
  setStructuredFilter(null);
}
// The × button clears EVERYTHING — structured filter or free text.
filterClearEl.addEventListener('click', () => {
  setStructuredFilter(null);
});

// The "company it keeps" chart is a filter surface: clicking a companion
// (or, on desktop, a single year-cell) filters the whole page to that
// overlap. The chart emits; we own the filter state and tell it back what
// to highlight (see setStructuredFilter → setCompanyActive). Clicking the
// already-active companion/cell toggles the filter off.
document.getElementById('dd-company')?.addEventListener('company:pick', (e) => {
  const { tagId, label, year } = e.detail;
  const cur = state.structuredFilter;
  const sameTag = cur?.kind === 'tag' && cur.value === tagId;
  const sameYear = (cur?.year ?? null) === (year ?? null);
  if (sameTag && sameYear) { clearStructuredFilter(); return; }
  setStructuredFilter({
    kind: 'tag',
    value: tagId,
    year: year ?? undefined,
    label: year ? `${label} · ${year}` : label,
  });
});

wordsEl.addEventListener('click', (e) => {
  const li = e.target.closest('li[data-word]');
  if (!li) return;
  const word = li.dataset.word;
  if (state.structuredFilter?.kind === 'word' && state.structuredFilter.value === word) {
    clearStructuredFilter(); return;
  }
  setStructuredFilter({ kind: 'word', value: word, label: word });
});

function scrollListIntoView() {
  requestAnimationFrame(() => {
    const listTop = document.getElementById('dd-body');
    if (!listTop) return;
    const rect = listTop.getBoundingClientRect();
    const onScreen = rect.top >= 0 && rect.top < window.innerHeight * 0.5;
    if (!onScreen) listTop.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}
// Month filter via the sparkline: click a month to narrow the headline
// list to it; click the same month again to clear. The filter box and
// the peak drilldown remain the keyboard-reachable routes to the same
// information — a canvas can't sensibly take 174 tab stops.
sparkEl.addEventListener('click', (e) => {
  const months = state._summaryMonths;
  if (!months || !months.length) return;
  const rect = sparkEl.getBoundingClientRect();
  const i = Math.round(((e.clientX - rect.left) / rect.width) * (months.length - 1));
  const month = months[Math.max(0, Math.min(months.length - 1, i))];
  if (!month) return;
  const sf = state.structuredFilter;
  if (sf?.kind === 'month' && sf.value === month) {
    clearStructuredFilter();
    return;
  }
  setStructuredFilter({ kind: 'month', value: month, label: formatMonth(month) });
  scrollListIntoView();
});

tonesEl.addEventListener('click', (e) => {
  const row = e.target.closest('.breakdown-row[data-tone]');
  if (!row) return;
  const id = row.dataset.tone;
  if (state.structuredFilter?.kind === 'tone' && state.structuredFilter.value === id) {
    clearStructuredFilter(); return;
  }
  setStructuredFilter({ kind: 'tone', value: id, label: toneLabel(id) });
});

sectionsEl.addEventListener('click', (e) => {
  const row = e.target.closest('.breakdown-row[data-section]');
  if (!row) return;
  const id = row.dataset.section;
  if (state.structuredFilter?.kind === 'section' && state.structuredFilter.value === id) {
    clearStructuredFilter(); return;
  }
  const label = sectionLabel(id);
  setStructuredFilter({ kind: 'section', value: id, label });
});

// ───────────────── CSV export ─────────────────
function exportCsv() {
  if (!state.headlines.length) return;
  // Use the same filter pipeline as the headline list itself —
  // previously the export did its own substring match on filterEl
  // value, which broke for every structured filter type. A tone
  // filter "Features" would look for the word "features" in
  // headlines (mostly empty); a tag filter "Television" would only
  // catch headlines containing the word "Television" (mostly 2026
  // because that's when the word's recent in copy). applyActiveFilter
  // is the single source of truth for "what's in the current view".
  const rows = applyActiveFilter(state.headlines);
  if (!rows.length) return;
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
  const toSlug = (s) => (s || '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const baseSlug = toSlug(state.query.label) || 'deep-dive';
  // If a filter's active, fold its label into the filename so the
  // downloaded file says what it actually contains.
  const filterSlug = state.structuredFilter
    ? `-${toSlug(state.structuredFilter.kind)}-${toSlug(state.structuredFilter.label)}`
    : '';
  a.download = `guardian-angles-${baseSlug}${filterSlug}-${state.yearFrom}-${state.yearTo}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ───────────────── Sparkline ─────────────────
// Redraw the sparkline from its last-drawn data — used when the month
// filter toggles so the gold band appears/disappears without a recount.
function redrawSpark() {
  if (sparkEl._counts) drawSparkline(sparkEl, sparkEl._counts, sparkEl._peakIdx);
}

function drawSparkline(canvas, counts, highlightIdx) {
  canvas._counts = counts;
  canvas._peakIdx = highlightIdx;
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

  // Active month band — the yellow-highlight idiom from Trends.
  const sf = state.structuredFilter;
  if (sf?.kind === 'month' && state._summaryMonths) {
    const ai = state._summaryMonths.indexOf(sf.value);
    if (ai >= 0) {
      const bw = Math.max(3, W / Math.max(1, counts.length - 1));
      ctx.fillStyle = 'rgba(255, 229, 0, 0.45)';
      ctx.fillRect(xFor(ai) - bw / 2, 0, bw, H);
    }
  }

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
