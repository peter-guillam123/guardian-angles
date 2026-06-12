"""Build data/language.json.gz — how Guardian headlines are written, by month.

One pass over the shards counting headline-language markers: length,
punctuation, quotation, journalese, format furniture, swearing. Pure
facts about the text; the Style page turns them into rates and trends.

Definitions live here and only here — if a marker's definition changes,
the whole history is recomputed on the next build, so a chart never
mixes two definitions.

Schema:
{
  "months":  ["2012-01", ...],
  "totals":  [headlines per month],
  "metrics": { "<marker>": [monthly counts] , "avg_words"/"avg_chars": [floats] },
  "names":   { "m": {year: [[name, count] x10]}, "f": {...} },
  "facts":   ["computed sentences for the page's shuffle card"],
  "longest": [up to 3 of {t, d, u, chars}]
}

Like the other indexes this is derived: gitignored, rebuilt every CI
run, shipped only in the Pages artifact. ~15KB gzipped.
"""

from __future__ import annotations

import gzip
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SHARD_DIR = REPO_ROOT / "data" / "shards"
CATALOG_PATH = REPO_ROOT / "data" / "tag-catalog.json"
OUT_PATH = REPO_ROOT / "data" / "language.json.gz"

# ── First names, gendered ──
# Candidates are derived from the tag catalogue (the first token of
# person-style tag names like "Keir Starmer"), then filtered through
# this annotated forename list so "Manchester United" doesn't donate
# "Manchester". Excluded outright: names that are also places, clubs,
# months, legislation or memes (Jordan, Chelsea, Will, Bill, Amber,
# Karen…), and East Asian surname-first names (Kim, Xi) — this is a
# FIRST-name league. The m/f annotation reflects the name's dominant
# bearers in Guardian coverage; genuinely 50/50 names are left out.
FORENAMES = {
    # male
    "Aaron": "m", "Adam": "m", "Alan": "m", "Albert": "m", "Alex": "m",
    "Alexander": "m", "Alexei": "m", "Ali": "m", "Andrew": "m", "Andy": "m",
    "Anthony": "m", "Antonio": "m", "Barack": "m", "Barnaby": "m", "Ben": "m",
    "Benjamin": "m", "Bernie": "m", "Boris": "m", "Brad": "m", "Bruce": "m",
    "Charles": "m", "Charlie": "m", "Chris": "m", "Christian": "m",
    "Cristiano": "m", "Daniel": "m", "David": "m", "Dmitry": "m",
    "Dominic": "m", "Donald": "m", "Ed": "m", "Eddie": "m", "Elon": "m",
    "Emmanuel": "m", "Eric": "m", "Francis": "m", "Frank": "m", "Gareth": "m",
    "Gary": "m", "George": "m", "Gordon": "m", "Harry": "m", "Hassan": "m",
    "Hugo": "m", "Imran": "m", "Jack": "m", "Jacob": "m", "Jair": "m",
    "James": "m", "Jamie": "m", "Jeremy": "m", "Joe": "m", "John": "m",
    "Jose": "m", "Joseph": "m", "Justin": "m", "Kanye": "m", "Keir": "m",
    "Kevin": "m", "Kwasi": "m", "Kylian": "m", "Lewis": "m", "Liam": "m",
    "Lionel": "m", "Louis": "m", "Lula": "m", "Malcolm": "m", "Marcus": "m",
    "Mark": "m", "Martin": "m", "Matt": "m", "Michael": "m", "Michel": "m",
    "Mike": "m", "Mo": "m", "Mohamed": "m", "Narendra": "m", "Nigel": "m",
    "Novak": "m", "Olaf": "m", "Owen": "m", "Paul": "m", "Pedro": "m",
    "Peter": "m", "Phil": "m", "Philip": "m", "Rafael": "m", "Recep": "m",
    "Richard": "m", "Rishi": "m", "Robert": "m", "Roger": "m", "Ron": "m",
    "Rupert": "m", "Ryan": "m", "Sadiq": "m", "Sajid": "m", "Sam": "m",
    "Scott": "m", "Shinzo": "m", "Silvio": "m", "Simon": "m", "Stephen": "m",
    "Steve": "m", "Thomas": "m", "Tim": "m", "Tom": "m", "Tony": "m",
    "Travis": "m", "Viktor": "m", "Vladimir": "m", "Volodymyr": "m",
    "Wayne": "m", "William": "m", "Zac": "m",
    # female
    "Adele": "f", "Alice": "f", "Angela": "f", "Anna": "f", "Anne": "f",
    "Ariana": "f", "Arlene": "f", "Beyoncé": "f", "Bridget": "f",
    "Britney": "f", "Brigitte": "f", "Camilla": "f", "Caroline": "f",
    "Carrie": "f", "Charlotte": "f", "Dilma": "f", "Elizabeth": "f",
    "Emma": "f", "Esther": "f", "Giorgia": "f", "Greta": "f", "Helen": "f",
    "Hillary": "f", "Holly": "f", "Jacinda": "f", "Jane": "f", "Jess": "f",
    "Jessica": "f", "Jo": "f", "Kamala": "f", "Kate": "f", "Kemi": "f",
    "Laura": "f", "Liz": "f", "Lucy": "f", "Madonna": "f", "Margaret": "f",
    "Marine": "f", "Mary": "f", "Megan": "f", "Meghan": "f", "Melania": "f",
    "Michelle": "f", "Naomi": "f", "Nicola": "f", "Oprah": "f", "Penny": "f",
    "Priti": "f", "Rachel": "f", "Rihanna": "f", "Ruth": "f", "Sally": "f",
    "Sanna": "f", "Sarah": "f", "Serena": "f", "Sophie": "f", "Suella": "f",
    "Taylor": "f", "Theresa": "f", "Ursula": "f", "Yvette": "f",
}

