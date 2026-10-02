// Run with `npm test`. Uses only Node's built-in test runner — nothing to install.
//
// Covers the rules that must never drift: course prices and coupons, what the payment API accepts
// and rejects, and that nothing secret ends up in the published files.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { projectRoot } from '../scripts/env.mjs';
import { courses, offerOf } from '../src/data/courses.mjs';
import { externalApps, audiences } from '../src/data/site.mjs';

const dist = join(projectRoot, 'dist');
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
const PORT = 4391;
const api = (path, body, headers = { 'Content-Type': 'application/json' }) =>
  fetch(`http://localhost:${PORT}/api/${path}`, body === undefined ? {} : { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
const learner = { name: 'Test Learner', email: 'test@example.com', phone: '9999999999' };

let server;
before(async () => {
  const build = spawnSync(process.execPath, ['build.mjs'], { cwd: projectRoot, encoding: 'utf8' });
  assert.equal(build.status, 0, build.stderr);
  // No keys: the API must validate everything and then refuse to create an order.
  server = spawn(process.execPath, ['scripts/dev-server.mjs', String(PORT)], { cwd: projectRoot, env: { ...process.env, WALNUT_ENV_FILE: '/dev/null' } });
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (chunk) => String(chunk).includes('dev server') && resolve());
    server.on('error', reject);
  });
});
after(() => server?.kill());

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
  assert.deepEqual(data, { ok: true, curl: true, configured: false, mode: null });
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

/* ---------- published files ---------- */

test('nothing secret is published', () => {
  for (const file of walk(dist)) {
    if (/\.(jpg|png|svg)$/.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    assert.ok(!/rzp_(test|live)_[A-Za-z0-9]{6,}/.test(text), `Razorpay key in ${file}`);
    assert.ok(!/key_secret['"]?\s*(=>|:|=)\s*['"][^'"]{8,}/.test(text), `secret in ${file}`);
    assert.ok(!/FTP_(USER|PASS|HOST)\s*=\s*\S/.test(text), `FTP setting in ${file}`);
  }
  assert.ok(!walk(dist).some((f) => /config\.php$|\.env/.test(f)), 'config.php or .env must not be in dist');
});

test('every page ships the security policy and no placeholders', () => {
  const check = spawnSync(process.execPath, ['check.mjs'], { cwd: projectRoot, encoding: 'utf8' });
  assert.equal(check.status, 0, check.stdout + check.stderr);
});

test('server configuration sets security headers and caching', () => {
  const htaccess = readFileSync(join(dist, '.htaccess'), 'utf8');
  for (const needle of ['X-Content-Type-Options "nosniff"', 'X-Frame-Options "DENY"', 'Referrer-Policy', 'Strict-Transport-Security', 'ErrorDocument 404', 'max-age=31536000, immutable']) {
    assert.ok(htaccess.includes(needle), needle);
  }
  const api = readFileSync(join(dist, 'api/.htaccess'), 'utf8');
  assert.match(api, /config\|catalog\|lib/);
});
