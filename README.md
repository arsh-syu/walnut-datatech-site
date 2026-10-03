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
| Secrets (FTP login, Razorpay keys, Twilio API key, Onboarding Tool key) — never committed | `.env` (see `.env.example`) |

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

## Walnut accounts (login and profile)

Login and the profile are pages of this website — `login/` and `account/` — in the site's own design. The data lives in the account service (the Onboarding Tool): one account for universities, learners and agents.

- **Switching it on.** Set `links.account` in `site.config.mjs` to the service's public address. That builds the two pages, adds **Sign in** to the header (it becomes the person's first name once they are signed in) and the **Create your Walnut account** links under each audience on the home page, on the request confirmation and on the course confirmation. Left empty, none of it is built.
- **Hosting rule.** The service must be on a subdomain of this site (for example `account.walnutdatatech.com`) and list this site in its `CLIENT_ORIGIN` setting. The browser then keeps the session across the two; on an unrelated domain sign-in would not persist.
- **Login** (`assets/js/login.js`): Email OTP or Mobile OTP into the same account, password as a fallback. A new person is asked "How can we help you?" (University / Learn / Agent) and their name. `?type=university|student|agent` pre-selects the answer.
- **Profile** (`assets/js/account.js`): the person's card (name, verified email and mobile) and tabs — *My requests* (empanelment requests and their status), *My courses* (purchases and progress), *Partner application* (the agent form and its status) and *Profile* (name, verify email, add a mobile number, other Walnut services).
- **What is stored in the browser.** Only the person's first name, for the header. The session itself is a cookie the scripts cannot read plus a short-lived token kept in memory (`assets/js/session.js`). A one-time code is never stored anywhere.
- **Purchases.** After a payment is verified, `api/verify-payment.php` records the purchase in the service against the email used at checkout, so it appears under *My courses*.
- The codes, their limits and the SMS / email providers all live in the service. `ACCOUNT_URL=http://localhost:4000 node build.mjs` builds the site against a locally running service.

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
