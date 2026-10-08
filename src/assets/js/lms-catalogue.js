// The Walnut LMS course catalogue: checks the courses in the LMS's public feed and turns them into course
// cards. The build renders /academy/ (and the course cards on the home page) with it from a snapshot of
// the feed, and main.js uses it again in the browser to refresh that snapshot from the live feed, so both
// always produce the same markup. It has no imports, so it runs unchanged in Node and in the browser.
//
// Nothing in the feed is trusted: every value is checked and every text is escaped. The feed's links to
// the course (course_url, enrol_url) are ignored and built here from the slug; a course image is used only
// from the LMS's own thumbnails folder, and a preview video only as an embed built here from its ID.

const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

// Course images live in the Walnut LMS file store, in its public thumbnails folder; nothing else is shown.
// The site's Content-Security-Policy allows images from this origin (src/security.mjs).
export const THUMBNAIL_ORIGIN = 'https://onboarding.walnutdatatech.com';
const THUMBNAIL = /^https:\/\/onboarding\.walnutdatatech\.com\/lms-uploads\/public\/thumbnails\/[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;

// Every icon the renderer can ask for, so the page can hand the browser exactly these (see #lms-icons).
export const catalogueIcons = ['play'];

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

// A YouTube or Vimeo link → the address this site plays it at (YouTube's no-cookie player), or null for
// anything else. Only the video's ID is taken from the link.
export function previewEmbed(url) {
  if (typeof url !== 'string' || url.length > 300) return null;
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.replace(/^(www|m)\./, '');
  if (['youtu.be', 'youtube.com', 'youtube-nocookie.com'].includes(host)) {
    const id = host === 'youtu.be' ? u.pathname.slice(1) : u.pathname === '/watch' ? u.searchParams.get('v') : (u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)$/) || [])[1];
    return /^[A-Za-z0-9_-]{11}$/.test(id ?? '') ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  const vimeo = host === 'vimeo.com' ? u.pathname.match(/^\/(\d{1,12})$/) : host === 'player.vimeo.com' ? u.pathname.match(/^\/video\/(\d{1,12})$/) : null;
  return vimeo ? `https://player.vimeo.com/video/${vimeo[1]}` : null;
}

// One course from the feed, checked field by field. Returns the course as the site uses it, or null
// when anything is missing or out of range (that course is then left out, never shown half-broken).
// The later additions (modules, availability, image, preview video, highlights) are optional: a missing
// or malformed one is left out, never the course.
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
    modules: Number.isInteger(c.modules) && c.modules >= 0 ? c.modules : null,
    priceLabel,
    isFree: c.is_free === true,
    isFeatured: c.is_featured === true,
    certificateTitle: certificate || null,
    // Shown but not yet open for enrolment, on Walnut LMS as here. Anything but "upcoming" is open.
    upcoming: c.availability === 'upcoming',
    image: typeof c.thumbnail_url === 'string' && THUMBNAIL.test(c.thumbnail_url) ? c.thumbnail_url : null,
    preview: previewEmbed(c.preview_video_url),
    highlights: Array.isArray(c.highlights) ? c.highlights.map((h) => text(h, 120)).filter(Boolean).slice(0, 6) : [],
  };
}

// The whole feed: the courses that pass — open ones first, featured first within that, otherwise in the
// feed's order — and when it was updated.
export function parseFeed(feed) {
  const list = Array.isArray(feed?.courses) ? feed.courses : [];
  const courses = list.map(validCourse).filter(Boolean);
  const seen = new Set();
  const unique = courses.filter((c) => !seen.has(c.slug) && seen.add(c.slug));
  unique.sort((a, b) => Number(a.upcoming) - Number(b.upcoming) || Number(b.isFeatured) - Number(a.isFeatured));
  const updatedAt = typeof feed?.updated_at === 'string' && /^[0-9TZ:.+-]{10,40}$/.test(feed.updated_at) ? feed.updated_at : '';
  return { courses: unique, updatedAt, rejected: list.length - unique.length };
}

