"""
Build three pre-aggregated indexes from the monthly shards:

    data/term-index-monthly.json.gz   # ~ 50 buckets × 5k terms
    data/term-index-weekly.json.gz    # ~220 buckets × 5k terms
    data/term-index-daily.json.gz     # ~1500 buckets × 5k terms (gzipped; zeros compress well)
    data/sections.json                # monthly section counts (for headline explorer / bar chart)
    data/meta.json                    # summary metadata

Each term-index file has shape:
    { "buckets": ["2022-01", ...] or ["2022-W03", ...] or ["2022-01-15", ...],
      "totals":  [int, int, ...],            # headlines per bucket
      "terms":   { term: [counts_per_bucket, ...] } }

Rarer terms (not in the top N) fall back to client-side shard scanning — they
don't need the index.
"""

from __future__ import annotations

import argparse
import datetime as dt
import gzip
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SHARD_DIR = REPO_ROOT / "data" / "shards"
DATA_DIR = REPO_ROOT / "data"

STOPWORDS = frozenset(
    """
    a about above after again against all am an and any are as at be because been
    before being below between both but by can could did do does doing don down
    during each few for from further had has have having he her here hers herself
    him himself his how i if in into is it its itself just me more most my myself
    no nor not now of off on once only or other our ours ourselves out over own
    same she should so some such than that the their theirs them themselves then
    there these they this those through to too under until up very was we were
    what when where which while who whom why will with would you your yours yourself
    yourselves s t ll ve re d m isn aren wasn weren don doesn didn hasn haven hadn
    wouldn couldn shouldn won say says said one two new get got also like may
    could would make take says year years time
    """.split()
)

# Word-start: any letter (incl. accented). Extend: letters, digits inside
# names (e.g. "covid-19"), apostrophes, hyphens. Unicode-aware so names like
# "Orbán", "Jürgen", "Sánchez" tokenise as single words rather than losing
# their leading letter at the accent boundary.
TOKEN_RE = re.compile(r"[^\W\d_][\w'\-\u2019]*", re.UNICODE)


def _strip_accents(s: str) -> str:
    """Decompose accented characters, drop combining marks. 'Orbán' -> 'Orban'."""
    return "".join(
        c for c in unicodedata.normalize("NFKD", s)
        if not unicodedata.combining(c)
    )


def _clean_token(t: str) -> str:
    """Strip trailing possessive 's (or curly 's) and stray apostrophes."""
    # Normalise curly apostrophe to straight for consistent stripping
    t = t.replace("\u2019", "'")
    if t.endswith("'s"):
        t = t[:-2]
    while t.endswith("'") or t.endswith("-"):
        t = t[:-1]
    return t


def tokenize(text: str) -> list[str]:
    text = _strip_accents(text)
    raw = TOKEN_RE.findall(text.lower())
    out = []
    for t in raw:
        t = _clean_token(t)
        if len(t) > 1:
            out.append(t)
    return out


def load_shards() -> list[dict]:
    shards = []
    for f in sorted(SHARD_DIR.glob("*.json.gz")):
        with gzip.open(f, "rb") as fh:
            shards.append(json.loads(fh.read()))
    return shards


def iso_week_bucket(iso_date: str) -> str:
    """ISO year/week bucket: 2024-W27 etc. We use ISO weeks so year boundaries behave."""
    d = dt.date.fromisoformat(iso_date)
    y, w, _ = d.isocalendar()
    return f"{y:04d}-W{w:02d}"


def day_bucket(iso_date: str) -> str:
    return iso_date  # already YYYY-MM-DD


def month_bucket(iso_date: str) -> str:
    return iso_date[:7]


GRANULARITIES = {
    "monthly": month_bucket,
    "weekly": iso_week_bucket,
    "daily": day_bucket,
}


def collect_buckets(shards: list[dict], bucketer) -> list[str]:
    """Return a sorted list of all bucket keys present across shards."""
    seen = set()
    for shard in shards:
        for h in shard["headlines"]:
            date = (h.get("d") or "")[:10]
            if not date:
                continue
            seen.add(bucketer(date))
    return sorted(seen)


