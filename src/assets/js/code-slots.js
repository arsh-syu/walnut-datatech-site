// CodeSlots: the one-time code entry used by every OTP step (sign-in, new account, email and mobile
// verification — all through otp.js).
//
// The requester's CodeSlots component (animated slots: rise, cascade, bounce/settle, caret, success and
// error outcomes) is to be integrated here once its source is supplied: when `window.CodeSlots.create`
// exists it is used with the same options; otherwise the provisional slots below draw the site's existing
// boxes. Either way the contract is the same, so otp.js — which owns the real verification, resend,
// expiry and attempt handling — never changes.
//
//   createCodeSlots(options) → { element, value(), setStatus('idle'|'pending'|'success'|'error'),
//                                setDisabled(bool), clear(), focus() }
//   options: { length, onChange(value), onComplete(code), accentColor, inkColor, slotColor, digitColor,
//              dangerColor, slotSize, gap, radius, bounce, settle, rise, cascade, mask, caret, outcome, disabled }
//
// onComplete fires once per complete entry; the caller decides what "verified" means (the server does),
// so a full code is never treated as success here. Codes are never logged or stored.

export const SLOT_DEFAULTS = {
  length: 6,
  accentColor: '#f5f5f5',
  inkColor: '#f5f5f5',
  slotColor: '#27272a',
  digitColor: '#18181b',
  dangerColor: '#ff3b30',
  slotSize: 44,
  gap: 8,
  radius: 12,
  bounce: 0.2,
  settle: 0.3,
  rise: 8,
  cascade: 20,
  mask: false,
  caret: true,
  outcome: 'accept',
  disabled: false,
};

export function createCodeSlots(options = {}) {
  const o = { ...SLOT_DEFAULTS, ...options };
  if (window.CodeSlots?.create) return window.CodeSlots.create(o); // the real component, once integrated

  // Provisional slots: the site's existing boxes, with the same contract.
  const element = document.createElement('div');
  element.className = 'otp-boxes code-slots';
  element.setAttribute('role', 'group');
  element.setAttribute('aria-label', 'One-time code');
  element.dataset.codeSlots = 'provisional';
  element.style.setProperty('--slot-gap', `${o.gap}px`);
  element.style.setProperty('--slot-radius', `${o.radius}px`);
  const boxes = Array.from({ length: o.length }, (_, i) => {
    const input = document.createElement('input');
    input.className = 'otp-box';
    input.type = o.mask ? 'password' : 'text';
    input.inputMode = 'numeric';
    input.pattern = '[0-9]*';
    input.maxLength = o.length; // a code pasted or filled in by the phone lands in one box and is spread out
    input.autocomplete = i === 0 ? 'one-time-code' : 'off';
    input.setAttribute('aria-label', `Digit ${i + 1}`);
    input.disabled = o.disabled;
    element.append(input);
    return input;
  });
  let status = 'idle';
  const value = () => boxes.map((b) => b.value).join('');
  const setStatus = (next) => {
    status = next;
    element.dataset.status = next;
    element.classList.toggle('is-error', next === 'error');
    element.classList.toggle('is-success', next === 'success');
    element.classList.toggle('is-pending', next === 'pending');
    boxes.forEach((b) => b.setAttribute('aria-invalid', String(next === 'error')));
  };
  const setDisabled = (on) => boxes.forEach((b) => (b.disabled = on));
  const focus = (i = 0) => boxes[Math.max(0, Math.min(i, o.length - 1))].focus();
  const clear = () => {
    boxes.forEach((b) => (b.value = ''));
    setStatus('idle');
  };
  const changed = () => {
    if (status === 'error' || status === 'success') setStatus('idle'); // editing clears the outcome
    o.onChange?.(value());
    if (value().length === o.length) o.onComplete?.(value());
  };
  const fill = (digits) => {
    boxes.forEach((b, i) => (b.value = digits[i] ?? ''));
    focus(digits.length);
    changed();
  };

  element.addEventListener('input', (e) => {
    const i = boxes.indexOf(e.target);
    if (i < 0) return;
    const digits = e.target.value.replace(/\D/g, '');
    if (digits.length > 1) return fill((boxes.slice(0, i).map((b) => b.value).join('') + digits).slice(0, o.length));
    e.target.value = digits;
    if (digits && i < o.length - 1) boxes[i + 1].focus();
    changed();
  });
  element.addEventListener('keydown', (e) => {
    const i = boxes.indexOf(e.target);
    if (i < 0) return;
    if (e.key === 'Backspace' && !e.target.value && i > 0) boxes[i - 1].focus();
    if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus();
    if (e.key === 'ArrowRight' && i < o.length - 1) boxes[i + 1].focus();
  });
  element.addEventListener('paste', (e) => {
    if (!boxes.includes(e.target)) return;
    const digits = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, o.length);
    if (!digits) return;
    e.preventDefault();
    fill(digits);
  });
  setStatus('idle');
  return { element, value, setStatus, setDisabled, clear, focus };
}
