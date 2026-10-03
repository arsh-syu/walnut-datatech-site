// The Walnut login page: Email OTP or Mobile OTP into one account, with password as a fallback.
// Signing in only proves who the person is — the questions of each journey live in the journeys.

import { track } from './analytics.js';
import { accountApi, portal, siteRoot, esc, call, adopt, restore, AccountError } from './session.js';
import { otpStep } from './otp.js';

const box = document.getElementById('login');
const profile = `${siteRoot}dashboard/`;
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
// Dialling codes offered beside the mobile field; the service's default is selected.
const COUNTRIES = [['+91', 'India'], ['+971', 'UAE'], ['+1', 'US / Canada'], ['+44', 'UK'], ['+65', 'Singapore'], ['+61', 'Australia'], ['+977', 'Nepal'], ['+880', 'Bangladesh'], ['+94', 'Sri Lanka']];
const PURPOSES = [
  ['UNIVERSITY', 'University / Institution', 'Work with Walnut on your online programmes.'],
  ['STUDENT', 'Learn / Upgrade Career', 'Take our short courses.'],
  ['AGENT', 'Become an Agent / Partner', 'Partner with Walnut.'],
];
const wanted = new URLSearchParams(location.search).get('type')?.toUpperCase();

const state = { method: null, email: '', dial: '+91', mobile: '', length: 6, sending: false };
const send = (channel, destination) => call('/auth/otp/send', { body: { channel, destination, purpose: 'LOGIN' }, auth: false });
const fieldError = (name, message) => {
  const note = box.querySelector(`[data-error="${name}"]`);
  if (note) note.textContent = message;
  box.querySelector(`[name="${name}"]`)?.setAttribute('aria-invalid', message ? 'true' : 'false');
};

/* ---------- 1. choose email or mobile ---------- */

function start() {
  box.innerHTML = `<h2 class="login-title">Login to your Walnut account</h2>
    <div class="login-methods" role="group" aria-label="How would you like to login?">
      ${[['email', 'Email OTP', 'Get a code on your email'], ['mobile', 'Mobile OTP', 'Get a code by SMS']]
        .map(([id, label, line]) => `<button class="login-method" type="button" data-method="${id}" aria-pressed="${state.method === id}"><strong>${label}</strong><span>${line}</span></button>`)
        .join('')}
    </div>
    <form class="login-form" novalidate${state.method ? '' : ' hidden'}>
      ${
        state.method === 'mobile'
          ? `<div class="field"><label for="login-mobile">Mobile Number</label>
              <div class="login-phone">
                <select name="dial" aria-label="Country code">${COUNTRIES.map(([code, name]) => `<option value="${code}" title="${name}"${code === state.dial ? ' selected' : ''}>${code}</option>`).join('')}</select>
                <input id="login-mobile" name="mobile" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="Enter mobile number" maxlength="20" value="${esc(state.mobile)}">
              </div>
              <p class="field-error" data-error="mobile" role="alert"></p></div>`
          : `<div class="field"><label for="login-email">Email Address</label>
              <input id="login-email" name="email" type="email" inputmode="email" autocomplete="email" placeholder="Enter your email address" maxlength="254" value="${esc(state.email)}">
              <p class="field-error" data-error="email" role="alert"></p></div>`
      }
      <button class="btn btn-primary btn-lg" type="submit"><span>Send OTP</span></button>
      <p class="login-note">New to Walnut? The same code creates your account.</p>
    </form>
    <p class="login-alt">Prefer a password? <button class="text-btn" type="button" data-password>Continue with password</button></p>`;
  box.querySelector(state.method === 'mobile' ? '#login-mobile' : '#login-email')?.focus({ preventScroll: true });
}

box.addEventListener('click', (e) => {
  const method = e.target.closest('[data-method]');
  if (method) {
    state.method = method.dataset.method;
    track('login_method', { method: state.method });
    return start();
  }
  if (e.target.closest('[data-password]')) password();
  if (e.target.closest('[data-otp]')) start();
});
box.addEventListener('input', (e) => {
  if (e.target.name === 'email') (state.email = e.target.value), fieldError('email', '');
  if (e.target.name === 'mobile') (state.mobile = e.target.value), fieldError('mobile', '');
  if (e.target.name === 'dial') state.dial = e.target.value;
});

box.addEventListener('submit', async (e) => {
  const form = e.target.closest('.login-form');
  if (!form) return;
  e.preventDefault();
  if (state.sending) return; // one request at a time
  const channel = state.method;
  const destination = channel === 'email' ? state.email.trim() : `${state.dial}${state.mobile.replace(/\D/g, '').replace(/^0+/, '')}`;
  const problem = channel === 'email' ? (EMAIL.test(destination) ? '' : 'Please enter a valid email address.') : /^\+\d{8,15}$/.test(destination) ? '' : 'Please enter a valid mobile number.';
  fieldError(channel, problem);
  if (problem) return;
  const button = form.querySelector('[type="submit"]');
  state.sending = true;
  button.classList.add('is-loading');
  button.disabled = true;
  try {
    codeStep(await send(channel, destination), destination);
    track('login_otp_sent', { channel });
  } catch (err) {
    fieldError(channel, err.message);
    button.classList.remove('is-loading');
    button.disabled = false;
  } finally {
    state.sending = false;
  }
});

/* ---------- 2. enter the code ---------- */

