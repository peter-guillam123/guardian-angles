"""
Build tag-based indexes from the monthly shards.

Each shard already stores, per headline, up to 8 tag IDs (slug form like
"politics/labour") in the `g` field. We aggregate those into three
granularity-level indexes plus a `tag-catalog.json` for autocomplete.

Outputs:
    data/tag-index-monthly.json.gz
    data/tag-index-weekly.json.gz
    data/tag-index-daily.json.gz
        { buckets: [...], totals: [...], tags: { "politics/labour": [counts] } }

    data/tag-catalog.json
        [ { "id": "politics/labour", "name": "Labour", "n": 12345 }, ... ]
        Pre-sorted by n desc. Used by the UI autocomplete.

`totals` here matches the totals from sections.json / term index — headlines
per bucket — so per-mille normalisation works the same way for tags.
"""

from __future__ import annotations

import datetime as dt
import gzip
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SHARD_DIR = REPO_ROOT / "data" / "shards"
DATA_DIR = REPO_ROOT / "data"

TOP_N = 3000  # top tags to index; rarer tags don't make the catalog

# Manual display-name overrides for tags whose slugs are smooshed
# (legacy Guardian slugs often concatenate first and last name). Everything
# else falls back to slug-to-title. Expand as you notice bad ones.
NAME_OVERRIDES = {
    "us-news/donaldtrump": "Donald Trump",
    "politics/keirstarmer": "Keir Starmer",
    "politics/rishisunak": "Rishi Sunak",
    "politics/borisjohnson": "Boris Johnson",
    "politics/kemibadenoch": "Kemi Badenoch",
    "politics/theresamay": "Theresa May",
    "politics/davidcameron": "David Cameron",
    "politics/jeremycorbyn": "Jeremy Corbyn",
    "politics/nicolasturgeon": "Nicola Sturgeon",
    "politics/lizztruss": "Liz Truss",
    "politics/liz-truss": "Liz Truss",
    "us-news/joebiden": "Joe Biden",
    "us-news/kamala-harris": "Kamala Harris",
    "us-news/barack-obama": "Barack Obama",
    "us-news/hillary-clinton": "Hillary Clinton",
    "us-news/kamalaharris": "Kamala Harris",
    "world/vladimir-putin": "Vladimir Putin",
    "world/volodymyrzelenskiy": "Volodymyr Zelenskiy",
    "world/zelenskiy": "Volodymyr Zelenskiy",
    "world/israel-hamas-war": "Israel–Hamas war",
    "world/gaza": "Gaza",
    "world/ukraine": "Ukraine",
    "world/russia": "Russia",
    "world/china": "China",
    "environment/climate-crisis": "Climate crisis",
    "politics/labour": "Labour",
    "politics/conservatives": "Conservatives",
    "politics/liberaldemocrats": "Liberal Democrats",
    "politics/scottishnationalparty": "SNP",
    "politics/greenparty": "Green Party",
    "politics/reformuk": "Reform UK",
    "politics/eu-referendum": "EU referendum",
    "politics/brexit": "Brexit",
    "business/cost-of-living-crisis": "Cost of living crisis",
    "business/economics": "Economics",
    "business/inflation": "Inflation",
    "business/interest-rates": "Interest rates",
    "technology/artificialintelligenceai": "Artificial intelligence",
    "technology/chatgpt": "ChatGPT",
    "technology/cryptocurrencies": "Cryptocurrencies",
    # Smooshed legacy slugs — common offenders
    "world/middleeast": "Middle East",
    "world/unitednations": "United Nations",
    "football/premierleague": "Premier League",
    "football/womensfootball": "Women's football",
    "football/manchestercity": "Manchester City",
    "football/manchesterunited": "Manchester United",
    "football/championsleague": "Champions League",
    "football/europeanfootball": "European football",
    "football/worldcup2022": "World Cup 2022",
    "football/worldcup2026": "World Cup 2026",
    "football/euro2024": "Euro 2024",
    "politics/foreignpolicy": "Foreign policy",
    "politics/taxandspending": "Tax and spending",
    "politics/tradeunions": "Trade unions",
    "politics/civilservice": "Civil service",
    "politics/houseofcommons": "House of Commons",
    "politics/houseoflords": "House of Lords",
    "uk/ruralaffairs": "Rural affairs",
    "uk/northernireland": "Northern Ireland",
    "us-news/usimmigration": "US immigration",
    "us-news/usforeignpolicy": "US foreign policy",
    "us-news/useconomy": "US economy",
    "us-news/uscongress": "US Congress",
    "us-news/ussupremecourt": "US Supreme Court",
    "society/localgovernment": "Local government",
    "society/youngpeople": "Young people",
    "society/socialcare": "Social care",
    "society/mentalhealth": "Mental health",
    "science/infectiousdiseases": "Infectious diseases",
    "business/costoflivingcrisis": "Cost of living crisis",
    "business/retailindustry": "Retail industry",
    "business/realestate": "Real estate",
    "media/socialmedia": "Social media",
    "world/southamerica": "South America",
    "world/southkorea": "South Korea",
    "world/northkorea": "North Korea",
    "world/southafrica": "South Africa",
    "world/saudiarabia": "Saudi Arabia",
    "world/newzealand": "New Zealand",
    "world/hongkong": "Hong Kong",
    "world/southeastasia": "Southeast Asia",
    "environment/wildlife": "Wildlife",
    "environment/globaldevelopment": "Global development",
    "technology/socialmedia": "Social media",
    "technology/spacex": "SpaceX",
    "tv-and-radio/realitytv": "Reality TV",
    "tone/albumreview": "Album review",
    "sport/usopentennis": "US Open (tennis)",
    "stage/edinburghfestival": "Edinburgh Festival",
    "stage/edinburghfringe": "Edinburgh Fringe",
    "sport/wimbledon": "Wimbledon",
    "sport/rugbyunion": "Rugby Union",
    "sport/rugbyleague": "Rugby League",
    "sport/cricket": "Cricket",
    "sport/horseracing": "Horse racing",
    "sport/motorsports": "Motor sports",
    "sport/formulaone": "Formula One",
    "sport/olympicgames": "Olympic Games",
    "sport/paralympics": "Paralympics",
    "sport/commonwealthgames": "Commonwealth Games",
    "sport/superbowl": "Super Bowl",
    "uk-news/scotland": "Scotland",
    "uk-news/wales": "Wales",
    "uk-news/london": "London",
    "uk-news/england": "England",
    "world/europeannews": "European news",
    # Sport events + smooshed names caught in This Week
    "sport/grandnational": "Grand National",
    "sport/sixnations": "Six Nations",
    "sport/pga-tour": "PGA Tour",
    "sport/europeanfootball": "European football",
    "sport/aintree": "Aintree",
    "sport/benrobertssmith": "Ben Roberts Smith",
    "sport/tyson-fury": "Tyson Fury",
    "world/coronavirusoutbreak": "Coronavirus outbreak",
    "world/coronavirus-outbreak": "Coronavirus outbreak",
    "politics/eu-referendum": "EU referendum",
    "politics/eureferendum": "EU referendum",
    "world/basharal-assad": "Bashar al-Assad",
    "us-news/us-israel-war-on-iran": "US–Israel war on Iran",
    "world/netanyahu": "Benjamin Netanyahu",
    "football/tottenham-hotspur": "Tottenham Hotspur",
    "football/arsenalfc": "Arsenal FC",
    "football/chelseafc": "Chelsea FC",
    "football/liverpoolfc": "Liverpool FC",
    "football/manunitedfc": "Manchester United",
    # Smooshed slugs spotted on Subjects
    "media/pressandpublishing": "Press & publishing",
    "lifeandstyle/foodanddrinks": "Food & drinks",
    "food/fooddrinks": "Food & drinks",
    "theguardian/correctionsandclarifications": "Corrections & clarifications",
    "business/theairlineindustry": "The airline industry",
    "business/airline-industry": "The airline industry",
    "environment/renewableenergy": "Renewable energy",
    "business/bankofenglandgovernor": "Bank of England governor",
    "books/booksforchildrenandteenagers": "Books for children and teenagers",
    "science/scienceofclimatechange": "Science of climate change",
    "politics/edmiliband": "Ed Miliband",
    "politics/ed-miliband": "Ed Miliband",
    "politics/davidmiliband": "David Miliband",
    "us-news/maga": "MAGA",
    "politics/nigel-farage": "Nigel Farage",
    "politics/nigelfarage": "Nigel Farage",
    "politics/tonyblair": "Tony Blair",
    "politics/greenparty": "Green Party",
    "football/manchestercity": "Manchester City",
    "sport/rafaelnadal": "Rafael Nadal",
    "sport/andymurray": "Andy Murray",
    "sport/jensonbutton": "Jenson Button",
    "sport/nicorosberg": "Nico Rosberg",
    "music/thebeatles": "The Beatles",
    "music/therollingstones": "The Rolling Stones",
    "music/davidbowie": "David Bowie",
    "music/billieeilish": "Billie Eilish",
    "music/jayz": "Jay-Z",
    "film/leonardodicaprio": "Leonardo DiCaprio",
    "film/tomcruise": "Tom Cruise",
    "film/bradpitt": "Brad Pitt",
    "film/georgeclooney": "George Clooney",
    "film/martinscorsese": "Martin Scorsese",
    "film/quentintarantino": "Quentin Tarantino",
    "film/christophernolan": "Christopher Nolan",
    "film/stevenspielberg": "Steven Spielberg",
    "books/stephenking": "Stephen King",
    "books/jkrowling": "J.K. Rowling",
    "books/margaretatwood": "Margaret Atwood",
    "books/harrypotter": "Harry Potter (books)",
    "film/harrypotter": "Harry Potter (film)",
    "technology/billgates": "Bill Gates",
    "football/erling-haaland": "Erling Haaland",
    "football/lionel-messi": "Lionel Messi",
    "football/ronaldo": "Cristiano Ronaldo",
    "theguardian/series/correctionsandclarifications": "Corrections & clarifications",
    "theguardian/series/corrections-and-clarifications": "Corrections & clarifications",
    "business/theairlineindustry": "The airline industry",
    "lifeandstyle/parents-and-parenting": "Parents and parenting",
    "sport/horse-racing-tips": "Horse racing tips",
    "sport/england-rugby-union-team": "England rugby union team",
    "world/birds": "Birds",
    "lifeandstyle/book-of-the-day": "Book of the day",
    "books/book-of-the-day": "Book of the day",
    "australia-news/australia-media": "Australia media",
    "music/classical-music-and-opera": "Classical music and opera",
    "us-news/far-right": "Far right",
    "us-news/trump-administration": "Trump administration",
    "society/social-care": "Social care",
    "world/race": "Race",
    # Batch — smooshed slugs spotted on Subjects
    "business/internationaltrade": "International trade",
    "sport/indiacricketteam": "India cricket team",
    "environment/endangeredspecies": "Endangered species",
    "media/mediabusiness": "Media business",
    "media/theguardian": "The Guardian",
    "culture/edinburghfestival": "Edinburgh Festival",
    "politics/localgovernment": "Local government",
    "business/oilandgascompanies": "Oil and gas companies",
    "business/housingmarket": "Housing market",
    "lifeandstyle/gardeningadvice": "Gardening advice",
    "football/realmadrid": "Real Madrid",
    "film/actionandadventure": "Action and adventure",
    "football/series/thefiver": "The Fiver",
    "politics/michaelgove": "Michael Gove",
    "society/voluntarysector": "Voluntary sector",
    "society/childprotection": "Child protection",
    "football/westhamunited": "West Ham United",
    "world/secondworldwar": "Second world war",
    "film/sciencefictionandfantasy": "Science fiction and fantasy",
    "music/electronicmusic": "Electronic music",
    "media/socialnetworking": "Social networking",
    "uk/uksecurity": "UK security",
    "politics/georgeosborne": "George Osborne",
    "football/newcastleunited": "Newcastle United",
    "technology/mobilephones": "Mobile phones",
    "business/economicgrowth": "Economic growth",
    "culture/series/watchthis": "Watch this",
    "business/fooddrinks": "Food & drinks",
    # Batch 3 — more smooshed slugs spotted on Subjects
    "world/nelsonmandela": "Nelson Mandela",
    "business/britishskybroadcastinggroup": "British Sky Broadcasting Group",
    "film/torontofilmfestival": "Toronto Film Festival",
    "politics/margaretthatcher": "Margaret Thatcher",
    "music/popandrock": "Pop and rock",
    "sport/worldtwenty20": "World Twenty20",
    "artanddesign/turnerprize": "Turner Prize",
    "uk/knifecrime": "Knife crime",
    "film/cannesfilmfestival": "Cannes Film Festival",
    "technology/searchengines": "Search engines",
    "football/hullcity": "Hull City",
    "sport/frenchopen": "French Open",
    "film/angelinajolie": "Angelina Jolie",
    "education/universityguide": "University guide",
    "travel/cyclingholidays": "Cycling holidays",
    "sport/usopengolf": "US Open (golf)",
    "politics/partyfunding": "Party funding",
    "sport/tourdefrance": "Tour de France",
    "sport/markcavendish": "Mark Cavendish",
    "business/marksspencer": "Marks & Spencer",
    "sport/theopen": "The Open",
    "sport/tigerwoods": "Tiger Woods",
    # Batch 4 — detector-driven sweep (build/find_smooshes.py)
    # Topics — sentence case
    "society/socialexclusion": "Social exclusion",
    "business/travelleisure": "Travel & leisure",
    "football/footballpolitics": "Football politics",
    "environment/nuclearpower": "Nuclear power",
    "politics/labourleadership": "Labour leadership",
    "business/musicindustry": "Music industry",
    "business/ethicalbusiness": "Ethical business",
    "environment/solarpower": "Solar power",
    "environment/energyefficiency": "Energy efficiency",
    "business/consumerspending": "Consumer spending",
    "society/socialmobility": "Social mobility",
    "environment/corporatesocialresponsibility": "Corporate social responsibility",
    "money/scamsandfraud": "Scams and fraud",
    "politics/labourconference": "Labour conference",
    "politics/toryconference": "Tory conference",
    "travel/railtravel": "Rail travel",
    "politics/electoralreform": "Electoral reform",
    "uk/britishidentity": "British identity",
    "society/youthjustice": "Youth justice",
    "society/learningdisability": "Learning disability",
    "business/privateequity": "Private equity",
    "education/raceineducation": "Race in education",
    "science/particlephysics": "Particle physics",
    "travel/selfcatering": "Self-catering",
    "money/investmentfunds": "Investment funds",
    "politics/voterapathy": "Voter apathy",
    "education/socialwork": "Social work",
    "environment/emissionstrading": "Emissions trading",
    "food/middleeastern": "Middle Eastern",
    "stage/pantoseason": "Panto season",
    "football/footballviolence": "Football violence",
    "money/healthinsurance": "Health insurance",
    "education/teachertraining": "Teacher training",
    "sport/superleague": "Super League",
    "education/specialeducationneeds": "Special educational needs",
    # People
    "us-news/mittromney": "Mitt Romney",
    "politics/vincentcable": "Vincent Cable",
    "politics/chrisgrayling": "Chris Grayling",
    "books/charlesdickens": "Charles Dickens",
    "film/woodyallen": "Woody Allen",
    "media/rebekahwade": "Rebekah Wade",
    "us-news/michaelbloomberg": "Michael Bloomberg",
    "music/michaeljackson": "Michael Jackson",
    "film/danielcraig": "Daniel Craig",
    "politics/georgegalloway": "George Galloway",
    # Places
    "us-news/northcarolina": "North Carolina",
    "travel/southamerica": "South America",
    "travel/lakedistrict": "Lake District",
    # Football clubs
    "football/crystalpalace": "Crystal Palace",
    "football/leicestercity": "Leicester City",
    "football/sheffieldunited": "Sheffield United",
    "football/wiganathletic": "Wigan Athletic",
    "football/derbycounty": "Derby County",
    "football/sheffieldwednesday": "Sheffield Wednesday",
    # Institutions / brands / publications
    "education/oxforduniversity": "Oxford University",
    "education/cambridgeuniversity": "Cambridge University",
    "media/newsinternational": "News International",
    "business/royaldutchshell": "Royal Dutch Shell",
    "media/dailytelegraph": "Daily Telegraph",
    "artanddesign/tatebritain": "Tate Britain",
    "business/nationalgrid": "National Grid",
    "media/channelfive": "Channel Five",
    "media/telegraphmediagroup": "Telegraph Media Group",
    "business/burberrygroup": "Burberry Group",
    "business/standardchartered": "Standard Chartered",
    "media/financialtimes": "Financial Times",
    "media/sundaytimes": "Sunday Times",
    "business/thomascookgroup": "Thomas Cook Group",
    "media/dailyexpress": "Daily Express",
    "games/playstation": "PlayStation",
    # Events / festivals / fixtures
    "sport/cheltenhamfestival": "Cheltenham Festival",
    "film/venicefilmfestival": "Venice Film Festival",
    "film/berlinfilmfestival": "Berlin Film Festival",
    "football/worldclubchampionship": "World Club Championship",
    "football/africannationscup": "African Nations Cup",
    "sport/gloucesterrugby": "Gloucester Rugby",
    # Guardian series — preserve Guardian's own single-word style where it applies
    "news/series/weatherwatch": "Weatherwatch",
    "football/series/footballdaily": "Football Daily",
    "money/series/dearjeremy": "Dear Jeremy",
    "media/series/newsbucket": "Newsbucket",
    "lifeandstyle/series/sexualhealing": "Sexual healing",
    "commentisfree/series/openthread": "Open thread",
    "business/series/economicsmonday": "Economics Monday",
    "lifeandstyle/series/thiscolumnwillchangeyourlife": "This column will change your life",
    "fashion/series/stylewatch": "Stylewatch",
    "money/series/personaleffects": "Personal effects",
    "environment/series/pollutionwatch": "Pollutionwatch",
    "football/series/footballweekly": "Football Weekly",
    "books/series/digestedread": "Digested read",
    "culture/series/guidedaily": "Guide Daily",
    "lifeandstyle/series/familylife": "Family life",
    "culture/series/radioreview": "Radio review",
    "environment/series/greenlight": "Greenlight",
    "environment/birdwatching": "Birdwatching",
}

