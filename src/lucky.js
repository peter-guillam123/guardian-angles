// Curated "I feel lucky" recipes — pre-cooked comparisons that tell a story,
// make you laugh, or reveal something unexpected. Each recipe is an array
// of 2-4 items; the lucky button picks one at random and fills the search
// boxes.
//
// Two flavours: WORD_RECIPES (plain headline-word search) and TAG_RECIPES
// (canonical Guardian tag IDs). The magic comes from mixing earnest
// editorial comparisons with nostalgic rivalries and the occasional
// "one intentional interloper" gag.

// ─────────────── WORD RECIPES ───────────────

export const WORD_RECIPES = [
  // ── EMOTIONS + MOOD ──
  ['happy', 'sad', 'joy', 'misery'],
  ['hope', 'fear', 'anger', 'love'],
  ['lonely', 'together', 'friends', 'family'],
  ['tired', 'excited', 'bored', 'stressed'],
  ['calm', 'panic', 'chill', 'doom'],
  ['laughter', 'tears', 'silence', 'applause'],

  // ── SPORT: classics + jokes ──
  ['win', 'lose', 'draw', 'extra time'],
  ['gold', 'silver', 'bronze', 'wooden spoon'],
  ['champion', 'hero', 'legend', 'goat'],
  ['arsenal', 'liverpool', 'chelsea', 'spurs'],
  ['wimbledon', 'wembley', 'lords', 'twickenham'],
  ['messi', 'ronaldo', 'mbappé', 'haaland'],
  ['federer', 'nadal', 'djokovic', 'murray'],
  ['hamilton', 'verstappen', 'alonso', 'button'],
  ['tyson', 'ali', 'mayweather', 'rocky'],
  ['cricket', 'rugby', 'tennis', 'darts'],
  ['olympics', 'paralympics', 'commonwealth', 'worldcup'],
  ['strictly', 'gladiators', 'mastermind', 'bake off'],

  // ── US + GLOBAL POLITICS ──
  ['trump', 'biden', 'obama', 'clinton'],
  ['reagan', 'bush', 'clinton', 'kennedy'],
  ['harris', 'vance', 'pence', 'rubio'],
  ['democrat', 'republican', 'maga', 'socialist'],
  ['texas', 'california', 'florida', 'new york'],
  ['corbyn', 'starmer', 'johnson', 'badenoch'],
  ['remain', 'leave', 'brexit', 'rejoin'],
  ['labour', 'conservatives', 'libdems', 'reform'],
  ['putin', 'zelensky', 'xi', 'modi'],
  ['netanyahu', 'abbas', 'erdogan', 'saudi'],
  ['macron', 'merkel', 'scholz', 'meloni'],

  // ── WORLD CITIES ──
  ['london', 'paris', 'berlin', 'madrid'],
  ['new york', 'los angeles', 'chicago', 'miami'],
  ['tokyo', 'beijing', 'seoul', 'mumbai'],
  ['dublin', 'edinburgh', 'cardiff', 'belfast'],
  ['athens', 'rome', 'istanbul', 'jerusalem'],

  // ── WORLD COUNTRIES ──
  ['france', 'germany', 'italy', 'spain'],
  ['china', 'japan', 'korea', 'vietnam'],
  ['brazil', 'argentina', 'mexico', 'chile'],
  ['egypt', 'kenya', 'nigeria', 'ethiopia'],
  ['russia', 'ukraine', 'belarus', 'moldova'],
  ['india', 'pakistan', 'bangladesh', 'nepal'],
  ['canada', 'australia', 'new zealand', 'greenland'],

  // ── TECH: live + dead ──
  ['apple', 'google', 'microsoft', 'blockbuster'],
  ['myspace', 'bebo', 'facebook', 'geocities'],
  ['iphone', 'android', 'blackberry', 'nokia'],
  ['chatgpt', 'claude', 'gemini', 'clippy'],
  ['ai', 'crypto', 'web3', 'metaverse'],
  ['netflix', 'spotify', 'tiktok', 'mspaint'],
  ['yahoo', 'aol', 'msn', 'altavista'],
  ['musk', 'bezos', 'zuckerberg', 'gates'],
  ['twitter', 'bluesky', 'threads', 'mastodon'],

  // ── FILM + TV ──
  ['oscar', 'bafta', 'grammy', 'razzie'],
  ['hollywood', 'bollywood', 'netflix', 'bbc'],
  ['scorsese', 'tarantino', 'spielberg', 'nolan'],
  ['cruise', 'pitt', 'clooney', 'dicaprio'],
  ['streep', 'blanchett', 'winslet', 'dench'],
  ['barbie', 'oppenheimer', 'batman', 'barbenheimer'],
  ['marvel', 'dc', 'disney', 'pixar'],
  ['starwars', 'bond', 'potter', 'hobbit'],
  ['succession', 'sopranos', 'wire', 'breaking bad'],
  ['friends', 'seinfeld', 'cheers', 'frasier'],
  ['sherlock', 'fleabag', 'doctor who', 'bridgerton'],
  ['hitchcock', 'kubrick', 'lynch', 'tarantino'],

  // ── MUSIC ──
  ['beatles', 'stones', 'who', 'kinks'],
  ['oasis', 'blur', 'pulp', 'suede'],
  ['taylor swift', 'beyoncé', 'adele', 'rihanna'],
  ['drake', 'kanye', 'kendrick', 'jay-z'],
  ['bowie', 'dylan', 'lennon', 'prince'],
  ['madonna', 'cher', 'mariah', 'whitney'],
  ['pop', 'rock', 'hiphop', 'classical'],
  ['punk', 'metal', 'indie', 'emo'],
  ['techno', 'house', 'garage', 'drum and bass'],
  ['glastonbury', 'coachella', 'reading', 'eurovision'],

  // ── LITERATURE + ART ──
  ['rowling', 'king', 'pullman', 'ishiguro'],
  ['orwell', 'woolf', 'joyce', 'austen'],
  ['booker', 'nobel', 'costa', 'pulitzer'],
  ['banksy', 'hirst', 'emin', 'warhol'],
  ['picasso', 'monet', 'rembrandt', 'turner'],
  ['shakespeare', 'dickens', 'chaucer', 'marlowe'],

  // ── WEATHER + NATURE ──
  ['sun', 'rain', 'snow', 'wind'],
  ['spring', 'summer', 'autumn', 'winter'],
  ['storm', 'heatwave', 'drought', 'flood'],
  ['forest', 'ocean', 'glacier', 'desert'],
  ['whale', 'shark', 'dolphin', 'goldfish'],
  ['tiger', 'lion', 'bear', 'koala'],
  ['dog', 'cat', 'horse', 'dragon'],

  // ── FOOD + DRINK ──
  ['bread', 'butter', 'cheese', 'crumpet'],
  ['coffee', 'tea', 'wine', 'water'],
  ['pizza', 'pasta', 'burger', 'rhubarb'],
  ['sushi', 'ramen', 'curry', 'beans on toast'],
  ['vegan', 'vegetarian', 'carnivore', 'flexitarian'],
  ['gin', 'whisky', 'vodka', 'rum'],
  ['michelin', 'pub', 'chippy', 'drive-thru'],
  ['breakfast', 'brunch', 'lunch', 'elevenses'],

  // ── LIFE STAGES ──
  ['birth', 'death', 'marriage', 'divorce'],
  ['school', 'university', 'job', 'retirement'],
  ['baby', 'toddler', 'teenager', 'pensioner'],
  ['boomer', 'millennial', 'genz', 'avocado'],
  ['rent', 'mortgage', 'deposit', 'inheritance'],

  // ── CRISIS WORDS ──
  ['pandemic', 'outbreak', 'epidemic', 'manflu'],
  ['doom', 'apocalypse', 'disaster', 'monday'],
  ['zombie', 'ghost', 'vampire', 'politician'],
  ['recession', 'inflation', 'crash', 'austerity'],

  // ── COLOURS ──
  ['red', 'blue', 'green', 'orange'],
  ['black', 'white', 'grey', 'rainbow'],
  ['crimson', 'scarlet', 'burgundy', 'pink'],

  // ── MONARCHY + ROYALTY ──
  ['queen', 'king', 'prince', 'princess'],
  ['harry', 'william', 'meghan', 'kate'],
  ['charles', 'diana', 'philip', 'margaret'],
  ['buckingham', 'windsor', 'balmoral', 'sandringham'],

  // ── ZEITGEIST ──
  ['brexit', 'covid', 'ukraine', 'gaza'],
  ['climate', 'inflation', 'strikes', 'cost'],
  ['nhs', 'hospital', 'gp', 'waiting'],

  // ── ECONOMY ──
  ['money', 'tax', 'debt', 'jackpot'],
  ['millionaire', 'billionaire', 'trillionaire', 'pound'],
  ['inflation', 'recession', 'growth', 'stagflation'],
  ['bitcoin', 'ethereum', 'dogecoin', 'monopoly money'],

  // ── NOSTALGIA ──
  ['vhs', 'dvd', 'blu-ray', 'vinyl'],
  ['walkman', 'ipod', 'spotify', 'cassette'],
  ['typewriter', 'laptop', 'tablet', 'clay tablet'],

  // ── WORKPLACE ──
  ['commute', 'remote', 'hybrid', 'office'],
  ['monday', 'friday', 'weekend', 'holiday'],
  ['boss', 'colleague', 'intern', 'freelancer'],

  // ── BRITISH CULTURE ──
  ['queue', 'weather', 'tea', 'disappointment'],
  ['fish', 'chips', 'curry', 'roast'],
  ['marmite', 'marmalade', 'crumpet', 'yorkshire pudding'],
  ['pub', 'club', 'cafe', 'greggs'],

  // ── GLOBAL EVENTS ──
  ['olympics', 'worldcup', 'eurovision', 'glastonbury'],
  ['wedding', 'funeral', 'coronation', 'inauguration'],

  // ── RANDOM JOY ──
  ['sunshine', 'rainbow', 'unicorn', 'sparkle'],
  ['chaos', 'order', 'mayhem', 'admin'],
  ['simple', 'complex', 'chaotic', 'tuesday'],
];

