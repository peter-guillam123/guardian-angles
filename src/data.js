// Data loader: term indexes per granularity, sections, and lazy shard fetch.
// Everything is static JSON in /data/, loaded on demand.

const DATA_BASE = './data';

// granularity → cached Promise of { buckets, totals, terms }
const _indexPromises = {};
let _sectionsPromise = null;
let _metaPromise = null;
const _shardCache = new Map();

async function fetchJsonMaybeGz(url) {
  try {
    const res = await fetch(url + '.gz');
    if (res.ok) {
      const ds = new DecompressionStream('gzip');
      const stream = res.body.pipeThrough(ds);
      const text = await new Response(stream).text();
      return JSON.parse(text);
    }
  } catch (e) { /* fall through */ }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.json();
}

export function loadIndex(granularity = 'monthly') {
  if (!_indexPromises[granularity]) {
    _indexPromises[granularity] = fetchJsonMaybeGz(
      `${DATA_BASE}/term-index-${granularity}.json`,
    );
  }
  return _indexPromises[granularity];
}

export function loadSections() {
  if (!_sectionsPromise) {
    _sectionsPromise = fetch(`${DATA_BASE}/sections.json`).then(r => r.json());
  }
  return _sectionsPromise;
}

export function loadMeta() {
  if (!_metaPromise) {
    _metaPromise = fetch(`${DATA_BASE}/meta.json`).then(r => r.json());
  }
  return _metaPromise;
}

export async function loadShard(month) {
  if (_shardCache.has(month)) return _shardCache.get(month);
  const p = fetchJsonMaybeGz(`${DATA_BASE}/shards/${month}.json`);
  _shardCache.set(month, p);
  return p;
}

// Bucket key → month key so we know which shard to load for headlines
//   "2024-07"      → "2024-07"
//   "2024-07-15"   → "2024-07"
//   "2024-W27"     → iso-week start's month, handled separately
function bucketToMonths(bucket) {
  if (/^\d{4}-\d{2}$/.test(bucket)) return [bucket];
  if (/^\d{4}-\d{2}-\d{2}$/.test(bucket)) return [bucket.slice(0, 7)];
  // ISO week: compute Mon + Sun and collect months they touch
  const m = bucket.match(/^(\d{4})-W(\d{2})$/);
  if (m) {
    const [y, w] = [parseInt(m[1]), parseInt(m[2])];
    const monday = isoWeekMonday(y, w);
    const sunday = new Date(monday);
    sunday.setUTCDate(sunday.getUTCDate() + 6);
    const a = monday.toISOString().slice(0, 7);
    const b = sunday.toISOString().slice(0, 7);
    return a === b ? [a] : [a, b];
  }
  return [];
}

// Monday of ISO week y-w
function isoWeekMonday(y, w) {
  // Jan 4th is always in week 1
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7;
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1));
  const monday = new Date(mondayOfWeek1);
  monday.setUTCDate(mondayOfWeek1.getUTCDate() + (w - 1) * 7);
  return monday;
}

// Return true if an ISO date-time string falls into the given bucket key.
export function dateInBucket(isoDateTime, bucket) {
  const date = isoDateTime.slice(0, 10);
  if (/^\d{4}-\d{2}$/.test(bucket)) return date.startsWith(bucket);
  if (/^\d{4}-\d{2}-\d{2}$/.test(bucket)) return date === bucket;
  const m = bucket.match(/^(\d{4})-W(\d{2})$/);
  if (m) {
    const [y, w] = [parseInt(m[1]), parseInt(m[2])];
    const monday = isoWeekMonday(y, w);
    const sunday = new Date(monday);
    sunday.setUTCDate(sunday.getUTCDate() + 7);
    const d = new Date(date + 'T00:00:00Z');
    return d >= monday && d < sunday;
  }
  return false;
}

// Query a term at a specific granularity.
export async function queryTerm(term, granularity = 'monthly') {
  const q = term.trim().toLowerCase();
  if (!q) return null;

  const isPhrase = /\s/.test(q);
  const idx = await loadIndex(granularity);

  if (!isPhrase && idx.terms[q]) {
    return { term: q, buckets: idx.buckets, counts: idx.terms[q], totals: idx.totals, source: 'index' };
  }

  // Fallback: scan every shard and re-bucket client-side.
  const sections = await loadSections();
  const months = sections.months;
  const shards = await Promise.all(months.map(loadShard));

  const buckets = idx.buckets;
  const bucketIdx = new Map(buckets.map((b, i) => [b, i]));
  const counts = new Array(buckets.length).fill(0);

  const toBucket = makeBucketer(granularity);
  for (const shard of shards) {
    for (const h of shard.headlines) {
      if (!h.t.toLowerCase().includes(q)) continue;
      const b = toBucket((h.d || '').slice(0, 10));
      const bi = bucketIdx.get(b);
      if (bi != null) counts[bi]++;
    }
  }
  return { term: q, buckets, counts, totals: idx.totals, source: 'scan' };
}

// Headlines for a term in a given bucket (month/week/day).
export async function headlinesForTermInBucket(term, bucket) {
  const q = term.trim().toLowerCase();
  const monthKeys = bucketToMonths(bucket);
  const shards = await Promise.all(monthKeys.map(loadShard));
  const all = shards.flatMap(s => s.headlines);
  const filtered = all.filter(h => dateInBucket(h.d || '', bucket));
  if (!q) return filtered;
  return filtered.filter(h => h.t.toLowerCase().includes(q));
}

export function normalisePerMille(counts, totals) {
  return counts.map((c, i) => (totals[i] > 0 ? (c * 1000) / totals[i] : 0));
}

function makeBucketer(granularity) {
  if (granularity === 'monthly') return (d) => d.slice(0, 7);
  if (granularity === 'daily') return (d) => d;
  if (granularity === 'weekly') return (d) => {
    // ISO week bucketer matching the Python side
    const date = new Date(d + 'T00:00:00Z');
    const dayNum = date.getUTCDay() || 7;
    // Thursday of this week determines the ISO week's year/number
    const thurs = new Date(date);
    thurs.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const y = thurs.getUTCFullYear();
    const jan1 = new Date(Date.UTC(y, 0, 1));
    const w = Math.ceil((((thurs - jan1) / 86400000) + 1) / 7);
    return `${y}-W${String(w).padStart(2, '0')}`;
  };
  throw new Error('Unknown granularity: ' + granularity);
}
