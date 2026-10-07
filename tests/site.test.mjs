// Run with `npm test`. Uses only Node's built-in test runner — nothing to install.
//
// Covers the rules that must never drift: courses are sold on Walnut LMS (and only there), what the API
// accepts and rejects, and that nothing secret ends up in the published files.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectRoot } from '../scripts/env.mjs';
import { waitForConfig, describeState } from '../scripts/wait-config.mjs';
import { legacyCourses } from '../src/data/courses.mjs';
import { validCourse, parseFeed, renderCard, renderCatalogue, esc, featured, catalogueKey } from '../src/assets/js/lms-catalogue.js';
import { externalApps, audiences } from '../src/data/site.mjs';
import { areas } from '../src/data/services.mjs';
import { questions, questionsFor } from '../src/data/questions.mjs';

const dist = join(projectRoot, 'dist');
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
const PORT = 4391;
const api = (path, body, headers = { 'Content-Type': 'application/json' }) =>
  fetch(`http://localhost:${PORT}/api/${path}`, body === undefined ? {} : { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
const learner = { name: 'Test Learner', email: 'test@example.com', phone: '9999999999' };
const enquiry = { topic: 'General enquiry', name: 'Asha Rao', organisation: 'Example University', email: 'asha@example.com', message: 'Hello' };
const request = { ...enquiry, topic: 'University empanelment request', flow: 'university', institutionType: 'Private university', phone: '+91 98200 00001', configuration: 'Goal: Launch', page: '/configure/' };
const outbox = async () => (await (await fetch(`http://localhost:${PORT}/api/_outbox`)).json());

// Walnut LMS, as the build sees it: the default address and the catalogue snapshot the pages are built from.
const LMS = 'https://walnut-lms.vercel.app';
const snapshot = parseFeed(JSON.parse(readFileSync(join(projectRoot, 'src/data/lms-catalogue.json'), 'utf8')));
// The courses as /academy/ shows them: grouped by category, categories in the order they first appear.
const grouped = [...new Set(snapshot.courses.map((c) => c.category))].flatMap((category) => snapshot.courses.filter((c) => c.category === category));
const catalogueOf = (html) => html.slice(html.indexOf('data-lms-catalogue'), html.indexOf('id="lms-icons"'));
const enrolLinks = (html) => [...html.matchAll(/<a class="btn btn-primary" href="([^"]+)"[^>]*data-track="course_enrol" data-track-item="([^"]+)"/g)].map((m) => [m[2], m[1]]);

// A second dev server wired to a stand-in Onboarding Tool, to test where University requests go.
const TOOL_PORT = 4393;
const LINKED_PORT = 4392;
const TOOL_KEY = 'test-onboarding-key-0123456789abcdef';
const tool = { received: [], status: 201 };
const linked = (body, endpoint = 'enquiry.php') => fetch(`http://localhost:${LINKED_PORT}/api/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const linkedOutbox = async () => (await (await fetch(`http://localhost:${LINKED_PORT}/api/_outbox`)).json()).emails;
const started = (child) => new Promise((resolve, reject) => {
  child.stdout.on('data', (chunk) => String(chunk).includes('dev server') && resolve());
  child.on('error', reject);
});
let toolServer, linkedServer, tmp;

let server;
before(async () => {
  const build = spawnSync(process.execPath, ['build.mjs'], { cwd: projectRoot, encoding: 'utf8' });
  assert.equal(build.status, 0, build.stderr);
  // No keys: the API must validate everything and then refuse to create an order.
  server = spawn(process.execPath, ['scripts/dev-server.mjs', String(PORT)], { cwd: projectRoot, env: { ...process.env, WALNUT_ENV_FILE: '/dev/null' } });
  await started(server);

  toolServer = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw || 'null');
    tool.received.push({ method: req.method, url: req.url, key: req.headers['x-walnut-key'], authorization: req.headers.authorization, cookie: req.headers.cookie, body });
    // The status lookup knows one request; everything else is the intake.
    const lookup = req.url.endsWith('/status');
    const known = lookup && body.reference === 'UR-000042' && body.email === 'asha@example.com';
    const status = lookup ? (known ? 200 : 404) : tool.status;
    res.writeHead(status, { 'Content-Type': 'application/json', 'Set-Cookie': ['walnut_rt=issued; Path=/api/v1/auth; HttpOnly; SameSite=Lax', 'other=1; Path=/'] });
    res.end(JSON.stringify(lookup ? (known ? { reference: 'UR-000042', status: 'UNDER_REVIEW', universityName: 'Example University', submittedAt: '2026-10-03T08:00:00.000Z', updatedAt: '2026-10-03T09:00:00.000Z', adminRemarks: 'internal' } : { error: { message: 'Not found' } }) : { ok: status < 300, reference: 'UR-000042' }));
  });
  await new Promise((resolve) => toolServer.listen(TOOL_PORT, resolve));
  tmp = mkdtempSync(join(tmpdir(), 'walnut-test-'));
  writeFileSync(join(tmp, 'env'), `ONBOARDING_API_URL=http://localhost:${TOOL_PORT}/\nONBOARDING_API_KEY=${TOOL_KEY}\n`);
  linkedServer = spawn(process.execPath, ['scripts/dev-server.mjs', String(LINKED_PORT)], { cwd: projectRoot, env: { ...process.env, WALNUT_ENV_FILE: join(tmp, 'env') } });
  await started(linkedServer);
});
after(() => {
  server?.kill();
  linkedServer?.kill();
  toolServer?.close();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

/* ---------- business rules ---------- */

test('courses are sold on Walnut LMS: no price list, checkout or course pages of our own are published', () => {
  assert.ok(!existsSync(join(dist, 'api/catalog.php')), 'no server-side price list');
  assert.ok(!existsSync(join(dist, 'assets/js/checkout.js')) && !existsSync(join(projectRoot, 'src/assets/js/checkout.js')), 'no checkout script');
  for (const file of walk(dist).filter((f) => /\.(html|js)$/.test(f))) {
    const text = readFileSync(file, 'utf8');
    assert.ok(!text.includes('checkout.js'), `${file} loads the retired checkout`);
    assert.ok(!/razorpay\.com/i.test(text), `${file} loads Razorpay`);
  }
  // The old course addresses: the Online Programme Course is the LMS's online counselling course; Agentic AI has none.
  assert.deepEqual(Object.fromEntries(legacyCourses.map((c) => [c.slug, c.lms])), { 'online-programme-course': 'online-counselling-course', 'agentic-ai': null });
  assert.ok(snapshot.courses.some((c) => c.slug === 'online-counselling-course'), 'the course the old address forwards to is in the catalogue');
});

test('/academy/ lists every course of the Walnut LMS catalogue, grouped by category, linked to the LMS', () => {
  assert.ok(snapshot.courses.length > 0 && snapshot.rejected === 0, 'the snapshot is valid as it stands');
  const html = readFileSync(join(dist, 'academy/index.html'), 'utf8');
  const catalogue = catalogueOf(html);
  assert.ok(catalogue.includes(`data-lms-url="${LMS}"`) && catalogue.includes('data-lms-sso="0"'), 'the browser refreshes it from the same LMS');
  // Each group: its category heading, then exactly the courses of that category, in catalogue order.
  const expected = [...new Set(snapshot.courses.map((c) => c.category))].map((category) => [esc(category), snapshot.courses.filter((c) => c.category === category).map((c) => c.slug)]);
  const groups = catalogue.split('<div class="track"').slice(1).map((group) => [group.match(/<h3>([^<]*)<\/h3>/)[1], [...group.matchAll(/data-track="course_select" data-track-item="([^"]+)"/g)].map((m) => m[1])]);
  assert.deepEqual(groups, expected);
  for (const course of snapshot.courses) {
    const page = `${LMS}/courses/${course.slug}`;
    assert.ok(catalogue.includes(`<a href="${page}" rel="noopener" data-track="course_select" data-track-item="${course.slug}">${esc(course.title)}`), `${course.slug}: the title links to the LMS course page`);
    assert.ok(catalogue.includes(esc(course.priceLabel)), `${course.slug}: the price is shown`);
  }
  // Without the LMS sign-in, Enrol opens the course on Walnut LMS, never this site's sign-in.
  assert.deepEqual(enrolLinks(catalogue), grouped.map((c) => [c.slug, `${LMS}/courses/${c.slug}`]));
  assert.ok(!html.includes('api/sso.php'), 'no Enrol button leads to a sign-in that is not set up');
  for (const [slug, href] of enrolLinks(readFileSync(join(dist, 'index.html'), 'utf8'))) assert.equal(href, `${LMS}/courses/${slug}`, `home: ${slug}`);
});

test('old course addresses forward: to the same course on Walnut LMS, or to /academy/', () => {
  const stub = (slug) => readFileSync(join(dist, 'academy', slug, 'index.html'), 'utf8');
  const programme = stub('online-programme-course');
  assert.ok(programme.includes(`<meta http-equiv="refresh" content="0;url=${LMS}/courses/online-counselling-course">`));
  assert.ok(programme.includes(`<link rel="canonical" href="${LMS}/courses/online-counselling-course">`));
  assert.ok(programme.includes(`href="${LMS}/courses/online-counselling-course"`), 'with a visible link for anyone the refresh does not move');
  const agentic = stub('agentic-ai');
  assert.ok(agentic.includes('<meta http-equiv="refresh" content="0;url=../../academy/">'));
  assert.match(agentic, /<link rel="canonical" href="[^"]*\/academy\/">/);
  for (const html of [programme, agentic]) {
    assert.ok(html.includes('<meta name="robots" content="noindex">'), 'the old pages are not indexed');
    assert.ok(!html.includes('data-track="course_enrol"') && !/₹\d/.test(html), 'and sell nothing');
  }
  if (existsSync(join(dist, 'sitemap.xml'))) assert.ok(!readFileSync(join(dist, 'sitemap.xml'), 'utf8').includes('/academy/agentic-ai') && !readFileSync(join(dist, 'sitemap.xml'), 'utf8').includes('/academy/online-programme-course'));
  // The server answers them with a 301 first.
  const htaccess = readFileSync(join(dist, '.htaccess'), 'utf8');
  assert.match(htaccess, /<IfModule mod_alias\.c>\s+RedirectMatch 301 \^\S*\/academy\/online-programme-course\/\?\$ https:\/\/walnut-lms\.vercel\.app\/courses\/online-counselling-course\n\s+RedirectMatch 301 \^\S*\/academy\/agentic-ai\/\?\$ \S*\/academy\/\n<\/IfModule>/);
  // The stubs promise nothing a reader never sees; the note for past buyers is where the redirects land.
  for (const html of [programme, agentic]) assert.ok(!html.includes('If you bought this course'), 'no note on a page that forwards at once');
  const academy = readFileSync(join(dist, 'academy/index.html'), 'utf8');
  assert.match(academy, /<p class="account-prompt" id="bought-here">Bought a course on this website before it moved to Walnut LMS\? <a href="\.\.\/contact\/">Contact us<\/a> with your payment reference\.<\/p>/);
});

test('each catalogue group says who it is for, and course cards keep their price row at the foot', () => {
  const icon = () => '';
  const course = (category) => validCourse({ slug: 'a-course', title: 'A course', subtitle: '', category, level: 'BEGINNER', duration_hours: 2, lessons: 4, price_label: 'Free', is_free: true, is_featured: false, certificate_title: null });
  assert.ok(renderCatalogue([course('Data and analytics')], { icon, lmsUrl: LMS }).includes('<p>For analysts and engineers who turn raw data into answers a business can use.</p>'));
  for (const category of ['Something new', 'constructor', '__proto__']) {
    const head = renderCatalogue([course(category)], { icon, lmsUrl: LMS }).match(/<header class="track-head">[\s\S]*?<\/header>/)[0];
    assert.equal((head.match(/<p/g) || []).length, 2, `${category}: the levels line and the count only`);
  }
  // Every category in the snapshot has its line.
  const academy = catalogueOf(readFileSync(join(dist, 'academy/index.html'), 'utf8'));
  assert.equal((academy.match(/<p>For [^<]+<\/p>/g) || []).length, new Set(snapshot.courses.map((c) => c.category)).size);
  // Cards in a row grow to the same height; the price and Enrol row is pushed to the foot of each.
  const css = readFileSync(join(projectRoot, 'src/assets/css/journeys.css'), 'utf8');
  assert.match(css, /\.course-card \{\s+display: flex; flex-direction: column;/);
  assert.match(css, /\.course-buy \{[^}]*margin-top: auto;/);
});

test('the live catalogue refresh keeps courses already on screen in view', () => {
  const main = readFileSync(join(projectRoot, 'src/assets/js/main.js'), 'utf8');
  const refresh = main.slice(main.indexOf('async function refreshCourses'), main.indexOf('\n}', main.indexOf('async function refreshCourses')));
  const shown = refresh.indexOf("const shown = box.querySelector('[data-reveal].in') !== null;");
  assert.ok(shown > 0 && shown < refresh.indexOf('box.innerHTML = '), 'what was revealed is noted before the swap');
  assert.ok(refresh.includes("$$('[data-reveal]', box).forEach((el) => (shown ? el.classList.add('in') : revealer.observe(el)));"));
});

test('prices stay the same as on Walnut LMS wherever courses are shown', () => {
  // The home page's featured courses are picked by the same rule as in the browser, carry the fingerprint of
  // exactly those cards, and have the icons to redraw them — so the browser can bring a changed price in.
  const { courses } = parseFeed(JSON.parse(readFileSync(join(projectRoot, 'src/data/lms-catalogue.json'), 'utf8')));
  const picks = featured(courses, 3);
  const home = readFileSync(join(dist, 'index.html'), 'utf8');
  const grid = home.match(/<div class="course-grid" data-lms-featured[^>]*>/)[0];
  assert.ok(grid.includes('data-count="3"') && grid.includes(`data-lms-key="${catalogueKey(picks)}"`) && grid.includes('data-lms-url="https://walnut-lms.vercel.app"'));
  assert.ok(/<script type="application\/json" id="lms-icons">\{/.test(home), 'the home page has the icons to redraw its cards');
  for (const c of picks) assert.ok(home.includes(`data-track-item="${c.slug}"`) && home.includes(esc(c.priceLabel)), `${c.slug} shown at its LMS price`);
  // featured(): featured courses first, else the first courses.
  assert.deepEqual(featured([{ slug: 'a' }, { slug: 'b', isFeatured: true }, { slug: 'c' }], 2).map((c) => c.slug), ['b']);
  assert.deepEqual(featured([{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }], 2).map((c) => c.slug), ['a', 'b']);
  // One fetch of the live feed refreshes both lists; neither throws out of main.js.
  const main = readFileSync(join(projectRoot, 'src/assets/js/main.js'), 'utf8');
  assert.ok(main.includes("$$('[data-lms-catalogue], [data-lms-featured]')") && main.includes("featured(courses, Number(box.dataset.count) || 3)"));
  assert.ok(main.includes('if (boxes.length) refreshCourses(boxes).catch(() => {});'));
});

test('the course catalogue trusts nothing in the feed', () => {
  const good = { slug: 'safe-course', title: 'Safe course', subtitle: '', category: 'Data and analytics', level: 'BEGINNER', duration_hours: 2, lessons: 4, price_label: '₹999', is_free: false, is_featured: false, certificate_title: null };
  assert.ok(validCourse(good));
  // A course with any field out of shape is left out.
  for (const [patch, why] of [
    [{ slug: 'Bad Slug' }, 'spaces and capitals'], [{ slug: '../etc' }, 'a path'], [{ slug: '' }, 'empty slug'], [{ slug: 42 }, 'numeric slug'], [{ slug: 'x'.repeat(81) }, 'long slug'],
    [{ level: 'EXPERT' }, 'unknown level'], [{ level: 'beginner' }, 'lower-case level'], [{ level: undefined }, 'no level'],
    [{ title: 42 }, 'numeric title'], [{ title: null }, 'no title'], [{ title: '   ' }, 'blank title'], [{ title: ['a'] }, 'array title'],
    [{ is_free: 'yes' }, 'is_free not a boolean'], [{ lessons: -1 }, 'negative lessons'], [{ duration_hours: '2' }, 'hours as text'], [{ price_label: '' }, 'no price'],
  ]) assert.equal(validCourse({ ...good, ...patch }), null, why);
  for (const bad of [null, 'course', [], 7]) assert.equal(validCourse(bad), null, String(bad));
  // modules came later, so it is optional: a malformed count is dropped, never the course. Cards show modules
  // (the LMS's lesson count includes every reading and self-check) and fall back to lessons without them.
  const meta = (c) => renderCard(validCourse(c), { icon: () => '', lmsUrl: 'https://walnut-lms.vercel.app' }).match(/<ul class="course-meta">.*?<\/ul>/s)[0];
  assert.ok(meta({ ...good, modules: 23 }).includes('23 modules') && !meta({ ...good, modules: 23 }).includes('lesson'), 'modules replace the lesson count');
  assert.ok(meta({ ...good, modules: 1 }).includes('1 module<'), 'one module, singular');
  for (const odd of [undefined, null, -3, 2.5, '23', 0]) {
    assert.ok(validCourse({ ...good, modules: odd }), `modules ${String(odd)} keeps the course`);
    assert.ok(meta({ ...good, modules: odd }).includes('4 lessons'), `modules ${String(odd)} falls back to lessons`);
  }
  // Duplicates are dropped and featured courses lead.
  const feed = parseFeed({ courses: [good, { ...good, slug: 'top', is_featured: true }, { ...good, title: 'Copy' }, { ...good, slug: 'Nope!' }], updated_at: '2026-10-07T10:00:00Z' });
  assert.deepEqual(feed.courses.map((c) => c.slug), ['top', 'safe-course']);
  assert.equal(feed.rejected, 2);

  // Text from the feed renders inert, and the feed's own links are never used.
  const hostile = validCourse({
    ...good,
    title: '<script>alert(1)</script> "quoted" \'single\'',
    subtitle: '"><img src=x onerror=alert(1)>',
    category: '<b>Data</b>',
    certificate_title: '<iframe src=//attacker.test>',
    price_label: '<i>₹1</i>',
    course_url: 'javascript:alert(1)',
    enrol_url: 'https://evil.example/enrol',
    thumbnail_url: 'https://evil.example/x.png',
  });
  const icon = (name) => `<svg data-icon="${name}"></svg>`;
  for (const sso of [false, true]) {
    const html = renderCard(hostile, { icon, lmsUrl: LMS, root: '../', sso }) + renderCatalogue([hostile], { icon, lmsUrl: LMS, root: '../', sso });
    for (const raw of ['<script>', '<img', '<b>', '<iframe', '<i>', '"quoted"', "'single'", 'javascript:', 'evil.example']) assert.ok(!html.includes(raw), `${raw} (sso ${sso})`);
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &quot;quoted&quot; &#39;single&#39;') && html.includes('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;'));
    const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
    const enrol = sso ? '../api/sso.php?app=walnut-lms&amp;next=%2Fcourses%2Fsafe-course' : `${LMS}/courses/safe-course`;
    assert.deepEqual([...new Set(hrefs)].sort(), [...new Set([`${LMS}/courses/safe-course`, enrol])].sort(), 'every link is built from the slug');
  }
});

test('partner applications point at the right addresses, and there are three audiences', () => {
  assert.deepEqual(Object.fromEntries(externalApps.map((a) => [a.name, a.url])), {
    'Partner Onboarding': 'https://syuapptracker.softsolanalytics.com',
    'Course Finder': 'https://syu-course-finder.vercel.app',
    'Online Leads': 'https://syu-leads.vercel.app',
  });
  assert.deepEqual(audiences.map((a) => a.id), ['universities', 'learners', 'partners']);
  const partners = readFileSync(join(dist, 'partners/index.html'), 'utf8');
  assert.equal((partners.match(/type="radio" name="partner-app"/g) || []).length, 3, 'launcher is a single-choice radio group');
});

test('the audience selector only controls its own three tabs', () => {
  // The university panel nests the service showcase, which has tabs of its own. If the selector
  // ever picks those up again, clicking a service deselects every audience and blanks the section.
  const home = readFileSync(join(dist, 'index.html'), 'utf8');
  assert.equal((home.match(/class="audience-tab[ "]/g) || []).length, 3);
  assert.ok((home.match(/class="rail-item[ "]/g) || []).length > 3, 'showcase tabs are nested inside the selector');
  const script = readFileSync(join(projectRoot, 'src/assets/js/main.js'), 'utf8');
  assert.ok(script.includes(`$$(':scope > [role="tablist"] > [role="tab"]', root)`), 'tabs must be scoped to the direct tablist');
});

/* ---------- payment API ---------- */

test('health endpoint reports status without leaking details', async () => {
  const data = await (await api('health.php')).json();
  assert.deepEqual(data, { ok: true, curl: true, configured: false, email: true, onboarding: false, mode: null });
});

test('create-order no longer takes orders: 410 Gone, pointing to /academy/', async () => {
  const gone = { ok: false, error: 'Courses are now sold on Walnut LMS. Please enrol from https://walnutdatatech.com/academy/.' };
  // Valid input, a coupon, an unknown course or nothing at all: no order is created for any of them.
  for (const body of [{ ...learner, course: 'online-programme-course', coupon: 'SYUSANDEEP' }, { ...learner, course: 'agentic-ai' }, { ...learner, course: 'nope' }, {}]) {
    const res = await api('create-order.php', body);
    assert.equal(res.status, 410, JSON.stringify(body));
    assert.deepEqual(await res.json(), gone);
  }
  // The live site runs the PHP twin: the same answer, and nothing left of the order code.
  const php = readFileSync(join(projectRoot, 'src/api/create-order.php'), 'utf8');
  assert.ok(php.includes(`respond(410, ['ok' => false, 'error' => '${gone.error}']);`));
  assert.ok(!php.includes('razorpay(') && !php.includes('catalog.php'));
});

test('the API only accepts JSON posts', async () => {
  assert.equal((await api('verify-payment.php', 'razorpay_order_id=x', { 'Content-Type': 'application/x-www-form-urlencoded' })).status, 400);
  assert.equal((await api('verify-payment.php', '{not json')).status, 400);
});

test('verify-payment rejects malformed payment details', async () => {
  const res = await api('verify-payment.php', { razorpay_order_id: 'x', razorpay_payment_id: 'y', razorpay_signature: 'z' });
  assert.equal(res.status, 400);
});

/* ---------- enquiries and email ---------- */

test('the dev server never sends real email unless asked to', async () => {
  assert.equal((await outbox()).sending, false);
});

test('an enquiry emails the team and acknowledges the sender', async () => {
  const before = (await outbox()).emails.length;
  const res = await api('enquiry.php', { ...enquiry, phone: '', configuration: 'Goal: Launch\nServices: 2', page: '/contact/' });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  const sent = (await outbox()).emails.slice(before);
  assert.deepEqual(sent.map((e) => [e.template, e.to.address]), [['enquiry_notify', 'support@walnutdatatech.com'], ['enquiry_ack', 'asha@example.com']]);
  assert.equal(sent[0].subject, 'New enquiry: General enquiry — Example University');
  assert.equal(sent[1].subject, 'We’ve received your enquiry');
  for (const email of sent) {
    assert.ok(!/\{\{|\}\}/.test(email.subject + email.html + email.text), 'no unfilled placeholders');
    assert.ok(email.html.includes('Example University') && email.text.includes('Example University'));
    assert.ok(!email.html.includes('>Phone<'), 'empty fields are left out');
    assert.ok(email.html.includes('Goal: Launch<br>Services: 2'), 'line breaks survive in HTML');
  }
});

test('enquiry text cannot inject HTML into the email', async () => {
  const before = (await outbox()).emails.length;
  await api('enquiry.php', { ...enquiry, name: 'Eve <script>alert(1)</script>', message: '<img src=x onerror=alert(1)> {{{rows}}}' });
  const [notify] = (await outbox()).emails.slice(before);
  assert.ok(!notify.html.includes('<script>alert(1)') && !notify.html.includes('<img src=x'));
  assert.ok(notify.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});

test('enquiry rejects bad input with the field to fix, and sends nothing', async () => {
  const before = (await outbox()).emails.length;
  for (const [patch, field] of [[{ name: '' }, 'name'], [{ organisation: '' }, 'organisation'], [{ email: 'nope' }, 'email'], [{ message: 'x'.repeat(4001) }, 'message']]) {
    const res = await api('enquiry.php', { ...enquiry, ...patch });
    assert.equal(res.status, 422, field);
    assert.equal((await res.json()).field, field);
  }
  assert.equal((await api('enquiry.php', 'name=x', { 'Content-Type': 'application/x-www-form-urlencoded' })).status, 400);
  assert.equal((await outbox()).emails.length, before);
});

test('a bot that ticks the hidden box gets a polite answer and no email', async () => {
  const before = (await outbox()).emails.length;
  const res = await api('enquiry.php', { ...enquiry, botcheck: true });
  assert.equal(res.status, 200);
  assert.equal((await outbox()).emails.length, before);
});

test('without Onboarding Tool settings a University request reaches the team by email, with no Request ID', async () => {
  const before = (await outbox()).emails.length;
  const res = await api('enquiry.php', request);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  const sent = (await outbox()).emails.slice(before);
  assert.deepEqual(sent.map((e) => e.template), ['enquiry_notify', 'request_ack']);
  assert.ok(!sent[0].html.includes('Onboarding Tool') && !sent[1].html.includes('Request ID'));
  assert.equal((await api('request-status.php', { reference: 'UR-000042', email: 'asha@example.com' })).status, 503, 'status needs the Onboarding Tool');
});

test('enquiries are rate-limited per visitor', async () => {
  let last;
  for (let i = 0; i < 9; i++) last = await api('enquiry.php', enquiry);
  assert.equal(last.status, 429);
});

/* ---------- University requests → Onboarding Tool ---------- */

test('only the University journey files requests', () => {
  const page = (path) => readFileSync(join(dist, path, 'index.html'), 'utf8');
  const script = (name) => readFileSync(join(projectRoot, 'src/assets/js', name), 'utf8');
  assert.ok(page('configure').includes('data-submit') && script('configure.js').includes("flow: 'university'"), 'the empanelment request is marked as the university flow');
  assert.ok(!script('forms.js').includes('university') && !script('lms-catalogue.js').includes('university'), 'the shared enquiry form and the course catalogue are not');
  for (const path of ['contact', 'partners', 'academy', 'academy/agentic-ai', 'academy/online-programme-course']) {
    assert.ok(!page(path).includes('data-submit') && !page(path).includes('configure.js'), `${path} must not file University requests`);
  }
  // The live site runs the PHP twin of the dev server: same condition, same fields.
  const php = readFileSync(join(projectRoot, 'src/api/enquiry.php'), 'utf8');
  assert.ok(php.includes("$university = $flow === 'university';") && php.includes('if ($university && onboarding_configured($config))'));
  assert.ok(php.includes("'universityType' => $institutionType") && php.includes("'form' => $answers ?: null"), 'the PHP twin forwards the same fields');
});

test('login and the dashboard are part of this site, and built only when accounts are switched on', () => {
  const page = (path) => readFileSync(join(dist, path, 'index.html'), 'utf8');
  for (const path of ['', 'configure', 'academy/agentic-ai']) {
    assert.ok(!page(path).includes('Create your Walnut account') && !page(path).includes('>Sign in<'), `${path || 'home'} shows no account links by default`);
  }
  assert.ok(!existsSync(join(dist, 'login')) && !existsSync(join(dist, 'dashboard')), 'and the login and dashboard pages are not built');

  const out = mkdtempSync(join(tmpdir(), 'walnut-account-'));
  // A production build, whatever this run itself is (the preview mirror sets NOINDEX and its own SITE_URL).
  const built = spawnSync(process.execPath, ['build.mjs'], { cwd: projectRoot, encoding: 'utf8',
    env: { ...process.env, ACCOUNTS: '1', OUT_DIR: out, NOINDEX: '', SITE_URL: 'https://walnutdatatech.com', LMS_SSO: '', WALNUT_LMS_URL: '' } });
  assert.equal(built.status, 0, built.stderr);
  const made = (path) => readFileSync(join(out, path), 'utf8');
  assert.ok(made('index.html').includes('href="login/" data-account-link data-profile="dashboard/"') && made('index.html').includes('login/?type=student'), 'the header and the audience links lead to the site\'s own login');
  assert.ok(made('login/index.html').includes('id="login"') && made('login/index.html').includes('assets/js/login.js'));
  assert.ok(made('dashboard/index.html').includes('<meta name="robots" content="noindex">') && !made('sitemap.xml').includes('/dashboard/'), 'the dashboard is not listed for search engines');
  // Everything stays on this domain: the pages call the site's own API and nothing else.
  assert.ok(made('login/index.html').includes('"account":"../api/account.php?p="'));
  assert.match(made('login/index.html'), /connect-src 'self' https:\/\/walnut-lms\.vercel\.app;/, 'beyond itself, only the LMS course feed');
  // Accounts alone do not send Enrol through the sign-in: that waits for the LMS sign-in secret (LMS_SSO).
  for (const [slug, href] of enrolLinks(made('academy/index.html'))) assert.equal(href, `${LMS}/courses/${slug}`, slug);
  rmSync(out, { recursive: true, force: true });
});

test('with accounts and the LMS sign-in on, Enrol signs the person in to Walnut LMS', () => {
  const build = (env) => {
    const out = mkdtempSync(join(tmpdir(), 'walnut-lms-'));
    const built = spawnSync(process.execPath, ['build.mjs'], { cwd: projectRoot, encoding: 'utf8', env: { ...process.env, OUT_DIR: out, NOINDEX: '', SITE_URL: 'https://walnutdatatech.com', WALNUT_LMS_URL: '', ACCOUNTS_OFF: '', ...env } });
    assert.equal(built.status, 0, built.stderr);
    const read = (path) => readFileSync(join(out, path), 'utf8');
    return { read, done: () => rmSync(out, { recursive: true, force: true }) };
  };
  const sso = build({ ACCOUNTS: '1', LMS_SSO: '1' });
  const academy = sso.read('academy/index.html');
  const sign = (slug) => `api/sso.php?app=walnut-lms&amp;next=%2Fcourses%2F${slug}`;
  assert.deepEqual(enrolLinks(catalogueOf(academy)), grouped.map((c) => [c.slug, `../${sign(c.slug)}`]));
  assert.ok(catalogueOf(academy).includes('data-lms-sso="1"'), 'the browser refresh keeps the sign-in links');
  for (const course of snapshot.courses) assert.ok(academy.includes(`<a href="${LMS}/courses/${course.slug}" rel="noopener" data-track="course_select"`), `${course.slug}: the title still opens the course page`);
  const home = enrolLinks(sso.read('index.html'));
  assert.ok(home.length > 0 && home.every(([slug, href]) => href === sign(slug)), 'the home page cards too');
  // The sign-in accepts these as where to go next (the rule in api/sso.php).
  const next = readFileSync(join(projectRoot, 'src/api/sso.php'), 'utf8').match(/preg_match\('#(\^\/\(\?!\/\)[^#]+)#'/);
  assert.ok(next, 'sso.php checks next');
  // PHP's \z (end of input) is JavaScript's $ without the m flag.
  for (const course of snapshot.courses) assert.match(`/courses/${course.slug}`, new RegExp(next[1].replace(/\\z$/, '$')));
  // Old addresses and the sitemap are the same with or without the sign-in.
  assert.ok(!sso.read('sitemap.xml').includes('/academy/agentic-ai') && !sso.read('sitemap.xml').includes('/academy/online-programme-course') && sso.read('sitemap.xml').includes('/academy/</loc>'));
  assert.ok(sso.read('.htaccess').includes('RedirectMatch 301 ^/academy/agentic-ai/?$ https://walnutdatatech.com/academy/'));
  sso.done();

  // The LMS sign-in without accounts would be a dead link, so Enrol opens the course page instead.
  const noAccounts = build({ ACCOUNTS: '', LMS_SSO: '1' });
  assert.deepEqual(enrolLinks(catalogueOf(noAccounts.read('academy/index.html'))), grouped.map((c) => [c.slug, `${LMS}/courses/${c.slug}`]));
  noAccounts.done();

  // The LMS address is reduced to its https origin before it reaches a link or .htaccess, and plain http stops the build.
  const pathed = build({ WALNUT_LMS_URL: 'https://walnut-lms.vercel.app/lms/' });
  assert.ok(catalogueOf(pathed.read('academy/index.html')).includes(`data-lms-url="${LMS}"`) && pathed.read('.htaccess').includes(` ${LMS}/courses/online-counselling-course\n`));
  pathed.done();
  for (const bad of ['http://walnut-lms.vercel.app', 'walnut-lms.vercel.app']) {
    const out = mkdtempSync(join(tmpdir(), 'walnut-lms-'));
    const built = spawnSync(process.execPath, ['build.mjs'], { cwd: projectRoot, encoding: 'utf8', env: { ...process.env, OUT_DIR: out, NOINDEX: '', SITE_URL: 'https://walnutdatatech.com', WALNUT_LMS_URL: bad } });
    rmSync(out, { recursive: true, force: true });
    assert.notEqual(built.status, 0, bad);
    assert.match(built.stderr, /must be an https URL/, bad);
  }
});

test('the security policy allows the LMS feed and nothing of Razorpay', () => {
  const pages = walk(dist).filter((f) => f.endsWith('.html'));
  assert.ok(pages.length > 10);
  for (const file of pages) {
    const csp = readFileSync(file, 'utf8').match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1];
    assert.ok(csp, `${file} has a policy`);
    assert.ok(!/razorpay/i.test(csp), `${file}: Razorpay is still allowed`);
    assert.match(csp, /connect-src 'self' https:\/\/walnut-lms\.vercel\.app[ ;]/, file);
  }
  assert.ok(!/razorpay/i.test(readFileSync(join(projectRoot, 'src/security.mjs'), 'utf8')));
});

test('the account relay only reaches sign-in and "my account", and needs the account service', async () => {
  const relay = (path, init) => fetch(`http://localhost:${PORT}/api/account.php?p=${encodeURIComponent(path)}`, init);
  assert.equal((await relay('/auth/refresh', { method: 'POST' })).status, 503, 'without the account service, login is unavailable');
  const linkedRelay = (path, init) => fetch(`http://localhost:${LINKED_PORT}/api/account.php?p=${encodeURIComponent(path)}`, init);
  for (const path of ['/users', '/university-requests', '/universities/abc', '/auth/../users', '/public/enrolments', '/agent-applications']) {
    assert.equal((await linkedRelay(path)).status, 404, `${path} must not be reachable through the website`);
  }
  assert.equal((await linkedRelay('/auth/refresh', { method: 'DELETE' })).status, 405);
  assert.equal((await linkedRelay('/auth/refresh', { method: 'POST', headers: { Origin: 'https://evil.example' } })).status, 403);
  tool.received.length = 0;
  const res = await linkedRelay('/auth/otp/send', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Walnut-Token': 'a'.repeat(40), Cookie: 'walnut_rt=' + 'b'.repeat(40) + '; other=1' }, body: JSON.stringify({ channel: 'email', destination: 'asha@example.com' }) });
  assert.equal(res.status, 201);
  const [call] = tool.received;
  assert.equal(`${call.method} ${call.url}`, 'POST /api/v1/auth/otp/send');
  assert.equal(call.key, TOOL_KEY, 'the relay proves itself with the shared key');
  assert.deepEqual(call.body, { channel: 'email', destination: 'asha@example.com' });
  assert.equal(call.authorization, 'Bearer ' + 'a'.repeat(40));
  assert.equal(call.cookie, 'walnut_rt=' + 'b'.repeat(40), 'only the session cookie travels');
  assert.equal(res.headers.getSetCookie().join(), 'walnut_rt=issued; HttpOnly; SameSite=Lax; Path=/', 'the session cookie becomes this site\'s own');
  const php = readFileSync(join(projectRoot, 'src/api/account.php'), 'utf8');
  assert.ok(php.includes("'#^/(auth|account)(/[A-Za-z0-9_-]{1,60}){1,4}$#'") && php.includes("'X-Walnut-Key: '"), 'the PHP twin has the same allow-list');
});

test('University is a flow of its own; partner and learner can be held together', async () => {
  const { canCombine, canAdd, UNIVERSITY_ONLY } = await import('../src/assets/js/roles.js');
  for (const ok of [['UNIVERSITY'], ['AGENT'], ['STUDENT'], ['AGENT', 'STUDENT']]) assert.ok(canCombine(ok), ok.join('+'));
  for (const bad of [['UNIVERSITY', 'AGENT'], ['UNIVERSITY', 'STUDENT'], ['UNIVERSITY', 'AGENT', 'STUDENT']]) assert.ok(!canCombine(bad), bad.join('+'));
  assert.ok(canAdd(['STUDENT'], 'AGENT') && canAdd(['AGENT'], 'STUDENT'), 'a learner can become a partner, and a partner can take courses');
  assert.ok(!canAdd(['UNIVERSITY'], 'AGENT') && !canAdd(['UNIVERSITY'], 'STUDENT') && !canAdd(['AGENT'], 'UNIVERSITY'), 'nothing is added to, or turned into, a university account');
  // The server holds the same rule, in every place an account's types can change or be used.
  const php = readFileSync(join(projectRoot, 'src/api/account-lib.php'), 'utf8');
  assert.ok(php.includes(`const UNIVERSITY_ONLY = '${UNIVERSITY_ONLY}';`), 'one message, the same on both sides');
  assert.ok(php.includes("return !in_array('UNIVERSITY', $types, true) || count($types) === 1;"));
  assert.match(php, /case 'POST \/auth\/otp\/register':[\s\S]*?if \(!allowed_types\(\$types\)\)[\s\S]*?UNIVERSITY_EXCLUSIVE/, 'sign-up refuses University with anything else');
  assert.match(php, /case 'POST \/account\/services':[\s\S]*?in_array\('UNIVERSITY', \$current, true\) \? \[\]/, 'a university account cannot add the other journeys');
  assert.match(php, /case 'POST \/account\/agent-application':[\s\S]*?if \(university_only\(\$user\)\)[\s\S]*?403/, 'a university account cannot apply as a partner');
  assert.ok(readFileSync(join(projectRoot, 'src/api/sso.php'), 'utf8').includes("if (university_only($user) && $appId !== 'onboarding')"), 'nor open the partner apps');
});

test('"Open your application" is a switch: the Education Suite with its three applications and one button, or University on its own', () => {
  const home = readFileSync(join(dist, 'index.html'), 'utf8');
  const launcher = home.slice(home.indexOf('data-exclusive-group'), home.indexOf('</section>', home.indexOf('data-exclusive-group')));
  const tabs = [...launcher.matchAll(/<button class="launcher-tab"[^>]*role="tab"[^>]*aria-selected="(true|false)"[^>]*>(?:<svg[\s\S]*?<\/svg>)?<span>([^<]+)<\/span>/g)].map((m) => `${m[2]}:${m[1]}`);
  assert.deepEqual(tabs, ['Walnut Education Suite:true', 'University:false'], 'two sides, the suite first');
  const [suite, university] = launcher.split('id="launcher-side-university"');
  const values = (side) => [...side.matchAll(/type="checkbox" name="application" value="([^"]+)"( data-exclusive)?/g)].map((m) => m[1] + (m[2] ? '!' : ''));
  assert.deepEqual(values(suite), ['online-leads', 'agent-onboard', 'course-finder'], 'the three applications combine on the suite side');
  assert.deepEqual(values(university), ['university!'], 'University is on its own side, still marked exclusive');
  for (const name of ['Online Leads', 'Partner Onboarding', 'Course Finder']) assert.ok(suite.includes(`<span class="app-name">${name}</span>`), name);
  // One button opens the suite, at the suite's own address, whatever was chosen.
  assert.equal((suite.match(/class="launcher-panel"/g) || []).length, 1, 'one action on the suite side');
  assert.ok(suite.includes('class="launcher-panel" data-app="suite" data-any') && suite.includes('<span>Open Walnut Education Suite</span>'));
  assert.ok(suite.includes('href="https://syu-course-finder.vercel.app"'), 'the suite is the Course Finder address (through the Walnut sign-in once accounts are on)');
  assert.ok(university.includes('class="launcher-panel" data-app="university"') && university.includes('launcher-step-n'), 'University keeps its action, with the steps of its flow');
  assert.ok(!home.includes('What are you already working on'), 'the journey picker is gone');
});

test('programme selection: four tick boxes and Other, which opens a list', () => {
  const qs = questionsFor('university');
  const programmes = qs.find((q) => q.id === 'programmes');
  assert.deepEqual(programmes.options, ['MBA', 'MCA', 'BBA', 'BCA', 'Other']);
  assert.ok(programmes.type === 'multi' && programmes.boxes && programmes.required && programmes.label === 'Which programme do you want to apply for?');
  const other = qs.find((q) => q.id === 'programmeOther');
  assert.ok(other.type === 'select' && other.required && other.options.length > 3 && !other.options.some((o) => programmes.options.includes(o)), 'Other is a list to choose from, not free text');
  assert.deepEqual(other.showIf, { all: [{ field: 'programmes', op: 'contains', value: 'Other' }] });
  assert.ok(qs.indexOf(programmes) === 0 && qs.indexOf(other) === 1, 'asked first in Requirements & builds');
  assert.ok(!qs.some((q) => q.id === 'programmesPlanned'), 'the old free-text field is replaced');
  const { labels } = JSON.parse(readFileSync(join(dist, 'api/emails.json'), 'utf8'));
  assert.equal(labels.programmes, 'Which programme do you want to apply for?', 'the answer is named in the emails');
});

test('the site speaks of partners, names its clients and carries the company details', () => {
  const page = (path) => readFileSync(join(dist, path, 'index.html'), 'utf8');
  const visible = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
  // "Agent" is not used for the partner role anywhere (the AI course may still speak of AI agents).
  for (const path of ['', 'partners', 'about', 'contact', 'academy', 'terms', 'privacy']) {
    assert.ok(!/\bagents?\b/i.test(visible(page(path)).replace(/AI agents?/gi, '')), `${path || 'home'} still says "agent"`);
  }
  for (const path of ['', 'about']) {
    const html = page(path);
    assert.ok(html.includes('id="clients"') && html.includes('Savitribai Phule Pune University') && html.includes('Guru Ghasidas Vishwavidyalaya'), `${path || 'home'} lists the clientele`);
    assert.ok(html.includes('assets/img/client-sppu.webp') && html.includes('assets/img/client-ggv.webp'));
  }
  // On the home page it is the closing section: a real heading, and nothing after it but the footer.
  const main = page('').slice(page('').indexOf('<main'), page('').indexOf('</main>'));
  assert.equal((main.match(/id="clients"/g) || []).length, 1, 'one Clientele section, not two');
  assert.ok(main.includes('<h2 class="title">Clientele</h2>') && !/<section[\s>]/.test(main.slice(main.indexOf('id="clients"'))), 'Clientele is the last section of the home page');
  for (const logo of ['client-sppu.webp', 'client-ggv.webp']) assert.equal(readFileSync(join(dist, 'assets/img', logo)).subarray(8, 12).toString(), 'WEBP', `${logo} is a WebP image`);
  const home = page('');
  assert.ok(home.includes('support@walnutdatatech.com') && home.includes('Sector 62, Noida') && home.includes('GSTIN 09AADCW6322K1Z1'), 'the footer carries the address, email and GSTIN');
  assert.ok(page('contact').includes('mailto:support@walnutdatatech.com') && page('privacy').includes('Walnut Data Tech Private Limited'));
  assert.ok(home.includes('class="hero-hl"'), 'the headline carries its highlight');
});

test('login asks existing or new once, and a profile can hold a mobile number either way', () => {
  const login = readFileSync(join(projectRoot, 'src/assets/js/login.js'), 'utf8');
  assert.ok(login.includes('data-mode="existing"') && login.includes('data-mode="new"'), 'the page offers both');
  assert.ok(login.includes("returning() ? start() : choice()"), 'someone who has signed in before goes straight to the login');
  assert.ok(!/localStorage\.setItem\([^)]*(email|mobile|otp|code|token)/i.test(login), 'nothing personal is remembered for that');
  const account = readFileSync(join(projectRoot, 'src/assets/js/account.js'), 'utf8');
  assert.ok(account.includes('data-mobile-form') && account.includes('data-phone-form'), 'verified by OTP where SMS is on, saved to the profile where it is not');
});

test('the questions are data: unique ids, known types and conditions that point somewhere', () => {
  const ids = questions.map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length, 'question ids are unique');
  const slugs = areas.map((a) => a.slug);
  for (const q of questions) {
    assert.match(q.id, /^[a-z][A-Za-z0-9]{0,39}$/, q.id);
    assert.ok(['text', 'email', 'tel', 'url', 'number', 'textarea', 'select', 'combo', 'choice', 'multi'].includes(q.type), `${q.id}: ${q.type}`);
    assert.equal(['select', 'combo', 'choice', 'multi'].includes(q.type), Array.isArray(q.options), `${q.id} options`);
    // Three options or fewer stay in view; a dropdown is for the lists in between, a searchable list for the long ones.
    if (q.type === 'select') assert.ok(q.options.length > 3 && q.options.length <= 20, `${q.id}: ${q.options.length} options do not belong in a dropdown`);
    for (const c of [q.showIf, q.hideIf].flatMap((rule) => [...(rule?.all ?? []), ...(rule?.any ?? [])])) {
      assert.ok(['equals', 'notEquals', 'contains', 'notContains', 'answered'].includes(c.op), `${q.id}: ${c.op}`);
      if (c.field === 'services') assert.ok(slugs.includes(c.value), `${q.id} depends on an unknown service "${c.value}"`);
      else assert.ok(ids.includes(c.field), `${q.id} depends on an unknown question "${c.field}"`);
    }
  }
  // The request record needs these; the form must always ask for them.
  for (const id of ['organisation', 'institutionType', 'name', 'email', 'phone']) assert.ok(questionsFor('university').find((q) => q.id === id)?.required, id);
  const { labels } = JSON.parse(readFileSync(join(dist, 'api/emails.json'), 'utf8'));
  assert.equal(labels.designation, 'Designation', 'emails can name every answer');
  assert.ok(readFileSync(join(dist, 'configure/index.html'), 'utf8').includes('"id":"examProctoringType"'), 'the page carries the questions');
});

test('a University request is filed in the Onboarding Tool and answered with its Request ID; other enquiries are not', async () => {
  tool.status = 201;
  tool.received.length = 0;
  assert.equal((await linked({ ...enquiry, page: '/contact/' })).status, 200);
  assert.equal(tool.received.length, 0, 'a general enquiry never reaches the Onboarding Tool');
  assert.equal((await linked({ ...enquiry, flow: 'student' })).status, 200);
  assert.equal(tool.received.length, 0, 'only the exact university flow is filed');

  const before = (await linkedOutbox()).length;
  const form = { designation: 'Registrar', city: 'Pune', regulatoryBodies: ['UGC-DEB', 'NAAC'], examProctoring: 'Yes', services: ['Online Examination Management'] };
  const res = await linked({ ...request, form });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, reference: 'UR-000042', duplicate: false });
  assert.equal(tool.received.length, 1);
  const [call] = tool.received;
  assert.equal(`${call.method} ${call.url}`, 'POST /api/v1/public/university-requests');
  assert.equal(call.key, TOOL_KEY, 'authenticated with the shared key');
  assert.deepEqual(call.body, { universityName: 'Example University', universityType: 'Private university', contactName: 'Asha Rao', email: 'asha@example.com', phone: '+91 98200 00001', message: 'Hello', interests: '', configuration: 'Goal: Launch', form, page: '/configure/' }, 'no submitted field is dropped');
  const [notify, ack] = (await linkedOutbox()).slice(before);
  assert.ok(notify.html.includes('Filed as request UR-000042'), 'the team is told it was filed');
  assert.ok(notify.text.includes('Designation: Registrar') && notify.text.includes('Which bodies do you report to?: UGC-DEB, NAAC'), 'answers are listed under their question');
  assert.equal(ack.template, 'request_ack');
  assert.ok(ack.subject.endsWith('UR-000042') && ack.text.includes('Request ID: UR-000042') && ack.text.includes('keep your Request ID'), 'the university gets its Request ID');
  assert.ok(!ack.html.includes('Onboarding Tool') && !ack.html.includes(TOOL_KEY), 'the visitor sees nothing internal');
});

test('a repeat submission is reported as an update of the open request', async () => {
  tool.status = 200; // the Onboarding Tool answers 200 when it updated an open request instead of creating one
  const res = await linked(request);
  assert.deepEqual(await res.json(), { ok: true, reference: 'UR-000042', duplicate: true });
  tool.status = 201;
});

test('a University request needs a phone number and well-formed answers', async () => {
  tool.received.length = 0;
  const refused = async (body) => {
    const res = await linked(body);
    assert.equal(res.status, 422, JSON.stringify(body.form ?? body.phone));
    return res.json();
  };
  assert.equal((await refused({ ...request, phone: '12' })).field, 'phone');
  await refused({ ...request, form: { 'bad key': 'x' } });
  await refused({ ...request, form: { city: { nested: true } } });
  await refused({ ...request, form: { city: 'x'.repeat(4001) } });
  await refused({ ...request, form: { tags: Array(51).fill('x') } });
  assert.equal(tool.received.length, 0, 'nothing refused reaches the Onboarding Tool');
});

test('an Onboarding Tool outage never loses the request', async () => {
  tool.status = 500;
  const before = (await linkedOutbox()).length;
  const res = await linked(request);
  assert.equal(res.status, 200, 'the visitor still gets a confirmation');
  assert.deepEqual(await res.json(), { ok: true }, 'without a Request ID that was never issued');
  const [notify] = (await linkedOutbox()).slice(before);
  assert.ok(notify.html.includes('Could NOT be filed automatically'), 'the team is told to add it by hand');
  tool.status = 201;
});

test('request status needs the Request ID and the registered email, and returns nothing internal', async () => {
  const status = (body) => linked(body, 'request-status.php');
  assert.equal((await (await status({ reference: 'nope', email: 'asha@example.com' })).json()).field, 'reference');
  assert.equal((await (await status({ reference: 'UR-000042', email: 'nope' })).json()).field, 'email');
  assert.equal((await status({ reference: 'UR-000042', email: 'someone@else.com' })).status, 404);
  assert.equal((await status({ reference: 'UR-000041', email: 'asha@example.com' })).status, 404);
  const res = await status({ reference: 'ur-000042', email: 'asha@example.com' });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, reference: 'UR-000042', status: 'UNDER_REVIEW', universityName: 'Example University', submittedAt: '2026-10-03T08:00:00.000Z', updatedAt: '2026-10-03T09:00:00.000Z' });
  const php = readFileSync(join(projectRoot, 'src/api/request-status.php'), 'utf8');
  assert.ok(php.includes("'/api/v1/public/university-requests/status'") && php.includes("rate_limit('request-status'"), 'the PHP twin asks the same endpoint');
});

test('every email template is complete and on-brand', () => {
  const { row, emails } = JSON.parse(readFileSync(join(dist, 'api/emails.json'), 'utf8'));
  assert.deepEqual(Object.keys(emails).sort(), ['enquiry_ack', 'enquiry_notify', 'enrol_confirm', 'enrol_notify', 'otp', 'request_ack']);
  assert.ok(row.includes('{{label}}') && row.includes('{{{value}}}'));
  for (const [name, email] of Object.entries(emails)) {
    assert.ok(email.subject && email.html && email.text, name);
    // The one-time code email carries a code instead of a list of details.
    if (name === 'otp') assert.ok(email.html.includes('{{code}}') && email.text.includes('{{code}}'), 'otp carries the code');
    else assert.ok(email.html.includes('{{{rows}}}') && email.text.includes('{{{rows}}}'), `${name} lists the details`);
    assert.ok(email.html.includes('/assets/img/logo-email.png') && email.html.includes('#0d0c14'), `${name} carries the logo and brand ink`);
  }
});

/* ---------- published files ---------- */

test('nothing secret is published', () => {
  for (const file of walk(dist)) {
    if (/\.(jpg|png|svg)$/.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    assert.ok(!/rzp_(test|live)_[A-Za-z0-9]{6,}/.test(text), `Razorpay key in ${file}`);
    assert.ok(!/key_secret['"]?\s*(=>|:|=)\s*['"][^'"]{8,}/.test(text), `secret in ${file}`);
    assert.ok(!/FTP_(USER|PASS|HOST)\s*=\s*\S/.test(text), `FTP setting in ${file}`);
    assert.ok(!/onboarding_key['"]?\s*(=>|:|=)\s*['"][^'"]{8,}/.test(text) && !/ONBOARDING_API_KEY\s*=\s*\S/.test(text), `Onboarding Tool key in ${file}`);
    assert.ok(!/\bSK[0-9a-f]{32}\b|\bAC[0-9a-f]{32}\b|twilio_secret['"]?\s*(=>|:|=)\s*['"][^'"]{8,}/.test(text), `Twilio credential in ${file}`);
  }
  assert.ok(!walk(dist).some((f) => /config\.php$|\.env/.test(f)), 'config.php or .env must not be in dist');
});

test('every page ships the security policy and no placeholders', () => {
  const check = spawnSync(process.execPath, ['check.mjs'], { cwd: projectRoot, encoding: 'utf8' });
  assert.equal(check.status, 0, check.stdout + check.stderr);
});

test('server configuration sets security headers and caching', () => {
  const htaccess = readFileSync(join(dist, '.htaccess'), 'utf8');
  for (const needle of ['X-Content-Type-Options "nosniff"', 'X-Frame-Options "DENY"', 'Referrer-Policy', 'Strict-Transport-Security', 'ErrorDocument 404', 'max-age=31536000, immutable', 'RewriteCond %{HTTPS} !=on']) {
    assert.ok(htaccess.includes(needle), needle);
  }
  const api = readFileSync(join(dist, 'api/.htaccess'), 'utf8');
  assert.match(api, /config\|catalog\|lib/);
  assert.match(api, /lib\|account-lib/, 'the account library is not served');
  assert.match(api, /\(emails\|agent-questions\)\\\.json/, 'email templates and the partner questions are not served');
  // The old course addresses answer with a 301, alongside every rule above (see the redirect test).
  assert.equal((htaccess.match(/RedirectMatch 301 /g) || []).length, legacyCourses.length);
});

/* ---------- Walnut LMS: sign-in, progress and past purchases ---------- */

test('deploy wires Walnut LMS: catalogue first, secrets only to the server, the backfill off unless asked', () => {
  const deploy = readFileSync(join(projectRoot, 'scripts/deploy.mjs'), 'utf8');
  // The sign-in secret joins the other apps' secrets, as sso_lms, and switches Enrol to the sign-in.
  assert.ok(deploy.includes("['ONBOARDING', 'COURSE_FINDER', 'LEADS', 'LMS'].filter((k) => env[`WALNUT_SSO_SECRET_${k}`])"));
  assert.ok(deploy.includes('const hasLmsSso = Boolean(hasAccounts && env.WALNUT_SSO_SECRET_LMS);') && deploy.includes("LMS_SSO: hasLmsSso ? '1' : ''"));
  // The integration secret and address, with the address checked before anything is built.
  assert.ok(deploy.includes("const lmsUrl = (env.WALNUT_LMS_URL || 'https://walnut-lms.vercel.app')") && deploy.includes('WALNUT_LMS_URL: lmsUrl'));
  // Checked on every deploy (sign-in tokens go there even without the integration secret): a public https origin.
  const urlRule = deploy.match(/\nif \(!(\/\^https:[^\n]+\/i)\.test\(lmsUrl\)\) fail\(/);
  assert.ok(urlRule, 'the address is checked whatever else is set');
  const lmsRule = new Function(`return ${urlRule[1]}`)();
  for (const good of ['https://walnut-lms.vercel.app', 'https://lms.walnutdatatech.com:8443']) assert.ok(lmsRule.test(good), good);
  for (const bad of ['http://walnut-lms.vercel.app', 'https://walnut-lms.vercel.app/lms', 'https://localhost:3000', 'https://127.0.0.1', 'https://walnut-lms.vercel.app?x=1', 'https://a.test\nRedirect 301 / https://evil.test']) assert.ok(!lmsRule.test(bad), bad);
  assert.ok(deploy.includes('const hasLms = Boolean(hasAccounts && env.WALNUT_LMS_INTEGRATION_SECRET);') && deploy.includes('lms_secret: env.WALNUT_LMS_INTEGRATION_SECRET'));
  assert.ok(deploy.includes("env.WALNUT_LMS_BACKFILL === '1' ? { lms_backfill: true } : {}"), 'the backfill is written only when switched on');
  assert.ok(deploy.includes("v === true ? 'true' : phpStr(v)"), 'as a real true, not a string');
  // A fresh catalogue before the build, which can never stop the deploy.
  const fetchAt = deploy.indexOf("spawnSync(process.execPath, ['scripts/fetch-catalogue.mjs']");
  assert.ok(fetchAt > 0 && fetchAt < deploy.indexOf("spawnSync(process.execPath, ['build.mjs']"), 'the catalogue is fetched before the build');
  assert.ok(!/const \w+ = spawnSync\(process\.execPath, \['scripts\/fetch-catalogue\.mjs'\]/.test(deploy), 'and its result never fails the deploy');
  // The secrets are probed for after upload, and the server must see what was uploaded.
  for (const needle of ["'lms_secret', 'sso_lms'", 'env.WALNUT_LMS_INTEGRATION_SECRET, ...', "if (hasLms && !state.data?.lms)", "if (hasLmsSso && !state.data?.lms_sso)"]) assert.ok(deploy.includes(needle), needle);
  const example = readFileSync(join(projectRoot, '.env.example'), 'utf8');
  for (const key of ['WALNUT_SSO_SECRET_LMS', 'WALNUT_LMS_INTEGRATION_SECRET', 'WALNUT_LMS_URL', 'WALNUT_LMS_BACKFILL']) assert.match(example, new RegExp(`^${key}=`, 'm'), key);
  const fetcher = readFileSync(join(projectRoot, 'scripts/fetch-catalogue.mjs'), 'utf8');
  assert.ok(fetcher.includes('/api/public/courses') && fetcher.includes('if (!courses.length)') && !fetcher.includes('process.exit(1)'), 'only a valid feed replaces the snapshot');
});

test('the server registers Walnut LMS, makes learners of those who open it, and signs every call to it', () => {
  const lib = readFileSync(join(projectRoot, 'src/api/account-lib.php'), 'utf8');
  assert.ok(lib.includes("'walnut-lms' => ['name' => 'Walnut LMS', 'url' => lms_origin($config) ?: 'https://walnut-lms.vercel.app', 'receiver' => '/api/sso/walnut', 'secret' => $config['sso_lms'] ?? '']"));
  // Only an https origin is ever used: for the sign-in redirect, and for the signed calls (whose signature covers the path).
  // It ends in \z, not $, so an address with a trailing newline is refused; a lost backslash ('?z~i') would refuse every
  // address and quietly switch the LMS off.
  assert.ok(lib.includes("preg_match('~^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?\\z~i', $url) === 1 ? $url : ''"));
  assert.ok(lib.includes("return lms_origin($config) !== '' && !empty($config['lms_secret']);") && lib.includes('$ch = curl_init(lms_origin($config) . $pathAndQuery);'));
  assert.ok(!/\$config\['lms_url'\]/.test(lib.replace("$url = rtrim((string) ($config['lms_url'] ?? ''), '/');", '')), 'lms_url is read in lms_origin only');
  // A minute's rest after the LMS failed to answer, so a slow LMS cannot hold every dashboard view.
  assert.ok(lib.includes("if (!lms_configured($config) || lms_resting() || !function_exists('curl_init')"));
  assert.match(lib, /if \(\$status === 0 \|\| \$status >= 500\) \{\s+@touch\(lms_rest_file\(\)\);/);
  assert.ok(lib.includes('return is_file($file) && filemtime($file) > time() - 60;'));
  for (const fn of ['lms_configured(array $config): bool', 'lms_call(array $config, string $method, string $pathAndQuery, ?array $body): array', 'lms_progress(array $config, array $user): array', 'lms_backfill(array $config, PDO $db, bool $now = false): void', 'lms_backfill_counts(PDO $db): array']) assert.ok(lib.includes(`function ${fn}`), fn);
  // Signed over exactly what is sent: "<ts>.<path and query>" for a GET, "<ts>.<raw body>" for a POST.
  assert.ok(lib.includes("$signed = $method === 'POST' ? (string) $raw : $pathAndQuery;") && lib.includes("hash_hmac('sha256', $ts . '.' . $signed, (string) $config['lms_secret'])"));
  assert.ok(lib.includes("'X-Walnut-Timestamp: ' . $ts") && lib.includes("'X-Walnut-Signature: sha256=' . hash_hmac("));
  assert.ok(lib.includes("'/api/integrations/walnut/progress?account_id=' . rawurlencode((string) $user['id']) . '&email=' . rawurlencode((string) $user['email'])"));
  // The dashboard asks for progress for a proven email of a non-university account only, and links are made here.
  assert.ok(lib.includes("'lms' => $verified && !$universityOnly ? lms_progress($config, $user) : ['configured' => false, 'available' => false, 'courses' => []]"));
  // "Not set up here" and "did not answer" are told apart, so the dashboard's note appears for an outage only.
  assert.ok(lib.includes("return ['configured' => false, 'available' => false, 'courses' => []];") && lib.includes("$none = ['configured' => true, 'available' => false, 'courses' => []];"));
  assert.ok(lib.includes("'onLms' => !empty($e['lms_synced_at'])"));
  assert.ok(lib.includes("'open' => $sso ? '/api/sso.php?app=walnut-lms&next=' . rawurlencode('/learn/' . $slug) : $lms . '/courses/' . rawurlencode($slug)"), 'Continue is never a dead link');
  assert.ok(!/\$c\['open_url'\]|\['verify_url'\]/.test(lib), 'links from the LMS are never passed on');
  // The backfill: off unless switched on, to the proposed path, amounts in paise.
  // Paced to once per two minutes for the dashboard; only the site's own tooling asks for a sweep now.
  assert.ok(lib.includes("if (!lms_configured($config) || empty($config['lms_backfill']) || lms_resting() || (!$now && !due('lms-backfill', 120)))"));
  // A purchase goes with the account ID only of an account that proved the email; the time budget is checked before each call.
  assert.ok(lib.includes('LEFT JOIN wa_users u ON u.email = e.email AND u.email_verified_at IS NOT NULL WHERE e.lms_synced_at IS NULL'));
  const backfill = lib.slice(lib.indexOf('function lms_backfill('), lib.indexOf('/* ---------- the calls of the login page'));
  const budget = backfill.indexOf('if (time() - $started > 4) {');
  assert.ok(budget > backfill.indexOf('foreach ($rows as $e) {') && budget < backfill.indexOf('lms_call('), 'the budget is checked before each call');
  // It runs after the dashboard has been answered, where the server allows it.
  const dash = lib.slice(lib.indexOf('function account_dashboard('));
  assert.ok(dash.includes('register_shutdown_function(function () use ($config, $db) {') && dash.indexOf('fastcgi_finish_request();') < dash.indexOf('lms_backfill($config, $db);'));
  assert.ok(lib.includes("const LMS_BACKFILL_PATH = '/api/integrations/walnut/enrolments';") && lib.includes("'event' => 'enrolment.created'") && lib.includes("'amount_paise' => (int) $e['amount'] * 100"));
  assert.ok(lib.includes('lms_backfill($config, $db);') && lib.includes('ADD COLUMN IF NOT EXISTS lms_synced_at DATETIME NULL'));
  // Only a 400 is final (the LMS's contract): a 401, 422 or 5xx is tried again, so no paid buyer is written off.
  assert.ok(backfill.includes('} elseif ($status === 400) {'), 'only a 400 marks a purchase as refused');
  assert.ok(!/in_array\(\$status, \[40/.test(backfill), 'no list of other 4xx codes that would write a purchase off');
  assert.ok(readFileSync(join(projectRoot, 'src/api/health.php'), 'utf8').includes("'lms' => lms_configured($config),"));

  // sso.php: a university account is still refused first; anyone else opening the LMS becomes a learner before the token is made.
  const sso = readFileSync(join(projectRoot, 'src/api/sso.php'), 'utf8');
  const refused = sso.indexOf("if (university_only($user) && $appId !== 'onboarding')");
  const learner = sso.indexOf("if ($appId === 'walnut-lms' && !in_array('STUDENT', user_types($user), true))");
  const token = sso.indexOf('$token = sso_token($db, $app, $appId, $user);');
  assert.ok(refused > 0 && refused < learner && learner < token);
  assert.ok(sso.slice(learner, token).includes("clean_types(array_merge(user_types($user), ['STUDENT']))") && sso.slice(learner, token).includes('UPDATE wa_users SET account_types = ?'));
});

test('a sign-in to another Walnut app is never a dead end, and a deploy waits for its settings to load', () => {
  // When this site cannot sign the person in (not set up, settings not loaded yet, database down), sso.php
  // sends them to the app itself at the same page instead of an error. A deploy publishes the pages at once
  // but the host loads a new config.php minutes later, so Enrol must work in between.
  const sso = readFileSync(join(projectRoot, 'src/api/sso.php'), 'utf8');
  assert.ok(!sso.includes("$stop(503"), 'no "not available" error page');
  const vetted = sso.indexOf("if ($next !== '' && (!preg_match(");
  const fallback = sso.indexOf("if (!accounts_configured($config) || empty($app['secret']) || !($db = account_db($config))) {");
  const session = sso.indexOf('$hash = session_token_hash();');
  assert.ok(vetted > 0 && vetted < fallback && fallback < session, 'only a checked path follows the fallback, before any sign-in');
  // next: \z rather than $ (a trailing newline), and no '//' or '..' segment anywhere.
  const rule = sso.slice(vetted, sso.indexOf('\n', vetted));
  assert.ok(rule.includes("{0,300}\\z#'") && rule.includes("strpos($next, '//') !== false") && rule.includes("preg_match('#(^|/)\\.\\.(/|\\?|\\z)#', $next)"));
  // The LMS's course pages are public, so Enrol lands there; any other LMS page goes to its sign-in, which says why.
  const redirect = sso.slice(fallback, session);
  assert.ok(redirect.includes("$lmsLogin = $appId === 'walnut-lms' && strpos($next, '/courses/') !== 0;") && redirect.includes("'/login?sso_error=unavailable'"));
  // health.php reports which config.php the server has loaded; the deploy writes a fresh ID for it.
  assert.ok(readFileSync(join(projectRoot, 'src/api/health.php'), 'utf8').includes("'config_id' => is_string($config['config_id'] ?? null) ? $config['config_id'] : null,"));
  const deploy = readFileSync(join(projectRoot, 'scripts/deploy.mjs'), 'utf8');
  assert.ok(deploy.includes("const configId = randomBytes(8).toString('hex');") && deploy.includes('    config_id: configId,'));
  // Where PHP already runs: the API first, then config.php, then the wait, then every settings check, and
  // only then the pages — so a page never points at something the server cannot do yet.
  const at = (s) => { const i = deploy.indexOf(s); assert.ok(i > 0, s); return i; };
  const steps = ['const warm = Boolean(state.data?.ok);', 'upload(api, remoteDir);', "upload([[configFile, 'api/config.php']], remoteDir);", 'await waitForConfig({ configId, health, limit: CONFIG_WAIT,', "if (hasKeys && !state.data?.configured) fail(", 'upload(pages, remoteDir);', 'const home200 = '].map(at);
  assert.deepEqual(steps, [...steps].sort((a, b) => a - b), 'in that order');
  assert.ok(deploy.includes("const api = files.filter(([, path]) => path.startsWith('api/'));") && deploy.includes("const pages = files.filter(([, path]) => !path.startsWith('api/'));"));
  // Every health call has a time limit, so one hung request cannot stretch the wait.
  assert.ok(deploy.includes("{ headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) }"));
});

test('the backfill can be checked and run from here, by the site itself only', () => {
  // api/lms-sync.php answers only a request signed with the site's own account secret — not the one shared
  // with Walnut LMS — within five minutes, over the raw body; anything else gets the same 404 as no page.
  const sync = readFileSync(join(projectRoot, 'src/api/lms-sync.php'), 'utf8');
  assert.ok(sync.includes("$secret = (string) ($config['account_secret'] ?? '');") && !sync.includes("$config['lms_secret']"));
  assert.ok(sync.includes("if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' || !accounts_configured($config) || $secret === '') {"));
  const verify = sync.indexOf("!hash_equals('sha256=' . hash_hmac('sha256', $ts . '.' . $raw, $secret), $signature)");
  assert.ok(verify > 0 && sync.includes('abs(time() - (int) $ts) > 300') && sync.includes("$raw = (string) file_get_contents('php://input');"));
  assert.equal((sync.match(/respond\(404, \['error' => 'Not found\.'\]\);/g) || []).length, 2, 'the same 404 for a wrong method and a bad signature');
  assert.ok(verify < sync.indexOf('$db = account_db($config);') && verify < sync.indexOf('lms_backfill($config, $db, true);'), 'nothing runs before the signature is checked');
  assert.ok(sync.includes("($in['run'] ?? false) === true") && sync.includes('rate_limit('), 'a sweep only when asked for, and rate-limited');
  // The counts carry no buyer details.
  const lib = readFileSync(join(projectRoot, 'src/api/account-lib.php'), 'utf8');
  const counts = lib.slice(lib.indexOf('function lms_backfill_counts('), lib.indexOf('/* ---------- the calls of the login page'));
  assert.ok(!/email|name'|phone|payment_id/.test(counts.replace(/no buyer details/, '')), 'counts and reasons only');
  // The tool signs exactly what the endpoint checks.
  const tool = readFileSync(join(projectRoot, 'scripts/lms-backfill.mjs'), 'utf8');
  assert.ok(tool.includes("createHmac('sha256', env.ACCOUNT_SECRET).update(`${ts}.${body}`).digest('hex')") && tool.includes("'X-Walnut-Timestamp': ts, 'X-Walnut-Signature': signature"));
});

test('the deploy waits for the server to load its settings, and no longer than it should', async () => {
  // A fake clock: each poll costs `every` seconds, so no real waiting happens.
  const run = async (answers, limit = 900) => {
    let t = 0;
    const lines = [];
    const queue = [...answers];
    const result = await waitForConfig({
      configId: 'new', limit, every: 15, now: () => t * 1000, sleep: async (s) => { t += s; },
      health: async () => (queue.length > 1 ? queue.shift() : queue[0]), log: (l) => lines.push(l),
    });
    return { ...result, lines };
  };
  const old = { status: 200, data: { ok: true, config_id: 'old' } };
  const fresh = { status: 200, data: { ok: true, config_id: 'new' } };
  // Already loaded: no waiting.
  let r = await run([fresh]);
  assert.ok(r.loaded && r.seconds === 0 && r.lines.length === 0);
  // Loaded on the 37th poll (9 minutes): waits exactly that long and says so once a minute.
  r = await run([...Array(36).fill(old), fresh]);
  assert.ok(r.loaded && r.seconds === 540 && r.lines.length === 8, JSON.stringify(r.lines));
  assert.ok(r.lines[0].includes('(1 min; it answers with config old)'));
  // The network down, a non-JSON error, the old health.php without config_id: all keep it waiting...
  for (const odd of [{ status: 0, raw: 'fetch failed' }, { status: 500, raw: '<html>Error</html>' }, { status: 200, data: { ok: true } }]) {
    r = await run([odd, odd, fresh]);
    assert.ok(r.loaded && r.seconds === 30, JSON.stringify(odd));
  }
  // ...and it gives up at the limit, never before and never long after, saying what it saw last.
  r = await run([{ status: 0, raw: 'fetch failed' }]);
  assert.ok(!r.loaded && r.seconds >= 900 && r.seconds < 915, String(r.seconds));
  assert.equal(describeState(r.state), 'health.php gave HTTP 0: fetch failed');
  assert.equal(describeState(old), 'it answers with config old');
  assert.equal(describeState({ status: 200, data: { ok: true } }), 'it answers with config from before config_id existed');
});

test('the dashboard shows courses on Walnut LMS with their progress, and past purchases as a history', () => {
  // The render path of account.js, run as it is (it needs the page's DOM only to paint).
  const source = readFileSync(join(projectRoot, 'src/assets/js/account.js'), 'utf8');
  const slice = (from, to) => source.slice(source.indexOf(from), source.indexOf(to, source.indexOf(from)));
  const escSource = readFileSync(join(projectRoot, 'src/assets/js/session.js'), 'utf8').match(/export const esc = ([^\n]+)/)[1];
  const body = [
    `const esc = ${escSource}`,
    slice('const day =', 'function requestsPanel'),
    slice('// Where a course on Walnut LMS stands', '\nfunction agentPanel') ,
    slice('function tabs()', '\nfunction paint()'),
    'return { coursesPanel, tabs, appsForAccount, set: (d) => (data = d) };',
  ].join('\n');
  const view = new Function('siteRoot', 'portal', 'requestsPanel', 'agentPanel', 'profilePanel', body)('/', '', () => '', () => '', () => '');
  const purchase = { courseSlug: 'online-programme-course', courseName: 'Online Programme Course', amount: 499, coupon: 'SYUSANDEEP', paymentId: 'pay_ABC123', progress: 0, purchasedAt: '2026-05-01T10:00:00Z', completedAt: null };
  const lmsCourse = (patch) => ({ slug: 'applied-sql-for-analytics', title: 'Applied SQL', status: 'active', progress: 40, completedLessons: 4, totalLessons: 10, lastActivityAt: '2026-10-01T10:00:00Z', enrolledAt: '2026-09-01T10:00:00Z', completedAt: null, certificate: null, open: '/api/sso.php?app=walnut-lms&next=%2Flearn%2Fapplied-sql-for-analytics', ...patch });
  const dashboard = (student, types = ['STUDENT']) => ({ profile: { email: 'learner@example.com', accountType: types[0], accountTypes: types }, university: { requests: [], onboarding: null }, agent: { application: null }, student, apps: [{ id: 'walnut-lms' }, { id: 'onboarding' }] });

  view.set(dashboard({
    enrolments: [{ ...purchase, onLms: true }],
    lms: { configured: true, available: true, courses: [
      lmsCourse(),
      lmsCourse({ slug: 'online-counselling-course', title: '<img src=x onerror=alert(1)>', status: 'completed', progress: 100, completedAt: '2026-10-02T10:00:00Z', certificate: { title: 'Certified Counsellor', serial: 'WAL-2026-0001', score: 92, verifyUrl: `${LMS}/verify/WAL-2026-0001` }, open: 'javascript:alert(1)' }),
    ] },
  }));
  let html = view.coursesPanel();
  assert.ok(html.includes('<h3>Applied SQL</h3>') && html.includes('40% complete') && html.includes('4 of 10 lessons') && html.includes('href="/api/sso.php?app=walnut-lms&amp;next=%2Flearn%2Fapplied-sql-for-analytics"') && html.includes('<span>Continue</span>'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;') && !html.includes('<img') && !html.includes('javascript:'), 'titles are escaped, and a link that is not ours is left out');
  assert.ok(html.includes('Completed') && html.includes('Certified Counsellor') && html.includes(`href="${LMS}/verify/WAL-2026-0001"`));
  assert.ok(html.includes('Purchase history') && html.includes('Online Programme Course') && html.includes('₹499') && html.includes('pay_ABC123'), 'past purchases stay on record');
  assert.ok(!html.includes('href="/academy/online-programme-course/"'), 'and no longer link to the retired course page');
  assert.deepEqual(view.tabs().map(([id, label]) => [id, label]), [['courses', 'My courses (2)'], ['profile', 'Profile']]);

  // A purchase not yet handed to the LMS counts alongside the LMS courses.
  view.set(dashboard({ enrolments: [purchase], lms: { configured: true, available: true, courses: [lmsCourse()] } }));
  assert.equal(view.tabs()[0][1], 'My courses (2)');

  // The LMS did not answer: purchases are still shown, with a calm note, and counted.
  view.set(dashboard({ enrolments: [purchase], lms: { configured: true, available: false, courses: [] } }));
  html = view.coursesPanel();
  assert.ok(html.includes('unavailable right now') && html.includes('Purchase history'));
  assert.equal(view.tabs()[0][1], 'My courses (1)');

  // The LMS is not set up here (no integration secret): purchases only, and no note that would never clear.
  view.set(dashboard({ enrolments: [purchase], lms: { configured: false, available: false, courses: [] } }));
  html = view.coursesPanel();
  assert.ok(!html.includes('unavailable right now') && html.includes('Purchase history'));

  // A learner who bought on the LMS only, while it is down: told so, not "No courses yet".
  view.set(dashboard({ enrolments: [], lms: { configured: true, available: false, courses: [] } }));
  html = view.coursesPanel();
  assert.ok(html.includes('unavailable right now') && !html.includes('No courses yet') && html.includes('href="/academy/"'));

  // Nothing yet: an invitation to the catalogue.
  view.set(dashboard({ enrolments: [], lms: { configured: true, available: true, courses: [] } }));
  assert.ok(view.coursesPanel().includes('No courses yet') && view.coursesPanel().includes('href="/academy/"'));

  // A university account sees no courses and no LMS app.
  view.set(dashboard({ enrolments: [], lms: { configured: false, available: false, courses: [] } }, ['UNIVERSITY']));
  assert.ok(!view.tabs().some(([id]) => id === 'courses'));
  assert.deepEqual(view.appsForAccount().map((a) => a.id), ['onboarding']);
});

test('form choices: the country is a searchable list, short lists stay in view, counts and disabled options explain themselves', async () => {
  const { countries } = await import('../src/data/countries.mjs');
  const { search, fieldHtml, clean, problemWith } = await import('../src/assets/js/questions.js');
  assert.ok(countries.length > 190 && new Set(countries).size === countries.length && countries.includes('India'));

  const country = questions.find((q) => q.id === 'country');
  assert.ok(country.type === 'combo' && country.required && country.options === countries && country.value === 'India');
  // Three letters are enough, the best match comes first, and accents or capitals do not matter.
  assert.deepEqual(search(countries, 'ind'), ['India', 'Indonesia']);
  assert.equal(search(countries, 'UNITED k')[0], 'United Kingdom');
  assert.equal(search(countries, 'cote')[0], 'Côte d’Ivoire');
  assert.equal(search(countries, 'kor')[0], 'North Korea', 'a later word can be searched for too');
  assert.deepEqual(search(countries, 'zzz'), []);
  // Only a country from the list is an answer.
  assert.equal(clean(country, 'Indi'), '');
  assert.equal(problemWith(country, ''), 'Please choose a country from the list.');
  assert.equal(problemWith(country, 'India'), '');
  const html = fieldHtml(country, 'India', 'cfg');
  assert.ok(html.includes('role="combobox"') && html.includes('role="listbox"') && html.includes('aria-controls="cfg-country-list"') && html.includes('value="India"'));

  // The LMS question has three answers: shown as three choices, not a dropdown.
  assert.equal(questions.find((q) => q.id === 'lmsStatus').type, 'choice');
  // A question that takes several answers counts them.
  const programmes = questions.find((q) => q.id === 'programmes');
  assert.ok(fieldHtml(programmes, ['MBA', 'BCA'], 'cfg').includes('data-pick-count>2 selected<'));
  assert.ok(fieldHtml(programmes, [], 'cfg').includes('data-pick-count></span>'));
  assert.ok(readFileSync(join(dist, 'index.html'), 'utf8').includes('data-launcher-count'), 'so does the application selector');
  // …and it still shows a button for every application chosen (all the panels, not just the first).
  assert.ok(readFileSync(join(dist, 'assets/js/main.js'), 'utf8').includes("const panels = $$('.launcher-panel', root);"));
  // An option University switches off says why, and how to get it back.
  const roles = readFileSync(join(dist, 'assets/js/roles.js'), 'utf8');
  assert.ok(roles.includes('Untick University to choose this.') && roles.includes("className: 'why-off'"));
});
