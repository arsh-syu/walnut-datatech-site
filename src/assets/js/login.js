// The Walnut login page: Email OTP or Mobile OTP into one account, with password as a fallback.
// Signing in only proves who the person is — the questions of each journey live in the journeys.
//
// The page first asks: existing user, or new user?
//   existing  → email / mobile → code → their dashboard. Nothing else is asked: what the account is
//               for was chosen when it was created and is kept with it.
//   new       → what they need and their name → email / mobile → code → the account is created.
// Someone who has signed in on this device before goes straight to the existing-user login.

import { track } from './analytics.js';
import { accountApi, portal, siteRoot, esc, call, adopt, restore, AccountError } from './session.js';
import { otpStep } from './otp.js';
import { mountPhone } from './phone.js';
import { COUNTRIES } from './countries.js';
import { UNIVERSITY, UNIVERSITY_ONLY, canCombine } from './roles.js';

const box = document.getElementById('login');
// Where to go once signed in: the dashboard, or — when sign-in was needed to open another Walnut app —
// back to the hand-off that sends the person on to it (only that one address is accepted).
const resume = new URLSearchParams(location.search).get('continue') || '';
const profile = /^\/api\/sso\.php\?app=[a-z-]{2,30}(&next=[A-Za-z0-9%._~\-]{0,600})?$/.test(resume) ? resume : `${siteRoot}dashboard/`;
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
// Dialling codes offered beside the mobile field; the service's default is selected.
// The country picker (flag + dialling code, searchable) comes from phone.js; India is the default.
const alpha2Of = (dial) => ({ '+1': 'US', '+7': 'RU', '+44': 'GB', '+61': 'AU' })[dial] || COUNTRIES.find((c) => c.dial === dial)?.alpha2 || 'IN';
// The three kinds of account, worded and drawn like the home page's "What brings you to Walnut?" selector.
// One is chosen; University is a flow of its own (roles.js), so a single choice also keeps the server's rule.
const ICON = (d) => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
const PURPOSES = [
  ['UNIVERSITY', 'Work with Walnut', 'I’m from a university or institution', 'Technology and services to launch, run and grow your online programmes.', '<path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6M9 11h.01M15 11h.01"/>'],
  ['STUDENT', 'Upgrade your skills', 'I want to learn and upgrade my career', 'Short online courses for counsellors, students and professionals.', '<path d="M2 9l10-5 10 5-10 5zM6 11.5V16c0 1.1 2.7 2.5 6 2.5s6-1.4 6-2.5v-4.5M22 9v5"/>'],
  ['AGENT', 'Join Walnut', 'I want to become a Walnut partner', 'Onboard as a partner and use Walnut’s applications to grow.', '<path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2.5 19a5.5 5.5 0 0 1 11 0M13.5 15.2A5.5 5.5 0 0 1 21.5 19"/>'],
];
// ?type=university,student — what the person chose before signing in; each becomes a tab of their dashboard.
// University is a flow of its own: asked for together with anything else, it is the only one kept.
const asked = (new URLSearchParams(location.search).get('type') || '').toUpperCase().split(',').filter((t) => PURPOSES.some(([id]) => id === t));
const wanted = canCombine(asked) ? asked : [UNIVERSITY];

const RETURNING = 'walnut-returning'; // set once someone has signed in on this device; holds nothing about them
const returning = () => {
  try {
    return localStorage.getItem(RETURNING) === '1';
  } catch {
    return false;
  }
};
const remember = () => {
  try {
    localStorage.setItem(RETURNING, '1');
  } catch {}
};

const state = { mode: null, types: [...wanted], name: '', method: null, email: '', dial: '+91', mobile: '', length: 6, sending: false, mobileCodes: true, password: true };
const send = (channel, destination) => call('/auth/otp/send', { body: { channel, destination, purpose: 'LOGIN' }, auth: false });
const fieldError = (name, message) => {
  const note = box.querySelector(`[data-error="${name}"]`);
  if (note) note.textContent = message;
  box.querySelector(`[name="${name}"]`)?.setAttribute('aria-invalid', message ? 'true' : 'false');
};

/* ---------- 1. existing user or new user ---------- */

