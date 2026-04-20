// Data loader: term indexes per granularity, sections, and lazy shard fetch.
// Everything is static JSON in /data/, loaded on demand.

const DATA_BASE = './data';

// granularity → cached Promise of { buckets, totals, terms }
const _indexPromises = {};
const _tagIndexPromises = {};
let _sectionsPromise = null;
let _metaPromise = null;
let _tagCatalogPromise = null;
const _shardCache = new Map();

// Build a headline matcher for a free-text query.
//   - Phrase (contains whitespace): substring match
//   - Single word: case-insensitive word-boundary match
//
// This mirrors the build-time tokenizer's view of headlines, so the chart
// counts and the headline-explorer list agree on what "matches" the query.
// Importantly: "AI" no longer matches "rain", "Spain", "again", and so on.
// Strip accents so "Orbán" matches a search for "orban", and vice versa.
// Then strip any trailing 's or apostrophes — "America's" shouldn't hide
// when someone searches for "America".
function normaliseForSearch(s) {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')   // combining marks
    .replace(/\u2019/g, "'")            // curly apostrophe → straight
    .toLowerCase();
}

export function makeWordMatcher(q) {
  const trimmed = (q || '').trim();
  if (!trimmed) return () => true;
  const lower = normaliseForSearch(trimmed);
  if (/\s/.test(lower)) {
    return (text) => normaliseForSearch(text).includes(lower);
  }
  const escaped = lower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match the word, optionally followed by 's (possessive) — so "America"
  // also finds "America's" in headlines.
  const re = new RegExp(`\\b${escaped}(?:'s)?\\b`, 'i');
  return (text) => re.test(normaliseForSearch(text));
}

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
    ).then(idx => densifyIndex(idx, granularity));
  }
  return _indexPromises[granularity];
}

export function loadTagIndex(granularity = 'monthly') {
  if (!_tagIndexPromises[granularity]) {
    _tagIndexPromises[granularity] = fetchJsonMaybeGz(
      `${DATA_BASE}/tag-index-${granularity}.json`,
    ).then(idx => densifyIndex(idx, granularity));
  }
  return _tagIndexPromises[granularity];
}

// ─── Dense bucket helpers ───
// The build pipeline emits only buckets that have shards. During a backfill
// that produces gaps (e.g. 2014-10 → 2015-12 absent while 2014 is rebuilt).
// The chart positions points by index, so a gap gets visually compressed and
// the year labels drift out of alignment with the data. To fix that, we pad
// the bucket array client-side so every period between min and max exists,
// filled with zeros for missing months/weeks/days.

function* monthRange(startYm, endYm) {
  let [y, m] = startYm.split('-').map(Number);
  const [ey, em] = endYm.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    yield `${y}-${String(m).padStart(2, '0')}`;
    m++; if (m > 12) { m = 1; y++; }
  }
}
function* dayRange(startDate, endDate) {
  const d = new Date(startDate + 'T00:00:00Z');
  const e = new Date(endDate + 'T00:00:00Z');
  while (d.getTime() <= e.getTime()) {
    yield d.toISOString().slice(0, 10);
    d.setUTCDate(d.getUTCDate() + 1);
  }
}
function isoWeekToMonday(iso) {
  const [y, w] = iso.split('-W').map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday1 = new Date(jan4);
  monday1.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const result = new Date(monday1);
  result.setUTCDate(monday1.getUTCDate() + (w - 1) * 7);
  return result;
}
function mondayToIsoWeek(d) {
  const t = new Date(d);
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + (4 - day));
  const year = t.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday1 = new Date(jan4);
  monday1.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const week = Math.round((t.getTime() - monday1.getTime()) / (7 * 86400000)) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}
function* weekRange(startW, endW) {
  let d = isoWeekToMonday(startW);
  const e = isoWeekToMonday(endW);
  while (d.getTime() <= e.getTime()) {
    yield mondayToIsoWeek(d);
    d = new Date(d.getTime() + 7 * 86400000);
  }
}

