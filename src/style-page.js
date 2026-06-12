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
import { MARKERS, MARKER_BY_KEY } from './markers.js';
import { sectionLabel } from './sections.js';
import { toneLabel } from './tones.js';

const heroNowEl = document.getElementById('sp-hero-now');
const heroThenEl = document.getElementById('sp-hero-then');
const heroChartEl = document.getElementById('sp-hero-chart');
const cardsEl = document.getElementById('sp-cards');
const statBig = document.getElementById('stat-big');
const exclusiveEl = document.getElementById('sp-exclusive');
const totalInlineEl = document.getElementById('sp-total-inline');

// The habit cards, in editorial order. Deks are FUNCTIONS: the
// editorial framing is written once, but every number in it is
// computed from the live data at render time — observations can't
// quietly go out of date as new months arrive. ctx gives them the
// first/now values, the years, and a peak-month lookup.
const oneIn = v => Math.max(1, Math.round(100 / v)).toLocaleString('en-GB');
const times = (now, first) => {
  const r = now / first;
  return r >= 9.5 ? `${Math.round(r)} times` : r >= 1.95 && r < 2.5 ? 'twice' : `${r.toFixed(1)} times`;
};

// A hand-written caption for every marker, so whatever the deal serves
// up reads like a chosen hero rather than a dictionary entry. An entry
// may be a plain string, a function (given the live first/now values),
// or { title, dek } to also override the catalogue title. Functions keep
// any cited multiple honest as the data grows — never hardcode "tenfold".
const CARD_DEK = {
  // Quotation & voice
  quote_start: { title: 'The quote era',
    dek: c => `Headlines that open with someone talking. One in ${oneIn(c.now)} now; one in ${oneIn(c.first)} in ${c.y0}.` },
  quotes_anywhere: c => `Quotation somewhere in the headline — ${times(c.now, c.first)} more common than in ${c.y0}. The headline used to describe the news; now it lets you hear it.`,
  first_person: c => `“I”, “my”, “me” — ${times(c.now, c.first)} as common as in ${c.y0}. The age of the personal.`,
  second_person: 'The headline talking straight to you — “you”, “your” — the way service journalism learned to.',
  says_word: c => `Plain old “says”, doing ${times(c.now, c.first)} the work it did in ${c.y0}. The verb that gets out of the quote’s way.`,
  warns: 'Attribution with the hazard lights on. Someone, somewhere, is always warning.',
  insists: 'Attribution standing its ground — the subject digging in, in a single verb.',
  admits: 'Attribution with a wince. The little concession a headline can’t resist.',
  according_to: 'The careful sourcing formula, spelled out in full. Caution you can count.',

  // Punctuation
  question: c => `Are headlines becoming questions? Barely — about one in ${oneIn(c.now)}, much as ever.`,
  colon: c => `Eternal. About ${Math.round(c.now)}% of all headlines, every year, forever.`,
  exclamation: c => `The Guardian’s least Guardian punctuation mark — and ${times(c.now, c.first)} more common than in ${c.y0}.`,
  ellipsis: 'The trailing dot-dot-dot, forever promising a little more just around the corner…',
  dash: 'The spaced dash — the hinge a Guardian headline swings on. Two clauses, one breath.',
  semicolon: 'The boldest punctuation a sub will risk in a headline; rare, and quietly proud of it.',
  brackets: 'The aside in mid-headline (where the second thought lives).',
  pipe: 'The “ | ” that signs off a comment piece — less punctuation than a desk stamp.',

  // Shape
  short5: c => `One in ${oneIn(c.first)} in ${c.y0}; one in ${oneIn(c.now)} now. Less a dying art than a change of job — a headline that travels alone in a feed has to say what the story is.`,
  words20: c => `The headline that is fully a sentence, sometimes two — up ${times(c.now, c.first)} since ${c.y0}, as headlines learned to stand on their own.`,
  single_word: 'One word, carrying the whole story. The headline as a single deep breath.',
  digits: { title: 'Numbers',
    dek: c => `Headlines with a digit in them. Note the bump in ${c.peakYear('digits')}, when the news became counting.` },
  digit_start: '“10 things…”, “7 ways…” — the listicle, announcing itself from the very first character.',
  money: 'Money makes the world go round, and a fair few business and politics headlines besides — £, $ and € in the furniture.',
  percent: 'The per cent sign: economics, opinion polls and pay disputes, all in a single character.',
  age_comma: 'The “, 34,” — a person, neatly aged and bracketed, the way the news has always made introductions.',
  versus: 'The bare “v” of a contest — sport’s grammar, borrowed by politics, the courts and everything between.',

  // Journalese
  amid: c => `Journalism’s busiest preposition, ${times(c.now, c.first)} more common than in ${c.y0}. Peak amid: ${c.peakMonth('amid')}.`,
  set_to: 'The future tense of news — “set to” happen, when we’re fairly sure but not quite ready to promise.',
  row_word: 'The great British disagreement, compressed to three letters. A headline’s favourite spat.',
  sparks: 'Where a row begins. Something is always sparking something.',
  fears: 'Rarely singular, often found amid. The headline’s quiet background hum of worry.',
  boost: 'Political reporting’s sunshine — the good-news verb, claimed by all sides.',
  blow: 'Political reporting’s bad weather. For every boost, a blow.',
  hedge: 'Could, may, might — the speculation index, where the headline keeps its options open.',
  crisis: c => `The word itself, in the headline — ${times(c.now, c.first)} more common than in ${c.y0}. Always, it seems, a crisis somewhere.`,
  chaos: 'Crisis’s louder sibling, for when a mere crisis simply won’t do.',
  urges: 'Someone urging someone else to act. The headline’s standing call to action.',
  u_turn: 'The manoeuvre, hyphenated — politics’s most-photographed reverse.',
  so_called: 'Distance, in a hyphen. The guide finds the air-quotes heavy-handed; the headlines keep reaching for them.',
  gate: 'Every scandal gets the suffix in the end — Southgate and Margate excepted, on appeal.',
  woke: 'A word that has done a remarkable number of jobs in a very short decade.',
  viral: 'Mostly a metaphor; briefly, in 2020, alarmingly literal.',
  slam: 'The verb the guide would rather we didn’t. Headlines do love a good slam.',
  unveil: 'Best saved for statues; increasingly spent on policies, phones and price lists.',
  hike: 'A rise with a metaphor attached — though “petrol hike” does rather suggest a long walk to the garage.',
  pledge: 'A promise, in headline dialect. Used all the time by journalists, the guide notes, and rarely by anyone else.',
  spiral: 'Costs do it, situations do it — always, somehow, downwards.',
  fuels: 'As in “fuels fears” — the headline’s verb for pouring petrol on a worry.',
  downplay: 'To wave a thing away in a single word. The newsroom’s favourite under-reaction.',
  ramp_up: c => `“Increase”, in a hurry — up ${times(c.now, c.first)} since ${c.y0}. The guide hasn’t caught it; the headlines have.`,
  right_now: 'Adds nothing and should normally be deleted, says the guide. It is, right now, climbing regardless.',
  perfect_storm: '“A perfect cliché, best avoided,” says the guide — rather pleased with the line.',
  fit_for_purpose: 'A phrase that, per the guide, “quickly proved itself unfit for the purpose of good writing”.',
  elephant_in_room: 'The metaphor everyone agreed to retire, and didn’t. Mercifully rare in a headline.',

  // Words & registers
  why_start: 'The headline that opens with a question it fully intends to answer. “Why…”, then the explainer.',
  how_to: 'The service promise, front and centre. Six minutes to a better roast.',
  best: 'The lifestyle superlative — the best fifty of anything you care to name.',
  worst: 'Its shadow. Rarer than “best”, and somehow more fun.',
  swears: 'A headline with a swear word in it — which, since the Guardian prints them in full, means business.',
  iconic: c => `The word the guide pleads for restraint on, “even if our own writers rarely follow” the advice — up ${times(c.now, c.first)} since ${c.y0}.`,
  massive: '“Massively overused,” says the guide — and, massively, still climbing.',
  major: '“A major case of overuse,” per the guide, which gently offers big, main and leading instead.',
  very: 'The intensifier the old advice says to swap for “damn”, so your editor deletes it. Still very much here.',
  controversial: 'A word that, the guide notes, “can normally be safely removed to let readers make up their own minds”.',
  famous: 'If you have to say it’s famous, the guide observes, it probably isn’t.',
  basically: '“This word is unnecessary, basically” — the guide’s entry, quoted in full.',
  ongoing: 'Bureaucracy’s favourite adjective, of which “even some journalists are oddly fond”, the guide sighs.',
  upcoming: 'A word whose style-guide entry works itself up to mentioning corporal punishment. We’ll leave it there.',
  multiple: 'The guide prefers the plain plural — “gunshots were heard”, not “multiple gunshots”. Creeping up anyway.',

  // Formats & furniture
  as_it_happened: c => `The liveblog, as the archive remembers it — closed live blogs are retitled, and they have multiplied ${times(c.now, c.first)} over.`,
  revealed: c => `Rare — but ${times(c.now, c.first)} less rare than it used to be.`,
  exclusive: 'The word the Guardian famously won’t use — and, true to form, almost never does.',
  guardian_view: 'The leader column’s standing introduction — the paper, speaking as itself.',
  letters: 'The readers’ turn. Headlines opening or closing the letters page.',
  in_pictures: 'The gallery suffix, once everywhere, now effectively extinct. The slideshow’s headstone.',
  video_suffix: '“– video”: the format tag that ruled the mid-2010s, then vanished without trace.',
  podcast: 'The word that arrived mid-decade and never left. Usually furniture, occasionally the story.',
  review_word: 'Stars out of five, mostly; the inquiry kind, occasionally. The word that judges.',
  obituary: 'The label on a life. Almost always exactly what it says.',
  recipe: '“Recipe”, “recipes” — the Feast era, made countable. The Guardian’s appetite, charted.',
  quiz: 'A promise of one, usually. Ten questions and a smug share score.',
  qanda: 'The Q&A label — a format that has quietly faded from the furniture.',
  factcheck: 'The verb of the misinformation age, arriving in headlines right on cue.',
  cartoon: 'The labelled cartoon, once a daily fixture in the headline, now nearly gone from it.',
};

