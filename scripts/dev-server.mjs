// Local development server: serves dist/ and mirrors the PHP API (src/api) in Node, so the checkout
// and the enquiry forms can be exercised on localhost. Production runs the PHP files; keep the two
// in step when changing payment or email rules.
//
//   node scripts/dev-server.mjs [port]                 — emails are captured, never sent
//   node scripts/dev-server.mjs [port] --send-emails   — emails really go out through Twilio
//
// Captured emails can be read back at GET /api/_outbox (this route exists only here, not in production).

import { createServer } from 'node:http';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { loadEnv, projectRoot } from './env.mjs';
import { courses, currency } from '../src/data/courses.mjs';
import { securityHeaders } from '../src/security.mjs';
import { loadTemplates, buildEmail, sendEmail, emailConfigured } from './email.mjs';

// WALNUT_ENV_FILE lets the test suite start the server without any keys.
const env = loadEnv(process.env.WALNUT_ENV_FILE);
const port = Number(process.argv.find((a) => /^\d+$/.test(a))) || 4173;
const reallySend = process.argv.includes('--send-emails') && emailConfigured(env);
const notifyAddress = env.EMAIL_NOTIFY || 'support@walnutdatatech.com';
const outbox = [];
// Where University requests are filed (mirrors onboarding_url / onboarding_key in api/config.php).
const onboardingUrl = (env.ONBOARDING_API_URL || '').replace(/\/+$/, '');
const onboardingKey = env.ONBOARDING_API_KEY || '';
const dist = join(projectRoot, 'dist');
const keyId = env.RAZORPAY_KEY_ID || '';
const keySecret = env.RAZORPAY_KEY_SECRET || '';
// Real money never moves from a development machine.
const configured = keyId.startsWith('rzp_test_') && keySecret !== '';

const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
};

const json = (res, status, body, extra = {}) => {
  res.writeHead(status, { ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
  res.end(JSON.stringify(body));
};

const enrolmentsEmailed = new Set(); // mirrors first_time() in src/api/lib.php

// Mirrors rate_limit() in src/api/lib.php (kept in memory here).
const hits = new Map();
function rateLimited(req, res, bucket, max, windowSeconds) {
  const key = `${bucket}|${req.socket.remoteAddress}`;
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => t > now - windowSeconds * 1000);
  if (recent.length >= max) {
    json(res, 429, { error: 'Too many attempts. Please wait a few minutes and try again.' }, { 'Retry-After': String(windowSeconds) });
    return true;
  }
  hits.set(key, [...recent, now]);
  return false;
}

// Sends an email, or — by default — captures it so nothing leaves the machine during development.
async function email(template, to, vars, rows) {
  const content = buildEmail(loadTemplates(), template, vars, rows);
  if (!reallySend) {
    outbox.push({ template, to, ...content });
    return true;
  }
  const result = await sendEmail(env, to, content);
  if (!result.ok) console.error(`Email "${template}" failed: Twilio responded HTTP ${result.status}`);
  return result.ok;
}

// mirrors forward_university_request() in src/api/lib.php
async function forwardUniversityRequest(request) {
  try {
    const res = await fetch(`${onboardingUrl}/api/v1/public/university-requests`, {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json', 'X-Walnut-Key': onboardingKey },
      body: JSON.stringify(request),
    });
    const reply = await res.json().catch(() => null);
    if (!res.ok || typeof reply?.reference !== 'string') {
      console.error(`University request was not filed: the Onboarding Tool responded HTTP ${res.status}`);
      return null;
    }
    return { reference: reply.reference.slice(0, 40), duplicate: res.status === 200 };
  } catch (err) {
    console.error(`University request was not filed: ${err.message}`);
    return null;
  }
}

// mirrors read_answers() and answer_label() in src/api/lib.php
function readAnswers(raw) {
  const answers = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return answers;
  const text = (value, max) => {
    if (typeof value !== 'string') throw new Error('refused');
    const cleaned = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+/g, ' ').trim();
    if (Buffer.byteLength(cleaned) > max) throw new Error('refused');
    return cleaned;
  };
  for (const [key, value] of Object.entries(raw)) {
    if (!/^[A-Za-z][A-Za-z0-9]{0,39}$/.test(key) || Object.keys(answers).length >= 50) throw new Error('refused');
    let answer;
    if (Array.isArray(value)) {
      if (value.length > 50) throw new Error('refused');
      answer = value.map((item) => text(item, 300)).filter(Boolean);
    } else answer = text(value, 4000);
    if (answer.length) answers[key] = answer;
  }
  return answers;
}
const answerLabel = (key) => loadTemplates().labels?.[key] ?? key.replace(/(?<=[a-z0-9])(?=[A-Z])/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());

