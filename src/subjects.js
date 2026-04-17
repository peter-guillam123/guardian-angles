// Subjects table — browse every Guardian tag we index, ranked by article
// volume. Filter by name, section, and year range. Check up to four to
// jump to the Trends view with those tags pre-loaded.

import { loadTagCatalog, loadTagIndex } from './data.js';
import { sectionLabel } from './sections.js';

const MAX_SELECTION = 4;
const DEFAULT_PAGE_SIZE = 500;

const state = {
  catalog: [],       // [{ id, name, n }]
  index: null,       // { buckets: [...], totals: [...], tags: {id: counts[]} }
  selection: new Set(),
  yearFrom: 2016,
  yearTo: 2026,
  nameFilter: '',
  sectionFilter: 'all',
  sortKey: 'count',
  sortDir: 'desc',
  pageSize: DEFAULT_PAGE_SIZE,
};

// ---------- DOM ----------
const bodyEl = document.getElementById('subjects-body');
const metaEl = document.getElementById('subjects-meta');
const statBig = document.getElementById('stat-big');
const nameFilterEl = document.getElementById('name-filter');
const sectionChipsEl = document.getElementById('section-chips');
const yearFromEl = document.getElementById('year-from');
const yearToEl = document.getElementById('year-to');
const yearFromDisplay = document.getElementById('year-from-display');
const yearToDisplay = document.getElementById('year-to-display');
const rangeFillEl = document.getElementById('range-fill');
const compareBar = document.getElementById('compare-bar');
const compareCount = document.getElementById('compare-count');
const compareChips = document.getElementById('compare-chips');
const compareClear = document.getElementById('compare-clear');
const compareGo = document.getElementById('compare-go');

// ---------- Init ----------
init();

async function init() {
  try {
    const [catalog, index] = await Promise.all([
      loadTagCatalog(),
      loadTagIndex('monthly'),
    ]);
    state.catalog = catalog;
    state.index = index;

    // Resolve the actual year range from the buckets we have
    if (index.buckets.length) {
      const years = index.buckets.map(b => parseInt(b.slice(0, 4)));
      const min = Math.min(...years);
      const max = Math.max(...years);
      [yearFromEl, yearToEl].forEach(el => { el.min = min; el.max = max; });
      yearFromEl.value = min; yearToEl.value = max;
      state.yearFrom = min; state.yearTo = max;
      updateYearDisplay();
    }

    // Full-precision here — it's the page's headline stat, not a chart axis
    statBig.textContent = catalog.length.toLocaleString('en-GB');
    buildSectionChips();
    wireControls();
    wireTableSort();
    render();
  } catch (e) {
    console.error(e);
    metaEl.textContent = 'Could not load subject data. Has the build run yet?';
  }
}

// ---------- Section chips ----------
function sectionPrefix(tagId) {
  return tagId.split('/')[0] || 'other';
}

function buildSectionChips() {
  // Group catalog by section prefix, sort by total volume
  const totals = {};
  for (const t of state.catalog) {
    const s = sectionPrefix(t.id);
    totals[s] = (totals[s] || 0) + t.n;
  }
  const ordered = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  sectionChipsEl.innerHTML = '';
  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.className = 'chip active';
  allBtn.dataset.section = 'all';
  allBtn.textContent = 'All';
  sectionChipsEl.appendChild(allBtn);

  for (const id of ordered) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.dataset.section = id;
    btn.textContent = sectionLabel(id);
    sectionChipsEl.appendChild(btn);
  }

  sectionChipsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    state.sectionFilter = btn.dataset.section;
    [...sectionChipsEl.children].forEach(b => b.classList.toggle('active', b === btn));
    render();
  });
}