# Suppress display names for structural tags that aren't useful to search
SKIP_TAGS = {
    "type/article",
    "tone/news",
    "tone/features",
    "tone/comment",
    "tone/letters",
    "tone/reviews",
    "tone/analysis",
    "tone/interview",
    "tone/obituaries",
    "tone/editorials",
    "tone/livecoverage",
    "tone/blog",
    "tone/matchreports",
    "tone/sponsoredfeatures",
    "tone/recipes",
    "tone/profiles",
    "tone/helplines",
    "tone/polls",
    "tone/minutebyminute",
    "tone/setpiece",
    "tone/toplists",
    "tone/graphic",
    "tone/albumreviews",
    "tone/performances",
    "tone/extract",
    "tone/explainers",
    "tone/obituaries",
    "tone/timelines",
}


UPPERCASE_WORDS = {
    "uk", "us", "eu", "usa", "un", "nhs", "bbc", "cnn", "nyt", "itv", "sky",
    "afl", "nfl", "nba", "nhl", "nrl", "mls", "fa", "efl", "epl", "ppl",
    "nasa", "ai", "vr", "ar", "5g", "4g", "sms", "llc", "plc", "ltd",
    "ceo", "cfo", "cto", "mp", "mps", "tv", "fm", "am", "pm", "uk's", "us's",
}


