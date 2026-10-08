// The Walnut account on the website: the login page and the signed-in dashboard.
// Both are shells — assets/js/login.js and account.js draw them through this site's own API
// (api/account.php). They are only built when `accounts` is switched on in site.config.mjs.

import { splitWords } from './layout.mjs';
import { icon } from './icons.mjs';

export function login() {
  const body = `
<section class="page-hero page-hero-form login">
  <div class="wrap form-section">
    <div>
      <p class="eyebrow hero-fade">Your Walnut account</p>
      <h1 class="display display-md">${splitWords('Welcome to Walnut.')}</h1>
      <p class="lede hero-fade" style="--d:.4s">Login to your Walnut account to continue. One account for universities, learners and partners.</p>
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
    description: 'Login to your Walnut account with a one-time code sent to your email or mobile number — for universities, learners and partners.',
    body,
    bodyClass: 'page-contact',
    smooth: false, // sign-in and the dashboard: forms, one-time codes, native scrolling
    scripts: ['login.js'],
  };
}

export function dashboard() {
  const body = `
<section class="acct">
  <div class="wrap">
    <h1 class="sr-only">My Walnut dashboard</h1>
    <div id="account" aria-live="polite"><p class="acct-loading">Loading your dashboard…</p></div>
    <noscript><p class="form-status is-error">Your account needs JavaScript. Please enable it and reload this page.</p></noscript>
  </div>
</section>
`;
  return {
    title: 'My dashboard',
    description: 'Your Walnut dashboard: your profile, requests, courses and applications.',
    body,
    bodyClass: 'page-account',
    smooth: false, // sign-in and the dashboard: forms, one-time codes, native scrolling
    scripts: ['account.js'],
    noindex: true,
  };
}
