// Zero-dependency static site build: renders every page from src/data into dist/.
//   node build.mjs            — build once
//   SITE_URL=https://… node build.mjs   — override siteUrl from site.config.mjs (used by CI)

import { rmSync, mkdirSync, writeFileSync, readFileSync, cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from './site.config.mjs';

if (process.env.SITE_URL) config.siteUrl = process.env.SITE_URL;
config.siteUrl = config.siteUrl.replace(/\/+$/, '');

const { layout } = await import('./src/templates/layout.mjs');
const { default: home } = await import('./src/templates/home.mjs');
const { solutionsIndex, servicePage } = await import('./src/templates/solutions.mjs');
const { default: configure } = await import('./src/templates/configure.mjs');
const { partners, academy, about, contact, privacy, notFound } = await import('./src/templates/pages.mjs');
const { areas } = await import('./src/data/services.mjs');

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, 'src');
const dist = join(here, 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'assets/css'), { recursive: true });

/* ---------- assets ---------- */

const cssFiles = ['base.css', 'components.css', 'sections.css', 'vignettes.css', 'configure.css'];
const css = cssFiles
  .map((f) => readFileSync(join(src, 'assets/css', f), 'utf8'))
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\n\s*\n/g, '\n')
  .replace(/^\s+/gm, '');
writeFileSync(join(dist, 'assets/css/site.css'), css);

cpSync(join(src, 'assets/js'), join(dist, 'assets/js'), { recursive: true });
cpSync(join(src, 'assets/img'), join(dist, 'assets/img'), { recursive: true, filter: (p) => !p.endsWith('.json') });
const hasOg = existsSync(join(src, 'assets/img/og.jpg'));

/* ---------- pages ---------- */

// path is the page's directory relative to the site root: '' | 'solutions/' | 'solutions/content/'
const pages = [
  ['', home],
  ['solutions/', solutionsIndex],
  ...areas.map((a) => [`solutions/${a.slug}/`, (ctx) => servicePage(ctx, a)]),
  ['configure/', configure],
  ['partners/', partners],
  ['academy/', academy],
  ['about/', about],
  ['contact/', contact],
  ['privacy/', privacy],
];

for (const [path, render] of pages) {
  const root = '../'.repeat(path.split('/').filter(Boolean).length);
  const page = render({ root, path });
  const dir = join(dist, path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), layout({ ...page, path, root, hasOg }));
}

// The 404 page can be served from any depth, so it needs root-absolute asset URLs.
const basePath = config.siteUrl ? new URL(config.siteUrl + '/').pathname : '/';
writeFileSync(join(dist, '404.html'), layout({ ...notFound({ root: basePath }), path: '404.html', root: basePath, hasOg }));

/* ---------- crawl files ---------- */

if (config.siteUrl) {
  const urls = pages.map(([p]) => `  <url><loc>${config.siteUrl}/${p}</loc></url>`).join('\n');
  writeFileSync(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
}
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n${config.siteUrl ? `Sitemap: ${config.siteUrl}/sitemap.xml\n` : ''}`);
writeFileSync(join(dist, '.nojekyll'), '');

console.log(`Built ${pages.length + 1} pages → dist/ (${(css.length / 1024).toFixed(1)} kB CSS)${config.siteUrl ? ` for ${config.siteUrl}` : ''}`);