# Always tracked even if no tag donates them (nicknames headlines use).
FORENAME_SEEDS = {"Boris", "Lula", "Donald", "Keir", "Rishi", "Liz", "Kamala", "Rachel"}

QUOTE_OPENERS = ("'", '"', "‘", "“")
LIVE_SUFFIXES = ("– live", "- live", "— live")

# Word-list markers, compiled once. Case-insensitive except where noted.
_RE = {
    "first_person": re.compile(r"\bI\b|\b[Mm]y\b|\b[Mm]e\b"),
    "second_person": re.compile(r"\byou\b|\byour\b", re.I),
    "swears": re.compile(
        r"\b(fuck(?:ing|ed|er|ers|s)?|shit(?:e|s|ty|show)?|bollocks|bastard(?:s)?|"
        r"wanker(?:s)?|arse(?:hole|holes|s)?|bullshit|cunt(?:s)?|twat(?:s)?|pissed)\b", re.I),
    "best": re.compile(r"\bbest\b", re.I),
    "worst": re.compile(r"\bworst\b", re.I),
    "amid": re.compile(r"\bamid\b", re.I),
    "row_word": re.compile(r"\brow\b", re.I),
    "yesterday": re.compile(r"\byesterday\b", re.I),
    "crisis": re.compile(r"\bcrisis\b", re.I),
    "chaos": re.compile(r"\bchaos\b", re.I),
    "urges": re.compile(r"\burg(?:es|ed|ing)\b", re.I),
    "review_word": re.compile(r"\breview\b", re.I),
    "recipe": re.compile(r"\brecipes?\b", re.I),
    "quiz": re.compile(r"\bquiz\b", re.I),
    "podcast": re.compile(r"\bpodcast\b", re.I),
    "so_called": re.compile(r"so-called", re.I),
    "u_turn": re.compile(r"u-turn", re.I),
    "woke": re.compile(r"\bwoke\b", re.I),
    "viral": re.compile(r"\bviral\b", re.I),
    # The journalese drawer.
    "set_to": re.compile(r"\bset to\b", re.I),
    "boost": re.compile(r"\bboost(?:s|ed)?\b", re.I),
    "blow": re.compile(r"\bblow\b", re.I),
    "sparks": re.compile(r"\bspark(?:s|ed)\b", re.I),
    "fears": re.compile(r"\bfears?\b", re.I),
    "according_to": re.compile(r"\baccording to\b", re.I),
    "hedge": re.compile(r"\b(?:could|may|might)\b", re.I),
    # Attribution verbs — what people do in headlines.
    "says_word": re.compile(r"\bsays\b", re.I),
    "warns": re.compile(r"\bwarn(?:s|ed)\b", re.I),
    "insists": re.compile(r"\binsist(?:s|ed)\b", re.I),
    "admits": re.compile(r"\badmit(?:s|ted)\b", re.I),
    # Formats and shapes.
    "qanda": re.compile(r"\bq&a\b", re.I),
    "factcheck": re.compile(r"\bfact ?check", re.I),
    "obituary": re.compile(r"\bobituary\b", re.I),
    "cartoon": re.compile(r"\bcartoon\b", re.I),
    "versus": re.compile(r"\s(?:v|vs)\s"),
    # The ", 34," construction — age, bracketed by commas.
    "age_comma": re.compile(r",\s\d{1,3},"),
}

