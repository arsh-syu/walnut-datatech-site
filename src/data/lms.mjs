// Courses, as Walnut LMS lists them. The build renders them from lms-catalogue.json, a snapshot of the
// LMS's public feed taken by scripts/fetch-catalogue.mjs, checked with the same rules the browser uses
// when it refreshes /academy/ from the live feed (src/assets/js/lms-catalogue.js).

import { readFileSync } from 'node:fs';
import config from '../../site.config.mjs';
import { parseFeed, catalogueKey, catalogueIcons } from '../assets/js/lms-catalogue.js';
import { legacyCourses } from './courses.mjs';
import { icon } from '../templates/icons.mjs';

const feed = JSON.parse(readFileSync(new URL('./lms-catalogue.json', import.meta.url), 'utf8'));

// Every valid course, featured first; when the snapshot was taken; and its fingerprint (see catalogueKey).
export const { courses: lmsCourses, updatedAt: lmsUpdatedAt } = parseFeed(feed);
export const lmsKey = catalogueKey(lmsCourses);
if (!lmsCourses.length) throw new Error('src/data/lms-catalogue.json has no valid courses — run node scripts/fetch-catalogue.mjs');

export const lmsUrl = config.lms.url.replace(/\/+$/, '');
export const lmsHost = new URL(lmsUrl).host;

// Enrol goes through this site's sign-in only when the LMS accepts Walnut accounts (the build sets
// lms.sso once its secret is configured) and accounts are switched on here.
export const lmsSso = Boolean(config.lms.sso && config.accounts);

// The categories, in the order they first appear in the catalogue.
export const lmsCategories = [...new Set(lmsCourses.map((c) => c.category))];

// The options every renderer in lms-catalogue.js takes, for a page at `root`.
export const lmsOptions = (root) => ({ icon, lmsUrl, root, sso: lmsSso });

// Up to `n` featured courses for the home page and the footer (the first courses, if none is featured).
export function featuredCourses(n = 3) {
  const featured = lmsCourses.filter((c) => c.isFeatured);
  return (featured.length ? featured : lmsCourses).slice(0, n);
}

// The learner's journey, as the steps under "Upgrade your skills".
export const learnerSteps = lmsSso
  ? ['Choose a course', 'Sign in with Walnut', 'Enrol on Walnut LMS', 'Learn and get certified']
  : ['Choose a course', 'Open it on Walnut LMS', 'Enrol', 'Learn and get certified'];

// The icons the catalogue can use, as SVG markup by name, for the browser's refresh of /academy/.
export const lmsIconsJson = () => JSON.stringify(Object.fromEntries(catalogueIcons.map((name) => [name, icon(name)]))).replace(/</g, '\\u003c');

// Old course addresses on this site, and where each now goes: the same course on Walnut LMS where there
// is one, otherwise the catalogue at /academy/.
export const legacyRedirects = legacyCourses.map((c) => ({
  ...c,
  path: `academy/${c.slug}/`,
  target: c.lms ? `${lmsUrl}/courses/${c.lms}` : '/academy/',
}));
