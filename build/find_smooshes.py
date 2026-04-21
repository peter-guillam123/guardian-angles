#!/usr/bin/env python3
"""
Scan data/tag-catalog.json for likely smooshed display names and print a
prioritised list of candidates for review.

A smoosh is a display name that's a single long string with only the
first letter capitalised — the result of a Guardian CMS slug that
concatenated words (e.g. "politics/margaretthatcher" → "Margaretthatcher"
instead of "Margaret Thatcher"). This script flags names whose lowercase
form decomposes cleanly into 2+ dictionary words.

Usage:
    python3 build/find_smooshes.py

Requires macOS /usr/share/dict/words (most Linux distros have it too).

Uses the NAME_OVERRIDES dict in build_tag_index.py as the "already
fixed" list so repeated runs only surface new candidates.
"""
import json
import re
from pathlib import Path

DICT_PATH = "/usr/share/dict/words"
CATALOG_PATH = Path("data/tag-catalog.json")
OVERRIDES_SRC = Path("build/build_tag_index.py")

# Real one-word names that the dictionary happens to decompose — filter
# them out so the output stays actionable. Add to this set when the
# detector flags a real word as a smoosh.
NOT_SMOOSHED = {
    "afghanistan", "sunderland", "switzerland", "antisemitism",
    "sustainability", "programming", "fundraising", "psychedelia",
    "livingstone", "springsteen", "gentrification", "healthcare",
    "antibiotics", "kickstarter", "greenpeace", "centrelink",
    "newspapers", "publishing", "podcasting", "volunteering",
    "southampton", "nottinghamforest",
}

def load_dict():
    with open(DICT_PATH) as f:
        return {w.strip().lower() for w in f if len(w.strip()) >= 3}

def decompose(word, words):
    """Best split of `word` into 2+ dictionary words, each >= 4 chars.
    Returns the split as a list of parts, or None. Prefers fewer parts
    (matches human-readable compounds like "Crystal Palace" rather than
    "Cry Stal Palace")."""
    w = word.lower()
    if w in words or w in NOT_SMOOSHED:
        return None
    n = len(w)
    best = [None] * (n + 1)
    best[n] = []
    for i in range(n - 1, -1, -1):
        for j in range(n, i + 3, -1):  # min piece length 4
            piece = w[i:j]
            if piece in words and best[j] is not None:
                candidate = [piece] + best[j]
                if best[i] is None or len(candidate) < len(best[i]):
                    best[i] = candidate
    return best[0] if best[0] and len(best[0]) >= 2 else None

def load_already_overridden():
    if not OVERRIDES_SRC.exists():
        return set()
    src = OVERRIDES_SRC.read_text()
    return set(re.findall(r'"([^"]+/[^"]+)":\s*"', src))

def main():
    words = load_dict()
    already = load_already_overridden()
    cat = json.loads(CATALOG_PATH.read_text())

    candidates = []
    for t in cat:
        name = t.get("name", "")
        if any(c in name for c in " &-/"):
            continue
        if len(name) < 10:
            continue
        if t["id"] in already:
            continue
        parts = decompose(name, words)
        if parts:
            candidates.append((t.get("n", 0), t["id"], name, parts))

    candidates.sort(reverse=True)
    print(f"{len(candidates)} smoosh candidates (already-overridden and real words filtered)\n")
    for count, tid, name, parts in candidates:
        suggestion = " ".join(p.title() for p in parts)
        print(f"  {count:>5,}  {name:<32}  →  {suggestion:<38}  [{tid}]")

if __name__ == "__main__":
    main()
