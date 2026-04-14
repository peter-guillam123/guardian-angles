// Headline explorer — editorial typography rendered on Canvas.
// Uses Pretext to pre-measure each headline so scroll never jumps.
// Entries reveal with a soft ink-fade rather than a typewriter — more
// dignified than the old machine-gun effect.

import { prepareWithSegments, layoutWithLines } from 'https://esm.sh/@chenglou/pretext@0.0.3';
import { sectionLabel, sectionColor } from './sections.js';

const HEADLINE_FONT = "500 22px/1.25 'GH Guardian Headline', Georgia, 'Times New Roman', serif";
const META_FONT     = "700 10px/1.3 'GuardianTextSans', 'Helvetica Neue', Arial, sans-serif";
const LINE_HEIGHT = 28;
const META_HEIGHT = 16;
const RULE_GAP = 18;
const ITEM_GAP = 22;
const LEFT_PAD = 28;
const RIGHT_PAD = 40;
const INK = '#121212';
const INK_MUTE = '#7a766e';
const PAPER_RULE = '#D0C4AE';
const HIGHLIGHT = '#FFE500';
const MAX_HEADLINES = 80;

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

function termRanges(text, term) {
  if (!term) return [];
  const lower = text.toLowerCase();
  const needle = term.toLowerCase();
  const ranges = [];
  let i = 0;
  while (true) {
    const idx = lower.indexOf(needle, i);
    if (idx === -1) break;
    ranges.push([idx, idx + needle.length]);
    i = idx + needle.length;
  }
  return ranges;
}

export class HeadlineExplorer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;
    this.items = [];
    this.term = '';
    this._raf = null;
    this._startTime = 0;

    const ro = new ResizeObserver(() => this._resize());
    ro.observe(canvas);
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    this.width = rect.width;
    this.canvas.width = Math.round(rect.width * this.dpr);
    this._layout();
  }

  async render(headlines, term) {
    this.term = term;
    this.headlines = headlines.slice(0, MAX_HEADLINES);
    await document.fonts.ready;
    this._startTime = performance.now();
    this._resize();
    this._animate();
  }

  _layout() {
    if (!this.headlines) return;
    const contentWidth = Math.max(280, this.width - LEFT_PAD - RIGHT_PAD);
    let y = 12;
    this.items = this.headlines.map((h, i) => {
      const prep = prepareWithSegments(h.t, HEADLINE_FONT);
      const { lines } = layoutWithLines(prep, contentWidth);
      const h_px = lines.length * LINE_HEIGHT;
      const item = {
        headline: h,
        lines,
        highlights: termRanges(h.t, this.term),
        y,
        height: META_HEIGHT + 6 + h_px + ITEM_GAP,
        revealDelay: i * 40,  // staggered ink-fade
      };
      y += item.height;
      return item;
    });
    const totalH = Math.max(160, y);
    this.canvas.height = Math.round(totalH * this.dpr);
    this.canvas.style.height = totalH + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this._draw();
  }

  _animate() {
    if (this._raf) cancelAnimationFrame(this._raf);
    const tick = () => {
      const elapsed = performance.now() - this._startTime;
      let allDone = true;
      for (const item of this.items) {
        const localT = Math.max(0, (elapsed - item.revealDelay) / 360);
        item.reveal = Math.min(1, localT);
        if (item.reveal < 1) allDone = false;
      }
      this._draw();
      if (!allDone) this._raf = requestAnimationFrame(tick);
    };
    tick();
  }

  _draw() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.canvas.height / this.dpr;
    ctx.clearRect(0, 0, w, h);

    for (const item of this.items) {
      const r = item.reveal ?? 1;
      ctx.globalAlpha = r;
      const yOffset = (1 - r) * 6;
      const baseY = item.y + yOffset;

      // rule above each item except the first
      if (item !== this.items[0]) {
        ctx.strokeStyle = PAPER_RULE;
        ctx.globalAlpha = r * 0.6;
        ctx.lineWidth = 0.75;
        ctx.beginPath();
        ctx.moveTo(LEFT_PAD, baseY - 12);
        ctx.lineTo(w - RIGHT_PAD, baseY - 12);
        ctx.stroke();
        ctx.globalAlpha = r;
      }

      // Meta line: section chip · date
      const section = item.headline.s || 'guardian';
      const col = sectionColor(section);
      ctx.font = META_FONT;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      // coloured section label
      ctx.fillStyle = col;
      const sectionName = sectionLabel(section).toUpperCase();
      ctx.fillText(sectionName, LEFT_PAD, baseY);
      const metrics = ctx.measureText(sectionName);
      // separator dot
      ctx.fillStyle = INK_MUTE;
      ctx.fillText(' · ', LEFT_PAD + metrics.width, baseY);
      const sepW = ctx.measureText(' · ').width;
      ctx.fillStyle = INK_MUTE;
      ctx.fillText(formatDate(item.headline.d).toUpperCase(), LEFT_PAD + metrics.width + sepW, baseY);

      // Headline lines
      ctx.font = HEADLINE_FONT;
      ctx.fillStyle = INK;
      for (let li = 0; li < item.lines.length; li++) {
        const line = item.lines[li];
        const ly = baseY + META_HEIGHT + 6 + li * LINE_HEIGHT;
        const lineStart = item.lines.slice(0, li).reduce((acc, l) => acc + l.text.length, 0);

        // Draw highlights first (behind text)
        for (const [a, b] of item.highlights) {
          const la = Math.max(a, lineStart) - lineStart;
          const lb = Math.min(b, lineStart + line.text.length) - lineStart;
          if (la >= lb) continue;
          const preW = ctx.measureText(line.text.slice(0, la)).width;
          const mW = ctx.measureText(line.text.slice(la, lb)).width;
          ctx.fillStyle = HIGHLIGHT;
          ctx.globalAlpha = r * 0.7;
          ctx.fillRect(LEFT_PAD + preW, ly + 2, mW, LINE_HEIGHT - 6);
          ctx.globalAlpha = r;
        }

        ctx.fillStyle = INK;
        ctx.fillText(line.text, LEFT_PAD, ly);
      }

      ctx.globalAlpha = 1;
    }
  }
}
