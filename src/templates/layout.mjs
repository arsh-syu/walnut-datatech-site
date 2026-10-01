// Page shell (head, header, footer, dialogs) and the UI primitives shared by every page.

import config from '../../site.config.mjs';
import { nav } from '../data/site.mjs';
import { areas } from '../data/services.mjs';
import { icon } from './icons.mjs';
import { readFileSync } from 'node:fs';

const markPaths = JSON.parse(readFileSync(new URL('../assets/img/mark-paths.json', import.meta.url), 'utf8'));

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ---------- primitives ---------- */

export function button({ href, label, variant = 'primary', size = '', arrow = false, attrs = '' }) {
  const cls = `btn btn-${variant}${size ? ' btn-' + size : ''}`;
  const inner = `<span>${label}</span>${arrow ? icon('arrow') : ''}`;
  return href != null
    ? `<a class="${cls}" href="${href}" ${attrs}>${inner}</a>`
    : `<button class="${cls}" type="button" ${attrs}>${inner}</button>`;
}

// The brand mark, inline so its four arms can animate.
export function mark(cls = '') {
  const arms = ['r', 't', 'b', 'l'];
  return `<svg class="mark ${cls}" viewBox="60 60 180 180" aria-hidden="true" focusable="false">${markPaths
    .map((d, i) => `<path class="arm arm-${arms[i]}" d="${d}"/>`)
    .join('')}</svg>`;
}

// Wraps each word so headlines can rise in word by word (pure CSS, no layout shift).
export function splitWords(text) {
  return text
    .split(' ')
    .map((w, i) => `<span class="w"><span style="--i:${i}">${w}</span></span>`)
    .join(' ');
}

export function sectionHead({ eyebrow, title, text, center = false, tag = 'h2' }) {
  return `<header class="section-head${center ? ' center' : ''}" data-reveal>
    ${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ''}
    <${tag} class="title">${title}</${tag}>
    ${text ? `<p class="lede">${text}</p>` : ''}
  </header>`;
}

// A film poster that opens the video dialog. With no URL yet it opens a "coming soon" state.
export function videoTile({ title, kicker = 'Film', url = '', cls = '' }) {
  return `<button class="video-tile ${cls}" type="button" data-video="${esc(url)}" data-video-title="${esc(title)}" data-reveal>
    <span class="video-tile-bg" aria-hidden="true">${mark()}</span>
    <span class="video-tile-play" aria-hidden="true">${icon('play')}</span>
    <span class="video-tile-text"><span class="video-tile-kicker">${kicker}</span><span class="video-tile-title">${title}</span></span>
    <span class="sr-only">Play video</span>
  </button>`;
}

export function enquiryForm({ id, topic, orgLabel = 'University or organisation', submit = 'Send enquiry', root, messageLabel = 'Anything we should know?' }) {
  const f = (name) => `${id}-${name}`;
  return `<div class="form-wrap" data-form-wrap>
  <form class="form" data-enquiry data-topic="${esc(topic)}" novalidate>
    <div class="field">
      <label for="${f('name')}">Full name</label>
      <input id="${f('name')}" name="name" type="text" autocomplete="name" required>
    </div>
    <div class="field">
      <label for="${f('org')}">${orgLabel}</label>
      <input id="${f('org')}" name="organisation" type="text" autocomplete="organization" required>
    </div>
    <div class="field">
      <label for="${f('email')}">Work email</label>
      <input id="${f('email')}" name="email" type="email" autocomplete="email" inputmode="email" required>
    </div>
    <div class="field">
      <label for="${f('phone')}">Phone <span class="optional">optional</span></label>
      <input id="${f('phone')}" name="phone" type="tel" autocomplete="tel" inputmode="tel">
    </div>
    <div class="field field-wide">
      <label for="${f('message')}">${messageLabel} <span class="optional">optional</span></label>
      <textarea id="${f('message')}" name="message" rows="3"></textarea>
    </div>
    <input class="hp" type="checkbox" name="botcheck" tabindex="-1" autocomplete="off" aria-hidden="true">
    <div class="form-foot field-wide">
      <button class="btn btn-primary btn-lg" type="submit"><span>${submit}</span>${icon('arrow')}</button>
      <p class="form-note">We use these details only to respond to your enquiry. See our <a href="${root}privacy/">privacy policy</a>.</p>
    </div>
    <p class="form-status field-wide" role="status" aria-live="polite"></p>
  </form>
  <div class="form-success" hidden tabindex="-1">
    <span class="success-check" aria-hidden="true">${icon('check')}</span>
    <h3>Thank you. We’ve got it.</h3>
    <p>Our team will be in touch shortly.</p>
  </div>
</div>`;
}

export function ctaBand(root, { title = 'Ready to build your online programme?', text = 'Choose the services you need and see your solution take shape — in a few minutes.' } = {}) {
  return `<section class="cta-band">
    <div class="wrap">
      <div class="cta-card spot" data-reveal>
        ${mark('cta-mark')}
        <h2 class="title">${title}</h2>
        <p class="lede">${text}</p>
        <div class="actions center">
          ${button({ href: `${root}configure/`, label: 'Build your solution', variant: 'light', size: 'lg', arrow: true })}
          ${button({ href: `${root}contact/`, label: 'Talk to an expert', variant: 'ghost-light', size: 'lg' })}
        </div>
      </div>
    </div>
  </section>`;
}

/* ---------- shell ---------- */

