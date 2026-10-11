// GradientText — React Bits' <GradientText /> (https://reactbits.dev, MIT + Commons Clause), its engine carried
// over unchanged into plain JavaScript for the hero's highlighted words. The gradient is painted as a CSS
// image into --gt-gradient on every frame: `flow` drifts soft blobs of colour around like a living mesh
// gradient, `linear` slides a gradient through the text, `conic` swings the colours around the centre.
// Colours are Walnut's violets (the component's default pink is not in the theme). Reduced motion holds the
// gradient still; the loop sleeps while the words are off screen.
//
// Markup (home.mjs):
//   <span class="gradient-text" data-gradient-text>
//     <span class="gradient-text__inner"><span class="gradient-text__content">…</span><span class="gradient-text__glow" aria-hidden="true">…</span></span>
//   </span>

const SETTINGS = {
  colors: ['#5b3fe6', '#b9abff', '#7d62ff'], // --violet-700, the sweep's lavender, --violet
  animationSpeed: 8, // seconds for one full cycle
  variant: 'flow', // 'linear' | 'flow' | 'conic'
  angle: 90,
  scale: 3,
  yoyo: true,
  glow: 0.4,
  pauseOnHover: false,
  followPointer: false,
};

const VARIANTS = ['linear', 'flow', 'conic'];
const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function mountGradientText(root, options = {}) {
  const o = { ...SETTINGS, ...options };
  const palette = o.colors.length > 1 ? o.colors : [o.colors[0] ?? '#ffffff', o.colors[0] ?? '#ffffff'];
  const s = {
    colors: palette,
    speed: Math.max(0.2, o.animationSpeed),
    variant: VARIANTS.includes(o.variant) ? o.variant : 'linear',
    angle: o.angle,
    scale: clamp(o.scale, 1, 6),
    yoyo: o.yoyo,
    pauseOnHover: o.pauseOnHover,
    followPointer: o.followPointer,
  };
  root.style.setProperty('--gt-gradient', `linear-gradient(${s.angle}deg, ${[...palette, palette[0]].join(', ')})`);
  root.style.setProperty('--gt-glow', String(clamp(o.glow, 0, 1)));

  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const state = { time: 0, inside: false, visible: true, x: 0.5, y: 0.5, px: 0.5, py: 0.5, vx: 0, vy: 0, pull: 0 };
  let raf = 0;
  let last = 0;
  let alive = true;

  const paint = () => {
    const list = s.colors;
    const cycle = state.time / s.speed;
    let image;
    if (s.variant === 'flow') {
      const blobs = list.map((color, i) => {
        const spin = cycle * TAU;
        const rate = 0.55 + ((i * 0.618) % 1) * 0.5;
        let x = 50 + 44 * Math.sin(spin * rate + i * 2.1);
        let y = 50 + 40 * Math.sin(spin * (rate * 0.83 + 0.21) + i * 1.3);
        if (i === 0) {
          x += (state.px * 100 - x) * state.pull;
          y += (state.py * 100 - y) * state.pull;
        }
        return `radial-gradient(ellipse ${(22 + 12 * s.scale).toFixed(1)}% ${(60 + 30 * s.scale).toFixed(1)}% at ${x.toFixed(2)}% ${y.toFixed(2)}%, ${color} 0%, transparent 100%)`;
      });
      image = `${blobs.join(', ')}, linear-gradient(${s.angle}deg, ${list.join(', ')})`;
    } else if (s.variant === 'conic') {
      const sway = s.yoyo ? Math.sin(cycle * Math.PI) * 50 : cycle * 360;
      const cx = 50 + (state.px * 100 - 50) * state.pull;
      const cy = 260 + (state.py * 100 - 260) * state.pull;
      image = `repeating-conic-gradient(from ${(sway - 30).toFixed(2)}deg at ${cx.toFixed(2)}% ${cy.toFixed(2)}%, ${[...list, list[0]].map((color, i) => `${color} ${((i / list.length) * 60 * (3 / s.scale)).toFixed(2)}deg`).join(', ')})`;
    } else {
      const loop = [...list, list[0]];
      const period = 100 * s.scale;
      let offset;
      if (s.yoyo) {
        const swing = cycle % 2;
        const t = swing < 1 ? swing : 2 - swing;
        offset = (0.5 - Math.cos(Math.PI * t) / 2) * (period - 100);
      } else {
        offset = (cycle % 1) * period;
      }
      offset += (state.px - 0.5) * period * 0.5 * state.pull;
      const stops = loop.map((color, i) => `${color} ${((i / (loop.length - 1)) * period - offset).toFixed(2)}%`);
      image = `repeating-linear-gradient(${s.angle}deg, ${stops.join(', ')})`;
    }
    root.style.setProperty('--gt-gradient', image);
  };

  const tick = (now) => {
    raf = 0;
    if (!alive) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const paused = reduce || (s.pauseOnHover && state.inside);
    if (!paused) state.time += dt;
    const target = s.followPointer && state.inside ? 1 : 0;
    state.pull += (target - state.pull) * (1 - Math.exp(-dt * 6));
    const stiffness = 160;
    state.vx += ((state.x - state.px) * stiffness - state.vx * 2 * Math.sqrt(stiffness)) * dt;
    state.vy += ((state.y - state.py) * stiffness - state.vy * 2 * Math.sqrt(stiffness)) * dt;
    state.px += state.vx * dt;
    state.py += state.vy * dt;
    paint();
    const settling = Math.abs(state.pull - target) > 0.001 || Math.abs(state.vx) + Math.abs(state.vy) > 0.001;
    if (!state.visible || (paused && !settling)) return;
    raf = requestAnimationFrame(tick);
  };

  const wake = () => {
    if (raf || !alive) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };

  const locate = (event) => {
    const rect = root.getBoundingClientRect();
    state.x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    state.y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
  };
  const onEnter = (event) => {
    locate(event);
    if (!state.inside) {
      state.px = state.x;
      state.py = state.y;
    }
    state.inside = true;
    wake();
  };
  const onMove = (event) => {
    locate(event);
    wake();
  };
  const onLeave = () => {
    state.inside = false;
    wake();
  };

  const observer = new IntersectionObserver((entries) => {
    state.visible = entries.some((entry) => entry.isIntersecting);
    if (state.visible) wake();
  });
  observer.observe(root);
  root.addEventListener('pointerenter', onEnter);
  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerleave', onLeave);
  paint();
  wake();

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    observer.disconnect();
    root.removeEventListener('pointerenter', onEnter);
    root.removeEventListener('pointermove', onMove);
    root.removeEventListener('pointerleave', onLeave);
  };
}

document.querySelectorAll('[data-gradient-text]').forEach((el) => mountGradientText(el));
