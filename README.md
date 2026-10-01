# Walnut Data Tech — website

Corporate website for Walnut Data Tech: technology and services for university online programmes.

A zero-dependency static site. One data file describes every service; a small Node script turns it into HTML.

## Commands

```bash
npm run build   # render the site into dist/
npm run check   # build, then verify links, anchors, headings and metadata
npm run dev     # build and serve at http://localhost:4173
```

Requires Node 18+. There is nothing to install.

## Where things live

| What | Where |
|---|---|
| Services, modules, engagement models, configurator goals | `src/data/services.mjs` |
| Partner tools, short courses, navigation | `src/data/site.mjs` |
| Site URL, form delivery, social links, video URLs, clients, certifications | `site.config.mjs` |
| Page templates | `src/templates/` |
| Styles (tokens → components → sections) | `src/assets/css/` |
| Interactions, forms, configurator | `src/assets/js/` |

## Common edits

- **Add or reword a service module** — edit the `items` list of that service in `src/data/services.mjs`. The Solutions pages, the configurator and the footer all update from it.
- **Add pricing** — set `revSharePct` and/or `oneTimePrice` on a module: `m('cloud', 'Cloud data centre', '…', { revSharePct: 2, oneTimePrice: 150000 })`. Once every selected module has a value, the configurator shows a running total instead of "In your proposal".
- **Add a video** — paste the embed URL (e.g. `https://www.youtube.com/embed/VIDEO_ID`) into `videos` in `site.config.mjs`. Until then the play button opens a "coming soon" state.
- **Connect the enquiry forms** — set `form.endpoint` in `site.config.mjs` to any JSON form endpoint (Web3Forms, Formspree, FormSubmit, your own API). All four forms, including the configurator, post there.
- **Add clients, certifications, social links, the Student Login URL** — fill the matching fields in `site.config.mjs`.

## Deploying

The output is plain static files in `dist/`, so any static host works: build command `node build.mjs`, output directory `dist`.

`.github/workflows/deploy.yml` publishes to GitHub Pages on every push to `main`. For a custom domain, set `siteUrl` in `site.config.mjs` so canonical URLs, Open Graph tags and the sitemap point at it.
