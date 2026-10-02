// Post-build checks on dist/: links, anchors, document outline, SEO metadata, accessibility basics
// and security policy. Run after every build (`npm run check`); CI fails if anything is wrong.

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from './site.config.mjs';

// Root-absolute links (used by the system pages) include the path the site is served from, e.g. /repo-name/.
const siteUrl = (process.env.SITE_URL || config.siteUrl).replace(/\/+$/, '');
const basePath = siteUrl ? new URL(siteUrl + '/').pathname : '/';
const mirror = process.env.NOINDEX === '1';

const dist = join(dirname(fileURLToPath(import.meta.url)), 'dist');
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
const htmlFiles = walk(dist).filter((f) => f.endsWith('.html'));
const idsOf = (html) => [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const cache = new Map(htmlFiles.map((f) => [f, readFileSync(f, 'utf8')]));

let errors = 0;
const fail = (file, msg) => {
  errors++;
  console.error(`✗ ${file.replace(dist, '') || '/'}: ${msg}`);
};

for (const [file, html] of cache) {
  const system = /\/(404|500)\.html$/.test(file);

  /* ---- document outline ---- */
  const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
  if (levels.filter((l) => l === 1).length !== 1) fail(file, `expected exactly one <h1>, found ${levels.filter((l) => l === 1).length}`);
  levels.forEach((level, i) => {
    if (i > 0 && level > levels[i - 1] + 1) fail(file, `heading level jumps from h${levels[i - 1]} to h${level}`);
  });

  /* ---- SEO metadata ---- */
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1] ?? '';
  const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
  if (!title) fail(file, 'missing <title>');
  if (title.length > 70) fail(file, `title is ${title.length} characters (keep it under 70)`);
  if (!system && (description.length < 50 || description.length > 200)) fail(file, `meta description is ${description.length} characters (aim for 50–200)`);
  const noindex = /<meta name="robots" content="noindex">/.test(html);
  const canonical = /<link rel="canonical" href="https?:\/\/[^"]+">/.test(html);
  if (system && !noindex) fail(file, 'system page must be noindex');
  if (!system && !mirror && siteUrl && !canonical) fail(file, 'missing canonical URL');
  if (mirror && !noindex) fail(file, 'mirror build must be noindex');
  if (!/<html lang="[a-z-]+">/i.test(html)) fail(file, 'missing lang attribute');
  if (!/<meta property="og:title"/.test(html) || !/<meta property="og:description"/.test(html)) fail(file, 'missing Open Graph metadata');
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(m[1]);
    } catch {
      fail(file, 'invalid JSON-LD');
    }
  }

  /* ---- accessibility basics ---- */
  for (const m of html.matchAll(/<img\b[^>]*>/g)) if (!/\salt="/.test(m[0])) fail(file, `image without alt: ${m[0].slice(0, 60)}`);
  for (const m of html.matchAll(/<(input|textarea|select)\b[^>]*>/g)) {
    const id = m[0].match(/\sid="([^"]+)"/)?.[1];
    const hidden = /type="hidden"|class="hp"/.test(m[0]);
    const labelled = /aria-label=/.test(m[0]) || (id && html.includes(`for="${id}"`)) || /class="sr-only"/.test(m[0]); // sr-only inputs sit inside a <label>
    if (!hidden && !labelled) fail(file, `form control without a label: ${m[0].slice(0, 70)}`);
  }
  for (const m of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) if (!/rel="[^"]*noopener/.test(m[0])) fail(file, 'target="_blank" without rel="noopener"');
  if (!/<a class="skip" href="#main">/.test(html) || !/<main id="main">/.test(html)) fail(file, 'missing skip link or <main>');

  /* ---- security policy ---- */
  const csp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1];
  if (!csp) fail(file, 'missing Content-Security-Policy');
  for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    const hash = `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`;
    if (!csp?.includes(hash)) fail(file, 'inline script is not allowed by the Content-Security-Policy');
  }
  if (/\son[a-z]+="/i.test(html.replace(/<script[\s\S]*?<\/script>/g, ''))) fail(file, 'inline event handler found');
  if (/href="javascript:/i.test(html)) fail(file, 'javascript: URL found');

  /* ---- content hygiene ---- */
  const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
  const stray = text.match(/lorem ipsum|coming soon|TODO|TBD|\[placeholder\]|undefined|\bNaN\b|\[object Object\]/i);
  if (stray) fail(file, `placeholder or template leak in text: "${stray[0]}"`);

  /* ---- ids, links and anchors ---- */
  const ids = idsOf(html);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) fail(file, `duplicate ids: ${[...new Set(dupes)].join(', ')}`);

  for (const m of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
    const ref = m[1];
    if (!ref || /^(https?:|mailto:|tel:|data:)/.test(ref)) continue;
    const [pathPart, hash] = ref.split('#');
    const clean = pathPart.split('?')[0];
    let target = file;
    if (clean) {
      target = clean.startsWith('/') ? join(dist, clean.startsWith(basePath) ? clean.slice(basePath.length) : clean) : resolve(dirname(file), clean);
      if (existsSync(target) && statSync(target).isDirectory()) target = join(target, 'index.html');
      if (!existsSync(target)) {
        fail(file, `broken link → ${ref}`);
        continue;
      }
    }
    if (hash && target.endsWith('.html') && !idsOf(cache.get(target) ?? readFileSync(target, 'utf8')).includes(hash)) {
      fail(file, `missing anchor → ${ref}`);
    }
  }
}

/* ---- crawl files ---- */
const robots = readFileSync(join(dist, 'robots.txt'), 'utf8');
if (mirror ? !/Disallow: \//.test(robots) : !/Allow: \//.test(robots)) fail(join(dist, 'robots.txt'), 'robots.txt does not match the build type');
if (!mirror && siteUrl) {
  const sitemap = existsSync(join(dist, 'sitemap.xml')) ? readFileSync(join(dist, 'sitemap.xml'), 'utf8') : '';
  const pages = htmlFiles.filter((f) => !/\/(404|500)\.html$/.test(f)).length;
  const listed = (sitemap.match(/<loc>/g) || []).length;
  if (listed !== pages) fail(join(dist, 'sitemap.xml'), `sitemap lists ${listed} URLs but there are ${pages} pages`);
}

console.log(errors ? `\n${errors} problem(s) found` : `✓ ${htmlFiles.length} pages checked — links, outline, SEO metadata, accessibility basics and security policy OK`);
process.exit(errors ? 1 : 0);