// ─────────────── TAG RECIPES ───────────────
// Uses canonical Guardian tag IDs. If fewer than 3 tags in a recipe exist
// in the catalog, it's filtered out.

// All tag IDs below verified against the actual catalog. Recipes with
// fewer than 3 valid tags are automatically filtered out at runtime.
export const TAG_RECIPES = [
  // ── UK POLITICS ──
  ['politics/keir-starmer', 'us-news/donaldtrump', 'politics/kemi-badenoch', 'politics/nigel-farage'],
  ['politics/labour', 'politics/conservatives', 'politics/liberaldemocrats', 'politics/greenparty'],
  ['politics/boris-johnson', 'politics/theresa-may', 'politics/liz-truss', 'politics/rishi-sunak'],
  ['politics/keir-starmer', 'politics/jeremy-corbyn', 'politics/edmiliband', 'politics/gordon-brown'],
  ['politics/tonyblair', 'politics/gordon-brown', 'politics/david-cameron', 'politics/theresa-may'],

  // ── US POLITICS ──
  ['us-news/donaldtrump', 'us-news/joebiden', 'us-news/barack-obama', 'us-news/kamala-harris'],
  ['us-news/republicans', 'us-news/democrats', 'us-news/us-supreme-court', 'us-news/us-congress'],
  ['us-news/texas', 'us-news/california', 'us-news/florida', 'us-news/new-york'],
  ['us-news/hillary-clinton', 'us-news/bernie-sanders', 'us-news/elizabeth-warren', 'us-news/joebiden'],

  // ── WORLD LEADERS ──
  ['world/vladimir-putin', 'world/volodymyr-zelenskiy', 'world/benjamin-netanyahu', 'world/xi-jinping'],
  ['world/emmanuel-macron', 'world/olaf-scholz', 'world/angela-merkel', 'world/narendra-modi'],
  ['world/xi-jinping', 'world/kim-jong-un', 'world/mohammed-bin-salman', 'world/narendra-modi'],

  // ── FOOTBALL ──
  ['football/arsenal', 'football/liverpool', 'football/chelsea', 'football/tottenham-hotspur'],
  ['football/manchester-united', 'football/manchestercity', 'football/arsenal', 'football/liverpool'],
  ['football/premierleague', 'football/championsleague', 'football/fa-cup', 'football/efl-cup'],
  ['football/world-cup-football', 'football/world-cup-2018', 'football/world-cup-2022', 'football/womens-world-cup'],
  ['football/ronaldo', 'football/lionel-messi', 'football/erling-haaland', 'football/harry-kane'],

  // ── SPORT ──
  ['sport/cricket', 'sport/rugby-union', 'sport/tennis', 'sport/golf'],
  ['sport/wimbledon', 'sport/us-open-tennis', 'sport/french-open', 'sport/australian-open'],
  ['sport/olympic-games', 'sport/paralympics', 'sport/commonwealth-games', 'sport/super-bowl'],
  ['sport/formula-one', 'sport/nfl', 'sport/nba', 'sport/cycling'],
  ['sport/novak-djokovic', 'sport/roger-federer', 'sport/rafaelnadal', 'sport/andymurray'],
  ['sport/lewis-hamilton', 'sport/max-verstappen', 'sport/jensonbutton', 'sport/nicorosberg'],

  // ── ENVIRONMENT ──
  ['environment/climate-crisis', 'business/oilandgascompanies', 'environment/renewableenergy', 'environment/greenhouse-gas-emissions'],
  ['environment/wildlife', 'environment/conservation', 'environment/pollution', 'environment/plastic'],
  ['environment/greta-thunberg', 'environment/extinction-rebellion', 'environment/greenpeace', 'environment/cop26'],

  // ── TECH ──
  ['technology/artificialintelligenceai', 'technology/chatgpt', 'technology/cryptocurrencies', 'technology/openai'],
  ['technology/apple', 'technology/google', 'technology/microsoft', 'technology/meta'],
  ['technology/elon-musk', 'technology/mark-zuckerberg', 'technology/jeff-bezos', 'technology/billgates'],
  ['technology/tesla', 'science/spacex', 'technology/twitter', 'technology/tiktok'],

  // ── CULTURE + MUSIC ──
  ['music/taylor-swift', 'music/beyonce', 'music/adele', 'music/harry-styles'],
  ['music/thebeatles', 'music/therollingstones', 'music/davidbowie', 'music/davidbowie'],
  ['music/drake', 'music/kanye-west', 'music/jayz', 'music/kendrick-lamar'],
  ['music/ed-sheeran', 'music/dua-lipa', 'music/billieeilish', 'music/taylor-swift'],

  // ── FILM ──
  ['film/oscars', 'film/baftas', 'film/cannesfilmfestival', 'music/grammys'],
  ['film/martinscorsese', 'film/quentintarantino', 'film/christophernolan', 'film/stevenspielberg'],
  ['film/leonardodicaprio', 'film/tomcruise', 'film/bradpitt', 'film/georgeclooney'],
  ['film/barbie', 'film/jamesbond', 'film/harrypotter', 'film/star-wars-episode-vii'],
  ['culture/marvel', 'film/harrypotter', 'film/jamesbond', 'film/star-wars-episode-vii'],

  // ── TELEVISION ──
  ['tv-and-radio/succession', 'tv-and-radio/the-crown', 'tv-and-radio/game-of-thrones', 'tv-and-radio/strictly-come-dancing'],
  ['tv-and-radio/strictly-come-dancing', 'tv-and-radio/the-great-british-bake-off', 'tv-and-radio/love-island', 'tv-and-radio/doctor-who'],
  ['tv-and-radio/doctor-who', 'tv-and-radio/bbc', 'media/bbc', 'media/bbc1'],

  // ── WRITERS + BOOKS ──
  ['books/jkrowling', 'books/stephenking', 'books/margaretatwood', 'books/booker-prize'],
  ['books/booker-prize', 'books/fiction', 'books/non-fiction', 'books/biography'],
  ['books/harrypotter', 'film/harrypotter', 'books/jkrowling', 'film/oscars'],

  // ── ROYALTY ──
  ['uk/prince-harry', 'uk-news/meghan-duchess-of-sussex', 'uk/prince-charles', 'uk/prince-andrew'],
  ['uk-news/king-charles-coronation', 'uk/the-queen', 'uk/prince-philip', 'uk-news/queen-elizabeth-ii-death'],

  // ── CONFLICT ──
  ['world/ukraine', 'world/israel-hamas-war', 'world/gaza', 'world/syria'],
  ['world/russia', 'world/china', 'world/iran', 'world/north-korea'],
  ['world/hamas', 'world/hezbollah', 'world/taliban', 'world/isis-islamic-state'],

  // ── ECONOMY ──
  ['business/inflation', 'business/interest-rates', 'business/cost-of-living-crisis', 'business/recession'],
  ['business/bankofenglandgovernor', 'business/federal-reserve', 'business/imf', 'business/world-bank'],

  // ── FOOD + LIFESTYLE ──
  ['food/food', 'lifeandstyle/food-and-drink', 'food/recipes', 'food/restaurants'],
  ['food/jamie-oliver', 'food/nigella-lawson', 'food/gordon-ramsay', 'food/yotam-ottolenghi'],

  // ── HEALTH ──
  ['society/health', 'society/mental-health', 'world/coronavirus-outbreak', 'society/nhs'],
  ['society/nhs', 'society/health', 'society/cancer', 'society/obesity'],

  // ── WORLD ──
  ['world/china', 'world/russia', 'world/iran', 'world/north-korea'],
  ['world/hong-kong', 'world/taiwan', 'world/japan', 'world/south-korea'],

  // ── ACTIVISTS + NOTABLE FIGURES ──
  ['environment/greta-thunberg', 'technology/elon-musk', 'technology/mark-zuckerberg', 'technology/jeff-bezos'],

  // ── JOURNALISM / MEDIA ──
  ['media/bbc', 'media/itv', 'media/channel-4', 'media/sky'],
  ['media/rupert-murdoch', 'media/bbc', 'media/guardian-news-media', 'media/dailymail'],
];

// ─────────────── PICKERS ───────────────

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
