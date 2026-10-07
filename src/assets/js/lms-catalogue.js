// The Walnut LMS course catalogue: checks the courses in the LMS's public feed and turns them into course
// cards. The build renders /academy/ (and the course cards on the home page) with it from a snapshot of
// the feed, and main.js uses it again in the browser to refresh that snapshot from the live feed, so both
// always produce the same markup. It has no imports, so it runs unchanged in Node and in the browser.
//
// Nothing in the feed is trusted: every value is checked, every text is escaped, and the feed's own URLs
// (course_url, enrol_url, thumbnail_url) are ignored. Every link is built here from the course slug.

const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

// Category → icon (by keywords in the category's name), for the head of each group. Anything else gets `cap`.
const CATEGORY_ICONS = [
  [/counsel|admission/i, 'counselling'],
  [/\bai\b|artificial|machine|intelligen/i, 'automation'],
  [/data|analytic/i, 'compliance'],
  [/cloud|devops|infrastructure/i, 'infrastructure'],
  [/secur/i, 'lock'],
  [/business|career|management/i, 'careers'],
  [/marketing/i, 'marketing'],
  [/content|design|media/i, 'content'],
];

// Every icon the renderer can ask for, so the page can hand the browser exactly these (see #lms-icons).
export const catalogueIcons = [...new Set(['external', 'arrow', 'clock', 'screen', 'cap', 'certificate', ...CATEGORY_ICONS.map(([, name]) => name)])];

export const categoryIcon = (category) => CATEGORY_ICONS.find(([test]) => test.test(category))?.[1] ?? 'cap';

// Who each subject is for, by the category's exact name on Walnut LMS. A category added there later shows
// its levels only until a line is written for it here.
const CATEGORY_LINES = {
  'Counselling and admissions': 'For anyone who advises students, from the first enquiry to the admission decision.',
  'Data and analytics': 'For analysts and engineers who turn raw data into answers a business can use.',
  'AI and machine learning': 'For engineers who take models beyond the notebook and keep them working.',
  'Cloud and DevOps': 'For anyone starting out with cloud services, or preparing for a first certification.',
  'Business technology': 'For teams who report on their own numbers and want reports people trust.',
  'Cybersecurity': 'For everyone in an organisation, not only IT: the habits that stop common attacks.',
};
export const categoryLine = (category) => (Object.hasOwn(CATEGORY_LINES, category) ? CATEGORY_LINES[category] : '');

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// A trimmed string no longer than `max`, '' when absent, or null when it is anything else.
function text(value, max) {
  if (value == null) return '';
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length <= max ? t : null;
}

const count = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;

// One course from the feed, checked field by field. Returns the course as the site uses it, or null
// when anything is missing or out of range (that course is then left out, never shown half-broken).
export function validCourse(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null;
  if (typeof c.slug !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(c.slug)) return null;
  const title = text(c.title, 200);
  const subtitle = text(c.subtitle, 600);
  const category = text(c.category, 80);
  const priceLabel = text(c.price_label, 20);
  const certificate = text(c.certificate_title, 200);
  if (!title || subtitle === null || category === null || !priceLabel || certificate === null) return null;
  if (!LEVELS.includes(c.level) || !count(c.duration_hours) || !count(c.lessons)) return null;
  for (const flag of ['is_free', 'is_featured']) if (c[flag] !== undefined && typeof c[flag] !== 'boolean') return null;
  return {
    slug: c.slug,
    title,
    subtitle,
    category: category || 'Courses',
    level: c.level,
    durationHours: c.duration_hours,
    lessons: c.lessons,
    priceLabel,
    isFree: c.is_free === true,
    isFeatured: c.is_featured === true,
    certificateTitle: certificate || null,
  };
}

// The whole feed: the courses that pass, featured first (otherwise in the feed's order), and when it was updated.
export function parseFeed(feed) {
  const list = Array.isArray(feed?.courses) ? feed.courses : [];
  const courses = list.map(validCourse).filter(Boolean);
  const seen = new Set();
  const unique = courses.filter((c) => !seen.has(c.slug) && seen.add(c.slug));
  unique.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));
  const updatedAt = typeof feed?.updated_at === 'string' && /^[0-9TZ:.+-]{10,40}$/.test(feed.updated_at) ? feed.updated_at : '';
  return { courses: unique, updatedAt, rejected: list.length - unique.length };
}

