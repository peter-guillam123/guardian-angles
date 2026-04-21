#!/usr/bin/env python3
"""
Fetch authoritative display names for every tag in data/tag-catalog.json
from the Guardian's /tags CAPI endpoint and write them to
data/tag-names.json.

Why this script exists: Guardian tag slugs are immutable (e.g.
`politics/brexit-party`), but the Guardian's webTitle on a tag can
change — e.g. when Brexit Party renamed itself to Reform UK, the
webTitle became "Reform UK" but the slug stayed. Our build previously
derived display names from the slug (title-cased), so we'd display
"Brexit Party" when the Guardian now calls it "Reform UK". This
script pulls the current webTitle straight from CAPI, which is the
authoritative editorial name.

Strategy: iterate /tags?page-size=200 across all pages, filtering
each page down to the tag IDs in our catalog, until every catalog
entry has a webTitle. ~250 requests at 1 req/sec max ≈ 4–5 min for
50k tags, typically much less since we stop when our catalog is fully
resolved.

Fallbacks in build_tag_index.py pick up anything /tags doesn't return
(very old tags, deleted tags, etc.): NAME_OVERRIDES first, then
slug-to-title as the last resort.

Usage:
    python3 build/fetch_tag_names.py

Needs GUARDIAN_API_KEY in the environment (same key as fetch_guardian.py).
"""
import os
import json
import sys
import time
from pathlib import Path

import requests

API_KEY = os.environ.get("GUARDIAN_API_KEY")
if not API_KEY:
    print("Set GUARDIAN_API_KEY in the environment.", file=sys.stderr)
    sys.exit(1)

API_BASE = "https://content.guardianapis.com/tags"
PAGE_SIZE = 200
REQUEST_INTERVAL = 1.0  # seconds — free dev tier is 1 req/s

CATALOG_PATH = Path("data/tag-catalog.json")
OUTPUT_PATH = Path("data/tag-names.json")


def fetch_page(page: int) -> dict:
    """Fetch one page of the /tags endpoint with retry on 429/5xx."""
    params = {
        "api-key": API_KEY,
        "page-size": PAGE_SIZE,
        "page": page,
    }
    for delay in [0, 5, 15, 45, 120]:
        if delay:
            print(f"    (retry after {delay}s)", file=sys.stderr)
            time.sleep(delay)
        r = requests.get(API_BASE, params=params, timeout=30)
        if r.status_code == 200:
            return r.json()["response"]
        if r.status_code in (429, 500, 502, 503, 504):
            continue
        r.reason = f"{r.reason} (page {page})"
        r.raise_for_status()
    raise RuntimeError(f"Gave up on /tags page {page}")


def main():
    catalog = json.loads(CATALOG_PATH.read_text())
    wanted = {t["id"] for t in catalog}
    print(f"Catalog has {len(wanted):,} tags to resolve.", file=sys.stderr)

    # Preserve any names we've already resolved from a previous run so
    # we can be resumed / re-run cheaply without re-fetching pages.
    existing = {}
    if OUTPUT_PATH.exists():
        existing = json.loads(OUTPUT_PATH.read_text())
        print(f"Loaded {len(existing):,} pre-resolved names from previous run.", file=sys.stderr)
    wanted -= set(existing.keys())

    resolved = dict(existing)

    page = 1
    last_request = 0.0
    while wanted:
        # Rate-limit: free tier is 1 req/s. Guard strictly.
        dt = time.monotonic() - last_request
        if dt < REQUEST_INTERVAL:
            time.sleep(REQUEST_INTERVAL - dt)
        last_request = time.monotonic()

        resp = fetch_page(page)
        results = resp.get("results", [])
        if not results:
            print(f"[page {page}] empty — CAPI exhausted.", file=sys.stderr)
            break

        hits = 0
        for t in results:
            tid = t.get("id")
            title = t.get("webTitle")
            if tid in wanted and title:
                resolved[tid] = title
                wanted.discard(tid)
                hits += 1

        total_pages = resp.get("pages") or "?"
        print(
            f"[page {page}/{total_pages}] +{hits} — {len(resolved):,} resolved, "
            f"{len(wanted):,} remaining",
            file=sys.stderr,
        )

        # Persist after each page so we can Ctrl-C and resume.
        OUTPUT_PATH.write_text(
            json.dumps(resolved, ensure_ascii=False, sort_keys=True, indent=2)
        )

        if page >= (resp.get("pages") or 0):
            print("[done] reached last page.", file=sys.stderr)
            break
        page += 1

    print(
        f"Wrote {len(resolved):,} tag names to {OUTPUT_PATH}.",
        file=sys.stderr,
    )
    if wanted:
        print(
            f"  {len(wanted)} catalog tags had no match — they'll fall back to "
            f"NAME_OVERRIDES or slug_to_title:",
            file=sys.stderr,
        )
        for t in sorted(wanted)[:20]:
            print(f"    {t}", file=sys.stderr)


if __name__ == "__main__":
    main()
