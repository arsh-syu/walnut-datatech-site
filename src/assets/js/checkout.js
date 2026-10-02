// Course checkout: coupon → order summary → Razorpay payment → server-side verification.
//
// The browser never decides the price. It asks the server for an order (api/create-order.php),
// the server computes the amount from the course catalogue, and after payment the server
// verifies Razorpay's signature (api/verify-payment.php) before enrolment is confirmed.

import { validate, setError, deliver } from './forms.js';

const course = JSON.parse(document.getElementById('course-data').textContent);
const root = document.querySelector('[data-checkout]');
const form = root.querySelector('[data-checkout-form]');
const el = {
  status: form.querySelector('.form-status'),
  pay: form.querySelector('[data-pay]'),
  payLabel: form.querySelector('[data-pay-label]'),
  coupon: form.querySelector('[name="coupon"]'),
  couponBox: form.querySelector('.coupon'),
  couponApply: form.querySelector('[data-coupon-apply]'),
  couponOffer: form.querySelector('[data-coupon-offer]'),
  couponStatus: form.querySelector('[data-coupon-status]'),
  discountRow: root.querySelector('[data-order-discount]'),
  orderCode: root.querySelector('[data-order-code]'),
  orderSaving: root.querySelector('[data-order-saving]'),
  orderTotal: root.querySelector('[data-order-total]'),
  success: root.querySelector('.form-success'),
};

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const UNAVAILABLE = 'Online payment isn’t available right now. Please try again later, or contact us to enrol.';

/* ---------- coupon and order summary ---------- */

let applied = null; // { code, finalPrice } once a valid coupon is applied

const findCoupon = (code) => course.coupons.find((c) => c.code.toUpperCase() === code.trim().toUpperCase()) || null;
const total = () => (applied ? applied.finalPrice : course.price);

function renderOrder() {
  el.discountRow.hidden = !applied;
  if (applied) {
    el.orderCode.textContent = applied.code;
    el.orderSaving.textContent = `−${inr(course.price - applied.finalPrice)}`;
  }
  el.orderTotal.textContent = inr(total());
  el.orderTotal.classList.remove('bump');
  void el.orderTotal.offsetWidth;
  el.orderTotal.classList.add('bump');
  el.payLabel.textContent = `Pay ${inr(total())}`;
}

function setCouponStatus(text = '', kind = '') {
  el.couponStatus.textContent = text;
  el.couponStatus.className = `coupon-status${kind ? ` is-${kind}` : ''}`;
}

function clearCoupon({ keepText = false } = {}) {
  applied = null;
  if (!keepText) el.coupon.value = '';
  el.couponBox.classList.remove('is-applied');
  el.couponApply.querySelector('span').textContent = 'Apply';
  el.couponOffer.hidden = false;
  renderOrder();
}

// Returns true when the code in the field is applied (or the field is empty).
function applyCoupon() {
  const code = el.coupon.value;
  if (!code.trim()) {
    clearCoupon();
    setCouponStatus();
    return true;
  }
  const coupon = findCoupon(code);
  if (!coupon) {
    clearCoupon({ keepText: true });
    setCouponStatus('That code isn’t valid for this course.', 'error');
    return false;
  }
  applied = coupon;
  el.coupon.value = coupon.code;
  el.couponBox.classList.add('is-applied');
  el.couponApply.querySelector('span').textContent = 'Remove';
  el.couponOffer.hidden = true;
  setCouponStatus(`Coupon applied — you save ${inr(course.price - coupon.finalPrice)}.`, 'ok');
  renderOrder();
  return true;
}

if (el.coupon) {
  el.couponApply.addEventListener('click', () => {
    if (applied) {
      clearCoupon();
      setCouponStatus();
      el.coupon.focus();
    } else {
      applyCoupon();
    }
  });
  form.querySelectorAll('[data-coupon-use]').forEach((chip) =>
    chip.addEventListener('click', () => {
      el.coupon.value = chip.dataset.couponUse;
      applyCoupon();
    })
  );
  el.coupon.addEventListener('input', () => {
    if (applied) clearCoupon({ keepText: true });
    setCouponStatus();
  });
  el.coupon.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault(); // Enter in the coupon field applies the coupon; it must not start a payment
    applyCoupon();
  });
}

/* ---------- payment ---------- */

async function api(endpoint, payload) {
  let res;
  try {
    res = await fetch(course.api + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('We couldn’t reach the server. Check your connection and try again.');
  }
  const data = await res.json().catch(() => null);
  if (!data) throw new Error(UNAVAILABLE); // e.g. a static mirror of the site without the payment API
  if (!res.ok) throw Object.assign(new Error(data.error || UNAVAILABLE), { field: data.field });
  return data;
}

let razorpayScript;
function loadRazorpay() {
  razorpayScript ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = resolve;
    script.onerror = () => {
      razorpayScript = null;
      reject(new Error(UNAVAILABLE));
    };
    document.head.append(script);
  });
  return razorpayScript;
}

// Opens Razorpay Checkout; resolves with the signed payment details, rejects if the learner closes it.
function pay(order, learner) {
  return new Promise((resolve, reject) => {
    const checkout = new window.Razorpay({
      key: order.key_id,
      order_id: order.order_id,
      amount: order.amount,
      currency: order.currency,
      name: 'Walnut Data Tech',
      description: course.name,
      prefill: { name: learner.name, email: learner.email, contact: learner.phone },
      theme: { color: '#6a4df5' },
      handler: resolve,
      modal: { ondismiss: () => reject(Object.assign(new Error('Payment cancelled — you have not been charged.'), { cancelled: true })) },
    });
    checkout.open();
  });
}

function setBusy(busy) {
  el.pay.disabled = busy;
  el.pay.classList.toggle('is-loading', busy);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  el.status.textContent = '';
  el.status.classList.remove('is-error');
  if (!validate(form)) return;
  if (el.coupon && !applyCoupon()) return el.coupon.focus();

  const learner = {
    name: form.elements.name.value.trim(),
    email: form.elements.email.value.trim(),
    phone: form.elements.phone.value.trim(),
  };

  setBusy(true);
  try {
    const order = await api('create-order.php', { course: course.slug, coupon: applied?.code ?? '', ...learner });
    await loadRazorpay();
    const payment = await pay(order, learner);
    const verified = await api('verify-payment.php', {
      razorpay_order_id: payment.razorpay_order_id,
      razorpay_payment_id: payment.razorpay_payment_id,
      razorpay_signature: payment.razorpay_signature,
    });

    form.hidden = true;
    el.success.querySelector('[data-success-email]').textContent = learner.email;
    el.success.querySelector('[data-success-ref]').textContent = verified.payment_id;
    el.success.hidden = false;
    el.success.focus();

    // Tell the team about the enrolment. The payment is already confirmed, so a failure here is not the learner's problem.
    deliver({
      topic: 'Course enrolment',
      course: course.name,
      amount: inr(order.amount / 100),
      coupon: applied?.code ?? 'none',
      ...learner,
      payment_id: verified.payment_id,
      order_id: verified.order_id,
    }).catch(() => {});
  } catch (err) {
    const input = err.field && form.elements[err.field];
    if (input && err.field === 'coupon') {
      clearCoupon({ keepText: true });
      setCouponStatus(err.message, 'error');
      input.focus();
    } else if (input) {
      setError(input, err.message);
      input.focus();
    } else {
      el.status.textContent = err.message;
      el.status.classList.toggle('is-error', !err.cancelled);
    }
  } finally {
    setBusy(false);
  }
});
