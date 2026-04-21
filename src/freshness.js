// Freshness indicator: reads data/meta.json and shows when the dataset was
// last rebuilt. Injected into any element with id="freshness" on page load.
// Reloads silently — no user-facing errors if the fetch fails.

(async function () {
  const el = document.getElementById('freshness');
  if (!el) return;
  try {
    const res = await fetch('./data/meta.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const meta = await res.json();
    if (!meta.built_at) return;
    const built = new Date(meta.built_at);
    const now = new Date();
    const minsAgo = Math.floor((now - built) / 60000);

    let label;
    if (minsAgo < 2) label = 'just now';
    else if (minsAgo < 60) label = `${minsAgo}m ago`;
    else if (minsAgo < 60 * 24) {
      const h = Math.floor(minsAgo / 60);
      label = `${h}hr ago`;
    } else {
      const d = Math.floor(minsAgo / (60 * 24));
      label = d === 1 ? 'yesterday' : `${d}d ago`;
    }

    const exact = built.toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    el.innerHTML =
      `<span class="freshness-dot" aria-hidden="true"></span>` +
      `updated <time datetime="${meta.built_at}" title="${exact}">${label}</time>`;

    // On pages that don't run main.js / newsroom.js / thisweek.js
    // (About, Subjects), also populate the big headline count from
    // meta so it doesn't go stale. Safe no-op if the element's
    // absent or a page-specific script already set it.
    const big = document.getElementById('stat-big');
    if (big && meta.total_headlines && /^[—\-]$|^\s*$/.test(big.textContent)) {
      const n = meta.total_headlines;
      big.textContent = n >= 1_000_000
        ? (n / 1_000_000).toFixed(2) + 'M'
        : Math.round(n / 1000) + 'k';
    }
  } catch (e) {
    // Silent — just leave the element empty
  }
})();
