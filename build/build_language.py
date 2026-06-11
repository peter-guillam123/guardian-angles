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
OUT_PATH = REPO_ROOT / "data" / "language.json.gz"

QUOTE_OPENERS = ("'", '"', "‘", "“")
LIVE_SUFFIXES = ("– live", "- live", "— live")

METRIC_KEYS = [
    "question", "colon", "quote_start", "live", "as_it_happened",
    "revealed", "exclusive", "digits", "pipe",
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
    }


def main() -> int:
    shard_paths = sorted(SHARD_DIR.glob("*.json.gz"))
    if not shard_paths:
        print("ERROR: no shards in data/shards/", file=sys.stderr)
        return 1

    months: list[str] = []
    totals: list[int] = []
    avg_words: list[float] = []
    avg_chars: list[float] = []
    counts: dict[str, list[int]] = {k: [] for k in METRIC_KEYS}
    longest: list[dict] = []

    for p in shard_paths:
        with gzip.open(p, "rb") as fh:
            shard = json.loads(fh.read())
        heads = shard.get("headlines", [])
        n = len(heads)
        months.append(p.stem.replace(".json", ""))
        totals.append(n)

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
            if len(t) > (longest[-1]["chars"] if len(longest) == 3 else 0):
                longest.append({"t": t, "d": h.get("d"), "u": h.get("u"), "chars": len(t)})
                longest.sort(key=lambda e: -e["chars"])
                del longest[3:]

        avg_words.append(round(word_sum / n, 2) if n else 0)
        avg_chars.append(round(char_sum / n, 1) if n else 0)
        for k in METRIC_KEYS:
            counts[k].append(c[k])
        print(f"  {p.stem} ({n})", file=sys.stderr)

    payload = {
        "months": months,
        "totals": totals,
        "metrics": {"avg_words": avg_words, "avg_chars": avg_chars, **counts},
        "longest": longest,
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
