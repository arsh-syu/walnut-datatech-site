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
| Secrets (FTP login, Razorpay keys, Twilio API key, account database login, Onboarding Tool key) — never committed | `.env` (see `.env.example`) |

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

**Coupons.** A coupon belongs to one course (`coupons` in `src/data/courses.mjs`); `SYUSANDEEP` takes the Online Programme Course from ₹999 to ₹499. The checkout applies, removes and re-applies it in the browser for the summary, but the amount is always recomputed by `create-order.php`, so a tampered or wrong code changes nothing. The messages are exact: *Coupon applied successfully! You saved ₹500.* and *Invalid or inapplicable coupon code. Please check and try again.*

## Learning platform (LMS) and certificates

- **LMS Login** — set `links.lms` in `site.config.mjs` (or `LMS_URL` in `.env` for one deploy) to the learning platform's sign-in address. The header and footer then show *LMS Login*, inside the navigation so the mobile menu carries it too. Nothing is shown until the real address is set; no placeholder address is ever published.
- **Verify a certificate** (`verify-certificate/`) — a visitor enters a Certificate ID (`?id=…` on the link printed on a certificate fills it in). `api/verify-certificate.php` asks the LMS, the only record of certificates, and returns just the public fields (holder, course, issue date, status). The LMS endpoint and key are `CERT_VERIFY_URL` / `CERT_VERIFY_KEY` in `.env`, uploaded to the server only. Until they are set the page says verification is not available yet; when the LMS does not answer, the page says so rather than guessing. The endpoint is same-origin JSON only and rate-limited (10 checks per 10 minutes per visitor).

## Phone numbers

Every phone field (checkout, contact and enquiry forms, login and the profile) is one international field: a searchable country picker with the flag and dialling code (India, +91, by default) beside the national number. The number is validated for the chosen country (an Indian mobile is 10 digits starting 6–9) and submitted as one E.164 value, `+919876543210`. Pasting a full number (`+44 7700 900123`, `0091…`) switches the country automatically. The country list — names, ISO 3166-1 alpha-2 and alpha-3 codes, dialling codes — lives in `src/data/countries.mjs`; the build generates `assets/js/countries.js` from it.

## Email

The site sends five emails through Twilio, all from the address in `EMAIL_FROM`:

| When | Who receives it |
|---|---|
| Someone submits a contact form or a solution configuration | The team (`EMAIL_NOTIFY`), with a button to reply to the sender |
| The same | The sender, as an acknowledgement with a copy of what they sent |
| A course payment is verified | The learner, as an enrolment confirmation with the payment reference |
| The same | The team, with the learner's contact details and both references |
| Someone signs in, or verifies their email, with a one-time code | That person, with the code |

- The browser posts an enquiry to `api/enquiry.php`; the server validates it, rate-limits it and sends the emails. The Twilio key never reaches the browser.
- An enquiry only shows "Thank you" if the team's copy was accepted by Twilio. Otherwise the visitor is asked to try again.
- Enrolment emails take the learner's details from the order stored at Razorpay, not from the browser, and are sent once per payment.
- Wording and design live in `src/emails/templates.mjs`. Preview them by running `npm run dev`, submitting a form, and opening `/api/_outbox` — the dev server captures emails instead of sending them unless started with `--send-emails`.
- Twilio must have the sending domain verified before it will deliver mail from it.

## University empanelment requests → Onboarding Tool

The three journeys stay separate. Only the **University** journey — the empanelment request at `/configure/` — is filed in the Walnut Onboarding Tool.

**The request** has seven steps: Goal → Services → Modules → Engagement → Requirements → University → Review. The first four are the solution builder; the last three ask the questions in `src/data/questions.mjs`.

