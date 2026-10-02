# Walnut Data Tech — website

Website for Walnut Data Tech: technology and services for universities, short courses for learners, and applications for education agents.

A zero-dependency static site plus a small PHP payment API. Data files describe every service, course and application; a Node script turns them into HTML.

## Commands

```bash
npm run build    # render the site into dist/
npm run check    # build, then verify links, anchors, headings and metadata
npm run dev      # build and serve at http://localhost:4173 (with a local mirror of the payment API)
npm run deploy   # build, upload to the web host over FTP, and verify the live site
```

Requires Node 18+. There is nothing to install.

## Where things live

| What | Where |
|---|---|
| University services, modules, engagement models, configurator goals | `src/data/services.mjs` |
| Courses, prices and coupons | `src/data/courses.mjs` |
| Audiences ("What brings you to Walnut?"), partner applications, navigation | `src/data/site.mjs` |
| Site URL, form delivery, social links, video URLs, clients, certifications | `site.config.mjs` |
| Page templates and shared blocks | `src/templates/` |
| Styles (tokens → components → sections → journeys) | `src/assets/css/` |
| Interactions, forms, configurator, checkout | `src/assets/js/` |
| Payment API (runs on the web host) | `src/api/` |
| Deploy script, local dev server | `scripts/` |
| Secrets (FTP login, Razorpay keys) — never committed | `.env` (see `.env.example`) |

## Common edits

- **Change a course price or coupon** — edit `price` or `coupons` in `src/data/courses.mjs`, then deploy. The course pages, the checkout and the server-side price list all come from that one file. A coupon only applies to the course it is listed under.
- **Add a course** — add an entry to `courses` in the same file; its page, card and checkout are generated.
- **Add or change a partner application** — edit `externalApps` in `src/data/site.mjs`.
- **Add or reword a university service module** — edit that service's `items` in `src/data/services.mjs`.
- **Add a video, client logos, certifications, social links, the Student Login URL** — fill the matching fields in `site.config.mjs`.

## Payments

Checkout uses Razorpay. The browser never decides the price:

1. `api/create-order.php` computes the amount from the course catalogue (and coupon, if valid for that course) and creates a Razorpay order.
2. Razorpay Checkout collects the payment.
3. `api/verify-payment.php` checks Razorpay's signature before the enrolment is confirmed.

The Razorpay **key secret lives only on the server** in `api/config.php`, which the deploy script writes from `.env`. It is not in this repository and never reaches the browser. To go live, replace the test keys in `.env` with live keys and deploy again.

`scripts/dev-server.mjs` mirrors the PHP endpoints in Node for local testing and refuses anything but Razorpay **test** keys. Keep the two in step when changing payment rules.

## Deploying

Production is https://walnutdatatech.com, published with `npm run deploy` (settings in `.env`). The script uploads the site, confirms the server executes PHP, and only then uploads the Razorpay keys.

Pushing to `main` also publishes a preview mirror to GitHub Pages. The mirror is hidden from search engines and has no payment API, so checkout shows "payment isn't available" there.