# "-gate" coinages, minus the places and people that end in -gate anyway.
_GATE = re.compile(r"\b(\w{3,}gate)\b", re.I)
_GATE_STOP = {
    "southgate", "margate", "harrogate", "ramsgate", "billingsgate",
    "colgate", "applegate", "aldgate", "highgate", "bathgate", "reigate",
    "westgate", "eastgate", "northgate", "norgate", "lydgate", "holgate",
}


def classify(t: str, words: int) -> dict:
    tl = t.lower()
    out = {
        "question": "?" in t,
        "colon": ": " in t,
        "quote_start": t.startswith(QUOTE_OPENERS),
        "live": " live:" in tl or tl.startswith("live:") or tl.endswith(LIVE_SUFFIXES),
        "as_it_happened": "as it happened" in tl,
        "revealed": tl.startswith("revealed:"),
        "exclusive": tl.startswith("exclusive:"),
        "digits": any(ch.isdigit() for ch in t),
        "pipe": " | " in t,
        "why_start": tl.startswith("why "),
        "how_to": "how to " in tl,
        "short5": words <= 5,
        "words20": words >= 20,
        "single_word": words == 1,
        "ellipsis": "…" in t or "..." in t,
        "exclamation": "!" in t,
        "dash": " – " in t or " — " in t,
        "money": "£" in t or "$" in t or "€" in t,
        "percent": "%" in t,
        "video_suffix": tl.endswith(("– video", "- video", "— video")),
        "in_pictures": "in pictures" in tl,
        "guardian_view": tl.startswith("the guardian view"),
        "letters": tl.endswith("letters") or tl.startswith("letters:"),
        "semicolon": ";" in t,
        "brackets": "(" in t,
        "digit_start": t[:1].isdigit(),
        # A quote mark beyond the first character, at least a pair of them
        # in total — quotation somewhere in the headline, not just opening it.
        "quotes_anywhere": sum(t.count(q) for q in "'’‘\"“”") >= 2,
    }
    for k, rx in _RE.items():
        out[k] = bool(rx.search(t))
    m = _GATE.search(t)
    out["gate"] = bool(m and m.group(1).lower() not in _GATE_STOP)
    return out


METRIC_KEYS = sorted(classify("probe", 1).keys())


def tracked_forenames() -> dict[str, str]:
    derived = set()
    if CATALOG_PATH.exists():
        for tag in json.loads(CATALOG_PATH.read_text()):
            tokens = (tag.get("name") or "").split()
            if 2 <= len(tokens) <= 3 and all(t[:1].isupper() for t in tokens):
                derived.add(tokens[0])
    keep = (derived & set(FORENAMES)) | FORENAME_SEEDS
    return {n: FORENAMES[n] for n in keep if n in FORENAMES}


def month_label(ym: str) -> str:
    names = ["January", "February", "March", "April", "May", "June", "July",
             "August", "September", "October", "November", "December"]
    y, m = ym.split("-")
    return f"{names[int(m) - 1]} {y}"