function denseRange(buckets, granularity) {
  if (!buckets.length) return buckets;
  const first = buckets[0], last = buckets[buckets.length - 1];
  const gen = granularity === 'weekly' ? weekRange(first, last)
            : granularity === 'daily'  ? dayRange(first, last)
            :                            monthRange(first, last);
  return Array.from(gen);
}

function densifyIndex(idx, granularity) {
  if (!idx || !Array.isArray(idx.buckets) || idx.buckets.length < 2) return idx;
  const dense = denseRange(idx.buckets, granularity);
  if (dense.length === idx.buckets.length) {
    idx._gapMask = new Array(dense.length).fill(false);
    return idx;
  }

  const newIdx = new Map(dense.map((b, i) => [b, i]));
  const reindex = idx.buckets.map(b => newIdx.get(b));
  const n = dense.length;
  // gapMask[i] = true when bucket i wasn't in the original (i.e. no shards).
  const gapMask = new Array(n).fill(true);
  for (const ni of reindex) gapMask[ni] = false;

  const reshape = (arr) => {
    const out = new Array(n).fill(0);
    for (let oi = 0; oi < arr.length; oi++) out[reindex[oi]] = arr[oi];
    return out;
  };

  const out = { ...idx, buckets: dense, _gapMask: gapMask };
  if (Array.isArray(idx.totals)) out.totals = reshape(idx.totals);
  if (idx.terms) {
    out.terms = {};
    for (const k in idx.terms) out.terms[k] = reshape(idx.terms[k]);
  }
  if (idx.tags) {
    out.tags = {};
    for (const k in idx.tags) out.tags[k] = reshape(idx.tags[k]);
  }
  return out;
}

function gapMaskFor(idx) {
  return idx._gapMask || new Array(idx.buckets.length).fill(false);
}

