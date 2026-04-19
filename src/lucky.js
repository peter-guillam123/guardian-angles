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
  // ── 🥚 EASTER EGG ──
  ['chris', 'helene', 'tess', 'finn'],

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

  // ── US POLITICS ──
  ['trump', 'biden', 'obama', 'clinton'],
  ['reagan', 'bush', 'clinton', 'kennedy'],
  ['harris', 'vance', 'pence', 'rubio'],
  ['democrat', 'republican', 'maga', 'socialist'],
  ['aoc', 'sanders', 'warren', 'pelosi'],
  ['desantis', 'newsom', 'abbott', 'hochul'],
  ['cruz', 'schumer', 'mcconnell', 'romney'],
  ['cheney', 'palin', 'haley', 'ramaswamy'],
  ['kennedy', 'roosevelt', 'lincoln', 'washington'],
  ['hillary', 'bernie', 'buttigieg', 'yang'],
  ['texas', 'california', 'florida', 'new york'],

  // ── UK POLITICS ──
  ['corbyn', 'starmer', 'johnson', 'badenoch'],
  ['remain', 'leave', 'brexit', 'rejoin'],
  ['labour', 'conservatives', 'libdems', 'reform'],
  ['blair', 'brown', 'cameron', 'may'],
  ['thatcher', 'major', 'blair', 'sunak'],
  ['truss', 'sunak', 'johnson', 'farage'],
  ['davey', 'starmer', 'badenoch', 'farage'],

  // ── WORLD LEADERS ──
  ['putin', 'zelensky', 'xi', 'modi'],
  ['netanyahu', 'abbas', 'erdogan', 'saudi'],
  ['macron', 'merkel', 'scholz', 'meloni'],
  ['le pen', 'mélenchon', 'macron', 'zemmour'],
  ['merkel', 'scholz', 'schroeder', 'kohl'],
  ['meloni', 'salvini', 'draghi', 'berlusconi'],
  ['lula', 'bolsonaro', 'milei', 'maduro'],
  ['amlo', 'sheinbaum', 'calderón', 'peña'],
  ['modi', 'gandhi', 'nehru', 'rahul'],
  ['orban', 'tusk', 'duda', 'fico'],
  ['sánchez', 'rajoy', 'zapatero', 'aznar'],

  // ── WORLD CITIES ──
  ['london', 'paris', 'berlin', 'madrid'],
  ['new york', 'los angeles', 'chicago', 'miami'],
  ['tokyo', 'beijing', 'seoul', 'mumbai'],
  ['dublin', 'edinburgh', 'cardiff', 'belfast'],
  ['athens', 'rome', 'istanbul', 'jerusalem'],
  ['venice', 'florence', 'rome', 'naples'],
  ['barcelona', 'madrid', 'seville', 'granada'],
  ['lisbon', 'porto', 'madeira', 'azores'],
  ['amsterdam', 'brussels', 'copenhagen', 'stockholm'],
  ['prague', 'budapest', 'warsaw', 'vienna'],
  ['moscow', 'st petersburg', 'kyiv', 'minsk'],
  ['rio', 'buenos aires', 'santiago', 'lima'],
  ['cape town', 'lagos', 'nairobi', 'marrakech'],
  ['bangkok', 'singapore', 'hanoi', 'jakarta'],
  ['dubai', 'doha', 'riyadh', 'tehran'],
  ['san francisco', 'boston', 'seattle', 'austin'],
  ['toronto', 'montreal', 'vancouver', 'calgary'],

  // ── WORLD COUNTRIES ──
  ['france', 'germany', 'italy', 'spain'],
  ['china', 'japan', 'korea', 'vietnam'],
  ['brazil', 'argentina', 'mexico', 'chile'],
  ['egypt', 'kenya', 'nigeria', 'ethiopia'],
  ['russia', 'ukraine', 'belarus', 'moldova'],
  ['india', 'pakistan', 'bangladesh', 'nepal'],
  ['canada', 'australia', 'new zealand', 'greenland'],
  ['sweden', 'norway', 'denmark', 'finland'],
  ['poland', 'hungary', 'czechia', 'slovakia'],
  ['south africa', 'zimbabwe', 'rwanda', 'senegal'],
  ['colombia', 'venezuela', 'cuba', 'peru'],
  ['iran', 'iraq', 'syria', 'lebanon'],
  ['yemen', 'oman', 'bahrain', 'kuwait'],

  // ── TOURIST WONDERS ──
  ['colosseum', 'pantheon', 'acropolis', 'parthenon'],
  ['pyramids', 'sphinx', 'machu picchu', 'petra'],
  ['taj mahal', 'angkor', 'great wall', 'pompeii'],
  ['louvre', 'prado', 'uffizi', 'met'],
  ['eiffel', 'statue of liberty', 'big ben', 'sydney opera'],
  ['niagara', 'grand canyon', 'yosemite', 'yellowstone'],
  ['vatican', 'mecca', 'jerusalem', 'varanasi'],
  ['stonehenge', 'chichen itza', 'easter island', 'nazca'],
  ['eden', 'atlantis', 'babylon', 'troy'],

  // ── RIVERS ──
  ['thames', 'seine', 'danube', 'tiber'],
  ['nile', 'amazon', 'mississippi', 'yangtze'],
  ['ganges', 'mekong', 'volga', 'rhine'],
  ['tigris', 'euphrates', 'jordan', 'rubicon'],
  ['hudson', 'potomac', 'colorado', 'rio grande'],

  // ── CARS ──
  ['ferrari', 'lamborghini', 'porsche', 'bentley'],
  ['bmw', 'mercedes', 'audi', 'volkswagen'],
  ['toyota', 'honda', 'nissan', 'mazda'],
  ['tesla', 'rivian', 'lucid', 'byd'],
  ['ford', 'chevrolet', 'jeep', 'cadillac'],
  ['bugatti', 'aston martin', 'mclaren', 'pagani'],
  ['fiat', 'alfa romeo', 'maserati', 'lancia'],
  ['mustang', 'corvette', 'camaro', 'charger'],

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
  ['nvidia', 'intel', 'amd', 'arm'],
  ['uber', 'lyft', 'airbnb', 'deliveroo'],

  // ── FILM + TV ──
  ['oscar', 'bafta', 'grammy', 'razzie'],
  ['hollywood', 'bollywood', 'netflix', 'bbc'],
  ['scorsese', 'tarantino', 'spielberg', 'nolan'],
  ['villeneuve', 'fincher', 'chazelle', 'aronofsky'],
  ['greta gerwig', 'sofia coppola', 'jane campion', 'chloé zhao'],
  ['wes anderson', 'paul thomas anderson', 'tarantino', 'coen'],
  ['miyazaki', 'kurosawa', 'ozu', 'kore-eda'],
  ['almodóvar', 'haneke', 'varda', 'godard'],
  ['cruise', 'pitt', 'clooney', 'dicaprio'],
  ['streep', 'blanchett', 'winslet', 'dench'],
  ['denzel', 'hanks', 'de niro', 'pacino'],
  ['freeman', 'jackson', 'murphy', 'washington'],
  ['robbie', 'pugh', 'zendaya', 'sweeney'],
  ['nicholson', 'hoffman', 'redford', 'newman'],
  ['timothée', 'tom holland', 'austin butler', 'jacob elordi'],
  ['saoirse ronan', 'carey mulligan', 'olivia colman', 'florence pugh'],
  ['jeremy strong', 'brian cox', 'matthew macfadyen', 'kieran culkin'],
  ['barbie', 'oppenheimer', 'batman', 'barbenheimer'],
  ['marvel', 'dc', 'disney', 'pixar'],
  ['starwars', 'bond', 'potter', 'hobbit'],
  ['succession', 'sopranos', 'wire', 'breaking bad'],
  ['friends', 'seinfeld', 'cheers', 'frasier'],
  ['sherlock', 'fleabag', 'doctor who', 'bridgerton'],
  ['hitchcock', 'kubrick', 'lynch', 'tarantino'],
  ['squid game', 'parasite', 'old boy', 'train to busan'],

  // ── MUSIC ──
  ['beatles', 'stones', 'who', 'kinks'],
  ['oasis', 'blur', 'pulp', 'suede'],
  ['taylor swift', 'beyoncé', 'adele', 'rihanna'],
  ['drake', 'kanye', 'kendrick', 'jay-z'],
  ['bowie', 'dylan', 'lennon', 'prince'],
  ['madonna', 'cher', 'mariah', 'whitney'],
  ['gaga', 'katy perry', 'pink', 'rihanna'],
  ['ed sheeran', 'harry styles', 'bruno mars', 'the weeknd'],
  ['olivia rodrigo', 'billie eilish', 'lorde', 'sza'],
  ['bad bunny', 'shakira', 'j balvin', 'rosalía'],
  ['bts', 'blackpink', 'twice', 'stray kids'],
  ['sam smith', 'lewis capaldi', 'lizzo', 'post malone'],
  ['pop', 'rock', 'hiphop', 'classical'],
  ['punk', 'metal', 'indie', 'emo'],
  ['techno', 'house', 'garage', 'drum and bass'],
  ['glastonbury', 'coachella', 'reading', 'eurovision'],
  ['radiohead', 'coldplay', 'muse', 'arctic monkeys'],
  ['bruce springsteen', 'tom petty', 'neil young', 'leonard cohen'],

  // ── LITERATURE + ART ──
  ['rowling', 'king', 'pullman', 'ishiguro'],
  ['orwell', 'woolf', 'joyce', 'austen'],
  ['booker', 'nobel', 'costa', 'pulitzer'],
  ['banksy', 'hirst', 'emin', 'warhol'],
  ['picasso', 'monet', 'rembrandt', 'turner'],
  ['shakespeare', 'dickens', 'chaucer', 'marlowe'],
  ['murakami', 'ishiguro', 'kafka', 'camus'],
  ['rushdie', 'atwood', 'morrison', 'marquez'],
  ['zadie smith', 'sally rooney', 'chimamanda', 'ocean vuong'],
  ['da vinci', 'michelangelo', 'raphael', 'donatello'],
  ['van gogh', 'cézanne', 'gauguin', 'matisse'],

  // ── WEATHER + NATURE ──
  ['sun', 'rain', 'snow', 'wind'],
  ['spring', 'summer', 'autumn', 'winter'],
  ['storm', 'heatwave', 'drought', 'flood'],
  ['forest', 'ocean', 'glacier', 'desert'],
  ['whale', 'shark', 'dolphin', 'goldfish'],
  ['tiger', 'lion', 'bear', 'koala'],
  ['dog', 'cat', 'horse', 'dragon'],
  ['eagle', 'owl', 'penguin', 'flamingo'],

  // ── FOOD + DRINK ──
  ['bread', 'butter', 'cheese', 'crumpet'],
  ['coffee', 'tea', 'wine', 'water'],
  ['pizza', 'pasta', 'burger', 'rhubarb'],
  ['sushi', 'ramen', 'curry', 'beans on toast'],
  ['vegan', 'vegetarian', 'carnivore', 'flexitarian'],
  ['gin', 'whisky', 'vodka', 'rum'],
  ['michelin', 'pub', 'chippy', 'drive-thru'],
  ['breakfast', 'brunch', 'lunch', 'elevenses'],
  ['chocolate', 'caramel', 'toffee', 'praline'],
  ['martini', 'negroni', 'margarita', 'espresso'],
  ['paella', 'risotto', 'tagine', 'biryani'],

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
  ['lego', 'barbie', 'hotwheels', 'scalextric'],
  ['polaroid', 'kodak', 'instagram', 'disposable'],
  ['tamagotchi', 'furby', 'pokémon', 'beanie baby'],

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
  ['oscars', 'met gala', 'cannes', 'venice'],

  // ── SPACE + SCIENCE ──
  ['nasa', 'spacex', 'esa', 'roscosmos'],
  ['moon', 'mars', 'venus', 'saturn'],
  ['apollo', 'voyager', 'hubble', 'webb'],
  ['einstein', 'newton', 'hawking', 'feynman'],
  ['darwin', 'curie', 'tesla', 'edison'],
  ['galaxy', 'nebula', 'blackhole', 'supernova'],

  // ── VIDEO GAMES ──
  ['mario', 'zelda', 'sonic', 'pokémon'],
  ['minecraft', 'fortnite', 'roblox', 'tetris'],
  ['nintendo', 'playstation', 'xbox', 'sega'],
  ['pacman', 'donkey kong', 'space invaders', 'pong'],
  ['gta', 'call of duty', 'fifa', 'candy crush'],

  // ── FASHION ──
  ['chanel', 'dior', 'gucci', 'prada'],
  ['louis vuitton', 'hermès', 'ysl', 'balenciaga'],
  ['vogue', 'elle', 'tatler', 'grazia'],

  // ── RELIGION ──
  ['pope', 'dalai lama', 'archbishop', 'imam'],
  ['christianity', 'islam', 'hinduism', 'buddhism'],
  ['easter', 'christmas', 'ramadan', 'diwali'],

  // ── LAW + ORDER ──
  ['trial', 'verdict', 'sentence', 'appeal'],
  ['jury', 'judge', 'barrister', 'solicitor'],
  ['prison', 'bail', 'parole', 'pardon'],

  // ── TRANSPORT ──
  ['train', 'plane', 'boat', 'bicycle'],
  ['airbus', 'boeing', 'concorde', 'spitfire'],
  ['eurostar', 'orient express', 'mag-lev', 'underground'],

  // ── RANDOM JOY ──
  ['sunshine', 'rainbow', 'unicorn', 'sparkle'],
  ['chaos', 'order', 'mayhem', 'admin'],
  ['simple', 'complex', 'chaotic', 'tuesday'],
  ['sunrise', 'sunset', 'dawn', 'dusk'],
];

