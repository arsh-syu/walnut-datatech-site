// Question engine: decides which questions apply, draws their fields and checks the answers.
// The questions themselves are data (src/data/questions.mjs) — this file knows nothing about any one of them.
//
// `ctx` is everything a condition may look at: { ...answers, services: [...] }.

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const list = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);

const tests = {
  equals: (actual, value) => !Array.isArray(actual) && String(actual ?? '') === String(value),
  notEquals: (actual, value) => !tests.equals(actual, value),
  contains: (actual, value) => (Array.isArray(actual) ? actual.includes(value) : String(actual ?? '').includes(String(value))),
  notContains: (actual, value) => !tests.contains(actual, value),
  answered: (actual) => list(actual).length > 0,
};
const holds = (c, ctx) => Boolean(tests[c.op]?.(ctx[c.field], c.value));
const matches = (rule, ctx) => (rule.all ?? []).every((c) => holds(c, ctx)) && (!rule.any?.length || rule.any.some((c) => holds(c, ctx)));

export const isShown = (q, ctx) => (!q.showIf || matches(q.showIf, ctx)) && !(q.hideIf && matches(q.hideIf, ctx));

// An answer as stored: a trimmed string, or for `multi` the chosen options in their listed order.
// Saved answers come back from the browser, so anything that is not a possible answer is dropped.
export function clean(q, raw) {
  if (q.type === 'multi') return (q.options ?? []).filter((o) => list(raw).includes(o));
  const value = typeof raw === 'string' ? raw.trim().slice(0, q.maxLength ?? (q.type === 'textarea' ? 2000 : 300)) : '';
  if (q.options) return q.options.includes(value) ? value : '';
  return value;
}

const lower = (label) => label.charAt(0).toLowerCase() + label.slice(1);

// '' when the answer is acceptable, otherwise a sentence to show beside the field.
export function problemWith(q, value) {
  const empty = list(value).length === 0;
  if (empty) {
    if (!q.required) return '';
    return q.error || (q.options ? 'Please choose an option.' : `Please enter the ${lower(q.label)}.`);
  }
  if (q.type === 'email' && !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value)) return 'Please enter a valid email address.';
  if (q.type === 'tel') {
    const digits = value.replace(/\D+/g, '').length;
    if (!/^[0-9+ ()\-]+$/.test(value) || digits < 7 || digits > 15) return 'Please enter a valid phone number.';
  }
  if (q.type === 'url') {
    try {
      const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
      if (!url.hostname.includes('.') || /\s/.test(value)) throw new Error();
    } catch {
      return 'Please enter a valid web address.';
    }
  }
  if (q.type === 'number') {
    const n = Number(value);
    if (!/^\d+$/.test(value) || (q.min != null && n < q.min) || (q.max != null && n > q.max)) return q.invalid || `Please enter a valid ${lower(q.label)}.`;
  }
  return '';
}

// How an answer reads in a summary.
export const display = (value) => list(value).join(', ');

// The running count beside a question that takes several answers.
const countText = (n) => (n ? `${n} selected` : '');

const optional = (q) => (q.required ? '' : ' <span class="optional">optional</span>');

