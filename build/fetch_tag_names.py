#!/usr/bin/env python3
"""
Fetch authoritative display names for every tag in data/tag-catalog.json
and data/tag-catalog-long.json from the Guardian's /tags CAPI endpoint,
and write them to data/tag-names.json.

Why: tag slugs never change, but a tag's webTitle can (Brexit Party
became Reform UK; the slug stayed `politics/brexit-party`). Old slugs
are also often smooshed (`film/willsmith`), which slug-to-title can't
split. The webTitle is the Guardian's own current name.

/tags accepts up to 50 ids per call, so ~14,000 tags cost ~280 calls,
about five minutes at 1 req/s. Every name is refreshed on each run so
renames are picked up. Names CAPI no longer returns (deleted tags) are
kept from the previous file; build_tag_index.py falls back to
NAME_OVERRIDES, then slug-to-title, for anything never resolved.

Usage:
    python3 build/fetch_tag_names.py

Needs GUARDIAN_API_KEY in the environment (same key as fetch_guardian.py).
"""
import json
import os
import sys
import time
from pathlib import Path

import requests

API_KEY = os.environ.get("GUARDIAN_API_KEY")
if not API_KEY:
    print("Set GUARDIAN_API_KEY in the environment.", file=sys.stderr)
    sys.exit(1)

API_BASE = "https://content.guardianapis.com/tags"
BATCH = 50  # CAPI's hard limit on the ids parameter
REQUEST_INTERVAL = 1.0

CATALOG_PATHS = [Path("data/tag-catalog.json"), Path("data/tag-catalog-long.json")]
OUTPUT_PATH = Path("data/tag-names.json")


def fetch_batch(ids: list[str]) -> dict[str, str]:
    params = {"api-key": API_KEY, "ids": ",".join(ids), "page-size": BATCH}
    for delay in [0, 5, 15, 45, 120]:
        if delay:
            print(f"    (retry after {delay}s)", file=sys.stderr)
            time.sleep(delay)
        r = requests.get(API_BASE, params=params, timeout=30)
        if r.status_code == 200:
            return {
                t["id"]: t["webTitle"]
                for t in r.json()["response"].get("results", [])
                if t.get("id") and t.get("webTitle")
            }
        if r.status_code in (429, 500, 502, 503, 504):
            continue
        r.raise_for_status()
    raise RuntimeError(f"Gave up on batch starting {ids[0]}")


def main():
    wanted: list[str] = []
    for path in CATALOG_PATHS:
        if path.exists():
            wanted += [t["id"] for t in json.loads(path.read_text())]
    wanted = sorted(set(wanted))
    print(f"{len(wanted):,} tags to resolve in {-(-len(wanted) // BATCH)} calls.", file=sys.stderr)

    resolved = json.loads(OUTPUT_PATH.read_text()) if OUTPUT_PATH.exists() else {}
    fresh = 0
    last_request = 0.0
    for i in range(0, len(wanted), BATCH):
        wait = REQUEST_INTERVAL - (time.monotonic() - last_request)
        if wait > 0:
            time.sleep(wait)
        last_request = time.monotonic()
        names = fetch_batch(wanted[i:i + BATCH])
        resolved.update(names)
        fresh += len(names)
        if (i // BATCH) % 20 == 0:
            print(f"  [{i + BATCH:,}/{len(wanted):,}] {fresh:,} resolved", file=sys.stderr)

    OUTPUT_PATH.write_text(json.dumps(resolved, ensure_ascii=False, sort_keys=True, indent=2))
    missing = [t for t in wanted if t not in resolved]
    print(f"Wrote {len(resolved):,} names ({fresh:,} fresh from CAPI).", file=sys.stderr)
    if missing:
        print(f"  {len(missing)} tags unresolved; build falls back to overrides / slug:", file=sys.stderr)
        for t in missing[:20]:
            print(f"    {t}", file=sys.stderr)


if __name__ == "__main__":
    main()
