// Canvas line chart — "newsroom dataroom" aesthetic.
// Handles monthly / weekly / daily bucket series. Emits hover + click DOM
// events so the parent can update the reading panel and open the explorer.

const PALETTE = ['#052962', '#C70000', '#22874d', '#6a2c8a'];
const PAPER = '#F4EFE6';
const PAPER_RULE = '#D0C4AE';
const INK = '#121212';
const INK_SOFT = '#3d3a35';
const INK_MUTE = '#5f5c55';

const AXIS_FONT = "11px 'GuardianTextSans', 'Helvetica Neue', Arial, sans-serif";
const YEAR_FONT = "600 12px 'GuardianTextSans', 'Helvetica Neue', Arial, sans-serif";
const PILL_FONT = "600 11px 'GuardianTextSans', 'Helvetica Neue', Arial, sans-serif";

// Padding varies by viewport width — mobile needs more right space so the
// last axis label ("Apr 2026") doesn't clip at the edge.
function paddingForWidth(w) {
  if (w < 500) return { top: 28, right: 36, bottom: 38, left: 40 };
  return { top: 28, right: 20, bottom: 38, left: 52 };
}

function niceMax(v) {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

function bucketToDate(b) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(b)) return new Date(b + 'T00:00:00Z');
  if (/^\d{4}-\d{2}$/.test(b)) {
    const [y, m] = b.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, 15));
  }
  const m = b.match(/^(\d{4})-W(\d{2})$/);
  if (m) {
    const y = parseInt(m[1]), w = parseInt(m[2]);
    const jan4 = new Date(Date.UTC(y, 0, 4));
    const jan4Dow = jan4.getUTCDay() || 7;
    const mondayW1 = new Date(jan4);
    mondayW1.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1));
    const monday = new Date(mondayW1);
    monday.setUTCDate(mondayW1.getUTCDate() + (w - 1) * 7);
    return monday;
  }
  return new Date(NaN);
}

