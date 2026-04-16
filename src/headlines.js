// Headline explorer — DOM-based rendering for clickable links,
// text selection, accessibility and native right-click-to-open.
// Each headline links to its Guardian article via the `u` field.

import { sectionLabel, sectionColor } from './sections.js';

const MAX_HEADLINES = 80;
const GUARDIAN_BASE = 'https://www.theguardian.com/';

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

/**
 * Build an array of DOM nodes from `text`, wrapping case-insensitive
 * matches of `term` in <mark> elements with yellow highlight.
 */
function highlightText(text, term) {
  if (!term) return [document.createTextNode(text)];
  const lower = text.toLowerCase();
  const needle = term.toLowerCase();
  const nodes = [];
  let i = 0;
  while (i < text.length) {
    const idx = lower.indexOf(needle, i);
    if (idx === -1) {
      nodes.push(document.createTextNode(text.slice(i)));
      break;
    }
    if (idx > i) nodes.push(document.createTextNode(text.slice(i, idx)));
    const mark = document.createElement('mark');
    mark.textContent = text.slice(idx, idx + needle.length);
    nodes.push(mark);
    i = idx + needle.length;
  }
  return nodes;
}

export class HeadlineExplorer {
  constructor(container) {
    this.container = container;
  }

  async render(headlines, term) {
    this.container.innerHTML = '';
    const items = headlines.slice(0, MAX_HEADLINES);
    if (items.length === 0) return;

    await document.fonts.ready;
    const startTime = performance.now();

    items.forEach((h, i) => {
      const article = document.createElement('article');
      article.className = 'hl-item';
      // Staggered ink-fade reveal
      article.style.animationDelay = `${i * 40}ms`;

      // Meta line: section chip + date
      const section = h.s || 'guardian';
      const meta = document.createElement('p');
      meta.className = 'hl-meta';

      const chip = document.createElement('span');
      chip.className = 'hl-section';
      chip.style.color = sectionColor(section);
      chip.textContent = sectionLabel(section).toUpperCase();
      meta.appendChild(chip);

      const sep = document.createTextNode(' \u00b7 ');
      meta.appendChild(sep);

      const date = document.createElement('span');
      date.className = 'hl-date';
      date.textContent = formatDate(h.d).toUpperCase();
      meta.appendChild(date);

      article.appendChild(meta);

      // Headline text — link if URL available, plain div otherwise
      const headlineEl = h.u
        ? document.createElement('a')
        : document.createElement('div');

      headlineEl.className = 'hl-text';

      if (h.u) {
        headlineEl.href = GUARDIAN_BASE + h.u;
        headlineEl.target = '_blank';
        headlineEl.rel = 'noopener';
      }

      const textNodes = highlightText(h.t, term);
      textNodes.forEach(n => headlineEl.appendChild(n));

      article.appendChild(headlineEl);
      this.container.appendChild(article);
    });
  }
}
