// Data-driven blocks shared across pages: journey steps, course pricing and cards, the application launcher.

import config from '../../site.config.mjs';
import { externalApps } from '../data/site.mjs';
import { inr, offerOf } from '../data/courses.mjs';
import { icon } from './icons.mjs';
import { esc } from './layout.mjs';

// "Explore → Select → Review → Request": the path a visitor of one audience will take.
export function journeySteps(steps) {
  return `<ol class="steps" aria-label="How it works">${steps
    .map((s, i) => `<li><span class="steps-n">${i + 1}</span>${s}</li>`)
    .join('')}</ol>`;
}

// Price → coupon → what you pay. One unambiguous reading, also for screen readers.
export function priceFlow(course) {
  const offer = offerOf(course);
  if (!offer) {
    return `<div class="price-flow price-flow-single" role="group" aria-label="Price ${inr(course.price)}. No discount currently.">
      <div class="price-step price-step-final"><span class="price-label">Price</span><span class="price-value">${inr(course.price)}</span></div>
      <span class="price-note">No discount currently</span>
    </div>`;
  }
  return `<div class="price-flow" role="group" aria-label="Original price ${inr(course.price)}. Apply coupon ${offer.code} and pay ${inr(offer.finalPrice)}.">
    <div class="price-step"><span class="price-label">Original price</span><span class="price-value">${inr(course.price)}</span></div>
    <span class="price-arrow" aria-hidden="true">${icon('arrow')}</span>
    <div class="price-step price-step-coupon"><span class="price-label">Apply coupon</span><span class="price-code">${icon('tag')}${offer.code}</span></div>
    <span class="price-arrow" aria-hidden="true">${icon('arrow')}</span>
    <div class="price-step price-step-final"><span class="price-label">You pay</span><span class="price-value">${inr(offer.finalPrice)}</span></div>
  </div>`;
}

// `level` is the heading level that fits where the card sits in the page outline.
// `reveal: false` is for cards inside a container that already animates in (e.g. the audience panels).
export function courseCard(root, course, i = 0, level = 3, reveal = true) {
  return `<article class="course-card spot"${reveal ? ` data-reveal style="--d:${i * 0.1}s"` : ''}>
    <p class="eyebrow">${course.kicker}</p>
    <h${level} class="course-card-title"><a href="${root}academy/${course.slug}/" data-track="course_select" data-track-item="${course.slug}">${course.name}</a></h${level}>
    <p class="course-card-tagline">${course.tagline}</p>
    ${priceFlow(course)}
    <span class="btn btn-primary" aria-hidden="true"><span>View course</span>${icon('arrow')}</span>
  </article>`;
}

