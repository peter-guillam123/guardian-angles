// Entry: wires search → chart → reading panel → headline explorer + section breakdown.

import {
  loadIndex, loadSections, loadMeta,
  queryTerm, headlinesForTermInBucket, normalisePerMille,
} from './data.js';
import { TrendChart, PALETTE } from './chart.js';
import { HeadlineExplorer } from './headlines.js';
import { sectionLabel, sectionColor } from './sections.js';

const MAX_TERMS = 4;

const chartEl = document.getElementById('chart');
const headlinesEl = document.getElementById('headlines');
const headlinesSection = document.getElementById('headlines-section');
const headlinesTitle = document.getElementById('headlines-title');
const headlinesMeta = document.getElementById('headlines-meta');
const legendEl = document.getElementById('legend');
const chartTitleEl = document.getElementById('chart-title');
const form = document.getElementById('search-form');
const clearBtn = document.getElementById('clear-btn');
const readingMonth = document.getElementById('reading-month');
const readingValues = document.getElementById('reading-values');
const statBig = document.getElementById('stat-big');
const breakdownEl = document.getElementById('breakdown');
const breakdownBarsEl = document.getElementById('breakdown-bars');

const chart = new TrendChart(chartEl);
const explorer = new HeadlineExplorer(headlinesEl);

let currentTerms = [];
let currentSeries = [];       // [{term, buckets, values}]
let currentGranularity = 'monthly';
let currentTotals = null;     // totals array aligned with buckets
let currentBuckets = null;

async function init() {
  setReadingIdle('Loading the archive…');

  try {
    const [sections, meta] = await Promise.all([loadSections(), loadMeta()]);
    if (statBig) statBig.textContent = formatCount(meta.total_headlines);
  } catch (e) {
    setReadingIdle('Could not load data. Has the build run yet?');
    console.error(e);
    return;
  }

  setReadingIdle('Hover the chart.');

  // Example links
  document.querySelectorAll('.examples a[data-query]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const terms = a.dataset.query.split(',');
      for (let i = 0; i < MAX_TERMS; i++) {
        document.getElementById(`q${i + 1}`).value = terms[i] || '';
      }
      runSearch(terms);
    });
  });

  // Granularity buttons
  document.querySelectorAll('.gran-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const g = btn.dataset.granularity;
      if (g === currentGranularity) return;
      document.querySelectorAll('.gran-btn').forEach(b => b.classList.toggle('active', b === btn));
      currentGranularity = g;
      if (currentTerms.length) runSearch(currentTerms);
    });
  });

  // Chart events
  chart.addEventListener('pointclick', (e) => openHeadlines(e.detail.term, e.detail.bucket));
  chart.addEventListener('hover', (e) => {
    if (e.detail) updateReadingPanel(e.detail.idx);
    else resetReadingPanel();
  });

  // URL ?q=term1,term2&g=weekly
  const params = new URLSearchParams(location.search);
  const qParam = params.get('q');
  const gParam = params.get('g');
  if (gParam && ['monthly', 'weekly', 'daily'].includes(gParam)) {
    currentGranularity = gParam;
    document.querySelectorAll('.gran-btn').forEach(b => b.classList.toggle('active', b.dataset.granularity === gParam));
  }
  if (qParam) {
    const terms = qParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, MAX_TERMS);
    for (let i = 0; i < MAX_TERMS; i++) {
      document.getElementById(`q${i + 1}`).value = terms[i] || '';
    }
    if (terms.length) runSearch(terms);
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const terms = [];
  for (let i = 1; i <= MAX_TERMS; i++) {
    const v = document.getElementById(`q${i}`).value.trim();
    if (v) terms.push(v);
  }
  runSearch(terms);
});

clearBtn.addEventListener('click', () => {
  for (let i = 1; i <= MAX_TERMS; i++) document.getElementById(`q${i}`).value = '';
  chart.setSeries([]);
  legendEl.innerHTML = '';
  chartTitleEl.textContent = 'Type a word — or four — to plot a decade of Guardian coverage.';
  headlinesSection.hidden = true;
  currentTerms = [];
  currentSeries = [];
  resetReadingPanel();
  history.replaceState(null, '', location.pathname);
});

async function runSearch(terms) {
  if (!terms.length) return;
  currentTerms = terms;
  setReadingIdle('Searching the archive…');

  const results = await Promise.all(terms.map(t => queryTerm(t, currentGranularity)));
  const valid = results.filter(Boolean);
  if (!valid.length) { setReadingIdle('No results.'); return; }

  currentBuckets = valid[0].buckets;
  currentTotals = valid[0].totals;
  currentSeries = valid.map(r => ({
    term: r.term,
    buckets: r.buckets,
    values: normalisePerMille(r.counts, r.totals),
    counts: r.counts,
  }));

  chart.setGranularity(currentGranularity);
  chart.setSeries(currentSeries);
  renderLegend(currentSeries);
  renderChartTitle(currentSeries);
  resetReadingPanel();

  const p = new URLSearchParams();
  p.set('q', terms.join(','));
  if (currentGranularity !== 'monthly') p.set('g', currentGranularity);
  history.replaceState(null, '', `?${p.toString()}`);
}

