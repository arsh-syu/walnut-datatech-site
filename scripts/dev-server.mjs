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
    json(res, 200, { ok: true, curl: true, configured, email: true, mode: configured ? 'test' : null }),

  'GET /api/_outbox': async (req, res) => json(res, 200, { sending: reallySend, emails: outbox }),

  // mirrors src/api/enquiry.php
  'POST /api/enquiry.php': async (req, res) => {
    const input = await readBody(req);
    if (!input) return json(res, 400, { error: 'Invalid request.' });
    if (input.botcheck) return json(res, 200, { ok: true });

    const limits = { topic: 80, name: 120, organisation: 160, email: 254, phone: 40, message: 4000, interests: 300, configuration: 8000, page: 200 };
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
    if (rateLimited(req, res, 'enquiry', 8, 600)) return;

    const vars = { topic: f.topic, name: f.name, email: f.email, from: f.organisation };
    const rows = [['Name', f.name], ['Organisation', f.organisation], ['Email', f.email], ['Phone', f.phone], ['Message', f.message], ['Interested in', f.interests], ['Configuration', f.configuration]];
    const delivered = await email('enquiry_notify', { address: notifyAddress, name: 'Walnut Data Tech' }, vars, [['Topic', f.topic], ...rows, ['Sent from', f.page]]);
    if (!delivered) return json(res, 502, { error: 'Sorry — your enquiry could not be sent. Please try again in a moment.' });
    await email('enquiry_ack', { address: f.email, name: f.name }, vars, [['Topic', f.topic], ...rows]);
    json(res, 200, { ok: true });
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

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  try {
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
});