- **Questions are data.** Each has an audience, section, type, options, `required` and optional `showIf` / `hideIf` conditions (for example, the examination questions appear only when *Online Examination Management* is selected, and the proctoring type only after answering *Yes*). Add, reword, reorder or switch one off there and rebuild — no script changes. `assets/js/questions.js` draws and validates them.
- **Submitting.** The browser posts to `api/enquiry.php` with `flow: 'university'`. The server validates everything again, rate-limits, then posts it server-to-server to the Onboarding Tool (`ONBOARDING_API_URL` + `/api/v1/public/university-requests`) with the shared `ONBOARDING_API_KEY`. The key never reaches the browser.
- **Request ID.** The tool stores the request as *Pending review* and returns its reference (`UR-000123`), which the confirmation screen and the acknowledgement email show. An email that already has an open request updates that request and gets the same ID back.
- **Review.** In the tool it appears under **University Requests**. An admin approves, rejects, asks for changes or sends a counter proposal; the tool sends those emails. No account exists until approval; the university then receives a secure link to set a password and continue onboarding. Documents are collected there, not on the website.
- **Status.** `/request-status/` looks a request up by Request ID + registered email (`api/request-status.php` → the tool's `/api/v1/public/university-requests/status`). It shows where the request stands and nothing internal.
- **If the tool is unreachable** the request still reaches the team by email (which says it could not be filed) and the visitor gets a confirmation without a Request ID.

| Website field | Sent as | Stored in the tool as |
|---|---|---|
| University name | `organisation` → `universityName` | `UniversityRequest.universityName` |
| University type | `institutionType` → `universityType` | `universityType` |
| Contact full name | `name` → `contactName` | `contactName` |
| Official email | `email` | `email` (lower-cased; the registered email) |
| Mobile number | `phone` | `phone` |
| Other requirements | `message` | `message` |
| Selected services, modules, engagement | `configuration` (text) | `configuration` |
| Every other answer (website, address, city, state, country, PIN, year, accreditation, designation, alternate number, requirement answers, goal, engagement, services) | `form.<questionId>` | `formData.<questionId>` — shown on the request page under its question |

Leave `ONBOARDING_API_URL` / `ONBOARDING_API_KEY` empty and nothing is filed — University requests reach the team by email only. `scripts/dev-server.mjs` mirrors all of this for local testing; run the Onboarding Tool on `http://localhost:4000` and set those two values in `.env` to try it end to end.

## Walnut accounts (login and dashboard)

Login and the dashboard are pages of this website — `walnutdatatech.com/login/` and `/dashboard/` — in the site's own design. Nothing happens on another domain or subdomain: the pages call this site's own API (`api/account.php`), which answers in one of two ways.

**From the web host's own MySQL database — what production uses.** `api/account-lib.php` keeps accounts, sessions, one-time codes, empanelment requests, course purchases and partner applications in tables named `wa_*`, which it creates on first use. Set `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS` and `ACCOUNT_SECRET` in `.env` (plus the email settings — codes go out by email) and deploy.

- Sign-in is by a one-time code sent by email (the `otp` template). Codes by SMS switch on once `TWILIO_ACCOUNT_SID` and `SMS_FROM` (a Twilio number or Messaging Service) are set; until then the pages offer email only.
- A University request gets its Request ID (`UR-000123`) from the `wa_requests` table and shows under *My requests*; `/request-status/` reads the same table. There is no review screen: the team is emailed each request, and a request's `status` is changed in the database (`PENDING_REVIEW`, `UNDER_REVIEW`, `CHANGES_REQUIRED`, `COUNTER_PROPOSAL`, `APPROVED`, `REJECTED`).
- A partner application is emailed to the team and kept in `wa_agent_applications`; its `status` and `decision_note` are likewise set in the database. Its questions are data: `src/data/agent-questions.mjs`.
- `api/health.php` reports `accounts: true` when the database is configured and reachable.
- The local dev server does not mirror this mode; test it against a PHP server.

**With the Onboarding Tool as well.** When `ONBOARDING_API_URL` and `ONBOARDING_API_KEY` are also set, login and the dashboard stay on this site's database, and University requests are additionally filed in the tool through its API (`POST /api/v1/public/university-requests`, header `X-Walnut-Key`; the key is the tool's `UNIVERSITY_REQUEST_API_KEY`):

