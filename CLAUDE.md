# Guardian Angles — project notes

## What it is

Static-site visualisation of ~1.3M Guardian headlines across 14 years.
Five views plus an About page:

- **Trends** (`index.html` / `src/main.js`) — compare up to four words
  or tags on a line chart; click a peak to read those headlines.
- **Topics** (`subjects.html` / `src/subjects.js`) — full 3,000-tag
  index, ranked, filterable; tick four to launch onto Trends.
- **Deep dive** (`deepdive.html` / `src/deepdive.js`) — single-topic
  view: every headline in a chosen range, plus weekly heatmap, peak
  drilldown, common-words block, dispatches, click-to-filter sidebars.
- **This Week** (`thisweek.html` / `src/thisweek.js`) — auto-generated
  dashboard of the most recent complete week.
- **Newsroom** (`newsroom.html` / `src/newsroom.js`) — stacked-area
  chart of Guardian publishing volume by section across the decade.
- **About** (`about.html`) — running design diary in Chris's voice.
  Treat as canonical "what was built and why".

Hosting: GitHub Pages at **guardian-angles.com**. Custom domain
configured via Cloudflare DNS (DNS-only, grey cloud). Repo:
`peter-guillam123/guardian-angles`.

## Architecture (one screen)

- **Build pipeline** (`build/`):
  - `fetch_guardian.py` — paginates the Guardian Open Platform API,
    writes `data/shards/YYYY-MM.json.gz` (one per month, ~1MB each).
    Rate-limited to 1 req/s.
  - `batch_fetch.py` — picks up missing months for hourly backfill.
  - `build_index.py` — aggregates shards into per-granularity term
    indexes (`term-index-{monthly,weekly,daily}.json.gz`).
  - `build_tag_index.py` — same for tags. Maintains `NAME_OVERRIDES`
    for hand-curated display names (mostly redundant now CAPI names
    are wired up, but kept as a safety net).
  - `fetch_tag_names.py` — pulls authoritative webTitles from the
    Guardian `/tags` CAPI endpoint, writes `data/tag-names.json`.
    Run monthly via the `Refresh tag names from CAPI` workflow.
  - `find_smooshes.py` — dictionary-decomposition detector for
    smooshed display names (e.g. "Margaretthatcher"). Run as needed.

- **Frontend**: vanilla ES modules. No framework, no bundler, no
  server. Canvas charts. Pretext for typewriter / typeset effects on
  This Week and Trends.

- **CI** (`.github/workflows/`):
  - `build.yml` — hourly `7 * * * *` cron + on every push. Pushes
    fetched data back to main with rebase-and-retry to survive
    concurrent design commits.
  - `refresh-tag-names.yml` — monthly cron + manual dispatch.

## Conventions established (don't fight these)

- **One commit per theme.** Even small refactors get their own commit.
- **About diary in voice.** Each significant change gets a changelog
  entry on `about.html`. "Milestone" class for major arcs, plain `<li>`
  for increments. See existing entries for tonal reference.
- **Toggles unified on ink** for "viewing preference" (Words/Tags,
  Month/Week/Day, Timeline/YoY, Absolute/Proportional). **Blue**
  reserved for primary intent (Compare button, active subnav tab).
- **`minmax(0, 1fr)`** on every grid that might hold long text — stops
  long content pushing the layout sideways.
- **Empty-state prompt vs serif headline.** Chart-stage panels have
  two states: muted UI-sans tracked caps when empty, display-serif
  when populated. Implemented via `setChartTitle('prompt' | 'headline',
  text)` on Trends.
- **Focus rings via global `:focus-visible`** — don't add per-element
  outlines unless the global one is wrong on that surface.
- **Canvas a11y**: `role="img"` + descriptive `aria-label`, with a
  `<p>` fallback child.
- **`prefers-reduced-motion`** honoured globally.
- **Mobile tap targets ≥ 40px.** Text floor 12px for non-tracked-caps,
  10–11px for tracked caps only. Subnav uses `touch-action: pan-x`
  to prevent vertical wobble on horizontal scroll.

## Memory patterns to remember

These bit us in production. Don't re-invent the bug:

- **`loadShard()` caches forever.** Fine for Trends (handful of
  shards). A bomb for any "scan all months" code path. Use bounded
  concurrency + `evictShard(month)` after harvest.
- **`Promise.all(months.map(loadShard))`** is the snap-on-mobile
  smoking gun. Replace with a 4-worker queue.
- **Coalesce per-shard renders into rAF.** Calling render-everything
  on every shard arrival = dozens of repaints per frame on a fast
  link, most thrown away. See `scheduleRender()` in `deepdive.js` for
  the pattern.
- **Cancel stale RAFs in chart entrance animations.** Each `setSeries`
  cancels the previous animation's `_rafId` before scheduling a new
  one — without this, rapid Compares stack RAF chains.
- **Cache `maxVal` once** in `setSeries` rather than `flatMap`-ing on
  every draw frame.
- **The chart emits `bucket` strings not just indices.** Index-based
  hover lookups break the moment the year-range slider clips the
  view. The `_keep` array on `applyYearFilter` is the index-translation
  bridge if you must use indices.

## Single sources of truth

- **`src/skip-tags.js`** — `isUsefulTag(id)`. Used by This Week hero,
  Trends trending-tag, Deep dive co-tags. Anything that says "biggest
  meaningful tag in X" should consult this, not duplicate the rules.
- **`src/sections.js`** — `sectionLabel(id)` and `sectionColor(id)`
  for canonical section display.
- **`data/tag-names.json`** — authoritative tag display names from
  CAPI. Build pipeline reads this first, then falls back to
  `NAME_OVERRIDES`, then `slug_to_title`.

## Performance numbers worth knowing

- ~163 monthly shards × 1–5 MB parsed = several hundred MB if all
  loaded simultaneously. Mobile Chrome dies around 400 MB / tab.
- Term-index-monthly is ~5,000 keys × ~163 buckets. Tag-index is
  3,000 × 163. The daily indexes are ~30× bigger; only load when
  actually needed.
- Loading the daily tag index for "trending tag · last 24 hours"
  cost ~80 MB and was the second-biggest contributor to mobile snap.
  Now uses the weekly tag index (already loaded for rising tags).

## Things deliberately NOT in scope

- No bylines anywhere — by design, not oversight. Tags + sections
  only. (See About → "Differences from Below the Fold" → removed but
  the principle holds.)
- No body-text search — headlines only.
- No login / accounts. Static site.
- No comparisons across publications.
