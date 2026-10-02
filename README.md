# Walnut Data Tech — website

Website for Walnut Data Tech: technology and services for universities, short courses for learners, and applications for education agents.

A zero-dependency static site plus a small PHP payment API. Data files describe every service, course and application; a Node script turns them into HTML.

## Commands

```bash
npm run build    # render the site into dist/
npm run check    # build, then verify links, outline, SEO metadata, accessibility basics and security policy
npm test         # syntax-check every file, then run the test suite (prices, coupons, payment API rules, no secrets published)
npm run dev      # build and serve at http://localhost:4173 (with a local mirror of the payment API)
npm run deploy   # build, upload to the web host over FTP, and verify the live site
node scripts/test-emails.mjs you@example.com   # send every website email, with sample data, to that address
```

Requires Node 20+. There is nothing to install — no dependencies.

## Where things live

| What | Where |
|---|---|
| University services, modules, engagement models, configurator goals | `src/data/services.mjs` |
| Courses, prices and coupons | `src/data/courses.mjs` |
| Audiences ("What brings you to Walnut?"), partner applications, navigation | `src/data/site.mjs` |
| Site URL, links, videos, clients, certifications, **legal details**, analytics | `site.config.mjs` |
| Email templates (enquiry and enrolment emails) | `src/emails/templates.mjs` |
| Page templates and shared blocks | `src/templates/` |
| Security policy (CSP and response headers) | `src/security.mjs` |
| Styles (tokens → components → sections → journeys) | `src/assets/css/` |
| Interactions, forms, configurator, checkout, analytics | `src/assets/js/` |
| Payment and enquiry API (runs on the web host) | `src/api/` |
| Deploy script, local dev server | `scripts/` |
| Tests | `tests/` |
| Brand kit for re-theming other tools (tokens, component styles, logos, icons, guidelines) | `brand/` — start with `brand/brand-book.html` |
| Secrets (FTP login, Razorpay keys, Twilio API key) — never committed | `.env` (see `.env.example`) |

## Common edits

- **Change a course price or coupon** — edit `price` or `coupons` in `src/data/courses.mjs`, update the matching test in `tests/site.test.mjs`, then deploy. The course pages, the checkout and the server-side price list all come from that one file. A coupon only applies to the course it is listed under.
- **Add a course** — add an entry to `courses`; its page, card and checkout are generated.
- **Add or change a partner application** — edit `externalApps` in `src/data/site.mjs`.
- **Add or reword a university service module** — edit that service's `items` in `src/data/services.mjs`.
- **Videos, client logos, certifications, social links, Student Login** — fill the matching fields in `site.config.mjs`. Anything left empty is simply not shown; there are no "coming soon" placeholders.
- **Legal details** — `legal` in `site.config.mjs` feeds the Privacy Policy and Terms (contact email, registered address, refund policy, course access, retention, governing law). Update `lastUpdated` whenever the wording changes.
- **Analytics** — set `analytics.gaMeasurementId`. Visitors are then asked for consent and Google Analytics runs only after they accept. The event list is at the top of `src/assets/js/analytics.js`.

## Payments

Checkout uses Razorpay. The browser never decides the price:

1. `api/create-order.php` computes the amount from the course catalogue (and coupon, if valid for that course) and creates a Razorpay order.
2. Razorpay Checkout collects the payment.
3. `api/verify-payment.php` checks Razorpay's signature before the enrolment is confirmed.

The Razorpay **key secret lives only on the server** in `api/config.php`, which the deploy script writes from `.env`. It is not in this repository and never reaches the browser. The API accepts same-origin JSON only and is rate-limited per visitor.

To go live: fill `legal.refundPolicy` in `site.config.mjs`, replace the test keys in `.env` with live keys, and deploy. The deploy script refuses live keys while the refund policy is empty.

`scripts/dev-server.mjs` mirrors the PHP endpoints in Node for local testing and refuses anything but Razorpay **test** keys. Keep the two in step when changing payment rules.

## Email

The site sends four emails through Twilio, all from the address in `EMAIL_FROM`:

| When | Who receives it |
|---|---|
| Someone submits a contact form or a solution configuration | The team (`EMAIL_NOTIFY`), with a button to reply to the sender |
| The same | The sender, as an acknowledgement with a copy of what they sent |
| A course payment is verified | The learner, as an enrolment confirmation with the payment reference |
| The same | The team, with the learner's contact details and both references |

- The browser posts an enquiry to `api/enquiry.php`; the server validates it, rate-limits it and sends the emails. The Twilio key never reaches the browser.
- An enquiry only shows "Thank you" if the team's copy was accepted by Twilio. Otherwise the visitor is asked to try again.
- Enrolment emails take the learner's details from the order stored at Razorpay, not from the browser, and are sent once per payment.
- Wording and design live in `src/emails/templates.mjs`. Preview them by running `npm run dev`, submitting a form, and opening `/api/_outbox` — the dev server captures emails instead of sending them unless started with `--send-emails`.
- Twilio must have the sending domain verified before it will deliver mail from it.

## Security

- A Content-Security-Policy on every page allows only this site's own files and the third parties it uses (Razorpay, Google Fonts and video hosts). Adding a new third party means adding it in `src/security.mjs`.
- The web server sends `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and HSTS (generated into `dist/.htaccess`).
- `npm test` fails if a key, secret or FTP setting appears in the published files.

## Deploying

Production is https://walnutdatatech.com, published with `npm run deploy` (settings in `.env`). The script uploads the site, confirms the server executes PHP, and only then uploads the Razorpay and Twilio keys.

### Uploading by hand instead

If you prefer your host's File Manager or an FTP app:

1. Run `npm run build`.
2. Upload **everything inside `dist/`** (including the hidden `.htaccess` files) to the website's root folder.
3. Open `https://your-domain/api/health.php` — it should show `{"ok":true,...}`. If it shows PHP source code instead, stop: PHP is not enabled, and the next step would expose your key.
4. To switch on payments and email, create `api/config.php` on the server with your keys:

   ```php
   <?php
   return [
     'key_id' => 'rzp_test_xxxxxxxxxxxx',
     'key_secret' => 'your-key-secret',
     'twilio_key' => 'SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
     'twilio_secret' => 'your-twilio-api-secret',
     'email_from' => 'support@walnutdatatech.com',
     'email_from_name' => 'Walnut Data Tech',
     'email_notify' => 'support@walnutdatatech.com',
   ];
   ```

   Never put this file in the repository, in `dist/`, or in a zip you share.

Pushing to `main` runs the tests and publishes a preview mirror to GitHub Pages. The mirror is hidden from search engines and has no payment API, so checkout shows "payment isn't available" there.