def build_granularity(shards, bucketer_name, bucketer, top_n: int) -> dict:
    buckets = collect_buckets(shards, bucketer)
    idx = {b: i for i, b in enumerate(buckets)}
    n = len(buckets)
    totals = [0] * n

    # First pass: global token frequencies to pick top-N, plus totals
    global_tokens: Counter[str] = Counter()
    for shard in shards:
        for h in shard["headlines"]:
            date = (h.get("d") or "")[:10]
            if not date:
                continue
            b = bucketer(date)
            if b not in idx:
                continue
            totals[idx[b]] += 1
            for tok in tokenize(h.get("t", "")):
                if tok in STOPWORDS:
                    continue
                global_tokens[tok] += 1

    top_terms = {t for t, _ in global_tokens.most_common(top_n)}

    # Second pass: per-bucket counts for the top terms only
    term_buckets: dict[str, list[int]] = {t: [0] * n for t in top_terms}
    for shard in shards:
        for h in shard["headlines"]:
            date = (h.get("d") or "")[:10]
            if not date:
                continue
            b = bucketer(date)
            if b not in idx:
                continue
            bi = idx[b]
            for tok in tokenize(h.get("t", "")):
                if tok in top_terms:
                    term_buckets[tok][bi] += 1

    print(
        f"  [{bucketer_name}] {n} buckets · {len(top_terms)} terms · {sum(totals):,} headlines",
        file=sys.stderr,
    )

    return {"buckets": buckets, "totals": totals, "terms": term_buckets}


def write_gz(path: Path, obj: dict) -> None:
    payload = json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    with gzip.open(path, "wb", compresslevel=9) as f:
        f.write(payload)
    size_kb = path.stat().st_size / 1024
    print(f"  → wrote {path.name} ({size_kb:.0f} KB gz)", file=sys.stderr)


def build_sections(shards) -> dict:
    """Monthly section counts, used by the headline-explorer and the
    idle-mode totals in the reading panel."""
    months = sorted({shard["month"] for shard in shards})
    idx = {m: i for i, m in enumerate(months)}
    n = len(months)
    section_counts: dict[str, list[int]] = defaultdict(lambda: [0] * n)
    totals = [0] * n
    for shard in shards:
        mi = idx[shard["month"]]
        totals[mi] += shard["count"]
        for h in shard["headlines"]:
            s = h.get("s") or "other"
            section_counts[s][mi] += 1
    # sort sections by total volume
    sections_sorted = dict(sorted(section_counts.items(), key=lambda kv: -sum(kv[1])))
    return {"months": months, "totals": totals, "sections": sections_sorted}


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--top", type=int, default=5000, help="Top-N terms per granularity (default 5000)")
    p.add_argument("--skip-daily", action="store_true", help="Skip the daily index (smaller artifacts)")
    args = p.parse_args()

    shards = load_shards()
    if not shards:
        print("ERROR: no shards. Run fetch_guardian.py first.", file=sys.stderr)
        return 1

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Loaded {len(shards)} month shards: {shards[0]['month']} … {shards[-1]['month']}", file=sys.stderr)

    granularities = [("monthly", month_bucket), ("weekly", iso_week_bucket)]
    if not args.skip_daily:
        granularities.append(("daily", day_bucket))

    for name, fn in granularities:
        print(f"Building {name} index…", file=sys.stderr)
        index = build_granularity(shards, name, fn, top_n=args.top)
        write_gz(DATA_DIR / f"term-index-{name}.json.gz", index)

    print("Building sections.json…", file=sys.stderr)
    sections = build_sections(shards)
    with open(DATA_DIR / "sections.json", "w", encoding="utf-8") as f:
        json.dump(sections, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  → wrote sections.json ({(DATA_DIR/'sections.json').stat().st_size/1024:.0f} KB)", file=sys.stderr)

    # Meta
    meta = {
        "months": sections["months"],
        "total_headlines": sum(sections["totals"]),
        "built_at": dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "granularities": [g[0] for g in granularities],
        "top_terms_count": args.top,
    }
    with open(DATA_DIR / "meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print("  → wrote meta.json", file=sys.stderr)

    # Backward compat: keep legacy term-index.json.gz as a symlink / copy of monthly
    legacy = DATA_DIR / "term-index.json.gz"
    if legacy.exists() or legacy.is_symlink():
        legacy.unlink()
    # Copy (simpler than symlink for GitHub Pages)
    src = DATA_DIR / "term-index-monthly.json.gz"
    legacy.write_bytes(src.read_bytes())
    print(f"  → legacy copy term-index.json.gz (= term-index-monthly)", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
