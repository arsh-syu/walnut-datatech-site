// Security policy shared by the build (CSP <meta> + .htaccess headers) and the local dev server,
// so what is tested locally is what production serves.

import { createHash } from 'node:crypto';

// The only inline script on the site. Before first paint it:
//   - marks the document as JS-capable (scroll-reveal and tabs depend on it);
//   - if the visitor chose an audience before, holds the audience selector back until the main
//     script has switched to it, so the wrong panel never flashes;
// and if the main script ever fails to load, it removes both marks so no content stays hidden.
export const inlineScript =
  "(function(){var d=document.documentElement;d.classList.add('js');try{if(localStorage.getItem('walnut-audience'))d.classList.add('tabs-pending')}catch(e){}addEventListener('error',function(e){var t=e.target;if(t&&t.tagName==='SCRIPT'&&/assets\\/js\\/main\\.js/.test(t.src))d.classList.remove('js','tabs-pending')},true)})()";

const sha256 = (text) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;

// Content-Security-Policy: only this site's own files plus the third parties it actually uses.
export function contentSecurityPolicy(config) {
  const ga = Boolean(config.analytics?.gaMeasurementId);
  // Walnut LMS: /academy/ reads its public course feed to show the live catalogue.
  const lms = config.lms?.url ? new URL(config.lms.url).origin : null;
  const policy = {
    'default-src': ["'self'"],
    'script-src': ["'self'", sha256(inlineScript), ga && 'https://www.googletagmanager.com'],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], // inline is needed for style="" attributes only
    'font-src': ["'self'", 'https://fonts.gstatic.com'],
    'img-src': ["'self'", 'data:', ga && 'https://www.googletagmanager.com', ga && 'https://*.google-analytics.com'],
    'connect-src': ["'self'", lms, ga && 'https://www.googletagmanager.com', ga && 'https://*.google-analytics.com', ga && 'https://*.analytics.google.com'],
    'frame-src': ['https://www.youtube-nocookie.com', 'https://www.youtube.com', 'https://player.vimeo.com'],
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