def _word_case(w: str) -> str:
    if w.lower() in UPPERCASE_WORDS:
        return w.upper()
    return w.capitalize()


def slug_to_title(slug: str) -> str:
    """Fallback prettifier for tag slugs without manual override."""
    last = slug.rsplit("/", 1)[-1]
    if "-" in last:
        return " ".join(_word_case(w) for w in last.split("-"))
    return _word_case(last)


# Authoritative tag webTitles pulled from the Guardian's /tags CAPI
# endpoint by build/fetch_tag_names.py. This is the current, correct,
# editorially-maintained display name for each tag — it handles renames
# (e.g. "Brexit Party" → "Reform UK") that a slug-derived name can't.
# Loaded lazily on first call so the module still imports if the file
# doesn't exist yet.
_CAPI_NAMES: dict | None = None

def _load_capi_names() -> dict:
    global _CAPI_NAMES
    if _CAPI_NAMES is not None:
        return _CAPI_NAMES
    path = DATA_DIR / "tag-names.json"
    if path.exists():
        _CAPI_NAMES = json.loads(path.read_text())
    else:
        _CAPI_NAMES = {}
    return _CAPI_NAMES


def display_name(tag_id: str) -> str:
    # Priority order:
    # 1. CAPI webTitle  — authoritative current name from the Guardian
    # 2. NAME_OVERRIDES — manual editorial overrides (mostly obsolete
    #                     once CAPI names are populated, but kept as a
    #                     safety net for anything CAPI can't resolve)
    # 3. slug_to_title  — last-resort derivation from the slug
    capi = _load_capi_names()
    if tag_id in capi:
        return capi[tag_id]
    if tag_id in NAME_OVERRIDES:
        return NAME_OVERRIDES[tag_id]
    return slug_to_title(tag_id)


