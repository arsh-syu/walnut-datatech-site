// Run with `npm test`. Uses only Node's built-in test runner — nothing to install.
//
// Covers the rules that must never drift: course prices and coupons, what the payment API accepts
// and rejects, and that nothing secret ends up in the published files.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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
    tool.received.push({ method: req.method, url: req.url, key: req.headers['x-walnut-key'], body });
    // The status lookup knows one request; everything else is the intake.
    const lookup = req.url.endsWith('/status');
    const known = lookup && body.reference === 'UR-000042' && body.email === 'asha@example.com';
    const status = lookup ? (known ? 200 : 404) : tool.status;
    res.writeHead(status, { 'Content-Type': 'application/json' });
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
    'Agent Onboard': 'https://syuapptracker.softsolanalytics.com',
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

test('account links stay hidden until the account portal has an address', () => {
  const page = (path) => readFileSync(join(dist, path, 'index.html'), 'utf8');
  for (const path of ['', 'configure', 'academy/agentic-ai']) {
    assert.ok(!page(path).includes('Create your Walnut account') && !page(path).includes('>Sign in<'), `${path || 'home'} shows no account links by default`);
  }
  assert.ok(!readFileSync(join(dist, '.htaccess'), 'utf8').includes('login|register'), 'and /login is not redirected anywhere');
  const built = spawnSync(process.execPath, ['-e', `
    process.env.ACCOUNT_URL = 'https://account.example.com/';
    const config = (await import('./site.config.mjs')).default;
    config.links.account = process.env.ACCOUNT_URL.replace(/\\/+$/, '');
    const { accountUrl, accountPrompt } = await import('./src/templates/layout.mjs');
    console.log(accountUrl('register', 'agent'), accountPrompt('student').includes('login?type=student'));
  `, '--input-type=module'], { cwd: projectRoot, encoding: 'utf8' });
  assert.equal(built.stdout.trim(), 'https://account.example.com/register?type=agent true', built.stderr);
});

test('the questions are data: unique ids, known types and conditions that point somewhere', () => {
  const ids = questions.map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length, 'question ids are unique');
  const slugs = areas.map((a) => a.slug);
  for (const q of questions) {
    assert.match(q.id, /^[a-z][A-Za-z0-9]{0,39}$/, q.id);
    assert.ok(['text', 'email', 'tel', 'url', 'number', 'textarea', 'select', 'choice', 'multi'].includes(q.type), `${q.id}: ${q.type}`);
    assert.equal(['select', 'choice', 'multi'].includes(q.type), Array.isArray(q.options), `${q.id} options`);
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
  assert.deepEqual(Object.keys(emails).sort(), ['enquiry_ack', 'enquiry_notify', 'enrol_confirm', 'enrol_notify', 'request_ack']);
  assert.ok(row.includes('{{label}}') && row.includes('{{{value}}}'));
  for (const [name, email] of Object.entries(emails)) {
    assert.ok(email.subject && email.html && email.text, name);
    assert.ok(email.html.includes('{{{rows}}}') && email.text.includes('{{{rows}}}'), `${name} lists the details`);
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
  assert.match(api, /emails\\\.json/, 'email templates are not served');
});