// ─────────────── TAG RECIPES ───────────────
// Uses canonical Guardian tag IDs. If fewer than 3 tags in a recipe exist
// in the catalog, it's filtered out.

export const TAG_RECIPES = [
  // ── 🥚 EASTER EGG — the strongman quartet ──
  ['us-news/donaldtrump', 'world/viktor-orban', 'world/vladimir-putin', 'world/kim-jong-un'],

  // ── UK POLITICS ──
  ['politics/keir-starmer', 'us-news/donaldtrump', 'politics/kemi-badenoch', 'politics/nigel-farage'],
  ['politics/labour', 'politics/conservatives', 'politics/liberaldemocrats', 'politics/greenparty'],
  ['politics/boris-johnson', 'politics/theresa-may', 'politics/liz-truss', 'politics/rishi-sunak'],
  ['politics/keir-starmer', 'politics/jeremy-corbyn', 'politics/edmiliband', 'politics/gordon-brown'],
  ['politics/tonyblair', 'politics/gordon-brown', 'politics/davidcameron', 'politics/theresa-may'],
  ['politics/margaretthatcher', 'politics/johnmajor', 'politics/tonyblair', 'politics/gordon-brown'],
  ['politics/kemi-badenoch', 'politics/liz-truss', 'politics/theresa-may', 'politics/margaretthatcher'],
  ['politics/nigel-farage', 'politics/reformuk', 'politics/conservatives', 'politics/ukip'],
  ['politics/keir-starmer', 'politics/kemi-badenoch', 'politics/nigel-farage', 'politics/ed-davey'],

  // ── US POLITICS ──
  ['us-news/donaldtrump', 'us-news/joebiden', 'us-news/barack-obama', 'us-news/kamala-harris'],
  ['us-news/republicans', 'us-news/democrats', 'us-news/us-supreme-court', 'us-news/us-congress'],
  ['us-news/texas', 'us-news/california', 'us-news/florida', 'us-news/new-york'],
  ['us-news/hillary-clinton', 'us-news/bernie-sanders', 'us-news/elizabeth-warren', 'us-news/barack-obama'],
  ['us-news/alexandria-ocasio-cortez', 'us-news/bernie-sanders', 'us-news/elizabeth-warren', 'us-news/nancy-pelosi'],
  ['us-news/ron-desantis', 'us-news/gavin-newsom', 'us-news/mike-pence', 'us-news/jd-vance'],
  ['us-news/ted-cruz', 'us-news/marco-rubio', 'us-news/pete-buttigieg', 'us-news/tim-walz'],
  ['us-news/hillary-clinton', 'us-news/kamala-harris', 'us-news/elizabeth-warren', 'us-news/nancy-pelosi'],
  ['us-news/donaldtrump', 'us-news/kamala-harris', 'us-news/joebiden', 'us-news/barack-obama'],
  ['us-news/donaldtrump', 'us-news/jd-vance', 'us-news/mike-pence', 'us-news/ron-desantis'],

  // ── EUROPEAN LEADERS ──
  ['world/emmanuel-macron', 'world/olaf-scholz', 'world/angela-merkel', 'world/narendra-modi'],
  ['world/emmanuel-macron', 'world/marine-le-pen', 'world/nicolas-sarkozy', 'world/francois-hollande'],
  ['world/angela-merkel', 'world/olaf-scholz', 'world/giorgia-meloni', 'world/viktor-orban'],
  ['world/viktor-orban', 'world/vladimir-putin', 'world/recep-tayyip-erdogan', 'us-news/donaldtrump'],
  ['world/giorgia-meloni', 'world/marine-le-pen', 'world/viktor-orban', 'politics/nigel-farage'],
  ['world/angela-merkel', 'world/giorgia-meloni', 'world/marine-le-pen', 'politics/kemi-badenoch'],

  // ── WORLD LEADERS ──
  ['world/vladimir-putin', 'world/volodymyr-zelenskiy', 'world/benjamin-netanyahu', 'world/xi-jinping'],
  ['world/xi-jinping', 'world/kim-jong-un', 'world/mohammed-bin-salman', 'world/narendra-modi'],
  ['world/vladimir-putin', 'world/volodymyr-zelenskiy', 'world/viktor-orban', 'world/recep-tayyip-erdogan'],
  ['world/benjamin-netanyahu', 'world/mohammed-bin-salman', 'world/recep-tayyip-erdogan', 'world/hassan-rouhani'],
  ['world/narendra-modi', 'world/xi-jinping', 'world/imran-khan', 'world/aung-san-suu-kyi'],

  // ── LATIN AMERICA ──
  ['world/luiz-inacio-lula-da-silva', 'world/jair-bolsonaro', 'world/nicolas-maduro', 'world/pope-francis'],
  ['world/argentina', 'world/brazil', 'world/mexico', 'world/chile'],
  ['world/colombia', 'world/venezuela', 'world/cuba', 'world/brazil'],
  ['world/brazil', 'world/argentina', 'world/mexico', 'world/cuba'],

  // ── AFRICA ──
  ['world/nigeria', 'world/kenya', 'world/ethiopia', 'world/ghana'],
  ['world/africa', 'world/zimbabwe', 'world/egypt', 'world/nigeria'],

  // ── ASIA ──
  ['world/china', 'world/japan', 'world/north-korea', 'world/south-korea'],
  ['world/hong-kong', 'world/taiwan', 'world/japan', 'world/south-korea'],
  ['world/india', 'world/pakistan', 'world/bangladesh', 'world/sri-lanka'],

  // ── MIDDLE EAST ──
  ['world/israel', 'world/palestinian-territories', 'world/iran', 'world/egypt'],
  ['world/hamas', 'world/hezbollah', 'world/taliban', 'world/isis-islamic-state'],
  ['world/iran', 'world/iraq', 'world/syria', 'world/lebanon'],
  ['world/turkey', 'world/egypt', 'world/iran', 'world/israel'],

  // ── EUROPE ──
  ['world/france', 'world/germany', 'world/italy', 'world/spain'],
  ['world/poland', 'world/hungary', 'world/ukraine', 'world/belarus'],
  ['world/sweden', 'world/norway', 'world/finland', 'world/denmark'],
  ['world/greece', 'world/portugal', 'world/netherlands', 'world/belgium'],
  ['world/ukraine', 'world/russia', 'world/volodymyr-zelenskiy', 'world/vladimir-putin'],

  // ── FOOTBALL CLUBS ──
  ['football/arsenal', 'football/liverpool', 'football/chelsea', 'football/tottenham-hotspur'],
  ['football/manchester-united', 'football/manchestercity', 'football/arsenal', 'football/liverpool'],
  ['football/realmadrid', 'football/barcelona', 'football/atleticomadrid', 'football/sevilla'],
  ['football/juventus', 'football/acmilan', 'football/realmadrid', 'football/barcelona'],
  ['football/parisstgermain', 'football/realmadrid', 'football/juventus', 'football/bayernmunich'],
  ['football/bayernmunich', 'football/borussiadortmund', 'football/realmadrid', 'football/barcelona'],
  ['football/liverpool', 'football/everton', 'football/manchester-united', 'football/leeds'],

  // ── FOOTBALL COMPETITIONS ──
  ['football/premierleague', 'football/championsleague', 'football/fa-cup', 'football/efl-cup'],
  ['football/world-cup-football', 'football/world-cup-2018', 'football/world-cup-2022', 'football/womens-world-cup'],
  ['football/premierleague', 'football/championsleague', 'football/fa-cup', 'football/realmadrid'],

  // ── FOOTBALL PLAYERS ──
  ['football/ronaldo', 'football/lionel-messi', 'football/erling-haaland', 'football/harry-kane'],
  ['football/lionel-messi', 'football/ronaldo', 'football/harry-kane', 'football/wayne-rooney'],
  ['football/harry-kane', 'football/mohamed-salah', 'football/lionel-messi', 'football/ronaldo'],

  // ── NATIONAL FOOTBALL TEAMS ──
  ['football/england', 'football/france', 'football/germany', 'football/spain'],
  ['football/brazil', 'football/argentina', 'football/italy', 'football/portugal'],

  // ── SPORT GENERAL ──
  ['sport/cricket', 'sport/rugby-union', 'sport/tennis', 'sport/golf'],
  ['sport/wimbledon', 'sport/novak-djokovic', 'sport/serena-williams', 'sport/andymurray'],
  ['sport/olympic-games', 'sport/paralympics', 'sport/commonwealth-games', 'sport/super-bowl'],
  ['sport/formula-one', 'sport/nfl', 'sport/nba', 'sport/cycling'],
  ['sport/olympic-games', 'sport/olympics-2012', 'sport/winter-olympics', 'sport/paralympics'],
  ['sport/boxing', 'sport/ufc', 'sport/horse-racing', 'sport/golf'],

  // ── TENNIS + F1 + OLYMPIANS ──
  ['sport/novak-djokovic', 'sport/roger-federer', 'sport/rafaelnadal', 'sport/andymurray'],
  ['sport/lewis-hamilton', 'sport/max-verstappen', 'sport/novak-djokovic', 'sport/roger-federer'],
  ['sport/serena-williams', 'sport/novak-djokovic', 'sport/roger-federer', 'sport/rafaelnadal'],
  ['sport/lebron-james', 'sport/serena-williams', 'sport/lewis-hamilton', 'sport/novak-djokovic'],

  // ── ENVIRONMENT ──
  ['environment/climate-crisis', 'business/oilandgascompanies', 'environment/renewableenergy', 'environment/greenhouse-gas-emissions'],
  ['environment/wildlife', 'environment/conservation', 'environment/pollution', 'environment/plastic'],
  ['environment/greta-thunberg', 'environment/extinction-rebellion', 'environment/greenpeace', 'environment/cop26-glasgow-climate-change-conference-2021'],
  ['environment/renewableenergy', 'environment/solarpower', 'environment/nuclearpower', 'environment/fossil-fuels'],
  ['environment/wildfires', 'world/wildfires', 'environment/climate-crisis', 'world/earthquakes'],
  ['environment/electric-cars', 'technology/self-driving-cars', 'technology/tesla', 'technology/motoring'],
  ['environment/amazon-rainforest', 'environment/biodiversity', 'environment/rewilding', 'environment/conservation'],
  ['environment/paris-climate-agreement', 'environment/cop27', 'environment/cop28', 'environment/climate-crisis'],

  // ── TECH ──
  ['technology/artificialintelligenceai', 'technology/chatgpt', 'technology/cryptocurrencies', 'technology/openai'],
  ['technology/apple', 'technology/google', 'technology/microsoft', 'technology/meta'],
  ['technology/elon-musk', 'technology/mark-zuckerberg', 'technology/jeff-bezos', 'technology/billgates'],
  ['technology/tesla', 'science/spacex', 'technology/twitter', 'technology/tiktok'],
  ['technology/facebook', 'technology/instagram', 'technology/whatsapp', 'technology/youtube'],
  ['technology/tiktok', 'technology/twitter', 'technology/snapchat', 'technology/instagram'],
  ['technology/amazon', 'media/netflix', 'technology/apple', 'technology/google'],
  ['technology/artificialintelligenceai', 'technology/chatgpt', 'technology/openai', 'technology/google'],

  // ── MUSIC ──
  ['music/taylor-swift', 'music/beyonce', 'music/adele', 'music/harry-styles'],
  ['music/thebeatles', 'music/therollingstones', 'music/davidbowie', 'music/oasis'],
  ['music/drake', 'music/kanyewest', 'music/jayz', 'music/kendrick-lamar'],
  ['music/ed-sheeran', 'music/adele', 'music/taylor-swift', 'music/beyonce'],
  ['music/bobdylan', 'music/thebeatles', 'music/therollingstones', 'music/davidbowie'],
  ['music/lady-gaga', 'music/rihanna', 'music/madonna', 'music/beyonce'],
  ['music/prince', 'music/madonna', 'music/elton-john', 'music/johnlennon'],
  ['music/beyonce', 'music/rihanna', 'music/taylor-swift', 'music/lady-gaga'],

  // ── FILM DIRECTORS + STARS ──
  ['film/oscars', 'film/baftas', 'film/cannesfilmfestival', 'music/grammys'],
  ['film/martinscorsese', 'film/quentintarantino', 'film/christopher-nolan', 'film/stevenspielberg'],
  ['film/leonardodicaprio', 'film/tomcruise', 'film/bradpitt', 'film/georgeclooney'],
  ['film/merylstreep', 'film/cate-blanchett', 'film/leonardodicaprio', 'film/tomhanks'],
  ['film/alfredhitchcock', 'film/stanleykubrick', 'film/martinscorsese', 'film/christopher-nolan'],
  ['film/barbie', 'film/jamesbond', 'film/harrypotter', 'film/star-wars-episode-vii'],
  ['culture/marvel', 'film/harrypotter', 'film/jamesbond', 'film/star-wars-episode-vii'],

  // ── TELEVISION ──
  ['tv-and-radio/succession', 'tv-and-radio/the-crown', 'tv-and-radio/game-of-thrones', 'tv-and-radio/strictly-come-dancing'],
  ['tv-and-radio/strictly-come-dancing', 'tv-and-radio/the-great-british-bake-off', 'tv-and-radio/love-island', 'tv-and-radio/doctor-who'],
  ['tv-and-radio/doctor-who', 'tv-and-radio/bbc', 'media/bbc', 'media/bbc1'],
  ['tv-and-radio/succession', 'tv-and-radio/game-of-thrones', 'tv-and-radio/the-crown', 'tv-and-radio/breaking-bad'],

  // ── WRITERS + BOOKS ──
  ['books/jkrowling', 'books/stephenking', 'books/margaretatwood', 'books/booker-prize'],
  ['books/booker-prize', 'books/fiction', 'books/non-fiction', 'books/biography'],
  ['books/harrypotter', 'film/harrypotter', 'books/jkrowling', 'film/oscars'],
  ['books/jkrowling', 'books/stephenking', 'books/margaretatwood', 'books/salmanrushdie'],
  ['books/hilary-mantel', 'books/margaretatwood', 'books/jkrowling', 'books/salmanrushdie'],

  // ── ROYALTY ──
  ['uk/prince-harry', 'uk-news/meghan-duchess-of-sussex', 'uk/prince-charles', 'uk/prince-andrew'],
  ['uk-news/king-charles-coronation', 'uk/queen', 'uk/prince-philip', 'uk-news/queen-elizabeth-ii-death'],

  // ── CONFLICT ──
  ['world/ukraine', 'world/israel-hamas-war', 'world/gaza', 'world/syria'],
  ['world/russia', 'world/china', 'world/iran', 'world/north-korea'],
  ['world/hamas', 'world/hezbollah', 'world/taliban', 'world/isis-islamic-state'],
  ['world/ukraine', 'world/russia', 'world/israel-hamas-war', 'world/gaza'],

  // ── ECONOMY ──
  ['business/inflation', 'business/interest-rates', 'business/cost-of-living-crisis', 'business/recession'],
  ['business/bankofenglandgovernor', 'business/federal-reserve', 'business/imf', 'business/world-bank'],

  // ── FOOD + LIFESTYLE ──
  ['food/restaurants', 'food/wine', 'food/beer', 'food/baking'],
  ['food/jamie-oliver', 'food/wine', 'food/baking', 'food/cocktails'],
  ['food/wine', 'food/beer', 'food/cocktails', 'food/coffee'],
  ['food/baking', 'food/vegetarian', 'food/tea', 'food/wine'],

  // ── HEALTH ──
  ['society/health', 'society/mental-health', 'world/coronavirus-outbreak', 'society/nhs'],
  ['society/nhs', 'society/health', 'society/cancer', 'society/obesity'],
  ['society/cancer', 'society/diabetes', 'society/obesity', 'society/dementia'],
  ['society/depression', 'society/anxiety', 'society/mental-health', 'society/health'],

  // ── RELIGION ──
  ['world/pope-francis', 'world/pope-benedict-xvi', 'world/islam', 'world/christianity'],

  // ── LIFE + RELATIONSHIPS ──
  ['lifeandstyle/parents-and-parenting', 'lifeandstyle/relationships', 'lifeandstyle/marriage', 'lifeandstyle/health-and-wellbeing'],

  // ── FASHION ──
  ['fashion/paris-fashion-week', 'fashion/london-fashion-week', 'fashion/milan-fashion-week', 'fashion/fashion'],

  // ── GAMES ──
  ['games/nintendo', 'games/playstation', 'games/xbox', 'games/minecraft'],

  // ── ACTIVISTS + NOTABLE FIGURES ──
  ['environment/greta-thunberg', 'technology/elon-musk', 'technology/mark-zuckerberg', 'technology/jeff-bezos'],

  // ── JOURNALISM / MEDIA ──
  ['media/bbc', 'media/itv1', 'media/bskyb', 'media/sky-news'],
  ['media/rupert-murdoch', 'media/bbc', 'media/guardian-news-media', 'media/dailymail'],

  // ── CROSS-CATEGORY CLASH ──
  ['us-news/donaldtrump', 'world/vladimir-putin', 'world/xi-jinping', 'world/kim-jong-un'],
  ['environment/climate-crisis', 'business/cost-of-living-crisis', 'world/ukraine', 'technology/artificialintelligenceai'],

  // ── MORE WORLD + TRAVEL ──
  ['world/france', 'world/italy', 'world/spain', 'world/portugal'],
  ['world/germany', 'world/netherlands', 'world/belgium', 'world/france'],
  ['world/china', 'world/hong-kong', 'world/taiwan', 'world/japan'],
  ['world/india', 'world/pakistan', 'world/bangladesh', 'world/afghanistan'],
  ['world/mexico', 'world/cuba', 'world/venezuela', 'world/colombia'],
  ['world/argentina', 'world/chile', 'world/brazil', 'world/peru'],
  ['world/egypt', 'world/israel', 'world/turkey', 'world/greece'],
  ['world/russia', 'world/belarus', 'world/ukraine', 'world/poland'],

  // ── MORE US POLITICS ──
  ['us-news/alexandria-ocasio-cortez', 'us-news/nancy-pelosi', 'us-news/bernie-sanders', 'us-news/hillary-clinton'],
  ['us-news/ted-cruz', 'us-news/marco-rubio', 'us-news/jd-vance', 'us-news/ron-desantis'],
  ['us-news/gavin-newsom', 'us-news/pete-buttigieg', 'us-news/tim-walz', 'us-news/kamala-harris'],
  ['us-news/texas', 'us-news/california', 'us-news/donaldtrump', 'us-news/joebiden'],
  ['us-news/us-supreme-court', 'us-news/us-congress', 'us-news/republicans', 'us-news/democrats'],

  // ── MORE UK POLITICS ──
  ['politics/tonyblair', 'politics/davidcameron', 'politics/boris-johnson', 'politics/keir-starmer'],
  ['politics/labour', 'politics/conservatives', 'politics/reformuk', 'politics/liberaldemocrats'],
  ['politics/jeremy-corbyn', 'politics/keir-starmer', 'politics/edmiliband', 'politics/tonyblair'],
  ['politics/margaretthatcher', 'politics/tonyblair', 'politics/davidcameron', 'politics/boris-johnson'],
  ['politics/liz-truss', 'politics/rishi-sunak', 'politics/boris-johnson', 'politics/keir-starmer'],

  // ── MORE WORLD LEADERS ──
  ['world/emmanuel-macron', 'world/nicolas-sarkozy', 'world/francois-hollande', 'world/marine-le-pen'],
  ['world/pope-francis', 'world/pope-benedict-xvi', 'world/luiz-inacio-lula-da-silva', 'world/jair-bolsonaro'],
  ['world/hassan-rouhani', 'world/benjamin-netanyahu', 'world/mohammed-bin-salman', 'world/recep-tayyip-erdogan'],
  ['world/narendra-modi', 'world/imran-khan', 'world/xi-jinping', 'world/kim-jong-un'],

  // ── MORE SPORT ──
  ['sport/roger-federer', 'sport/rafaelnadal', 'sport/novak-djokovic', 'sport/andymurray'],
  ['sport/serena-williams', 'sport/novak-djokovic', 'sport/andymurray', 'sport/wimbledon'],
  ['sport/lebron-james', 'sport/serena-williams', 'sport/lewis-hamilton', 'sport/max-verstappen'],
  ['sport/boxing', 'sport/ufc', 'sport/horse-racing', 'sport/cycling'],
  ['sport/olympics-2012', 'sport/olympic-games', 'sport/winter-olympics', 'sport/paralympics'],
  ['sport/nba', 'sport/nfl', 'sport/super-bowl', 'sport/lebron-james'],
  ['sport/cricket', 'sport/rugby-union', 'sport/golf', 'sport/tennis'],

  // ── MORE FOOTBALL ──
  ['football/arsenal', 'football/tottenham-hotspur', 'football/chelsea', 'football/liverpool'],
  ['football/manchester-united', 'football/manchestercity', 'football/liverpool', 'football/arsenal'],
  ['football/realmadrid', 'football/barcelona', 'football/atleticomadrid', 'football/juventus'],
  ['football/england', 'football/france', 'football/germany', 'football/italy'],
  ['football/brazil', 'football/argentina', 'football/spain', 'football/portugal'],
  ['football/world-cup-2018', 'football/world-cup-2022', 'football/world-cup-football', 'football/womens-world-cup'],
  ['football/ronaldo', 'football/lionel-messi', 'football/wayne-rooney', 'football/harry-kane'],

  // ── MORE MUSIC ──
  ['music/therollingstones', 'music/thebeatles', 'music/davidbowie', 'music/bobdylan'],
  ['music/prince', 'music/madonna', 'music/lady-gaga', 'music/rihanna'],
  ['music/elton-john', 'music/johnlennon', 'music/davidbowie', 'music/bobdylan'],
  ['music/oasis', 'music/thebeatles', 'music/therollingstones', 'music/davidbowie'],
  ['music/beyonce', 'music/rihanna', 'music/madonna', 'music/adele'],
  ['music/drake', 'music/kanyewest', 'music/jayz', 'music/kendrick-lamar'],

  // ── MORE TECH ──
  ['technology/apple', 'technology/google', 'technology/microsoft', 'technology/amazon'],
  ['technology/facebook', 'technology/twitter', 'technology/tiktok', 'technology/instagram'],
  ['technology/elon-musk', 'technology/mark-zuckerberg', 'technology/jeff-bezos', 'technology/billgates'],
  ['technology/artificialintelligenceai', 'technology/openai', 'technology/chatgpt', 'technology/google'],
  ['technology/tesla', 'technology/motoring', 'environment/electric-cars', 'technology/self-driving-cars'],
  ['technology/whatsapp', 'technology/instagram', 'technology/youtube', 'technology/snapchat'],
  ['technology/cryptocurrencies', 'technology/artificialintelligenceai', 'technology/meta', 'technology/elon-musk'],

  // ── MORE CLIMATE ──
  ['environment/climate-crisis', 'environment/wildfires', 'world/wildfires', 'world/earthquakes'],
  ['environment/fossil-fuels', 'environment/renewableenergy', 'environment/solarpower', 'environment/nuclearpower'],
  ['environment/greta-thunberg', 'environment/extinction-rebellion', 'environment/greenpeace', 'environment/climate-crisis'],
  ['environment/paris-climate-agreement', 'environment/cop27', 'environment/cop28', 'environment/cop26-glasgow-climate-change-conference-2021'],
  ['environment/amazon-rainforest', 'environment/biodiversity', 'environment/rewilding', 'environment/wildlife'],

  // ── MORE FILM ──
  ['film/martinscorsese', 'film/quentintarantino', 'film/stevenspielberg', 'film/christopher-nolan'],
  ['film/alfredhitchcock', 'film/stanleykubrick', 'film/martinscorsese', 'film/quentintarantino'],
  ['film/leonardodicaprio', 'film/bradpitt', 'film/tomcruise', 'film/tomhanks'],
  ['film/merylstreep', 'film/cate-blanchett', 'film/tomhanks', 'film/georgeclooney'],
  ['film/harrypotter', 'film/star-wars-episode-vii', 'film/jamesbond', 'culture/marvel'],
  ['film/oscars', 'film/baftas', 'film/cannesfilmfestival', 'film/barbie'],

  // ── MORE TV ──
  ['tv-and-radio/succession', 'tv-and-radio/breaking-bad', 'tv-and-radio/game-of-thrones', 'tv-and-radio/the-crown'],
  ['tv-and-radio/love-island', 'tv-and-radio/the-great-british-bake-off', 'tv-and-radio/strictly-come-dancing', 'tv-and-radio/doctor-who'],
  ['media/bbc', 'media/bbc1', 'media/itv1', 'media/bskyb'],
  ['media/sky-news', 'media/bbc', 'media/itv1', 'media/dailymail'],

  // ── MORE BOOKS ──
  ['books/jkrowling', 'books/stephenking', 'books/margaretatwood', 'books/hilary-mantel'],
  ['books/salmanrushdie', 'books/margaretatwood', 'books/hilary-mantel', 'books/booker-prize'],
  ['books/fiction', 'books/non-fiction', 'books/biography', 'books/booker-prize'],

  // ── MORE HEALTH ──
  ['society/cancer', 'society/dementia', 'society/obesity', 'society/diabetes'],
  ['society/depression', 'society/anxiety', 'society/mental-health', 'society/nhs'],
  ['society/nhs', 'world/coronavirus-outbreak', 'society/health', 'society/mental-health'],

  // ── FASHION + ART ──
  ['fashion/paris-fashion-week', 'fashion/london-fashion-week', 'fashion/milan-fashion-week', 'fashion/fashion'],
  ['artanddesign/banksy', 'fashion/fashion', 'film/oscars', 'music/grammys'],

  // ── GAMES ──
  ['games/nintendo', 'games/playstation', 'games/xbox', 'technology/apple'],
  ['games/minecraft', 'games/nintendo', 'games/playstation', 'technology/tiktok'],

  // ── FOOD + DRINK ──
  ['food/wine', 'food/beer', 'food/cocktails', 'food/coffee'],
  ['food/baking', 'food/vegetarian', 'food/restaurants', 'food/jamie-oliver'],

  // ── LIFESTYLE ──
  ['lifeandstyle/parents-and-parenting', 'lifeandstyle/relationships', 'lifeandstyle/marriage', 'lifeandstyle/health-and-wellbeing'],

  // ── BILLIONAIRES ──
  ['environment/greta-thunberg', 'technology/elon-musk', 'technology/jeff-bezos', 'technology/mark-zuckerberg'],
  ['technology/elon-musk', 'us-news/donaldtrump', 'technology/mark-zuckerberg', 'technology/jeff-bezos'],

  // ── CONFLICTS TODAY ──
  ['world/israel-hamas-war', 'world/gaza', 'world/palestinian-territories', 'world/benjamin-netanyahu'],
  ['world/ukraine', 'world/russia', 'world/vladimir-putin', 'world/volodymyr-zelenskiy'],
  ['world/syria', 'world/lebanon', 'world/iran', 'world/iraq'],

  // ── ROYAL DRAMA ──
  ['uk/prince-harry', 'uk-news/meghan-duchess-of-sussex', 'uk/prince-andrew', 'uk/prince-charles'],
  ['uk/queen', 'uk/prince-philip', 'uk-news/queen-elizabeth-ii-death', 'uk-news/king-charles-coronation'],

  // ── PAPACY ──
  ['world/pope-francis', 'world/pope-benedict-xvi', 'world/christianity', 'world/islam'],

  // ── CULTURE WARS ──
  ['politics/reformuk', 'us-news/donaldtrump', 'world/viktor-orban', 'world/marine-le-pen'],
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
