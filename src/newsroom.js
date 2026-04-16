// Newsroom: stacked area chart of Guardian publishing volume by section.
// Uses sections.json (monthly counts per section, already built).

import { loadSections, loadShard, loadTagCatalog } from './data.js';
import { sectionLabel, sectionColor } from './sections.js';

let tagCatalogMap = null;  // tag id → display name, loaded on first drill-down

const TOP_N_SECTIONS = 15;   // named bands; rest merged into "Other"
const PADDING = { top: 20, right: 20, bottom: 38, left: 56 };

// A richer palette for 15+ sections — enough contrast to tell apart
const STACK_PALETTE = [
  '#052962', '#C70000', '#22874d', '#6a2c8a', '#ed6f8b', '#b97b32',
  '#1a6fa0', '#d4351c', '#4a8e3b', '#9b59b6', '#e67e22', '#2c3e50',
  '#16a085', '#c0392b', '#8e44ad', '#7f8c8d',
];

const state = {
  sections: null,     // raw sections.json
  months: [],
  totals: [],
  stacks: [],         // [{id, label, color, counts[], visible}]
  otherCounts: [],
  mode: 'absolute',   // 'absolute' | 'normalised'
  hoveredMonth: null,
  selectedMonth: null,
};

const chartEl = document.getElementById('nr-chart');
const ctx = chartEl.getContext('2d');
const legendEl = document.getElementById('nr-legend');
const drilldownEl = document.getElementById('nr-drilldown');
const drillTitleEl = document.getElementById('nr-drill-title');
const drillMetaEl = document.getElementById('nr-drill-meta');
const drillSectionsBarsEl = document.getElementById('nr-drill-sections-bars');
const drillTagsListEl = document.getElementById('nr-drill-tags-list');
const statBig = document.getElementById('stat-big');

let dpr = window.devicePixelRatio || 1;
let W = 0, H = 0;

init();

async function init() {
  const sections = await loadSections();
  state.sections = sections;
  state.months = sections.months;
  state.totals = sections.totals;

  const grandTotal = state.totals.reduce((a, b) => a + b, 0);
  if (statBig) statBig.textContent = formatCount(grandTotal);

  // Sort sections by total volume, pick top N, merge rest
  const entries = Object.entries(sections.sections)
    .map(([id, counts]) => ({ id, counts, total: counts.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total);

  const topEntries = entries.slice(0, TOP_N_SECTIONS);
  const restEntries = entries.slice(TOP_N_SECTIONS);

  state.stacks = topEntries.map((e, i) => ({
    id: e.id,
    label: sectionLabel(e.id),
    color: STACK_PALETTE[i % STACK_PALETTE.length],
    counts: e.counts,
    visible: true,
  }));

  // Merge the rest into "Other"
  const n = state.months.length;
  state.otherCounts = new Array(n).fill(0);
  for (const e of restEntries) {
    for (let i = 0; i < n; i++) state.otherCounts[i] += e.counts[i];
  }

  buildLegend();
  wireControls();
  resize();

  const ro = new ResizeObserver(() => resize());
  ro.observe(chartEl);
}

function resize() {
  const rect = chartEl.getBoundingClientRect();
  if (rect.width === 0) return;
  W = rect.width; H = rect.height;
  dpr = window.devicePixelRatio || 1;
  chartEl.width = Math.round(W * dpr);
  chartEl.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

// ----- Legend -----
function buildLegend() {
  legendEl.innerHTML = '';
  const allStacks = [...state.stacks, { id: '_other', label: 'Other', color: '#ccc', visible: true }];
  for (const s of allStacks) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nr-legend-item' + (s.visible ? ' active' : '');
    btn.dataset.id = s.id;
    btn.innerHTML = `<span class="nr-swatch" style="background:${s.color}"></span>${escHtml(s.label)}`;
    btn.addEventListener('click', () => {
      if (s.id === '_other') return; // can't toggle Other
      s.visible = !s.visible;
      btn.classList.toggle('active', s.visible);
      draw();
    });
    legendEl.appendChild(btn);
  }
}

// ----- Controls -----
function wireControls() {
  document.querySelectorAll('.nr-mode .mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.mode = btn.dataset.mode;
      document.querySelectorAll('.nr-mode .mode-btn').forEach(b => b.classList.toggle('active', b === btn));
      draw();
    });
  });

  chartEl.addEventListener('mousemove', onMove);
  chartEl.addEventListener('mouseleave', () => { state.hoveredMonth = null; draw(); });
  chartEl.addEventListener('click', onClick);
}

