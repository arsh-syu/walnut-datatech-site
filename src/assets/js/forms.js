// Enquiry forms: validation, delivery and the success state.
//
// An enquiry is posted to the site's own API (api/enquiry.php), which emails it to the team and
// sends the visitor an acknowledgement. The browser never talks to the email provider.
//
// Other scripts can add fields by listening for `enquiry:collect` on the form and writing to
// `event.detail.extra`, and react to a successful send via `enquiry:sent`.

import { track } from './analytics.js';

const api = (() => {
  try {
    return JSON.parse(document.getElementById('site-config').textContent).api || 'api/';
  } catch {
    return 'api/';
  }
})();

const UNAVAILABLE = 'Sorry — your enquiry could not be sent. Please try again in a moment.';

const messages = {
  name: 'Please enter your name.',
  organisation: 'Please enter your organisation.',
  email: 'Please enter a valid email address.',
  phone: 'Please enter a valid phone number.',
};

export function setError(input, message) {
  const field = input.closest('.field');
  let note = field.querySelector('.field-error');
  const help = field.querySelector('.field-help')?.id; // stays announced with or without an error
  if (!message) {
    field.classList.remove('has-error');
    input.removeAttribute('aria-invalid');
    if (help) input.setAttribute('aria-describedby', help);
    else input.removeAttribute('aria-describedby');
    note?.remove();
    return;
  }
  if (!note) {
    note = document.createElement('p');
    note.className = 'field-error';
    note.id = `${input.id}-error`;
    field.append(note);
  }
  note.textContent = message;
  field.classList.add('has-error');
  input.setAttribute('aria-invalid', 'true');
  input.setAttribute('aria-describedby', [note.id, help].filter(Boolean).join(' '));
}

export function validate(form) {
  let first = null;
  for (const input of form.querySelectorAll('input[required], textarea[required]')) {
    const ok = input.value.trim() !== '' && input.validity.valid;
    setError(input, ok ? '' : messages[input.name] || 'This field is required.');
    if (!ok && !first) first = input;
  }
  first?.focus();
  return !first;
}

// Posts JSON to one of the site's own API endpoints. Resolves with the reply; otherwise throws a
// message fit to show the visitor (`network` when the server was never reached, `status` and `field`
// when it answered).
export async function send(endpoint, payload, fallback = UNAVAILABLE) {
  let res;
  try {
    res = await fetch(`${api}${endpoint}`, {
      signal: AbortSignal.timeout(25000), // never leave the visitor waiting on a hung request
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw Object.assign(new Error('We couldn’t reach the server. Check your connection and try again.'), { network: true });
  }
  const reply = await res.json().catch(() => null);
  if (!res.ok || !reply?.ok) throw Object.assign(new Error(reply?.error || fallback), { field: reply?.field, status: res.status });
  return reply;
}

// Resolves once the server has emailed the enquiry.
export const deliver = (payload) => send('enquiry.php', payload);

function bind(form) {
  const wrap = form.closest('[data-form-wrap]');
  const status = form.querySelector('.form-status');
  const success = wrap.querySelector('.form-success');
  const submit = form.querySelector('[type="submit"]');

  form.addEventListener('input', (e) => {
    if (e.target.closest('.field.has-error')) setError(e.target, '');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = '';
    status.classList.remove('is-error');
    if (!validate(form)) return;

    const data = Object.fromEntries(new FormData(form));
    const detail = { extra: {} };
    form.dispatchEvent(new CustomEvent('enquiry:collect', { detail }));
    // `botcheck` is a hidden box only a bot would tick; the server quietly drops those.
    const payload = { topic: form.dataset.topic, ...data, ...detail.extra, botcheck: Boolean(data.botcheck), page: location.pathname };

    submit.disabled = true;
    submit.classList.add('is-loading');
    try {
      await deliver(payload);
      form.hidden = true;
      success.hidden = false;
      success.focus();
      form.dispatchEvent(new CustomEvent('enquiry:sent', { detail: { payload }, bubbles: true }));
      track('enquiry_submit', { topic: payload.topic });
    } catch (err) {
      const input = err.field && form.elements[err.field];
      if (input && input.closest?.('.field')) {
        setError(input, err.message);
        input.focus();
      } else {
        status.classList.add('is-error');
        status.textContent = err.message || UNAVAILABLE;
      }
    } finally {
      submit.disabled = false;
      submit.classList.remove('is-loading');
    }
  });
}

export function initForms() {
  document.querySelectorAll('[data-enquiry]').forEach(bind);
}