// Detailed label for the hover pill
function formatPill(b) {
  const d = bucketToDate(b);
  if (/^\d{4}-\d{2}-\d{2}$/.test(b)) {
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  if (/^\d{4}-\d{2}$/.test(b)) {
    return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  }
  const m = b.match(/^(\d{4})-W(\d{2})$/);
  if (m) {
    // Show the Monday of that week — e.g. "Wk of 25 Aug 2025"
    const monday = bucketToDate(b);
    return `Wk of ${monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }
  return b;
}

// Compact label for the rightmost tick on the x-axis.
// Always a month-year regardless of granularity — avoids the ugly
// "Wk 35 · 2025" and confusion over whether it means "today".
function formatAxisEnd(b) {
  const d = bucketToDate(b);
  if (isNaN(d)) return b;
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

function formatValue(v) {
  if (v >= 10) return v.toFixed(0);
  if (v >= 1) return v.toFixed(1);
  return v.toFixed(2);
}

export class TrendChart extends EventTarget {
  constructor(canvas) {
    super();
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;
    this.series = [];
    this.granularity = 'monthly';
    this.hoveredIdx = null;
    this.activeSeries = null;
    this.drawProgress = 1;
    this._animStart = 0;
    this._rafId = 0;    // id of the current entrance-animation RAF — cancelled before starting a new one
    this._cachedMaxVal = 0;

    canvas.addEventListener('mousemove', (e) => this._onMove(e));
    canvas.addEventListener('mouseleave', () => { this.hoveredIdx = null; this._emitHover(); this.draw(); });
    canvas.addEventListener('click', () => this._onClick());

    const ro = new ResizeObserver(() => this._resize());
    ro.observe(canvas);
    this._resize();
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.draw();
  }

  setGranularity(g) { this.granularity = g; }

  setSeries(series, palette) {
    const pal = palette || PALETTE;
    this.series = series.map((s, i) => ({ ...s, color: pal[i % pal.length] }));
    // Pre-compute the y-axis max so draw() doesn't re-flatten all series
    // on every RAF tick. On daily granularity that was ~20k-element
    // allocations per frame which added up quickly.
    let maxVal = 0.001;
    for (const s of this.series) {
      for (const v of s.values) if (v > maxVal) maxVal = v;
    }
    this._cachedMaxVal = maxVal;
    this._animStart = performance.now();
    this.drawProgress = 0;
    this._animate();
  }

  setActiveSeries(idx) { this.activeSeries = idx; this.draw(); }

  _animate() {
    const DUR = 700;
    // Cancel any in-flight entrance-animation RAF chain before starting a
    // new one. Without this, rapid setSeries calls (e.g. hammering "I
    // feel lucky") accumulated one RAF chain per click, each calling
    // draw() at 60fps — a real memory-and-CPU leak that occasionally
    // crashed mobile Chrome.
    if (this._rafId) cancelAnimationFrame(this._rafId);
    const tick = () => {
      const t = Math.min(1, (performance.now() - this._animStart) / DUR);
      this.drawProgress = 1 - Math.pow(1 - t, 3);
      this.draw();
      this._rafId = t < 1 ? requestAnimationFrame(tick) : 0;
    };
    this._rafId = requestAnimationFrame(tick);
  }

  _plot() {
    const P = paddingForWidth(this.width);
    return {
      x: P.left,
      y: P.top,
      w: this.width - P.left - P.right,
      h: this.height - P.top - P.bottom,
    };
  }

  _xForIdx(i, n, r) { return n <= 1 ? r.x : r.x + (i / (n - 1)) * r.w; }
  _yForVal(v, yMax, r) { return r.y + r.h - (v / yMax) * r.h; }

  _onMove(e) {
    if (!this.series.length) return;
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const p = this._plot();
    if (mx < p.x || mx > p.x + p.w || my < p.y || my > p.y + p.h) {
      if (this.hoveredIdx !== null) { this.hoveredIdx = null; this._emitHover(); this.draw(); }
      return;
    }
    const buckets = this.series[0].buckets;
    const i = Math.round((mx - p.x) / p.w * (buckets.length - 1));
    const clamped = Math.max(0, Math.min(buckets.length - 1, i));
    let bestS = 0, bestDist = Infinity;
    for (let s = 0; s < this.series.length; s++) {
      const y = this._yForVal(this.series[s].values[clamped], this._yMax, p);
      const d = Math.abs(y - my);
      if (d < bestDist) { bestDist = d; bestS = s; }
    }
    this.hoveredIdx = { s: bestS, m: clamped };
    this._emitHover();
    this.draw();
  }

  _onClick() {
    if (!this.hoveredIdx) return;
    const { s, m } = this.hoveredIdx;
    const series = this.series[s];
    this.dispatchEvent(new CustomEvent('pointclick', {
      detail: { term: series.term, bucket: series.buckets[m], seriesIdx: s },
    }));
  }

  _emitHover() {
    this.dispatchEvent(new CustomEvent('hover', {
      detail: this.hoveredIdx
        ? { idx: this.hoveredIdx.m, bucket: this.series[0].buckets[this.hoveredIdx.m] }
        : null,
    }));
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    if (!this.series.length) { this._drawEmpty(); return; }

    const p = this._plot();
    const buckets = this.series[0].buckets;
    const yMax = niceMax(this._cachedMaxVal || 0.001);
    this._yMax = yMax;

    this._drawGrid(p, yMax);
    this._drawYears(p, buckets);
    this._drawLines(p, buckets, yMax);
    this._drawHover(p, buckets, yMax);
  }

  _drawEmpty() {
    const ctx = this.ctx;
    const p = this._plot();
    ctx.strokeStyle = PAPER_RULE;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + p.h);
    ctx.lineTo(p.x + p.w, p.y + p.h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = INK_MUTE;
    ctx.font = "italic 15px 'GuardianTextEgyptian', Georgia, serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Waiting for a search…', p.x + p.w / 2, p.y + p.h / 2);
  }

  _drawGrid(p, yMax) {
    const ctx = this.ctx;
    ctx.strokeStyle = PAPER_RULE;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 3]);
    const nTicks = 4;
    ctx.fillStyle = INK_MUTE;
    ctx.font = AXIS_FONT;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let t = 0; t <= nTicks; t++) {
      const v = (yMax * t) / nTicks;
      const y = this._yForVal(v, yMax, p);
      if (t > 0) {
        ctx.beginPath();
        ctx.moveTo(p.x, y);
        ctx.lineTo(p.x + p.w, y);
        ctx.stroke();
      }
      ctx.fillText(formatValue(v), p.x - 8, y);
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = INK_SOFT;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + p.h);
    ctx.lineTo(p.x + p.w, p.y + p.h);
    ctx.stroke();
  }

  _drawYears(p, buckets) {
    const ctx = this.ctx;
    ctx.fillStyle = INK_SOFT;
    ctx.strokeStyle = INK_SOFT;
    ctx.font = YEAR_FONT;
    ctx.textBaseline = 'top';

    // Find indices at which the year starts (first bucket each year)
    const yearStarts = [];
    let lastYear = null;
    for (let i = 0; i < buckets.length; i++) {
      const y = buckets[i].slice(0, 4);
      if (y !== lastYear) { yearStarts.push({ i, y }); lastYear = y; }
    }

    // Decide how many labels to skip based on available px per year,
    // and whether to use the short two-digit format. Copied from
    // newsroom.js so both charts label consistently at any width.
    const pxPerYear = p.w / Math.max(1, yearStarts.length);
    const step = pxPerYear < 34 ? 2 : 1;
    const useShort = pxPerYear < 38;
    const formatYr = (y) => useShort ? `'${y.slice(2)}` : y;

    // Reserve space on the LEFT edge for the first bucket's short-label
    // and a sensible gap on the right so the final tick doesn't overrun.
    const firstLabelWidth = ctx.measureText(formatYr(buckets[0].slice(0, 4))).width;
    const GAP = 12;
    const leftReserved = p.x + firstLabelWidth + GAP;
    const rightReserved = (p.x + p.w) - GAP;

    for (let idx = 0; idx < yearStarts.length; idx++) {
      if (idx % step !== 0 && idx !== yearStarts.length - 1) continue;
      const { i, y } = yearStarts[idx];
      const label = formatYr(y);
      const x = this._xForIdx(i, buckets.length, p);
      const yearW = ctx.measureText(label).width;
      if (x - yearW / 2 < leftReserved) continue;
      if (x + yearW / 2 > rightReserved) continue;
      ctx.beginPath();
      ctx.moveTo(x, p.y + p.h);
      ctx.lineTo(x, p.y + p.h + 5);
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillText(label, x, p.y + p.h + 10);
    }

    // First bucket: left-aligned label in the same format as the rest
    const firstX = this._xForIdx(0, buckets.length, p);
    ctx.beginPath();
    ctx.moveTo(firstX, p.y + p.h);
    ctx.lineTo(firstX, p.y + p.h + 5);
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillText(formatYr(buckets[0].slice(0, 4)), firstX, p.y + p.h + 10);

    // Last bucket: small tick mark only. The "updated Xm ago" line in the
    // masthead already signals how fresh the right edge is, so a labelled
    // end-point ("Apr 2026") just clutters the axis.
    const lastIdx = buckets.length - 1;
    const lastX = this._xForIdx(lastIdx, buckets.length, p);
    ctx.beginPath();
    ctx.moveTo(lastX, p.y + p.h);
    ctx.lineTo(lastX, p.y + p.h + 5);
    ctx.stroke();
  }

  _drawLines(p, buckets, yMax) {
    const ctx = this.ctx;
    const progress = this.drawProgress;
    const drawUpTo = Math.floor(buckets.length * progress);
    const lastPartial = buckets.length * progress - drawUpTo;
    const isDense = buckets.length > 300;  // daily

    for (let sIdx = 0; sIdx < this.series.length; sIdx++) {
      const s = this.series[sIdx];
      const isDim = this.activeSeries != null && this.activeSeries !== sIdx;
      const isActive = this.activeSeries === sIdx || this.activeSeries == null;

      ctx.strokeStyle = s.color;
      ctx.globalAlpha = isDim ? 0.18 : 1;
      ctx.lineWidth = this.activeSeries === sIdx ? 2.8 : (isDense ? 1.4 : 2.2);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const gm = s.gapMask;
      let penDown = false;
      for (let i = 0; i <= drawUpTo && i < buckets.length; i++) {
        if (gm && gm[i]) { penDown = false; continue; }
        const x = this._xForIdx(i, buckets.length, p);
        const y = this._yForVal(s.values[i], yMax, p);
        if (!penDown) { ctx.moveTo(x, y); penDown = true; }
        else ctx.lineTo(x, y);
      }
      if (drawUpTo < buckets.length - 1 && lastPartial > 0) {
        const a = drawUpTo, b = drawUpTo + 1;
        const xa = this._xForIdx(a, buckets.length, p);
        const ya = this._yForVal(s.values[a], yMax, p);
        const xb = this._xForIdx(b, buckets.length, p);
        const yb = this._yForVal(s.values[b], yMax, p);
        ctx.lineTo(xa + (xb - xa) * lastPartial, ya + (yb - ya) * lastPartial);
      }
      ctx.stroke();

      // Terminal dot (only meaningful at monthly/weekly)
      if (progress >= 1 && !isDense) {
        const lastX = this._xForIdx(buckets.length - 1, buckets.length, p);
        const lastY = this._yForVal(s.values[buckets.length - 1], yMax, p);
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(lastX, lastY, this.activeSeries === sIdx ? 4.5 : 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PAPER;
        ctx.beginPath();
        ctx.arc(lastX, lastY, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  _drawHover(p, buckets, yMax) {
    if (!this.hoveredIdx) return;
    const ctx = this.ctx;
    const { m } = this.hoveredIdx;
    const x = this._xForIdx(m, buckets.length, p);

    ctx.strokeStyle = INK;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 0.75;
    ctx.setLineDash([1, 4]);
    ctx.beginPath();
    ctx.moveTo(x, p.y);
    ctx.lineTo(x, p.y + p.h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    for (let sIdx = 0; sIdx < this.series.length; sIdx++) {
      const s = this.series[sIdx];
      const y = this._yForVal(s.values[m], yMax, p);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = INK;
    ctx.font = PILL_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const label = formatPill(buckets[m]);
    const pad = 8;
    const lw = ctx.measureText(label).width + pad * 2;
    const lx = Math.max(p.x, Math.min(p.x + p.w - lw, x - lw / 2));
    const ly = p.y - 8;
    ctx.fillStyle = INK;
    ctx.fillRect(lx, ly - 18, lw, 22);
    ctx.fillStyle = PAPER;
    ctx.fillText(label, lx + lw / 2, ly - 3);
  }
}

export { PALETTE };