// ----- Stacked area drawing -----
function computeStacked() {
  const n = state.months.length;
  // Visible stacks + Other
  const layers = [];
  for (const s of state.stacks) {
    if (!s.visible) continue;
    layers.push({ id: s.id, label: s.label, color: s.color, counts: s.counts });
  }
  layers.push({ id: '_other', label: 'Other', color: '#ccc', counts: state.otherCounts });

  // Compute cumulative sums per month
  const cumulative = []; // cumulative[layerIdx][monthIdx] = top-of-band value
  const bases = new Array(n).fill(0);
  for (let li = 0; li < layers.length; li++) {
    const top = new Array(n);
    for (let mi = 0; mi < n; mi++) {
      top[mi] = bases[mi] + layers[li].counts[mi];
      bases[mi] = top[mi];
    }
    cumulative.push(top);
  }

  // In normalised mode, scale everything to [0, 1]
  const maxes = new Array(n);
  if (state.mode === 'normalised') {
    for (let mi = 0; mi < n; mi++) {
      const total = bases[mi] || 1;
      maxes[mi] = 1;
      for (let li = 0; li < cumulative.length; li++) {
        cumulative[li][mi] /= total;
      }
    }
  } else {
    for (let mi = 0; mi < n; mi++) maxes[mi] = bases[mi];
  }

  const yMax = state.mode === 'normalised' ? 1 : Math.max(...bases, 1);

  return { layers, cumulative, yMax };
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  const p = { x: PADDING.left, y: PADDING.top, w: W - PADDING.left - PADDING.right, h: H - PADDING.top - PADDING.bottom };
  if (p.w <= 0 || p.h <= 0) return;

  const n = state.months.length;
  const { layers, cumulative, yMax } = computeStacked();

  const xForIdx = (i) => p.x + (i / Math.max(1, n - 1)) * p.w;
  const yForVal = (v) => p.y + p.h - (v / yMax) * p.h;

  // Draw filled bands bottom-to-top
  for (let li = layers.length - 1; li >= 0; li--) {
    const bottom = li > 0 ? cumulative[li - 1] : new Array(n).fill(0);
    const top = cumulative[li];

    ctx.fillStyle = layers[li].color;
    ctx.globalAlpha = (state.hoveredMonth != null && state.hoveredMonth.layerIdx !== li) ? 0.5 : 0.85;
    ctx.beginPath();
    // Top edge left-to-right
    for (let mi = 0; mi < n; mi++) {
      const x = xForIdx(mi), y = yForVal(top[mi]);
      if (mi === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    // Bottom edge right-to-left
    for (let mi = n - 1; mi >= 0; mi--) {
      ctx.lineTo(xForIdx(mi), yForVal(bottom[mi]));
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Y-axis ticks
  drawYAxis(p, yMax);
  // X-axis years
  drawXAxis(p, n);
  // Hover crosshair
  drawHover(p, n, layers, cumulative, yMax);
}

function drawYAxis(p, yMax) {
  ctx.fillStyle = '#7a766e';
  ctx.strokeStyle = '#D0C4AE';
  ctx.lineWidth = 0.5;
  ctx.setLineDash([2, 3]);
  ctx.font = "11px 'GuardianTextSans', 'Helvetica Neue', Arial, sans-serif";
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const ticks = 4;
  for (let t = 0; t <= ticks; t++) {
    const v = (yMax * t) / ticks;
    const y = p.y + p.h - (v / yMax) * p.h;
    if (t > 0) {
      ctx.beginPath();
      ctx.moveTo(p.x, y);
      ctx.lineTo(p.x + p.w, y);
      ctx.stroke();
    }
    const label = state.mode === 'normalised'
      ? (v * 100).toFixed(0) + '%'
      : formatCountShort(v);
    ctx.fillText(label, p.x - 8, y);
  }
  ctx.setLineDash([]);
  // Baseline
  ctx.strokeStyle = '#3d3a35';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y + p.h);
  ctx.lineTo(p.x + p.w, p.y + p.h);
  ctx.stroke();
}

function drawXAxis(p, n) {
  ctx.fillStyle = '#3d3a35';
  ctx.font = "600 12px 'GuardianTextSans', 'Helvetica Neue', Arial, sans-serif";
  ctx.textBaseline = 'top';
  let lastYear = null;
  for (let i = 0; i < n; i++) {
    const y = state.months[i].slice(0, 4);
    if (y === lastYear) continue;
    lastYear = y;
    const x = p.x + (i / Math.max(1, n - 1)) * p.w;
    if (x - p.x < 20 || (p.x + p.w) - x < 30) continue;
    ctx.textAlign = 'center';
    ctx.fillText(y, x, p.y + p.h + 10);
  }
}

function drawHover(p, n, layers, cumulative, yMax) {
  if (state.hoveredMonth == null) return;
  const mi = state.hoveredMonth.monthIdx;
  const x = p.x + (mi / Math.max(1, n - 1)) * p.w;

  ctx.strokeStyle = '#121212';
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 0.75;
  ctx.setLineDash([1, 3]);
  ctx.beginPath();
  ctx.moveTo(x, p.y);
  ctx.lineTo(x, p.y + p.h);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Month pill
  ctx.fillStyle = '#121212';
  ctx.font = "600 11px 'GuardianTextSans', 'Helvetica Neue', Arial, sans-serif";
  ctx.textAlign = 'center';
  const label = formatMonthShort(state.months[mi]);
  const tw = ctx.measureText(label).width + 14;
  const lx = Math.max(p.x, Math.min(p.x + p.w - tw, x - tw / 2));
  ctx.fillRect(lx, p.y - 8 - 18, tw, 22);
  ctx.fillStyle = '#F4EFE6';
  ctx.fillText(label, lx + tw / 2, p.y - 8 - 3);
}

// ----- Mouse events -----
function onMove(e) {
  const rect = chartEl.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const p = { x: PADDING.left, y: PADDING.top, w: W - PADDING.left - PADDING.right, h: H - PADDING.top - PADDING.bottom };
  if (mx < p.x || mx > p.x + p.w) { state.hoveredMonth = null; draw(); return; }

  const n = state.months.length;
  const mi = Math.round((mx - p.x) / p.w * (n - 1));
  const clamped = Math.max(0, Math.min(n - 1, mi));

  // Find which layer the mouse is in
  const { layers, cumulative, yMax } = computeStacked();
  const yVal = ((p.y + p.h) - my) / p.h * yMax;
  let layerIdx = -1;
  for (let li = 0; li < cumulative.length; li++) {
    const bottom = li > 0 ? cumulative[li - 1][clamped] : 0;
    const top = cumulative[li][clamped];
    if (yVal >= bottom && yVal <= top) { layerIdx = li; break; }
  }

  state.hoveredMonth = { monthIdx: clamped, layerIdx };
  draw();
}

function onClick() {
  if (!state.hoveredMonth) return;
  state.selectedMonth = state.hoveredMonth.monthIdx;
  openDrilldown(state.months[state.selectedMonth]);
}

// ----- Drill-down -----
async function openDrilldown(month) {
  drilldownEl.hidden = false;
  const [y, m] = month.split('-').map(Number);
  const formatted = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const total = state.totals[state.months.indexOf(month)] || 0;
  drillTitleEl.textContent = formatted;
  drillMetaEl.textContent = `${total.toLocaleString('en-GB')} articles published`;
  drilldownEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Section bars
  const sectionCounts = {};
  for (const [id, counts] of Object.entries(state.sections.sections)) {
    const mi = state.months.indexOf(month);
    if (mi >= 0 && counts[mi] > 0) sectionCounts[id] = counts[mi];
  }
  const sectionRows = Object.entries(sectionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const maxSec = sectionRows[0]?.[1] || 1;
  drillSectionsBarsEl.innerHTML = sectionRows.map(([id, n]) => {
    const pct = (n / total) * 100;
    const fillW = (n / maxSec) * 100;
    return `<div class="breakdown-row">
      <div class="name">${escHtml(sectionLabel(id))}</div>
      <div class="bar-track"><div class="bar-fill" style="background:${sectionColor(id)}; width:${fillW.toFixed(1)}%"></div></div>
      <div class="num">${pct.toFixed(1)}% <span class="count">· ${n.toLocaleString('en-GB')}</span></div>
    </div>`;
  }).join('');

  // Top tags from the shard
  drillTagsListEl.innerHTML = '<li class="rising-loading">Loading tags…</li>';
  try {
    // Load tag catalog once for display names
    if (!tagCatalogMap) {
      const catalog = await loadTagCatalog();
      tagCatalogMap = new Map(catalog.map(t => [t.id, t.name]));
    }

    const shard = await loadShard(month);
    const tagCounts = {};
    for (const h of shard.headlines) {
      for (const t of (h.g || [])) tagCounts[t] = (tagCounts[t] || 0) + 1;
    }

    // Skip tone/* tags, section mega-tags (uk/uk), and structural noise
    const skipPrefixes = ['tone/', 'type/', 'publication/'];
    const isMegaTag = (id) => { const p = id.split('/'); return p.length === 2 && p[0] === p[1]; };

    const topTags = Object.entries(tagCounts)
      .filter(([id]) => !skipPrefixes.some(p => id.startsWith(p)) && !isMegaTag(id))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);

    drillTagsListEl.innerHTML = topTags.map(([id, n]) => {
      const name = tagCatalogMap.get(id) || slugToName(id);
      return `<li>
        <span class="nr-tag-name">${escHtml(name)}</span>
        <span class="nr-tag-count">${n.toLocaleString('en-GB')}</span>
      </li>`;
    }).join('');
  } catch (e) {
    drillTagsListEl.innerHTML = '<li class="rising-loading">Shard not available yet.</li>';
  }
}

function slugToName(slug) {
  const last = slug.split('/').pop();
  return last.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());
}

// ----- Helpers -----
function formatCount(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}
function formatCountShort(n) {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k';
  return String(Math.round(n));
}
function formatMonthShort(m) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, 15)).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}
function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
