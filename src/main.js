// Entry: wires search → chart → reading panel → headline explorer + section breakdown.
// Supports two modes: "words" (headline substring search) and "tags" (editorial tag picker).

import {
  loadSections, loadMeta,
  queryTerm, queryTag,
  headlinesForTermInBucket, headlinesForTagInBucket,
  normalisePerMille, loadTagCatalog,
  loadIndex, loadTagIndex,
  queryInSection, headlinesForKeyInBucketAndSection,
} from './data.js';
import { TrendChart, PALETTE } from './chart.js';
import { HeadlineExplorer } from './headlines.js';
import { sectionLabel } from './sections.js';
import { attachAutocomplete, detachAutocomplete, seedInput } from './autocomplete.js';
import { computeRising } from './trending.js';
import { exportChartAsPNG } from './share.js';
import { pickWordRecipe, pickTagRecipe } from './lucky.js';

const MAX_TERMS = 4;

const chartEl = document.getElementById('chart');
const headlinesEl = document.getElementById('headlines');
const headlinesSection = document.getElementById('headlines-section');
const headlinesTitle = document.getElementById('headlines-title');
const headlinesMeta = document.getElementById('headlines-meta');
const legendEl = document.getElementById('legend');
const chartPromptEl = document.getElementById('chart-prompt');
const chartHeadlineEl = document.getElementById('chart-headline');

// Swap between the empty-state prompt (UI sans, muted, tracked) and the proper
// serif headline that appears once a search has run. Only one is visible at a
// time. Returns the active element's text for downstream use (e.g. share image).
function setChartTitle(kind, text) {
  if (kind === 'prompt') {
    chartPromptEl.textContent = text;
    chartPromptEl.hidden = false;
    chartHeadlineEl.hidden = true;
    chartHeadlineEl.textContent = '';
  } else {
    chartHeadlineEl.textContent = text;
    chartHeadlineEl.hidden = false;
    chartPromptEl.hidden = true;
  }
}
function currentChartTitle() {
  return chartHeadlineEl.hidden ? chartPromptEl.textContent : chartHeadlineEl.textContent;
}
const form = document.getElementById('search-form');
const clearBtn = document.getElementById('clear-btn');
const readingMonth = document.getElementById('reading-month');
const readingValues = document.getElementById('reading-values');
const readingEyebrow = document.getElementById('reading-eyebrow');
const readingCta = document.getElementById('reading-cta');
const periodStatsEl = document.getElementById('period-stats');
const statBig = document.getElementById('stat-big');
const chartActionsEl = document.getElementById('chart-actions');
const shareBtnEl = document.getElementById('share-btn');
const yearRangeEl = document.getElementById('chart-year-range');
const yearFromInput = document.getElementById('trends-year-from');
const yearToInput = document.getElementById('trends-year-to');
const yearFromDisplay = document.getElementById('trends-year-from-display');
const yearToDisplay = document.getElementById('trends-year-to-display');
const yearRangeFill = document.getElementById('trends-range-fill');

let yearFilter = null; // { from: year, to: year } or null for full range
const breakdownEl = document.getElementById('breakdown');
const breakdownBarsEl = document.getElementById('breakdown-bars');
const searchLabelEl = document.getElementById('search-label');
const examplesWordsEl = document.getElementById('examples-words');
const examplesTagsEl = document.getElementById('examples-tags');
const risingPanelEl = document.getElementById('rising-panel');
const risingTagsListEl = document.querySelector('#rising-tags .rising-list');
const risingWordsListEl = document.querySelector('#rising-words .rising-list');
const sectionFilterEl = document.getElementById('section-filter');

const chart = new TrendChart(chartEl);
const explorer = new HeadlineExplorer(headlinesEl);

let currentMode = null; // 'words' | 'tags' — set by setMode() during init
let currentView = 'timeline'; // 'timeline' | 'yoy'
let currentQueries = [];   // for words: [strings]; for tags: [tag ids]
let currentLabels = [];    // display labels aligned with currentQueries
let currentSeries = [];
let currentGranularity = 'monthly';
let currentTotals = null;
let currentBuckets = null;
let tagCatalog = null;

const inputs = () => [1,2,3,4].map(i => document.getElementById('q' + i));

