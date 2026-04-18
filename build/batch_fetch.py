"""
Patient batch fetcher: picks a small amount of work to do, does it, exits.

Designed to be called on a short cron cadence (every 30 min or so) so we
can grind through the full decade without hitting the Guardian API's
rate limits. Each run:

1. Finds any months missing from data/shards/ between 2016-01 and today
2. Finds any existing shards missing the 'u' (article URL) field
3. Picks up to N months from each bucket (new first, URL-refetch second)
4. Calls fetch_month() for each, writes the shard, and exits cleanly

If a fetch hits a rate-limit ceiling, we bail early and leave it for the
next run. This keeps every run small and bounded, and means we just need
to keep the cron running until everything's done.

Usage:
    python build/batch_fetch.py                  # default batch sizes
    python build/batch_fetch.py --new 4 --refetch 2
"""

from __future__ import annotations

import argparse
import datetime as dt
import gzip
import json
import sys
import time
from pathlib import Path

from fetch_guardian import API_KEY, fetch_month, write_shard, month_range

REPO_ROOT = Path(__file__).resolve().parent.parent
SHARD_DIR = REPO_ROOT / "data" / "shards"


def current_month() -> str:
    today = dt.date.today()
    return f"{today.year:04d}-{today.month:02d}"


def previous_month() -> str:
    today = dt.date.today()
    first_of_this = today.replace(day=1)
    last_of_prev = first_of_this - dt.timedelta(days=1)
    return f"{last_of_prev.year:04d}-{last_of_prev.month:02d}"


def existing_shards() -> set[str]:
    return {p.stem.replace(".json", "") for p in SHARD_DIR.glob("*.json.gz")}


def find_missing_months(start: str = "2012-01") -> list[str]:
    want = list(month_range(start, current_month()))
    have = existing_shards()
    return [m for m in want if m not in have]


def find_url_less_shards() -> list[str]:
    """Return existing shard months whose headlines lack the `u` (URL) field.

    Checks the first few headlines of each shard as a proxy — if those don't
    have `u`, the whole shard was fetched with the older schema.
    """
    url_less: list[str] = []
    for p in sorted(SHARD_DIR.glob("*.json.gz")):
        try:
            with gzip.open(p, "rb") as fh:
                shard = json.loads(fh.read())
        except Exception:
            continue
        heads = shard.get("headlines", [])
        if not heads:
            continue
        # If any of the first handful has 'u', the whole shard does
        if not any("u" in h for h in heads[:5]):
            url_less.append(shard.get("month") or p.stem.replace(".json", ""))
    return url_less


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--new", type=int, default=3, help="Max NEW months per run (default 3)")
    p.add_argument("--refetch", type=int, default=2,
                   help="Max existing months to REFETCH for URL enrichment (default 2)")
    p.add_argument("--max-total", type=int, default=5,
                   help="Hard cap on total months per run regardless of buckets (default 5)")
    return p.parse_args()


def main() -> int:
    if not API_KEY:
        print("ERROR: GUARDIAN_API_KEY not set.", file=sys.stderr)
        return 1

    args = parse_args()

    missing = find_missing_months()
    url_less = find_url_less_shards()

    print(f"Status: {len(missing)} months missing, {len(url_less)} shards without URLs",
          file=sys.stderr)

    queue: list[str] = []

    if missing or url_less:
        # Backfill mode — prioritise getting the dataset complete first.
        # We skip the current-month freshness refresh while we're still
        # catching up, to keep every run small.
        queue.extend(missing[: args.new])
        queue.extend(url_less[: args.refetch])
        queue = queue[: args.max_total]
    else:
        # Steady state: the archive is complete. Keep the current and
        # previous months fresh so the dashboard stays close to live.
        # (Previous-month because articles sometimes get their dates
        # shifted by editors on publish, or we just want to catch any
        # late-breaking stragglers.)
        cur = current_month()
        prev = previous_month()
        queue = [cur, prev]
        print("Dataset complete — refreshing current + previous month.",
              file=sys.stderr)

    if not queue:
        print("Nothing selected for this run.", file=sys.stderr)
        return 0

    print(f"This run will fetch: {', '.join(queue)}", file=sys.stderr)

    done = 0
    for month in queue:
        try:
            shard = fetch_month(month)
            write_shard(shard)
            done += 1
            time.sleep(2)  # gentle pause between months
        except Exception as e:
            # Rate-limited or other failure — stop early, next run will retry
            print(f"\nStopped at {month}: {type(e).__name__}: {e}", file=sys.stderr)
            break

    print(f"\nRun complete: {done}/{len(queue)} months fetched.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
