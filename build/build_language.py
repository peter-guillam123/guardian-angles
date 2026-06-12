"""Build data/language.json.gz — how Guardian headlines are written, by month.

One pass over the shards counting headline-language markers: length,
question marks, colons, quote-starts, liveblog furniture, "Revealed:",
digits, the opinion signature pipe. Pure facts about the text; the
Style page turns them into per-mille rates and draws the trends.

Definitions live here and only here — if a marker's definition changes,
the whole history is recomputed on the next build, so the chart never
mixes two definitions.

Schema:
{
  "months":  ["2012-01", ...],
  "totals":  [headlines per month],
  "metrics": {
    "avg_words":   [floats],   # mean words per headline
    "avg_chars":   [floats],   # mean characters per headline
    "question":    [counts],   # contains a question mark
    "colon":       [counts],   # contains ": " (colon-space, so 3:30pm doesn't count)
    "quote_start": [counts],   # opens with a quotation mark
    "live":        [counts],   # liveblog furniture: "live:" or trailing "– live"
    "as_it_happened": [counts],
    "revealed":    [counts],   # starts "Revealed:"
    "exclusive":   [counts],   # starts "Exclusive:"
    "digits":      [counts],   # contains any digit
    "pipe":        [counts],   # contains " | " — the opinion signature
  },
  "longest": [up to 3 of {t, d, u, chars}]   # the archive's longest headlines
}

Like the other indexes this is derived: gitignored, rebuilt every CI
run, shipped only in the Pages artifact. ~40KB gzipped.
"""

from __future__ import annotations

import gzip
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SHARD_DIR = REPO_ROOT / "data" / "shards"
CATALOG_PATH = REPO_ROOT / "data" / "tag-catalog.json"
OUT_PATH = REPO_ROOT / "data" / "language.json.gz"

# ── First names ──
# Candidates are derived from the tag catalogue (the first token of
# person-style tag names like "Keir Starmer"), then filtered through a
# forename whitelist so "Manchester United" doesn't donate "Manchester".
# Names that are also places, clubs, months or common headline words are
# excluded outright — "Jordan" is nearly always the country, "Will" at
# the start of a headline is nearly always a question coming, "Bill" is
# usually legislation.
FORENAME_WHITELIST = set("""
Aaron Adam Adele Alan Albert Alex Alexander Alexei Ali Alice Andrew Andy
Angela Anna Anne Anthony Antonio Ariana Arlene Barack Barnaby Ben Benjamin
Bernie Beyonce Boris Brad Bridget Britney Bruce Carrie Charles Charlie
Chris Christian Cristiano Daniel David Dilma Dmitry Dominic Donald Ed
Eddie Elizabeth Elon Emma Emmanuel Eric Evo Francis Frank Gareth Gary
George Gordon Greta Harry Hassan Helen Hillary Hugo Imran Jacinda Jack
Jacob Jair James Jamie Jane Jeremy Jess Jessica Joe John Jose Joseph
Justin Kamala Kanye Kate Keir Kemi Kevin Kim Kwasi Kylian Lewis Liam
Lionel Liz Louis Lula Malcolm Marcus Margaret Marine Mark Martin Mary
Matt Megan Meghan Michael Michel Mike Mo Mohamed Naomi Narendra Nicola
Nigel Nikki Novak Olaf Oprah Owen Paul Pedro Penny Peter Phil Philip
Priti Rachel Rafael Recep Rebekah Richard Rishi Robert Roger Ron Rupert
Ryan Sadiq Sajid Sam Sarah Scott Serena Shinzo Silvio Simon Stephen Steve
Suella Taylor Theresa Thomas Tim Tom Tony Travis Ursula Viktor Vladimir
Volodymyr Wayne William Xi Yvette Zac
""".split())

# Always tracked even if no tag donates them (nicknames the headlines
# actually use).
FORENAME_SEEDS = {"Boris", "Lula", "Xi", "Donald", "Keir", "Rishi", "Liz"}

NAME_TOKEN_RE = None  # built in main() from the tracked set

QUOTE_OPENERS = ("'", '"', "‘", "“")
LIVE_SUFFIXES = ("– live", "- live", "— live")

import re

# First-person markers: "I" (case-sensitive — a lone lowercase i is a
# typo, not a person) plus my/me/I'm/I've.
_FIRST_PERSON = re.compile(r"\bI\b|\bI'm\b|\bI've\b|\b[Mm]y\b|\b[Mm]e\b")
_BEST = re.compile(r"\bbest\b", re.I)

METRIC_KEYS = [
    "question", "colon", "quote_start", "live", "as_it_happened",
    "revealed", "exclusive", "digits", "pipe",
    "first_person", "why_start", "how_to", "best", "short5",
]


def classify(t: str) -> dict:
    tl = t.lower()
    return {
        "question": "?" in t,
        "colon": ": " in t,
        "quote_start": t.startswith(QUOTE_OPENERS),
        "live": " live:" in tl or tl.startswith("live:") or tl.endswith(LIVE_SUFFIXES),
        "as_it_happened": "as it happened" in tl,
        "revealed": tl.startswith("revealed:"),
        "exclusive": tl.startswith("exclusive:"),
        "digits": any(ch.isdigit() for ch in t),
        "pipe": " | " in t,
        "first_person": bool(_FIRST_PERSON.search(t)),
        "why_start": tl.startswith("why "),
        "how_to": "how to " in tl,
        "best": bool(_BEST.search(t)),
        "short5": len(t.split()) <= 5,
    }


