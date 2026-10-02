<?php
// POST { razorpay_order_id, razorpay_payment_id, razorpay_signature } → confirms the payment is genuine.
// Razorpay signs "order_id|payment_id" with the key secret; a matching signature proves the payment.
declare(strict_types=1);
require __DIR__ . '/lib.php';

$in = read_post();
$orderId = is_string($in['razorpay_order_id'] ?? null) ? $in['razorpay_order_id'] : '';
$paymentId = is_string($in['razorpay_payment_id'] ?? null) ? $in['razorpay_payment_id'] : '';
$signature = is_string($in['razorpay_signature'] ?? null) ? $in['razorpay_signature'] : '';

if (!preg_match('/^order_[A-Za-z0-9]{6,40}$/', $orderId)
    || !preg_match('/^pay_[A-Za-z0-9]{6,40}$/', $paymentId)
    || !preg_match('/^[a-f0-9]{64}$/', $signature)) {
    respond(400, ['ok' => false, 'error' => 'Invalid payment details.']);
}

$config = load_config();
$expected = hash_hmac('sha256', $orderId . '|' . $paymentId, $config['key_secret']);
if (!hash_equals($expected, $signature)) {
    respond(400, ['ok' => false, 'error' => 'We could not verify this payment. If money was deducted, please contact us with your payment reference.']);
}

respond(200, ['ok' => true, 'payment_id' => $paymentId, 'order_id' => $orderId]);
