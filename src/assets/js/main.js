// Site-wide interactions. Everything here is progressive enhancement: the pages are complete without it.

import { initForms } from './forms.js';
import { initAnalytics, track } from './analytics.js';
import { paintHeader } from './session.js';
import { keepExclusive } from './roles.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- header and mobile menu ---------- */

const header = $('[data-header]');
const menuBtn = $('[data-menu-btn]');
const nav = $('#site-nav');
const stickyCta = $('[data-sticky-cta]');

// When the sticky button points at a section on this page, it steps aside once that section is on screen.
const stickyHash = stickyCta?.getAttribute('href').startsWith('#') ? stickyCta.getAttribute('href') : null;
const stickyTarget = stickyHash ? $(stickyHash) : null;

function onScroll() {
  header.classList.toggle('is-scrolled', scrollY > 8);
  if (stickyCta) {
    const nearEnd = document.documentElement.scrollHeight - scrollY - innerHeight < 420;
    const box = stickyTarget?.getBoundingClientRect();
    const targetOnScreen = Boolean(box && box.top < innerHeight - 80 && box.bottom > 0);
    stickyCta.classList.toggle('is-visible', scrollY > innerHeight * 0.7 && !nearEnd && !targetOnScreen);
  }
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();

// While the full-screen menu is open, the page behind it is taken out of the tab order.
const behindMenu = $$('main, .site-footer, .sticky-cta');

function setMenu(open) {
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  nav.classList.toggle('is-open', open);
  document.documentElement.classList.toggle('menu-open', open);
  behindMenu.forEach((el) => (el.inert = open));
}
menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
nav.addEventListener('click', (e) => {
  if (e.target.closest('a')) setMenu(false);
});
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    menuBtn.focus();
  }
});
matchMedia('(min-width: 1101px)').addEventListener('change', () => setMenu(false));

/* ---------- scroll reveal ---------- */

const revealer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('in');
      revealer.unobserve(entry.target);
    }
  },
  { rootMargin: '0px 0px -6% 0px', threshold: 0.06 }
);
$$('[data-reveal]').forEach((el) => revealer.observe(el));

/* ---------- click ripple and cursor spotlight ---------- */

