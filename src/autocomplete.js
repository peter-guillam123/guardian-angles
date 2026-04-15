// Lightweight tag autocomplete.
//
// Given an <input> element and a catalog of { id, name, n } items, this wires
// a keyboard-accessible dropdown that filters by substring match on either
// the display name OR the tag id's last segment. Selecting a row writes the
// display name into the input's .value and stores the tag id on
// input.dataset.tagId.
//
// The caller reads input.dataset.tagId at submit time — do NOT rely on
// input.value alone (that's just the pretty name).
//
// Call `attachAutocomplete(input, catalog)` once. Call `detachAutocomplete(input)`
// to remove listeners and clear the hidden state (e.g. when switching to Words
// mode).

const MAX_RESULTS = 40;

function normalise(s) {
  return s.toLowerCase();
}

function scoreMatch(item, q) {
  // Match on name or on the final slug segment of the id.
  const name = normalise(item.name);
  const slug = normalise(item.id.split('/').pop());
  const qn = normalise(q);

  // Start-of-name is best; then start-of-slug; then substring anywhere.
  if (name === qn || slug === qn) return 1000;
  if (name.startsWith(qn)) return 500;
  if (slug.startsWith(qn)) return 400;
  if (name.includes(qn)) return 200;
  if (slug.includes(qn)) return 100;
  return 0;
}

function formatCount(n) {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k';
  return String(n);
}

function buildDropdown() {
  const el = document.createElement('ul');
  el.className = 'ac-dropdown';
  el.setAttribute('role', 'listbox');
  el.hidden = true;   // must start hidden — otherwise it renders as a thin
                      // empty bordered box under its input until the user
                      // interacts with that field
  document.body.appendChild(el);
  return el;
}

const _state = new WeakMap();

export function attachAutocomplete(input, catalog) {
  if (_state.has(input)) detachAutocomplete(input);

  const dropdown = buildDropdown();
  let activeIdx = -1;
  let currentMatches = [];

  function positionDropdown() {
    const r = input.getBoundingClientRect();
    dropdown.style.left = (r.left + window.scrollX) + 'px';
    dropdown.style.top = (r.bottom + window.scrollY + 2) + 'px';
    dropdown.style.width = r.width + 'px';
  }

  function renderMatches(q) {
    currentMatches = [];
    if (q.length < 1) {
      dropdown.hidden = true;
      return;
    }
    const scored = [];
    for (const item of catalog) {
      const s = scoreMatch(item, q);
      if (s > 0) scored.push({ item, s });
    }
    scored.sort((a, b) => b.s - a.s || b.item.n - a.item.n);
    currentMatches = scored.slice(0, MAX_RESULTS).map(s => s.item);

    if (!currentMatches.length) {
      dropdown.innerHTML = `<li class="ac-empty" role="presentation">No tag matches for "${escapeHtml(q)}"</li>`;
      positionDropdown();
      dropdown.hidden = false;
      return;
    }

    dropdown.innerHTML = currentMatches.map((item, i) => `
      <li role="option" data-idx="${i}" class="ac-item${i === activeIdx ? ' active' : ''}">
        <span class="ac-name">${escapeHtml(item.name)}</span>
        <span class="ac-slug">${escapeHtml(item.id)}</span>
        <span class="ac-count">${formatCount(item.n)}</span>
      </li>
    `).join('');
    positionDropdown();
    dropdown.hidden = false;
  }

  function select(item) {
    input.value = item.name;
    input.dataset.tagId = item.id;
    dropdown.hidden = true;
    input.dispatchEvent(new CustomEvent('tagselect', { detail: item, bubbles: true }));
  }

  const onInput = () => {
    activeIdx = -1;
    // Any manual edit invalidates the previously-selected tag id
    delete input.dataset.tagId;
    renderMatches(input.value.trim());
  };
  const onFocus = () => {
    if (input.value.trim()) renderMatches(input.value.trim());
  };
  const onBlur = () => {
    // Defer so a click on the dropdown can still register
    setTimeout(() => { dropdown.hidden = true; }, 150);
  };
  const onKeydown = (e) => {
    if (dropdown.hidden || !currentMatches.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        renderMatches(input.value.trim());
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = Math.min(currentMatches.length - 1, activeIdx + 1);
      renderMatches(input.value.trim());
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = Math.max(0, activeIdx - 1);
      renderMatches(input.value.trim());
    } else if (e.key === 'Enter') {
      if (activeIdx >= 0) {
        e.preventDefault();
        select(currentMatches[activeIdx]);
      }
    } else if (e.key === 'Escape') {
      dropdown.hidden = true;
    }
  };
  const onDropdownClick = (e) => {
    const item = e.target.closest('.ac-item');
    if (!item) return;
    const idx = parseInt(item.dataset.idx, 10);
    if (currentMatches[idx]) select(currentMatches[idx]);
  };
  const onReposition = () => { if (!dropdown.hidden) positionDropdown(); };

  input.addEventListener('input', onInput);
  input.addEventListener('focus', onFocus);
  input.addEventListener('blur', onBlur);
  input.addEventListener('keydown', onKeydown);
  dropdown.addEventListener('mousedown', onDropdownClick);
  window.addEventListener('scroll', onReposition, true);
  window.addEventListener('resize', onReposition);

  _state.set(input, { dropdown, handlers: { onInput, onFocus, onBlur, onKeydown, onReposition } });
}

export function detachAutocomplete(input) {
  const st = _state.get(input);
  if (!st) return;
  const { dropdown, handlers } = st;
  input.removeEventListener('input', handlers.onInput);
  input.removeEventListener('focus', handlers.onFocus);
  input.removeEventListener('blur', handlers.onBlur);
  input.removeEventListener('keydown', handlers.onKeydown);
  window.removeEventListener('scroll', handlers.onReposition, true);
  window.removeEventListener('resize', handlers.onReposition);
  dropdown.remove();
  _state.delete(input);
  delete input.dataset.tagId;
}

// Pre-seed an input with a known tag (from URL param, say). Requires the
// catalog to already be loaded.
export function seedInput(input, tagId, catalog) {
  const item = catalog.find(t => t.id === tagId);
  if (!item) return;
  input.value = item.name;
  input.dataset.tagId = item.id;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
