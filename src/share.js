// Chart image export — composites the live chart into a branded PNG that
// matches the site masthead (paper ground, navy "Guardian Angles" serif
// wordmark, the navy→yellow rule), then downloads it or copies it to the
// clipboard. The clipboard path is the one that matters for dropping a
// chart straight into an email or doc.
//
// Canvas does NOT trigger webfont loading, so we await the Guardian faces
// before drawing — otherwise the text silently falls back to Georgia.

const EXPORT_SCALE = 2;     // retina-quality export

const BLUE = '#052962';
const YELLOW = '#FFE500';
const PAPER = '#F4EFE6';
const PAPER_DEEP = '#E8DFD0';
const INK = '#121212';
const INK_MUTE = '#5f5c55';
const RULE = '#D0C4AE';

const DISPLAY = "'GH Guardian Headline', Georgia, 'Times New Roman', serif";
const SANS = "'GuardianTextSans', 'Helvetica Neue', Arial, sans-serif";
const MONO = "'JetBrains Mono', 'Menlo', monospace";

let _fontsReady = null;
function ensureFonts() {
  if (_fontsReady) return _fontsReady;
  const faces = [
    "700 24px 'GH Guardian Headline'",
    "400 16px 'GH Guardian Headline'",
    "400 13px 'GuardianTextSans'",
    "400 11px 'JetBrains Mono'",
  ];
  _fontsReady = Promise.all(
    faces.map(f => document.fonts.load(f).catch(() => {})),
  ).then(() => document.fonts.ready);
  return _fontsReady;
}