- The tool numbers requests. The Request ID a university sees is the one the tool answers with; a request sent again from the same email updates the open one on both sides.
- If the tool cannot be reached, the request is kept here without a Request ID and filed automatically later (on the next request, dashboard visit or status lookup). The team's email says which happened.
- Review status comes back through `POST /api/v1/public/university-requests/status` (`{ reference, email }` → `{ status, updatedAt, … }`), asked at most once a minute per request; the tool's `NEW` is shown as *Submitted*. A tool without that call simply leaves the status as it is.

**By relaying to the Onboarding Tool only.** Without the `DB_*` settings, the login and dashboard calls are passed to the tool instead, as described below.

```
browser → walnutdatatech.com/login, /dashboard
        → walnutdatatech.com/api/account.php      (this site; only sign-in and "my account" calls pass)
        → the account service                     (ONBOARDING_API_URL in .env — never seen by the browser)
```

- **Switching it on.** Set `ONBOARDING_API_URL` and `ONBOARDING_API_KEY` in `.env` and deploy: the deploy script then publishes `login/` and `dashboard/`, adds **Sign in** to the header (it becomes the person's first name once signed in) and the **Create your Walnut account** links. Without those two settings none of it is published. (`accounts: true` in `site.config.mjs`, or `ACCOUNTS=1 node build.mjs`, does the same for a local build.)
- **Login** (`assets/js/login.js`): Email OTP or Mobile OTP into the same account, password as a fallback. A new person is asked "How can we help you?" (University / Learn / Agent) and their name. `?type=university|student|agent` pre-selects the answer.
- **Dashboard** (`assets/js/account.js`): the person's card (name, verified email and mobile) and tabs — *My requests* (empanelment requests and their status), *My courses* (purchases and progress), *Partner application* (the agent form and its status) and *Profile* (name, verify email, add a mobile number, other Walnut services).
- **The relay** (`api/account.php`) forwards only `/auth/…` and `/account/…` calls, refuses other sites, rate-limits, and authenticates to the service with the shared key. The service's session cookie is handed to the browser as this site's own `HttpOnly` cookie.
- **What the browser stores.** Only the person's first name, for the header. The session is that cookie (scripts cannot read it) plus a short-lived token kept in memory (`assets/js/session.js`). A one-time code is never stored.
- **Purchases.** After a payment is verified, `api/verify-payment.php` records the purchase in the service against the email used at checkout, so it appears under *My courses*.
- **`links.portal`** (optional) is the Onboarding Tool's own address, used for two links only: an approved university's "Continue onboarding" and "Forgot password?".
- Local testing: run the Onboarding Tool on `http://localhost:4000`, set the two `.env` values, then `ACCOUNTS=1 node build.mjs` and `npm run dev`.

## Roles and what each may use

One account can be used for more than one thing, with one exception.

| Account | May use | May not |
|---|---|---|
| **University** | The university flow only: questions, programme selection, requirements & builds, onboarding | Be combined with Partner or Learner, apply as a partner, open the partner apps |
| **Partner** | Partner Onboarding, Online Leads, Course Finder — and short courses | Become a university account |
| **Learner** | Short courses — and may become a partner later, on the same account | Become a university account |

- The rule lives in `src/assets/js/roles.js` for the pages (the sign-up step, the dashboard and "Open your application") and in `api/account-lib.php` (`allowed_types`, `university_only`) for the server, which refuses a forbidden combination at sign-up, when services are added, on a partner application and at the app hand-off (`api/sso.php`). Hiding a button is never the only guard.
- **"Open your application"** on the home page (`applicationLauncher` in `src/templates/blocks.mjs`): Online Leads, Partner Onboarding and Course Finder can be chosen singly or together, each with its own button. Choosing University clears and disables the three and explains why.
- **Programme selection** is the first question of the request's *Requirements & builds* step: tick boxes for MBA, MCA, BBA and BCA, and *Other*, which opens a list. The programmes are data — `src/data/programmes.mjs`.

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
