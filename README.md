# Guardian Trends

A decade of Guardian headlines, searchable and graphed. Inspired by [Ted Alcorn's NYT dashboard](https://tedalcorn.github.io/nyt/), but scoped to tags and sections rather than individual journalists.

## How it works

1. A GitHub Action runs nightly. A Python script pulls Guardian headlines for each month via the [Guardian Open Platform API](https://open-platform.theguardian.com/), saving compact gzipped JSON shards (one per month).
2. A second Python script aggregates those shards into a `term-index.json.gz` — monthly counts for the top ~5,000 content words — plus a small `sections.json`.
3. The frontend is one vanilla HTML file with three ES-module JS files. It loads the pre-built index, draws a Canvas line chart, and uses [Pretext](https://github.com/chenglou/pretext) to type out matching headlines when you click a peak.

The browser never calls the Guardian API directly, so load feels instant and we don't burn through rate limits.

## One-time setup

1. **Get a Guardian API key** at https://open-platform.theguardian.com/access/ (free developer tier, ~1 minute).
2. Copy it into a local `.env` file in the project root:

   ```
   GUARDIAN_API_KEY=your_key_here
   ```

3. Create a Python virtualenv and install dependencies:

   ```bash
   cd "Guardian Trends"
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r build/requirements.txt
   ```

## Try it locally (small slice first)

Fetch just a couple of recent months so you can see it working without waiting an hour:

```bash
python build/fetch_guardian.py --months 2025-01,2025-02
python build/build_index.py
python -m http.server 8000
```

Open http://localhost:8000 in your browser.

## Full build

```bash
python build/fetch_guardian.py            # ~2 hours for the full decade (rate-limited)
python build/build_index.py
```

After the first full build, future nightlies only need to fetch the current month (`--skip-existing`).

## Deploying to GitHub Pages

1. Create a repo `guardian-trends` under `peter-guillam123` and push this folder to it.
2. In the repo **Settings → Secrets and variables → Actions**, add `GUARDIAN_API_KEY`.
3. In **Settings → Pages**, set source to "GitHub Actions".
4. Run the **Build Guardian Trends data** workflow once manually (Actions tab → Run workflow). The first run does the full decade fetch and takes ~2 hours.
5. After that, the nightly cron keeps data current automatically.

## Files

| Path | What it does |
| --- | --- |
| `index.html` | The whole UI shell. |
| `src/main.js` | Wires search box → chart → headline explorer. |
| `src/data.js` | Loads term index and shards from `/data/`. |
| `src/chart.js` | Canvas line chart with Pretext peak annotations. |
| `src/headlines.js` | Headline explorer with Pretext typewriter reveal. |
| `build/fetch_guardian.py` | Paginates the Guardian API and writes monthly shards. |
| `build/build_index.py` | Aggregates shards into `term-index.json.gz` + `sections.json`. |
| `.github/workflows/build.yml` | Nightly build + Pages deploy. |

## Design choices

- **No bylines.** The fetch script does not request contributor tags. Only topical tags, sections, headlines and dates are stored. This is a deliberate editorial product choice, not a technical limitation.
- **Headlines only, not body text.** Keeps the dataset to ~10–30 MB and matches what the search is really asking: "how has the Guardian framed this?"
- **Per-mille normalisation.** Trend values are shown as hits per 1,000 headlines that month, so curves are comparable across a decade of shifting publication volume.
- **Vanilla JS, no build step.** Drops straight onto GitHub Pages. Pretext is loaded from `esm.sh`.

## Post-MVP ideas

- UK regions / world map of coverage
- Tag co-occurrence graph ("what topics travel with 'inflation'?")
- Section mix sparklines per term
- Embed mode for individual charts
- Body-text search via a smaller secondary index
