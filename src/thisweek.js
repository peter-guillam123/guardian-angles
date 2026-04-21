// This Week — auto-generated dashboard from the latest weekly data.

import { loadTagIndex, loadTagCatalog, loadShard } from './data.js';
import { sectionLabel } from './sections.js';
import { isUsefulTag as isUseful } from './skip-tags.js';
import { prepareWithSegments, layoutWithLines } from 'https://esm.sh/@chenglou/pretext@0.0.3';

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
const prevBtn = document.getElementById('tw-prev');
const nextBtn = document.getElementById('tw-next');

let _idx, _catalogMap, _tagName, _currentWeekIdx;
let _isFirstRender = true;

init();

async function init() {
  const [idx, catalog] = await Promise.all([
    loadTagIndex('weekly'),
    loadTagCatalog(),
  ]);

  _idx = idx;
  _catalogMap = new Map(catalog.map(t => [t.id, t.name]));
  _tagName = (id) => _catalogMap.get(id) || slugToName(id);

  const n = idx.buckets.length;

  // Pick the default week to show. We want the most recent *complete* week.
  // If the last bucket is still the current (in-progress) week, skip it → n-2.
  // If the last bucket is already in the past (Sunday has gone by), show it → n-1.
  const lastBucket = idx.buckets[n - 1];
  const defaultIdx = isBucketComplete(lastBucket) ? n - 1 : n - 2;

  // Check URL param for a specific week, otherwise use the default
  const params = new URLSearchParams(location.search);
  const weekParam = params.get('week');
  if (weekParam && idx.buckets.includes(weekParam)) {
    _currentWeekIdx = idx.buckets.indexOf(weekParam);
  } else {
    _currentWeekIdx = defaultIdx;
  }

  prevBtn.addEventListener('click', () => { goToWeek(_currentWeekIdx - 1); });
  nextBtn.addEventListener('click', () => { goToWeek(_currentWeekIdx + 1); });
  document.getElementById('tw-random')?.addEventListener('click', () => {
    // Time machine: jump to a random complete week.
    const n = _idx.buckets.length;
    const maxInclusive = isBucketComplete(_idx.buckets[n - 1]) ? n - 1 : n - 2;
    const rand = Math.floor(Math.random() * (maxInclusive + 1));
    goToWeek(rand);
  });

  // Delegated click handler on history grid — click a year card to jump to it
  historyGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.tw-history-card[data-week]');
    if (!card) return;
    const weekKey = card.dataset.week;
    const wi = _idx.buckets.indexOf(weekKey);
    if (wi >= 0) goToWeek(wi);
  });

  renderWeek(_currentWeekIdx);
}

function goToWeek(newIdx) {
  const n = _idx.buckets.length;
  // Upper bound is n-1 if that bucket is complete, otherwise n-2 (skip partial).
  const maxIdx = isBucketComplete(_idx.buckets[n - 1]) ? n - 1 : n - 2;
  if (newIdx < 0 || newIdx > maxIdx) return;
  _currentWeekIdx = newIdx;
  _isFirstRender = false; // skip typewriter on navigation
  renderWeek(newIdx);
  // Update URL without reload
  const p = new URLSearchParams();
  p.set('week', _idx.buckets[newIdx]);
  history.replaceState(null, '', `?${p.toString()}`);
}

function renderWeek(weekIdx) {
  const idx = _idx;
  const tagName = _tagName;
  const buckets = idx.buckets;
  const totals = idx.totals;
  const tags = idx.tags;
  const n = buckets.length;

  const thisWeekIdx = weekIdx;
  const thisWeek = buckets[thisWeekIdx];
  const thisWeekTotal = totals[thisWeekIdx];

  // Update nav button states
  const maxIdx = isBucketComplete(buckets[n - 1]) ? n - 1 : n - 2;
  prevBtn.disabled = thisWeekIdx <= 0;
  nextBtn.disabled = thisWeekIdx >= maxIdx;

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
    if (_isFirstRender) {
      typewriterTitle(heroTitle, name);
    } else {
      heroTitle.textContent = name;
      heroTitle.style.visibility = '';
      heroTitle.style.height = '';
      // Remove any leftover typewriter overlay — scoped to its dedicated
      // class so we don't accidentally nuke the sparkline canvas, which
      // also lives in this section.
      const oldCanvas = heroTitle.parentElement.querySelector('canvas.tw-typewriter-canvas');
      if (oldCanvas) oldCanvas.remove();
    }

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
      <div class="tw-history-card" data-week="${esc(buckets[wi])}" title="Jump to this week">
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
  // If the canvas hasn't laid out yet (0 width) or we have no data,
  // bail rather than leave stale paint from a previous week.
  if (W === 0 || H === 0 || !counts || !counts.length) {
    canvas.width = 0; canvas.height = 0;
    return;
  }
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const n = counts.length;
  const max = Math.max(...counts, 1);
  const pad = 4;
  // A vertical axis mark on the highlighted week so you can always see
  // *where you are* in history, even when the tag's value is tiny at
  // that week relative to its all-time peak (which is the case for any
  // tag picked as "biggest" in an older week whose peak is now).
  const hx = (highlightIdx / Math.max(1, n - 1)) * W;
  ctx.strokeStyle = 'rgba(199, 0, 0, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(hx, pad); ctx.lineTo(hx, H - pad);
  ctx.stroke();

  // Map a count to y. Tiny values get lifted off the axis so the shape
  // is still legible when the whole series is dwarfed by one peak.
  const MIN_LIFT = 0.5; // px above the baseline for any non-zero count
  const yFor = (c) => {
    const raw = (c / max) * (H - pad * 2);
    const lifted = c > 0 ? Math.max(raw, MIN_LIFT) : 0;
    return H - pad - lifted;
  };

  // Area fill
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * W;
    if (i === 0) ctx.moveTo(x, yFor(counts[i])); else ctx.lineTo(x, yFor(counts[i]));
  }
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fillStyle = 'rgba(5, 41, 98, 0.14)';
  ctx.fill();

  // Line
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * W;
    if (i === 0) ctx.moveTo(x, yFor(counts[i])); else ctx.lineTo(x, yFor(counts[i]));
  }
  ctx.strokeStyle = '#052962';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Highlight dot — sits on the curve at the current week.
  const hy = yFor(counts[highlightIdx]);
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