def main() -> int:
    shard_paths = sorted(SHARD_DIR.glob("*.json.gz"))
    if not shard_paths:
        print("ERROR: no shards in data/shards/", file=sys.stderr)
        return 1

    names_tracked = tracked_forenames()
    print(f"tracking {len(names_tracked)} first names, {len(METRIC_KEYS)} markers",
          file=sys.stderr)
    token_re = re.compile(r"[^\W\d_]+(?:'[^\W\d_]+)?", re.UNICODE)

    months: list[str] = []
    totals: list[int] = []
    avg_words: list[float] = []
    avg_chars: list[float] = []
    counts: dict[str, list[int]] = {k: [] for k in METRIC_KEYS}
    longest: list[dict] = []
    # year → gender → {name: headline count}
    name_years: dict[str, dict[str, dict[str, int]]] = {}

    # Per-scope accumulation: every marker counted again within each
    # section and each tone, so the Style page can answer "do Sport
    # headlines swear more than Opinion?". Scopes appear mid-archive
    # (sections launch, tones get coined), so a new scope is backfilled
    # with zeros to stay month-aligned.
    scope_data: dict[str, dict] = {}

    def get_scope(key: str) -> dict:
        sd = scope_data.get(key)
        if sd is None:
            done = len(months) - 1   # months already fully processed
            sd = {
                "totals": [0] * (done + 1),
                "word_sum": [0] * (done + 1),
                "metrics": {k: [0] * (done + 1) for k in METRIC_KEYS},
            }
            scope_data[key] = sd
        return sd

    for p in shard_paths:
        with gzip.open(p, "rb") as fh:
            shard = json.loads(fh.read())
        heads = shard.get("headlines", [])
        n = len(heads)
        month = p.stem.replace(".json", "")
        year = month[:4]
        months.append(month)
        totals.append(n)
        ny = name_years.setdefault(year, {"m": {}, "f": {}})

        # Open the month in every scope already seen, keeping arrays aligned.
        for sd in scope_data.values():
            sd["totals"].append(0)
            sd["word_sum"].append(0)
            for arr in sd["metrics"].values():
                arr.append(0)

        word_sum = 0
        char_sum = 0
        c = {k: 0 for k in METRIC_KEYS}
        for h in heads:
            t = h.get("t") or ""
            words = len(t.split())
            word_sum += words
            char_sum += len(t)
            cls = classify(t, words)
            for k, v in cls.items():
                if v:
                    c[k] += 1
            # Scope increments: the headline's section, plus any tone tags.
            dims = []
            if h.get("s"):
                dims.append("sec:" + h["s"])
            for tag in (h.get("g") or []):
                if tag.startswith("tone/"):
                    dims.append("tone:" + tag[5:])
            for d in dims:
                sd = get_scope(d)
                sd["totals"][-1] += 1
                sd["word_sum"][-1] += words
                sm = sd["metrics"]
                for k, v in cls.items():
                    if v:
                        sm[k][-1] += 1
            for tok in set(token_re.findall(t)):
                g = names_tracked.get(tok)
                if g:
                    ny[g][tok] = ny[g].get(tok, 0) + 1
            if len(t) > (longest[-1]["chars"] if len(longest) == 3 else 0):
                longest.append({"t": t, "d": h.get("d"), "u": h.get("u"), "chars": len(t)})
                longest.sort(key=lambda e: -e["chars"])
                del longest[3:]

        avg_words.append(round(word_sum / n, 2) if n else 0)
        avg_chars.append(round(char_sum / n, 1) if n else 0)
        for k in METRIC_KEYS:
            counts[k].append(c[k])
        print(f"  {p.stem} ({n})", file=sys.stderr)

    # Keep only the biggest scopes — the page offers a dropdown, not an
    # encyclopaedia. Sections and tones ranked by total headline volume.
    SCOPE_SECTIONS_N, SCOPE_TONES_N = 12, 8

    def top_scopes(prefix, n_keep):
        ranked = sorted(
            ((k, sum(sd["totals"])) for k, sd in scope_data.items() if k.startswith(prefix)),
            key=lambda kv: -kv[1])
        return [k for k, _ in ranked[:n_keep]]

    def pack_scope(key):
        sd = scope_data[key]
        return {
            "totals": sd["totals"],
            "avg_words": [round(w / t, 2) if t else 0 for w, t in zip(sd["word_sum"], sd["totals"])],
            "metrics": sd["metrics"],
        }

    scopes_out = {
        "sections": {k[4:]: pack_scope(k) for k in top_scopes("sec:", SCOPE_SECTIONS_N)},
        "tones": {k[5:]: pack_scope(k) for k in top_scopes("tone:", SCOPE_TONES_N)},
    }

    years = sorted(name_years)
    names_top = {
        g: {y: sorted(name_years[y][g].items(), key=lambda kv: -kv[1])[:10] for y in years}
        for g in ("m", "f")
    }

    # ── The facts pool ──
    # Computed sentences for the "one more thing" card. Superlative
    # months need a full month behind them or the partial current month
    # wins everything. Aim for variety: records, crossings, cumulative
    # oddities, and only the *change moments* from the name league.
    facts: list[str] = []
    total_heads = sum(totals)
    solid = [i for i, n in enumerate(totals) if n >= 1000]
    span_days = max(1, (len(months) * 30))

    def peak(metric):
        i = max(solid, key=lambda i: counts[metric][i] / totals[i])
        return i, 100 * counts[metric][i] / totals[i]

    def yearly_pct(metric, y):
        ix = [i for i, m in enumerate(months) if m.startswith(y)]
        nn = sum(totals[i] for i in ix)
        return 100 * sum(counts[metric][i] for i in ix) / nn if nn else 0

    # Records.
    i = max(solid, key=lambda i: avg_words[i])
    facts.append(f"The wordiest month in the archive was {month_label(months[i])}: {avg_words[i]:.1f} words per average headline.")
    j = min(solid, key=lambda i: avg_words[i])
    facts.append(f"The tersest month was {month_label(months[j])} — headlines averaged just {avg_words[j]:.1f} words.")
    for metric, template in [
        ("question", "The most question-laden month was {m}, when {v:.1f}% of headlines asked you something."),
        ("as_it_happened", "Peak liveblog: {m}, when {v:.1f}% of everything was '…as it happened'."),
        ("quote_start", "Peak quotation: {m} — {v:.1f}% of headlines opened with someone talking."),
        ("digits", "{m} was the most numerical month ever: {v:.0f}% of headlines contained a digit."),
        ("swears", "The sweariest month in the archive was {m}: {v:.2f}% of headlines contained a swear word."),
        ("exclamation", "The most excitable month was {m} — {v:.1f}% of headlines contained an exclamation mark."),
        ("crisis", "Peak crisis: {m}, when {v:.1f}% of headlines contained the word itself."),
        ("amid", "Peak journalese: {m}, when {v:.1f}% of headlines contained the word 'amid'."),
    ]:
        i, v = peak(metric)
        facts.append(template.format(m=month_label(months[i]), v=v))

    # Cumulative oddities and format deaths.
    sw = sum(counts["swears"])
    if sw:
        facts.append(f"The Guardian has put a swear word in {sw:,} headlines — roughly one every {round(span_days / sw)} days for fifteen years.")
    facts.append(f"'Exclusive:' has opened {sum(counts['exclusive'])} headlines out of {total_heads:,} — the word the Guardian famously won't use.")
    facts.append(f"There are {sum(counts['as_it_happened']):,} '…as it happened' headlines in the archive.")
    facts.append(f"{sum(counts['single_word']):,} headlines are a single word.")
    facts.append(f"In {years[0]}, {yearly_pct('in_pictures', years[0]):.1f}% of headlines were '…in pictures' galleries. The format is now effectively extinct: {yearly_pct('in_pictures', years[-1]):.2f}%.")
    facts.append(f"'– video' headlines peaked at {max(yearly_pct('video_suffix', y) for y in years):.1f}% of everything and have since vanished entirely.")

    # Threshold crossings.
    yearly_words = {}
    for y in years:
        ix = [i for i, m in enumerate(months) if m.startswith(y)]
        nn = sum(totals[i] for i in ix)
        yearly_words[y] = sum(avg_words[i] * totals[i] for i in ix) / nn if nn else 0
    for threshold in (10, 11, 12, 13):
        crossed = next((y for y in years if yearly_words[y] >= threshold), None)
        if crossed and crossed != years[0]:
            facts.append(f"In {crossed}, the average headline passed {threshold} words for the first time.")
    for threshold in (1, 5, 10):
        crossed = next((y for y in years if yearly_pct("quote_start", y) >= threshold), None)
        if crossed and crossed != years[0]:
            facts.append(f"In {crossed}, more than {threshold}% of headlines opened with a quote for the first time.")

    # Name-league change moments only — the league itself lives on the page.
    for g, label in (("m", "male"), ("f", "female")):
        prev = None
        for y in years:
            top = names_top[g][y]
            if not top:
                continue
            leader = top[0][0]
            if prev and leader != prev and int(y) > int(years[0]):
                facts.append(f"In {y}, {leader} overtook {prev} as the most-headlined {label} first name.")
            prev = leader

    facts = [f for f in facts if f]

    payload = {
        "months": months,
        "totals": totals,
        "metrics": {"avg_words": avg_words, "avg_chars": avg_chars, **counts},
        "longest": longest,
        "names": names_top,
        "facts": facts,
        "scopes": scopes_out,
    }
    blob = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    # Deterministic gzip, same reasoning as write_shard in fetch_guardian.py.
    with open(OUT_PATH, "wb") as raw:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw, compresslevel=9, mtime=0) as f:
            f.write(blob)
    print(f"→ wrote {OUT_PATH.name} ({OUT_PATH.stat().st_size / 1024:.0f} KB gz, "
          f"{len(METRIC_KEYS)} markers, {len(facts)} facts)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