document.addEventListener('pointerdown', (e) => {
  if (reduceMotion) return;
  const target = e.target.closest('.btn, .opt, .rail-item, .stage-nav a, .audience-tab, .app');
  if (!target || target.disabled) return;
  const rect = target.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2.2;
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px`;
  target.append(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
});

document.addEventListener('pointermove', (e) => {
  const spot = e.target.closest?.('.spot');
  if (!spot) return;
  const rect = spot.getBoundingClientRect();
  spot.style.setProperty('--mx', `${e.clientX - rect.left}px`);
  spot.style.setProperty('--my', `${e.clientY - rect.top}px`);
});

/* ---------- dialogs and video ---------- */

const videoModal = $('#video-modal');
const videoFrame = $('[data-video-frame]');

function openVideo(url, title) {
  let src;
  try {
    src = new URL(url);
  } catch {
    return;
  }
  if (src.protocol !== 'https:') return;
  // YouTube's privacy-enhanced player sets no cookies until the visitor presses play
  if (src.hostname === 'www.youtube.com' || src.hostname === 'youtube.com') src.hostname = 'www.youtube-nocookie.com';
  src.searchParams.set('autoplay', '1');

  const iframe = document.createElement('iframe');
  iframe.src = src.href;
  iframe.title = title;
  iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  iframe.allowFullscreen = true;
  videoFrame.replaceChildren(iframe);
  videoModal.setAttribute('aria-label', title);
  videoModal.showModal();
}
videoModal.addEventListener('close', () => videoFrame.replaceChildren());

// The "i" on a course card: the course's details, from the <template> on the card, in a dialog. Its title
// becomes the dialog's heading here (a heading in every card's template would break the page's outline).
const courseModal = $('#course-modal');
const courseBody = $('[data-course-modal-body]');
function openCourse(card) {
  const details = $('template[data-course-details]', card);
  if (!details || !courseModal) return;
  const content = details.content.cloneNode(true);
  const title = $('[data-course-heading]', content);
  if (title) {
    const heading = document.createElement('h2');
    heading.className = title.className;
    heading.id = 'course-modal-title';
    heading.append(...title.childNodes);
    title.replaceWith(heading);
  }
  courseBody.replaceChildren(content);
  courseModal.showModal();
}
courseModal?.addEventListener('close', () => courseBody.replaceChildren());

document.addEventListener('click', (e) => {
  const video = e.target.closest('[data-video]');
  if (video) return openVideo(video.dataset.video, video.dataset.videoTitle);

  const info = e.target.closest('[data-course-info]');
  if (info) return openCourse(info.closest('.course-card'));

  const closer = e.target.closest('[data-modal-close]');
  if (closer) return closer.closest('dialog').close();

  // click on the backdrop
  if (e.target instanceof HTMLDialogElement && e.target.open) {
    const r = e.target.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) e.target.close();
  }
});

/* ---------- hero showcase (tabs with gentle auto-advance) ---------- */

function initShowcase(root) {
  const tabs = $$('[role="tab"]', root);
  const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));
  const rail = $('.showcase-rail', root);
  const DURATION = 6000;
  let index = 0;
  let timer = null;
  let auto = !reduceMotion;
  let visible = false;
  let hovering = false;

  root.style.setProperty('--auto', `${DURATION}ms`);

  function select(next, byUser = false) {
    index = (next + tabs.length) % tabs.length;
    tabs.forEach((tab, i) => {
      const on = i === index;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      panels[i].classList.toggle('is-active', on);
      panels[i].inert = !on;
    });
    // replay the one-shot animations (cards rising, bars growing) of the panel that is now showing
    for (const animation of panels[index].getAnimations({ subtree: true })) {
      if (animation.effect?.getComputedTiming().iterations !== Infinity) animation.currentTime = 0;
    }
    // keep the active tab in view when the rail scrolls horizontally (mobile)
    if (rail.scrollWidth > rail.clientWidth) {
      const tab = tabs[index];
      rail.scrollTo({ left: tab.offsetLeft - (rail.clientWidth - tab.offsetWidth) / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
    if (byUser) auto = false;
    schedule();
  }

  function schedule() {
    clearTimeout(timer);
    root.classList.remove('is-auto');
    if (!auto || !visible || hovering) return;
    void root.offsetWidth; // restart the progress animation
    root.classList.add('is-auto');
    timer = setTimeout(() => select(index + 1), DURATION);
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => {
      select(i, true);
      track('service_select', { item: tab.dataset.slug });
    });
    tab.addEventListener('keydown', (e) => {
      const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (e.key === 'Home' || e.key === 'End' || step) {
        e.preventDefault();
        select(e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : index + step, true);
        tabs[index].focus();
      }
    });
  });

  const stage = $('.showcase-stage', root);
  stage.addEventListener('pointerenter', () => { hovering = true; schedule(); });
  stage.addEventListener('pointerleave', () => { hovering = false; schedule(); });
  root.addEventListener('focusin', () => { auto = false; schedule(); });

  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      schedule();
    },
    { threshold: 0.3 }
  ).observe(root);
}
$$('[data-showcase]').forEach(initShowcase);

/* ---------- student journey: highlight the step nearest the middle of the screen ---------- */

$$('[data-journey]').forEach((list) => {
  const steps = $$('.journey-step', list);
  const spy = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        steps.forEach((s) => s.classList.toggle('is-active', s === entry.target));
      }
    },
    { rootMargin: '-46% 0px -46% 0px' }
  );
  steps.forEach((s) => spy.observe(s));
});

/* ---------- service page sub-navigation ---------- */

$$('[data-subnav]').forEach((subnav) => {
  const links = $$('a[href^="#"]', subnav);
  const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const spy = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        links.forEach((a) => a.removeAttribute('aria-current'));
        byId.get(entry.target.id)?.setAttribute('aria-current', 'true');
      }
    },
    { rootMargin: '-40% 0px -55% 0px' }
  );
  byId.forEach((_, id) => {
    const section = document.getElementById(id);
    if (section) spy.observe(section);
  });
});

/* ---------- "What brings you to Walnut?" — audience tabs ---------- */

$$('[data-tabs]').forEach((root) => {
  // Only this selector's own tabs. The university panel contains the service showcase, which has
  // tabs of its own; picking those up here made a click on a service deselect every audience.
  const tabs = $$(':scope > [role="tablist"] > [role="tab"]', root);
  const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));
  const stage = $('[data-tabs-stage]', root);
  const storageKey = root.dataset.remember;
  const FADE_OUT = 180; // matches .audience-panel's transition
  const SETTLE = 800; // height glide + staggered entrance
  let timer = null;

  function showPanel(index, animate) {
    clearTimeout(timer);
    const shown = panels.find((p) => p.classList.contains('is-active'));
    const next = panels[index];
    const swap = () => panels.forEach((p, i) => {
      p.classList.remove('is-leaving', 'is-entering');
      p.classList.toggle('is-active', i === index);
    });

    if (!animate || reduceMotion || !stage || shown === next) {
      swap();
      if (stage) {
        stage.style.height = '';
        stage.classList.remove('is-resizing');
      }
      return;
    }

    // 1. pin the stage at its current height and fade the visible panel out
    const startHeight = stage.offsetHeight;
    stage.style.height = `${startHeight}px`;
    stage.classList.add('is-resizing');
    panels.forEach((p) => p.classList.remove('is-entering'));
    shown.classList.add('is-leaving');

    timer = setTimeout(() => {
      // 2. swap panels, then glide the stage from the old height to the new one while the content rises in
      swap();
      next.classList.add('is-entering');
      stage.style.height = 'auto';
      const endHeight = stage.offsetHeight;
      stage.style.height = `${startHeight}px`;
      void stage.offsetHeight;
      stage.style.height = `${endHeight}px`;

      timer = setTimeout(() => {
        // 3. hand the height back to the layout
        stage.style.height = '';
        stage.classList.remove('is-resizing');
        next.classList.remove('is-entering');
      }, SETTLE);
    }, FADE_OUT);
  }

  function select(index, { focus = false, remember = true, animate = true } = {}) {
    tabs.forEach((tab, i) => {
      const on = i === index;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    });
    showPanel(index, animate);
    if (focus) tabs[index].focus();
    if (remember && storageKey) {
      try {
        localStorage.setItem(storageKey, tabs[index].dataset.tab);
      } catch {}
    }
  }

  // On small screens the panel can sit below the fold: bring the choice and its result into view.
  function revealStage() {
    if (stage && stage.getBoundingClientRect().top > innerHeight - 120) {
      tabs[0].parentElement.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => {
      select(i);
      revealStage();
    });
    tab.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step && e.key !== 'Home' && e.key !== 'End') return;
      e.preventDefault();
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + step + tabs.length) % tabs.length;
      select(next, { focus: true });
    });
  });

  // A link such as /#for-learners opens that path; otherwise restore the visitor's last choice.
  // Either way the first state is set without animation, before the selector becomes visible.
  const fromHash = () => tabs.findIndex((t) => location.hash === `#for-${t.dataset.tab}`);
  let initial = fromHash();
  if (initial < 0 && storageKey) {
    try {
      initial = tabs.findIndex((t) => t.dataset.tab === localStorage.getItem(storageKey));
    } catch {}
  }
  if (initial > 0) select(initial, { remember: false, animate: false });
  document.documentElement.classList.remove('tabs-pending');

  addEventListener('hashchange', () => {
    const i = fromHash();
    if (i < 0) return;
    select(i);
    root.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  });
  if (fromHash() >= 0) root.scrollIntoView({ block: 'start' });
});

