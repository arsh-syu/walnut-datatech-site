# Going live with the SYU enhancements (branch `feature/syu-enhancements`, PR #1)

Written 2026-10-09 for whoever runs the deploy. The site is published with `node scripts/deploy.mjs` from a
folder whose `.env` holds the production values (the deploy script reads `.env` only; nothing is typed in).
Claude never runs this deploy and never sees the values.

```bash
cd ~/code/walnut-datatech-site && ~/.local/node/bin/node scripts/deploy.mjs --yes
```

The script uploads the API first, waits (up to 15 minutes) until `api/health.php` reports this deploy's
`config_id`, checks every setting, and only then publishes the pages that depend on them. Afterwards read
https://walnutdatatech.com/api/health.php: `accounts`, `email`, `sms`, `onboarding`, `lms`, `lms_sso`, `pay`,
`pay_apps`, `mode` and `pay_webhook_last` say what is switched on.

## 1. Settings in `.env` — what is new or changed since the live build

| Setting | Needed for | Status |
|---|---|---|
| `FTP_HOST`, `FTP_USER`, `FTP_PASS`, `FTP_DIR`, `SITE_URL` | the upload itself | unchanged, required |
| `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`, `ACCOUNT_SECRET` | accounts in the host's MySQL (login, dashboard, OTP) | unchanged; the `wa_*` tables are created/extended on first use |
| `TWILIO_API_KEY`, `TWILIO_API_SECRET`, `EMAIL_FROM`, `EMAIL_FROM_NAME`, `EMAIL_NOTIFY` | enquiry mail and the email OTP | unchanged, required for accounts |
| `TWILIO_ACCOUNT_SID`, `SMS_FROM` | mobile-number OTP | unchanged, optional |
| `ONBOARDING_API_URL`, `ONBOARDING_API_KEY` | University requests filed in the Onboarding Tool | unchanged — **but see §2c** |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | the payment gateway | unchanged; live keys need `legal.refundPolicy` (set) |
| `RAZORPAY_WEBHOOK_SECRET` | **new** — `/api/pay/webhook.php` | create the webhook in the Razorpay dashboard for `https://walnutdatatech.com/api/pay/webhook.php` with events payment.authorized, payment.captured, payment.failed, order.paid, refund.processed, refund.failed; paste its secret |
| `WALNUT_PAY_SECRET_WALNUT_LMS` | **new** — lets Walnut LMS take payments through this site | generate (`openssl rand -hex 32`), give the same value to the LMS team |
| `WALNUT_SSO_SECRET_LMS` | **new** — "Enrol"/"Continue" sign the learner in to Walnut LMS | same value as the LMS's `WALNUT_SSO_SECRET`; empty = Enrol opens the LMS and the learner signs in there |
| `WALNUT_LMS_URL` | **new** — the LMS address used by links, the catalogue snapshot and redirects | default `https://walnut-lms.vercel.app`; https origin, no path |
| `WALNUT_LMS_INTEGRATION_SECRET` | **new** — course progress on the dashboard | same value as `WALNUT_INTEGRATION_SECRET` in the LMS's Vercel settings; empty = dashboard shows purchases only |
| `WALNUT_LMS_BACKFILL` | **new** — hands past website purchases to the LMS once | leave empty until the LMS team confirms they receive them |
| `CERT_VERIFY_URL`, `CERT_VERIFY_KEY` | **new** — `/verify-certificate/` asks the LMS | leave empty until the LMS provides the endpoint and key; the page then says verification is not available yet |
| `WALNUT_SSO_SECRET_ONBOARDING`, `…_COURSE_FINDER`, `…_LEADS` | sign-in hand-over to the other Walnut apps | unchanged |
| `GA_MEASUREMENT_ID` | analytics (consent-gated) | unchanged, optional |

Keys the deploy writes to the server only (`api/config.php`): every secret above. The deploy probes that
file afterwards and deletes it again if the host ever serves it as text.

## 2. Flows that change on the live site

a. **Courses are sold on Walnut LMS, not here.** `/academy/` shows the LMS catalogue (a snapshot taken at build
   time, refreshed live in the browser); every course card and Enrol button goes to the LMS; the old website
   checkout is gone and the old course URLs redirect (301, `.htaccess`). The SYUSANDEEP coupon (₹999 → ₹499)
   must be created on the LMS; the site no longer applies coupons.
b. **Payment gateway** `/pay/` + `api/pay/*` — Walnut products (the LMS first) send buyers here to pay with
   Razorpay; the ledger is the account database. On only when the Razorpay keys, the webhook secret and at
   least one app secret are set. Refunds through `api/pay/refund.php` (the LMS is told to withdraw the course).
c. **University request form** sends the country as an ISO alpha-3 code (IND) and phone numbers as E.164
   (+91…). The live Onboarding Tool must run the matching version (its country/phone change from this work)
   before this site goes live, or set `ONBOARDING_API_URL` empty for the moment (requests then reach the team
   by email only).
d. **Accounts**: same login and dashboard; the profile phone is an international field (E.164). Existing
   accounts keep their stored numbers; nothing to migrate. OTP entry is the new animated CodeSlots.
e. **Certificate verification** page exists but says "not available yet" until §1's CERT values are set.
f. **Dashboard course progress** appears only when the LMS integration secret matches on both sides.
g. **Content-Security-Policy** (`src/security.mjs`): home and content pages may load GSAP from
   `cdn.jsdelivr.net` (pinned, integrity-hashed); `/academy/` may call the LMS origin and show images from its
   file store; Razorpay is allowed on `/pay/` only. If the host adds its own CSP header, it must not be
   stricter than this.
h. **Header**: unchanged ("Sign in" + "Get started"); the LMS link is in the footer.

## 3. After the deploy — five-minute smoke test (phone and desktop)

1. Home: the hero logo spins on hover; "online education." draws itself; no sideways panning on a phone.
2. `/academy/`: cards show LMS prices; Enrol opens the course on the LMS (signed in when `lms_sso` is on).
3. `/login/` on a phone: Existing user → email → the six slots rise in → a wrong code shakes red → the real
   code turns green → dashboard. (Screenshots of this on an emulated iPhone 14: `docs/qa/otp-mobile/`.)
4. `/configure/`: file a test University request and confirm the Request ID appears in the Onboarding Tool.
5. `/verify-certificate/`: shows the "not available yet" notice until the LMS endpoint is configured.
6. `/pay/` (only when `pay` is on in health): a ₹1 test with Razorpay in TEST mode before switching to live keys.

## 4. The two local folders

`~/code/walnut-datatech-site` (local `.env` = test settings) and the "rohit" copy
`~/code/untitled folder/walnut-datatech-site-rohit` (`.env` = production). Both track the same GitHub repo.
Deploy from the rohit copy, after bringing it to this branch:

```bash
cd "$HOME/code/untitled folder/walnut-datatech-site-rohit" && git fetch origin && git checkout -B feature/syu-enhancements origin/feature/syu-enhancements
```

(or merge the PR and `git pull origin main` there). The GitHub Pages mirror redeploys on every push to `main`.
