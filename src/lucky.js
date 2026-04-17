// Curated "I feel lucky" recipes — pre-cooked comparisons that tell a story,
// make you laugh, or just reveal something unexpected. Each recipe is an
// array of 2-4 items; the lucky button picks one at random and fills the
// search boxes.
//
// Two flavours: WORD_RECIPES (plain headline-word search) and
// TAG_RECIPES (use canonical Guardian tag IDs). Mix of earnest editorial
// comparisons AND the "one intentional odd one out" pattern.

// ─────────────── WORDS ───────────────

export const WORD_RECIPES = [
  // --- Emotions / mood ---
  ['happy', 'sad', 'joy', 'misery'],
  ['hope', 'fear', 'anger', 'love'],
  ['lonely', 'together', 'friends', 'family'],
  ['tired', 'excited', 'bored', 'stressed'],

  // --- Sport: the classics and the jokes ---
  ['win', 'lose', 'draw', 'extra time'],
  ['gold', 'silver', 'bronze', 'wooden spoon'],
  ['champion', 'hero', 'legend', 'goat'],
  ['arsenal', 'liverpool', 'chelsea', 'spurs'],
  ['wimbledon', 'wembley', 'lords', 'twickenham'],
  ['strictly', 'gladiators', 'mastermind', 'bake off'],

  // --- Weather ---
  ['sun', 'rain', 'snow', 'wind'],
  ['spring', 'summer', 'autumn', 'winter'],
  ['storm', 'heatwave', 'drought', 'flood'],

  // --- Food (with one intruder) ---
  ['bread', 'butter', 'cheese', 'crumpet'],
  ['coffee', 'tea', 'wine', 'water'],
  ['pizza', 'pasta', 'burger', 'rhubarb'],
  ['breakfast', 'lunch', 'dinner', 'tea'],
  ['vegan', 'vegetarian', 'carnivore', 'flexitarian'],

  // --- Tech / dead tech ---
  ['apple', 'google', 'microsoft', 'blockbuster'],
  ['myspace', 'bebo', 'facebook', 'geocities'],
  ['iphone', 'android', 'blackberry', 'nokia'],
  ['chatgpt', 'claude', 'gemini', 'clippy'],
  ['ai', 'crypto', 'web3', 'metaverse'],
  ['netflix', 'spotify', 'tiktok', 'mspaint'],

  // --- Music / culture ---
  ['beatles', 'stones', 'oasis', 'blur'],
  ['pop', 'rock', 'jazz', 'techno'],
  ['oscar', 'bafta', 'grammy', 'razzie'],
  ['cinema', 'netflix', 'streaming', 'blockbuster'],

  // --- Animals (with a dragon) ---
  ['dog', 'cat', 'horse', 'dragon'],
  ['tiger', 'lion', 'bear', 'koala'],
  ['elephant', 'whale', 'dolphin', 'hamster'],

  // --- Life events ---
  ['birth', 'death', 'marriage', 'divorce'],
  ['school', 'university', 'job', 'retirement'],

  // --- Crisis words ---
  ['pandemic', 'outbreak', 'epidemic', 'manflu'],
  ['doom', 'apocalypse', 'disaster', 'monday'],
  ['zombie', 'ghost', 'vampire', 'politician'],

  // --- Colours ---
  ['red', 'blue', 'green', 'orange'],
  ['black', 'white', 'grey', 'rainbow'],

  // --- Monarchy / royalty ---
  ['queen', 'king', 'prince', 'princess'],
  ['buckingham', 'windsor', 'balmoral', 'sandringham'],

  // --- Politics ---
  ['corbyn', 'starmer', 'johnson', 'badenoch'],
  ['remain', 'leave', 'brexit', 'rejoin'],
  ['labour', 'conservatives', 'libdems', 'reform'],
  ['trump', 'biden', 'obama', 'clinton'],
  ['putin', 'zelensky', 'xi', 'modi'],

  // --- Zeitgeist ---
  ['brexit', 'covid', 'ukraine', 'gaza'],
  ['climate', 'inflation', 'strikes', 'cost'],
  ['nhs', 'hospital', 'gp', 'waiting'],

  // --- Economy ---
  ['money', 'tax', 'debt', 'jackpot'],
  ['millionaire', 'billionaire', 'trillionaire', 'pound'],
  ['inflation', 'recession', 'growth', 'stagflation'],

  // --- Nostalgia ---
  ['vhs', 'dvd', 'blu-ray', 'vinyl'],
  ['walkman', 'ipod', 'spotify', 'cassette'],
  ['blackberry', 'palm', 'nokia', 'sidekick'],

  // --- Classic rivalries ---
  ['batman', 'superman', 'spiderman', 'manchester'],
  ['messi', 'ronaldo', 'mbappé', 'kane'],

  // --- Workplace / daily life ---
  ['commute', 'remote', 'hybrid', 'office'],
  ['monday', 'friday', 'weekend', 'holiday'],

  // --- Generational ---
  ['boomer', 'millennial', 'genz', 'avocado'],
  ['rent', 'mortgage', 'deposit', 'inheritance'],

  // --- Random joy ---
  ['sunshine', 'rainbow', 'unicorn', 'sparkle'],
  ['chaos', 'order', 'mayhem', 'admin'],
];