/* ---------- application launcher: each choice shows its own action; University cannot be combined ---------- */

$$('[data-launcher]').forEach((root) => {
  const panels = $$('.launcher-panel', root);
  const count = $('[data-launcher-count]', root);
  const prompt = count?.textContent;
  const picked = $('[data-launcher-picked]', root);
  // The home page launcher has two sides (the Education Suite and University); the others have one.
  const sides = $$('.launcher-side', root);
  const scopes = sides.length ? sides : [root];
  const inputs = (scope = root) => $$('input[type="radio"], input[type="checkbox"]', scope);
  const nameOf = (input) => input.closest('label')?.querySelector('.app-name')?.textContent ?? input.value;

  const show = () => {
    const chosen = inputs().filter((input) => input.checked);
    const ids = chosen.map((input) => input.value);
    scopes.forEach((scope) => scope.classList.toggle('has-selection', inputs(scope).some((input) => input.checked)));
    // A panel is for one application, or (data-any) for whatever is chosen on its side.
    panels.forEach((p) => p.classList.toggle('is-active', 'any' in p.dataset ? inputs(p.closest('.launcher-side') ?? root).some((input) => input.checked) : ids.includes(p.dataset.app)));
    if (count) count.textContent = chosen.length ? `${chosen.length} selected` : prompt;
    if (picked) {
      const names = chosen.map(nameOf);
      const had = [...picked.children].map((c) => c.textContent);
      picked.innerHTML = names.map((name) => `<span${had.includes(name) ? ' class="is-old"' : ''}>${name}</span>`).join('');
    }
  };
  root.addEventListener('change', show);
  if (root.hasAttribute('data-exclusive-group')) {
    keepExclusive(root, () => $$('input[type="checkbox"]', root), () => show()); // choosing University clears the others, which fires no event of its own
  }

  /* the switch between the two sides: a sliding thumb, and the sides slide across while the box glides to the new height */
  const tabs = $$('.launcher-tab', root);
  const thumb = $('.launcher-thumb', root);
  const wrap = sides[0]?.parentElement;
  let busy = false;

  const placeThumb = () => {
    const tab = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
    if (!tab || !thumb) return;
    thumb.style.transform = `translateX(${tab.offsetLeft - tab.parentElement.clientLeft}px)`;
    thumb.style.width = `${tab.offsetWidth}px`;
  };

  const switchTo = (index) => {
    const from = sides.findIndex((side) => !side.hidden);
    if (index === from || busy) return;
    tabs.forEach((t, i) => {
      t.setAttribute('aria-selected', String(i === index));
      t.tabIndex = i === index ? 0 : -1;
    });
    tabs[index].focus({ preventScroll: true });
    placeThumb();
    // Whatever was chosen on the side being left is let go, so the two sides never mix.
    inputs(sides[from]).filter((input) => input.checked).forEach((input) => {
      input.checked = false;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const leaving = sides[from];
    const entering = sides[index];
    if (reduceMotion) {
      leaving.hidden = true;
      entering.hidden = false;
      return;
    }
    busy = true;
    const dir = index > from ? 1 : -1;
    const h0 = wrap.offsetHeight;
    wrap.style.height = `${h0}px`;
    wrap.classList.add('is-switching');
    leaving.animate([{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: `translateX(${-28 * dir}px)` }], { duration: 180, easing: 'ease-in', fill: 'forwards' }).finished.then(() => {
      leaving.hidden = true;
      entering.hidden = false;
      entering.getAnimations().forEach((a) => a.cancel()); // an earlier exit left it faded out
      wrap.style.height = 'auto';
      const h1 = wrap.offsetHeight;
      wrap.style.height = `${h0}px`;
      const ease = 'cubic-bezier(.2, .7, .2, 1)';
      entering.animate([{ opacity: 0, transform: `translateX(${36 * dir}px)` }, { opacity: 1, transform: 'translateX(0)' }], { duration: 480, easing: ease });
      wrap.animate([{ height: `${h0}px` }, { height: `${h1}px` }], { duration: 480, easing: ease }).finished.then(() => {
        wrap.style.height = '';
        wrap.classList.remove('is-switching');
        busy = false;
      });
    });
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => switchTo(i));
    tab.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowLeft: -1, Home: -i, End: tabs.length - 1 - i }[e.key];
      if (step === undefined) return;
      e.preventDefault();
      switchTo((i + step + tabs.length) % tabs.length);
    });
  });
  if (thumb) {
    placeThumb();
    document.fonts?.ready.then(placeThumb);
    addEventListener('resize', placeThumb);
    requestAnimationFrame(() => thumb.classList.add('is-ready')); // slides from now on, not into place
  }

  show(); // the browser may restore earlier choices when navigating back
});