const CARD_COUNT = 9;
let _cardKeys = null;   // the nine dealt this visit, frozen across scope changes

function dealCards() {
  // Every displayable marker is fair game — each has a written caption.
  const pool = MARKERS.map(m => m.key).filter(k => _lang.metrics[k]);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  _cardKeys = pool.slice(0, CARD_COUNT);
}

let _lang = null;
let _scope = '';   // '' = all · section id · 'tone/<id>'

init();

async function init() {
  try {
    const lang = await loadLanguage();
    _lang = lang;

    const total = lang.totals.reduce((a, b) => a + b, 0);
    if (statBig) statBig.textContent = formatCount(total);
    if (exclusiveEl) exclusiveEl.textContent = lang.metrics.exclusive.reduce((a, b) => a + b, 0);
    if (totalInlineEl) totalInlineEl.textContent = total.toLocaleString('en-GB');

    buildScopeControl(lang);
    initLedgerToggle();

    // Shuffle re-deals the nine cards at the current scope.
    document.getElementById('sp-cards-shuffle')?.addEventListener('click', () => {
      dealCards();
      renderCards(toYearly(sliceFor(_lang, _scope)), scopeLabelFor(_scope));
    });

    const wanted = new URLSearchParams(location.search).get('in') || '';
    applyScope(scopeExists(lang, wanted) ? wanted : '');

    // All-headlines by design, whatever the scope — see the small print.
    renderNames(lang);
    renderFacts(lang);
  } catch (e) {
    console.error(e);
    if (heroChartEl) heroChartEl.textContent = 'Could not load data. Has the build run yet?';
  }
}

