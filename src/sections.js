// Section display metadata:
//   - `label(id)` returns the human-readable name
//   - `color(id)` returns the series colour for the section
// Used by the headline explorer, the section-breakdown bar chart,
// and anywhere else we surface sectionId to the reader.

const NAME_OVERRIDES = {
  commentisfree: 'Opinion',
  'uk-news': 'UK news',
  'us-news': 'US news',
  'australia-news': 'Australia news',
  world: 'World news',
  'artanddesign': 'Art & design',
  'lifeandstyle': 'Life & style',
  'film': 'Film',
  'tv-and-radio': 'TV & radio',
  'stage': 'Stage',
  'money': 'Money',
  'business': 'Business',
  'environment': 'Environment',
  'politics': 'Politics',
  'technology': 'Technology',
  'media': 'Media',
  'science': 'Science',
  'society': 'Society',
  'education': 'Education',
  'global-development': 'Global development',
  'news': 'News',
  'football': 'Football',
  'sport': 'Sport',
  'music': 'Music',
  'books': 'Books',
  'culture': 'Culture',
  'games': 'Games',
  'law': 'Law',
  'travel': 'Travel',
  'food': 'Food',
  'fashion': 'Fashion',
  'inequality': 'Inequality',
  'wellness': 'Wellness',
  'membership': 'Membership',
  'crosswords': 'Crosswords',
  'global': 'Global',
  'cities': 'Cities',
  'info': 'Info',
  'help': 'Help',
};

const COLOR_MAP = {
  // News family — Guardian blue
  politics: '#052962',
  'uk-news': '#052962',
  'us-news': '#052962',
  'australia-news': '#052962',
  world: '#052962',
  'global-development': '#052962',
  news: '#052962',
  // Opinion — news red
  commentisfree: '#C70000',
  // Green family
  environment: '#22874d',
  business: '#22874d',
  money: '#22874d',
  sport: '#22874d',
  football: '#22874d',
  // Pink/cultural
  culture: '#ed6f8b',
  film: '#ed6f8b',
  music: '#ed6f8b',
  books: '#ed6f8b',
  stage: '#ed6f8b',
  artanddesign: '#ed6f8b',
  'tv-and-radio': '#ed6f8b',
  fashion: '#ed6f8b',
  // Tech / media — purple
  technology: '#6a2c8a',
  media: '#6a2c8a',
  science: '#6a2c8a',
  games: '#6a2c8a',
  // Life — warm
  lifeandstyle: '#b97b32',
  food: '#b97b32',
  travel: '#b97b32',
  wellness: '#b97b32',
  // Public interest — ink
  society: '#3d3a35',
  education: '#3d3a35',
  law: '#3d3a35',
  inequality: '#3d3a35',
};

export function sectionLabel(id) {
  if (!id) return 'Guardian';
  if (NAME_OVERRIDES[id]) return NAME_OVERRIDES[id];
  // Fallback: id with hyphens → spaces, first letter upper
  return id.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());
}

export function sectionColor(id) {
  return COLOR_MAP[id] || '#3d3a35';
}
