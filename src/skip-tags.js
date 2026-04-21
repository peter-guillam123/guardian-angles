// Shared rules for tags that aren't editorially interesting as a "biggest
// tag" signal — they'd win every time on sheer volume rather than because
// anything specific happened. Used by This Week's hero picker and the
// Trends page "Trending tag" insert in the reading panel.

export const SKIP_PREFIXES = ['tone/', 'type/', 'publication/', 'tracking/'];
export const SKIP_TAGS = new Set([
  'world/europe-news',
  'world/americas',
  'world/asia-pacific',
  'world/middleeast',
  'world/africa',
  'us-news/us-politics',
  'australia-news/australian-politics',
  'politics/uk-politics',
  'uk-news/england',
  'uk-news/scotland',
  'uk-news/wales',
  'uk-news/london',
]);

// Section mega-tags follow the pattern "section/section" (e.g. "uk/uk")
// and are always section-level rather than topic-level.
export function isMegaTag(id) {
  const p = id.split('/');
  return p.length === 2 && p[0] === p[1];
}

export function isUsefulTag(id) {
  return !SKIP_PREFIXES.some(p => id.startsWith(p))
    && !isMegaTag(id)
    && !SKIP_TAGS.has(id);
}
