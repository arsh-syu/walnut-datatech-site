// Conversion tracking with consent.
//
// `track(event, params)` is called at meaningful moments (see the list below). Nothing is sent
// anywhere unless a Google Analytics 4 measurement ID is set in site.config.mjs AND the visitor
// has accepted analytics. Without an ID there is no banner, no script and no tracking at all.
//
// Events — none of them carries personal information:
//   audience_select   { item }                     "What brings you to Walnut?" choice
//   service_select    { item }                     a university service picked in the showcase
//   course_select     { item }                     a course opened on Walnut LMS from its card
//   course_enrol      { item }                     "Enrol" pressed on a course card (enrolment and payment happen on Walnut LMS)
//   enquiry_submit    { topic }                    an enquiry form delivered
//   app_open          { item }                     Agent Onboard / Course Finder / Online Leads opened

const measurementId = (() => {
  try {
    return JSON.parse(document.getElementById('site-config').textContent).analytics?.ga || '';
  } catch {
    return '';
  }
})();

const CONSENT_KEY = 'walnut-consent';
let enabled = false;

function readConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
}

function gtag() {
  window.dataLayer.push(arguments);
}

function enable() {
  if (enabled || !measurementId) return;
  enabled = true;
  window[`ga-disable-${measurementId}`] = false;
  window.dataLayer = window.dataLayer || [];
  gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  gtag('js', new Date());
  gtag('config', measurementId);
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.append(script);
}

function disable() {
  enabled = false;
  if (!measurementId) return;
  window[`ga-disable-${measurementId}`] = true;
  // remove analytics cookies set while consent was granted
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0].trim();
    if (name.startsWith('_ga')) document.cookie = `${name}=; Max-Age=0; path=/; domain=${location.hostname}`;
  }
}

export function track(event, params = {}) {
  // lets integrations and tests observe events without any vendor script
  document.dispatchEvent(new CustomEvent('walnut:track', { detail: { event, params } }));
  if (enabled) gtag('event', event, params);
}

export function initAnalytics() {
  // declarative events: <a data-track="app_open" data-track-item="course-finder">
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-track]');
    if (el) track(el.dataset.track, el.dataset.trackItem ? { item: el.dataset.trackItem } : {});
  });

  const banner = document.querySelector('[data-consent]');
  if (!measurementId || !banner) return;

  const choice = readConsent();
  if (choice === 'granted') enable();
  else if (choice !== 'denied') banner.hidden = false;

  banner.addEventListener('click', (e) => {
    const button = e.target.closest('[data-consent-choice]');
    if (!button) return;
    const value = button.dataset.consentChoice;
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch {}
    value === 'granted' ? enable() : disable();
    banner.hidden = true;
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-consent-open]')) return;
    banner.hidden = false;
    banner.querySelector('button').focus();
  });
}
