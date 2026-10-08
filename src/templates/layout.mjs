// Page shell (head, header, footer, dialogs) and the UI primitives shared by every page.

import config from '../../site.config.mjs';
import { nav, externalApps } from '../data/site.mjs';
import { areas } from '../data/services.mjs';
import { featuredCourses, lmsOptions } from '../data/lms.mjs';
import { courseLinks } from '../assets/js/lms-catalogue.js';
import { icon } from './icons.mjs';
import { readFileSync } from 'node:fs';
import { inlineScript, contentSecurityPolicy } from '../security.mjs';

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
// Words that rise into place one after another. `from` continues the count of an earlier call,
// so a headline built from two calls still reveals as one sentence.
export function splitWords(text, from = 0) {
  return text
    .split(' ')
    .map((w, i) => `<span class="w"><span style="--i:${from + i}">${w}</span></span>`)
    .join(' ');
}

// The universities Walnut works with: a compact closing section — the heading, one line under it and
// a row of cards (logo beside the name). Used as the last section of the home page and on the about
// page; renders nothing until `clients` in site.config.mjs has entries.
export function clientele(root) {
  if (!config.clients.length) return '';
  return `<section class="section-tight section-mist clientele" id="clients">
  <div class="wrap">
    <header class="clientele-head" data-reveal>
      <h2 class="title">Clientele</h2>
      <p class="lede">The universities we work with.</p>
    </header>
    <ul class="clients">
      ${config.clients
        .map(
          (c, i) => `<li class="client" data-reveal style="--d:${i * 0.08}s">
        <img class="client-logo" src="${root}assets/img/${esc(c.logo)}" alt="${esc(c.name)} logo" width="${c.width}" height="${c.height}" loading="lazy">
        <div><h3>${esc(c.name)}</h3>${c.place ? `<p>${esc(c.place)}</p>` : ''}</div>
      </li>`
        )
        .join('\n      ')}
    </ul>
  </div>
</section>`;
}

export function sectionHead({ eyebrow, title, text, center = false, tag = 'h2' }) {
  return `<header class="section-head${center ? ' center' : ''}" data-reveal>
    ${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ''}
    <${tag} class="title">${title}</${tag}>
    ${text ? `<p class="lede">${text}</p>` : ''}
  </header>`;
}

