<?php
// POST { course, coupon?, name, email, phone } → a Razorpay order for the correct amount.
// The amount is always computed here from catalog.php — never taken from the browser.
declare(strict_types=1);
require __DIR__ . '/lib.php';

$in = read_post();
$catalog = require __DIR__ . '/catalog.php';

$slug = is_string($in['course'] ?? null) ? $in['course'] : '';
if (!isset($catalog['courses'][$slug])) {
    respond(404, ['error' => 'This course is not available.']);
}
$course = $catalog['courses'][$slug];

$name = trim(is_string($in['name'] ?? null) ? $in['name'] : '');
$email = trim(is_string($in['email'] ?? null) ? $in['email'] : '');
$phone = trim(is_string($in['phone'] ?? null) ? $in['phone'] : '');
if (strlen($name) < 2 || strlen($name) > 120) {
    respond(422, ['error' => 'Please enter your name.', 'field' => 'name']);
}
if (strlen($email) > 254 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    respond(422, ['error' => 'Please enter a valid email address.', 'field' => 'email']);
}
$digits = preg_replace('/\D+/', '', $phone);
if (strlen((string) $digits) < 7 || strlen((string) $digits) > 15) {
    respond(422, ['error' => 'Please enter a valid phone number.', 'field' => 'phone']);
}

// A coupon only applies to the course it is listed under.
$amount = (int) $course['price'];
$coupon = strtoupper(trim(is_string($in['coupon'] ?? null) ? $in['coupon'] : ''));
if ($coupon !== '') {
    if (!isset($course['coupons'][$coupon])) {
        respond(422, ['error' => 'Invalid or inapplicable coupon code. Please check and try again.', 'field' => 'coupon']);
    }
    $amount = (int) $course['coupons'][$coupon];
}

$config = load_config();
require_payments($config);
rate_limit('create-order', 20, 600);
$order = razorpay('POST', '/orders', [
    'amount' => $amount * 100, // paise
    'currency' => $catalog['currency'],
    'receipt' => substr($slug, 0, 24) . '-' . bin2hex(random_bytes(6)),
    'notes' => [
        'course' => $course['name'],
        'slug' => $slug,
        'coupon' => $coupon !== '' ? $coupon : 'none',
        'name' => $name,
        'email' => $email,
        'phone' => $phone,
    ],
], $config);

respond(200, [
    'order_id' => $order['id'],
    'amount' => $order['amount'],
    'currency' => $order['currency'],
    'key_id' => $config['key_id'],
    'course' => $course['name'],
]);
