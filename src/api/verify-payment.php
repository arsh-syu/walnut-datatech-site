<?php
// POST { razorpay_order_id, razorpay_payment_id, razorpay_signature } → confirms the payment is genuine.
// Razorpay signs "order_id|payment_id" with the key secret; a matching signature proves the payment.
// Once verified, the learner gets a confirmation email and the team a notification.
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
require_payments($config);
rate_limit('verify-payment', 30, 600);
$expected = hash_hmac('sha256', $orderId . '|' . $paymentId, $config['key_secret']);
if (!hash_equals($expected, $signature)) {
    respond(400, ['ok' => false, 'error' => 'We could not verify this payment. If money was deducted, please contact us with your payment reference.']);
}

// The payment is genuine. Emails are a courtesy on top: nothing below may fail the response.
// Learner details come from the order stored at Razorpay, never from the browser.
if (email_configured($config) && first_time('enrolment-' . $paymentId)) {
    $order = razorpay('GET', '/orders/' . $orderId, null, $config, false);
    $notes = isset($order['notes']) && is_array($order['notes']) ? $order['notes'] : [];
    $email = (string) ($notes['email'] ?? '');
    if (filter_var($email, FILTER_VALIDATE_EMAIL) !== false) {
        $name = (string) ($notes['name'] ?? '');
        $coupon = (string) ($notes['coupon'] ?? 'none');
        $vars = [
            'name' => $name,
            'email' => $email,
            'course' => (string) ($notes['course'] ?? 'your course'),
            'slug' => (string) ($notes['slug'] ?? ''),
        ];
        $rows = [
            ['Course', $vars['course']],
            ['Amount paid', '₹' . number_format(((int) ($order['amount'] ?? 0)) / 100)],
            ['Coupon', $coupon === 'none' ? '' : $coupon],
            ['Payment reference', $paymentId],
        ];
        send_email($config, 'enrol_confirm', $email, $name, $vars, $rows);
        send_email($config, 'enrol_notify', $config['email_notify'], 'Walnut Data Tech', $vars, array_merge($rows, [
            ['Order reference', $orderId],
            ['Name', $name],
            ['Email', $email],
            ['Phone', (string) ($notes['phone'] ?? '')],
        ]));
    }
}

respond(200, ['ok' => true, 'payment_id' => $paymentId, 'order_id' => $orderId]);
