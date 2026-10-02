// Security policy shared by the build (CSP <meta> + .htaccess headers) and the local dev server,
// so what is tested locally is what production serves.

import { createHash } from 'node:crypto';

// The only inline script on the site. It marks the document as JS-capable before first paint and,
// if the main script ever fails to load, removes that mark again so no content stays hidden.
export const inlineScript =
  "document.documentElement.classList.add('js');addEventListener('error',function(e){var t=e.target;if(t&&t.tagName==='SCRIPT'&&/assets\\/js\\/main\\.js/.test(t.src))document.documentElement.classList.remove('js')},true)";

const sha256 = (text) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;

// Content-Security-Policy: only this site's own files plus the third parties it actually uses.
export function contentSecurityPolicy(config) {
  const ga = Boolean(config.analytics?.gaMeasurementId);
  const formOrigin = config.form?.endpoint ? new URL(config.form.endpoint).origin : '';
  const policy = {
    'default-src': ["'self'"],
    // Razorpay Checkout loads its own helper scripts (e.g. risk detection) from cdn.razorpay.com
    'script-src': ["'self'", sha256(inlineScript), 'https://*.razorpay.com', ga && 'https://www.googletagmanager.com'],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], // inline is needed for style="" attributes only
    'font-src': ["'self'", 'https://fonts.gstatic.com'],
    'img-src': ["'self'", 'data:', 'https://*.razorpay.com', ga && 'https://www.googletagmanager.com', ga && 'https://*.google-analytics.com'],
    'connect-src': ["'self'", formOrigin, 'https://*.razorpay.com', ga && 'https://www.googletagmanager.com', ga && 'https://*.google-analytics.com', ga && 'https://*.analytics.google.com'],
    'frame-src': ['https://*.razorpay.com', 'https://www.youtube-nocookie.com', 'https://www.youtube.com', 'https://player.vimeo.com'],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'object-src': ["'none'"],
  };
  return Object.entries(policy)
    .map(([directive, sources]) => `${directive} ${sources.filter(Boolean).join(' ')}`)
    .join('; ');
}

// Response headers that cannot be expressed in a <meta> tag.
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
};
