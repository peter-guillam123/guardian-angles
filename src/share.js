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
export async function composeChart({ chartCanvas, title, legendItems, url }) {
  await ensureFonts();

  const s = EXPORT_SCALE;
  const px = (n) => Math.round(n * s);
  const rect = chartCanvas.getBoundingClientRect();
  const LW = rect.width, LH = rect.height;

  // Layout, in logical px.
  const PAD = 26;
  const WORDMARK = 24, TITLE = 16, RULE_H = 5;
  const wordmarkBase = PAD + WORDMARK;
  const titleBase = wordmarkBase + 12 + TITLE;
  const ruleY = titleBase + 14;
  const HEADER_H = ruleY + RULE_H + 8;
  const LEGEND_H = 36;
  const FOOTER_H = 34;
  const totalLogicalH = HEADER_H + LEGEND_H + LH + FOOTER_H;

  const W = px(LW);
  const H = px(totalLogicalH);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.textBaseline = 'alphabetic';

  // Ground.
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  // Header: wordmark + title.
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

  // Legend.
  const legendY = px(HEADER_H);
  let lx = px(PAD);
  ctx.textBaseline = 'middle';
  for (const item of legendItems || []) {
    ctx.fillStyle = item.color;
    ctx.fillRect(lx, legendY + px(LEGEND_H / 2) - px(5), px(14), px(10));
    lx += px(20);
    ctx.fillStyle = INK;
    ctx.font = `400 ${px(13)}px ${SANS}`;
    ctx.fillText(item.label, lx, legendY + px(LEGEND_H / 2));
    lx += ctx.measureText(item.label).width + px(22);
  }
  ctx.textBaseline = 'alphabetic';

  // Chart (high-res pixel copy from the live canvas).
  const chartY = px(HEADER_H + LEGEND_H);
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
