// The company it keeps — Deep dive's per-year companion bump chart.
//
// Reads the co-occurrence index (build/build_cooccurrence.py) and draws,
// for the dived-on tag, its top companion tags ranked per year. Two
// rankings: "most distinctive" (lift vs the companion's overall share of
// that year's output — the editorial surprise) and "most articles" (raw
// shared counts — the stable view). Counts come from the index; the
// ranking opinion is computed here.
//
// Chart discipline per project memory: every redraw cancels the previous
// rAF chain; entrance animation is skipped under prefers-reduced-motion;
// the canvas carries role="img" + a descriptive aria-label; and the
// keyboard/screen-reader path is the real-link list under the chart, not
// the canvas itself.

import { loadCooccur, loadTagIndex, loadTagCatalog } from './data.js';

const MIN_SHARED = 5;          // display floor — index stores >=3 for headroom
const ROW_H = 34;
const PAD = { top: 18, bottom: 30, left: 14 };

const PALETTE = [
  '#052962', '#c70000', '#22874d', '#6a2c8a', '#1a6fa0',
  '#b97b32', '#ed6f8b', '#2c3e50', '#16a085', '#d4351c',
];

const wrap = document.getElementById('dd-company');
const canvas = document.getElementById('dd-company-canvas');
const tipEl = document.getElementById('dd-company-tip');
const nowEl = document.getElementById('dd-company-now');
const axisEl = document.getElementById('dd-company-axis');
const toggleBtns = wrap ? [...wrap.querySelectorAll('[data-co-mode]')] : [];
const ctx = canvas ? canvas.getContext('2d') : null;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const coarsePointer = window.matchMedia('(pointer: coarse)');

let _mode = 'distinctive';
let _current = null;   // { tagId, label, yearFrom, yearTo }
let _data = null;      // { co, idx, names }
let _model = null;     // computed series/layout model
let _hover = null;     // { seriesIdx, year } | null
let _rafId = 0;
let _renderToken = 0;
let _yearSumCache = new Map();   // tagId → Map(year → count)
let _totalsByYear = null;        // Map(year → total headlines)

// ───────────────────────── Public API ─────────────────────────

export async function renderCompany({ tagId, label, yearFrom, yearTo }) {
  if (!wrap) return;
  _current = { tagId, label, yearFrom, yearTo };
  const token = ++_renderToken;
  try {
    const [co, idx, catalog] = await Promise.all([
      loadCooccur(), loadTagIndex('monthly'), loadTagCatalog(),
    ]);
    if (token !== _renderToken) return;
    if (!_data || _data.co !== co) {
      _data = { co, idx, names: new Map(catalog.map(t => [t.id, t.name])) };
      _yearSumCache = new Map();
      _totalsByYear = null;
    }
    if (!co.tags[tagId]) { hideCompany(); return; }
    wrap.hidden = false;
    build();
  } catch (e) {
    // The block is an enrichment — if cooccur.json is missing (e.g. a
    // local clone that hasn't built it), the page works without it.
    console.error('company block unavailable:', e);
    hideCompany();
  }
}