def load_shards() -> list[dict]:
    shards = []
    for f in sorted(SHARD_DIR.glob("*.json.gz")):
        with gzip.open(f, "rb") as fh:
            shards.append(json.loads(fh.read()))
    return shards


def month_bucket(iso_date: str) -> str:
    return iso_date[:7]


def day_bucket(iso_date: str) -> str:
    return iso_date


def iso_week_bucket(iso_date: str) -> str:
    d = dt.date.fromisoformat(iso_date)
    y, w, _ = d.isocalendar()
    return f"{y:04d}-W{w:02d}"


GRANULARITIES = [
    ("monthly", month_bucket),
    ("weekly", iso_week_bucket),
    ("daily", day_bucket),
]


def build() -> int:
    shards = load_shards()
    if not shards:
        print("ERROR: no shards. Run fetch_guardian.py first.", file=sys.stderr)
        return 1

    print(f"Loaded {len(shards)} shards: {shards[0]['month']} … {shards[-1]['month']}", file=sys.stderr)

    # First pass: global tag counts, to pick the top N.
    # Skip "self-referential" section mega-tags like "uk/uk" or "politics/politics"
    # — they are ~duplicates of the section counts we already surface.
    def is_section_megatag(tag: str) -> bool:
        parts = tag.split("/")
        return len(parts) == 2 and parts[0] == parts[1]

    # tone/* and type/* are structural, not editorial — always drop
    def is_structural(tag: str) -> bool:
        return tag.startswith("tone/") or tag.startswith("type/") or tag.startswith("publication/")

    global_counts: Counter[str] = Counter()
    for shard in shards:
        for h in shard["headlines"]:
            for tag in h.get("g", []):
                if tag in SKIP_TAGS:
                    continue
                if is_section_megatag(tag):
                    continue
                if is_structural(tag):
                    continue
                global_counts[tag] += 1

    top_tags = {t for t, _ in global_counts.most_common(TOP_N)}
    print(f"Universe: {len(global_counts):,} tags; keeping top {len(top_tags):,}", file=sys.stderr)

    # Second pass per granularity — per-bucket counts for top tags,
    # plus totals per bucket (shared shape with term-index)
    for name, bucketer in GRANULARITIES:
        buckets_seen: set[str] = set()
        for shard in shards:
            for h in shard["headlines"]:
                date = (h.get("d") or "")[:10]
                if date:
                    buckets_seen.add(bucketer(date))
        buckets = sorted(buckets_seen)
        idx = {b: i for i, b in enumerate(buckets)}
        n = len(buckets)

        totals = [0] * n
        tag_buckets: dict[str, list[int]] = {t: [0] * n for t in top_tags}

        for shard in shards:
            for h in shard["headlines"]:
                date = (h.get("d") or "")[:10]
                if not date:
                    continue
                b = bucketer(date)
                bi = idx.get(b)
                if bi is None:
                    continue
                totals[bi] += 1
                for tag in h.get("g", []):
                    if tag in top_tags:
                        tag_buckets[tag][bi] += 1

        out_path = DATA_DIR / f"tag-index-{name}.json.gz"
        payload = json.dumps(
            {"buckets": buckets, "totals": totals, "tags": tag_buckets},
            ensure_ascii=False,
            separators=(",", ":"),
        ).encode("utf-8")
        with gzip.open(out_path, "wb", compresslevel=9) as f:
            f.write(payload)
        size_kb = out_path.stat().st_size / 1024
        print(f"  [{name}] {n} buckets × {len(top_tags)} tags → {out_path.name} ({size_kb:.0f} KB gz)", file=sys.stderr)

    # Tag catalog for autocomplete
    catalog = [
        {"id": t, "name": display_name(t), "n": global_counts[t]}
        for t in sorted(top_tags, key=lambda t: -global_counts[t])
    ]
    catalog_path = DATA_DIR / "tag-catalog.json"
    with open(catalog_path, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  tag-catalog.json ({catalog_path.stat().st_size/1024:.0f} KB, {len(catalog)} entries)", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(build())
