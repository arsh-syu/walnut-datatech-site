// StatusMark — React Bits' <StatusMark /> (https://reactbits.dev, MIT + Commons Clause), its ring geometry and
// state machine carried over into plain JavaScript (the component animates with Motion; this file tweens the
// same three values — mode, arc and travel — with requestAnimationFrame). A dashed idle ring morphs into a
// solid arc that spins while something is in progress, then settles and draws a check (done) or a cross
// (failed, cancelled). The component CSS (status-mark__*) lives in account.css, as supplied.
//
//   const mark = createStatusMark({ status: 'running', size: 120, color: '#7d62ff', doneColor: '#17b26a' });
//   box.append(mark.element);  …  mark.setStatus('done');

const UI = { duration: 300, ease: (t) => 1 - Math.pow(1 - t, 3) }; // the component's spring (bounce 0) ≈ ease-out
const MORPH = { duration: 300, ease: cubicBezier(0.77, 0, 0.175, 1) };
const CHECK = 'M7.5 12.25 10.5 15.25 16.75 8.75';
const CROSS = 'M8.5 8.5 15.5 15.5M15.5 8.5 8.5 15.5';
const TEXT = { pending: 'Pending', running: 'In progress', done: 'Completed', failed: 'Failed', cancelled: 'Cancelled' };
const IDLE_DASH = 0.3;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function createStatusMark({
  status = 'pending',
  progress,
  label,
  color = 'currentColor',
  doneColor = '#22c55e',
  errorColor = '#ef4444',
  size = 20,
  strokeWidth = 2,
  dashes = 8,
  fontSize = 14,
  spinDuration = 1100,
  arcLength = 0.68,
  drawDuration = 240,
  fillOpacity = 0.06,
  strike = true,
  strikeDelay = 60,
  className = '',
} = {}) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const r = 10 - strokeWidth / 2;
  const C = 2 * Math.PI * r;
  const P = C / Math.max(1, dashes);
  const hasLabel = label !== undefined && label !== null;

  const element = document.createElement('span');
  element.className = `status-mark${className ? ` ${className}` : ''}`;
  if (strike) element.dataset.strike = '';
  Object.entries({
    '--sm-size': `${size}px`,
    '--sm-stroke': strokeWidth,
    '--sm-color': color,
    '--sm-done': doneColor,
    '--sm-error': errorColor,
    '--sm-fill': fillOpacity,
    '--sm-font': `${fontSize}px`,
    '--sm-draw': `${drawDuration}ms`,
    '--sm-strike-delay': `${120 + strikeDelay}ms`,
  }).forEach(([k, v]) => element.style.setProperty(k, String(v)));
  element.innerHTML = `<svg class="status-mark__glyph" viewBox="0 0 24 24" width="${size}" height="${size}"${hasLabel ? ' aria-hidden="true"' : ' role="img"'}>
      <circle class="status-mark__track" cx="12" cy="12" r="${r}" transform="rotate(-90 12 12)"></circle>
      <circle class="status-mark__ring" cx="12" cy="12" r="${r}" transform="rotate(-90 12 12)"></circle>
      <path class="status-mark__check" d="${CHECK}" pathLength="1"></path>
      <path class="status-mark__cross" d="${CROSS}" pathLength="1"></path>
    </svg>${hasLabel ? `<span class="status-mark__sr"></span><span class="status-mark__label">${label}<span class="status-mark__strike" aria-hidden="true"></span></span>` : ''}`;
  const glyph = element.querySelector('.status-mark__glyph');
  const ring = element.querySelector('.status-mark__ring');
  const sr = element.querySelector('.status-mark__sr');

  const state = { status, progress };
  const mode = value(0);
  const arc = value(1);
  const travel = value(0);
  let gen = 0;
  let spin = null;

  const writeDash = () => {
    const m = mode.get();
    const a = arc.get();
    const dash = IDLE_DASH * P + (a * C - IDLE_DASH * P) * m;
    const gap = (1 - IDLE_DASH) * P + ((1 - a) * C - (1 - IDLE_DASH) * P) * m;
    ring.setAttribute('stroke-dasharray', `${Math.max(0, dash)} ${Math.max(0, gap)}`);
  };
  mode.onChange(writeDash);
  arc.onChange(writeDash);
  travel.onChange((v) => ring.setAttribute('stroke-dashoffset', String(v)));

  const apply = () => {
    const g = ++gen;
    const s = state.status;
    const determinate = s === 'running' && typeof state.progress === 'number' && Number.isFinite(state.progress);
    const indeterminate = s === 'running' && !determinate;
    const solid = s === 'running' || s === 'done' || s === 'failed';
    const targetArc = indeterminate ? arcLength : determinate ? clamp01(state.progress) : 1;
    element.dataset.status = s;
    if (indeterminate) element.dataset.indeterminate = '';
    else delete element.dataset.indeterminate;
    const spoken = TEXT[s] + (determinate ? `, ${Math.round(clamp01(state.progress) * 100)}%` : '');
    if (hasLabel) sr.textContent = `${spoken}: `;
    else glyph.setAttribute('aria-label', spoken);
    if (spin) (spin.stop(), (spin = null));

    if (reduce) {
      mode.jump(solid ? 1 : 0);
      arc.jump(targetArc);
      travel.jump(0);
      return;
    }
    if (mode.get() === 0) arc.jump(targetArc);
    mode.animate(solid ? 1 : 0, MORPH);
    arc.animate(targetArc, UI);
    if (indeterminate) {
      const t0 = travel.get();
      spin = loop((t) => travel.set(t0 - C * t), spinDuration);
      return;
    }
    const unit = determinate ? C : P;
    const to = Math.floor(travel.get() / unit) * unit;
    travel.animate(to, UI).then(() => {
      if (gen === g) travel.jump(0);
    });
  };

  // first paint: the dashed ring, then the requested state
  mode.jump((status === 'running' || status === 'done' || status === 'failed') && reduce ? 1 : 0);
  writeDash();
  ring.setAttribute('stroke-dashoffset', '0');
  apply();

  return {
    element,
    setStatus(next, nextProgress) {
      state.status = next;
      state.progress = nextProgress;
      apply();
    },
    destroy() {
      gen++;
      if (spin) spin.stop();
      [mode, arc, travel].forEach((v) => v.stop());
    },
  };
}