async function init() {
  setReadingIdle('Loading the archive…');

  try {
    const [sections, meta] = await Promise.all([loadSections(), loadMeta()]);
    if (statBig) statBig.textContent = formatCount(meta.total_headlines);
    populateSectionFilter(sections);
    fillDekStats(sections, meta);
    initYearRange(sections);
  } catch (e) {
    setReadingIdle('Could not load data. Has the build run yet?');
    console.error(e);
    return;
  }

  setReadingIdle('Hover the chart.');

  // Example links — words
  document.querySelectorAll('#examples-words a[data-query]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentMode !== 'words') setMode('words');
      const terms = a.dataset.query.split(',');
      inputs().forEach((inp, i) => { inp.value = terms[i] || ''; delete inp.dataset.tagId; });
      runSearch();
    });
  });

  // Example links — tags
  document.querySelectorAll('#examples-tags a[data-tag-query]').forEach(a => {
    a.addEventListener('click', async (e) => {
      e.preventDefault();
      if (currentMode !== 'tags') await setMode('tags');
      const tagIds = a.dataset.tagQuery.split(',');
      inputs().forEach((inp, i) => {
        if (tagIds[i] && tagCatalog) seedInput(inp, tagIds[i], tagCatalog);
        else { inp.value = ''; delete inp.dataset.tagId; }
      });
      runSearch();
    });
  });

  // "I feel lucky" — 80% pure random (always 4 fresh items from the top
  // index), 20% curated easter-egg recipe. Either way, always fills all
  // four input slots.
  document.getElementById('lucky-btn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const useRecipe = Math.random() < 0.2;

    if (currentMode === 'words') {
      const idx = await loadIndex('monthly');
      const allTerms = Object.keys(idx.terms).filter(t => t.length >= 4);
      let picks;
      if (useRecipe) {
        picks = pickWordRecipe();
        // Pad with random terms if the recipe has <4 items
        while (picks.length < 4) {
          const r = allTerms[Math.floor(Math.random() * Math.min(500, allTerms.length))];
          if (!picks.includes(r)) picks.push(r);
        }
      } else {
        picks = pickRandomN(allTerms.slice(0, 500), 4);
      }
      inputs().forEach((inp, i) => {
        inp.value = picks[i] || '';
        delete inp.dataset.tagId;
      });
    } else {
      if (!tagCatalog) tagCatalog = await loadTagCatalog();
      const byId = new Map(tagCatalog.map(t => [t.id, t]));
      let pickedTags;
      if (useRecipe) {
        const recipe = pickTagRecipe(tagCatalog);
        pickedTags = (recipe || []).map(id => byId.get(id)).filter(Boolean);
        // Pad with random tags until we have 4
        const pool = tagCatalog.slice(0, 200);
        while (pickedTags.length < 4) {
          const t = pool[Math.floor(Math.random() * pool.length)];
          if (!pickedTags.includes(t)) pickedTags.push(t);
        }
      } else {
        pickedTags = pickRandomN(tagCatalog.slice(0, 200), 4);
      }
      inputs().forEach((inp, i) => {
        const tag = pickedTags[i];
        if (tag) {
          inp.value = tag.name;
          inp.dataset.tagId = tag.id;
        } else {
          inp.value = '';
          delete inp.dataset.tagId;
        }
      });
    }
    runSearch();
  });

  function pickRandomN(pool, n) {
    const copy = [...pool];
    const picks = [];
    while (picks.length < n && copy.length) {
      const i = Math.floor(Math.random() * copy.length);
      picks.push(copy.splice(i, 1)[0]);
    }
    return picks;
  }

  // Granularity buttons
  document.querySelectorAll('.gran-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const g = btn.dataset.granularity;
      if (g === currentGranularity) return;
      document.querySelectorAll('.gran-btn').forEach(b => b.classList.toggle('active', b === btn));
      currentGranularity = g;
      if (currentQueries.length) runSearch();
    });
  });

  // Mode buttons
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  // Share button
  shareBtnEl.addEventListener('click', () => {
    const legendItems = [...document.querySelectorAll('#legend .item')].map(el => ({
      color: el.querySelector('.swatch')?.style.background || '#052962',
      label: el.querySelector('.term')?.textContent || '',
    }));
    exportChartAsPNG({
      chartCanvas: chartEl,
      title: currentChartTitle(),
      legendItems,
      url: location.href,
    });
  });

  // View toggle (Timeline / Year-on-year)
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentView = btn.dataset.view;
      document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b === btn));
      if (currentQueries.length) renderChart();
    });
  });

  // Rising panel click handler (one-shot setup; uses event delegation)
  attachRisingClickHandler();

  // Section filter — re-runs the search when changed
  sectionFilterEl.addEventListener('change', () => {
    sectionFilterEl.classList.toggle('active', !!sectionFilterEl.value);
    if (currentQueries.length) runSearch();
  });

  // Chart events
  chart.addEventListener('pointclick', (e) => openHeadlines(e.detail));
  chart.addEventListener('hover', (e) => {
    if (e.detail) updateReadingPanel(e.detail.idx);
    else resetReadingPanel();
  });

  // URL params: ?q=... (words) or ?tags=... (tags)
  const params = new URLSearchParams(location.search);
  const gParam = params.get('g');
  if (gParam && ['monthly', 'weekly', 'daily'].includes(gParam)) {
    currentGranularity = gParam;
    document.querySelectorAll('.gran-btn').forEach(b => b.classList.toggle('active', b.dataset.granularity === gParam));
  }
  const qParam = params.get('q');
  const tagsParam = params.get('tags');
  const sParam = params.get('s');
  if (sParam) {
    sectionFilterEl.value = sParam;
    sectionFilterEl.classList.add('active');
  }

  // Resolve initial mode: URL params override the HTML default.
  if (qParam && !tagsParam) {
    await setMode('words');
    const terms = qParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, MAX_TERMS);
    inputs().forEach((inp, i) => { inp.value = terms[i] || ''; });
    if (terms.length) runSearch();
  } else {
    // Default to tags mode (matches the HTML default-active toggle).
    await setMode('tags');
    if (tagsParam) {
      const ids = tagsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, MAX_TERMS);
      inputs().forEach((inp, i) => {
        if (ids[i] && tagCatalog) seedInput(inp, ids[i], tagCatalog);
      });
      if (ids.length) runSearch();
    }
  }
}

