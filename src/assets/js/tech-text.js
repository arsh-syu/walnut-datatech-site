// "TechText": the hero's highlighted words are drawn as dashed technical strokes, letter by letter, and
// then filled by a sweep of light; a scatter of specks glints around them, and the strokes brighten as
// the pointer comes near. Settings follow the supplied TechText configuration; the colours take the
// heading's own violet-to-ink gradient, because white would vanish on this light hero.
//
// Accessibility and layout: the real words stay in the <h1> (visually hidden), the drawing is an SVG
// sized to exactly the box each word already occupies, so nothing shifts and nothing is read twice.
// Reduced motion, coarse pointers and missing SVG support leave the plain words as they are.

const SETTINGS = {
  fontWeight: 600, // the supplied weight; the heading's own weight is used when its font does not ship this one (see build)
  reveal: 'letter', // 'letter' | 'word'
  dashLength: 4,
  dashGap: 2,
  specks: 15,
  color: '#5b3fe6', // stroke and fill (supplied: #ffffff, replaced by the brand violet for contrast)
  accentColor: '#7d62ff', // specks and the pointer glow (supplied: #ffffff)
  reach: 200, // px: how far the pointer's glow reaches
  softness: 0.7, // 0..1: how gently the glow fades with distance
  strokeWidth: 1.5,
  speed: 1, // 1 = the supplied timing; 2 = twice as fast
  lineStyle: 'dashed', // 'dashed' | 'solid'
  sweep: true,
};

const NS = 'http://www.w3.org/2000/svg';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;
const words = [...document.querySelectorAll('[data-tech-text] .w > span')];