function choice() {
  state.mode = null;
  box.innerHTML = `<h2 class="login-title">Login to your Walnut account</h2>
    <p class="login-sub">Have you used Walnut before?</p>
    <div class="login-methods login-modes" role="group" aria-label="Existing user or new user">
      <button class="login-method" type="button" data-mode="existing"><strong>Existing user</strong><span>Login to your account</span></button>
      <button class="login-method" type="button" data-mode="new"><strong>New user</strong><span>Create your account</span></button>
    </div>`;
}

/* ---------- 2. a new user: what do you need, and your name ---------- */

const purposeBoxes = (chosen) => {
  const picked = PURPOSES.some(([id]) => chosen.includes(id)) ? chosen[0] : null;
  return `<div class="login-types" role="tablist" aria-label="What brings you to Walnut?">${PURPOSES.map(
    ([id, title, who, , path]) => `<button class="login-type${picked === id ? ' is-active' : ''}" type="button" role="tab" aria-selected="${picked === id}" tabindex="${picked === id || (!picked && id === PURPOSES[0][0]) ? 0 : -1}" data-type="${id}">
      <span class="login-type-top"><span class="login-type-ico">${ICON(path)}</span><span class="check-badge" aria-hidden="true">${ICON('<path d="M5 12.5l4.5 4.5L19 7.5"/>')}</span></span>
      <span class="login-type-who">${who}</span><span class="login-type-title">${title}</span></button>`
  ).join('')}</div>
   <input type="hidden" name="accountType" value="${picked || ''}">
   <p class="login-note" data-type-line role="status">${picked ? PURPOSES.find(([id]) => id === picked)[3] : 'Choose one to continue. A university account is used for the university only.'}</p>
   <p class="field-error" data-error="accountType" role="alert"></p>`;
};
// Clicking a tab (or moving with the arrow keys) picks that account type; the line under the bar describes it.
const exclusive = (form) => {
  const tabs = () => [...form.querySelectorAll('.login-type')];
  const pick = (tab) => {
    tabs().forEach((t) => {
      const on = t === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    form.querySelector('[name="accountType"]').value = tab.dataset.type;
    form.querySelector('[data-type-line]').textContent = PURPOSES.find(([id]) => id === tab.dataset.type)[3];
    fieldError('accountType', '');
  };
  form.addEventListener('click', (e) => {
    const tab = e.target.closest('.login-type');
    if (tab) pick(tab);
  });
  form.addEventListener('keydown', (e) => {
    const tab = e.target.closest('.login-type');
    if (!tab || !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const all = tabs();
    const next = all[(all.indexOf(tab) + (['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : all.length - 1)) % all.length];
    pick(next);
    next.focus();
  });
};
const chosenTypes = (form) => [form.querySelector('[name="accountType"]').value].filter(Boolean);
const typesProblem = (types) => (!types.length ? 'Please choose what brings you to Walnut.' : canCombine(types) ? '' : UNIVERSITY_ONLY);

function details() {
  state.mode = 'new';
  box.innerHTML = `<h2 class="login-title">Create your Walnut account</h2>
    <p class="login-sub">How can we help you? You are asked this once — it is saved with your account.</p>
    <form class="login-setup" data-details novalidate>
      <fieldset class="field field-set"><legend class="login-legend">What brings you to Walnut?</legend>
        ${purposeBoxes(state.types)}
      </fieldset>
      <div class="field"><label for="setup-name">Full name</label><input id="setup-name" name="name" type="text" autocomplete="name" maxlength="120" value="${esc(state.name)}"><p class="field-error" data-error="name" role="alert"></p></div>
      <button class="btn btn-primary btn-lg" type="submit"><span>Continue</span></button>
    </form>
    <p class="login-alt">Already have an account? <button class="text-btn" type="button" data-mode="existing">Login</button></p>`;
  const form = box.querySelector('[data-details]');
  form.addEventListener('input', (e) => fieldError(e.target.name, ''));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const types = chosenTypes(form);
    const name = form.elements.name.value.trim();
    const problems = { accountType: typesProblem(types), name: name.length >= 2 ? '' : 'Please enter your name.' };
    Object.entries(problems).forEach(([field, message]) => fieldError(field, message));
    if (Object.values(problems).some(Boolean)) return;
    state.types = types;
    state.name = name;
    start();
  });
  exclusive(form);
  form.querySelector('#setup-name').focus({ preventScroll: true });
}

/* ---------- 3. email or mobile ---------- */

function start() {
  state.mode ??= 'existing';
  const isNew = state.mode === 'new';
  box.innerHTML = `<h2 class="login-title">${isNew ? 'Verify your email or mobile' : 'Login to your Walnut account'}</h2>
    ${isNew ? '<p class="login-sub">We send a one-time code to confirm it is yours. You will login with it from now on.</p>' : ''}
    <div class="login-methods" role="group" aria-label="How would you like to login?"${state.mobileCodes ? '' : ' hidden'}>
      ${[['email', 'Email OTP', 'Get a code on your email'], ['mobile', 'Mobile OTP', 'Get a code by SMS']]
        .map(([id, label, line]) => `<button class="login-method" type="button" data-method="${id}" aria-pressed="${state.method === id}"><strong>${label}</strong><span>${line}</span></button>`)
        .join('')}
    </div>
    <form class="login-form" novalidate${state.method ? '' : ' hidden'}>
      ${
        state.method === 'mobile'
          ? `<div class="field"><label for="login-mobile">Mobile Number</label>
              <input id="login-mobile" name="mobile" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="Enter mobile number" maxlength="20" value="${esc(state.mobile)}" required>
              <p class="field-error" data-error="mobile" role="alert"></p></div>`
          : `<div class="field"><label for="login-email">Email Address</label>
              <input id="login-email" name="email" type="email" inputmode="email" autocomplete="email" placeholder="Enter your email address" maxlength="254" value="${esc(state.email)}">
              <p class="field-error" data-error="email" role="alert"></p></div>`
      }
      <button class="btn btn-primary btn-lg" type="submit"><span>Send OTP</span></button>
    </form>
    ${
      isNew
        ? '<p class="login-alt"><button class="text-btn" type="button" data-mode="new">Back</button> · Already have an account? <button class="text-btn" type="button" data-mode="existing">Login</button></p>'
        : `<p class="login-alt">New to Walnut? <button class="text-btn" type="button" data-mode="new">Create an account</button>${state.password ? ' · <button class="text-btn" type="button" data-password>Use a password</button>' : ''}</p>`
    }`;
  const tel = box.querySelector('#login-mobile');
  if (tel) state.phone = mountPhone(tel, { defaultAlpha2: alpha2Of(state.dial), onChange: ({ country }) => (state.dial = country.dial) });
  box.querySelector(state.method === 'mobile' ? '#login-mobile' : '#login-email')?.focus({ preventScroll: true });
}

box.addEventListener('click', (e) => {
  const mode = e.target.closest('[data-mode]');
  if (mode) {
    track('login_mode', { mode: mode.dataset.mode });
    if (mode.dataset.mode === 'new') return details();
    state.mode = 'existing';
    return start();
  }
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
  if (e.target.id === 'login-mobile') (state.mobile = e.target.value), fieldError('mobile', '');
});

box.addEventListener('submit', async (e) => {
  const form = e.target.closest('.login-form');
  if (!form) return;
  e.preventDefault();
  if (state.sending) return; // one request at a time
  const channel = state.method;
  // The mobile number is the E.164 value the picker keeps (+919876543210), validated for its country.
  const destination = channel === 'email' ? state.email.trim() : state.phone?.value ?? '';
  const problem = channel === 'email' ? (EMAIL.test(destination) ? '' : 'Please enter a valid email address.') : destination ? '' : form.querySelector('#login-mobile')?.validationMessage || 'Please enter a valid mobile number.';
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

/* ---------- 4. enter the code ---------- */

function codeStep(challenge, destination) {
  let fresh = null; // set when the code was right but nobody has an account for it yet
  const isNew = state.mode === 'new';
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
    doneText: () => (fresh ? 'Setting up your account…' : isNew ? 'You already have an account. Signing you in…' : 'Signing you in…'),
    onDone: () => {
      if (!fresh) return enter('otp');
      // A new user already said what they need. With an email code that is everything; with a mobile
      // code their email is still asked for. An "existing user" with no account is asked the lot.
      if (isNew && fresh.channel === 'email') return create(fresh, { name: state.name, types: state.types });
      setup(fresh, !isNew);
    },
  });
}

async function enter(how) {
  track('login_success', { how });
  remember();
  // What was chosen on the way in is added to the account they already have (the server decides what may be).
  const extra = state.mode === 'new' ? state.types : wanted;
  if (extra.length) await call('/account/services', { body: { types: extra } }).catch(() => null);
  location.assign(profile);
}

// Creates the account for a verified email or mobile. Throws what the service says when it cannot.
async function create(proof, { name, types, email }) {
  try {
    adopt(await call('/auth/otp/register', { body: { registrationToken: proof.registrationToken, name, accountType: types[0], accountTypes: types, email }, auth: false }));
  } catch (err) {
    if (box.querySelector('.login-setup')) throw err;
    return setup(proof, false, err.message); // shown with the form, so it can be put right
  }
  remember();
  track('account_created', { type: types.join('+').toLowerCase(), channel: proof.channel });
  location.assign(profile);
}

/* ---------- 5. no account yet for a verified email / mobile ---------- */

// `notFound`: they said "existing user", but nothing is registered under what they verified.
function setup(proof, notFound = false, problem = '') {
  const byMobile = proof.channel === 'mobile';
  box.innerHTML = `<h2 class="login-title">${notFound ? 'No account yet' : 'Almost done'}</h2>
    <p class="login-sub">${notFound ? `There is no Walnut account for this ${byMobile ? 'mobile number' : 'email address'} yet. Tell us a little about yourself to create it.` : 'You are verified. Confirm your details to create your Walnut account.'}</p>
    <form class="login-setup" novalidate>
      <fieldset class="field field-set"><legend class="login-legend">What brings you to Walnut?</legend>
        ${purposeBoxes(state.types)}
      </fieldset>
      <div class="field"><label for="setup-name">Full name</label><input id="setup-name" name="name" type="text" autocomplete="name" maxlength="120" value="${esc(state.name)}"><p class="field-error" data-error="name" role="alert"></p></div>
      ${byMobile ? `<div class="field"><label for="setup-email">Email Address</label><input id="setup-email" name="email" type="email" autocomplete="email" inputmode="email" maxlength="254"><p class="field-help">Your requests and course purchases are matched to this email. You will verify it from your profile.</p><p class="field-error" data-error="email" role="alert"></p></div>` : ''}
      <button class="btn btn-primary btn-lg" type="submit"><span>Create my account</span></button>
      <p class="form-status is-error" role="alert">${esc(problem)}</p>
    </form>`;
  const form = box.querySelector('.login-setup');
  exclusive(form);
  form.addEventListener('input', (e) => fieldError(e.target.name, ''));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = form.querySelector('[type="submit"]');
    if (button.disabled) return;
    const data = Object.fromEntries(new FormData(form));
    const types = chosenTypes(form);
    const problems = {
      accountType: typesProblem(types),
      name: (data.name || '').trim().length >= 2 ? '' : 'Please enter your name.',
      ...(byMobile ? { email: EMAIL.test((data.email || '').trim()) ? '' : 'Please enter a valid email address.' } : {}),
    };
    Object.entries(problems).forEach(([name, message]) => fieldError(name, message));
    if (Object.values(problems).some(Boolean)) return;
    button.disabled = true;
    button.classList.add('is-loading');
    try {
      await create(proof, { name: data.name.trim(), types, email: byMobile ? data.email.trim() : undefined });
    } catch (err) {
      if (err.status === 409 && byMobile) fieldError('email', err.message);
      else form.querySelector('.form-status').textContent = err.message;
      button.disabled = false;
      button.classList.remove('is-loading');
    }
  });
  exclusive(form);
  form.querySelector(state.name ? (byMobile ? '#setup-email' : '[type="submit"]') : '#setup-name').focus({ preventScroll: true });
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
      await enter('password');
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
  // already signed in: what was chosen on the way here is still added to the account
  if (wanted.length) await call('/account/services', { body: { types: wanted } }).catch(() => null);
  location.replace(profile);
} else {
  call('/auth/otp/options', { auth: false })
    .then((o) => {
      state.length = o.length || 6;
      if (o.defaultCountryCode) state.dial = o.defaultCountryCode;
      // Without an SMS sender, or without passwords, the page offers the email code only.
      state.mobileCodes = o.mobile !== false;
      state.password = o.password !== false;
      if (!state.mobileCodes) state.method = 'email';
    })
    .catch(() => null)
    // Someone who has signed in here before is not asked again: straight to the login.
    .finally(() => (returning() ? start() : choice()));
}