// ── Scopes ──
function scopeExists(lang, scope) {
  if (!scope) return true;
  if (scope.startsWith('tone/')) return !!lang.scopes?.tones?.[scope.slice(5)];
  return !!lang.scopes?.sections?.[scope];
}

function scopeLabelFor(scope) {
  if (!scope) return '';
  return scope.startsWith('tone/') ? toneLabel(scope) : sectionLabel(scope);
}

function sliceFor(lang, scope) {
  if (!scope) return lang;
  const s = scope.startsWith('tone/')
    ? lang.scopes.tones[scope.slice(5)]
    : lang.scopes.sections[scope];
  return {
    months: lang.months,
    totals: s.totals,
    metrics: { ...s.metrics, avg_words: s.avg_words },
  };
}

function buildScopeControl(lang) {
  const sel = document.getElementById('sp-scope-select');
  if (!sel || !lang.scopes) return;
  const group = (label, entries, prefix) => {
    const og = document.createElement('optgroup');
    og.label = label;
    for (const [id, name] of entries) {
      const o = document.createElement('option');
      o.value = prefix + id;
      o.textContent = name;
      og.appendChild(o);
    }
    sel.appendChild(og);
  };
  const secs = Object.keys(lang.scopes.sections)
    .map(id => [id, sectionLabel(id)]).sort((a, b) => a[1].localeCompare(b[1]));
  const tones = Object.keys(lang.scopes.tones)
    .map(id => [id, toneLabel('tone/' + id)]).sort((a, b) => a[1].localeCompare(b[1]));
  group('Sections', secs, '');
  group('Tones', tones, 'tone/');
  sel.addEventListener('change', () => applyScope(sel.value));
}

