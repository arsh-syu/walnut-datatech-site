// The pay page (/pay/?i=pi_…): what is being paid for, then Razorpay's checkout. The amount, the order and
// where to go afterwards all come from this site's ledger (api/pay/checkout.php), never from the address
// the buyer arrived with. Text from the ledger is set as text, never as HTML.

const box = document.getElementById('pay');
const api = `${box?.dataset.root ?? '../'}api/pay/`;
const id = new URLSearchParams(location.search).get('i') || '';

const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  node.append(...children);
  return node;
};

// A message instead of the payment, with a way on when there is one.
function message(title, text, link) {
  box.replaceChildren(
    el('p', { class: 'pay-state' }, title),
    el('p', { class: 'pay-note' }, text),
    ...(link ? [el('a', { class: 'btn btn-primary btn-lg', href: link.href }, el('span', {}, link.label))] : [])
  );
}

function loadCheckout() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = el('script', { src: 'https://checkout.razorpay.com/v1/checkout.js' });
    s.onload = resolve;
    s.onerror = reject;
    document.head.append(s);
  });
}

// After Razorpay reports success: this site checks the payment before the buyer is sent back.
async function confirm(data, r) {
  message('Confirming your payment…', 'Please keep this page open; it takes a moment.');
  try {
    const res = await fetch(`${api}confirm.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent_id: data.intent_id, razorpay_order_id: r.razorpay_order_id, razorpay_payment_id: r.razorpay_payment_id, razorpay_signature: r.razorpay_signature }),
    });
    const answer = await res.json().catch(() => ({}));
    if (res.ok && answer.ok && answer.redirect) return location.replace(answer.redirect);
    message('Your payment is being confirmed', answer.error || `If money was deducted, it is safe. Payment reference ${r.razorpay_payment_id}.`);
  } catch {
    message('Your payment is being confirmed', `We could not reach the server. If money was deducted, it is safe: it will be completed shortly. Payment reference ${r.razorpay_payment_id}.`);
  }
  box.append(el('button', { class: 'btn btn-ghost', type: 'button', 'data-retry': '' }, el('span', {}, 'Check again')));
  box.querySelector('[data-retry]').addEventListener('click', () => confirm(data, r));
}

// The ledger's view of this payment. `check` asks it to look at Razorpay too (see api/pay/checkout.php).
async function lookup(check) {
  const res = await fetch(`${api}checkout.php?i=${encodeURIComponent(id)}${check ? '&check=1' : ''}`, { headers: { Accept: 'application/json' } });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

// Razorpay's window closed without a success: the buyer stays here. If the payment did go through after all
// (a UPI app, a bank page), they are taken on; otherwise they can try again or go back themselves.
// One look at a time: a look asked for while another runs waits for it, then makes its own (so a window
// closed during the quiet look on arrival still gets its answer).
let looking = Promise.resolve();
function recheck(data, note) {
  looking = looking.then(async () => {
    try {
      const { res, data: now } = await lookup(true);
      if (res.ok && now.status === 'paid' && now.continue_url) return location.replace(now.continue_url);
      if (res.ok && now.status === 'expired') return show(now);
    } catch {
      // Unreachable for now: the buyer can still try again.
    }
    if (note) ready(data, note);
  });
  return looking;
}

function ready(data, note = '') {
  const payButton = el('button', { class: 'btn btn-primary btn-lg pay-button', type: 'button' }, el('span', {}, note ? 'Try again' : `Pay ${rupees(data.amount_paise)}`));
  const status = el('p', { class: 'pay-error', role: 'alert' }, note);
  box.replaceChildren(
    el('p', { class: 'pay-app' }, data.app_name),
    el('p', { class: 'pay-what' }, data.description),
    el('p', { class: 'pay-amount' }, rupees(data.amount_paise)),
    payButton,
    status,
    el('a', { class: 'pay-cancel', href: data.cancel_url }, 'Cancel and go back')
  );
  payButton.addEventListener('click', async () => {
    payButton.disabled = true;
    status.textContent = '';
    try {
      await loadCheckout();
    } catch {
      payButton.disabled = false;
      status.textContent = 'The payment window could not be loaded. Please check your connection and try again.';
      return;
    }
    const checkout = new window.Razorpay({
      key: data.key_id,
      order_id: data.razorpay_order_id,
      amount: data.amount_paise,
      currency: data.currency,
      name: 'Walnut DataTech',
      description: data.description,
      prefill: data.prefill,
      theme: { color: '#6a4df5' },
      handler: (r) => {
        paid = true;
        confirm(data, r);
      },
      retry: { enabled: true },
      // Closing the window is never taken as cancelling: the payment may still have gone through.
      modal: { ondismiss: () => paid || recheck(data, failure || 'The payment was not completed. You have not been charged; you can try again.') },
    });
    let paid = false;
    let failure = '';
    // A failed attempt is shown in Razorpay's window, where the buyer can try again; kept for when it closes.
    checkout.on('payment.failed', (e) => {
      failure = `${e?.error?.description || 'The payment did not go through.'} You can try again.`;
    });
    checkout.open();
    payButton.disabled = false;
  });
}

// Paid, expired, or still to pay.
function show(data) {
  if (data.status === 'paid') return message('This has been paid', 'Thank you — there is nothing more to pay.', { href: data.continue_url, label: 'Continue' });
  if (data.status === 'expired') return message('This payment link has expired', 'Please go back and start your payment again. If money was deducted, it is safe: contact us with your payment reference.', { href: data.continue_url, label: 'Go back' });
  ready(data);
}

async function start() {
  if (!box) return;
  if (!/^pi_[a-z2-7]{26}$/.test(id)) return message('This payment link is not valid', 'Please go back and start your payment again.');
  let data;
  try {
    const answer = await lookup(false);
    data = answer.data;
    if (answer.res.status === 404) return message('This payment link is not valid', 'Please go back and start your payment again.');
    if (!answer.res.ok) throw new Error(data?.error);
  } catch (err) {
    return message('Payments are not available right now', err?.message || 'Please try again in a few minutes.');
  }
  if (data.status === 'paid' && data.continue_url) return location.replace(data.continue_url);
  show(data);
  // Then, quietly, Razorpay too: on a phone the page is often reloaded after paying in a UPI app.
  if (data.status === 'created') recheck(data, '');
  // Back on this tab (from a UPI app or a bank's page): look again, quietly.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !box.querySelector('.pay-state')) recheck(data, '');
  });
}

start();
