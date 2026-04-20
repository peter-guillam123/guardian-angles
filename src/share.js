// PNG export: composites chart + branding into a downloadable image.
//
// Renders an offscreen Canvas at 2x resolution with:
//   1. Guardian blue header bar with "Guardian Angles" + title
//   2. Legend row
//   3. The live chart (pixel-copied from the on-screen Canvas)
//   4. Footer with the page URL

const EXPORT_SCALE = 2;     // retina-quality export
const HEADER_H = 64;
const LEGEND_H = 36;
const FOOTER_H = 40;
const PAD = 24;

const BLUE = '#052962';
const YELLOW = '#FFE500';
const PAPER = '#F4EFE6';
const INK = '#121212';
const INK_MUTE = '#5f5c55';

export function exportChartAsPNG({ chartCanvas, title, legendItems, url }) {
  const chartW = chartCanvas.width;
  const chartH = chartCanvas.height;
  const dpr = EXPORT_SCALE;

  const totalW = chartW; // keep chart's buffer width (already DPR-scaled)
  const totalH = (HEADER_H + LEGEND_H + chartH / (chartCanvas.height / chartCanvas.getBoundingClientRect().height) + FOOTER_H) * dpr;

  // Use logical coords × dpr for everything
  const W = Math.round(chartCanvas.getBoundingClientRect().width * dpr);
  const H_header = HEADER_H * dpr;
  const H_legend = LEGEND_H * dpr;
  const H_chart = Math.round(chartCanvas.getBoundingClientRect().height * dpr);
  const H_footer = FOOTER_H * dpr;
  const H_total = H_header + H_legend + H_chart + H_footer;
  const pad = PAD * dpr;

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H_total;
  const ctx = c.getContext('2d');

  // Scale text consistently
  const s = dpr;

  // 1. Header bar
  ctx.fillStyle = BLUE;
  ctx.fillRect(0, 0, W, H_header);
  // Yellow rule at bottom of header
  ctx.fillStyle = YELLOW;
  ctx.fillRect(0, H_header - 4 * s, W * 0.33, 4 * s);
  ctx.fillStyle = BLUE;
  ctx.fillRect(W * 0.33, H_header - 4 * s, W * 0.67, 4 * s);
  // "Guardian Angles" text
  ctx.fillStyle = PAPER;
  ctx.font = `700 ${18 * s}px Georgia, 'Times New Roman', serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText('Guardian Angles', pad, H_header * 0.35);
  // Title
  ctx.font = `400 ${12 * s}px Georgia, serif`;
  ctx.fillStyle = 'rgba(244,239,230,0.85)';
  const maxTitleW = W - pad * 2 - 200 * s;
  ctx.fillText(truncate(title, ctx, maxTitleW), pad, H_header * 0.7);

  // 2. Legend row
  const legendY = H_header;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, legendY, W, H_legend);
  ctx.fillStyle = '#D0C4AE';
  ctx.fillRect(0, legendY + H_legend - 1, W, 1);

  let lx = pad;
  ctx.textBaseline = 'middle';
  for (const item of legendItems) {
    // Swatch
    ctx.fillStyle = item.color;
    ctx.fillRect(lx, legendY + (H_legend - 10 * s) / 2, 14 * s, 10 * s);
    lx += 18 * s;
    // Label
    ctx.fillStyle = INK;
    ctx.font = `400 ${11 * s}px 'Helvetica Neue', Arial, sans-serif`;
    ctx.fillText(item.label, lx, legendY + H_legend / 2);
    lx += ctx.measureText(item.label).width + 20 * s;
  }

  // 3. Chart (pixel copy from live canvas)
  const chartY = H_header + H_legend;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, chartY, W, H_chart);
  ctx.drawImage(chartCanvas, 0, 0, chartCanvas.width, chartCanvas.height, 0, chartY, W, H_chart);

  // 4. Footer
  const footerY = chartY + H_chart;
  ctx.fillStyle = '#E8DFD0';
  ctx.fillRect(0, footerY, W, H_footer);
  ctx.fillStyle = INK_MUTE;
  ctx.font = `400 ${9 * s}px 'Helvetica Neue', Arial, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(url || 'Guardian Angles — guardian-angles.com', pad, footerY + H_footer / 2);

  // Trigger download
  c.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const safeName = (title || 'guardian-angles').replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 60);
    a.download = `${safeName}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
}

function truncate(text, ctx, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 3 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}