// A short fingerprint of a course list, so the browser can tell whether the live feed differs from the
// snapshot the page was built with (the feed's updated_at changes on every request, so it cannot).
export function catalogueKey(courses) {
  let h = 0x811c9dc5;
  for (const ch of JSON.stringify(courses)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// The course's page on Walnut LMS, and where Enrol goes: through this site's sign-in (api/sso.php) when the
// LMS accepts Walnut accounts, so the learner arrives signed in, or else straight to the course page.
export function courseLinks(course, { lmsUrl, root = '', sso = false }) {
  const page = `${String(lmsUrl).replace(/\/+$/, '')}/courses/${course.slug}`;
  const enrol = sso ? `${root}api/sso.php?app=walnut-lms&next=${encodeURIComponent(`/courses/${course.slug}`)}` : page;
  return { page, enrol };
}

const sentence = (level) => level.charAt(0) + level.slice(1).toLowerCase();
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// `level` is the card's heading level. `eyebrow` is 'category' where cards stand alone (the home page),
// or 'level' inside a catalogue group that already names the category. `reveal: false` is for cards
// inside a container that already animates in.
export function renderCard(course, { icon, lmsUrl, root = '', sso = false, level = 3, eyebrow = 'category', reveal = true, i = 0 }) {
  const { page, enrol } = courseLinks(course, { lmsUrl, root, sso });
  const meta = [
    eyebrow === 'level' ? null : ['cap', sentence(course.level)],
    course.durationHours > 0 ? ['clock', plural(course.durationHours, 'hour')] : null,
    course.lessons > 0 ? ['screen', plural(course.lessons, 'lesson')] : null,
  ].filter(Boolean);
  const title = esc(course.title);
  return `<article class="course-card spot"${reveal ? ` data-reveal style="--d:${(i * 0.1).toFixed(1)}s"` : ''}>
    <p class="eyebrow">${esc(eyebrow === 'level' ? sentence(course.level) : course.category)}</p>
    <h${level} class="course-card-title"><a href="${esc(page)}" rel="noopener" data-track="course_select" data-track-item="${esc(course.slug)}">${title}${icon('external')}<span class="sr-only"> (on Walnut LMS)</span></a></h${level}>
    ${course.subtitle ? `<p class="course-card-tagline">${esc(course.subtitle)}</p>` : ''}
    ${meta.length ? `<ul class="course-meta">${meta.map(([ico, value]) => `<li>${icon(ico)}${esc(value)}</li>`).join('')}</ul>` : ''}
    ${course.certificateTitle ? `<p class="course-cert">${icon('certificate')}<span>${esc(course.certificateTitle)}</span></p>` : ''}
    <div class="course-buy">
      <p class="course-price${course.isFree ? ' is-free' : ''}"><span class="sr-only">Price: </span>${esc(course.priceLabel)}</p>
      <a class="btn btn-primary" href="${esc(enrol)}"${sso ? '' : ' rel="noopener"'} data-track="course_enrol" data-track-item="${esc(course.slug)}"><span>Enrol</span><span class="sr-only"> in ${title}${sso ? '' : ' on Walnut LMS'}</span>${icon(sso ? 'arrow' : 'external')}</a>
    </div>
  </article>`;
}

// "Beginner level", "Beginner and intermediate levels", … for the head of a group.
function levelsLine(list) {
  const levels = LEVELS.filter((l) => list.some((c) => c.level === l)).map((l) => l.toLowerCase());
  const named = levels.length > 1 ? `${levels.slice(0, -1).join(', ')} and ${levels.at(-1)} levels` : `${levels[0]} level`;
  const free = list.filter((c) => c.isFree).length;
  const freeNote = !free ? '' : free === list.length ? (list.length === 1 ? ' · free' : ' · all free') : ` · ${free} free`;
  return named.charAt(0).toUpperCase() + named.slice(1) + freeNote;
}

// The catalogue, grouped by category in the order categories first appear (so featured courses lead).
// `level` is the heading level of each group; its course cards sit one level below.
export function renderCatalogue(courses, { icon, lmsUrl, root = '', sso = false, level = 3 }) {
  const groups = new Map();
  for (const c of courses) groups.set(c.category, [...(groups.get(c.category) ?? []), c]);
  return [...groups]
    .map(
      ([category, list]) => `<div class="track" data-reveal>
        <header class="track-head">
          <span class="area-ico">${icon(categoryIcon(category))}</span>
          <h${level}>${esc(category)}</h${level}>
          ${categoryLine(category) ? `<p>${esc(categoryLine(category))}</p>` : ''}
          <p class="track-levels">${esc(levelsLine(list))}</p>
          <p class="track-count">${plural(list.length, 'course')}</p>
        </header>
        <div class="course-grid">${list.map((c, i) => renderCard(c, { icon, lmsUrl, root, sso, level: level + 1, eyebrow: 'level', i })).join('')}</div>
      </div>`
    )
    .join('\n      ');
}
