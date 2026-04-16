"""
Fetch Guardian headlines for a range of months and write one gzipped JSON shard per month.

Usage:
    python fetch_guardian.py                      # all months 2016-01 → current
    python fetch_guardian.py --months 2025-01,2025-02
    python fetch_guardian.py --from 2024-01 --to 2024-12

Each shard is data/shards/YYYY-MM.json.gz with shape:
    {
      "month": "2025-01",
      "fetched_at": "2026-04-14T03:00:00Z",
      "count": 12453,
      "headlines": [
        {
          "t": "Headline text",                   # title (web-title)
          "d": "2025-01-15T08:23:11Z",            # webPublicationDate
          "s": "politics",                         # sectionId
          "g": ["politics/labour", "uk/uk"]        # keyword tag ids (truncated)
        },
        ...
      ]
    }

We DO NOT fetch byline/author fields. That's a deliberate product choice.
"""

from __future__ import annotations

import argparse
import calendar
import datetime as dt
import gzip
import json
import os
import sys
import time
from pathlib import Path
from typing import Iterable

import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.environ.get("GUARDIAN_API_KEY")
API_BASE = "https://content.guardianapis.com/search"
PAGE_SIZE = 200  # API max
RATE_LIMIT_SECONDS = 3.5  # Guardian's real throttle is tighter than stated;
                          # 3.5s keeps us under the ~1000 calls/hour burst limit
INTER_MONTH_PAUSE = 20    # extra breathing room between months
REPO_ROOT = Path(__file__).resolve().parent.parent
SHARD_DIR = REPO_ROOT / "data" / "shards"

# Tag types we want (keywords = topical tags like "politics/labour").
# We EXCLUDE contributor tags to keep bylines out of the pipeline.
TAG_TYPES = "keyword,series,tone"


def month_range(start: str, end: str) -> Iterable[str]:
    """Yield YYYY-MM strings from start to end inclusive."""
    y, m = map(int, start.split("-"))
    ey, em = map(int, end.split("-"))
    while (y, m) <= (ey, em):
        yield f"{y:04d}-{m:02d}"
        m += 1
        if m > 12:
            m = 1
            y += 1


def month_bounds(month: str) -> tuple[str, str]:
    """Return (from_date, to_date) as ISO dates for a YYYY-MM string."""
    y, m = map(int, month.split("-"))
    last_day = calendar.monthrange(y, m)[1]
    return f"{y:04d}-{m:02d}-01", f"{y:04d}-{m:02d}-{last_day:02d}"


def fetch_page(from_date: str, to_date: str, page: int) -> dict:
    params = {
        "api-key": API_KEY,
        "from-date": from_date,
        "to-date": to_date,
        "page-size": PAGE_SIZE,
        "page": page,
        "show-tags": TAG_TYPES,
        "order-by": "oldest",
    }
    # Retry with exponential backoff on 429 and transient 5xx. The Guardian
    # dev tier will 429 aggressively if you've recently made a burst; a few
    # patient retries almost always clear it.
    delays = [5, 15, 45, 120, 300]
    for attempt, delay in enumerate([0] + delays):
        if delay:
            print(f"    (retry after {delay}s — attempt {attempt})", file=sys.stderr)
            time.sleep(delay)
        r = requests.get(API_BASE, params=params, timeout=30)
        if r.status_code == 200:
            return r.json()["response"]
        if r.status_code in (429, 500, 502, 503, 504):
            continue
        # Redact the api key before raising so it doesn't land in logs
        safe_url = r.url.split("?")[0]
        r.reason = f"{r.reason} ({safe_url})"
        r.raise_for_status()
    # Exhausted retries
    raise RuntimeError(f"Giving up on {from_date}→{to_date} page {page} after repeated 429/5xx")


def compact_result(item: dict) -> dict:
    """Strip a raw Guardian API result down to the tiny shape we store.

    Includes `u` — the article's relative path / id — so the frontend can
    construct https://www.theguardian.com/{u} as a clickable link.
    """
    tags = item.get("tags", []) or []
    # Only keep topical tag ids, up to 8 (most articles have < 5)
    tag_ids = [t["id"] for t in tags if t.get("type") in ("keyword", "series", "tone")][:8]
    return {
        "t": item.get("webTitle", ""),
        "d": item.get("webPublicationDate", ""),
        "s": item.get("sectionId", ""),
        "g": tag_ids,
        "u": item.get("id", ""),
    }


def fetch_month(month: str) -> dict:
    from_date, to_date = month_bounds(month)
    print(f"[{month}] fetching {from_date} → {to_date}", file=sys.stderr)
    all_results: list[dict] = []
    page = 1
    while True:
        resp = fetch_page(from_date, to_date, page)
        results = resp.get("results", [])
        all_results.extend(compact_result(r) for r in results)
        total_pages = resp.get("pages", 1)
        print(
            f"  page {page}/{total_pages}  (+{len(results)}, total {len(all_results)})",
            file=sys.stderr,
        )
        if page >= total_pages:
            break
        page += 1
        time.sleep(RATE_LIMIT_SECONDS)
    return {
        "month": month,
        "fetched_at": dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "count": len(all_results),
        "headlines": all_results,
    }


def write_shard(shard: dict) -> Path:
    SHARD_DIR.mkdir(parents=True, exist_ok=True)
    path = SHARD_DIR / f"{shard['month']}.json.gz"
    payload = json.dumps(shard, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    with gzip.open(path, "wb", compresslevel=9) as f:
        f.write(payload)
    size_kb = path.stat().st_size / 1024
    print(f"[{shard['month']}] wrote {path.name} ({size_kb:.0f} KB, {shard['count']} headlines)", file=sys.stderr)
    return path


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--months", help="Comma-separated YYYY-MM list, e.g. 2025-01,2025-02")
    p.add_argument("--from", dest="from_month", default="2016-01", help="Start month YYYY-MM (default 2016-01)")
    p.add_argument("--to", dest="to_month", help="End month YYYY-MM (default: current month)")
    p.add_argument("--skip-existing", action="store_true", help="Skip months whose shard already exists")
    return p.parse_args()


def main() -> int:
    if not API_KEY:
        print("ERROR: GUARDIAN_API_KEY not set. Put it in .env or export it.", file=sys.stderr)
        return 1

    args = parse_args()

    if args.months:
        months = [m.strip() for m in args.months.split(",") if m.strip()]
    else:
        today = dt.date.today()
        end = args.to_month or f"{today.year:04d}-{today.month:02d}"
        months = list(month_range(args.from_month, end))

    print(f"Fetching {len(months)} month(s): {months[0]} … {months[-1]}", file=sys.stderr)

    for i, month in enumerate(months):
        shard_path = SHARD_DIR / f"{month}.json.gz"
        if args.skip_existing and shard_path.exists():
            print(f"[{month}] skip (exists)", file=sys.stderr)
            continue
        shard = fetch_month(month)
        write_shard(shard)
        if i < len(months) - 1:
            time.sleep(INTER_MONTH_PAUSE)

    print("Done.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