function header(root, path) {
  const login = config.links.studentLogin
    ? `<a class="nav-login" href="${esc(config.links.studentLogin)}" rel="noopener">${icon('user')}<span>Student Login</span></a>`
    : `<button class="nav-login" type="button" data-modal-open="login-modal">${icon('user')}<span>Student Login</span></button>`;
  return `<header class="site-header" data-header>
  <div class="wrap header-in">
    <a class="brand" href="${root || './'}" aria-label="Walnut Data Tech — home">
      <img src="${root}assets/img/logo.svg" alt="" width="188" height="36">
    </a>
    <nav class="nav" id="site-nav" aria-label="Primary">
      <ul class="nav-list">
        ${nav.map((n, i) => `<li style="--i:${i}"><a href="${root}${n.href}"${path.startsWith(n.href) ? ' aria-current="page"' : ''}>${n.label}</a></li>`).join('\n        ')}
      </ul>
      <div class="nav-actions">
        ${login}
        ${button({ href: `${root}configure/`, label: 'Build your solution', variant: 'primary', size: 'sm' })}
      </div>
    </nav>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu" data-menu-btn>
      <span></span><span></span>
    </button>
  </div>
</header>`;
}

function footer(root) {
  const social = ['youtube', 'linkedin', 'facebook', 'instagram']
    .map((s) => {
      const label = { youtube: 'YouTube', linkedin: 'LinkedIn', facebook: 'Facebook', instagram: 'Instagram' }[s];
      return config.links[s]
        ? `<a class="social" href="${esc(config.links[s])}" rel="noopener" aria-label="${label}">${icon(s)}</a>`
        : `<span class="social is-pending" title="${label} — link coming soon">${icon(s)}<span class="sr-only">${label} (link coming soon)</span></span>`;
    })
    .join('');
  return `<footer class="site-footer">
  <div class="wrap">
    <div class="footer-top">
      <div class="footer-brand">
        <img src="${root}assets/img/logo-light.svg" alt="${esc(config.company.legalName)}" width="230" height="44" loading="lazy">
        <p>Technology and services that power university online programmes.</p>
        <div class="socials">${social}</div>
      </div>
      <nav class="footer-col footer-col-wide" aria-label="Solutions">
        <h2>Solutions</h2>
        <ul>${areas.map((a) => `<li><a href="${root}solutions/${a.slug}/">${a.name}</a></li>`).join('')}</ul>
      </nav>
      <nav class="footer-col" aria-label="Company">
        <h2>Company</h2>
        <ul>
          <li><a href="${root}about/">About</a></li>
          <li><a href="${root}about/#clients">Our clients</a></li>
          <li><a href="${root}about/#certifications">Certifications</a></li>
          <li><a href="${root}contact/">Contact</a></li>
        </ul>
      </nav>
      <nav class="footer-col" aria-label="More from Walnut">
        <h2>More</h2>
        <ul>
          <li><a href="${root}partners/">Partners</a></li>
          <li><a href="${root}academy/">Academy</a></li>
          <li><a href="${root}configure/">Build your solution</a></li>
          <li><a href="${esc(config.links.selectYourUniversity)}" rel="noopener">Select Your University ${icon('external')}</a></li>
        </ul>
      </nav>
    </div>
    <div class="footer-bottom">
      <p>© ${new Date().getFullYear()} ${esc(config.company.legalName)}. All rights reserved.</p>
      <ul>
        <li><a href="${root}privacy/">Privacy policy</a></li>
        <li><a href="${root}about/#certifications">Certifications</a></li>
      </ul>
    </div>
  </div>
</footer>`;
}

function dialogs() {
  return `<dialog class="modal modal-video" id="video-modal" aria-label="Video">
  <button class="modal-close" type="button" data-modal-close aria-label="Close">${icon('close')}</button>
  <div class="video-frame" data-video-frame></div>
</dialog>
<dialog class="modal modal-note" id="login-modal" aria-labelledby="login-title">
  <button class="modal-close" type="button" data-modal-close aria-label="Close">${icon('close')}</button>
  ${mark('modal-mark')}
  <h2 id="login-title">Student Login</h2>
  <p>The student portal sign-in is being connected. Students can reach their university’s support team in the meantime.</p>
  <button class="btn btn-primary" type="button" data-modal-close><span>Got it</span></button>
</dialog>`;
}

export function layout({ title, description, path, root, body, bodyClass = '', jsonLd = [], scripts = [], stickyCta = true, hasOg = false }) {
  const fullTitle = path === '' ? title : `${title} — ${config.company.name}`;
  const url = config.siteUrl ? `${config.siteUrl}/${path}` : '';
  const { endpoint, accessKey, email } = config.form;
  const clientConfig = JSON.stringify({ form: { endpoint, accessKey, email } }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
${url ? `<link rel="canonical" href="${url}">` : ''}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(config.company.name)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
${url ? `<meta property="og:url" content="${url}">` : ''}
${hasOg && config.siteUrl ? `<meta property="og:image" content="${config.siteUrl}/assets/img/og.jpg">\n<meta name="twitter:card" content="summary_large_image">` : '<meta name="twitter:card" content="summary">'}
<meta name="theme-color" content="#ffffff">
<script>document.documentElement.classList.add('js')</script>
<link rel="icon" href="${root}assets/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Lexend:wght@400;500;600&display=swap">
<link rel="stylesheet" href="${root}assets/css/site.css">
${jsonLd.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body class="${bodyClass}">
<a class="skip" href="#main">Skip to content</a>
${header(root, path)}
<main id="main">
${body}
</main>
${footer(root)}
${stickyCta ? `<a class="sticky-cta" href="${root}configure/" data-sticky-cta><span>Build your solution</span>${icon('arrow')}</a>` : ''}
${dialogs()}
<script type="application/json" id="site-config">${clientConfig}</script>
<script type="module" src="${root}assets/js/main.js"></script>
${scripts.map((s) => `<script type="module" src="${root}assets/js/${s}"></script>`).join('\n')}
</body>
</html>
`;
}