// A film poster that opens the video dialog. Renders nothing until the video URL is set in site.config.mjs.
export function videoTile({ title, kicker = 'Film', url = '', cls = '' }) {
  if (!url) return '';
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
      <p class="form-note">We use these details only to respond to your enquiry. See our <a href="${root}privacy/">privacy policy</a> and <a href="${root}terms/">terms</a>.</p>
    </div>
    <p class="form-status field-wide" role="status" aria-live="polite"></p>
  </form>
  <div class="form-success" hidden tabindex="-1">
    <span class="success-check" aria-hidden="true">${icon('check')}</span>
    <h2>Thank you. We’ve got it.</h2>
    <p>Our team will be in touch shortly.</p>
  </div>
</div>`;
}

export function ctaBand(root, { title = 'Ready to build your online programme?', text = 'Choose the services you need and see your solution take shape — in a few minutes.', actions } = {}) {
  actions ??= [
    { href: `${root}configure/`, label: 'Build your solution' },
    { href: `${root}contact/`, label: 'Talk to an expert' },
  ];
  return `<section class="cta-band">
    <div class="wrap">
      <div class="cta-card spot" data-reveal>
        ${mark('cta-mark')}
        <h2 class="title">${title}</h2>
        <p class="lede">${text}</p>
        <div class="actions center">
          ${actions.map((a, i) => button({ ...a, variant: i === 0 ? 'light' : 'ghost-light', size: 'lg', arrow: i === 0 })).join('\n          ')}
        </div>
      </div>
    </div>
  </section>`;
}

/* ---------- shell ---------- */

// The Walnut account lives on this site (login/ and dashboard/). Until `accounts` is switched on
// in site.config.mjs none of it is built and nothing links to it.
// `type` is the kind of account to offer first: university | agent | student.
export function accountPrompt(root, type, text = 'Track everything in one place.') {
  if (!config.accounts) return '';
  return `<p class="account-prompt">${text} <a href="${root}login/?type=${type}" data-track="account_create" data-track-item="${type}">Create your Walnut account</a> or <a href="${root}login/" data-track="account_sign_in">sign in</a>.</p>`;
}

function header(root, path) {
  // The script swaps "Sign in" for the person's name (and a link to their profile) once they are signed in.
  const login =
    (config.accounts ? `<a class="nav-login" href="${root}login/" data-account-link data-profile="${root}dashboard/" data-track="account_sign_in">${icon('user')}<span>Sign in</span></a>` : '') +
    (config.links.studentLogin ? `<a class="nav-login" href="${esc(config.links.studentLogin)}" rel="noopener">${icon('user')}<span>Student Login</span></a>` : '');
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
        ${button({ href: `${root}#start`, label: 'Get started', variant: 'primary', size: 'sm' })}
      </div>
    </nav>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu" data-menu-btn>
      <span></span><span></span>
    </button>
  </div>
</header>`;
}

function footer(root) {
  const labels = { youtube: 'YouTube', linkedin: 'LinkedIn', facebook: 'Facebook', instagram: 'Instagram' };
  const social = Object.keys(labels)
    .filter((s) => config.links[s])
    .map((s) => `<a class="social" href="${esc(config.links[s])}" rel="noopener" aria-label="${labels[s]}">${icon(s)}</a>`)
    .join('');
  const newTab = '<span class="sr-only"> (opens in a new tab)</span>';
  return `<footer class="site-footer">
  <div class="wrap">
    <div class="footer-top">
      <div class="footer-brand">
        <img src="${root}assets/img/logo-light.svg" alt="${esc(config.company.legalName)}" width="230" height="44" loading="lazy">
        <p>Technology, learning and partnerships for online education.</p>
        <address class="footer-address">
          ${config.company.address ? `<span>${esc(config.company.address)}</span>` : ''}
          ${config.company.email ? `<a href="mailto:${esc(config.company.email)}">${esc(config.company.email)}</a>` : ''}
        </address>
        ${social ? `<div class="socials">${social}</div>` : ''}
      </div>
      <nav class="footer-col footer-col-wide" aria-label="For universities">
        <h2>For universities</h2>
        <ul>${areas.map((a) => `<li><a href="${root}solutions/${a.slug}/">${a.name}</a></li>`).join('')}
          <li><a href="${root}configure/">Build your solution</a></li>
          <li><a href="${root}request-status/">Check your request</a></li></ul>
      </nav>
      <nav class="footer-col" aria-label="Courses">
        <h2>Courses</h2>
        <ul>
          ${featuredCourses(3).map((c) => `<li><a href="${esc(courseLinks(c, lmsOptions(root)).page)}" rel="noopener">${esc(c.title)} ${icon('external')}<span class="sr-only"> (on Walnut LMS)</span></a></li>`).join('')}
          <li><a href="${root}academy/">All courses</a></li>
        </ul>
      </nav>
      <nav class="footer-col" aria-label="For partners">
        <h2>For partners</h2>
        <ul>
          <li><a href="${root}partners/">Join Walnut</a></li>
          ${externalApps.map((app) => `<li><a href="${esc(app.url)}" target="_blank" rel="noopener">${app.name} ${icon('external')}${newTab}</a></li>`).join('')}
        </ul>
      </nav>
      <nav class="footer-col" aria-label="Company">
        <h2>Company</h2>
        <ul>
          <li><a href="${root}about/">About</a></li>
          ${config.clients.length ? `<li><a href="${root}about/#clients">Clientele</a></li>` : ''}
          ${config.certifications.length ? `<li><a href="${root}about/#certifications">Certifications</a></li>` : ''}
          <li><a href="${root}contact/">Contact</a></li>
          <li><a href="${esc(config.links.selectYourUniversity)}" rel="noopener">Select Your University ${icon('external')}</a></li>
        </ul>
      </nav>
    </div>
    <div class="footer-bottom">
      <p>© ${new Date().getFullYear()} ${esc(config.company.legalName)}. All rights reserved.${config.company.gstin ? ` GSTIN ${esc(config.company.gstin)}` : ''}</p>
      <ul>
        <li><a href="${root}privacy/">Privacy policy</a></li>
        <li><a href="${root}terms/">Terms &amp; conditions</a></li>
        <li><a href="${root}refund-policy/">Cancellation &amp; refunds</a></li>
        <li><a href="${root}delivery-policy/">Shipping &amp; delivery</a></li>
        ${config.analytics.gaMeasurementId ? '<li><button class="footer-link" type="button" data-consent-open>Cookie settings</button></li>' : ''}
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
<dialog class="modal modal-course" id="course-modal" aria-labelledby="course-modal-title">
  <button class="modal-close" type="button" data-modal-close aria-label="Close">${icon('close')}</button>
  <div data-course-modal-body></div>
</dialog>`;
}

// Shown only when analytics is configured, and only until the visitor has chosen.
function consentBanner(root) {
  if (!config.analytics.gaMeasurementId) return '';
  return `<section class="consent" data-consent hidden aria-labelledby="consent-title">
  <div class="consent-text">
    <h2 id="consent-title">Analytics cookies</h2>
    <p>We’d like to use Google Analytics to understand how this site is used. It is off unless you accept. <a href="${root}privacy/#cookies">Learn more</a></p>
  </div>
  <div class="consent-actions">
    <button class="btn btn-ghost btn-sm" type="button" data-consent-choice="denied"><span>Decline</span></button>
    <button class="btn btn-primary btn-sm" type="button" data-consent-choice="granted"><span>Accept</span></button>
  </div>
</section>`;
}

// `redirect` ({ href, canonical }) makes a page that forwards at once to `href` (a moved page); it is never indexed.
// `payments` is for the pay page only: it lets Razorpay's checkout load there (see security.mjs).
export function layout({ title, description, path, root, body, bodyClass = '', jsonLd = [], scripts = [], sticky = null, hasOg = false, noindex = false, redirect = null, payments = false }) {
  const fullTitle = path === '' ? title : `${title} — ${config.company.name}`;
  const url = config.siteUrl ? `${config.siteUrl}/${path}` : '';
  const clientConfig = JSON.stringify({
    api: `${root}api/`,
    analytics: { ga: config.analytics.gaMeasurementId },
    // accounts: this site's relay to the account service, the Onboarding Tool's address (if any)
    // and this site's root, for the links the scripts build
    ...(config.accounts ? { account: `${root}api/account.php?p=`, portal: config.links.portal, root } : {}),
  }).replace(/</g, '\\u003c');
  const v = config.assetVersion ? `?v=${config.assetVersion}` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(config, { payments })}">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
${config.noindex || noindex || redirect ? '<meta name="robots" content="noindex">' : url ? `<link rel="canonical" href="${url}">` : ''}
${redirect ? `<meta http-equiv="refresh" content="0;url=${esc(redirect.href)}">${redirect.canonical ? `\n<link rel="canonical" href="${esc(redirect.canonical)}">` : ''}` : ''}
<meta property="og:type" content="website">
<meta property="og:locale" content="en_IN">
<meta property="og:site_name" content="${esc(config.company.name)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
${url ? `<meta property="og:url" content="${url}">` : ''}
${hasOg && config.siteUrl ? `<meta property="og:image" content="${config.siteUrl}/assets/img/og.jpg">\n<meta name="twitter:card" content="summary_large_image">` : '<meta name="twitter:card" content="summary">'}
<meta name="theme-color" content="#ffffff">
<script>${inlineScript}</script>
<link rel="icon" href="${root}assets/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Lexend:wght@500&display=swap">
<link rel="stylesheet" href="${root}assets/css/site.css${v}">
<link rel="modulepreload" href="${root}assets/js/main.js${v}">
${jsonLd.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body class="${bodyClass}">
<a class="skip" href="#main">Skip to content</a>
${header(root, path)}
<main id="main">
${body}
</main>
${footer(root)}
${sticky ? `<a class="sticky-cta" href="${sticky.href}" data-sticky-cta><span>${sticky.label}</span>${icon('arrow')}</a>` : ''}
${dialogs()}
${consentBanner(root)}
<script type="application/json" id="site-config">${clientConfig}</script>
<script type="module" src="${root}assets/js/main.js${v}"></script>
${scripts.map((s) => `<script type="module" src="${root}assets/js/${s}${v}"></script>`).join('\n')}
</body>
</html>
`;
}