// "Open your application" on the home page. Online Leads, Partner Onboarding and Course Finder can be
// chosen singly or together; each chosen one gets its own button. University is the exception: it is a
// separate flow, so choosing it clears and disables the three (assets/js/roles.js holds the rule, and
// the account server enforces the same one).
export function applicationLauncher(root) {
  const order = ['online-leads', 'agent-onboard', 'course-finder'];
  const apps = order.map((id) => externalApps.find((app) => app.id === id));
  const university = {
    href: config.accounts ? `${root}login/?type=university` : `${root}configure/`,
    action: config.accounts ? 'Continue as a university' : 'Start your university request',
  };
  return `<div class="launcher" data-launcher data-exclusive-group>
    <fieldset class="launcher-set">
      <legend><span>Select your applications</span><small data-launcher-count>Choose one or more</small></legend>
      <div class="launcher-options">
        ${apps
          .map(
            (app) => `<label class="app">
          <input class="sr-only" type="checkbox" name="application" value="${app.id}">
          <span class="app-top"><span class="app-ico">${icon(app.icon)}</span><span class="check-badge" aria-hidden="true">${icon('check')}</span></span>
          <span class="app-name">${app.name}</span>
          <span class="app-desc">${app.desc}</span>
        </label>`
          )
          .join('\n        ')}
      </div>
      <p class="launcher-or"><span>or, for universities</span></p>
      <label class="app app-row">
        <input class="sr-only" type="checkbox" name="application" value="university" data-exclusive>
        <span class="app-ico">${icon('building')}</span>
        <span class="app-row-text"><span class="app-name">University</span><span class="app-desc">Apply for empanelment or continue your university application. Handled on its own — it cannot be combined with the applications above.</span></span>
        <span class="check-badge" aria-hidden="true">${icon('check')}</span>
      </label>
      <p class="launcher-note" role="status" data-launcher-note></p>
    </fieldset>
    <div class="launcher-stage" aria-live="polite">
      <p class="launcher-hint">Select one or more applications to continue.</p>
      ${apps
        .map((app) => {
          const { href, away } = appLink(root, app);
          return `<div class="launcher-panel" data-app="${app.id}">
        <div>
          <p class="launcher-kicker">Selected</p>
          <p class="launcher-name">${app.name}</p>
          <p class="launcher-url">${new URL(app.url).host}</p>
        </div>
        <a class="btn btn-light btn-lg" href="${href}" target="_blank" rel="noopener" data-track="app_open" data-track-item="${app.id}"><span>${app.action}</span>${icon(away ? 'external' : 'arrow')}<span class="sr-only"> (opens in a new tab)</span></a>
      </div>`;
        })
        .join('\n      ')}
      <div class="launcher-panel" data-app="university">
        <div>
          <p class="launcher-kicker">Selected</p>
          <p class="launcher-name">University</p>
          <p class="launcher-url">Questions, programme selection, requirements and builds, then onboarding.</p>
        </div>
        <a class="btn btn-light btn-lg" href="${university.href}" data-track="journey_open" data-track-item="university"><span>${university.action}</span>${icon('arrow')}</a>
      </div>
    </div>
  </div>`;
}

// Single-choice selector for Walnut's connected applications. `name` must be unique per page.
// An app that accepts a Walnut sign-in is opened through api/sso.php, which sends anyone not signed in to
// the Walnut login first and then on to the app, so there is no second account anywhere. An app without an
// `sso` id — and every app when accounts are off — stays a plain link to its own address, in a new tab.
const appLink = (root, app) =>
  config.accounts && app.sso ? { href: `${root}api/sso.php?app=${app.sso}`, away: false } : { href: esc(app.url), away: true };

export function appLauncher(root, name) {
  return `<div class="launcher" data-launcher>
    <fieldset class="launcher-set">
      <legend><span>Select an application</span><small>Choose one</small></legend>
      <div class="launcher-options">
        ${externalApps
          .map(
            (app) => `<label class="app">
          <input class="sr-only" type="radio" name="${name}" value="${app.id}">
          <span class="app-top"><span class="app-ico">${icon(app.icon)}</span><span class="check-badge" aria-hidden="true">${icon('check')}</span></span>
          <span class="app-name">${app.name}</span>
          <span class="app-desc">${app.desc}</span>
        </label>`
          )
          .join('\n        ')}
      </div>
    </fieldset>
    <div class="launcher-stage" aria-live="polite">
      <p class="launcher-hint">Select an application to continue.</p>
      ${externalApps
        .map(
          (app) => {
            const { href, away } = appLink(root, app);
            return `<div class="launcher-panel" data-app="${app.id}">
        <div>
          <p class="launcher-kicker">Selected</p>
          <p class="launcher-name">${app.name}</p>
          <p class="launcher-url">${new URL(app.url).host}</p>
        </div>
        <a class="btn btn-light btn-lg" href="${href}"${away ? ' target="_blank" rel="noopener"' : ''} data-track="app_open" data-track-item="${app.id}"><span>${app.action}</span>${icon(away ? 'external' : 'arrow')}${away ? '<span class="sr-only"> (opens in a new tab)</span>' : ''}</a>
      </div>`;
          }
        )
        .join('\n      ')}
    </div>
  </div>`;
}
