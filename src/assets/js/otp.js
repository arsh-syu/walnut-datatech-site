// The "enter the code we sent you" step, used when signing in and when verifying an email or mobile.
// The code is only ever typed here and sent to the account service; it is never stored.
//
// The entry itself is a CodeSlots mount (code-slots.js): this file owns what happens around it — the
// server-side check, the single flight, expiry and lockout, resend and its cooldown, changing the address.

import { esc } from './session.js';
import { createCodeSlots } from './code-slots.js';

const DEAD = ['OTP_EXPIRED', 'OTP_INVALIDATED'];

/**
 * Draws the step into `box`.
 *   challenge  { challengeId, channel, sentTo, resendIn } from the service
 *   verify     (challengeId, code) => Promise — resolves when the code was right
 *   resend     () => Promise<challenge>
 *   onChange   the person wants a different email / mobile
 *   onDone     called shortly after the "Verified" tick
 *   doneText   the line under the tick (a string, or a function read once the code was right)
 */
export function otpStep(box, { challenge, length = 6, verify, resend, onChange, onDone, doneText = '' }) {
  let current = challenge;
  let busy = false;
  let dead = false;
  let wait = current.resendIn;
  let timer;
  const mobile = current.channel === 'mobile';

  box.innerHTML = `<h2 class="login-title">${mobile ? 'Verify your mobile' : 'Verify your email'}</h2>
    <p class="login-sub">We’ve sent a ${length}-digit OTP to<br><strong data-to></strong></p>
    <form class="otp" novalidate>
      <div data-code-slots></div>
      <p class="form-status is-error" role="alert"></p>
      <button class="btn btn-primary btn-lg otp-submit" type="submit" disabled><span>Verify</span></button>
    </form>
    <p class="otp-foot"><span>Didn’t receive the OTP? <span data-resend></span></span><button class="text-btn" type="button" data-change>${mobile ? 'Change Mobile Number' : 'Change Email'}</button></p>`;

  const status = box.querySelector('.form-status');
  const submit = box.querySelector('.otp-submit');
  const resendBox = box.querySelector('[data-resend]');
  box.querySelector('[data-to]').textContent = current.sentTo;
  const slots = createCodeSlots({
    length,
    onChange: () => {
      status.textContent = '';
      submit.disabled = dead || busy || slots.value().length !== length;
    },
    onComplete: () => check(), // a complete entry asks the server; it is never success by itself
  });
  box.querySelector('[data-code-slots]').replaceWith(slots.element);
  const setBusy = (on) => {
    busy = on;
    submit.classList.toggle('is-loading', on);
    submit.disabled = on || dead || slots.value().length !== length;
    slots.setDisabled(on || dead);
    if (on) slots.setStatus('pending');
  };

  function countdown() {
    clearTimeout(timer);
    if (wait > 0) {
      resendBox.textContent = `Resend OTP in ${wait} seconds`;
      timer = setTimeout(() => (wait--, countdown()), 1000);
    } else {
      resendBox.innerHTML = '<button class="text-btn" type="button" data-again>Resend OTP</button>';
    }
  }

  async function check() {
    if (busy || dead || slots.value().length !== length) return; // never send the same code twice
    setBusy(true);
    status.textContent = '';
    try {
      await verify(current.challengeId, slots.value());
      clearTimeout(timer);
      slots.setStatus('success'); // the server said yes: the slots show it, then the tick takes over
      await new Promise((r) => setTimeout(r, 450));
      box.innerHTML = `<div class="otp-done" role="status"><span class="success-check" aria-hidden="true"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><h2 class="login-title">Verified</h2><p class="login-sub">${esc(typeof doneText === 'function' ? doneText() : doneText)}</p></div>`;
      setTimeout(onDone, 800);
    } catch (err) {
      dead = DEAD.includes(err.reason); // expired or invalidated: only a resend can continue
      status.textContent = err.message; // the server's own words: wrong code, attempts left, rate limit, or no connection
      setBusy(false);
      slots.setStatus('error'); // stays until the person edits the code
      if (!dead) slots.focus(0);
    }
  }

  box.querySelector('form').addEventListener('submit', (e) => (e.preventDefault(), check()));
  box.addEventListener('click', async (e) => {
    if (e.target.closest('[data-change]')) return clearTimeout(timer), onChange();
    if (!e.target.closest('[data-again]') || busy) return;
    setBusy(true);
    status.textContent = '';
    try {
      current = await resend();
      dead = false;
      wait = current.resendIn;
      slots.clear();
    } catch (err) {
      status.textContent = err.message;
      if (err.details?.retryAfter) wait = Math.min(Number(err.details.retryAfter) || 0, 900);
    }
    setBusy(false);
    slots.setStatus('idle');
    countdown();
    if (!dead) slots.focus(0);
  });

  countdown();
  slots.focus(0);
}