function applyScope(scope) {
  _scope = scope;
  const sel = document.getElementById('sp-scope-select');
  if (sel) {
    if (sel.value !== scope) sel.value = scope;
    sel.classList.toggle('active', !!scope);   // blue = filtered, as on Trends
  }
  const Y = toYearly(sliceFor(_lang, scope));
  const label = scopeLabelFor(scope);
  renderHero(Y, label);
  renderCards(Y, label);
  renderLedger(Y);
  // URL reflects reality: whatever ledger panel is open right now (the
  // deep-linked one on first render; none after a scope change).
  const openKey = document.querySelector('.sp-led-panel:not([hidden])')?.parentElement?.dataset.key || null;
  syncStyleURL(openKey);
}

// One URL writer for the page's two params, so neither clobbers the other.
function syncStyleURL(marker) {
  const p = new URLSearchParams();
  if (_scope) p.set('in', _scope);
  if (marker) p.set('marker', marker);
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

// ── The full ledger ──
// The five biggest movers show by default; search sees everything; the
// button reveals the rest. A ?marker= deep link or an open row always
// stays visible regardless.
const LEDGER_TEASER = 5;
let _ledgerExpanded = false;

function applyLedgerVisibility() {
  const listEl = document.getElementById('sp-ledger-list');
  const filterEl = document.getElementById('sp-ledger-filter');
  const q = (filterEl?.value || '').trim().toLowerCase();
  listEl.querySelectorAll('.sp-led').forEach((li, i) => {
    const matches = !q || li.dataset.text.includes(q);
    const open = !!li.querySelector('.sp-led-panel:not([hidden])');
    li.hidden = !(matches && (q || _ledgerExpanded || open || i < LEDGER_TEASER));
  });
  const btn = document.getElementById('sp-ledger-toggle');
  if (btn) {
    btn.hidden = !!q;   // searching shows everything that matches anyway
    const total = listEl.querySelectorAll('.sp-led').length;
    btn.textContent = _ledgerExpanded ? 'Show the top five ↑' : `Show all ${total} ↓`;
    btn.setAttribute('aria-expanded', String(_ledgerExpanded));
  }
}

function initLedgerToggle() {
  const btn = document.getElementById('sp-ledger-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    _ledgerExpanded = !_ledgerExpanded;
    applyLedgerVisibility();
  });
}

