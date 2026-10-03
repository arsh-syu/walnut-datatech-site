// The "enter the code we sent you" step, used when signing in and when verifying an email or mobile.
// The code is only ever typed here and sent to the account service; it is never stored.

import { esc } from './session.js';

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
      <div class="otp-boxes" role="group" aria-label="One-time code">${Array.from({ length }, (_, i) => `<input class="otp-box" inputmode="numeric" pattern="[0-9]*" maxlength="${length}" aria-label="Digit ${i + 1}"${i === 0 ? ' autocomplete="one-time-code"' : ' autocomplete="off"'}>`).join('')}</div>
      <p class="form-status is-error" role="alert"></p>
      <button class="btn btn-primary btn-lg otp-submit" type="submit" disabled><span>Verify</span></button>
    </form>
    <p class="otp-foot"><span>Didn’t receive the OTP? <span data-resend></span></span><button class="text-btn" type="button" data-change>${mobile ? 'Change Mobile Number' : 'Change Email'}</button></p>`;

  const boxes = [...box.querySelectorAll('.otp-box')];
  const status = box.querySelector('.form-status');
  const submit = box.querySelector('.otp-submit');
  const resendBox = box.querySelector('[data-resend]');
  box.querySelector('[data-to]').textContent = current.sentTo;
  const code = () => boxes.map((b) => b.value).join('');
  const setBusy = (on) => {
    busy = on;
    submit.classList.toggle('is-loading', on);
    submit.disabled = on || dead || code().length !== length;
    boxes.forEach((b) => (b.disabled = on || dead));
  };
  const fill = (digits) => {
    boxes.forEach((b, i) => (b.value = digits[i] ?? ''));
    boxes[Math.min(digits.length, length - 1)].focus();
    submit.disabled = dead || code().length !== length;
    if (digits.length === length) check();
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
    if (busy || dead || code().length !== length) return; // never send the same code twice
    setBusy(true);
    status.textContent = '';
    try {
      await verify(current.challengeId, code());
      clearTimeout(timer);
      box.innerHTML = `<div class="otp-done" role="status"><span class="success-check" aria-hidden="true"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><h2 class="login-title">Verified</h2><p class="login-sub">${esc(typeof doneText === 'function' ? doneText() : doneText)}</p></div>`;
      setTimeout(onDone, 800);
    } catch (err) {
      dead = DEAD.includes(err.reason);
      status.textContent = err.message;
      boxes.forEach((b) => (b.value = ''));
      setBusy(false);
      if (!dead) boxes[0].focus();
    }
  }

  box.addEventListener('input', (e) => {
    const i = boxes.indexOf(e.target);
    if (i < 0) return;
    const digits = e.target.value.replace(/\D/g, '');
    status.textContent = '';
    // Typing a digit moves on. A code filled in by the phone (or typed very fast) lands in one box:
    // the boxes accept that — hence no one-character limit — and it is spread out from there.
    if (digits.length > 1) return fill((boxes.slice(0, i).map((b) => b.value).join('') + digits).slice(0, length));
    e.target.value = digits;
    if (digits && i < length - 1) boxes[i + 1].focus();
    submit.disabled = dead || code().length !== length;
    if (code().length === length) check();
  });
  box.addEventListener('keydown', (e) => {
    const i = boxes.indexOf(e.target);
    if (i < 0) return;
    if (e.key === 'Backspace' && !e.target.value && i > 0) boxes[i - 1].focus();
    if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus();
    if (e.key === 'ArrowRight' && i < length - 1) boxes[i + 1].focus();
  });
  box.addEventListener('paste', (e) => {
    if (!boxes.includes(e.target)) return;
    const digits = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, length);
    if (!digits) return;
    e.preventDefault();
    fill(digits);
  });
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
      boxes.forEach((b) => (b.value = ''));
    } catch (err) {
      status.textContent = err.message;
      if (err.details?.retryAfter) wait = Math.min(Number(err.details.retryAfter) || 0, 900);
    }
    setBusy(false);
    countdown();
    if (!dead) boxes[0].focus();
  });

  countdown();
  boxes[0].focus();
}