// One question as a form field. `prefix` keeps ids unique on the page.
export function fieldHtml(q, value, prefix = 'q') {
  const id = `${prefix}-${q.id}`;
  const cls = `field${q.wide || q.type === 'textarea' ? ' field-wide' : ''}`;
  const help = q.help ? `<p class="field-help" id="${id}-help">${esc(q.help)}</p>` : '';
  const common = `id="${id}" name="${q.id}" data-q="${q.id}"${q.required ? ' required' : ''}${q.help ? ` aria-describedby="${id}-help"` : ''}`;

  if (q.type === 'choice' || q.type === 'multi') {
    const picked = list(value);
    const input = q.type === 'multi' ? 'checkbox' : 'radio';
    return `<fieldset class="${cls} field-set">
      <legend>${esc(q.label)}${optional(q)}${q.type === 'multi' ? ` <span class="pick-count" data-pick-count>${countText(picked.length)}</span>` : ''}</legend>
      <div class="pills${q.boxes ? ' pills-boxes' : ''}">${q.options
        .map((o, i) => `<label class="pill"><input class="sr-only" type="${input}" name="${q.id}" data-q="${q.id}" value="${esc(o)}"${i === 0 ? ` id="${id}"` : ''}${picked.includes(o) ? ' checked' : ''}><span>${esc(o)}</span></label>`)
        .join('')}</div>${help}
    </fieldset>`;
  }

  let control;
  if (q.type === 'combo') {
    // A long list, searched by typing rather than scrolled. bindFields() below brings it to life.
    control = `<div class="combo" data-combo>
      <input ${common} type="text" value="${esc(value ?? '')}" maxlength="${q.maxLength ?? 300}" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-list" autocomplete="off" autocapitalize="words" spellcheck="false"${q.placeholder ? ` placeholder="${esc(q.placeholder)}"` : ''}>
      <ul class="combo-list" id="${id}-list" role="listbox" aria-label="${esc(q.label)}" hidden></ul>
    </div>`;
  } else if (q.type === 'select') {
    control = `<select ${common}><option value="">Choose…</option>${q.options.map((o) => `<option${o === value ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  } else if (q.type === 'textarea') {
    control = `<textarea ${common} rows="3" maxlength="${q.maxLength ?? 2000}"${q.placeholder ? ` placeholder="${esc(q.placeholder)}"` : ''}>${esc(value ?? '')}</textarea>`;
  } else {
    const type = q.type === 'number' ? 'text' : q.type === 'url' ? 'text' : q.type;
    const mode = { number: 'numeric', tel: 'tel', email: 'email', url: 'url' }[q.type];
    control = `<input ${common} type="${type}"${mode ? ` inputmode="${mode}"` : ''} value="${esc(value ?? '')}" maxlength="${q.maxLength ?? 300}"${q.autocomplete ? ` autocomplete="${q.autocomplete}"` : ''}${q.placeholder ? ` placeholder="${esc(q.placeholder)}"` : ''}>`;
  }
  return `<div class="${cls}"><label for="${id}">${esc(q.label)}${optional(q)}</label>${control}${help}</div>`;
}

// Reads the current answer to `q` out of the form it was drawn in.
export function readAnswer(container, q) {
  const inputs = [...container.querySelectorAll(`[data-q="${q.id}"]`)];
  if (q.type === 'multi') return clean(q, inputs.filter((i) => i.checked).map((i) => i.value));
  if (q.type === 'choice') return clean(q, inputs.find((i) => i.checked)?.value ?? '');
  return clean(q, inputs[0]?.value ?? '');
}

/* ---------- behaviour the fields need once they are on the page ---------- */

// Letters only, lower case, accents removed: "Côte d’Ivoire" is found by typing "cote d'iv".
const plain = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, "'").toLowerCase().trim();

// The options of a searchable list that match what has been typed: names that start with it first,
// then names with a word that starts with it, then names that merely contain it.
export function search(options, typed, limit = 8) {
  const t = plain(typed);
  if (!t) return [];
  const rank = (o) => {
    const name = plain(o);
    return name.startsWith(t) ? 0 : name.split(/[\s-]+/).some((w) => w.startsWith(t)) ? 1 : name.includes(t) ? 2 : 3;
  };
  return options.map((o) => [rank(o), o]).filter(([r]) => r < 3).sort((a, b) => a[0] - b[0]).slice(0, limit).map(([, o]) => o);
}

/**
 * Call once on the element the fields are drawn in (it may redraw them as often as it likes).
 * Keeps the "2 selected" counts current and runs every searchable list: suggestions after a few
 * letters, arrow keys / Enter / Escape, and a list that opens upwards when there is no room below.
 * `find` returns the question for an id.
 */