function codeStep(challenge, destination) {
  let fresh = null; // set when the code was right but nobody has an account for it yet
  otpStep(box, {
    challenge,
    length: state.length,
    resend: () => send(challenge.channel, destination),
    onChange: start,
    verify: async (challengeId, code) => {
      const reply = await call('/auth/otp/verify', { body: { challengeId, code }, auth: false });
      if (reply.needsProfile) fresh = reply;
      else adopt(reply);
    },
    doneText: () => (fresh ? 'Setting up your account…' : 'Signing you in…'),
    onDone: () => (fresh ? setup(fresh) : enter('otp')),
  });
}

function enter(how) {
  track('login_success', { how });
  location.assign(profile);
}

/* ---------- 3. someone new: who are you? ---------- */

function setup(proof) {
  const byMobile = proof.channel === 'mobile';
  const chosen = PURPOSES.some(([id]) => id === wanted) ? wanted : '';
  box.innerHTML = `<h2 class="login-title">How can we help you?</h2>
    <p class="login-sub">You are verified. Tell us a little about yourself to create your Walnut account.</p>
    <form class="login-setup" novalidate>
      <fieldset class="field field-set"><legend class="sr-only">How can we help you?</legend>
        <div class="login-purposes">${PURPOSES.map(([id, label, line]) => `<label class="login-purpose"><input class="sr-only" type="radio" name="accountType" value="${id}"${id === chosen ? ' checked' : ''}><span><strong>${label}</strong><small>${line}</small></span></label>`).join('')}</div>
        <p class="field-error" data-error="accountType" role="alert"></p>
      </fieldset>
      <div class="field"><label for="setup-name">Full name</label><input id="setup-name" name="name" type="text" autocomplete="name" maxlength="120"><p class="field-error" data-error="name" role="alert"></p></div>
      ${byMobile ? `<div class="field"><label for="setup-email">Email Address</label><input id="setup-email" name="email" type="email" autocomplete="email" inputmode="email" maxlength="254"><p class="field-help">Your requests and course purchases are matched to this email. You will verify it from your profile.</p><p class="field-error" data-error="email" role="alert"></p></div>` : ''}
      <button class="btn btn-primary btn-lg" type="submit"><span>Create my account</span></button>
      <p class="form-status is-error" role="alert"></p>
    </form>`;
  const form = box.querySelector('.login-setup');
  form.addEventListener('input', (e) => fieldError(e.target.name, ''));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = form.querySelector('[type="submit"]');
    if (button.disabled) return;
    const data = Object.fromEntries(new FormData(form));
    const problems = {
      accountType: data.accountType ? '' : 'Please choose one.',
      name: (data.name || '').trim().length >= 2 ? '' : 'Please enter your name.',
      ...(byMobile ? { email: EMAIL.test((data.email || '').trim()) ? '' : 'Please enter a valid email address.' } : {}),
    };
    Object.entries(problems).forEach(([name, message]) => fieldError(name, message));
    if (Object.values(problems).some(Boolean)) return;
    button.disabled = true;
    button.classList.add('is-loading');
    try {
      adopt(await call('/auth/otp/register', { body: { registrationToken: proof.registrationToken, name: data.name.trim(), accountType: data.accountType, email: byMobile ? data.email.trim() : undefined }, auth: false }));
      track('account_created', { type: data.accountType.toLowerCase(), channel: proof.channel });
      location.assign(profile);
    } catch (err) {
      if (err.status === 409 && byMobile) fieldError('email', err.message);
      else form.querySelector('.form-status').textContent = err.message;
      button.disabled = false;
      button.classList.remove('is-loading');
    }
  });
  form.querySelector('#setup-name').focus({ preventScroll: true });
}

/* ---------- password, for accounts that have one ---------- */

function password() {
  box.innerHTML = `<h2 class="login-title">Login with password</h2>
    <form class="login-password" novalidate>
      <div class="field"><label for="pw-email">Email Address</label><input id="pw-email" name="email" type="email" autocomplete="email" inputmode="email" value="${esc(state.email)}" required></div>
      <div class="field"><label for="pw-password">Password</label><input id="pw-password" name="password" type="password" autocomplete="current-password" required></div>
      <button class="btn btn-primary btn-lg" type="submit"><span>Login</span></button>
      <p class="form-status is-error" role="alert"></p>
    </form>
    <p class="login-alt"><button class="text-btn" type="button" data-otp>Use a one-time code instead</button>${portal ? ` · <a class="text-btn" href="${esc(portal)}/forgot-password">Forgot password?</a>` : ''}</p>`;
  const form = box.querySelector('.login-password');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = form.querySelector('[type="submit"]');
    if (button.disabled) return;
    const data = Object.fromEntries(new FormData(form));
    const note = form.querySelector('.form-status');
    if (!EMAIL.test((data.email || '').trim()) || !data.password) return (note.textContent = 'Please enter your email address and password.');
    button.disabled = true;
    button.classList.add('is-loading');
    note.textContent = '';
    try {
      adopt(await call('/auth/login', { body: { email: data.email.trim(), password: data.password }, auth: false }));
      enter('password');
    } catch (err) {
      note.textContent = err instanceof AccountError ? err.message : 'Login failed. Please try again.';
      button.disabled = false;
      button.classList.remove('is-loading');
    }
  });
  form.querySelector('#pw-email').focus({ preventScroll: true });
}

/* ---------- start ---------- */

if (!accountApi) {
  box.innerHTML = '<p class="form-status is-error">Login is not available right now. Please try again later.</p>';
} else if (await restore()) {
  location.replace(profile); // already signed in
} else {
  call('/auth/otp/options', { auth: false })
    .then((o) => {
      state.length = o.length || 6;
      if (o.defaultCountryCode) state.dial = o.defaultCountryCode;
    })
    .catch(() => null)
    .finally(start);
}