/* ---------- course catalogue: kept up to date from Walnut LMS ---------- */

// The course lists — the /academy/ catalogue and the home page's featured courses — are built from a
// snapshot of the Walnut LMS catalogue. Here the live feed is checked once, and each list is redrawn only
// when it differs from what was built, so a course, a price or a free course changed on the LMS shows
// here as it is there. Any failure (the LMS down, a slow answer, a feed with nothing valid) silently
// leaves the built lists as they are.
async function refreshCourses(boxes) {
  const lmsUrl = boxes[0].dataset.lmsUrl || '';
  if (!/^https?:\/\/[^/?#]+$/.test(lmsUrl)) return;
  const { parseFeed, catalogueKey, featured, renderCatalogue, renderCard } = await import('./lms-catalogue.js');
  const res = await fetch(`${lmsUrl}/api/public/courses`, { credentials: 'omit', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
  if (!res.ok) return;
  const { courses, updatedAt } = parseFeed(await res.json());
  if (!courses.length) return;
  const icons = JSON.parse($('#lms-icons').textContent);
  for (const box of boxes) {
    const picks = 'lmsFeatured' in box.dataset;
    const list = picks ? featured(courses, Number(box.dataset.count) || 3) : courses;
    const key = catalogueKey(list);
    if (key === box.dataset.lmsKey) continue;
    const opts = { icon: (name) => icons[name] || '', lmsUrl, root: box.dataset.root || '', sso: box.dataset.lmsSso === '1', level: Number(box.dataset.level) || 3 };
    // A list the visitor has already seen is swapped in place, not hidden and slid in again.
    const shown = box.querySelector('[data-reveal].in') !== null;
    box.innerHTML = picks ? list.map((c) => renderCard(c, { ...opts, reveal: false })).join('') : renderCatalogue(list, opts);
    box.dataset.lmsKey = key;
    box.dataset.updated = updatedAt;
    $$('[data-reveal]', box).forEach((el) => (shown ? el.classList.add('in') : revealer.observe(el)));
  }
}

try {
  const boxes = $$('[data-lms-catalogue], [data-lms-featured]');
  if (boxes.length) refreshCourses(boxes).catch(() => {});
} catch {}

initForms();
initAnalytics();
paintHeader(); // "Sign in" becomes the person's name once they are signed in