// ---------- Range slider (dual thumb) ----------
function wireControls() {
  const onRangeInput = () => {
    let from = parseInt(yearFromEl.value);
    let to = parseInt(yearToEl.value);
    if (from > to) {
      // Swap by pushing the lagging thumb
      if (document.activeElement === yearFromEl) to = from;
      else from = to;
      yearFromEl.value = from;
      yearToEl.value = to;
    }
    state.yearFrom = from;
    state.yearTo = to;
    updateYearDisplay();
    render();
  };
  yearFromEl.addEventListener('input', onRangeInput);
  yearToEl.addEventListener('input', onRangeInput);

  nameFilterEl.addEventListener('input', () => {
    state.nameFilter = nameFilterEl.value.trim().toLowerCase();
    render();
  });

  compareClear.addEventListener('click', () => {
    state.selection.clear();
    updateCompareBar();
    render();
  });

  compareGo.addEventListener('click', () => {
    if (state.selection.size === 0) return;
    const ids = Array.from(state.selection);
    const params = new URLSearchParams();
    params.set('tags', ids.join(','));
    // Best granularity for a long range is monthly; weekly once short
    if (state.yearTo - state.yearFrom <= 2) params.set('g', 'weekly');
    location.href = `./?${params.toString()}`;
  });
}

function updateYearDisplay() {
  yearFromDisplay.textContent = state.yearFrom;
  yearToDisplay.textContent = state.yearTo;
  const min = parseInt(yearFromEl.min);
  const max = parseInt(yearFromEl.max);
  const span = max - min || 1;
  const fromPct = ((state.yearFrom - min) / span) * 100;
  const toPct = ((state.yearTo - min) / span) * 100;
  rangeFillEl.style.left = fromPct + '%';
  rangeFillEl.style.right = (100 - toPct) + '%';
}

// ---------- Sort ----------
function wireTableSort() {
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === 'desc' ? 'asc' : 'desc';
      } else {
        state.sortKey = key;
        state.sortDir = key === 'count' ? 'desc' : 'asc';
      }
      document.querySelectorAll('th.sortable').forEach(t => {
        t.classList.remove('sort-asc', 'sort-desc');
        if (t.dataset.sort === state.sortKey) t.classList.add('sort-' + state.sortDir);
      });
      render();
    });
  });
}

// ---------- Core computation: per-tag stats within current filter ----------
function bucketInRange(bucket, fromYear, toYear) {
  const y = parseInt(bucket.slice(0, 4));
  return y >= fromYear && y <= toYear;
}

function computeFilteredRows() {
  const { catalog, index, yearFrom, yearTo, nameFilter, sectionFilter } = state;
  const buckets = index.buckets;
  const inRange = buckets.map(b => bucketInRange(b, yearFrom, yearTo));
  const anyInRange = inRange.some(Boolean);

  const rows = [];
  for (const t of catalog) {
    if (sectionFilter !== 'all' && sectionPrefix(t.id) !== sectionFilter) continue;
    if (nameFilter && !t.name.toLowerCase().includes(nameFilter) && !t.id.toLowerCase().includes(nameFilter)) continue;

    const counts = index.tags[t.id];
    if (!counts) continue;

    let sum = 0;
    if (anyInRange) {
      for (let i = 0; i < counts.length; i++) if (inRange[i]) sum += counts[i];
    }
    rows.push({
      id: t.id,
      name: t.name,
      section: sectionPrefix(t.id),
      count: sum,
      counts, // full series for sparkline
    });
  }

  const dirMul = state.sortDir === 'desc' ? -1 : 1;
  rows.sort((a, b) => {
    let d = 0;
    if (state.sortKey === 'count') d = a.count - b.count;
    else if (state.sortKey === 'name') d = a.name.localeCompare(b.name);
    else if (state.sortKey === 'section') d = a.section.localeCompare(b.section) || (a.count - b.count);
    return d * dirMul;
  });

  return { rows, inRange };
}

