// Style — how Guardian headlines are written, by year.
//
// Reads the headline-language index (build/build_language.py), folds
// the monthly counts into yearly rates, and renders a hero chart (the
// length of a headline) plus a grid of habit cards, each a small SVG
// line. Yearly is the honest granularity: language drifts, it doesn't
// spike, and fifteen clean points beat 174 noisy ones.
//
// All charts share a zero baseline — see the page's small print. The
// current (partial) year is drawn hollow.

import { loadLanguage } from './data.js';

const heroNowEl = document.getElementById('sp-hero-now');
const heroThenEl = document.getElementById('sp-hero-then');
const heroChartEl = document.getElementById('sp-hero-chart');
const cardsEl = document.getElementById('sp-cards');
const statBig = document.getElementById('stat-big');
const exclusiveEl = document.getElementById('sp-exclusive');
const totalInlineEl = document.getElementById('sp-total-inline');

// The habit cards, in editorial order. `fmt` renders the yearly value;
// deks are the story each line actually tells in the data — if the
// data changes out from under one, rewrite the dek, not the chart.
const CARDS = [
  {
    key: 'quote_start', title: 'The quote era', unit: '%',
    dek: 'Headlines that open with someone talking. One in ten now; one in 160 in 2012.',
  },
  {
    key: 'first_person', title: 'First person', unit: '%',
    dek: 'Headlines containing "I", "my" or "me" as a word. Twice as common as in 2012 — the age of the personal.',
  },
  {
    key: 'as_it_happened', title: '…as it happened', unit: '%',
    dek: 'The liveblog, as the archive remembers it — closed live blogs are retitled, and they have multiplied.',
  },
  {
    key: 'question', title: 'The question mark', unit: '%',
    dek: 'Are headlines becoming questions? Barely — about one in thirteen, much as ever.',
  },
  {
    key: 'colon', title: 'The colon', unit: '%',
    dek: 'Eternal. A third of all headlines, every year, forever.',
  },
  {
    key: 'short5', title: 'Five words or fewer', unit: '%',
    dek: 'The dying art of the terse headline: one in seven in 2012, one in 31 now. Most of the collapse was over by 2015.',
  },
  {
    key: 'digits', title: 'Numbers', unit: '%',
    dek: 'Headlines containing a digit. Note 2020, when the news became counting.',
  },
  {
    key: 'amid', title: 'Amid', unit: '%',
    dek: 'Journalism’s busiest preposition, six times more common than in 2012. Peak amid: March 2020.',
  },
  {
    key: 'revealed', title: 'Revealed:', unit: '%',
    dek: 'Rare — but several times less rare than it used to be.',
  },
];

init();

async function init() {
  try {
    const lang = await loadLanguage();
    const Y = toYearly(lang);

    const total = lang.totals.reduce((a, b) => a + b, 0);
    if (statBig) statBig.textContent = formatCount(total);
    if (exclusiveEl) exclusiveEl.textContent = lang.metrics.exclusive.reduce((a, b) => a + b, 0);
    if (totalInlineEl) totalInlineEl.textContent = total.toLocaleString('en-GB');

    renderHero(Y);
    renderCards(Y);
    renderNames(lang);
    renderFacts(lang);
  } catch (e) {
    console.error(e);
    if (heroChartEl) heroChartEl.textContent = 'Could not load data. Has the build run yet?';
  }
}

// ── The first-name league ──
// Year chips select a year; two lists — male and female — show its top
// first names, each bar scaled to its own list's leader. Methodology is
// in the small print — the short version is that "Boris" means everyone
// called Boris.
function renderNames(lang) {
  const wrap = document.getElementById('sp-names');
  if (!wrap || !lang.names?.m) return;
  const years = Object.keys(lang.names.m).sort();
  const chipsEl = document.getElementById('sp-names-years');
  let selected = years[years.length - 1];

  chipsEl.innerHTML = years.map(y =>
    `<button type="button" class="sp-year-chip${y === selected ? ' active' : ''}" data-year="${y}">'${y.slice(2)}</button>`
  ).join('');

  const renderList = (gender, y) => {
    const listEl = document.getElementById(`sp-names-list-${gender}`);
    const top = (lang.names[gender][y] || []).slice(0, 8);
    const max = top.length ? top[0][1] : 1;
    listEl.innerHTML = top.map(([name, count], i) => `
      <li class="sp-name-row">
        <span class="sp-name-rank">${i + 1}</span>
        <span class="sp-name">${escapeHtml(name)}</span>
        <span class="sp-name-bar"><span style="width:${(100 * count / max).toFixed(1)}%"></span></span>
        <span class="sp-name-count">${count.toLocaleString('en-GB')}</span>
      </li>`).join('');
    listEl.setAttribute('aria-label',
      `Top ${gender === 'm' ? 'male' : 'female'} first names in ${y} headlines`);
  };

  const show = (y) => {
    selected = y;
    [...chipsEl.children].forEach(b => b.classList.toggle('active', b.dataset.year === y));
    renderList('m', y);
    renderList('f', y);
  };

  chipsEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-year]');
    if (b) show(b.dataset.year);
  });
  show(selected);
}

// ── One more thing — the fact shuffle ──
function renderFacts(lang) {
  const factEl = document.getElementById('sp-fact');
  const btn = document.getElementById('sp-fact-btn');
  if (!factEl || !btn || !lang.facts?.length) return;
  // Fisher–Yates once, then cycle — every fact appears before any repeats.
  const pool = [...lang.facts];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  let i = 0;
  const show = () => { factEl.textContent = pool[i % pool.length]; i++; };
  btn.addEventListener('click', show);
  show();
}

