// HoloCard mount points for the course cards.
//
// The requester's HoloCard component (a holographic foil card: tilt, glare, edge sparkle, idle motion)
// is to be integrated here once its source is supplied. Until then this module only prepares the cards:
// every course picture sits in a `.course-holo` mount carrying the agreed settings as data attributes,
// and `mountHoloCards()` hands each mount to the component when it is present (`window.HoloCard`).
// Without the component nothing changes visually — no stand-in hover effect is applied.
//
// Expected component contract (to be confirmed against the real source):
//   window.HoloCard.mount(element, config) → { destroy() }
//   config = { image, alt, card, preset, foilColor, intensity, scale, edgeSparkle, frame, glare, tiltMax,
//              hoverScale, radius, width, idle, shadow, reduced }   (width is the mount's own width)
//
// The picture keeps its 16:9 frame and 14px inset (journeys.css); the component may paint over the
// `.course-media` element inside the mount, and must leave the card's title link, the "i" button,
// Preview and Enrol clickable (they sit above the picture, z-index 2).

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarsePointer = matchMedia('(pointer: coarse)').matches;
const mounted = new WeakMap();

export function holoConfig(el) {
  const d = el.dataset;
  const num = (key, fallback) => (d[key] === undefined || d[key] === '' ? fallback : Number(d[key]));
  return {
    image: d.holoImage || '',
    alt: d.holoAlt || '',
    card: d.holoCard || '',
    preset: d.holoPreset || 'bursts',
    foilColor: d.holoFoil || '#e2e6ec',
    intensity: num('holoIntensity', 0.85),
    scale: num('holoScale', 1),
    edgeSparkle: num('holoEdgeSparkle', 0.8),
    frame: num('holoFrame', 4),
    glare: num('holoGlare', 0.5),
    tiltMax: num('holoTiltMax', 14),
    hoverScale: num('holoHoverScale', 1.04),
    radius: num('holoRadius', 14),
    width: Math.round(el.getBoundingClientRect().width) || undefined, // responsive: the mount's width, never a fixed 320px
    idle: 'holoIdle' in d && !reduceMotion && !coarsePointer, // no idle motion on touch-only devices or for reduced motion
    shadow: 'holoShadow' in d,
    reduced: reduceMotion || coarsePointer, // the component should fall back to a static foil here
  };
}

export function mountHoloCards(root = document) {
  const mounts = [...root.querySelectorAll('[data-holo]')];
  const Holo = window.HoloCard;
  for (const el of mounts) {
    if (mounted.has(el)) continue;
    if (!Holo?.mount) {
      el.dataset.holoState = 'pending'; // the component is not on the page: the card stays as designed
      continue;
    }
    try {
      mounted.set(el, Holo.mount(el, holoConfig(el)));
      el.dataset.holoState = 'mounted';
    } catch (err) {
      el.dataset.holoState = 'failed';
      console.error('HoloCard could not mount', err);
    }
  }
  return mounts.length;
}
