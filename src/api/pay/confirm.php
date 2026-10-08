<?php
// POST { intent_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } → from the pay page when
// Razorpay's checkout reports success. The signature proves the payment belongs to this intent's order; the
// payment is then checked with Razorpay itself (amount, and captured — an authorised one is captured here)
// before the intent is marked paid. Razorpay's webhook may get there first; either way it happens once.
// Answers { ok, redirect }: the app's return URL, with ?intent=…&status=paid.
declare(strict_types=1);
require __DIR__ . '/../lib.php';
require __DIR__ . '/../account-lib.php';
require __DIR__ . '/../pay-lib.php';

$config = load_config();
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(405, ['error' => 'POST only.']);
}
$db = pay_configured($config) && accounts_configured($config) ? account_db($config) : null;
if (!$db) {
    respond(503, ['error' => 'We could not confirm your payment right now. If money was deducted, it is safe: please contact us with your payment reference.']);
}
rate_limit('pay-confirm', 30, 600);
pay_after($config, $db);
$in = read_post();
$intent = pay_intent($db, is_string($in['intent_id'] ?? null) ? $in['intent_id'] : '');
$orderId = is_string($in['razorpay_order_id'] ?? null) ? $in['razorpay_order_id'] : '';
$paymentId = is_string($in['razorpay_payment_id'] ?? null) ? $in['razorpay_payment_id'] : '';
$signature = is_string($in['razorpay_signature'] ?? null) ? $in['razorpay_signature'] : '';
if (!$intent || $orderId !== $intent['razorpay_order_id'] || !preg_match('/^pay_[A-Za-z0-9]{6,30}\z/', $paymentId)) {
    respond(400, ['error' => 'These payment details do not match this payment link.']);
}
if (!hash_equals(hash_hmac('sha256', $orderId . '|' . $paymentId, (string) $config['key_secret']), $signature)) {
    respond(400, ['error' => 'We could not verify this payment. If money was deducted, it is safe: please contact us with your payment reference ' . $paymentId . '.']);
}
$done = function () use ($db, $intent) {
    $now = pay_intent($db, $intent['intent_id']);
    respond(200, ['ok' => true, 'redirect' => pay_url_with($now['return_url'], ['intent' => $now['intent_id'], 'status' => 'paid'])]);
};
if ($intent['payment_id'] === $paymentId) {
    $done(); // already marked paid (by the webhook, or an earlier confirm)
}
// What Razorpay itself says about this payment.
[$status, $payment] = pay_razorpay($config, 'GET', '/payments/' . rawurlencode($paymentId));
if ($status !== 200 || ($payment['order_id'] ?? '') !== $orderId || (int) ($payment['amount'] ?? 0) !== (int) $intent['amount']) {
    respond(502, ['error' => 'Your payment is being confirmed. If money was deducted, it is safe: we will complete it shortly. Payment reference ' . $paymentId . '.']);
}
if (($payment['status'] ?? '') === 'authorized') {
    $payment = pay_capture($config, $payment) ?? $payment;
}
if (($payment['status'] ?? '') !== 'captured') {
    respond(502, ['error' => 'Your payment is being confirmed. If money was deducted, it is safe: we will complete it shortly. Payment reference ' . $paymentId . '.']);
}
pay_mark_paid($db, $intent, $paymentId, $payment['method'] ?? null);
$done();
