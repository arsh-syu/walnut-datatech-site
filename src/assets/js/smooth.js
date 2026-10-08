// Smooth scrolling on the home page, adapted from GSAP's ScrollSmoother demo
// (https://gsap.com/docs/v3/Plugins/ScrollSmoother/). Progressive enhancement: without GSAP, with reduced
// motion, or on a page that is not wrapped in #smooth-wrapper, the page scrolls natively as before.
//
// What the demo does, mapped onto this site:
//   ScrollSmoother.create()  → the whole page (header excluded) eases after the scrollbar;
//   data-speed / data-lag    → the hero mark and glow drift at their own pace (effects: true);
//   smoother.scrollTo()      → every in-page link ("Find your path" → #start) glides to its section,
//                              stopping under the fixed header instead of jumping;
//   the pinned shape         → not used: nothing on the home page should stick mid-scroll.

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wrapper = document.getElementById('smooth-wrapper');
const { gsap, ScrollTrigger, ScrollSmoother } = window;

if (wrapper && gsap && ScrollTrigger && ScrollSmoother && !reduceMotion) {
  gsap.registerPlugin(ScrollTrigger, ScrollSmoother);
  const finePointer = matchMedia('(pointer: fine)').matches;
  const headerHeight = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 64;

  // The header leaves the flow (it is fixed while the content is transformed), so the content starts
  // under it; both change in the same frame, so nothing jumps.
  document.documentElement.classList.add('smooth');

  // create the smooth scroller FIRST (before any ScrollTrigger of our own)
  const smoother = ScrollSmoother.create({
    smooth: 1.4, // seconds the content takes to catch up with the scrollbar (the demo uses 2)
    effects: true, // honours data-speed and data-lag on elements inside #smooth-content
    smoothTouch: 0, // phones and tablets keep native scrolling; only the parallax applies there
    normalizeScroll: finePointer, // one unified scroll input on desktop; left alone on touch devices
    ignoreMobileResize: true,
  });
  window.walnutSmoother = smoother;

  // In-page links glide to their section and stop just under the header (the demo's "Jump to shape").
  const offset = () => `top top+=${headerHeight() + 24}`;
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link || e.defaultPrevented || link.hasAttribute('data-tabs-link')) return;
    const id = link.getAttribute('href').slice(1);
    const target = id && document.getElementById(id);
    if (!target || !wrapper.contains(target)) return;
    e.preventDefault();
    smoother.scrollTo(target, true, offset());
    history.pushState(null, '', `#${id}`);
  });
  // A page opened at #section lands on that section once the layout is measured.
  const landing = location.hash.length > 1 && document.getElementById(location.hash.slice(1));
  if (landing && wrapper.contains(landing)) requestAnimationFrame(() => smoother.scrollTo(landing, false, offset()));

  // Pictures and fonts arriving later change the page's height: measure again when everything is in.
  addEventListener('load', () => ScrollTrigger.refresh());
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  // The audience tabs swap panels of different heights; the live course catalogue redraws cards.
  new MutationObserver(() => ScrollTrigger.refresh()).observe(wrapper, { childList: true, subtree: true, attributeFilter: ['class', 'hidden'] });
}
