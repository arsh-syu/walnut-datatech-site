// "Check your request": looks up a university empanelment request by Request ID + registered email.
// The site's own API asks the Onboarding Tool; the browser never talks to it directly.

import { track } from './analytics.js';
import { setError, send } from './forms.js';

const form = document.querySelector('[data-status-form]');
const result = document.querySelector('[data-status-result]');
const note = form.querySelector('.form-status');
const submit = form.querySelector('[type="submit"]');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The Onboarding Tool's statuses, in the words a university should read.
const WAITING_ON_YOU = 'Please use the link in the email we sent to your registered address to respond.';
const statuses = {
  PENDING_REVIEW: ['Submitted', 'Your request has been received and is waiting for review.'],
  UNDER_REVIEW: ['Under review', 'Our team is reviewing your request.'],
  CHANGES_REQUIRED: ['Changes required', `We have asked for some changes. ${WAITING_ON_YOU}`],
  COUNTER_PROPOSAL: ['Counter proposal', `We have sent you a proposal. ${WAITING_ON_YOU}`],
  RESUBMITTED: ['Resubmitted', 'Your updated request has been received and is waiting for review.'],
  APPROVED: ['Approved', 'Your request is approved. Onboarding access is sent to your registered email address.', 'is-ok'],
  POC_ACCOUNT_CREATED: ['Approved', 'Your request is approved. Onboarding access has been sent to your registered email address.', 'is-ok'],
  REJECTED: ['Not approved', 'We are unable to take this request forward. The details were sent to your registered email address.', 'is-stop'],
};
const day = (iso) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
};

const problems = {
  reference: (v) => (/^UR-\d{1,9}$/i.test(v) ? '' : 'Please enter your Request ID, for example UR-000123.'),
  email: (v) => (/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(v) ? '' : 'Please enter a valid email address.'),
};

form.addEventListener('input', (e) => {
  if (e.target.closest('.field.has-error')) setError(e.target, '');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (submit.disabled) return;
  note.textContent = '';
  note.classList.remove('is-error');
  let first = null;
  for (const [name, problem] of Object.entries(problems)) {
    const input = form.elements[name];
    const message = problem(input.value.trim());
    setError(input, message);
    if (message && !first) first = input;
  }
  if (first) return first.focus();

  submit.disabled = true;
  submit.classList.add('is-loading');
  result.hidden = true;
  try {
    const r = await send('request-status.php', { reference: form.elements.reference.value.trim(), email: form.elements.email.value.trim() }, 'We could not check your request right now. Please try again later.');
    const [label, text, tone = ''] = statuses[r.status] ?? ['In progress', 'Your request is being processed.'];
    result.innerHTML = `<span class="status-badge ${tone}">${esc(label)}</span>
      <p>${esc(text)}</p>
      <dl class="status-facts">
        <div><dt>Request ID</dt><dd>${esc(r.reference)}</dd></div>
        <div><dt>University</dt><dd>${esc(r.universityName)}</dd></div>
        <div><dt>Submitted</dt><dd>${esc(day(r.submittedAt))}</dd></div>
        <div><dt>Last updated</dt><dd>${esc(day(r.updatedAt))}</dd></div>
      </dl>`;
    result.hidden = false;
    result.focus();
    track('university_request_status_checked', { status: r.status });
  } catch (err) {
    const input = err.field && form.elements[err.field];
    if (input) {
      setError(input, err.message);
      input.focus();
    } else {
      note.classList.add('is-error');
      note.textContent = err.network ? 'We couldn’t reach the server. Please check your internet connection and try again.' : err.message;
    }
  } finally {
    submit.disabled = false;
    submit.classList.remove('is-loading');
  }
});

// The confirmation screen links here with ?ref=UR-…
const ref = new URLSearchParams(location.search).get('ref');
if (ref && !problems.reference(ref)) {
  form.elements.reference.value = ref.toUpperCase();
  history.replaceState(null, '', location.pathname);
  form.elements.email.focus();
}
