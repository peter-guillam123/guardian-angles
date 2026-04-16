// This Week — auto-generated dashboard from the latest weekly data.

import { loadTagIndex, loadTagCatalog, loadShard } from './data.js';
import { sectionLabel } from './sections.js';

// Skip noise tags
const SKIP_PREFIXES = ['tone/', 'type/', 'publication/', 'tracking/'];
const isMegaTag = (id) => { const p = id.split('/'); return p.length === 2 && p[0] === p[1]; };
function isUseful(id) {
  return !SKIP_PREFIXES.some(p => id.startsWith(p)) && !isMegaTag(id);
}

const statBig = document.getElementById('stat-big');
const heroTitle = document.getElementById('tw-hero-title');
const heroMeta = document.getElementById('tw-hero-meta');
const heroStats = document.getElementById('tw-hero-stats');
const heroHeadline = document.getElementById('tw-hero-headline');
const heroSpark = document.getElementById('tw-hero-spark');
const heroKicker = document.getElementById('tw-kicker');
const risersList = document.getElementById('tw-risers');
const fallersList = document.getElementById('tw-fallers');
const historyGrid = document.getElementById('tw-history-grid');

init();

async function init() {
  const [idx, catalog] = await Promise.all([
    loadTagIndex('weekly'),
    loadTagCatalog(),
  ]);

  const catalogMap = new Map(catalog.map(t => [t.id, t.name]));
  const tagName = (id) => catalogMap.get(id) || slugToName(id);

  const buckets = idx.buckets;
  const totals = idx.totals;
  const tags = idx.tags;
  const n = buckets.length;

  // Use the second-to-last bucket as "this week" (last may be partial)
  const thisWeekIdx = n - 2;
  const thisWeek = buckets[thisWeekIdx];
  const thisWeekTotal = totals[thisWeekIdx];

  statBig.textContent = thisWeekTotal.toLocaleString('en-GB');
  heroKicker.textContent = `Story of the week · ${formatWeek(thisWeek)}`;

  // ----- Hero: biggest tag this week -----
  let heroTag = null, heroCount = 0;
  for (const [id, counts] of Object.entries(tags)) {
    if (!isUseful(id)) continue;
    if (counts[thisWeekIdx] > heroCount) {
      heroCount = counts[thisWeekIdx];
      heroTag = id;
    }
  }

  if (heroTag) {
    const name = tagName(heroTag);
    const pct = ((heroCount / thisWeekTotal) * 100).toFixed(1);
    heroTitle.textContent = name;

    // Find this tag's all-time peak week
    const counts = tags[heroTag];
    let peakIdx = 0;
    for (let i = 0; i < n; i++) if (counts[i] > counts[peakIdx]) peakIdx = i;
    const peakIsThisWeek = peakIdx === thisWeekIdx;

    heroMeta.textContent = `${heroCount.toLocaleString('en-GB')} articles · ${pct}% of all Guardian output this week`;

    // Stats block
    const prevWeekCount = counts[thisWeekIdx - 1] || 0;
    const weekChange = prevWeekCount > 0
      ? ((heroCount - prevWeekCount) / prevWeekCount * 100).toFixed(0)
      : '—';
    const allTimeTotal = counts.reduce((a, b) => a + b, 0);

    heroStats.innerHTML = `
      <div class="tw-stat">
        <span class="tw-stat-big">${weekChange > 0 ? '+' : ''}${weekChange}%</span>
        <span class="tw-stat-label">vs last week</span>
      </div>
      <div class="tw-stat">
        <span class="tw-stat-big">${peakIsThisWeek ? 'This week!' : formatWeek(buckets[peakIdx])}</span>
        <span class="tw-stat-label">${peakIsThisWeek ? 'All-time peak' : 'Previous peak'}</span>
      </div>
      <div class="tw-stat">
        <span class="tw-stat-big">${allTimeTotal.toLocaleString('en-GB')}</span>
        <span class="tw-stat-label">all-time articles</span>
      </div>
    `;

    // Sample headline from this week
    loadHeadlineForTag(heroTag, thisWeek, heroHeadline);

    // Sparkline
    drawSparkline(heroSpark, counts, thisWeekIdx);
  }

  // ----- Risers & fallers -----
  const BASELINE_WEEKS = 4;
  const baseStart = Math.max(0, thisWeekIdx - BASELINE_WEEKS - 1);
  const baseEnd = thisWeekIdx - 1;

  const movements = [];
  for (const [id, counts] of Object.entries(tags)) {
    if (!isUseful(id)) continue;
    const recent = counts[thisWeekIdx];
    let baseSum = 0, baseN = 0;
    for (let i = baseStart; i <= baseEnd; i++) { baseSum += counts[i]; baseN++; }
    const baseMean = baseSum / Math.max(1, baseN);
    if (recent < 3 && baseMean < 1) continue; // too small to matter
    const smoothing = 0.8;
    const ratio = (recent + smoothing) / (baseMean + smoothing);
    movements.push({ id, name: tagName(id), recent, baseMean, ratio });
  }

  // Risers (exclude the hero — it's already featured)
  const risers = movements
    .filter(m => m.id !== heroTag && m.recent >= 5)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 8);

  risersList.innerHTML = risers.map(m => `
    <li>
      <a class="tw-item-link" href="./?tags=${encodeURIComponent(m.id)}&g=weekly">
        <span class="tw-item-name">${esc(m.name)}</span>
        <span class="tw-item-meta">${m.recent} articles</span>
      </a>
      <span class="tw-badge tw-up">× ${m.ratio.toFixed(1)}</span>
    </li>
  `).join('');

  // Fallers
  const fallers = movements
    .filter(m => m.baseMean >= 8 && m.ratio < 0.7)
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 8);

  fallersList.innerHTML = fallers.map(m => `
    <li>
      <a class="tw-item-link" href="./?tags=${encodeURIComponent(m.id)}&g=weekly">
        <span class="tw-item-name">${esc(m.name)}</span>
        <span class="tw-item-meta">${m.recent} articles (was ${m.baseMean.toFixed(0)}/wk)</span>
      </a>
      <span class="tw-badge tw-down">× ${m.ratio.toFixed(2)}</span>
    </li>
  `).join('') || '<li class="tw-empty">Nothing dropped dramatically this week.</li>';

  // ----- "On this week in…" -----
  const weekNum = parseInt(thisWeek.split('-W')[1]);
  const years = [];
  for (let i = 0; i < n; i++) {
    const m = buckets[i].match(/^(\d{4})-W(\d{2})$/);
    if (m && parseInt(m[2]) === weekNum && i !== thisWeekIdx) {
      years.push({ year: m[1], idx: i });
    }
  }
  // Reverse so latest year first
  years.reverse();

  historyGrid.innerHTML = years.map(({ year, idx: wi }) => {
    // Find biggest tag this week
    let bestId = null, bestCount = 0;
    for (const [id, counts] of Object.entries(tags)) {
      if (!isUseful(id)) continue;
      if (counts[wi] > bestCount) { bestCount = counts[wi]; bestId = id; }
    }
    if (!bestId) return '';
    const name = tagName(bestId);
    const total = totals[wi];
    const pct = total > 0 ? ((bestCount / total) * 100).toFixed(1) : '0';
    return `
      <div class="tw-history-card">
        <span class="tw-history-year">${year}</span>
        <span class="tw-history-name">${esc(name)}</span>
        <span class="tw-history-stat">${bestCount} articles · ${pct}%</span>
      </div>
    `;
  }).join('');
}