async function setMode(mode) {
  // Idempotent — init() calls this on first load to apply the default.
  // We bail only on no-op transitions where currentMode was set to the same.
  if (mode === currentMode) return;
  const previousMode = currentMode;
  currentMode = mode;

  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  examplesWordsEl.hidden = mode !== 'words';
  examplesTagsEl.hidden = mode !== 'tags';

  // Reset state — but only clear inputs on a real user-driven mode swap,
  // not on the very first init where setMode() applies the default.
  if (previousMode !== null) {
    chart.setSeries([]);
    legendEl.innerHTML = '';
    headlinesSection.hidden = true;
    currentQueries = []; currentLabels = []; currentSeries = [];
    resetReadingPanel();
    inputs().forEach(inp => { inp.value = ''; delete inp.dataset.tagId; });
  }

  if (mode === 'tags') {
    searchLabelEl.textContent = 'Search tags';
    setChartTitle('prompt', 'Pick up to four Guardian tags to compare their coverage.');
    inputs().forEach((inp, i) => {
      inp.placeholder = i === 0 ? 'e.g. donald trump, climate…' : 'add another tag…';
    });
    if (!tagCatalog) tagCatalog = await loadTagCatalog();
    inputs().forEach(inp => attachAutocomplete(inp, tagCatalog));
  } else {
    searchLabelEl.textContent = 'Search headlines';
    setChartTitle('prompt', 'Type a word — or four — to plot a decade of Guardian coverage.');
    inputs().forEach((inp, i) => {
      inp.placeholder = [ 'e.g. starmer', 'add another…', 'and another…', 'and one more' ][i];
      detachAutocomplete(inp);
    });
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  runSearch();
});

clearBtn.addEventListener('click', () => {
  inputs().forEach(inp => { inp.value = ''; delete inp.dataset.tagId; });
  chart.setSeries([]);
  legendEl.innerHTML = '';
  chartActionsEl.hidden = true;
  if (yearRangeEl) yearRangeEl.hidden = true;
  const placeholder = currentMode === 'tags'
    ? 'Pick up to four Guardian tags to compare their coverage.'
    : 'Type a word — or four — to plot a decade of Guardian coverage.';
  setChartTitle('prompt', placeholder);
  headlinesSection.hidden = true;
  currentQueries = []; currentLabels = []; currentSeries = [];
  resetReadingPanel();
  history.replaceState(null, '', location.pathname);
});

