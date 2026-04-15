// "What's rising fastest" — for each top term/tag in a pre-built index,
// compare the recent N buckets to the prior baseline buckets and rank by
// how dramatically it's surged.
//
// We use the WEEKLY index by default — strikes a good balance between
// noise (daily) and slowness-to-react (monthly). On a fresh week, items
// that have spiked in the last 4 weeks vs the prior 12 weeks float to the top.
//
// Returns up to `topK` { key, label, lastValue, baselineValue, ratio } items.

const RECENT_BUCKETS = 4;
const BASELINE_BUCKETS = 12;
const MIN_RECENT_TOTAL = 12;   // must average ≥ 3 hits/week to even consider
const TOP_K = 8;

export function computeRising(indexPayload, opts = {}) {
  const recentN = opts.recent || RECENT_BUCKETS;
  const baselineN = opts.baseline || BASELINE_BUCKETS;
  const k = opts.topK || TOP_K;
  const minRecentTotal = opts.minRecentTotal || MIN_RECENT_TOTAL;

  const buckets = indexPayload.buckets;
  const totals = indexPayload.totals;
  const data = indexPayload.terms || indexPayload.tags;
  if (!data || !buckets || buckets.length < recentN + baselineN) return [];

  const n = buckets.length;
  const recentStart = n - recentN;
  const baselineStart = recentStart - baselineN;
  if (baselineStart < 0) return [];

  const recentTotalShare = sumPerMille(totals, recentStart, n);
  const baselineTotalShare = sumPerMille(totals, baselineStart, recentStart);

  const ranked = [];
  for (const key of Object.keys(data)) {
    const counts = data[key];
    let recent = 0, baseline = 0;
    let recentCount = 0, baselineCount = 0;
    for (let i = recentStart; i < n; i++) {
      const t = totals[i] || 0;
      if (t > 0) recent += (counts[i] / t) * 1000;
      recentCount += counts[i];
    }
    for (let i = baselineStart; i < recentStart; i++) {
      const t = totals[i] || 0;
      if (t > 0) baseline += (counts[i] / t) * 1000;
      baselineCount += counts[i];
    }
    const recentMean = recent / recentN;
    const baselineMean = baseline / baselineN;

    if (recentCount < minRecentTotal) continue;            // too rare to matter
    if (baselineMean === 0 && recentMean === 0) continue;  // nothing happening

    // ratio with smoothing: avoid divide-by-zero and don't overstate one-hit blips
    const smoothing = 0.5;  // per-mille — about half a hit per week share
    const ratio = (recentMean + smoothing) / (baselineMean + smoothing);

    ranked.push({
      key,
      recentMean,
      baselineMean,
      ratio,
      recentCount,
    });
  }

  ranked.sort((a, b) => b.ratio - a.ratio);
  return ranked.slice(0, k);
}

function sumPerMille(totals, start, end) {
  let s = 0;
  for (let i = start; i < end; i++) s += (totals[i] || 0);
  return s;
}