// ---------- Sparkline ----------
// Returns an inline <svg> fragment as a string. Sized 80×18.
function sparklineSVG(counts, inRange, maxValue) {
  const W = 80, H = 18, PAD_Y = 2;
  if (!counts.length || !maxValue) return `<svg class="spark" viewBox="0 0 ${W} ${H}"></svg>`;
  const filtered = counts.map((c, i) => (inRange[i] ? c : null));
  const firstIdx = filtered.findIndex(v => v !== null);
  const lastIdx = (() => { for (let i = filtered.length - 1; i >= 0; i--) if (filtered[i] !== null) return i; return -1; })();
  if (firstIdx === -1) return `<svg class="spark" viewBox="0 0 ${W} ${H}"></svg>`;

  const span = Math.max(1, lastIdx - firstIdx);
  const inner = W;
  const pts = [];
  for (let i = firstIdx; i <= lastIdx; i++) {
    const v = filtered[i];
    if (v == null) continue;
    const x = ((i - firstIdx) / span) * inner;
    const y = H - PAD_Y - (v / maxValue) * (H - PAD_Y * 2);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  if (pts.length === 0) return `<svg class="spark" viewBox="0 0 ${W} ${H}"></svg>`;
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <polyline fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round" stroke-linecap="round" points="${pts.join(' ')}" />
  </svg>`;
}

// ---------- Render ----------
function render() {
  const { rows, inRange } = computeFilteredRows();

  // Determine max within-range count for sparkline y-scale
  // (Scale each sparkline to its OWN max for readable shape; use
  // per-row max not global max.)

  const visible = rows.slice(0, state.pageSize);
  const html = visible.map(r => renderRow(r, inRange)).join('');
  bodyEl.innerHTML = html || '<tr><td colspan="5" class="empty">No matches.</td></tr>';

  const shown = visible.length;
  const total = rows.length;
  if (total === 0) metaEl.textContent = 'No subjects match these filters.';
  else if (shown < total) metaEl.textContent = `Showing top ${shown.toLocaleString('en-GB')} of ${total.toLocaleString('en-GB')} — narrow with the filter to see more.`;
  else metaEl.textContent = `Showing ${shown.toLocaleString('en-GB')} subject${shown === 1 ? '' : 's'}.`;

  updateCheckboxes();
  updateCompareBar();
}

function renderRow(r, inRange) {
  // Per-row max for its own sparkline
  let rowMax = 0;
  for (let i = 0; i < r.counts.length; i++) if (inRange[i] && r.counts[i] > rowMax) rowMax = r.counts[i];
  const checked = state.selection.has(r.id) ? 'checked' : '';
  const disabled = !checked && state.selection.size >= MAX_SELECTION ? 'disabled' : '';
  return `
    <tr data-id="${escAttr(r.id)}" data-name="${escAttr(r.name)}">
      <td class="col-check">
        <input type="checkbox" ${checked} ${disabled} aria-label="Select ${escAttr(r.name)}" />
      </td>
      <td class="col-name">
        <span class="subject-name">${escHtml(r.name)}</span>
        <span class="subject-slug">${escHtml(r.id)}</span>
      </td>
      <td class="col-section">${escHtml(sectionLabel(r.section))}</td>
      <td class="col-count">${fmtCompact(r.count)}</td>
      <td class="col-trend">${sparklineSVG(r.counts, inRange, rowMax)}</td>
    </tr>
  `;
}

function updateCheckboxes() {
  // Row click toggles selection (for whole-row clickability)
  bodyEl.onclick = (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    const cb = tr.querySelector('input[type="checkbox"]');
    if (!cb) return;
    if (e.target.tagName === 'INPUT') {
      // Native checkbox toggle happens; just sync state
    } else {
      if (cb.disabled) return;
      cb.checked = !cb.checked;
    }
    toggleSelection(tr.dataset.id, tr.dataset.name, cb.checked);
    // Re-render because other rows' disabled state may need to update
    render();
  };
}

function toggleSelection(id, name, on) {
  if (on) {
    if (state.selection.size >= MAX_SELECTION) return;
    state.selection.add(id);
  } else {
    state.selection.delete(id);
  }
}

function updateCompareBar() {
  const n = state.selection.size;
  if (n === 0) { compareBar.hidden = true; return; }
  compareBar.hidden = false;
  compareCount.textContent = `${n} selected`;
  compareGo.disabled = n < 1;

  // Show chips for each selected tag
  const byId = new Map(state.catalog.map(t => [t.id, t]));
  compareChips.innerHTML = [...state.selection].map(id => {
    const t = byId.get(id);
    const label = t ? t.name : id;
    return `<li class="compare-chip" data-id="${escAttr(id)}">${escHtml(label)} <button type="button" aria-label="Remove">×</button></li>`;
  }).join('');
  compareChips.querySelectorAll('.compare-chip button').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.parentElement.dataset.id;
      state.selection.delete(id);
      render();
    });
  });
}

// ---------- Helpers ----------
function formatCount(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}
function fmtCompact(n) {
  if (n >= 10000) return (n / 1000).toFixed(1) + 'k';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toLocaleString('en-GB');
}
function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escAttr(s) { return escHtml(s); }
