"""Build data/cooccur.json.gz — per-year companion tags for every catalogued tag.

For each (catalogued, editorially-useful) tag, and each year, the top
companions: tags that appear on the same articles, with shared-article
counts. This is the raw material for Deep dive's "the company it keeps"
block — the counts are facts; ranking by distinctiveness is the
frontend's job (it has the per-tag yearly totals via the tag index).

Schema:
{
  "years": [2012, ..., 2026],
  "ids":   ["politics/labour", ...],     // index space for companions
  "tags":  {
    "<topic id>": [                       // one entry per year, aligned to "years"
      [[companionIdx, sharedCount], ...], // top N, count >= MIN_COUNT, desc
      ...
    ]
  }
}

Like the other indexes this is a derived file: gitignored, rebuilt every
CI run, shipped only in the Pages artifact.
"""

from __future__ import annotations

import gzip
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

from skip_rules import is_useful_tag

REPO_ROOT = Path(__file__).resolve().parent.parent
SHARD_DIR = REPO_ROOT / "data" / "shards"
CATALOG_PATH = REPO_ROOT / "data" / "tag-catalog.json"
OUT_PATH = REPO_ROOT / "data" / "cooccur.json.gz"

TOP_N = 12        # companions kept per topic-year
MIN_COUNT = 3     # shared-article floor below which a companion is noise


def main() -> int:
    if not CATALOG_PATH.exists():
        print("ERROR: data/tag-catalog.json missing — run build_tag_index.py first.",
              file=sys.stderr)
        return 1

    catalog = json.loads(CATALOG_PATH.read_text())
    usable_ids = [t["id"] for t in catalog if is_useful_tag(t["id"])]
    idx_of = {tag_id: i for i, tag_id in enumerate(usable_ids)}
    print(f"{len(usable_ids)} usable tags of {len(catalog)} catalogued",
          file=sys.stderr)

    shard_paths = sorted(SHARD_DIR.glob("*.json.gz"))
    years = sorted({p.stem[:4] for p in shard_paths})
    year_idx = {y: i for i, y in enumerate(years)}

    # counts[(topicIdx, yearIdx)] -> Counter{companionIdx: sharedArticles}
    counts: dict[tuple[int, int], Counter] = defaultdict(Counter)

    for p in shard_paths:
        yi = year_idx[p.stem[:4]]
        with gzip.open(p, "rb") as fh:
            shard = json.loads(fh.read())
        for h in shard.get("headlines", []):
            g = h.get("g") or []
            present = list({idx_of[t] for t in g if t in idx_of})
            if len(present) < 2:
                continue
            for i, a in enumerate(present):
                for b in present[i + 1:]:
                    counts[(a, yi)][b] += 1
                    counts[(b, yi)][a] += 1
        print(f"  {p.stem} done", file=sys.stderr)

    n_years = len(years)
    out_tags: dict[str, list] = {}
    for (ti, yi), counter in counts.items():
        tag_id = usable_ids[ti]
        if tag_id not in out_tags:
            out_tags[tag_id] = [[] for _ in range(n_years)]
        top = [[ci, c] for ci, c in counter.most_common(TOP_N) if c >= MIN_COUNT]
        out_tags[tag_id][yi] = top

    payload = {
        "years": [int(y) for y in years],
        "ids": usable_ids,
        "tags": out_tags,
    }
    blob = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    # Deterministic gzip, same reasoning as write_shard in fetch_guardian.py.
    with open(OUT_PATH, "wb") as raw:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw, compresslevel=9, mtime=0) as f:
            f.write(blob)

    print(f"→ wrote {OUT_PATH.name} ({OUT_PATH.stat().st_size / 1024:.0f} KB gz, "
          f"{len(out_tags)} topics × {n_years} years)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
