// Tone tags — the "what kind of writing is this" dimension of Guardian
// CAPI articles, parallel to (and independent from) the keyword tag
// catalog. tone/news, tone/comment, tone/features, etc.
//
// Kept on its own path, deliberately. tone/* slugs are still suppressed
// in src/skip-tags.js's SKIP_PREFIXES so they never leak into the
// keyword-tag flow (cotags, Trends autocomplete, rising panels). If you
// want to surface tones somewhere, use isUsefulTone() to test and
// toneLabel() / toneColor() to render.

// Display names. Guardian CAPI tone slugs are smooshed concatenations
// (tone/matchreports, tone/livecoverage); these spell them out.
const TONE_LABELS = {
  'tone/news':              'News',
  'tone/features':          'Features',
  'tone/comment':           'Opinion',
  'tone/letters':           'Letters',
  'tone/reviews':           'Reviews',
  'tone/analysis':          'Analysis',
  'tone/interview':         'Interview',
  'tone/obituaries':        'Obituary',
  'tone/editorials':        'Editorial',
  'tone/livecoverage':      'Live coverage',
  'tone/blog':              'Blog',
  'tone/matchreports':      'Match report',
  'tone/sponsoredfeatures': 'Sponsored feature',
  'tone/recipes':           'Recipe',
  'tone/profiles':          'Profile',
  'tone/helplines':         'Helpline',
  'tone/polls':             'Poll',
  'tone/minutebyminute':    'Minute-by-minute',
  'tone/setpiece':          'Set-piece',
  'tone/toplists':          'List',
  'tone/graphic':           'Graphic',
  'tone/albumreviews':      'Album review',
  'tone/performances':      'Performance',
  'tone/extract':           'Extract',
  'tone/explainers':        'Explainer',
  'tone/timelines':         'Timeline',
  'tone/quizzes':           'Quiz',
  'tone/cartoons':          'Cartoon',
  'tone/picture-gallery':   'Picture gallery',
  'tone/recensions':        'Long read',
  'tone/diary':             'Diary',
};

// Small distinct palette so a tone-mix breakdown reads as a set,
// not a wall of one colour. Tones don't have established Guardian
// brand colours like sections do, so we pick a coherent muted set.
// Order matches a rough "frequency × distinctness" preference: News
// (the most common tone) gets the brand blue.
const TONE_PALETTE = [
  '#052962', // Guardian blue — News
  '#C70000', // news red — Opinion
  '#22874d', // eco green — Features
  '#6a2c8a', // purple — Analysis
  '#b97b32', // amber — Interview / Reviews
  '#1a6fa0', // soft blue — Live / Blog
  '#ed6f8b', // pink — Editorial / Profile
  '#4a6fa5', // dusty blue — fallback
];

// Stable assignment of tones → palette colours. Specific common
// tones get specific colours; everything else cycles through the
// remainder of the palette deterministically. So the same tone
// always looks the same colour across views.
const TONE_COLORS = {
  'tone/news':         TONE_PALETTE[0],
  'tone/comment':      TONE_PALETTE[1],
  'tone/features':     TONE_PALETTE[2],
  'tone/analysis':     TONE_PALETTE[3],
  'tone/interview':    TONE_PALETTE[4],
  'tone/reviews':      TONE_PALETTE[4],
  'tone/livecoverage': TONE_PALETTE[5],
  'tone/blog':         TONE_PALETTE[5],
  'tone/editorials':   TONE_PALETTE[6],
  'tone/profiles':     TONE_PALETTE[6],
};

export function toneLabel(id) {
  if (TONE_LABELS[id]) return TONE_LABELS[id];
  // Fallback: strip the prefix and Title-Case the slug.
  const last = (id || '').split('/').pop() || id;
  return last.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function toneColor(id) {
  if (TONE_COLORS[id]) return TONE_COLORS[id];
  // Stable hash → palette for unknown tones, so the same tone slug
  // always gets the same fallback colour across renders.
  let h = 0;
  for (let i = 0; i < (id || '').length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TONE_PALETTE[h % TONE_PALETTE.length];
}

// True if this is a tone id worth surfacing. Excludes type/* and
// structural noise. We currently treat all tone/* slugs as useful;
// kept as a function so future filtering (e.g. excluding sponsored)
// is a one-line change.
export function isUsefulTone(id) {
  return typeof id === 'string' && id.startsWith('tone/');
}

// All known tones as a catalog-like array, sorted by label. Used by
// the Deep dive autocomplete when the user switches into Tone mode.
// Shape matches the tag catalog ({ id, name }) so the same
// autocomplete rendering path can drive both.
export function getToneCatalog() {
  return Object.entries(TONE_LABELS)
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