def tracked_forenames() -> set[str]:
    derived = set()
    if CATALOG_PATH.exists():
        for tag in json.loads(CATALOG_PATH.read_text()):
            tokens = (tag.get("name") or "").split()
            if 2 <= len(tokens) <= 3 and all(t[:1].isupper() and t.replace("-", "").isalpha() for t in tokens):
                derived.add(tokens[0])
    return (derived & FORENAME_WHITELIST) | FORENAME_SEEDS


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
    print(f"tracking {len(names_tracked)} first names", file=sys.stderr)
    token_re = re.compile(r"[A-Za-z']+")

    months: list[str] = []
    totals: list[int] = []
    avg_words: list[float] = []
    avg_chars: list[float] = []
    counts: dict[str, list[int]] = {k: [] for k in METRIC_KEYS}
    longest: list[dict] = []
    name_years: dict[str, dict[str, int]] = {}   # year → {name: headline count}

    for p in shard_paths:
        with gzip.open(p, "rb") as fh:
            shard = json.loads(fh.read())
        heads = shard.get("headlines", [])
        n = len(heads)
        month = p.stem.replace(".json", "")
        year = month[:4]
        months.append(month)
        totals.append(n)
        ny = name_years.setdefault(year, {})

        word_sum = 0
        char_sum = 0
        c = {k: 0 for k in METRIC_KEYS}
        for h in heads:
            t = h.get("t") or ""
            word_sum += len(t.split())
            char_sum += len(t)
            for k, v in classify(t).items():
                if v:
                    c[k] += 1
            for tok in set(token_re.findall(t)):
                if tok in names_tracked:
                    ny[tok] = ny.get(tok, 0) + 1
            if len(t) > (longest[-1]["chars"] if len(longest) == 3 else 0):
                longest.append({"t": t, "d": h.get("d"), "u": h.get("u"), "chars": len(t)})
                longest.sort(key=lambda e: -e["chars"])
                del longest[3:]

        avg_words.append(round(word_sum / n, 2) if n else 0)
        avg_chars.append(round(char_sum / n, 1) if n else 0)
        for k in METRIC_KEYS:
            counts[k].append(c[k])
        print(f"  {p.stem} ({n})", file=sys.stderr)

    # Top 10 first names per year, for the first-name league.
    names_top = {
        y: sorted(d.items(), key=lambda kv: -kv[1])[:10]
        for y, d in sorted(name_years.items())
    }

    # ── The facts pool — computed sentences for the "one more thing"
    # card. Superlative months need a full month's worth of headlines
    # behind them or the current partial month wins everything.
    facts: list[str] = []
    total_heads = sum(totals)
    solid = [i for i, n in enumerate(totals) if n >= 1000]

    def best_month(metric, per_mille=True):
        if per_mille:
            i = max(solid, key=lambda i: counts[metric][i] / totals[i])
            return i, 100 * counts[metric][i] / totals[i]
        i = max(solid, key=lambda i: avg_words[i])
        return i, avg_words[i]

    i, v = best_month("avg_words", per_mille=False)
    facts.append(f"The wordiest month in the archive was {month_label(months[i])}: {v:.1f} words per average headline.")
    j = min(solid, key=lambda i: avg_words[i])
    facts.append(f"The tersest month was {month_label(months[j])} — headlines averaged just {avg_words[j]:.1f} words.")
    i, v = best_month("question")
    facts.append(f"The most question-laden month was {month_label(months[i])}, when {v:.1f}% of headlines asked you something.")
    i, v = best_month("as_it_happened")
    facts.append(f"Peak liveblog: {month_label(months[i])}, when {v:.1f}% of everything was '…as it happened'.")
    i, v = best_month("quote_start")
    facts.append(f"Peak quotation: {month_label(months[i])} — {v:.1f}% of headlines opened with someone talking.")
    i, v = best_month("digits")
    facts.append(f"{month_label(months[i])} was the most numerical month ever: {v:.0f}% of headlines contained a digit.")
    facts.append(f"'Exclusive:' has opened {sum(counts['exclusive'])} headlines out of {total_heads:,} — the word the Guardian famously won't use.")
    facts.append(f"'Revealed:' has opened {sum(counts['revealed']):,} headlines. Its busiest year was {max(name_years, key=lambda y: sum(counts['revealed'][i] for i, m in enumerate(months) if m.startswith(y)))}.")
    for y, top in names_top.items():
        if top and int(y) >= 2012:
            name, cnt = top[0]
            runner = f" (runner-up: {top[1][0]})" if len(top) > 1 else ""
            facts.append(f"The first name of {y} was {name} — in {cnt:,} headlines, more than any other{runner}.")

    payload = {
        "months": months,
        "totals": totals,
        "metrics": {"avg_words": avg_words, "avg_chars": avg_chars, **counts},
        "longest": longest,
        "names": names_top,
        "facts": facts,
    }
    blob = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    # Deterministic gzip, same reasoning as write_shard in fetch_guardian.py.
    with open(OUT_PATH, "wb") as raw:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw, compresslevel=9, mtime=0) as f:
            f.write(blob)
    print(f"→ wrote {OUT_PATH.name} ({OUT_PATH.stat().st_size / 1024:.0f} KB gz)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
