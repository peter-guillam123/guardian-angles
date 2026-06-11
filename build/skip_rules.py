"""Read the frontend's skip-tag rules from src/skip-tags.js.

src/skip-tags.js is the single source of truth for "which tags are
editorially interesting as a signal" — the rules that stop tone/news
or world/europe-news winning every ranking on sheer volume. The
frontend imports it as an ES module; build scripts import THIS module,
which parses the two data literals out of the JS source at build time.

Parsing is deliberately strict: if skip-tags.js is ever reformatted in
a way these regexes can't read, we raise (and CI goes red) rather than
silently applying no rules at all.
"""

from __future__ import annotations

import re
from pathlib import Path

_JS_PATH = Path(__file__).resolve().parent.parent / "src" / "skip-tags.js"

_prefixes: tuple[str, ...] | None = None
_exact: set[str] | None = None


def _extract_strings(name: str, src: str) -> list[str]:
    m = re.search(name + r"\s*=\s*(?:new Set\()?\[(.*?)\]", src, re.S)
    if not m:
        raise RuntimeError(f"skip_rules: couldn't find {name} in {_JS_PATH}")
    return re.findall(r"'([^']+)'", m.group(1))


def _load() -> None:
    global _prefixes, _exact
    src = _JS_PATH.read_text(encoding="utf-8")
    prefixes = _extract_strings("SKIP_PREFIXES", src)
    exact = _extract_strings("SKIP_TAGS", src)
    if not prefixes or not exact:
        raise RuntimeError(
            "skip_rules: parsed empty rule lists — check src/skip-tags.js formatting"
        )
    _prefixes = tuple(prefixes)
    _exact = set(exact)


def is_mega_tag(tag_id: str) -> bool:
    """Mirrors isMegaTag in src/skip-tags.js — the 'section/section' pattern."""
    parts = tag_id.split("/")
    return len(parts) == 2 and parts[0] == parts[1]


def is_useful_tag(tag_id: str) -> bool:
    """Mirrors isUsefulTag in src/skip-tags.js."""
    if _prefixes is None:
        _load()
    return (
        not tag_id.startswith(_prefixes)
        and not is_mega_tag(tag_id)
        and tag_id not in _exact
    )
