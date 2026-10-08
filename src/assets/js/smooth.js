// Smooth scrolling, adapted from GSAP's ScrollSmoother demo (https://gsap.com/docs/v3/Plugins/ScrollSmoother/).
// Every content page is wrapped in #smooth-wrapper/#smooth-content by the layout; the app-like pages
// (the solution configurator, sign-in, the dashboard, the pay page) keep native scrolling, and so does
// everyone who asks for reduced motion or arrives without the GSAP scripts.
//
// The demo, mapped onto this site:
//   ScrollSmoother.create()  → the page (header excluded) eases after the scrollbar;
//   data-speed / data-lag    → the hero mark and glow drift at their own pace (effects: true);
//   smoother.scrollTo()      → every in-page link glides to its section and stops under the fixed header;
//   ScrollTrigger pin        → the page's sticky panels (a service page's sub-navigation, its stage headings,
//                              the journey intro) are pinned at the same offsets, because position: sticky
//                              cannot work inside a container that is moved with a transform.

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wrapper = document.getElementById('smooth-wrapper');
const content = document.getElementById('smooth-content');
const { gsap, ScrollTrigger, ScrollSmoother } = window;

if (wrapper && content && gsap && ScrollTrigger && ScrollSmoother && !reduceMotion) {
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

  // Sticky panels become pins with the same geometry: stuck at their CSS `top` while their parent is on
  // screen, released when the parent's bottom reaches theirs. (Only top-stuck elements; the configurator's
  // bottom bar lives on a page that is not smoothed.)
  const sticky = [...content.querySelectorAll('nav, aside, header, div, section')].filter((el) => {
    const cs = getComputedStyle(el);
    return cs.position === 'sticky' && cs.bottom === 'auto';
  });
  const underHeader = []; // bars pinned right under the header (a service page's sub-navigation): landings clear them
  for (const el of sticky) {
    const top = parseFloat(getComputedStyle(el).top) || 0;
    if (top <= headerHeight() + 1) underHeader.push(el);
    el.style.position = 'relative'; // sticky would never engage here; relative keeps its ::before in place
    ScrollTrigger.create({
      trigger: el,
      pin: true,
      pinSpacing: false,
      start: () => `top top+=${top}`,
      endTrigger: el.parentElement,
      end: () => `bottom top+=${top + el.offsetHeight}`,
    });
  }

  // In-page links glide to their section and stop just under the header (the demo's "Jump to shape").
  const offset = () => `top top+=${headerHeight() + underHeader.reduce((h, el) => h + el.offsetHeight, 0) + 24}`;
  const scrollTo = (target, smooth = true) => smoother.scrollTo(target, smooth, offset());
  window.walnutScrollTo = scrollTo;
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link || e.defaultPrevented || link.hasAttribute('data-tabs-link')) return;
    const id = link.getAttribute('href').slice(1);
    const target = id && document.getElementById(id);
    if (!target || !wrapper.contains(target)) return;
    e.preventDefault();
    scrollTo(target);
    history.pushState(null, '', `#${id}`);
  });
  // A page opened at #section lands on that section once the layout is measured.
  const landing = location.hash.length > 1 && document.getElementById(location.hash.slice(1));
  if (landing && wrapper.contains(landing)) requestAnimationFrame(() => scrollTo(landing, false));

  // Pictures and fonts arriving later change the page's height: measure again when everything is in.
  addEventListener('load', () => ScrollTrigger.refresh());
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  // Tabs swap panels of different heights; the live course catalogue redraws cards; forms show their success
  // state. Those change the page's height, so the pins are measured again. Reveal classes, step highlights
  // and the like change every few pixels of scrolling and are ignored: refreshing on them would be costly
  // and would disturb a scroll in flight.
  let refresh;
  const layoutChange = (m) => m.type === 'childList' || m.attributeName === 'hidden' || (m.attributeName === 'class' && (m.target.matches('[role="tabpanel"], .launcher-panel, .form-wrap, form, .form-success') || m.target.hidden));
  new MutationObserver((mutations) => {
    if (!mutations.some(layoutChange)) return;
    clearTimeout(refresh);
    refresh = setTimeout(() => ScrollTrigger.refresh(), 150);
  }).observe(content, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
}