function renderLegend(series) {
  legendEl.innerHTML = '';
  series.forEach((s, i) => {
    const item = document.createElement('span');
    item.className = 'item';
    item.innerHTML = `<span class="swatch" style="background:${PALETTE[i % PALETTE.length]}"></span><span class="term">${escapeHtml(s.term)}</span>`;
    item.addEventListener('mouseenter', () => chart.setActiveSeries(i));
    item.addEventListener('mouseleave', () => chart.setActiveSeries(null));
    legendEl.appendChild(item);
  });
}

function renderChartTitle(series) {
  if (!series.length) return;
  const phrases = series.map(s => `"${s.term}"`);
  let str;
  if (phrases.length === 1) str = `${phrases[0]} in Guardian headlines, ${granularityAdverb()}`;
  else if (phrases.length === 2) str = `${phrases[0]} versus ${phrases[1]}, ${granularityAdverb()}`;
  else str = `${phrases.slice(0, -1).join(', ')} and ${phrases.slice(-1)} — Guardian headlines, ${granularityAdverb()}`;
  chartTitleEl.textContent = str;
}

function granularityAdverb() {
  return { monthly: 'month by month', weekly: 'week by week', daily: 'day by day' }[currentGranularity];
}

function updateReadingPanel(bucketIdx) {
  if (!currentSeries.length || !currentBuckets) return;
  const bucket = currentBuckets[bucketIdx];
  readingMonth.classList.remove('idle');
  readingMonth.textContent = formatBucketLong(bucket);

  const rows = currentSeries
    .map((s, i) => ({ term: s.term, value: s.values[bucketIdx], count: s.counts[bucketIdx], color: PALETTE[i % PALETTE.length] }))
    .sort((a, b) => b.value - a.value);

  readingValues.innerHTML = rows.map(r => `
    <div class="value-row">
      <span class="rule" style="background:${r.color}"></span>
      <span class="term">${escapeHtml(r.term)}</span>
      <span class="num">${formatReadingValue(r.value)}</span>
    </div>
  `).join('');
}

function resetReadingPanel() {
  if (!currentSeries.length) {
    setReadingIdle('Hover the chart.');
    readingValues.innerHTML = '';
    return;
  }
  readingMonth.classList.remove('idle');
  readingMonth.textContent = currentSeries.length === 1 ? `"${currentSeries[0].term}"` : 'Compare';
  const rows = currentSeries
    .map((s, i) => {
      const mean = s.values.reduce((a, b) => a + b, 0) / s.values.length;
      return { term: s.term, value: mean, color: PALETTE[i % PALETTE.length] };
    })
    .sort((a, b) => b.value - a.value);
  readingValues.innerHTML = rows.map(r => `
    <div class="value-row dim">
      <span class="rule" style="background:${r.color}"></span>
      <span class="term">${escapeHtml(r.term)}</span>
      <span class="num">${formatReadingValue(r.value)}</span>
    </div>
  `).join('');
}

function setReadingIdle(text) {
  readingMonth.classList.add('idle');
  readingMonth.textContent = text;
  readingValues.innerHTML = '';
}

async function openHeadlines(term, bucket) {
  headlinesSection.hidden = false;
  headlinesTitle.innerHTML = `Headlines naming <em>${escapeHtml(term)}</em>, ${formatBucketLong(bucket)}`;
  headlinesMeta.textContent = 'Loading dispatches…';
  breakdownBarsEl.innerHTML = '';
  headlinesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const list = await headlinesForTermInBucket(term, bucket);
  headlinesMeta.textContent = `${list.length} headline${list.length === 1 ? '' : 's'} · rendered with Pretext`;
  renderSectionBreakdown(list);
  explorer.render(list, term);
}

function renderSectionBreakdown(headlines) {
  if (!headlines.length) {
    breakdownEl.hidden = true;
    return;
  }
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
    const col = sectionColor(r.id);
    const fillW = (r.pct / maxPct) * 100; // scale so tallest = 100% width
    return `
      <div class="breakdown-row">
        <div class="name">${escapeHtml(label)}</div>
        <div class="bar-track"><div class="bar-fill" style="background:${col}; width:${fillW.toFixed(1)}%"></div></div>
        <div class="num">${r.pct.toFixed(1)}% <span class="count">· ${r.n}</span></div>
      </div>
    `;
  }).join('');
}

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
  if (m) {
    const [y, w] = [parseInt(m[1]), parseInt(m[2])];
    return `Week ${w}, ${y}`;
  }
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
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

init();
