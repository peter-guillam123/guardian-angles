// The company it keeps — Deep dive's per-year companion heatmap.
//
// Reads the co-occurrence index (build/build_cooccurrence.py) and shows,
// for the dived-on tag, its companion tags as a grid: one row per
// companion, one column per year, cells shaded by the chosen metric.
// Rows are ordered by first appearance, so the cast cascades down the
// page as the years pass — Ukip at the top of Farage's grid, Reform UK
// near the bottom.
//
// This replaced a bump chart: rank-lines equalised away magnitude (a
// rank 1 on five shared articles in a quiet year drew exactly like a
// 394-article partnership) and fifteen years of churn made spaghetti
// no amount of label-culling could tame. The grid shows magnitude as
// shade, makes label collisions structurally impossible, and matches
// the weekly-volume heatmap above it on the page — same colour ramp,
// same visual grammar.
//
// Two metrics: "most distinctive" (default — lift vs the companion's
// typical share of that year's output, damped so a handful of shared
// articles can't out-score a real partnership) and "most articles"
// (raw shared counts). The metric drives both cast selection and cell
// shade; the tooltip always carries both numbers.

import { loadCooccur, loadTagIndex, loadTagCatalog } from './data.js';
import { isUsefulTag } from './skip-tags.js';

const MIN_SHARED = 5;          // display floor — index stores >=3 for headroom

const wrap = document.getElementById('dd-company');
const gridEl = document.getElementById('dd-company-grid');
const tipEl = document.getElementById('dd-company-tip');
const axisEl = document.getElementById('dd-company-axis');
const toggleBtns = wrap ? [...wrap.querySelectorAll('[data-co-mode]')] : [];

let _mode = 'distinctive';
let _current = null;   // { tagId, label, yearFrom, yearTo }
let _data = null;      // { co, idx, names }
let _renderToken = 0;
let _yearSumCache = new Map();   // tagId → Map(year → count)
let _totalsByYear = null;        // Map(year → total headlines)

// Normalised model that build() consumes, so the same renderer serves
// both a tag (from the precomputed co-occurrence index) and a word
// (companion tags tallied live from the matched headlines).
let _years = [];                 // years in the visible range
let _companionsByYear = null;    // Map(year → Map(companionTagId → shared count))
let _topicSums = null;           // Map(year → the topic's own article count)

// ───────────────────────── Public API ─────────────────────────

function setData(idx, catalog, co) {
  if (!_data || _data.idx !== idx) { _yearSumCache = new Map(); _totalsByYear = null; }
  _data = { co, idx, names: new Map(catalog.map(t => [t.id, t.name])) };
}

// Tag dive: companions come from the precomputed co-occurrence index,
// so the chart renders instantly.
export async function renderCompany({ tagId, label, yearFrom, yearTo }) {
  if (!wrap) return;
  _current = { label, yearFrom, yearTo };
  const token = ++_renderToken;
  try {
    const [co, idx, catalog] = await Promise.all([
      loadCooccur(), loadTagIndex('monthly'), loadTagCatalog(),
    ]);
    if (token !== _renderToken) return;
    setData(idx, catalog, co);
    if (!co.tags[tagId]) { hideCompany(); return; }
    const years = co.years.filter(y => y >= yearFrom && y <= yearTo);
    const companions = new Map();
    for (const y of years) {
      const yi = co.years.indexOf(y);
      const m = new Map();
      for (const [ci, c] of (co.tags[tagId][yi] || [])) m.set(co.ids[ci], c);
      companions.set(y, m);
    }
    _years = years;
    _companionsByYear = companions;
    _topicSums = yearSumsFor(tagId);
    wrap.hidden = false;
    build();
  } catch (e) {
    // The block is an enrichment — if cooccur.json is missing (e.g. a
    // local clone that hasn't built it), the page works without it.
    console.error('company block unavailable:', e);
    hideCompany();
  }
}

// Word (or tone) dive: there's no precomputed entry, but the matched
// headlines are already in memory — each carries its tags and date — so
// we tally a word's companion tags per year on the fly. Same renderer.
export async function renderCompanyForHeadlines({ headlines, label, yearFrom, yearTo }) {
  if (!wrap) return;
  _current = { label, yearFrom, yearTo };
  const token = ++_renderToken;
  try {
    const [idx, catalog] = await Promise.all([loadTagIndex('monthly'), loadTagCatalog()]);
    if (token !== _renderToken) return;
    setData(idx, catalog, _data && _data.co);

    const years = [];
    for (let y = yearFrom; y <= yearTo; y++) years.push(y);
    const companions = new Map(years.map(y => [y, new Map()]));
    const topicSums = new Map(years.map(y => [y, 0]));
    for (const h of headlines) {
      const y = +((h.d || '').slice(0, 4));
      const m = companions.get(y);
      if (!m) continue;
      topicSums.set(y, topicSums.get(y) + 1);
      const seen = new Set();
      for (const t of (h.g || [])) {
        if (seen.has(t) || !isUsefulTag(t)) continue;
        seen.add(t);
        m.set(t, (m.get(t) || 0) + 1);
      }
    }
    _years = years;
    _companionsByYear = companions;
    _topicSums = topicSums;

    // Nothing clears the display floor → hide rather than show an empty grid.
    const anything = [...companions.values()].some(m => [...m.values()].some(c => c >= MIN_SHARED));
    if (!anything) { hideCompany(); return; }
    wrap.hidden = false;
    build();
  } catch (e) {
    console.error('company block unavailable:', e);
    hideCompany();
  }
}