async function readBody(req) {
  if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) return null;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try {
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

async function razorpay(method, path, payload) {
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}` },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error(`Razorpay ${method} ${path} → HTTP ${res.status}`);
  return data;
}

const api = {
  'GET /api/health.php': async (req, res) =>
    json(res, 200, { ok: true, curl: true, configured, email: true, onboarding: Boolean(onboardingUrl && onboardingKey), mode: configured ? 'test' : null }),

  'GET /api/_outbox': async (req, res) => json(res, 200, { sending: reallySend, emails: outbox }),

  // mirrors src/api/enquiry.php
  'POST /api/enquiry.php': async (req, res) => {
    const input = await readBody(req);
    if (!input) return json(res, 400, { error: 'Invalid request.' });
    if (input.botcheck) return json(res, 200, { ok: true });

    const limits = { topic: 80, flow: 40, name: 120, organisation: 160, institutionType: 80, email: 254, phone: 40, message: 4000, interests: 300, configuration: 8000, page: 200 };
    const f = {};
    for (const [key, max] of Object.entries(limits)) {
      const multiline = key === 'message' || key === 'configuration';
      const value = (typeof input[key] === 'string' ? input[key] : '').replace(multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+/g : /[\u0000-\u001f\u007f]+/g, ' ').trim();
      if (Buffer.byteLength(value) > max) return json(res, 422, { error: 'That is longer than we can accept. Please shorten it and try again.', field: key });
      f[key] = value;
    }
    if (f.name.length < 2) return json(res, 422, { error: 'Please enter your name.', field: 'name' });
    if (f.organisation.length < 2) return json(res, 422, { error: 'Please enter your organisation.', field: 'organisation' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return json(res, 422, { error: 'Please enter a valid email address.', field: 'email' });
    f.topic ||= 'General enquiry';
    const university = f.flow === 'university';
    let answers = {};
    if (university) {
      try {
        answers = readAnswers(input.form);
      } catch {
        return json(res, 422, { error: 'Some of the details could not be accepted. Please check them and try again.' });
      }
      const digits = f.phone.replace(/\D+/g, '').length;
      if (digits < 7 || digits > 15) return json(res, 422, { error: 'Please enter a valid phone number.', field: 'phone' });
    }
    if (rateLimited(req, res, 'enquiry', 8, 600)) return;

    // University journey only. Filed before the team's email so that email can say whether it worked.
    const onboarding = [];
    let filed = null;
    if (university && onboardingUrl && onboardingKey) {
      filed = await forwardUniversityRequest({ universityName: f.organisation, universityType: f.institutionType, contactName: f.name, email: f.email, phone: f.phone, message: f.message, interests: f.interests, configuration: f.configuration, form: Object.keys(answers).length ? answers : null, page: f.page });
      onboarding.push(['Onboarding Tool', filed ? `Filed as request ${filed.reference}${filed.duplicate ? ' (an open request from this email was updated)' : ''} — review and approve it in the Onboarding Tool.` : 'Could NOT be filed automatically — please add this university in the Onboarding Tool by hand.']);
    }
    const reference = filed?.reference ?? '';

    const vars = { topic: f.topic, name: f.name, email: f.email, from: f.organisation };
    const rows = [
      ['Name', f.name], ['Organisation', f.organisation], ['Institution type', f.institutionType], ['Email', f.email], ['Phone', f.phone], ['Message', f.message], ['Interested in', f.interests],
      ...Object.entries(answers).map(([key, value]) => [answerLabel(key), Array.isArray(value) ? value.join(', ') : value]),
      ['Configuration', f.configuration],
    ];
    const first = [...(reference ? [['Request ID', reference]] : []), ['Topic', f.topic]];
    const delivered = await email('enquiry_notify', { address: notifyAddress, name: 'Walnut Data Tech' }, vars, [...first, ...rows, ['Sent from', f.page], ...onboarding]);
    // A filed request is safe in the Onboarding Tool even if the team's email could not go out.
    if (!delivered && !reference) return json(res, 502, { error: 'Sorry — your enquiry could not be sent. Please try again in a moment.' });
    if (university) Object.assign(vars, { subjectRef: reference ? ` — ${reference}` : '', keep: reference ? ' Please keep your Request ID for future reference.' : '' });
    await email(university ? 'request_ack' : 'enquiry_ack', { address: f.email, name: f.name }, vars, [...first, ...rows]);
    json(res, 200, reference ? { ok: true, reference, duplicate: filed.duplicate } : { ok: true });
  },

  // mirrors src/api/request-status.php
  'POST /api/request-status.php': async (req, res) => {
    const input = await readBody(req);
    if (!input) return json(res, 400, { error: 'Invalid request.' });
    const reference = String(typeof input.reference === 'string' ? input.reference : '').trim().toUpperCase();
    const address = String(typeof input.email === 'string' ? input.email : '').trim();
    if (!/^UR-\d{1,9}$/.test(reference)) return json(res, 422, { error: 'Please enter your Request ID, for example UR-000123.', field: 'reference' });
    if (address.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return json(res, 422, { error: 'Please enter a valid email address.', field: 'email' });
    if (!onboardingUrl || !onboardingKey) return json(res, 503, { error: 'Request status is not available right now. Please try again later.' });
    if (rateLimited(req, res, 'request-status', 15, 600)) return;
    let status = 0;
    let reply = {};
    try {
      const answer = await fetch(`${onboardingUrl}/api/v1/public/university-requests/status`, {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
        headers: { 'Content-Type': 'application/json', 'X-Walnut-Key': onboardingKey },
        body: JSON.stringify({ reference, email: address }),
      });
      status = answer.status;
      reply = (await answer.json().catch(() => null)) ?? {};
    } catch {}
    if (status === 404) return json(res, 404, { error: 'We could not find a request with that Request ID and email address.' });
    if (status !== 200 || typeof reply.status !== 'string') return json(res, 502, { error: 'We could not check your request right now. Please try again later.' });
    json(res, 200, { ok: true, reference: String(reply.reference ?? reference), status: reply.status, universityName: String(reply.universityName ?? ''), submittedAt: String(reply.submittedAt ?? ''), updatedAt: String(reply.updatedAt ?? '') });
  },

  'POST /api/create-order.php': async (req, res) => {
    const input = await readBody(req);
    if (!input) return json(res, 400, { error: 'Invalid request.' });
    const course = courses.find((c) => c.slug === input.course);
    if (!course) return json(res, 404, { error: 'This course is not available.' });

    const name = String(input.name ?? '').trim();
    const email = String(input.email ?? '').trim();
    const phone = String(input.phone ?? '').trim();
    const digits = phone.replace(/\D+/g, '');
    if (name.length < 2 || name.length > 120) return json(res, 422, { error: 'Please enter your name.', field: 'name' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json(res, 422, { error: 'Please enter a valid email address.', field: 'email' });
    if (digits.length < 7 || digits.length > 15) return json(res, 422, { error: 'Please enter a valid phone number.', field: 'phone' });

    let amount = course.price;
    const code = String(input.coupon ?? '').trim().toUpperCase();
    if (code) {
      const coupon = course.coupons.find((c) => c.code.toUpperCase() === code);
      if (!coupon) return json(res, 422, { error: 'This coupon is not valid for this course.', field: 'coupon' });
      amount = coupon.finalPrice;
    }
    if (!configured) return json(res, 503, { error: 'Online payment is not set up yet. Please try again later.' });
    if (rateLimited(req, res, 'create-order', 20, 600)) return;

    const order = await razorpay('POST', '/orders', {
      amount: amount * 100,
      currency,
      receipt: `${course.slug.slice(0, 24)}-${randomBytes(6).toString('hex')}`,
      notes: { course: course.name, slug: course.slug, coupon: code || 'none', name, email, phone },
    });
    json(res, 200, { order_id: order.id, amount: order.amount, currency: order.currency, key_id: keyId, course: course.name });
  },

  'POST /api/verify-payment.php': async (req, res) => {
    const input = await readBody(req);
    const { razorpay_order_id: orderId = '', razorpay_payment_id: paymentId = '', razorpay_signature: signature = '' } = input || {};
    if (!/^order_[A-Za-z0-9]{6,40}$/.test(orderId) || !/^pay_[A-Za-z0-9]{6,40}$/.test(paymentId) || !/^[a-f0-9]{64}$/.test(signature)) {
      return json(res, 400, { ok: false, error: 'Invalid payment details.' });
    }
    if (!configured) return json(res, 503, { error: 'Online payment is not set up yet. Please try again later.' });
    if (rateLimited(req, res, 'verify-payment', 30, 600)) return;
    const expected = createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      return json(res, 400, { ok: false, error: 'We could not verify this payment. If money was deducted, please contact us with your payment reference.' });
    }
    // Emails are a courtesy on top of a verified payment: nothing here may fail the response.
    if (!enrolmentsEmailed.has(paymentId)) {
      enrolmentsEmailed.add(paymentId);
      try {
        const order = await razorpay('GET', `/orders/${orderId}`);
        const notes = order.notes || {};
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notes.email || '')) {
          // Recorded against the learner's email, so the course shows in their Walnut account.
          if (onboardingUrl && onboardingKey) {
            const recorded = await fetch(`${onboardingUrl}/api/v1/public/enrolments`, {
              method: 'POST',
              signal: AbortSignal.timeout(10000),
              headers: { 'Content-Type': 'application/json', 'X-Walnut-Key': onboardingKey },
              body: JSON.stringify({ email: notes.email, name: notes.name || '', phone: notes.phone || '', courseSlug: notes.slug || '', courseName: notes.course || '', amount: Math.floor(order.amount / 100), coupon: notes.coupon === 'none' ? null : notes.coupon || null, paymentId, orderId }),
            }).catch(() => null);
            if (!recorded?.ok) console.error(`Enrolment ${paymentId} was not recorded: the Onboarding Tool responded HTTP ${recorded?.status ?? 0}`);
          }
          const vars = { name: notes.name || '', email: notes.email, course: notes.course || 'your course', slug: notes.slug || '' };
          const rows = [['Course', vars.course], ['Amount paid', `₹${(order.amount / 100).toLocaleString('en-IN')}`], ['Coupon', notes.coupon === 'none' ? '' : notes.coupon || ''], ['Payment reference', paymentId]];
          await email('enrol_confirm', { address: notes.email, name: vars.name }, vars, rows);
          await email('enrol_notify', { address: notifyAddress, name: 'Walnut Data Tech' }, vars, [...rows, ['Order reference', orderId], ['Name', vars.name], ['Email', notes.email], ['Phone', notes.phone || '']]);
        }
      } catch (err) {
        console.error(`Enrolment emails skipped: ${err.message}`);
      }
    }
    json(res, 200, { ok: true, payment_id: paymentId, order_id: orderId });
  },
};

async function serveStatic(req, res, pathname) {
  let file = join(dist, normalize(decodeURIComponent(pathname)));
  if (!file.startsWith(dist)) return json(res, 403, { error: 'Forbidden' });
  try {
    if ((await stat(file)).isDirectory()) {
      if (!pathname.endsWith('/')) {
        res.writeHead(301, { Location: `${pathname}/` });
        return res.end();
      }
      file = join(file, 'index.html');
    }
    const body = await readFile(file);
    res.writeHead(200, { ...securityHeaders, 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { ...securityHeaders, 'Content-Type': types['.html'] });
    res.end(await readFile(join(dist, '404.html')).catch(() => 'Not found'));
  }
}

// mirrors src/api/account.php — relays the login and dashboard calls to the account service
async function relayAccount(req, res, path) {
  const fail = (status, message) => json(res, status, { error: { message } });
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) return fail(405, 'Method not allowed.');
  if (!/^\/(auth|account)(\/[A-Za-z0-9_-]{1,60}){1,4}$/.test(path)) return fail(404, 'Not found.');
  const origin = req.headers.origin;
  if (origin && new URL(origin).hostname !== String(req.headers.host).replace(/:\d+$/, '')) return fail(403, 'Cross-site requests are not allowed.');
  let body = '';
  if (req.method !== 'GET') {
    for await (const chunk of req) body += chunk;
    if (Buffer.byteLength(body) > 32768 || (body && !(req.headers['content-type'] || '').toLowerCase().startsWith('application/json'))) return fail(400, 'Invalid request.');
  }
  if (!onboardingUrl || !onboardingKey) return fail(503, 'Login is not available right now. Please try again later.');
  if (rateLimited(req, res, 'account', 240, 600)) return;

  const token = req.headers['x-walnut-token'] || '';
  const session = (req.headers.cookie || '').match(/(?:^|;\s*)walnut_rt=([A-Za-z0-9._~-]{20,400})/)?.[1];
  let reply;
  try {
    reply = await fetch(`${onboardingUrl}/api/v1${path}`, {
      method: req.method,
      signal: AbortSignal.timeout(20000),
      headers: {
        Accept: 'application/json',
        'X-Walnut-Key': onboardingKey,
        'X-Walnut-Client-Ip': (req.socket.remoteAddress || '').replace(/^::ffff:/, ''),
        'User-Agent': String(req.headers['user-agent'] || 'walnut-site').slice(0, 250),
        ...(/^[A-Za-z0-9._-]{20,2000}$/.test(token) ? { Authorization: `Bearer ${token}` } : {}),
        ...(session ? { Cookie: `walnut_rt=${session}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body || undefined,
    });
  } catch {
    return fail(502, 'We couldn’t reach the server. Please try again in a moment.');
  }
  // Only the session cookie is passed on, re-scoped to this site.
  const cookies = reply.headers
    .getSetCookie()
    .filter((c) => c.startsWith('walnut_rt='))
    .map((c) => `${c.split(';').map((part) => part.trim()).filter((part) => part && !/^(path|domain)=/i.test(part)).join('; ')}; Path=/`);
  res.writeHead(reply.status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(cookies.length ? { 'Set-Cookie': cookies } : {}) });
  res.end(await reply.text());
}

createServer(async (req, res) => {
  const { pathname, searchParams } = new URL(req.url, 'http://localhost');
  try {
    if (pathname === '/api/account.php') return await relayAccount(req, res, searchParams.get('p') || '');
    if (pathname.startsWith('/api/')) {
      const handler = api[`${req.method} ${pathname}`];
      return handler ? await handler(req, res) : json(res, 404, { error: 'Not found.' });
    }
    await serveStatic(req, res, pathname);
  } catch (err) {
    console.error(err.message);
    json(res, 502, { error: 'We could not reach the payment service. Please try again.' });
  }
}).listen(port, () => {
  console.log(`Walnut dev server → http://localhost:${port}`);
  console.log(configured ? 'Payments: Razorpay TEST mode' : 'Payments: not configured (add Razorpay test keys to .env)');
  console.log(reallySend ? 'Emails: SENDING through Twilio' : 'Emails: captured locally (see /api/_outbox), nothing is sent');
  console.log(onboardingUrl && onboardingKey ? `University requests: filed in the Onboarding Tool at ${onboardingUrl}` : 'University requests: not filed (set ONBOARDING_API_URL and ONBOARDING_API_KEY in .env)');
});
