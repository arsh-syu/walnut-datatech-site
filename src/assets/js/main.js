// Site-wide interactions. Everything here is progressive enhancement: the pages are complete without it.

import { initForms } from './forms.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- header and mobile menu ---------- */

const header = $('[data-header]');
const menuBtn = $('[data-menu-btn]');
const nav = $('#site-nav');
const stickyCta = $('[data-sticky-cta]');

function onScroll() {
  header.classList.toggle('is-scrolled', scrollY > 8);
  if (stickyCta) {
    const nearEnd = document.documentElement.scrollHeight - scrollY - innerHeight < 420;
    stickyCta.classList.toggle('is-visible', scrollY > innerHeight * 0.7 && !nearEnd);
  }
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();

function setMenu(open) {
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  nav.classList.toggle('is-open', open);
  document.documentElement.classList.toggle('menu-open', open);
}
menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
nav.addEventListener('click', (e) => {
  if (e.target.closest('a, [data-modal-open]')) setMenu(false);
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
  const target = e.target.closest('.btn, .pick, .opt, .rail-item, .stage-nav a');
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
  videoFrame.replaceChildren();
  if (url) {
    const iframe = document.createElement('iframe');
    iframe.src = url + (url.includes('?') ? '&' : '?') + 'autoplay=1';
    iframe.title = title;
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    videoFrame.append(iframe);
  } else {
    const soon = document.createElement('div');
    soon.className = 'video-soon';
    const mark = $('.mark')?.cloneNode(true);
    if (mark) {
      mark.setAttribute('class', 'mark');
      soon.append(mark);
    }
    const h = document.createElement('h2');
    h.textContent = title;
    const p = document.createElement('p');
    p.textContent = 'This film is in production and will be available here soon.';
    soon.append(h, p);
    videoFrame.append(soon);
  }
  videoModal.setAttribute('aria-label', title);
  videoModal.showModal();
}
videoModal.addEventListener('close', () => videoFrame.replaceChildren());

document.addEventListener('click', (e) => {
  const video = e.target.closest('[data-video]');
  if (video) return openVideo(video.dataset.video, video.dataset.videoTitle);

  const opener = e.target.closest('[data-modal-open]');
  if (opener) return document.getElementById(opener.dataset.modalOpen)?.showModal();

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
    tab.addEventListener('click', () => select(i, true));
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

/* ---------- selectable tiles feeding an enquiry form (partners, academy) ---------- */

$$('[data-interest-scope]').forEach((scope) => {
  const picks = $$('[data-interest]', scope);
  const echo = $('[data-interest-echo]', scope);
  const form = $('[data-enquiry]', scope);
  const selected = () => picks.filter((p) => p.getAttribute('aria-pressed') === 'true').map((p) => p.dataset.interest);

  picks.forEach((pick) =>
    pick.addEventListener('click', () => {
      pick.setAttribute('aria-pressed', String(pick.getAttribute('aria-pressed') !== 'true'));
      const names = selected();
      if (echo) {
        echo.hidden = names.length === 0;
        echo.textContent = names.length ? `Selected: ${names.join(' · ')}` : '';
      }
    })
  );
  form?.addEventListener('enquiry:collect', (e) => {
    const names = selected();
    if (names.length) e.detail.extra.interests = names.join(', ');
  });
});

initForms();