// ----- Helpers -----

async function loadHeadlineForTag(tagId, weekBucket, container) {
  container.innerHTML = '<p class="tw-loading">Loading headline…</p>';
  try {
    // Figure out which monthly shard(s) this week touches
    const m = weekBucket.match(/^(\d{4})-W(\d{2})$/);
    if (!m) { container.innerHTML = ''; return; }
    const y = parseInt(m[1]), w = parseInt(m[2]);
    const monday = isoWeekMonday(y, w);
    const monthKey = monday.toISOString().slice(0, 7);
    const shard = await loadShard(monthKey);

    // Find articles tagged with this tag from this week
    const start = monday;
    const end = new Date(monday);
    end.setUTCDate(end.getUTCDate() + 7);

    const matched = shard.headlines.filter(h => {
      if (!Array.isArray(h.g) || !h.g.includes(tagId)) return false;
      const d = new Date(h.d);
      return d >= start && d < end;
    });

    if (matched.length === 0) { container.innerHTML = ''; return; }

    // Pick the first headline (usually the most recent in oldest-first order = last)
    const pick = matched[matched.length - 1];
    const url = pick.u ? `https://www.theguardian.com/${pick.u}` : null;
    const dateStr = new Date(pick.d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const section = sectionLabel(pick.s);

    container.innerHTML = `
      <p class="tw-headline-label">From this week's coverage</p>
      ${url
        ? `<a class="tw-headline-text" href="${esc(url)}" target="_blank" rel="noopener">${esc(pick.t)}</a>`
        : `<p class="tw-headline-text">${esc(pick.t)}</p>`
      }
      <p class="tw-headline-meta">${esc(section)} · ${dateStr}</p>
    `;
  } catch (e) {
    container.innerHTML = '';
  }
}

function drawSparkline(canvas, counts, highlightIdx) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const W = rect.width, H = rect.height;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const n = counts.length;
  const max = Math.max(...counts, 1);
  const pad = 4;

  // Area fill
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * W;
    const y = H - pad - (counts[i] / max) * (H - pad * 2);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fillStyle = 'rgba(5, 41, 98, 0.08)';
  ctx.fill();

  // Line
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * W;
    const y = H - pad - (counts[i] / max) * (H - pad * 2);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = '#052962';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Highlight dot
  const hx = (highlightIdx / (n - 1)) * W;
  const hy = H - pad - (counts[highlightIdx] / max) * (H - pad * 2);
  ctx.fillStyle = '#C70000';
  ctx.beginPath();
  ctx.arc(hx, hy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#F4EFE6';
  ctx.beginPath();
  ctx.arc(hx, hy, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function isoWeekMonday(y, w) {
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7;
  const mondayW1 = new Date(jan4);
  mondayW1.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1));
  const monday = new Date(mondayW1);
  monday.setUTCDate(mondayW1.getUTCDate() + (w - 1) * 7);
  return monday;
}

function formatWeek(bucket) {
  const m = bucket.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return bucket;
  const monday = isoWeekMonday(parseInt(m[1]), parseInt(m[2]));
  const sun = new Date(monday);
  sun.setUTCDate(sun.getUTCDate() + 6);
  const fmt = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${fmt(monday)} – ${fmt(sun)} ${m[1]}`;
}

function slugToName(slug) {
  const last = slug.split('/').pop();
  return last.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