// The first `n` featured courses (the first courses, if none is featured). The build and the browser both
// pick with this, so the home page's featured courses are the same whichever of them drew the cards.
export function featured(courses, n = 3) {
  const picks = courses.filter((c) => c.isFeatured);
  return (picks.length ? picks : courses).slice(0, n);
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
// One of four violet shades for a course without an image, the same for every course in a category.
const tone = (category) => [...category].reduce((h, ch) => (h * 31 + ch.codePointAt(0)) >>> 0, 7) % 4;

// The picture at the top of a card and of its details: the course's image from Walnut LMS, or a cover
// drawn here naming the category. Decorative either way (the title says what the course is).
function media(course, { icon, video }) {
  const picture = course.image
    ? `<img src="${esc(course.image)}" alt="" width="1600" height="900" loading="lazy" decoding="async">`
    : `<span class="course-cover" data-tone="${tone(course.category)}" aria-hidden="true"><span>${esc(course.category)}</span></span>`;
  return `${picture}
      ${course.upcoming ? '<span class="course-badge">Upcoming</span>' : ''}
      ${video && course.preview ? `<button class="course-play" type="button" data-video="${esc(course.preview)}" data-video-title="${esc(course.title)} — preview" data-track="course_preview" data-track-item="${esc(course.slug)}">${icon('play')}<span>Preview</span></button>` : ''}`;
}

// What the "i" on a card opens: everything known about the course, its preview video when it has one,
// and the way in. Kept in a <template> on the card, so it costs nothing until it is opened; main.js makes
// its title the dialog's <h2> then (a heading in every card's template would break the page's outline).
export function renderCourseDetails(course, { icon, lmsUrl, root = '', sso = false }) {
  const { page, enrol } = courseLinks(course, { lmsUrl, root, sso });
  const title = esc(course.title);
  // The short facts share a row; the certificate's name is long, so it gets a row of its own.
  const facts = [
    ['Level', sentence(course.level)],
    course.durationHours > 0 ? ['Length', plural(course.durationHours, 'hour')] : null,
    course.modules > 0 ? ['Modules', course.lessons > 0 ? `${plural(course.modules, 'module')}, ${plural(course.lessons, 'lesson')}` : plural(course.modules, 'module')] : course.lessons > 0 ? ['Lessons', plural(course.lessons, 'lesson')] : null,
    ['Price', course.upcoming ? 'Announced when the course opens' : course.priceLabel],
    course.certificateTitle ? ['Certificate', course.certificateTitle, 'is-wide'] : null,
  ].filter(Boolean);
  return `<div class="course-detail">
    <div class="course-media">
      ${media(course, { icon, video: false })}
    </div>
    <div class="course-detail-body">
      <p class="eyebrow">${esc(course.category)}</p>
      <p class="course-detail-title" data-course-heading>${title}</p>
      ${course.subtitle ? `<p class="course-detail-lede">${esc(course.subtitle)}</p>` : ''}
      <dl class="course-facts">${facts.map(([k, v, wide]) => `<div${wide ? ` class="${wide}"` : ''}><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      ${course.highlights.length ? `<p class="course-learn-head">What you will learn</p><ul class="course-learn">${course.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
      <div class="course-detail-actions">
        ${course.preview ? `<button class="btn btn-ghost" type="button" data-video="${esc(course.preview)}" data-video-title="${title} — preview" data-track="course_preview" data-track-item="${esc(course.slug)}">${icon('play')}<span>Watch the preview</span></button>` : ''}
        ${course.upcoming
          ? '<p class="course-soon">Opening soon</p>'
          : `<a class="btn btn-primary" href="${esc(enrol)}"${sso ? '' : ' rel="noopener"'} data-track="course_enrol" data-track-item="${esc(course.slug)}"><span>Enrol</span><span class="sr-only"> in ${title}${sso ? '' : ' on Walnut LMS'}</span></a>`}
        <a class="link-arrow" href="${esc(page)}" rel="noopener" data-track="course_select" data-track-item="${esc(course.slug)}"><span>View on Walnut LMS</span></a>
      </div>
    </div>
  </div>`;
}

// `level` is the card's heading level. `reveal: false` is for cards inside a container that already
// animates in. The title links to the course on Walnut LMS and covers the card; the "i", the preview and
// Enrol sit above it.
export function renderCard(course, { icon, lmsUrl, root = '', sso = false, level = 3, reveal = true, i = 0 }) {
  const { page, enrol } = courseLinks(course, { lmsUrl, root, sso });
  const title = esc(course.title);
  const meta = [
    course.durationHours > 0 ? plural(course.durationHours, 'hour') : null,
    // Modules are what a learner works through; the LMS's lesson count includes every reading, PDF and
    // self-check, so it is shown only when the feed gives no module count.
    course.modules > 0 ? plural(course.modules, 'module') : course.lessons > 0 ? plural(course.lessons, 'lesson') : null,
    course.certificateTitle ? 'Certificate' : null,
  ].filter(Boolean);
  return `<article class="course-card spot${course.upcoming ? ' is-upcoming' : ''}"${reveal ? ` data-reveal style="--d:${(i * 0.08).toFixed(2)}s"` : ''}>
    <div class="course-media">
      ${media(course, { icon, video: true })}
    </div>
    <div class="course-body">
      <p class="eyebrow">${esc(course.category)} · ${sentence(course.level)}</p>
      <h${level} class="course-card-title"><a href="${esc(page)}" rel="noopener" data-track="course_select" data-track-item="${esc(course.slug)}">${title}<span class="sr-only"> (on Walnut LMS)</span></a></h${level}>
      ${course.subtitle ? `<p class="course-card-tagline">${esc(course.subtitle)}</p>` : ''}
      ${meta.length ? `<ul class="course-meta">${meta.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
      <div class="course-buy">
        ${course.upcoming
          ? '<p class="course-soon">Opening soon</p>'
          : `<p class="course-price${course.isFree ? ' is-free' : ''}"><span class="sr-only">Price: </span>${esc(course.priceLabel)}</p>
        <a class="btn btn-primary" href="${esc(enrol)}"${sso ? '' : ' rel="noopener"'} data-track="course_enrol" data-track-item="${esc(course.slug)}"><span>Enrol</span><span class="sr-only"> in ${title}${sso ? '' : ' on Walnut LMS'}</span></a>`}
      </div>
    </div>
    <button class="course-info" type="button" data-course-info aria-haspopup="dialog" aria-label="About ${title}" data-track="course_info" data-track-item="${esc(course.slug)}"><span aria-hidden="true">i</span></button>
    <template data-course-details>${renderCourseDetails(course, { icon, lmsUrl, root, sso })}</template>
  </article>`;
}

// The catalogue: the courses open for enrolment, then the upcoming ones. `level` is the heading level of
// each group; its course cards sit one level below. A group of one course shows it as a wide card.
export function renderCatalogue(courses, { icon, lmsUrl, root = '', sso = false, level = 3 }) {
  return [
    ['Open for enrolment', 'Enrol today and start learning on Walnut LMS.', courses.filter((c) => !c.upcoming)],
    ['Upcoming courses', 'These courses are being prepared, and open for enrolment on Walnut LMS soon.', courses.filter((c) => c.upcoming)],
  ]
    .filter(([, , list]) => list.length)
    .map(
      ([heading, line, list]) => `<div class="course-group" data-reveal>
        <header class="course-group-head">
          <h${level}>${heading}</h${level}>
          <p>${line}</p>
          <p class="course-group-count">${plural(list.length, 'course')}</p>
        </header>
        <div class="course-grid${list.length === 1 ? ' is-single' : ''}">${list.map((c, i) => renderCard(c, { icon, lmsUrl, root, sso, level: level + 1, i })).join('')}</div>
      </div>`
    )
    .join('\n      ');
}
