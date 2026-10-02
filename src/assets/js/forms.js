// Enquiry forms: validation, delivery and the success state.
//
// Delivery is configured in site.config.mjs → form:
//   endpoint  — POST JSON to a form backend (Web3Forms, Formspree, your own API)
//   email     — fallback: open the visitor's mail app with the enquiry pre-filled
//
// Other scripts can add fields by listening for `enquiry:collect` on the form and writing to
// `event.detail.extra`, and react to a successful send via `enquiry:sent`.

import { track } from './analytics.js';

const config = (() => {
  try {
    return JSON.parse(document.getElementById('site-config').textContent).form || {};
  } catch {
    return {};
  }
})();

const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

const messages = {
  name: 'Please enter your name.',
  organisation: 'Please enter your organisation.',
  email: 'Please enter a valid email address.',
  phone: 'Please enter a valid phone number.',
};

const labels = {
  topic: 'Topic',
  name: 'Name',
  organisation: 'Organisation',
  email: 'Email',
  phone: 'Phone',
  message: 'Message',
  interests: 'Interested in',
  configuration: 'Configuration',
  page: 'Sent from',
};

export function setError(input, message) {
  const field = input.closest('.field');
  let note = field.querySelector('.field-error');
  if (!message) {
    field.classList.remove('has-error');
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
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
  input.setAttribute('aria-describedby', note.id);
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

export async function deliver(payload) {
  if (config.endpoint) {
    const subject = `${payload.topic} — ${payload.organisation || payload.name}`;
    // `subject`/`from_name` are read by Web3Forms, `_subject`/`_template` by FormSubmit; others ignore them.
    const body = { subject, from_name: 'Walnut Data Tech website', _subject: subject, _template: 'table', ...payload };
    if (config.accessKey) body.access_key = config.accessKey;
    const res = await fetch(config.endpoint, {
      signal: AbortSignal.timeout(20000), // never leave the visitor waiting on a hung request
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    const reply = await res.json().catch(() => ({}));
    if (!res.ok || String(reply.success) === 'false') throw new Error(reply.message || `Form endpoint responded ${res.status}`);
    return 'sent';
  }
  if (config.email) {
    const text = Object.entries(payload)
      .filter(([, v]) => v)
      .map(([k, v]) => `${labels[k] || k}: ${v}`)
      .join('\n');
    const subject = `${payload.topic} — ${payload.organisation || payload.name}`;
    location.href = `mailto:${config.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    return 'mail';
  }
  if (isLocal) {
    // Local preview without a configured inbox: log the payload so the flow can be tested.
    console.info('[enquiry preview]', payload);
    await new Promise((r) => setTimeout(r, 600));
    return 'preview';
  }
  throw new Error('unconfigured');
}

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
    if (data.botcheck) return; // honeypot
    delete data.botcheck;

    const detail = { extra: {}, valid: true };
    form.dispatchEvent(new CustomEvent('enquiry:collect', { detail }));
    const payload = { topic: form.dataset.topic, ...data, ...detail.extra, page: location.pathname };

    submit.disabled = true;
    submit.classList.add('is-loading');
    try {
      const how = await deliver(payload);
      if (how === 'mail') {
        success.querySelector('h2').textContent = 'Almost there.';
        success.querySelector('p').textContent = 'Your email app has opened with your enquiry — press send to finish.';
      }
      form.hidden = true;
      success.hidden = false;
      success.focus();
      form.dispatchEvent(new CustomEvent('enquiry:sent', { detail: { how, payload }, bubbles: true }));
      track('enquiry_submit', { topic: payload.topic });
    } catch (err) {
      status.classList.add('is-error');
      status.textContent =
        err.message === 'unconfigured'
          ? 'This form isn’t connected to an inbox yet. Please try again later.'
          : 'Sorry — your enquiry could not be sent. Please try again in a moment.';
    } finally {
      submit.disabled = false;
      submit.classList.remove('is-loading');
    }
  });
}

export function initForms() {
  document.querySelectorAll('[data-enquiry]').forEach(bind);
}
