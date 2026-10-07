// Data-driven blocks shared across pages: journey steps and the application launchers.
// (Course cards come from src/assets/js/lms-catalogue.js, which the browser shares.)

import config from '../../site.config.mjs';
import { externalApps, educationSuite } from '../data/site.mjs';
import { icon } from './icons.mjs';
import { esc } from './layout.mjs';

// "Explore → Select → Review → Request": the path a visitor of one audience will take.
export function journeySteps(steps) {
  return `<ol class="steps" aria-label="How it works">${steps
    .map((s, i) => `<li><span class="steps-n">${i + 1}</span>${s}</li>`)
    .join('')}</ol>`;
}

// "Open your application" on the home page: a switch between the Walnut Education Suite and University.
// Suite: Online Leads, Partner Onboarding and Course Finder can be chosen singly or together, and one
// button opens the suite. University is the exception: it is a separate flow on its own side of the
// switch, so it can never be chosen with the three (assets/js/roles.js holds the rule, and the account
// server enforces the same one).
export function applicationLauncher(root) {
  const order = ['online-leads', 'agent-onboard', 'course-finder'];
  const apps = order.map((id) => externalApps.find((app) => app.id === id));
  const suite = appLink(root, educationSuite);
  const university = {
    href: config.accounts ? `${root}login/?type=university` : `${root}configure/`,
    action: config.accounts ? 'Continue as a university' : 'Start your university request',
  };
  const steps = ['Sign in as a university', 'Choose services and programmes', 'Send your request and get a Request ID', 'Approval, then onboarding'];
  return `<div class="launcher" data-launcher data-exclusive-group>
    <div class="launcher-switch" role="tablist" aria-label="Open your application as">
      <span class="launcher-thumb" aria-hidden="true"></span>
      <button class="launcher-tab" type="button" role="tab" id="launcher-tab-suite" aria-selected="true" aria-controls="launcher-side-suite">${icon('cap')}<span>Walnut Education Suite</span></button>
      <button class="launcher-tab" type="button" role="tab" id="launcher-tab-university" aria-selected="false" aria-controls="launcher-side-university" tabindex="-1">${icon('building')}<span>University</span></button>
    </div>
    <div class="launcher-sides">
    <div class="launcher-side" id="launcher-side-suite" role="tabpanel" aria-labelledby="launcher-tab-suite">
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
            .join('\n          ')}
        </div>
      </fieldset>
      <div class="launcher-stage" aria-live="polite">
        <p class="launcher-hint">Select one or more applications to continue. They all open in the ${educationSuite.name}.</p>
        <div class="launcher-panel" data-app="${educationSuite.id}" data-any>
          <div>
            <p class="launcher-kicker">Selected</p>
            <p class="launcher-name">${educationSuite.name}</p>
            <p class="launcher-picked" data-launcher-picked></p>
            <p class="launcher-url">${new URL(educationSuite.url).host}</p>
          </div>
          <a class="btn btn-light btn-lg" href="${suite.href}" target="_blank" rel="noopener" data-track="app_open" data-track-item="${educationSuite.id}"><span>${educationSuite.action}</span>${icon(suite.away ? 'external' : 'arrow')}<span class="sr-only"> (opens in a new tab)</span></a>
        </div>
      </div>
    </div>
    <div class="launcher-side" id="launcher-side-university" role="tabpanel" aria-labelledby="launcher-tab-university" hidden>
      <fieldset class="launcher-set">
        <legend><span>Your university application</span><small>One flow, start to finish</small></legend>
        <label class="app app-row">
          <input class="sr-only" type="checkbox" name="application" value="university" data-exclusive>
          <span class="app-ico">${icon('building')}</span>
          <span class="app-row-text"><span class="app-name">University</span><span class="app-desc">Apply for empanelment or continue your university application. Handled on its own, separately from the ${educationSuite.name}.</span></span>
          <span class="check-badge" aria-hidden="true">${icon('check')}</span>
        </label>
        <ol class="launcher-steps" aria-label="How the university application works">
          ${steps.map((step) => `<li><span class="launcher-step-n"></span><span>${step}</span></li>`).join('\n          ')}
        </ol>
      </fieldset>
      <div class="launcher-stage" aria-live="polite">
        <p class="launcher-hint">Select University to continue.</p>
        <div class="launcher-panel" data-app="university">
          <div>
            <p class="launcher-kicker">Selected</p>
            <p class="launcher-name">University</p>
            <p class="launcher-url">Questions, programme selection, requirements and builds, then onboarding.</p>
          </div>
          <a class="btn btn-light btn-lg" href="${university.href}" data-track="journey_open" data-track-item="university"><span>${university.action}</span>${icon('arrow')}</a>
        </div>
      </div>
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
