<?php
// GET ?i=pi_… → what the pay page needs: what is being paid for, how much, and the Razorpay order to open.
// Public — the pay link is the key, so the intent id is unguessable and the details are only what checkout
// shows anyway. The buyer's details (to fill in Razorpay's form) are given only while the intent is open.
declare(strict_types=1);
require __DIR__ . '/../lib.php';
require __DIR__ . '/../account-lib.php';
require __DIR__ . '/../pay-lib.php';

$config = load_config();
$db = pay_configured($config) && accounts_configured($config) ? account_db($config) : null;
if (!$db) {
    respond(503, ['error' => 'Payments are not available right now. Please try again later.']);
}
rate_limit('pay-checkout', 60, 600);
pay_after($config, $db);
$intent = pay_intent($db, is_string($_GET['i'] ?? null) ? $_GET['i'] : '');
$app = $intent ? (pay_apps($config)[$intent['app_id']] ?? null) : null;
if (!$intent || !$app) {
    respond(404, ['error' => 'This payment link is not valid.']);
}
$back = ['intent' => $intent['intent_id']];
$base = [
    'intent_id' => $intent['intent_id'],
    'app_name' => $app['name'],
    'description' => $intent['description'],
    'amount_paise' => (int) $intent['amount'],
    'currency' => $intent['currency'],
];
if ($intent['status'] !== 'created') {
    $paid = $intent['status'] !== 'expired';
    respond(200, $base + [
        'status' => $paid ? 'paid' : 'expired',
        'continue_url' => pay_url_with($paid ? $intent['return_url'] : $intent['cancel_url'], $back + ['status' => $paid ? 'paid' : 'cancelled']),
    ]);
}
if (strtotime($intent['expires_at'] . ' UTC') <= time()) {
    respond(200, $base + ['status' => 'expired', 'continue_url' => pay_url_with($intent['cancel_url'], $back + ['status' => 'cancelled'])]);
}
respond(200, $base + [
    'status' => 'created',
    'key_id' => $config['key_id'],
    'razorpay_order_id' => $intent['razorpay_order_id'],
    'expires_at' => iso($intent['expires_at']),
    'prefill' => ['name' => (string) $intent['customer_name'], 'email' => $intent['customer_email'], 'contact' => (string) $intent['customer_phone']],
    'cancel_url' => pay_url_with($intent['cancel_url'], $back + ['status' => 'cancelled']),
]);
