// Verify a certificate: the Certificate ID is checked against the LMS through the site's own API
// (api/verify-certificate.php). The browser never talks to the LMS directly.

import { send } from './forms.js';
import { track } from './analytics.js';

const form = document.querySelector('[data-verify-form]');
if (form) {
  const status = form.querySelector('.form-status');
  const result = document.querySelector('[data-verify-result]');
  const submit = form.querySelector('[type="submit"]');
  const input = form.elements.certificateId;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const when = (iso) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? esc(iso) : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // ?id=WDT-2026-0001 fills the field in, so the link printed on a certificate verifies it in one step.
  const fromUrl = new URLSearchParams(location.search).get('id');
  if (fromUrl && !input.value) input.value = fromUrl.slice(0, 40);

  const show = (html, kind) => {
    result.className = `verify-result is-${kind}`;
    result.innerHTML = html;
    result.hidden = false;
    result.focus();
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = '';
    status.classList.remove('is-error');
    result.hidden = true;
    const certificateId = input.value.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9\-\/]{3,39}$/.test(certificateId)) {
      status.classList.add('is-error');
      status.textContent = 'Enter the Certificate ID exactly as printed on the certificate.';
      return input.focus();
    }
    submit.disabled = true;
    submit.classList.add('is-loading');
    try {
      const reply = await send('verify-certificate.php', { certificateId }, 'The verification service is not responding right now. Please try again in a few minutes.');
      const c = reply.certificate || {};
      if (reply.valid) {
        show(`<p class="verify-badge">Valid certificate</p>
          <dl class="verify-details">
            <div><dt>Certificate ID</dt><dd>${esc(certificateId)}</dd></div>
            ${c.holder ? `<div><dt>Issued to</dt><dd>${esc(c.holder)}</dd></div>` : ''}
            ${c.course ? `<div><dt>Course</dt><dd>${esc(c.course)}</dd></div>` : ''}
            ${c.issuedOn ? `<div><dt>Issued on</dt><dd>${when(c.issuedOn)}</dd></div>` : ''}
            ${c.status ? `<div><dt>Status</dt><dd>${esc(c.status)}</dd></div>` : ''}
          </dl>
          <p class="verify-note">Verified against the Walnut learning platform just now.</p>`, 'ok');
      } else {
        show(`<p class="verify-badge">No certificate found</p>
          <p>No certificate with the ID <strong>${esc(certificateId)}</strong> is on record${c.status ? ` (${esc(c.status)})` : ''}. Check the ID for typing mistakes, or ask the holder for the certificate link.</p>`, 'no');
      }
      track('certificate_verify', { valid: Boolean(reply.valid) });
    } catch (err) {
      status.classList.add('is-error');
      status.textContent = err.message;
    } finally {
      submit.disabled = false;
      submit.classList.remove('is-loading');
    }
  });
}