export function bindFields(root, find) {
  root.addEventListener('change', (e) => {
    const set = e.target.type === 'checkbox' && e.target.closest('.field-set');
    const count = set?.querySelector('[data-pick-count]');
    if (count) count.textContent = countText(set.querySelectorAll('input:checked').length);
  });

  const parts = (input) => ({ box: input.closest('[data-combo]'), listbox: input.closest('[data-combo]')?.querySelector('[role="listbox"]') });
  const combo = (target) => (target instanceof HTMLInputElement && target.closest('[data-combo]') ? target : null);

  const close = (input) => {
    const { listbox } = parts(input);
    listbox.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  };

  const setActive = (input, item) => {
    const { listbox } = parts(input);
    listbox.querySelectorAll('[aria-selected="true"]').forEach((o) => o.setAttribute('aria-selected', 'false'));
    if (!item) return input.removeAttribute('aria-activedescendant');
    item.setAttribute('aria-selected', 'true');
    input.setAttribute('aria-activedescendant', item.id);
    item.scrollIntoView({ block: 'nearest' });
  };

  // Opens the list under the field, or above it when the space below would cut it off.
  const place = (input) => {
    const { box, listbox } = parts(input);
    const rect = input.getBoundingClientRect();
    const below = innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const up = below < Math.min(listbox.scrollHeight, 200) && above > below;
    box.classList.toggle('is-up', up);
    listbox.style.maxHeight = `${Math.max(120, Math.min(280, up ? above : below))}px`;
  };

  const open = (input) => {
    const q = find(input.dataset.q);
    const { listbox } = parts(input);
    const typed = input.value.trim();
    const from = q.searchFrom ?? 3;
    const note = (text) => `<li class="combo-note" role="presentation">${esc(text)}</li>`;
    let html;
    if (typed.length < from) {
      const more = from - typed.length;
      html = note(typed ? `Type ${more} more letter${more > 1 ? 's' : ''} to search` : `Type ${from} letters to search`);
    } else {
      const found = search(q.options, typed);
      html = found.length ? found.map((o, i) => `<li class="combo-option" role="option" id="${input.id}-o${i}" aria-selected="false">${esc(o)}</li>`).join('') : note(q.none || 'Nothing matches. Check the spelling.');
    }
    listbox.innerHTML = html;
    listbox.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    place(input);
    setActive(input, listbox.querySelector('[role="option"]')); // Enter takes the best match
  };

  const pick = (input, value) => {
    input.value = value;
    close(input);
    input.dispatchEvent(new Event('input', { bubbles: true })); // the form stores answers on `input`
  };

  root.addEventListener('input', (e) => {
    if (combo(e.target) && e.isTrusted) open(e.target);
  });
  root.addEventListener('focusin', (e) => {
    const input = combo(e.target);
    if (!input) return;
    input.select(); // typing replaces what is there
    if (!find(input.dataset.q).options.includes(input.value)) open(input);
  });
  root.addEventListener('focusout', (e) => {
    const input = combo(e.target);
    if (!input) return;
    close(input);
    // "india" typed in full counts as India.
    const exact = find(input.dataset.q).options.find((o) => plain(o) === plain(input.value));
    if (exact && exact !== input.value) pick(input, exact);
  });
  root.addEventListener('keydown', (e) => {
    const input = combo(e.target);
    if (!input) return;
    const { listbox } = parts(input);
    const items = [...listbox.querySelectorAll('[role="option"]')];
    const at = items.findIndex((o) => o.getAttribute('aria-selected') === 'true');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (listbox.hidden) return open(input);
      if (items.length) setActive(input, items[(at + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]);
    } else if (e.key === 'Enter' && !listbox.hidden) {
      e.preventDefault();
      if (at >= 0) pick(input, items[at].textContent);
    } else if (e.key === 'Escape' && !listbox.hidden) {
      e.stopPropagation();
      close(input);
    }
  });
  // Pressing an option must not take focus from the field (that would close the list first).
  root.addEventListener('pointerdown', (e) => {
    if (e.target.closest?.('.combo-list')) e.preventDefault();
  });
  root.addEventListener('click', (e) => {
    const option = e.target.closest?.('.combo-option');
    if (option) pick(option.closest('[data-combo]').querySelector('input'), option.textContent);
  });
  const replace = () => root.querySelectorAll('[data-combo] input[aria-expanded="true"]').forEach(place);
  addEventListener('resize', replace);
  addEventListener('scroll', replace, { passive: true });
}
