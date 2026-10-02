// Data-driven blocks shared across pages: journey steps, course pricing and cards, the application launcher.

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

export function courseCard(root, course, i = 0) {
  return `<article class="course-card spot" data-reveal style="--d:${i * 0.1}s">
    <p class="eyebrow">${course.kicker}</p>
    <h3><a href="${root}academy/${course.slug}/">${course.name}</a></h3>
    <p class="course-card-tagline">${course.tagline}</p>
    ${priceFlow(course)}
    <span class="btn btn-primary" aria-hidden="true"><span>View course</span>${icon('arrow')}</span>
  </article>`;
}

// Single-choice selector for Walnut's connected applications. `name` must be unique per page.
export function appLauncher(name) {
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
          (app) => `<div class="launcher-panel" data-app="${app.id}">
        <div>
          <p class="launcher-kicker">Selected</p>
          <p class="launcher-name">${app.name}</p>
          <p class="launcher-url">${new URL(app.url).host}</p>
        </div>
        <a class="btn btn-light btn-lg" href="${esc(app.url)}" target="_blank" rel="noopener"><span>${app.action}</span>${icon('external')}<span class="sr-only"> (opens in a new tab)</span></a>
      </div>`
        )
        .join('\n      ')}
    </div>
  </div>`;
}