// Every catalogued marker as a compact expandable row, biggest movers
// first. Click a row for its full chart; ?marker=key deep-links one.
function renderLedger(Y) {
  const listEl = document.getElementById('sp-ledger-list');
  const filterEl = document.getElementById('sp-ledger-filter');
  if (!listEl) return;

  const rows = MARKERS
    .filter(m => Y.series[m.key])
    .map(m => {
      const vals = Y.series[m.key];
      const first = vals[0];
      const now = vals[vals.length - 1];
      // log-ratio movement, with a floor so dead-vs-dead doesn't explode
      const move = Math.abs(Math.log((now + 0.01) / (first + 0.01)));
      return { m, vals, first, now, move };
    })
    .sort((a, b) => b.move - a.move);

  listEl.innerHTML = rows.map(({ m, first, now }) => `
    <li class="sp-led" data-key="${m.key}" data-text="${escapeHtml((m.title + ' ' + m.def + ' ' + m.group).toLowerCase())}">
      <button type="button" class="sp-led-row" aria-expanded="false">
        <span class="sp-led-title">${escapeHtml(m.title)}</span>
        <span class="sp-led-group">${escapeHtml(m.group)}</span>
        <span class="sp-led-nums">${fmtPct(first)} <span class="sp-led-arrow">→</span> ${fmtPct(now)}</span>
      </button>
      <div class="sp-led-panel" hidden></div>
    </li>`).join('');

  const expand = (li, scroll = false) => {
    const btn = li.querySelector('.sp-led-row');
    const panel = li.querySelector('.sp-led-panel');
    const open = panel.hidden;
    // Close any other open row — one chart at a time keeps the list calm.
    listEl.querySelectorAll('.sp-led-panel:not([hidden])').forEach(p => {
      p.hidden = true;
      p.parentElement.querySelector('.sp-led-row').setAttribute('aria-expanded', 'false');
    });
    if (!open) { syncStyleURL(null); applyLedgerVisibility(); return; }
    const { m, vals } = rows.find(r => r.m.key === li.dataset.key);
    // Word-type markers link to a word-mode deep dive — the actual
    // headlines behind the line. Punctuation and format markers can't
    // be searched, so they don't pretend to be links.
    const diveLink = m.q
      ? ` <a class="dd-link" href="./deepdive.html?q=${encodeURIComponent(m.q)}">browse these headlines →</a>`
      : '';
    panel.innerHTML = `
      ${lineSVG(Y.years, vals, { w: 600, h: 110, partialFinal: Y.partialFinal, fmt: fmtPct })}
      <div class="sp-card-years" aria-hidden="true">
        <span>${Y.years[0]}</span>
        <span>${Y.years[Y.years.length - 1]}${Y.partialFinal ? ' so far' : ''}</span>
      </div>
      <p class="sp-card-dek">${escapeHtml(m.def)}${diveLink}</p>`;
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    syncStyleURL(m.key);
    applyLedgerVisibility();
    if (scroll) li.scrollIntoView({ block: 'center' });
  };

  // Assignment, not addEventListener — renderLedger re-runs on every
  // scope change and must not stack handlers.
  listEl.onclick = (e) => {
    const li = e.target.closest('.sp-led');
    if (li) expand(li);
  };

  filterEl.oninput = applyLedgerVisibility;

  // Deep-linked marker: honoured on first render only — later renders
  // are scope changes, which deliberately start the list closed.
  if (!renderLedger._initDone) {
    renderLedger._initDone = true;
    const wanted = new URLSearchParams(location.search).get('marker');
    if (wanted) {
      const li = listEl.querySelector(`.sp-led[data-key="${CSS.escape(wanted)}"]`);
      if (li) expand(li, true);
    }
  }
  applyLedgerVisibility();
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
    listEl.innerHTML = top.map(([name, count, surname, tagId], i) => {
      // Two independent links per row. The forename always dives on the
      // word — every headline containing it, which is what the row
      // counts. The surname, when one dominates, dives on the person:
      // their tag if "Forename Surname" matched one, otherwise the full
      // name as a phrase ("emma raducanu" appearing in a headline).
      const fore = `<a class="sp-name-fore" href="./deepdive.html?q=${encodeURIComponent(name)}"`
        + ` title="Headlines with the word “${escapeAttr(name)}”"`
        + ` aria-label="Headlines containing ${escapeAttr(name)}">${escapeHtml(name)}</a>`;
      let sur = '';
      if (surname) {
        const surHref = tagId
          ? `./deepdive.html?tag=${encodeURIComponent(tagId)}`
          : `./deepdive.html?q=${encodeURIComponent(name + ' ' + surname)}`;
        const surTitle = tagId
          ? `Deep dive: ${escapeAttr(name)} ${escapeAttr(surname)}`
          : `Headlines naming “${escapeAttr(name)} ${escapeAttr(surname)}”`;
        sur = ` <a class="sp-name-sur" href="${surHref}" title="${surTitle}"`
          + ` aria-label="${surTitle}">${escapeHtml(surname)}</a>`;
      }
      return `
      <li class="sp-name-row">
        <span class="sp-name-rank">${i + 1}</span>
        <span class="sp-name">${fore}${sur}</span>
        <span class="sp-name-bar"><span style="width:${(100 * count / max).toFixed(1)}%"></span></span>
        <span class="sp-name-count">${count.toLocaleString('en-GB')}</span>
      </li>`;
    }).join('');
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
function renderHero(Y, scopeLabel = '') {
  const words = Y.series.avg_words;
  const now = words[words.length - 1];
  const first = words[0];
  const eyebrow = document.querySelector('#sp-hero .dd-eyebrow');
  const unit = document.querySelector('.sp-hero-unit');
  if (eyebrow) eyebrow.textContent = scopeLabel ? 'Headline length' : 'The headline became a sentence';
  if (unit) unit.textContent = scopeLabel
    ? `words in an average ${scopeLabel} headline now`
    : 'words in an average headline now';
  heroNowEl.textContent = now.toFixed(1);
  heroThenEl.textContent = `it was ${first.toFixed(1)} in ${Y.years[0]}` +
    (scopeLabel ? '' : ' — the headline stopped being a label');
  heroChartEl.innerHTML = lineSVG(Y.years, words, {
    w: 720, h: 200, partialFinal: Y.partialFinal,
    fmt: v => v.toFixed(1), big: true,
  });
}

// ── Cards ──
// The deks are written about all headlines; under a scope their claims
// could lie, so they step aside for a plain statement of what's counted.
function dekContext(Y) {
  const y0 = Y.years[0];
  const solid = _lang.totals.map((n, i) => n >= 1000 ? i : -1).filter(i => i >= 0);
  const rate = (key, i) => _lang.metrics[key][i] / _lang.totals[i];
  return {
    y0,
    peakMonth(key) {
      const i = solid.reduce((a, b) => rate(key, a) >= rate(key, b) ? a : b);
      const [y, m] = _lang.months[i].split('-');
      return ['January', 'February', 'March', 'April', 'May', 'June', 'July',
        'August', 'September', 'October', 'November', 'December'][m - 1] + ' ' + y;
    },
    peakYear(key) {
      const vals = Y.series[key];
      return Y.years[vals.indexOf(Math.max(...vals))];
    },
  };
}

function renderCards(Y, scopeLabel = '') {
  if (!_cardKeys) dealCards();
  const ctx = scopeLabel ? null : dekContext(Y);
  cardsEl.innerHTML = _cardKeys.map(key => {
    const marker = MARKER_BY_KEY.get(key);
    const vals = Y.series[key];
    if (!marker || !vals) return '';
    const now = vals[vals.length - 1];
    const first = vals[0];
    // A CARD_DEK entry may be a string, a function, or { title, dek }.
    const raw = CARD_DEK[key];
    const entry = (typeof raw === 'string' || typeof raw === 'function') ? { dek: raw } : (raw || {});
    const title = entry.title || marker.title;
    // Scoped views drop the caption — the lines are written about all
    // headlines, and the scope control already says what's counted.
    let dek = '';
    if (!scopeLabel) {
      const d = entry.dek;
      const text = typeof d === 'function' ? d({ ...ctx, now, first }) : (d || marker.def);
      dek = `<p class="sp-card-dek">${escapeHtml(text)}</p>`;
    }
    return `
      <article class="sp-card">
        <h2 class="sp-card-title">${escapeHtml(title)}</h2>
        <p class="sp-card-now">${fmtPct(now)}<span class="sp-card-then"> · ${fmtPct(first)} in ${Y.years[0]}</span></p>
        ${lineSVG(Y.years, vals, { w: 300, h: 84, partialFinal: Y.partialFinal, fmt: fmtPct })}
        <div class="sp-card-years" aria-hidden="true">
          <span>${Y.years[0]}</span>
          <span>${Y.years[Y.years.length - 1]}${Y.partialFinal ? ' so far' : ''}</span>
        </div>
        ${dek}
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

function escapeAttr(s) { return escapeHtml(s); }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
