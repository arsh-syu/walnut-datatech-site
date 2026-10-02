// Local development server: serves dist/ and mirrors the PHP payment API (src/api) in Node,
// so the whole checkout can be exercised on localhost with Razorpay TEST keys from .env.
// Production runs the PHP files; keep the two in step when changing payment rules.
//
//   node scripts/dev-server.mjs [port]

import { createServer } from 'node:http';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { loadEnv, projectRoot } from './env.mjs';
import { courses, currency } from '../src/data/courses.mjs';
import { securityHeaders } from '../src/security.mjs';

// WALNUT_ENV_FILE lets the test suite start the server without any keys.
const env = loadEnv(process.env.WALNUT_ENV_FILE);
const port = Number(process.argv[2]) || 4173;
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
    json(res, 200, { ok: true, curl: true, configured, mode: configured ? 'test' : null }),

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
      notes: { course: course.name, coupon: code || 'none', name, email, phone },
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
});