/* ---------- a motion value: get / set / jump / animate, with change listeners ---------- */
function value(initial) {
  let v = initial;
  let raf = 0;
  const listeners = [];
  const set = (n) => {
    v = n;
    listeners.forEach((fn) => fn(v));
  };
  return {
    get: () => v,
    set,
    jump(n) {
      cancelAnimationFrame(raf);
      raf = 0;
      set(n);
    },
    onChange: (fn) => listeners.push(fn),
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
    animate(to, { duration, ease }) {
      cancelAnimationFrame(raf);
      const from = v;
      const t0 = performance.now();
      return new Promise((resolve) => {
        const step = (now) => {
          const t = Math.min(1, (now - t0) / duration);
          set(from + (to - from) * ease(t));
          if (t < 1) raf = requestAnimationFrame(step);
          else (raf = 0), resolve();
        };
        raf = requestAnimationFrame(step);
      });
    },
  };
}

function loop(fn, duration) {
  let raf = 0;
  const t0 = performance.now();
  const step = (now) => {
    fn(((now - t0) % duration) / duration);
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return { stop: () => cancelAnimationFrame(raf) };
}

/* ---------- cubic-bezier easing (the component's MORPH curve) ---------- */
function cubicBezier(x1, y1, x2, y2) {
  const sx = (t) => 3 * x1 * t * (1 - t) ** 2 + 3 * x2 * t ** 2 * (1 - t) + t ** 3;
  const sy = (t) => 3 * y1 * t * (1 - t) ** 2 + 3 * y2 * t ** 2 * (1 - t) + t ** 3;
  return (x) => {
    let lo = 0;
    let hi = 1;
    let t = x;
    for (let i = 0; i < 24; i++) {
      const cx = sx(t);
      if (Math.abs(cx - x) < 1e-4) break;
      if (cx < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}
