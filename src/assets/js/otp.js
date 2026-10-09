// The "enter the code we sent you" step, used when signing in and when verifying an email or mobile.
// The code is only ever typed here and sent to the account service; it is never stored.
//
// The entry itself is a CodeSlots mount (code-slots.js): this file owns what happens around it — the
// server-side check, the single flight, expiry and lockout, resend and its cooldown, changing the address.

import { esc } from './session.js';
import { createCodeSlots } from './code-slots.js';
import { createStatusMark } from './status-mark.js';
import { mountClickSpark } from './click-spark.js';

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
      // The verified moment: React Bits' StatusMark spins as a violet arc, settles, fills and draws its check in
      // Walnut green while ClickSpark bursts around it; then the words rise in. Nothing here is a status in
      // itself — the server has already said yes.
      box.innerHTML = `<div class="otp-done" role="status"><div class="otp-done-stage" aria-hidden="true"><div class="otp-done-mark" data-mark></div></div><h2 class="login-title">Verified</h2><p class="login-sub">${esc(typeof doneText === 'function' ? doneText() : doneText)}</p></div>`;
      const done = box.querySelector('.otp-done');
      const stage = box.querySelector('.otp-done-stage');
      const mark = createStatusMark({ status: 'running', size: 112, strokeWidth: 1.6, dashes: 10, color: '#7d62ff', doneColor: '#17b26a', drawDuration: 420, fillOpacity: 0.1, spinDuration: 900 });
      box.querySelector('[data-mark]').append(mark.element);
      const spark = mountClickSpark(stage, { sparkColor: '#7d62ff', sparkSize: 22, sparkRadius: 66, sparkCount: 14, duration: 850, onClick: false });
      await new Promise((r) => setTimeout(r, 520));
      mark.setStatus('done');
      done.classList.add('is-done');
      spark.burst(stage.clientWidth / 2, stage.clientHeight / 2);
      setTimeout(() => spark.burst(stage.clientWidth / 2, stage.clientHeight / 2), 140);
      setTimeout(onDone, 1900);
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
