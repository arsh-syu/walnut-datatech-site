# Launch checklist — status on 2026-10-09

Checked on the `feature/syu-enhancements` build (the React export mirrors every item unless noted).

| Item | Status | Where / what was found |
|---|---|---|
| Privacy policy | ✅ | `/privacy/`, built from `site.config.mjs → legal` (reviewed 8 Oct 2026, support@walnutdatatech.com, registered address). **Open:** `grievanceOfficer` is empty, so the complaints sentence is omitted — add a name when one is appointed. |
| Terms & conditions | ✅ | `/terms/` plus `/refund-policy/` and `/delivery-policy/`; refund terms (7 days, under 25% completed) are filled in, which the deploy requires before live Razorpay keys. |
| Remove frontend secrets | ✅ | Secrets live only in `.env` (local) and `api/config.php` (server, written by the deploy and probed afterwards). A scan of both builds for Razorpay / Twilio / AWS key patterns found nothing; `tests/site.test.mjs` repeats this on every run. |
| Enforce HTTPS | ✅ | `.htaccess`: 301 to https and to the bare domain; `Strict-Transport-Security max-age=15552000` on https. |
| Cookie consent banner | ✅ (dormant) | The banner, a Decline choice and the footer "Cookie settings" link exist and switch on with `GA_MEASUREMENT_ID`. With analytics off (today) the site sets no tracking cookies, only the sign-in session cookie, so no banner is shown. |
| Meta titles / descriptions | ✅ | Every page: unique title, description, canonical, Open Graph and Twitter card; `node check.mjs` verifies all 29 pages. |
| Social preview image | ✅ | `assets/img/og.jpg`, 1200×630, referenced on every page. |
| Favicon | ✅ fixed today | SVG favicon existed; added `favicon.ico` (48px, for Safari and older browsers) and `apple-touch-icon.png` (180px, iOS home screen) to both sites. The React app's placeholder Next.js `favicon.ico` was replaced by the Walnut mark. |
| Sitemap and robots.txt | ✅ | `sitemap.xml` (23 URLs) and `robots.txt` pointing at it; the GitHub Pages mirror is `noindex`. |
| Image alt text | ✅ | No `<img>` without `alt` in either build; decorative SVGs are `aria-hidden`. |
| Image compression | ✅ | All site images are SVG or WebP (largest 78 KB); the two new logos are 11 KB and 24 KB WebP. **Outside our control:** course thumbnails come from the Walnut LMS file store at 1600px (shown at ~300px); ask the LMS team to serve resized images. |
| Page load speed | ✅ | Phone viewport, uncompressed local serving: home 22 requests / 539 KB, load event 286 ms; configure 304 KB; login 231 KB. GSAP is the largest script (115 KB, from jsDelivr with integrity hashes). The host gzips text, so real transfer is roughly a quarter of this. React export: 1,044 KB on the home page (Next.js runtime chunks), same timings. No layout shift (CLS 0). |
| Mobile responsiveness | ✅ | 9 pages × 8 widths (320–1280px): no horizontal overflow; configurator step bar and Back/Continue bar pinned; OTP verified on an emulated iPhone 14. |
| Custom 404 page | ✅ | `/404.html` ("Page not found") with `ErrorDocument 404` in `.htaccess`; 500/503 go to `/500.html`. |
| Broken link fixes | ✅ | Internal links checked by `node check.mjs` (29 pages OK); all 12 external destinations answered 200 today (LMS, Onboarding, Course Finder, Leads, YouTube, fonts excluded). |
| Form validation | ✅ | Required fields with browser validation plus the site's own messages ("Please enter your name", "Please enter a valid email address"), phone numbers validated as E.164; an empty or malformed form sends no request (tested on `/contact/`). The server validates everything again (`api/enquiry.php`). |
| Spam protection | ✅ | Hidden `botcheck` honeypot on every form (silently dropped by the server), rate limit of 8 enquiries per 10 minutes per IP, OTP send limits per address, and the CSP. No CAPTCHA; add Cloudflare Turnstile only if spam appears. |

Also added today: Profi University and MIT Art, Design and Technology University (Pune) in the Clientele section.