// ── Yearly aggregation ──
function toYearly(lang) {
  const years = [...new Set(lang.months.map(m => +m.slice(0, 4)))].sort();
  const idxByYear = years.map(y =>
    lang.months.map((m, i) => [m, i]).filter(([m]) => +m.slice(0, 4) === y).map(([, i]) => i));

  const totals = idxByYear.map(ix => ix.reduce((a, i) => a + lang.totals[i], 0));
  const series = {};
  for (const key of Object.keys(lang.metrics)) {
    const vals = lang.metrics[key];
    series[key] = idxByYear.map((ix, yi) => {
      if (!totals[yi]) return 0;
      if (key.startsWith('avg_')) {
        // weighted mean of monthly means
        return ix.reduce((a, i) => a + vals[i] * lang.totals[i], 0) / totals[yi];
      }
      return 100 * ix.reduce((a, i) => a + vals[i], 0) / totals[yi];
    });
  }
  const lastMonth = lang.months[lang.months.length - 1];
  const partialFinal = years[years.length - 1] === +lastMonth.slice(0, 4) && !lastMonth.endsWith('-12');
  return { years, totals, series, partialFinal };
}

// ── Hero ──
function renderHero(Y) {
  const words = Y.series.avg_words;
  const now = words[words.length - 1];
  const first = words[0];
  heroNowEl.textContent = now.toFixed(1);
  heroThenEl.textContent = `it was ${first.toFixed(1)} in ${Y.years[0]} — the headline stopped being a label`;
  heroChartEl.innerHTML = lineSVG(Y.years, words, {
    w: 720, h: 200, partialFinal: Y.partialFinal,
    fmt: v => v.toFixed(1), big: true,
  });
}

// ── Cards ──
function renderCards(Y) {
  cardsEl.innerHTML = CARDS.map(c => {
    const vals = Y.series[c.key];
    const now = vals[vals.length - 1];
    const first = vals[0];
    return `
      <article class="sp-card">
        <h2 class="sp-card-title">${escapeHtml(c.title)}</h2>
        <p class="sp-card-now">${fmtPct(now)}<span class="sp-card-then"> · ${fmtPct(first)} in ${Y.years[0]}</span></p>
        ${lineSVG(Y.years, vals, { w: 300, h: 84, partialFinal: Y.partialFinal, fmt: fmtPct })}
        <div class="sp-card-years" aria-hidden="true">
          <span>${Y.years[0]}</span>
          <span>${Y.years[Y.years.length - 1]}${Y.partialFinal ? ' so far' : ''}</span>
        </div>
        <p class="sp-card-dek">${escapeHtml(c.dek)}</p>
      </article>`;
  }).join('');
}

function fmtPct(v) {
  return (v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2)) + '%';
}

// ── SVG line (zero baseline, hollow final dot when the year is partial) ──
// Card SVGs carry NO text: SVG text scales with the viewBox, so a 10px
// tick becomes a 23px monster when a card stretches to a narrow
// viewport's full width. Year labels live in an HTML row underneath.
// The path uses non-scaling-stroke for the same reason.
function lineSVG(years, vals, { w, h, partialFinal, fmt, big = false }) {
  const padL = big ? 34 : 6, padR = big ? 16 : 6, padT = 14, padB = big ? 22 : 8;
  const max = Math.max(...vals) * 1.12 || 1;
  const x = i => padL + (w - padL - padR) * (i / (vals.length - 1));
  const y = v => padT + (h - padT - padB) * (1 - v / max);

  const path = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const lastI = vals.length - 1;

  // The hero renders ~1:1, so in-SVG text is safe there — and it needs
  // the axis values.
  const yearLabels = big
    ? years.map((yr, i) => (i % 2 === 0 || i === lastI)
        ? `<text class="sp-tick" x="${x(i).toFixed(1)}" y="${h - 6}" text-anchor="middle">${i === 0 ? yr : `'${String(yr).slice(2)}`}</text>`
        : '').join('')
    : '';

  const grid = big
    ? [0.25, 0.5, 0.75, 1].map(f =>
        `<line class="sp-gline" x1="${padL}" y1="${y(max * f).toFixed(1)}" x2="${w - padR}" y2="${y(max * f).toFixed(1)}"/>
         <text class="sp-tick" x="${padL - 5}" y="${(y(max * f) + 3).toFixed(1)}" text-anchor="end">${fmt(max * f)}</text>`).join('')
    : '';

  const r = big ? 3.5 : 2.5;
  const endDot = partialFinal
    ? `<circle class="sp-dot-hollow" cx="${x(lastI).toFixed(1)}" cy="${y(vals[lastI]).toFixed(1)}" r="${r}"/>`
    : `<circle class="sp-dot" cx="${x(lastI).toFixed(1)}" cy="${y(vals[lastI]).toFixed(1)}" r="${r}"/>`;

  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    ${grid}
    <path class="sp-line" d="${path}" vector-effect="non-scaling-stroke"/>
    <circle class="sp-dot" cx="${x(0).toFixed(1)}" cy="${y(vals[0]).toFixed(1)}" r="${big ? 3 : 2.5}"/>
    ${endDot}
    ${yearLabels}
  </svg>`;
}

function formatCount(n) {
  return n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