export function hideCompany() {
  if (!wrap) return;
  wrap.hidden = true;
  if (tipEl) tipEl.hidden = true;
}

// ───────────────────────── Ranking model ─────────────────────────

function yearSumsFor(tagId) {
  let m = _yearSumCache.get(tagId);
  if (m) return m;
  m = new Map();
  const counts = _data.idx.tags[tagId];
  if (counts) {
    _data.idx.buckets.forEach((b, i) => {
      const y = +b.slice(0, 4);
      m.set(y, (m.get(y) || 0) + counts[i]);
    });
  }
  _yearSumCache.set(tagId, m);
  return m;
}

function totalsByYear() {
  if (_totalsByYear) return _totalsByYear;
  _totalsByYear = new Map();
  _data.idx.buckets.forEach((b, i) => {
    const y = +b.slice(0, 4);
    _totalsByYear.set(y, (_totalsByYear.get(y) || 0) + _data.idx.totals[i]);
  });
  return _totalsByYear;
}

// Lift of companion vs its typical share of that year's output, damped so
// a handful of shared articles can't out-score a genuine partnership.
function distinctiveScore(shared, topicYear, compYear, totalYear) {
  if (!topicYear || !compYear || !totalYear) return 0;
  const lift = (shared / topicYear) / (compYear / totalYear);
  return lift * (shared / (shared + 5));
}

function build() {
  const years = _years;
  const topicSums = _topicSums;
  const totals = totalsByYear();

  // Score every companion in every visible year, from the normalised
  // model (built from the index for tags, from headlines for words).
  const ranked = new Map();   // year → [{ id, shared, lift, score }] desc
  for (const y of years) {
    const entries = [...(_companionsByYear.get(y) || new Map()).entries()]
      .map(([id, c]) => ({ id, shared: c }))
      .filter(e => e.shared >= MIN_SHARED);
    for (const e of entries) {
      const compY = yearSumsFor(e.id).get(y) || 0;
      e.lift = (topicSums.get(y) && compY && totals.get(y))
        ? (e.shared / topicSums.get(y)) / (compY / totals.get(y))
        : 0;
      e.score = _mode === 'distinctive'
        ? distinctiveScore(e.shared, topicSums.get(y), compY, totals.get(y))
        : e.shared;
    }
    entries.sort((a, b) => b.score - a.score);
    ranked.set(y, entries);
  }

  // Pick the cast. Two doors in: most slots go to the companions with
  // the highest summed score across the window (the long arcs — Ukip,
  // Conservatives, Reform UK), and the last few are wildcards for the
  // biggest single-year peaks not already in (the cameos — Banking in
  // the Coutts year, I'm a Celebrity in the jungle year).
  const narrow = (gridEl.clientWidth || wrap.clientWidth || 600) < 560;
  const CAST_N = narrow ? 9 : 13;
  const WILDCARDS = narrow ? 2 : 3;
  const sums = new Map();
  const peaks = new Map();
  for (const y of years) {
    for (const e of ranked.get(y)) {
      sums.set(e.id, (sums.get(e.id) || 0) + e.score);
      peaks.set(e.id, Math.max(peaks.get(e.id) || 0, e.score));
    }
  }
  const castIds = new Set([...sums.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, CAST_N - WILDCARDS)
    .map(([id]) => id));
  for (const [id] of [...peaks.entries()].sort((a, b) => b[1] - a[1])) {
    if (castIds.size >= CAST_N) break;
    castIds.add(id);
  }

  // One row per cast member; cells carry both numbers for the tooltip.
  const rowsMap = new Map();
  for (const y of years) {
    for (const e of ranked.get(y)) {
      if (!castIds.has(e.id)) continue;
      let r = rowsMap.get(e.id);
      if (!r) {
        r = { id: e.id, name: _data.names.get(e.id) || e.id, cells: new Map(), weight: 0 };
        rowsMap.set(e.id, r);
      }
      r.cells.set(y, {
        shared: e.shared,
        lift: e.lift,
        score: e.score,
        of: topicSums.get(y) || 0,   // the topic's own article count that year
      });
      r.weight += e.shared;
    }
  }
  // Order rows by first appearance, then weight — the cast cascades
  // down the grid as the years pass.
  const rows = [...rowsMap.values()]
    .sort((a, b) => Math.min(...a.cells.keys()) - Math.min(...b.cells.keys()) || b.weight - a.weight);

  const maxVal = Math.max(1e-9, ...rows.flatMap(r =>
    [...r.cells.values()].map(c => _mode === 'distinctive' ? c.score : c.shared)));

  if (axisEl) {
    axisEl.textContent = _mode === 'distinctive'
      ? 'Cell shade = how distinctively they shared articles that year'
      : 'Cell shade = how many articles they shared that year';
  }
  renderGrid({ years, rows, maxVal, narrow });
  updateAria({ years, rows });
}