// Build the composited canvas (async: waits for fonts). Returns the canvas.
// The legend wraps to as many rows as it needs, so a 16-section Newsroom
// chart works as well as a one-line Trends comparison.
export async function composeChart({ chartCanvas, title, legendItems, url }) {
  await ensureFonts();

  const s = EXPORT_SCALE;
  const px = (n) => Math.round(n * s);
  const rect = chartCanvas.getBoundingClientRect();
  const LW = rect.width, LH = rect.height;

  const PAD = 26;
  const WORDMARK = 24, TITLE = 16, RULE_H = 5, FOOTER_H = 34;
  const wordmarkBase = PAD + WORDMARK;
  const titleBase = wordmarkBase + 12 + TITLE;
  const ruleY = titleBase + 14;
  const HEADER_H = ruleY + RULE_H + 8;
  const W = px(LW);
  const items = legendItems || [];

  // Lay the legend out into rows first (measuring on a throwaway ctx),
  // so the canvas can be sized to fit however many rows it needs.
  const SW = px(14), GAP = px(6), TRAIL = px(22), LINEH = px(22);
  const maxLegW = W - px(PAD) * 2;
  const mctx = document.createElement('canvas').getContext('2d');
  mctx.font = `400 ${px(13)}px ${SANS}`;
  const rows = [[]];
  let cursor = 0;
  for (const it of items) {
    const w = SW + GAP + mctx.measureText(it.label).width + TRAIL;
    if (cursor > 0 && cursor + w > maxLegW) { rows.push([]); cursor = 0; }
    rows[rows.length - 1].push({ it, x: cursor });
    cursor += w;
  }
  const legendH = items.length ? rows.length * LINEH + px(14) : px(8);

  const H = px(HEADER_H) + legendH + px(LH) + px(FOOTER_H);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  // Ground.
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  // Header: wordmark + title.
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = BLUE;
  ctx.font = `700 ${px(WORDMARK)}px ${DISPLAY}`;
  ctx.fillText('Guardian Angles', px(PAD), px(wordmarkBase));
  ctx.fillStyle = INK;
  ctx.font = `400 ${px(TITLE)}px ${DISPLAY}`;
  ctx.fillText(truncate(title || '', ctx, W - px(PAD) * 2), px(PAD), px(titleBase));

  // The navy→yellow rule, full bleed (the masthead's signature).
  ctx.fillStyle = BLUE;
  ctx.fillRect(0, px(ruleY), Math.round(W * 0.62), px(RULE_H));
  ctx.fillStyle = YELLOW;
  ctx.fillRect(Math.round(W * 0.62), px(ruleY), W - Math.round(W * 0.62), px(RULE_H));

  // Legend, wrapped.
  ctx.font = `400 ${px(13)}px ${SANS}`;
  ctx.textBaseline = 'middle';
  const legTop = px(HEADER_H) + px(10);
  rows.forEach((row, ri) => {
    const ly = legTop + ri * LINEH + LINEH / 2;
    for (const { it, x } of row) {
      const lx = px(PAD) + x;
      ctx.fillStyle = it.color;
      ctx.fillRect(lx, ly - px(5), SW, px(10));
      ctx.fillStyle = INK;
      ctx.fillText(it.label, lx + SW + GAP, ly);
    }
  });
  ctx.textBaseline = 'alphabetic';

  // Chart (high-res pixel copy from the live canvas).
  const chartY = px(HEADER_H) + legendH;
  ctx.drawImage(chartCanvas, 0, 0, chartCanvas.width, chartCanvas.height, 0, chartY, W, px(LH));

  // Footer: the shareable URL, in mono.
  const footerY = chartY + px(LH);
  ctx.fillStyle = PAPER_DEEP;
  ctx.fillRect(0, footerY, W, px(FOOTER_H));
  ctx.fillStyle = INK_MUTE;
  ctx.font = `400 ${px(11)}px ${MONO}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(truncate(url || 'guardian-angles.com', ctx, W - px(PAD) * 2),
    px(PAD), footerY + px(FOOTER_H / 2));

  // Hairline frame.
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  return c;
}

function toBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

function fileName(title) {
  return (title || 'guardian-angles').replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 60) + '.png';
}

function download(blob, title) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName(title);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export async function downloadChartImage(opts) {
  const blob = await toBlob(await composeChart(opts));
  download(blob, opts.title);
}

// Copy the PNG to the clipboard; falls back to a download where the
// browser won't allow image-clipboard writes (older Firefox, say).
// Returns 'copied' | 'downloaded'.
export async function copyChartImage(opts) {
  const blob = await toBlob(await composeChart(opts));
  try {
    if (!navigator.clipboard || !window.ClipboardItem) throw new Error('no clipboard image support');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return 'copied';
  } catch (e) {
    download(blob, opts.title);
    return 'downloaded';
  }
}

function truncate(text, ctx, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 3 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

// ── Shared share-tools cluster ──
// One implementation for every chart: copy image, download image, copy
// link. Each view calls attachShareTools(container, getOpts) where
// getOpts() returns { chartCanvas, title, legendItems, url } at click time.
const ICONS = {
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/></svg>',
};

export function attachShareTools(container, getOpts) {
  if (!container || container.dataset.shareWired) return;
  container.dataset.shareWired = '1';
  container.innerHTML =
    `<button type="button" class="icon-btn" data-act="copy" title="Copy chart image" aria-label="Copy chart image to clipboard">${ICONS.copy}</button>` +
    `<button type="button" class="icon-btn" data-act="download" title="Download chart image" aria-label="Download chart image">${ICONS.download}</button>` +
    `<button type="button" class="icon-btn" data-act="link" title="Copy link to this view" aria-label="Copy link to this view">${ICONS.link}</button>` +
    `<span class="visually-hidden" aria-live="polite"></span>`;
  const status = container.querySelector('[aria-live]');
  const flash = (b) => { b.classList.add('done'); setTimeout(() => b.classList.remove('done'), 1200); };

  container.querySelector('[data-act="copy"]').addEventListener('click', async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try {
      const r = await copyChartImage(getOpts());
      status.textContent = r === 'copied' ? 'Chart image copied to clipboard' : 'Chart image downloaded';
      flash(b);
    } catch { status.textContent = 'Could not create image'; }
    b.disabled = false;
  });
  container.querySelector('[data-act="download"]').addEventListener('click', async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try { await downloadChartImage(getOpts()); status.textContent = 'Chart image downloaded'; flash(b); }
    catch { status.textContent = 'Could not create image'; }
    b.disabled = false;
  });
  container.querySelector('[data-act="link"]').addEventListener('click', async (e) => {
    try { await navigator.clipboard.writeText(getOpts().url || location.href); status.textContent = 'Link copied'; flash(e.currentTarget); }
    catch { status.textContent = 'Could not copy link'; }
  });
}