async function runSearch() {
  // Collect queries from inputs depending on mode
  const queries = [];
  const labels = [];
  for (const inp of inputs()) {
    if (currentMode === 'tags') {
      const id = inp.dataset.tagId;
      if (id) { queries.push(id); labels.push(inp.value || id); }
    } else {
      const v = inp.value.trim();
      if (v) { queries.push(v); labels.push(v); }
    }
  }
  if (!queries.length) return;

  currentQueries = queries;
  currentLabels = labels;
  const sectionId = sectionFilterEl.value || null;
  setReadingIdle(sectionId ? 'Filtering by section…' : 'Searching the archive…');

  let results;
  if (sectionId) {
    // Section-filtered: re-aggregate from raw shards client-side.
    results = await Promise.all(queries.map(q =>
      queryInSection({ kind: currentMode, key: q, granularity: currentGranularity, sectionId })
    ));
  } else {
    results = await Promise.all(queries.map(q =>
      currentMode === 'tags'
        ? queryTag(q, currentGranularity)
        : queryTerm(q, currentGranularity)
    ));
  }
  const valid = results.filter(Boolean);
  if (!valid.length) { setReadingIdle('No results.'); return; }

  currentBuckets = valid[0].buckets;
  currentTotals = valid[0].totals;
  currentSeries = valid.map((r, i) => ({
    query: currentMode === 'tags' ? (r.tag || r.key) : (r.term || r.key),
    label: labels[i],
    buckets: r.buckets,
    values: normalisePerMille(r.counts, r.totals),
    counts: r.counts,
    gapMask: r.gapMask,
  }));

  renderChart();
  chartActionsEl.hidden = false;
  if (yearRangeEl) yearRangeEl.hidden = false;

  // Scroll the chart into view so the user can see their comparison happen.
  // Only nudge into view — if it's already visible we don't want a jarring jump.
  const rect = chartEl.getBoundingClientRect();
  const onScreen = rect.top >= 0 && rect.bottom <= window.innerHeight;
  if (!onScreen) {
    chartEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  const p = new URLSearchParams();
  if (currentMode === 'tags') p.set('tags', queries.join(','));
  else p.set('q', queries.join(','));
  if (currentGranularity !== 'monthly') p.set('g', currentGranularity);
  if (sectionId) p.set('s', sectionId);
  history.replaceState(null, '', `?${p.toString()}`);
}

// Year-on-year palette — enough for 11 years (2016-2026)
const YOY_PALETTE = [
  '#052962', '#C70000', '#22874d', '#6a2c8a', '#ed6f8b',
  '#b97b32', '#1a6fa0', '#d4351c', '#4a8e3b', '#9b59b6', '#e67e22',
];

function renderChart() {
  if (!currentSeries.length) return;

  const viewSeries = applyYearFilter(currentSeries);

  if (currentView === 'yoy') {
    renderYearOnYear();
  } else {
    chart.setGranularity(currentGranularity);
    chart.setSeries(viewSeries.map(s => ({ term: s.label, buckets: s.buckets, values: s.values, gapMask: s.gapMask })));
    renderLegend(currentSeries);
    renderChartTitle(currentSeries);
    resetReadingPanel();
  }
}

function renderYearOnYear() {
  // Take the first series only — YoY with multiple terms is too noisy.
  // The year-range filter clamps which years appear.
  const filteredSeries = applyYearFilter(currentSeries);
  const s = filteredSeries[0];
  if (!s) return;

  // Group buckets by year → within-year index
  // For monthly: bucket "2023-07" → year 2023, month index 6 (Jul = 6th month, 0-indexed)
  // For weekly: bucket "2023-W27" → year 2023, week index 26
  const yearData = new Map(); // year → { indices: [], values: [], counts: [] }

  for (let i = 0; i < s.buckets.length; i++) {
    const b = s.buckets[i];
    let year, withinYearIdx, maxWithin;

    if (/^\d{4}-\d{2}$/.test(b)) {
      // Monthly
      year = parseInt(b.slice(0, 4));
      withinYearIdx = parseInt(b.slice(5, 7)) - 1; // 0-11
      maxWithin = 12;
    } else if (/^\d{4}-W\d{2}$/.test(b)) {
      // Weekly
      const m = b.match(/^(\d{4})-W(\d{2})$/);
      year = parseInt(m[1]);
      withinYearIdx = parseInt(m[2]) - 1; // 0-51
      maxWithin = 53;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(b)) {
      // Daily — use day-of-year
      year = parseInt(b.slice(0, 4));
      const d = new Date(b + 'T00:00:00Z');
      const jan1 = new Date(Date.UTC(year, 0, 1));
      withinYearIdx = Math.floor((d - jan1) / 86400000);
      maxWithin = 366;
    } else continue;

    if (!yearData.has(year)) yearData.set(year, { values: [], indices: [], counts: [] });
    const yd = yearData.get(year);
    yd.indices.push(withinYearIdx);
    yd.values.push(s.values[i]);
    yd.counts.push(s.counts[i]);
  }

  // Build per-year series for the chart
  // X-axis: use labels like "Jan", "Feb", ... for monthly; "W1", "W2" for weekly
  const years = [...yearData.keys()].sort();
  const firstYear = yearData.get(years[0]);
  const maxIdx = Math.max(...[...yearData.values()].flatMap(yd => yd.indices));

  // Create bucket labels for the x-axis (use the within-year labels)
  const xLabels = [];
  if (currentGranularity === 'monthly') {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    for (let i = 0; i <= Math.min(maxIdx, 11); i++) xLabels.push(months[i]);
  } else if (currentGranularity === 'weekly') {
    for (let i = 0; i <= Math.min(maxIdx, 52); i++) xLabels.push(`W${i + 1}`);
  } else {
    for (let i = 0; i <= maxIdx; i++) xLabels.push(String(i + 1));
  }

  // Build chart series — one per year
  const chartSeries = years.map((year, yi) => {
    const yd = yearData.get(year);
    const fullValues = new Array(xLabels.length).fill(null);
    for (let j = 0; j < yd.indices.length; j++) {
      const idx = yd.indices[j];
      if (idx < fullValues.length) fullValues[idx] = yd.values[j];
    }
    return {
      term: String(year),
      buckets: xLabels,
      values: fullValues.map(v => v ?? 0),
    };
  });

  chart.setGranularity(currentGranularity);
  chart.setSeries(chartSeries, YOY_PALETTE);

  // Update legend and title for YoY mode
  legendEl.innerHTML = '';
  chartSeries.forEach((cs, i) => {
    const item = document.createElement('span');
    item.className = 'item';
    item.innerHTML = `<span class="swatch" style="background:${YOY_PALETTE[i % YOY_PALETTE.length]}"></span><span class="term">${cs.term}</span>`;
    item.addEventListener('mouseenter', () => chart.setActiveSeries(i));
    item.addEventListener('mouseleave', () => chart.setActiveSeries(null));
    legendEl.appendChild(item);
  });

  setChartTitle('headline', `"${s.label}" year on year — ${granularityAdverb()}`);
  resetReadingPanel();
}

function renderLegend(series) {
  legendEl.innerHTML = '';
  series.forEach((s, i) => {
    const item = document.createElement('span');
    item.className = 'item';
    item.innerHTML = `<span class="swatch" style="background:${PALETTE[i % PALETTE.length]}"></span><span class="term">${escapeHtml(s.label)}</span>`;
    item.addEventListener('mouseenter', () => chart.setActiveSeries(i));
    item.addEventListener('mouseleave', () => chart.setActiveSeries(null));
    legendEl.appendChild(item);
  });
}

function renderChartTitle(series) {
  if (!series.length) return;
  const phrases = series.map(s => currentMode === 'tags' ? s.label : `"${s.label}"`);
  const tail = granularityAdverb();
  const unit = currentMode === 'tags' ? 'Guardian coverage' : 'Guardian headlines';
  let str;
  if (phrases.length === 1) {
    str = `${phrases[0]} in ${unit}, ${tail}`;
  } else if (phrases.length === 2) {
    str = `${phrases[0]} versus ${phrases[1]} — ${unit}, ${tail}`;
  } else {
    str = `${phrases.slice(0, -1).join(', ')} and ${phrases.slice(-1)} — ${unit}, ${tail}`;
  }
  setChartTitle('headline', str);
}

function granularityAdverb() {
  return { monthly: 'month by month', weekly: 'week by week', daily: 'day by day' }[currentGranularity];
}

function updateReadingPanel(bucketIdx) {
  if (!currentSeries.length || !currentBuckets) return;
  risingPanelEl.hidden = true;
  const bucket = currentBuckets[bucketIdx];
  const periodTotal = currentTotals[bucketIdx];
  readingEyebrow.textContent = granularityEyebrow();
  readingMonth.classList.remove('idle');
  readingMonth.textContent = formatBucketLong(bucket);

  const rows = currentSeries
    .map((s, i) => {
      const count = s.counts[bucketIdx];
      const value = s.values[bucketIdx];
      const pct = periodTotal > 0 ? (count / periodTotal) * 100 : 0;
      const prev = bucketIdx > 0 ? s.values[bucketIdx - 1] : null;
      let delta = null;
      if (prev != null && prev > 0 && value > 0) {
        const change = ((value - prev) / prev) * 100;
        delta = Math.abs(change) < 5 ? null : { change, dir: change > 0 ? 'up' : 'down' };
      }
      return { label: s.label, value, count, pct, delta, color: PALETTE[i % PALETTE.length] };
    })
    .sort((a, b) => b.value - a.value);

  const noun = currentMode === 'tags' ? 'article' : 'headline';
  readingValues.innerHTML = rows.map(r => `
    <div class="value-row">
      <span class="rule" style="background:${r.color}"></span>
      <span class="term">${escapeHtml(r.label)}</span>
      <span class="num">${formatReadingValue(r.value)}</span>
      <span class="sub">
        <span class="meta">${formatCountPlain(r.count)} ${r.count === 1 ? noun : noun + 's'} · ${formatPct(r.pct)}</span>
        ${r.delta ? `<span class="delta ${r.delta.dir}">${r.delta.dir === 'up' ? '↑' : '↓'} ${Math.abs(r.delta.change).toFixed(0)}%</span>` : ''}
      </span>
    </div>
  `).join('');

  periodStatsEl.innerHTML = `
    <span class="big">${formatCountPlain(periodTotal)}</span>
    Guardian headlines ${periodWord()}
  `;
  readingCta.style.display = '';
}

function resetReadingPanel() {
  if (!currentSeries.length) {
    setReadingIdle('Hover the chart.');
    readingValues.innerHTML = '';
    periodStatsEl.innerHTML = '';
    readingCta.style.display = 'none';
    readingEyebrow.textContent = 'Reading panel';
    return;
  }
  // Active search — hide the rising panel
  risingPanelEl.hidden = true;
  readingEyebrow.textContent = 'Overview · hover for a period';
  readingMonth.classList.remove('idle');
  readingMonth.textContent = currentSeries.length === 1 ? currentSeries[0].label : 'Compare';

  const rows = currentSeries
    .map((s, i) => {
      const mean = s.values.reduce((a, b) => a + b, 0) / s.values.length;
      const total = s.counts.reduce((a, b) => a + b, 0);
      let peakIdx = 0;
      for (let k = 1; k < s.values.length; k++) if (s.values[k] > s.values[peakIdx]) peakIdx = k;
      return {
        label: s.label,
        value: mean,
        total,
        peakBucket: currentBuckets[peakIdx],
        color: PALETTE[i % PALETTE.length],
      };
    })
    .sort((a, b) => b.value - a.value);

  readingValues.innerHTML = rows.map(r => `
    <div class="value-row dim">
      <span class="rule" style="background:${r.color}"></span>
      <span class="term">${escapeHtml(r.label)}</span>
      <span class="num">${formatReadingValue(r.value)}</span>
      <span class="sub">
        <span class="meta">${formatCountPlain(r.total)} total · peak ${formatBucketShort(r.peakBucket)}</span>
      </span>
    </div>
  `).join('');

  const grandTotal = currentTotals.reduce((a, b) => a + b, 0);
  periodStatsEl.innerHTML = `
    <span class="big">${formatCount(grandTotal)}</span>
    Guardian headlines across view
  `;
  readingCta.style.display = '';
}

function setReadingIdle(text) {
  readingEyebrow.textContent = 'Reading panel';
  readingMonth.classList.add('idle');
  readingMonth.textContent = text;
  readingValues.innerHTML = '';
  periodStatsEl.innerHTML = '';
  readingCta.style.display = 'none';
  // Surface the rising lists when there's no active comparison
  showRisingPanel();
}

// ---------- Rising / trending ----------
let _risingLoaded = false;

async function showRisingPanel() {
  if (currentSeries.length) { risingPanelEl.hidden = true; return; }
  risingPanelEl.hidden = false;
  if (_risingLoaded) return;
  _risingLoaded = true;

  risingTagsListEl.innerHTML = '<li class="rising-loading">Loading…</li>';
  risingWordsListEl.innerHTML = '<li class="rising-loading">Loading…</li>';

  try {
    const [tagIdx, termIdx, catalog] = await Promise.all([
      loadTagIndex('weekly'),
      loadIndex('weekly'),
      loadTagCatalog(),
    ]);

    const risingTags = computeRising(tagIdx, { topK: 6 });
    const risingTerms = computeRising(termIdx, { topK: 6 });
    const catalogIndex = new Map(catalog.map(t => [t.id, t.name]));

    risingTagsListEl.innerHTML = risingTags.map(r => {
      const label = catalogIndex.get(r.key) || r.key.split('/').pop();
      const ratio = formatRatio(r.ratio);
      return `<li data-mode="tags" data-key="${escapeAttr(r.key)}" data-label="${escapeAttr(label)}">
        <span class="rising-label">${escapeHtml(label)}</span>
        <span class="rising-jump${ratio.flat ? ' flat' : ''}">${ratio.text}</span>
      </li>`;
    }).join('') || '<li class="rising-loading">Not enough data yet.</li>';

    risingWordsListEl.innerHTML = risingTerms.map(r => {
      const ratio = formatRatio(r.ratio);
      return `<li data-mode="words" data-key="${escapeAttr(r.key)}" data-label="${escapeAttr(r.key)}">
        <span class="rising-label">${escapeHtml(r.key)}</span>
        <span class="rising-jump${ratio.flat ? ' flat' : ''}">${ratio.text}</span>
      </li>`;
    }).join('') || '<li class="rising-loading">Not enough data yet.</li>';
  } catch (e) {
    console.error('rising panel failed', e);
    risingTagsListEl.innerHTML = '<li class="rising-loading">Couldn\u2019t load.</li>';
    risingWordsListEl.innerHTML = '';
  }
}

function formatRatio(r) {
  if (r >= 10) return { text: `× ${r.toFixed(0)}`, flat: false };
  if (r >= 2) return { text: `× ${r.toFixed(1)}`, flat: false };
  if (r >= 1.2) return { text: `+${Math.round((r - 1) * 100)}%`, flat: false };
  return { text: `+${Math.round((r - 1) * 100)}%`, flat: true };
}

// Click handler delegated on the lists (event delegation survives re-renders)
function attachRisingClickHandler() {
  const onClick = async (e) => {
    const li = e.target.closest('li[data-mode]');
    if (!li) return;
    const mode = li.dataset.mode;
    const key = li.dataset.key;
    const label = li.dataset.label;
    if (mode === 'tags') {
      if (currentMode !== 'tags') await setMode('tags');
      // Wait for catalog if needed, then seed input 1
      if (!tagCatalog) tagCatalog = await loadTagCatalog();
      inputs().forEach((inp, i) => {
        if (i === 0) {
          inp.value = label;
          inp.dataset.tagId = key;
        } else {
          inp.value = '';
          delete inp.dataset.tagId;
        }
      });
    } else {
      if (currentMode !== 'words') await setMode('words');
      inputs().forEach((inp, i) => {
        inp.value = i === 0 ? key : '';
      });
    }
    runSearch();
  };
  risingTagsListEl.addEventListener('click', onClick);
  risingWordsListEl.addEventListener('click', onClick);
}
function escapeAttr(s) { return escapeHtml(s); }

// Year-range slider: clamps the chart's visible date range after a search.
function initYearRange(sections) {
  if (!yearFromInput || !sections.months?.length) return;
  const years = sections.months.map(m => parseInt(m.slice(0, 4)));
  const minY = Math.min(...years);
  const maxY = Math.max(...years);
  [yearFromInput, yearToInput].forEach(el => { el.min = minY; el.max = maxY; });
  yearFromInput.value = minY;
  yearToInput.value = maxY;
  updateYearRangeDisplay();

  const onRange = () => {
    let from = parseInt(yearFromInput.value);
    let to = parseInt(yearToInput.value);
    if (from > to) {
      if (document.activeElement === yearFromInput) to = from;
      else from = to;
      yearFromInput.value = from;
      yearToInput.value = to;
    }
    yearFilter = (from === minY && to === maxY) ? null : { from, to };
    updateYearRangeDisplay();
    if (currentSeries.length) renderChart();
  };
  yearFromInput.addEventListener('input', onRange);
  yearToInput.addEventListener('input', onRange);
}

function updateYearRangeDisplay() {
  if (!yearFromDisplay) return;
  const from = parseInt(yearFromInput.value);
  const to = parseInt(yearToInput.value);
  yearFromDisplay.textContent = from;
  yearToDisplay.textContent = to;
  const min = parseInt(yearFromInput.min);
  const max = parseInt(yearFromInput.max);
  const span = Math.max(1, max - min);
  yearRangeFill.style.left = (((from - min) / span) * 100) + '%';
  yearRangeFill.style.right = ((1 - (to - min) / span) * 100) + '%';
}

// Returns currentSeries with buckets clipped to the selected year range.
function applyYearFilter(series) {
  if (!yearFilter) return series;
  const { from, to } = yearFilter;
  return series.map(s => {
    const keep = [];
    const bks = [];
    const vals = [];
    const cts = [];
    const gm = [];
    for (let i = 0; i < s.buckets.length; i++) {
      const y = parseInt(s.buckets[i].slice(0, 4));
      if (y >= from && y <= to) {
        keep.push(i);
        bks.push(s.buckets[i]);
        vals.push(s.values[i]);
        cts.push(s.counts[i]);
        gm.push(s.gapMask ? s.gapMask[i] : false);
      }
    }
    return { ...s, buckets: bks, values: vals, counts: cts, gapMask: gm, _keep: keep };
  });
}

async function fillDekStats(sections, meta) {
  const yearsEl = document.getElementById('dek-years');
  const headlinesEl = document.getElementById('dek-headlines');
  const tagsEl = document.getElementById('dek-tags');
  if (!yearsEl && !headlinesEl && !tagsEl) return;

  // Year span: first and last bucket in months
  if (sections.months && sections.months.length) {
    const firstYear = parseInt(sections.months[0].slice(0, 4));
    const lastYear = parseInt(sections.months[sections.months.length - 1].slice(0, 4));
    const span = lastYear - firstYear + 1;
    if (yearsEl) yearsEl.textContent = span < 1 ? 'this year' : `${span} years`;
  }
  // Headlines: round to nearest 10k for a cleaner read
  if (headlinesEl && meta.total_headlines) {
    const n = meta.total_headlines;
    let label;
    if (n >= 1_000_000) label = (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + ' million';
    else if (n >= 10_000) label = Math.round(n / 10_000) * 10 + ',000';
    else label = n.toLocaleString('en-GB');
    headlinesEl.textContent = label;
  }
  // Tags: load catalog lazily just for the count (small JSON already cached)
  if (tagsEl) {
    try {
      const cat = await loadTagCatalog();
      tagsEl.textContent = cat.length.toLocaleString('en-GB');
    } catch (_) {}
  }
}

function populateSectionFilter(sections) {
  // Sort by total volume desc; show pretty section names
  const entries = Object.entries(sections.sections || {})
    .map(([id, counts]) => ({ id, total: counts.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total);
  for (const { id, total } of entries) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = `${sectionLabel(id)}  (${formatCount(total)})`;
    sectionFilterEl.appendChild(opt);
  }
}

function granularityEyebrow() {
  return { monthly: 'This month', weekly: 'This week', daily: 'This day' }[currentGranularity];
}
function periodWord() {
  return { monthly: 'this month', weekly: 'this week', daily: 'this day' }[currentGranularity];
}

async function openHeadlines({ term: queryLabel, bucket, seriesIdx }) {
  // The TrendChart emits `term` = whatever label we passed as the series name.
  // We need the original query (word or tag id) to fetch headlines.
  const series = currentSeries[seriesIdx];
  if (!series) return;

  headlinesSection.hidden = false;
  const formatted = formatBucketLong(bucket);
  if (currentMode === 'tags') {
    headlinesTitle.innerHTML = `Articles tagged <em>${escapeHtml(series.label)}</em>, ${formatted}`;
  } else {
    headlinesTitle.innerHTML = `Headlines naming <em>${escapeHtml(series.label)}</em>, ${formatted}`;
  }
  headlinesMeta.textContent = 'Loading dispatches…';
  breakdownBarsEl.innerHTML = '';
  headlinesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const sectionId = sectionFilterEl.value || null;
  const list = sectionId
    ? await headlinesForKeyInBucketAndSection({
        kind: currentMode, key: series.query, bucket, sectionId,
      })
    : (currentMode === 'tags'
        ? await headlinesForTagInBucket(series.query, bucket)
        : await headlinesForTermInBucket(series.query, bucket));
  headlinesMeta.textContent = `${list.length} ${list.length === 1 ? 'headline' : 'headlines'} · rendered with Pretext`;
  renderSectionBreakdown(list);
  // Pass the display label as the highlighter for the headline explorer;
  // in tag mode there's no substring to highlight (but still pass nothing).
  const highlight = currentMode === 'tags' ? '' : series.query;
  explorer.render(list, highlight);
}

function renderSectionBreakdown(headlines) {
  if (!headlines.length) { breakdownEl.hidden = true; return; }
  breakdownEl.hidden = false;
  const counts = {};
  for (const h of headlines) {
    const s = h.s || 'other';
    counts[s] = (counts[s] || 0) + 1;
  }
  const total = headlines.length;
  const rows = Object.entries(counts)
    .map(([id, n]) => ({ id, n, pct: (n / total) * 100 }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 8);
  const maxPct = rows[0].pct;
  breakdownBarsEl.innerHTML = rows.map(r => {
    const label = sectionLabel(r.id);
    const col = sectionColorFor(r.id);
    const fillW = (r.pct / maxPct) * 100;
    return `
      <div class="breakdown-row">
        <div class="name">${escapeHtml(label)}</div>
        <div class="bar-track"><div class="bar-fill" style="background:${col}; width:${fillW.toFixed(1)}%"></div></div>
        <div class="num">${r.pct.toFixed(1)}% <span class="count">· ${r.n}</span></div>
      </div>
    `;
  }).join('');
}

// Imported for reuse; keeps main.js lean
import { sectionColor as sectionColorFor } from './sections.js';

// ----- helpers -----
function formatBucketLong(bucket) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(bucket)) {
    return new Date(bucket + 'T00:00:00Z').toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
    });
  }
  if (/^\d{4}-\d{2}$/.test(bucket)) {
    const [y, mo] = bucket.split('-').map(Number);
    return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }
  const m = bucket.match(/^(\d{4})-W(\d{2})$/);
  if (m) return `Week ${m[2]}, ${m[1]}`;
  return bucket;
}
function formatBucketShort(bucket) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(bucket)) {
    return new Date(bucket + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
  }
  if (/^\d{4}-\d{2}$/.test(bucket)) {
    const [y, mo] = bucket.split('-').map(Number);
    return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
  }
  const m = bucket.match(/^(\d{4})-W(\d{2})$/);
  if (m) return `wk ${m[2]} '${m[1].slice(2)}`;
  return bucket;
}
function formatCount(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}
function formatReadingValue(v) {
  if (v >= 10) return v.toFixed(1);
  if (v >= 1) return v.toFixed(2);
  return v.toFixed(3);
}
function formatPct(p) {
  if (p === 0) return '0%';
  if (p >= 10) return p.toFixed(0) + '%';
  if (p >= 1) return p.toFixed(1) + '%';
  return p.toFixed(2) + '%';
}
function formatCountPlain(n) {
  return n.toLocaleString('en-GB');
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

init();