// ───────────────────────── Grid rendering ─────────────────────────

function renderGrid({ years, rows, maxVal, narrow }) {
  if (tipEl) tipEl.hidden = true;
  const { yearFrom, yearTo } = _current;
  const n = years.length;

  // Year header: every label when they fit, every other when they don't.
  const labelStep = n > (narrow ? 7 : 15) ? 2 : 1;
  const head = years.map((y, i) => {
    const show = i === 0 || i === n - 1 || i % labelStep === 0;
    // Narrow columns can't fit a four-digit year — even the first one.
    const lbl = (i === 0 && !narrow) ? String(y) : `'${String(y).slice(2)}`;
    return `<span class="dd-co-year">${show ? lbl : ''}</span>`;
  }).join('');

  const rowsHtml = rows.map(r => {
    const cells = years.map(y => {
      const c = r.cells.get(y);
      if (!c) return '<span class="dd-co-cell dd-co-empty" aria-hidden="true"></span>';
      const metric = _mode === 'distinctive' ? c.score : c.shared;
      // sqrt keeps the mid-range readable; the floor keeps a present-but-
      // faint year clearly blue against the beige of an absent one.
      const i = Math.max(0.18, Math.sqrt(metric / maxVal)).toFixed(3);
      const liftStr = c.lift >= 1.05
        ? ` · ×${c.lift >= 10 ? Math.round(c.lift) : c.lift.toFixed(1)} vs typical`
        : '';
      const tip = `${r.name} — shared ${c.shared} of ${truncate(_current.label || 'the topic', 18)}'s ${c.of} article${c.of === 1 ? '' : 's'}, ${y}${liftStr}`;
      return `<span class="dd-co-cell" style="--dd-i:${i}" data-tip="${escapeAttr(tip)}" aria-hidden="true"></span>`;
    }).join('');
    return `
      <a class="dd-co-name" href="./deepdive.html?tag=${encodeURIComponent(r.id)}&from=${yearFrom}&to=${yearTo}"
         title="${escapeAttr(r.name)} — deep dive"
         aria-label="Deep dive on ${escapeAttr(r.name)}">${escapeHtml(r.name)}</a>
      ${cells}`;
  }).join('');

  gridEl.style.setProperty('--co-cols', n);
  gridEl.innerHTML = `<span class="dd-co-corner" aria-hidden="true"></span>${head}${rowsHtml}`;
}

function truncate(s, max) {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

// ───────────────────────── Tooltip (delegated) ─────────────────────────

if (gridEl) {
  gridEl.addEventListener('mouseover', (ev) => {
    const cell = ev.target.closest('.dd-co-cell[data-tip]');
    if (!cell) { tipEl.hidden = true; return; }
    tipEl.textContent = cell.dataset.tip;
    tipEl.hidden = false;
    const stage = gridEl.parentElement.getBoundingClientRect();
    const r = cell.getBoundingClientRect();
    const x = Math.min(r.left - stage.left, stage.width - tipEl.offsetWidth - 8);
    const y = r.top - stage.top - 32;
    tipEl.style.left = Math.max(0, x) + 'px';
    tipEl.style.top = Math.max(0, y) + 'px';
  });
  gridEl.addEventListener('mouseleave', () => { tipEl.hidden = true; });
}

toggleBtns.forEach(b => b.addEventListener('click', () => {
  const mode = b.dataset.coMode;
  if (mode === _mode) return;
  _mode = mode;
  toggleBtns.forEach(x => x.classList.toggle('active', x === b));
  if (_current && _data) build();
}));

// ───────────────────────── Accessibility ─────────────────────────

function updateAria({ years, rows }) {
  const firstYear = years[0], lastYear = years[years.length - 1];
  // role=group (not img): the row labels are real links and must stay
  // reachable — role=img would flatten the subtree for screen readers.
  gridEl.setAttribute('role', 'group');
  gridEl.setAttribute('aria-label',
    `Heatmap of companion tags by year, ${firstYear} to ${lastYear}, shaded by ` +
    `${_mode === 'distinctive' ? 'how distinctively each shared articles with the topic' : 'how many articles each shared with the topic'}. ` +
    `Companions in order of first appearance: ${rows.map(r => r.name).join(', ')}. ` +
    'Each companion name links to its own deep dive.');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