export function hideCompany() {
  if (!wrap) return;
  wrap.hidden = true;
  cancelAnimationFrame(_rafId);
  _model = null;
  _hover = null;
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
  const { co } = _data;
  const { tagId, yearFrom, yearTo } = _current;
  const perYear = co.tags[tagId];
  const years = co.years.filter(y => y >= yearFrom && y <= yearTo);

  const topicSums = yearSumsFor(tagId);
  const totals = totalsByYear();

  // Score every companion in every visible year (no slicing yet).
  const ranked = new Map();   // year → [{ id, shared, lift, score }] desc
  for (const y of years) {
    const yi = co.years.indexOf(y);
    const entries = (perYear[yi] || [])
      .map(([ci, c]) => ({ id: co.ids[ci], shared: c }))
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
  // the Coutts year, I'm a Celebrity in the jungle year). Fifteen years
  // of "top 8 that year" with no cast cap is thirty one-season lines
  // and spaghetti; all-arcs with no wildcards loses the cameos that
  // make the chart worth reading.
  const CAST_N = L_isNarrow() ? 8 : 12;
  const WILDCARDS = L_isNarrow() ? 2 : 3;
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

  // Rank within the cast, per year — the classic bump-chart contract:
  // ordering among the companions shown, not among all 3,000 tags.
  const seriesMap = new Map();
  for (const y of years) {
    const present = ranked.get(y).filter(e => castIds.has(e.id));
    present.forEach((e, i) => {
      let s = seriesMap.get(e.id);
      if (!s) {
        s = { id: e.id, name: _data.names.get(e.id) || e.id, points: new Map(), weight: 0 };
        seriesMap.set(e.id, s);
      }
      s.points.set(y, {
        rank: i + 1,
        shared: e.shared,
        lift: e.lift,
        of: topicSums.get(y) || 0,  // topic's own article count that year — the tooltip's denominator
      });
      s.weight += e.shared;
    });
  }
  const series = [...seriesMap.values()]
    .sort((a, b) => Math.min(...a.points.keys()) - Math.min(...b.points.keys()) || b.weight - a.weight);
  series.forEach((s, i) => { s.color = PALETTE[i % PALETTE.length]; });

  // Rows = deepest rank actually used, so the chart has no empty floor.
  const rows = Math.max(1, ...series.flatMap(s => [...s.points.values()].map(p => p.rank)));
  // Scale anchor for line weight: the biggest shared count in the model.
  const maxShared = Math.max(1, ...series.flatMap(s => [...s.points.values()].map(p => p.shared)));
  _model = { years, series, rows, maxShared };
  _hover = null;
  if (tipEl) tipEl.hidden = true;
  if (axisEl) {
    axisEl.textContent = _mode === 'distinctive'
      ? 'Ranked by how distinctively they shared articles · thicker line = more shared'
      : 'Ranked by shared articles · thicker line = more shared';
  }
  renderNowLine();
  updateAria();
  startDraw();
}

// Line weight carries the magnitude that rank alone hides: a top rank
// earned on five shared articles in the topic's quietest year draws as
// a hairline; a 394-article partnership draws as a rope. sqrt so the
// mid-range stays differentiated.
function weightFor(shared) {
  return 1.25 + 5.5 * Math.sqrt(shared / _model.maxShared);
}
function dotFor(shared) {
  return 1.75 + 3 * Math.sqrt(shared / _model.maxShared);
}

// ───────────────────────── Canvas drawing ─────────────────────────

function cssVar(name, fallback) {
  const v = getComputedStyle(document.body).getPropertyValue(name).trim();
  return v || fallback;
}

function L_isNarrow() {
  return (canvas.parentElement.clientWidth || 600) < 560;
}

function layout() {
  const W = canvas.parentElement.clientWidth || 600;
  const narrow = W < 560;
  const gutter = narrow ? 96 : 150;
  const H = PAD.top + _model.rows * ROW_H + PAD.bottom;
  const x0 = PAD.left;
  const x1 = W - gutter;
  const n = _model.years.length;
  const xs = (yIdx) => n === 1 ? (x0 + x1) / 2 : x0 + (x1 - x0) * (yIdx / (n - 1));
  const ys = (rank) => PAD.top + (rank - 0.5) * ROW_H;
  return { W, H, x0, x1, gutter, narrow, xs, ys };
}

function startDraw() {
  cancelAnimationFrame(_rafId);
  if (reducedMotion.matches) { draw(1); return; }
  const t0 = performance.now();
  const DUR = 550;
  const tick = (now) => {
    const t = Math.min(1, (now - t0) / DUR);
    draw(t < 1 ? 1 - Math.pow(1 - t, 3) : 1);
    if (t < 1) _rafId = requestAnimationFrame(tick);
  };
  _rafId = requestAnimationFrame(tick);
}

function draw(progress) {
  if (!_model || wrap.hidden) return;
  const L = layout();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(L.W * dpr);
  canvas.height = Math.round(L.H * dpr);
  canvas.style.height = L.H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, L.W, L.H);

  const ink = cssVar('--ink', '#1a1a1a');
  const inkMute = cssVar('--ink-mute', '#757570');
  const uiFont = cssVar('--ui', 'sans-serif');
  const monoFont = cssVar('--mono', 'monospace');

  // Rank gridlines.
  ctx.save();
  ctx.strokeStyle = inkMute;
  ctx.globalAlpha = 0.18;
  ctx.setLineDash([2, 5]);
  for (let r = 1; r <= _model.rows; r++) {
    const y = L.ys(r);
    ctx.beginPath(); ctx.moveTo(L.x0, y); ctx.lineTo(L.x1, y); ctx.stroke();
  }
  ctx.restore();

  // Year ticks — first, last, and every other in between when they fit.
  ctx.fillStyle = inkMute;
  ctx.font = `10px ${monoFont}`;
  ctx.textAlign = 'center';
  const n = _model.years.length;
  const step = Math.max(1, Math.ceil(n / Math.floor((L.x1 - L.x0) / 48)));
  _model.years.forEach((y, i) => {
    if (i !== 0 && i !== n - 1 && i % step !== 0) return;
    const lbl = i === 0 ? String(y) : `'${String(y).slice(2)}`;
    ctx.fillText(lbl, L.xs(i), L.H - 10);
  });

  // The wipe: lines reveal left-to-right with the entrance animation.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, L.x0 + (L.W - L.x0) * progress, L.H);
  ctx.clip();

  const hoverId = _hover ? _model.series[_hover.seriesIdx]?.id : null;
  for (const s of _model.series) {
    const dim = hoverId && s.id !== hoverId;
    const boost = hoverId === s.id ? 0.75 : 0;
    ctx.globalAlpha = dim ? 0.18 : 1;
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Segment-by-segment so each stretch of line carries its own weight
    // (canvas strokes can't vary width along a single path). Pen lifts
    // over missing years.
    let prev = null;
    _model.years.forEach((y, i) => {
      const pt = s.points.get(y);
      if (!pt) { prev = null; return; }
      const x = L.xs(i), yy = L.ys(pt.rank);
      if (prev) {
        ctx.lineWidth = (weightFor(prev.pt.shared) + weightFor(pt.shared)) / 2 + boost;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(x, yy);
        ctx.stroke();
      }
      prev = { x, y: yy, pt };
    });

    // Dots, sized with the same scale.
    _model.years.forEach((y, i) => {
      const pt = s.points.get(y);
      if (!pt) return;
      ctx.beginPath();
      ctx.arc(L.xs(i), L.ys(pt.rank), dotFor(pt.shared) + boost, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.restore();

  // Labels. Final-year survivors live in the right gutter, vertically
  // nudged apart. Mid-chart deaths are labelled in place only if the
  // line lived two-plus years AND the spot is clear — one-season
  // companions stay anonymous until hovered, which is what the tooltip
  // is for. Without both rules the distinctive view drowns in type.
  ctx.font = `11px ${uiFont}`;
  const lastIdx = n - 1;
  const gutterLabels = [];
  const placed = [];   // accepted mid-chart label boxes for collision tests
  const midCandidates = [];
  for (const s of _model.series) {
    const liveYears = _model.years.filter(y => s.points.has(y));
    if (!liveYears.length) continue;
    const last = liveYears[liveYears.length - 1];
    const i = _model.years.indexOf(last);
    const pt = s.points.get(last);
    const dim = hoverId && s.id !== hoverId;
    if (i === lastIdx) {
      gutterLabels.push({ s, y: L.ys(pt.rank), dim });
    } else if (liveYears.length >= 2) {
      midCandidates.push({ s, x: L.xs(i), y: L.ys(pt.rank), dim, weight: s.weight });
    }
  }
  midCandidates.sort((a, b) => b.weight - a.weight);
  for (const c of midCandidates) {
    if (progress < 1 && c.x > L.x0 + (L.W - L.x0) * progress) continue;
    const collides = placed.some(p => Math.abs(p.x - c.x) < 84 && Math.abs(p.y - c.y) < 15);
    if (collides) continue;
    placed.push({ x: c.x, y: c.y - 9 });
    ctx.globalAlpha = c.dim ? 0.25 : 0.8;
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.fillText(truncate(c.s.name, L.narrow ? 14 : 20), c.x, c.y - 9);
  }
  gutterLabels.sort((a, b) => a.y - b.y);
  let prevY = -Infinity;
  for (const g of gutterLabels) {
    const y = Math.max(g.y, prevY + 13);
    prevY = y;
    ctx.globalAlpha = g.dim ? 0.25 : 1;
    ctx.fillStyle = g.s.color;
    ctx.textAlign = 'left';
    ctx.fillText(truncate(g.s.name, L.narrow ? 13 : 20), L.x1 + 10, y + 4);
  }
  ctx.globalAlpha = 1;
}

function truncate(s, max) {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

// ───────────────────────── Interaction ─────────────────────────

function hitTest(ev) {
  if (!_model) return null;
  const rect = canvas.getBoundingClientRect();
  const mx = ev.clientX - rect.left;
  const my = ev.clientY - rect.top;
  const L = layout();
  const n = _model.years.length;
  let yi = 0, best = Infinity;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(L.xs(i) - mx);
    if (d < best) { best = d; yi = i; }
  }
  const year = _model.years[yi];
  let found = null, foundDist = 12;
  _model.series.forEach((s, si) => {
    const pt = s.points.get(year);
    if (!pt) return;
    const d = Math.abs(L.ys(pt.rank) - my);
    if (d < foundDist) { foundDist = d; found = { seriesIdx: si, year }; }
  });
  return found;
}

function showTip(hit, ev) {
  const s = _model.series[hit.seriesIdx];
  const pt = s.points.get(hit.year);
  const liftStr = _mode === 'distinctive' && pt.lift >= 1.05
    ? ` · ×${pt.lift >= 10 ? Math.round(pt.lift) : pt.lift.toFixed(1)} vs typical`
    : '';
  // The denominator is what explains a "surge" in a quiet year: shared
  // 5 of 38 articles reads very differently from shared 5 of 600.
  const topic = truncate(_current.label || 'the topic', 18);
  tipEl.textContent = `${s.name} — shared ${pt.shared} of ${topic}'s ${pt.of} article${pt.of === 1 ? '' : 's'}, ${hit.year}${liftStr}`;
  tipEl.hidden = false;
  const stage = canvas.parentElement.getBoundingClientRect();
  const x = Math.min(ev.clientX - stage.left + 12, stage.width - tipEl.offsetWidth - 8);
  const y = ev.clientY - stage.top - 34;
  tipEl.style.left = Math.max(0, x) + 'px';
  tipEl.style.top = Math.max(0, y) + 'px';
}

if (canvas) {
  canvas.addEventListener('mousemove', (ev) => {
    if (!_model || wrap.hidden) return;
    const hit = hitTest(ev);
    const changed = JSON.stringify(hit) !== JSON.stringify(_hover);
    _hover = hit;
    canvas.style.cursor = hit && !coarsePointer.matches ? 'pointer' : '';
    if (hit) showTip(hit, ev); else tipEl.hidden = true;
    if (changed) { cancelAnimationFrame(_rafId); draw(1); }
  });
  canvas.addEventListener('mouseleave', () => {
    if (!_model) return;
    _hover = null;
    tipEl.hidden = true;
    cancelAnimationFrame(_rafId);
    draw(1);
  });
  canvas.addEventListener('click', () => {
    // On touch screens a tap is "show me the numbers", not navigation —
    // the link list under the chart is the touch path to a re-dive.
    if (coarsePointer.matches || !_hover || !_model) return;
    const s = _model.series[_hover.seriesIdx];
    const { yearFrom, yearTo } = _current;
    location.href = `./deepdive.html?tag=${encodeURIComponent(s.id)}&from=${yearFrom}&to=${yearTo}`;
  });

  const ro = new ResizeObserver(() => {
    if (_model && !wrap.hidden) { cancelAnimationFrame(_rafId); draw(1); }
  });
  ro.observe(canvas.parentElement);
}

toggleBtns.forEach(b => b.addEventListener('click', () => {
  const mode = b.dataset.coMode;
  if (mode === _mode) return;
  _mode = mode;
  toggleBtns.forEach(x => x.classList.toggle('active', x === b));
  if (_current && _data) build();
}));

// ───────────────────────── Accessible footer line ─────────────────────────

// The canvas is decoration for sighted mouse users; this line is the real
// keyboard / screen-reader / touch path. Final visible year's company as
// actual links into their own deep dives.
function renderNowLine() {
  const { series, years } = _model;
  const lastYear = years[years.length - 1];
  const current = series
    .filter(s => s.points.has(lastYear))
    .sort((a, b) => a.points.get(lastYear).rank - b.points.get(lastYear).rank)
    .slice(0, 5);
  if (!current.length) { nowEl.innerHTML = ''; return; }
  const { yearFrom, yearTo } = _current;
  nowEl.innerHTML = `In ${lastYear}: ` + current.map(s =>
    `<a class="dd-link" href="./deepdive.html?tag=${encodeURIComponent(s.id)}&from=${yearFrom}&to=${yearTo}">${escapeHtml(s.name)}</a>`
  ).join('<span class="dd-company-sep"> · </span>');
}

function updateAria() {
  const { series, years } = _model;
  const lastYear = years[years.length - 1];
  const firstYear = years[0];
  const top = series.filter(s => s.points.has(lastYear))
    .sort((a, b) => a.points.get(lastYear).rank - b.points.get(lastYear).rank)[0];
  const early = series.filter(s => s.points.has(firstYear))
    .sort((a, b) => a.points.get(firstYear).rank - b.points.get(firstYear).rank)[0];
  canvas.setAttribute('aria-label',
    `Bump chart of companion tags per year, ${firstYear} to ${lastYear}, ranked by ${_mode === 'distinctive' ? 'distinctiveness' : 'shared article count'}.` +
    (early ? ` Top companion in ${firstYear}: ${early.name}.` : '') +
    (top ? ` Top companion in ${lastYear}: ${top.name}.` : '') +
    ' The list after the chart links to each current companion.');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