export function loadTagCatalog() {
  if (!_tagCatalogPromise) {
    _tagCatalogPromise = fetch(`${DATA_BASE}/tag-catalog.json`).then(r => r.json());
  }
  return _tagCatalogPromise;
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

// Query a term at a specific granularity. Word-boundary semantics:
// "ai" won't match "rain"; "trump" won't match "trumpism" — same as the index.
export async function queryTerm(term, granularity = 'monthly') {
  const q = term.trim().toLowerCase();
  if (!q) return null;

  const isPhrase = /\s/.test(q);
  const idx = await loadIndex(granularity);

  if (!isPhrase && idx.terms[q]) {
    return { term: q, buckets: idx.buckets, counts: idx.terms[q], totals: idx.totals, gapMask: gapMaskFor(idx), source: 'index' };
  }

  // Fallback: scan every shard and re-bucket client-side.
  const sections = await loadSections();
  const months = sections.months;
  const shards = await Promise.all(months.map(loadShard));

  const buckets = idx.buckets;
  const bucketIdx = new Map(buckets.map((b, i) => [b, i]));
  const counts = new Array(buckets.length).fill(0);

  const matcher = makeWordMatcher(q);
  const toBucket = makeBucketer(granularity);
  for (const shard of shards) {
    for (const h of shard.headlines) {
      if (!matcher(h.t)) continue;
      const b = toBucket((h.d || '').slice(0, 10));
      const bi = bucketIdx.get(b);
      if (bi != null) counts[bi]++;
    }
  }
  return { term: q, buckets, counts, totals: idx.totals, gapMask: gapMaskFor(idx), source: 'scan' };
}

// Headlines for a term in a given bucket (month/week/day). Uses the same
// word-boundary semantics as queryTerm so the headline list and the chart
// curve always agree on what counts as "matching".
export async function headlinesForTermInBucket(term, bucket) {
  const q = (term || '').trim();
  const monthKeys = bucketToMonths(bucket);
  const shards = await Promise.all(monthKeys.map(loadShard));
  const all = shards.flatMap(s => s.headlines);
  const filtered = all.filter(h => dateInBucket(h.d || '', bucket));
  if (!q) return filtered;
  const matcher = makeWordMatcher(q);
  return filtered.filter(h => matcher(h.t));
}

// Query a tag at a specific granularity. Tags only exist in the top-N catalog
// so there is no substring-scan fallback — if it's not in the catalog, the UI
// should not have let the user pick it.
export async function queryTag(tagId, granularity = 'monthly') {
  if (!tagId) return null;
  const idx = await loadTagIndex(granularity);
  const counts = idx.tags[tagId];
  if (!counts) return null;
  return { tag: tagId, buckets: idx.buckets, counts, totals: idx.totals, gapMask: gapMaskFor(idx), source: 'tag-index' };
}

// Headlines in a bucket whose tag array includes this tag id.
export async function headlinesForTagInBucket(tagId, bucket) {
  const monthKeys = bucketToMonths(bucket);
  const shards = await Promise.all(monthKeys.map(loadShard));
  const all = shards.flatMap(s => s.headlines);
  return all
    .filter(h => dateInBucket(h.d || '', bucket))
    .filter(h => Array.isArray(h.g) && h.g.includes(tagId));
}

export function normalisePerMille(counts, totals) {
  return counts.map((c, i) => (totals[i] > 0 ? (c * 1000) / totals[i] : 0));
}

// Section-filtered query: re-aggregates from raw shards (no pre-built index),
// so this is slower than queryTerm/queryTag — but it lets the user ask things
// like "starmer in Opinion only" or "us-news/donaldtrump in World news only"
// which the bulk indexes can't answer.
//
// Loads all monthly shards on first call (heavy first-time cost; subsequent
// calls reuse the in-memory cache via loadShard).
export async function queryInSection({ kind, key, granularity, sectionId }) {
  if (!sectionId) throw new Error('queryInSection requires sectionId');
  const sections = await loadSections();
  const allMonths = sections.months;
  const shards = await Promise.all(allMonths.map(loadShard));

  const bucketer = makeBucketer(granularity);

  // First pass: collect bucket keys (matching the global universe so x-axes
  // line up with non-filtered queries)
  const bucketsSet = new Set();
  for (const shard of shards) {
    for (const h of shard.headlines) {
      const date = (h.d || '').slice(0, 10);
      if (date) bucketsSet.add(bucketer(date));
    }
  }
  const buckets = Array.from(bucketsSet).sort();
  const bucketIdx = new Map(buckets.map((b, i) => [b, i]));
  const n = buckets.length;
  const counts = new Array(n).fill(0);
  const totals = new Array(n).fill(0);   // per-bucket totals WITHIN this section

  const matcher = kind === 'words' ? makeWordMatcher(key) : null;
  const tagId = kind === 'tags' ? key : null;

  for (const shard of shards) {
    for (const h of shard.headlines) {
      if (h.s !== sectionId) continue;
      const date = (h.d || '').slice(0, 10);
      if (!date) continue;
      const bi = bucketIdx.get(bucketer(date));
      if (bi == null) continue;
      totals[bi]++;
      if (matcher) {
        if (matcher(h.t)) counts[bi]++;
      } else {
        if (Array.isArray(h.g) && h.g.includes(tagId)) counts[bi]++;
      }
    }
  }

  return { key, buckets, counts, totals, source: 'section-scan' };
}

// Headlines for a (term|tag) in a (bucket, section).
export async function headlinesForKeyInBucketAndSection({ kind, key, bucket, sectionId }) {
  const monthKeys = bucketToMonths(bucket);
  const shards = await Promise.all(monthKeys.map(loadShard));
  const all = shards.flatMap(s => s.headlines);
  const inBucketAndSection = all.filter(h =>
    dateInBucket(h.d || '', bucket) && (!sectionId || h.s === sectionId)
  );
  if (kind === 'tags') {
    return inBucketAndSection.filter(h => Array.isArray(h.g) && h.g.includes(key));
  }
  const matcher = makeWordMatcher(key);
  return inBucketAndSection.filter(h => matcher(h.t));
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
