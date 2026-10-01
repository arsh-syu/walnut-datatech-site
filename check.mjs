// Post-build checks: every internal link and asset resolves, every #hash has a target,
// every page has exactly one <h1>, a title and a meta description, and ids are unique.

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from './site.config.mjs';

// Root-absolute links (used by 404.html) include the path the site is served from, e.g. /repo-name/.
const siteUrl = (process.env.SITE_URL || config.siteUrl).replace(/\/+$/, '');
const basePath = siteUrl ? new URL(siteUrl + '/').pathname : '/';

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
  const is404 = file.endsWith('404.html');
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) fail(file, `expected 1 <h1>, found ${h1}`);
  if (!/<title>[^<]+<\/title>/.test(html)) fail(file, 'missing <title>');
  if (!/<meta name="description" content="[^"]{50,}/.test(html) && !is404) fail(file, 'missing or short meta description');

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

console.log(errors ? `\n${errors} problem(s) found` : `✓ ${htmlFiles.length} pages checked — links, anchors, headings and metadata OK`);
process.exit(errors ? 1 : 0);
