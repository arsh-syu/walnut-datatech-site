// CodeSlots: the one-time code entry used by every OTP step (sign-in, new account, email and mobile
// verification — all through otp.js).
//
// An animated entry built to the supplied specification (length, status, onChange, onComplete, accent/ink/
// slot/digit/danger colours, slotSize, gap, radius, bounce, settle, rise, cascade, mask, caret, outcome):
// each digit rises into its slot with a small bounce; a pasted or auto-filled code cascades slot by slot; a
// blinking caret marks the next slot; the server's answer plays as a success wave or an error shake. The
// colours follow Walnut's theme (white slots, ink digits, violet accent, the site's danger red).
//
//   createCodeSlots(options) → { element, value(), setStatus('idle'|'pending'|'success'|'error'),
//                                setDisabled(bool), clear(), focus() }
//
// One real <input> (numeric keyboard, autocomplete="one-time-code") receives the typing, so paste, the phone's
// code suggestion, screen readers and the keyboard all work; the slots are the picture of it. onComplete fires
// once per complete entry; the caller decides what "verified" means (the server does). Codes are never logged
// or stored.

export const SLOT_DEFAULTS = {
  length: 6,
  accentColor: '#6a4df5', // supplied: #f5f5f5 — Walnut's violet-600
  inkColor: '#0d0c14', // supplied: #f5f5f5 — Walnut's ink
  slotColor: '#ffffff', // supplied: #27272a — white slots on the light card
  digitColor: '#0d0c14', // supplied: #18181b
  dangerColor: '#b42318', // supplied: #ff3b30 — the site's danger red
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

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createCodeSlots(options = {}) {
  const o = { ...SLOT_DEFAULTS, ...options };
  if (window.CodeSlots?.create) return window.CodeSlots.create(o); // a different implementation, if one is installed

  const element = document.createElement('div');
  element.className = 'code-slots';
  element.dataset.codeSlots = 'animated';
  element.style.cssText = `--slot-size:${o.slotSize}px;--slot-gap:${o.gap}px;--slot-radius:${o.radius}px;--slot-accent:${o.accentColor};--slot-ink:${o.inkColor};--slot-bg:${o.slotColor};--slot-digit:${o.digitColor};--slot-danger:${o.dangerColor};`;

  // the real field: one input the person types into (the slots mirror it)
  const input = document.createElement('input');
  input.className = 'code-slots-input';
  input.type = o.mask ? 'password' : 'text';
  input.inputMode = 'numeric';
  input.pattern = '[0-9]*';
  input.autocomplete = 'one-time-code';
  input.maxLength = o.length;
  input.setAttribute('aria-label', `One-time code, ${o.length} digits`);
  input.disabled = o.disabled;

  const row = document.createElement('div');
  row.className = 'code-slots-row';
  row.setAttribute('aria-hidden', 'true');
  const slots = Array.from({ length: o.length }, () => {
    const slot = document.createElement('span');
    slot.className = 'code-slot';
    const digit = document.createElement('span');
    digit.className = 'code-slot-digit';
    const caret = document.createElement('span');
    caret.className = 'code-slot-caret';
    slot.append(digit, caret);
    row.append(slot);
    return { slot, digit, caret, shown: '' };
  });
  element.append(input, row);

  let status = 'idle';
  let previous = '';
  const digits = () => input.value.replace(/\D/g, '').slice(0, o.length);
  const value = () => digits();

  const settle = o.settle * 1000;
  const riseIn = (digit, delay) => {
    if (reduceMotion()) return;
    const over = o.rise * o.bounce * 1.5;
    digit.animate(
      [
        { transform: `translateY(${o.rise}px) scale(.9)`, opacity: 0 },
        { transform: `translateY(${-over}px) scale(1.04)`, opacity: 1, offset: 0.6 },
        { transform: 'translateY(0) scale(1)', opacity: 1 },
      ],
      { duration: settle, delay, easing: 'cubic-bezier(.2, .7, .2, 1)', fill: 'backwards' },
    );
  };
  const dropOut = (digit) => {
    if (reduceMotion()) return;
    digit.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${o.rise}px)`, opacity: 0 }], { duration: settle * 0.5, easing: 'ease-in' });
  };

  // Paints the slots from the input: new digits rise in (cascading when several arrive at once), removed ones drop out.
  const paint = () => {
    const v = digits();
    if (input.value !== v) input.value = v;
    const fresh = [];
    slots.forEach((s, i) => {
      const ch = v[i] ?? '';
      const show = ch ? (o.mask ? '•' : ch) : '';
      if (show !== s.shown) {
        if (show) fresh.push(i);
        else dropOut(s.digit);
        s.shown = show;
        s.digit.textContent = show;
      }
      s.slot.classList.toggle('is-filled', Boolean(ch));
      s.slot.classList.toggle('is-active', o.caret && document.activeElement === input && i === Math.min(v.length, o.length - 1) && v.length < o.length);
    });
    fresh.forEach((i, k) => riseIn(slots[i].digit, fresh.length > 1 ? k * o.cascade : 0));
    element.classList.toggle('is-complete', v.length === o.length);
  };

  const setStatus = (next) => {
    status = next;
    element.dataset.status = next;
    element.classList.toggle('is-error', next === 'error');
    element.classList.toggle('is-success', next === 'success');
    element.classList.toggle('is-pending', next === 'pending');
    input.setAttribute('aria-invalid', String(next === 'error'));
    if (next === 'error' && !reduceMotion()) {
      row.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(0)' }], { duration: 380, easing: 'ease-out' });
    }
    if (next === 'success' && !reduceMotion()) {
      slots.forEach((s, i) => s.slot.animate([{ transform: 'scale(1)' }, { transform: `scale(${1 + 0.2 * o.bounce + 0.04})`, offset: 0.4 }, { transform: 'scale(1)' }], { duration: settle, delay: i * o.cascade * 2, easing: 'cubic-bezier(.2, .7, .2, 1)' }));
    }
  };
  const setDisabled = (on) => {
    input.disabled = on;
    element.classList.toggle('is-disabled', on);
  };
  const focus = () => {
    input.focus();
    paint();
  };
  const clear = () => {
    input.value = '';
    slots.forEach((s) => { s.shown = ''; s.digit.textContent = ''; });
    previous = '';
    setStatus('idle');
    paint();
  };

  const changed = () => {
    const v = digits();
    paint();
    if (v === previous) return;
    previous = v;
    if (status === 'error' || status === 'success') setStatus('idle'); // editing clears the outcome
    o.onChange?.(v);
    if (v.length === o.length) o.onComplete?.(v);
  };
  input.addEventListener('input', changed);
  input.addEventListener('focus', paint);
  input.addEventListener('blur', paint);
  input.addEventListener('paste', (e) => {
    const text = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, o.length);
    if (!text) return;
    e.preventDefault();
    input.value = text;
    changed();
  });
  row.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!input.disabled) input.focus();
  });

  setStatus('idle');
  paint();
  return { element, value, setStatus, setDisabled, clear, focus };
}