if (words.length && !reduceMotion && 'ResizeObserver' in window) {
  const S = SETTINGS;
  const seed = (n) => ((Math.sin(n * 9301 + 49297) * 233280) % 1 + 1) % 1; // repeatable "random" per speck
  const drawings = [];
  let gradients = 0;

  const svgEl = (name, attrs = {}) => {
    const el = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    return el;
  };

  function build(span, index) {
    const text = span.textContent;
    const rect = span.getBoundingClientRect();
    const style = getComputedStyle(span);
    const w = Math.ceil(rect.width) || 1;
    const h = Math.ceil(rect.height) || 1;
    const id = `tt-grad-${++gradients}`;

    const svg = svgEl('svg', { class: 'tt', width: w, height: h, 'aria-hidden': 'true', focusable: 'false' });
    svg.style.setProperty('--tt-speed', String(1 / S.speed));
    svg.style.setProperty('--tt-base', `${index * 90}ms`);
    const defs = svgEl('defs');
    const grad = svgEl('linearGradient', { id, x1: 0, y1: 0, x2: 1, y2: 0 });
    for (const [at, color] of [[0, '#5b3fe6'], [0.45, S.color], [1, '#0d0c14']]) grad.append(svgEl('stop', { offset: at, 'stop-color': color }));
    defs.append(grad);
    svg.append(defs);

    // The heading's font is loaded in one weight (Lexend 500); asking the browser for 600 would fake a bold
    // and widen the glyphs past the measured box, so the drawing keeps the heading's weight unless 600 is there.
    const weight = document.fonts?.check?.(`${S.fontWeight} ${style.fontSize} ${style.fontFamily}`) ? S.fontWeight : style.fontWeight;
    const attrs = {
      y: h / 2,
      'dominant-baseline': 'central',
      'font-family': style.fontFamily,
      'font-size': style.fontSize,
      'font-weight': weight,
      'letter-spacing': style.letterSpacing === 'normal' ? 0 : style.letterSpacing,
    };

    // The real word stays for readers and search engines; the drawing is what is seen.
    const hidden = document.createElement('span');
    hidden.className = 'sr-only';
    hidden.textContent = text;
    span.replaceChildren(hidden, svg);
    span.classList.add('tt-word');

    // One invisible copy of the word gives every letter its exact place; both drawn layers then put each
    // letter at that same place, so the dashed outline and the filled glyph sit precisely on each other.
    const ref = svgEl('text', { ...attrs, x: 0, class: 'tt-ref', fill: 'none', stroke: 'none' });
    ref.textContent = text;
    svg.append(ref);
    const chars = [...text];
    const positions = chars.map((_, i) => {
      try {
        return ref.getStartPositionOfChar(i).x;
      } catch {
        return 0;
      }
    });
    const drawnWidth = ref.getComputedTextLength() || w;
    svg.setAttribute('viewBox', `0 0 ${drawnWidth} ${h}`);
    svg.setAttribute('preserveAspectRatio', 'xMinYMid meet');

    const letterTexts = (cls) =>
      (S.reveal === 'letter' ? chars : [text]).map((unit, k) => {
        const el = svgEl('text', { ...attrs, x: S.reveal === 'letter' ? positions[k] : 0, class: cls });
        el.style.setProperty('--k', String(k));
        el.textContent = unit;
        return el;
      });
    // Layer 1: the dashed strokes, revealed letter by letter.
    const strokes = svgEl('g', { class: 'tt-stroke', fill: 'none', stroke: S.color, 'stroke-width': S.strokeWidth, 'stroke-linejoin': 'round' });
    if (S.lineStyle === 'dashed') strokes.setAttribute('stroke-dasharray', `${S.dashLength} ${S.dashGap}`);
    const letters = letterTexts('tt-l');
    strokes.append(...letters);
    // Layer 2: the filled word, swept in from the left once the strokes are drawn.
    const fill = svgEl('g', { class: `tt-fill${S.sweep ? ' is-sweep' : ''}`, fill: `url(#${id})` });
    fill.style.setProperty('--tt-letters', String(letters.length));
    fill.append(...letterTexts('tt-f'));
    svg.append(strokes, fill);

    // Specks: small glints scattered around the word, each with its own rhythm.
    const specks = svgEl('g', { class: 'tt-specks', fill: S.accentColor });
    for (let n = 0; n < S.specks; n++) {
      const r = seed(index * 97 + n);
      const c = svgEl('circle', { cx: (-0.05 + 1.1 * seed(n * 3 + 1 + index)) * drawnWidth, cy: (-0.15 + 1.3 * seed(n * 7 + 2 + index)) * h, r: 0.8 + 1.4 * r });
      c.style.setProperty('--t', `${2.4 + 3 * seed(n * 11 + 3 + index)}s`);
      c.style.setProperty('--d', `${(1.2 + 2.6 * seed(n * 13 + 5 + index)).toFixed(2)}s`);
      specks.append(c);
    }
    svg.append(specks);
    return { span, svg, letters, centres: [] };
  }

  // Where each letter sits on the page, for the pointer glow (measured once per layout).
  function measure(d) {
    d.centres = d.letters.map((el) => {
      const b = el.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    });
  }

  function glow(x, y) {
    for (const d of drawings) {
      d.centres.forEach((c, i) => {
        const dist = Math.hypot(c.x - x, c.y - y);
        const near = Math.max(0, 1 - dist / S.reach);
        d.letters[i].style.setProperty('--g', near ? Math.pow(near, 1.6 - S.softness).toFixed(3) : '0');
      });
    }
  }

  const start = () => {
    words.forEach((span, i) => drawings.push(build(span, i)));
    requestAnimationFrame(() => drawings.forEach(measure));
    const container = words[0].closest('[data-tech-text]');

    // Layout changes (the heading's size follows the viewport): redraw at the new size, without replaying.
    let timer;
    const redraw = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const done = drawings.length && drawings[0].svg.classList.contains('is-done');
        for (const d of drawings) {
          const text = d.span.querySelector('.sr-only')?.textContent ?? '';
          d.span.textContent = text; // back to plain text, to measure the word's natural box
        }
        drawings.length = 0;
        words.forEach((span, i) => drawings.push(build(span, i)));
        if (done) drawings.forEach((d) => d.svg.classList.add('is-done'));
        requestAnimationFrame(() => drawings.forEach(measure));
      }, 120);
    };
    let first = true;
    new ResizeObserver(() => (first ? (first = false) : redraw())).observe(container.closest('h1') || container);
    addEventListener('scroll', () => drawings.forEach(measure), { passive: true });

    // Once drawn, the strokes stay quiet and only the specks keep glinting.
    const total = (1.6 + 0.07 * Math.max(...drawings.map((d) => d.letters.length)) + 0.3) * 1000 / S.speed + 1100;
    setTimeout(() => drawings.forEach((d) => d.svg.classList.add('is-done')), total);

    if (finePointer) {
      let pending = null;
      addEventListener('pointermove', (e) => {
        pending = e;
        requestAnimationFrame(() => {
          if (!pending) return;
          glow(pending.clientX, pending.clientY);
          pending = null;
        });
      }, { passive: true });
      addEventListener('pointerleave', () => glow(-9999, -9999));
    }
    // Off screen, the specks rest (no idle GPU work while the visitor is further down the page).
    new IntersectionObserver((entries) => entries.forEach((en) => en.target.classList.toggle('is-off', !en.isIntersecting))).observe(container);
  };
  // The words are measured in their real font, so the drawing matches the heading exactly.
  (document.fonts?.ready ?? Promise.resolve()).then(start);
}