// Returns true if the given "YYYY-Www" bucket has fully ended — i.e. its
// Sunday is in the past. Used to decide whether the last bucket in the
// index is a just-finished week (show it) or the in-progress one (skip it).
function isBucketComplete(bucket) {
  const m = (bucket || '').match(/^(\d{4})-W(\d{2})$/);
  if (!m) return false;
  const monday = isoWeekMonday(parseInt(m[1]), parseInt(m[2]));
  const endOfSunday = new Date(monday);
  endOfSunday.setUTCDate(endOfSunday.getUTCDate() + 7); // next Monday 00:00
  return Date.now() >= endOfSunday.getTime();
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

// Pretext-powered teleprinter: types the hero title character by character
// on a Canvas that sits over the <h2>, then swaps to real DOM text at the
// end so it remains selectable / accessible.
async function typewriterTitle(el, text) {
  await document.fonts.ready;

  const style = getComputedStyle(el);
  const fontSize = parseInt(style.fontSize) || 48;
  const fontWeight = style.fontWeight || '700';
  const fontFamily = style.fontFamily || "Georgia, serif";
  const fontStr = `${fontWeight} ${fontSize}px/0.95 ${fontFamily}`;
  const color = style.color || '#121212';

  // Measure with Pretext
  const prepared = prepareWithSegments(text, fontStr);
  const containerW = el.parentElement?.clientWidth || el.clientWidth || 600;
  const { lines } = layoutWithLines(prepared, containerW);
  const lineH = Math.round(fontSize * 1.0);
  const totalH = lines.length * lineH + 8;

  // Create canvas overlay. The class lets renderWeek's cleanup on
  // subsequent navigations target this canvas specifically and not
  // accidentally remove the sibling sparkline canvas in the hero.
  const canvas = document.createElement('canvas');
  canvas.className = 'tw-typewriter-canvas';
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = containerW + 'px';
  canvas.style.height = totalH + 'px';
  canvas.style.display = 'block';
  canvas.width = Math.round(containerW * dpr);
  canvas.height = Math.round(totalH * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Hide real text, show canvas in its place
  el.style.visibility = 'hidden';
  el.style.height = totalH + 'px';
  el.textContent = text; // set for accessibility / final swap
  el.parentElement.insertBefore(canvas, el);

  // Build a flat array of characters with their positions
  const chars = [];
  lines.forEach((line, li) => {
    const y = li * lineH + fontSize * 0.85;
    // Measure each character's x offset
    let x = 0;
    for (const ch of line.text) {
      chars.push({ ch, x, y });
      // Advance x by measuring the char width
      ctx.font = fontStr;
      x += ctx.measureText(ch).width;
    }
  });

  // Animate: reveal N chars per frame, with a blinking cursor
  const CHARS_PER_FRAME = 2;
  let revealed = 0;
  const startTime = performance.now();

  function draw() {
    ctx.clearRect(0, 0, containerW, totalH);
    ctx.font = fontStr;
    ctx.fillStyle = color;
    ctx.textBaseline = 'alphabetic';

    for (let i = 0; i < revealed && i < chars.length; i++) {
      ctx.fillText(chars[i].ch, chars[i].x, chars[i].y);
    }

    // Blinking cursor at the leading edge
    if (revealed < chars.length) {
      const cur = chars[Math.min(revealed, chars.length - 1)];
      const elapsed = performance.now() - startTime;
      if ((elapsed / 400) % 1 < 0.6) {
        const cx = revealed < chars.length ? chars[revealed].x : cur.x + ctx.measureText(cur.ch).width;
        ctx.fillStyle = '#052962';
        ctx.fillRect(cx + 1, cur.y - fontSize * 0.75, 3, fontSize * 0.85);
      }
    }
  }

  return new Promise(resolve => {
    function tick() {
      revealed += CHARS_PER_FRAME;
      draw();
      if (revealed >= chars.length) {
        // Final frame: show all chars, then swap to DOM
        draw();
        setTimeout(() => {
          canvas.remove();
          el.style.visibility = '';
          el.style.height = '';
          resolve();
        }, 300);
        return;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}
