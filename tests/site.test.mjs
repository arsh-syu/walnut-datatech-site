// Run with `npm test`. Uses only Node's built-in test runner — nothing to install.
//
// Covers the rules that must never drift: course prices and coupons, what the payment API accepts
// and rejects, and that nothing secret ends up in the published files.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectRoot } from '../scripts/env.mjs';
import { courses, offerOf } from '../src/data/courses.mjs';
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

test('course prices and coupons match the business rules', () => {
  const programme = courses.find((c) => c.slug === 'online-programme-course');
  const agentic = courses.find((c) => c.slug === 'agentic-ai');
  assert.equal(programme.price, 999);
  assert.deepEqual(offerOf(programme), { code: 'SYUSANDEEP', finalPrice: 499, saving: 500 });
  assert.equal(agentic.price, 1999);
  assert.equal(offerOf(agentic), null, 'Agentic AI has no discount');
});

test('the server-side price list is generated from the same data', () => {
  const catalog = readFileSync(join(dist, 'api/catalog.php'), 'utf8');
  for (const course of courses) {
    const coupons = course.coupons.map((k) => `'${k.code}' => ${k.finalPrice}`).join(', ');
    assert.ok(catalog.includes(`'${course.slug}' => ['name' => '${course.name}', 'price' => ${course.price}, 'coupons' => [${coupons}]]`), course.slug);
  }
});

test('course pages show the right prices', () => {
  const programme = readFileSync(join(dist, 'academy/online-programme-course/index.html'), 'utf8');
  const agentic = readFileSync(join(dist, 'academy/agentic-ai/index.html'), 'utf8');
  assert.match(programme, /Original price ₹999\. Apply coupon SYUSANDEEP and pay ₹499\./);
  assert.match(agentic, /Price ₹1,999\. No discount currently\./);
  assert.ok(!agentic.includes('SYUSANDEEP'), 'the coupon must not appear on the Agentic AI page');
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

test('create-order rejects an unknown course', async () => {
  assert.equal((await api('create-order.php', { ...learner, course: 'nope' })).status, 404);
});

test('create-order rejects the coupon on the wrong course', async () => {
  const res = await api('create-order.php', { ...learner, course: 'agentic-ai', coupon: 'SYUSANDEEP' });
  assert.equal(res.status, 422);
  assert.equal((await res.json()).field, 'coupon');
});

test('create-order rejects an invalid coupon, email, phone and name', async () => {
  for (const [patch, field] of [[{ coupon: 'FREE' }, 'coupon'], [{ email: 'nope' }, 'email'], [{ phone: '12' }, 'phone'], [{ name: '' }, 'name']]) {
    const res = await api('create-order.php', { ...learner, course: 'online-programme-course', ...patch });
    assert.equal(res.status, 422, field);
    assert.equal((await res.json()).field, field);
  }
});

test('create-order accepts valid input (including a lower-case coupon) and only then asks for keys', async () => {
  for (const coupon of ['', 'syusandeep', 'SYUSANDEEP']) {
    assert.equal((await api('create-order.php', { ...learner, course: 'online-programme-course', coupon })).status, 503);
  }
});

test('the API only accepts JSON posts', async () => {
  assert.equal((await api('create-order.php', 'course=agentic-ai', { 'Content-Type': 'application/x-www-form-urlencoded' })).status, 400);
  assert.equal((await api('create-order.php', '{not json')).status, 400);
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
  assert.ok(!script('forms.js').includes('university') && !script('checkout.js').includes('university'), 'the shared enquiry form and the checkout are not');
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
    env: { ...process.env, ACCOUNTS: '1', OUT_DIR: out, NOINDEX: '', SITE_URL: 'https://walnutdatatech.com' } });
  assert.equal(built.status, 0, built.stderr);
  const made = (path) => readFileSync(join(out, path), 'utf8');
  assert.ok(made('index.html').includes('href="login/" data-account-link data-profile="dashboard/"') && made('index.html').includes('login/?type=student'), 'the header and the audience links lead to the site\'s own login');
  assert.ok(made('login/index.html').includes('id="login"') && made('login/index.html').includes('assets/js/login.js'));
  assert.ok(made('dashboard/index.html').includes('<meta name="robots" content="noindex">') && !made('sitemap.xml').includes('/dashboard/'), 'the dashboard is not listed for search engines');
  // Everything stays on this domain: the pages call the site's own API and nothing else.
  assert.ok(made('login/index.html').includes('"account":"../api/account.php?p="'));
  assert.match(made('login/index.html'), /connect-src 'self' https:\/\/\*\.razorpay\.com;/);
  rmSync(out, { recursive: true, force: true });
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

test('"Open your application" offers the three applications together and University on its own', () => {
  const home = readFileSync(join(dist, 'index.html'), 'utf8');
  const launcher = home.slice(home.indexOf('data-exclusive-group'), home.indexOf('launcher-stage'));
  const values = [...launcher.matchAll(/type="checkbox" name="application" value="([^"]+)"( data-exclusive)?/g)].map((m) => m[1] + (m[2] ? '!' : ''));
  assert.deepEqual(values, ['online-leads', 'agent-onboard', 'course-finder', 'university!'], 'three applications that combine, then University marked exclusive');
  for (const name of ['Online Leads', 'Partner Onboarding', 'Course Finder']) assert.ok(launcher.includes(`<span class="app-name">${name}</span>`), name);
  assert.ok(!home.includes('What are you already working on'), 'the journey picker is gone');
  for (const app of ['online-leads', 'agent-onboard', 'course-finder', 'university']) assert.ok(home.includes(`class="launcher-panel" data-app="${app}"`), `${app} has its own action`);
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