// ─────────────── TAGS ───────────────
// Uses canonical Guardian tag IDs. If a tag isn't in the top-3000 catalog,
// the lucky button will fall back to another recipe.

export const TAG_RECIPES = [
  // Politics — UK
  ['politics/keir-starmer', 'us-news/donaldtrump', 'politics/kemibadenoch', 'politics/nigel-farage'],
  ['politics/labour', 'politics/conservatives', 'politics/liberaldemocrats', 'politics/reformuk'],
  ['politics/borisjohnson', 'politics/theresamay', 'politics/lizztruss', 'politics/rishisunak'],
  ['politics/keir-starmer', 'politics/jeremycorbyn', 'politics/edmiliband', 'politics/gordon-brown'],

  // Politics — US
  ['us-news/donaldtrump', 'us-news/joebiden', 'us-news/barack-obama', 'us-news/kamalaharris'],
  ['us-news/us-supreme-court', 'us-news/republicans', 'us-news/democrats', 'us-news/maga'],

  // World leaders
  ['world/vladimir-putin', 'world/volodymyrzelenskiy', 'world/netanyahu', 'world/xijinping'],

  // Football
  ['football/arsenal', 'football/liverpool', 'football/chelsea', 'football/tottenham-hotspur'],
  ['football/manchester-city', 'football/manunited', 'football/newcastleunited', 'football/astonvilla'],
  ['football/premierleague', 'football/championship', 'football/championsleague', 'football/europaleague'],
  ['football/euro2024', 'football/worldcup2022', 'football/worldcup2026', 'football/womenseuros'],

  // Sport beyond football
  ['sport/cricket', 'sport/rugbyunion', 'sport/tennis', 'sport/golf'],
  ['sport/wimbledon', 'sport/us-open-tennis', 'sport/frenchopen', 'sport/australianopen'],
  ['sport/olympicgames', 'sport/paralympics', 'sport/commonwealthgames', 'sport/superbowl'],
  ['sport/formulaone', 'sport/motorsports', 'sport/cycling', 'sport/nfl'],

  // Climate + environment
  ['environment/climate-crisis', 'business/oilandgascompanies', 'environment/fossilfuels', 'environment/renewableenergy'],
  ['environment/wildlife', 'environment/biodiversity', 'environment/pollution', 'environment/plastic'],

  // Tech
  ['technology/artificialintelligenceai', 'technology/chatgpt', 'technology/cryptocurrencies', 'technology/quantum-computing'],
  ['technology/apple', 'technology/google', 'technology/meta', 'technology/microsoft'],
  ['technology/elonmusk', 'technology/markzuckerberg', 'technology/sundarpichai', 'technology/samaltman'],
  ['technology/tesla', 'technology/spacex', 'technology/tiktok', 'technology/twitter'],

  // Culture
  ['culture/television', 'culture/music', 'film/film', 'books/books'],
  ['music/taylor-swift', 'music/beyonce', 'music/adele', 'music/harry-styles'],
  ['tv-and-radio/bbc', 'tv-and-radio/itv', 'tv-and-radio/channel4', 'media/netflix'],

  // Entertainment events
  ['film/oscars', 'film/baftas', 'film/cannes', 'music/grammys'],

  // Royalty
  ['uk-news/king-charles-iii', 'uk-news/prince-harry', 'uk-news/meghan', 'uk-news/queen-elizabeth-ii'],

  // Conflict
  ['world/ukraine', 'world/israel-hamas-war', 'world/gaza', 'world/syria'],
  ['world/russia', 'world/china', 'world/iran', 'world/northkorea'],

  // Economy
  ['business/inflation', 'business/interest-rates', 'business/cost-of-living-crisis', 'business/recession'],

  // Food
  ['food/food', 'lifeandstyle/food-and-drink', 'food/recipes', 'food/restaurants'],

  // Health
  ['society/health', 'society/mentalhealth', 'world/coronavirus-outbreak', 'society/nhs'],
];

// ─────────────── PICK ───────────────

export function pickWordRecipe() {
  return WORD_RECIPES[Math.floor(Math.random() * WORD_RECIPES.length)];
}

export function pickTagRecipe(catalog) {
  // Filter to recipes where at least 3 of the 4 tags exist in the catalog
  const catalogIds = new Set(catalog.map(t => t.id));
  const valid = TAG_RECIPES.filter(r => r.filter(id => catalogIds.has(id)).length >= 3);
  if (!valid.length) return null;
  return valid[Math.floor(Math.random() * valid.length)];
}
