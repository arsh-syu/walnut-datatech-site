// The Walnut account on the website: the login page and the signed-in profile.
// Both are shells — assets/js/login.js and account.js draw them from the account service
// (`links.account` in site.config.mjs), so they are only built when that address is set.

import { splitWords } from './layout.mjs';
import { icon } from './icons.mjs';

export function login() {
  const body = `
<section class="page-hero page-hero-form login">
  <div class="wrap form-section">
    <div>
      <p class="eyebrow hero-fade">Your Walnut account</p>
      <h1 class="display display-md">${splitWords('Welcome to Walnut.')}</h1>
      <p class="lede hero-fade" style="--d:.4s">Login to your Walnut account to continue. One account for universities, learners and agents.</p>
      <ul class="login-points hero-fade" style="--d:.55s">
        <li>${icon('check')}<span>No password needed — we send a one-time code to your email or mobile.</span></li>
        <li>${icon('check')}<span>New to Walnut? The same steps create your account.</span></li>
      </ul>
    </div>
    <div class="form-card hero-fade" style="--d:.3s">
      <div id="login" aria-live="polite"><p class="acct-loading">Loading…</p></div>
      <noscript><p class="form-status is-error">Signing in needs JavaScript. Please enable it and reload this page.</p></noscript>
    </div>
  </div>
</section>
`;
  return {
    title: 'Login',
    description: 'Login to your Walnut account with a one-time code sent to your email or mobile number — for universities, learners and agents.',
    body,
    bodyClass: 'page-contact',
    scripts: ['login.js'],
  };
}

export function account() {
  const body = `
<section class="acct">
  <div class="wrap">
    <h1 class="sr-only">My Walnut account</h1>
    <div id="account" aria-live="polite"><p class="acct-loading">Loading your account…</p></div>
    <noscript><p class="form-status is-error">Your account needs JavaScript. Please enable it and reload this page.</p></noscript>
  </div>
</section>
`;
  return {
    title: 'My account',
    description: 'Your Walnut account: your profile, requests, courses and applications.',
    body,
    bodyClass: 'page-account',
    scripts: ['account.js'],
    noindex: true,
  };
}
