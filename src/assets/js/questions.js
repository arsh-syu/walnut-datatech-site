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
      <legend>${esc(q.label)}${optional(q)}</legend>
      <div class="pills${q.boxes ? ' pills-boxes' : ''}">${q.options
        .map((o, i) => `<label class="pill"><input class="sr-only" type="${input}" name="${q.id}" data-q="${q.id}" value="${esc(o)}"${i === 0 ? ` id="${id}"` : ''}${picked.includes(o) ? ' checked' : ''}><span>${esc(o)}</span></label>`)
        .join('')}</div>${help}
    </fieldset>`;
  }

  let control;
  if (q.type === 'select') {
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
