<?php
// POST → a payment intent, for an app's server: what to pay for, by whom, and where to send the buyer back.
// Signed with the app's secret over the raw body (see pay-lib.php). The Razorpay order is created here, with
// the amount given here, so nothing in the buyer's browser can change what is charged.
// Answers 201 with a new intent, 200 with the open one already made for this reference, 409 when that
// reference is paid or was used for another amount, 400 for anything malformed, 401 for a bad signature.
declare(strict_types=1);
require __DIR__ . '/../lib.php';
require __DIR__ . '/../account-lib.php';
require __DIR__ . '/../pay-lib.php';

$config = load_config();
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(405, ['error' => 'POST only.']);
}
if (!pay_configured($config) || !accounts_configured($config)) {
    respond(503, ['error' => 'Payments are not set up yet.']);
}
$raw = (string) file_get_contents('php://input');
$in = json_decode($raw, true);
$app = pay_apps($config)[is_array($in) ? (string) ($in['app_id'] ?? '') : ''] ?? null;
if (!$app || !pay_signed($app['secret'], $raw)) {
    respond(401, ['error' => 'Invalid or missing signature.']);
}

// Every field, checked.
$bad = function (string $field, string $why) {
    respond(400, ['error' => $why, 'field' => $field]);
};
$appId = (string) $in['app_id'];
$reference = $in['reference'] ?? null;
$amount = $in['amount_paise'] ?? null;
$currency = $in['currency'] ?? 'INR';
$description = is_string($in['description'] ?? null) ? trim($in['description']) : '';
$customer = is_array($in['customer'] ?? null) ? $in['customer'] : [];
$email = is_string($customer['email'] ?? null) ? trim($customer['email']) : '';
$name = is_string($customer['name'] ?? null) ? trim($customer['name']) : '';
$phone = $customer['phone'] ?? null;
$accountId = $customer['account_id'] ?? null;
$metadata = $in['metadata'] ?? [];
$expiresIn = $in['expires_in_sec'] ?? 1800;
if (!is_string($reference) || !preg_match('/^[A-Za-z0-9._-]{1,64}\z/', $reference)) $bad('reference', 'reference must be 1–64 letters, digits, dots, dashes or underscores.');
if (!is_int($amount) || $amount < 100 || $amount > 50000000) $bad('amount_paise', 'amount_paise must be a whole number of paise, at least 100.');
if ($currency !== 'INR') $bad('currency', 'Only INR is accepted.');
if ($description === '' || strlen($description) > 120) $bad('description', 'description must be 1–120 characters.');
if (strlen($email) > 191 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) $bad('customer.email', 'customer.email must be a valid email address.');
if (strlen($name) > 120) $bad('customer.name', 'customer.name must be at most 120 characters.');
if ($phone !== null && (!is_string($phone) || !preg_match('/^\+?[0-9]{8,15}\z/', $phone))) $bad('customer.phone', 'customer.phone must be a phone number, or null.');
if ($accountId !== null && (!is_string($accountId) || !preg_match('/^[0-9a-f-]{36}\z/i', $accountId))) $bad('customer.account_id', 'customer.account_id must be a UUID, or null.');
if (!pay_return_ok($app, $in['return_url'] ?? null)) $bad('return_url', 'return_url must be https on one of your registered origins.');
if (!pay_return_ok($app, $in['cancel_url'] ?? null)) $bad('cancel_url', 'cancel_url must be https on one of your registered origins.');
if (!is_int($expiresIn) || $expiresIn < 300 || $expiresIn > 86400) $bad('expires_in_sec', 'expires_in_sec must be 300–86400.');
// metadata is echoed back in every callback: flat, small, strings and numbers only
if (!is_array($metadata) || ($metadata !== [] && array_keys($metadata) === range(0, count($metadata) - 1))) $bad('metadata', 'metadata must be a JSON object.');
foreach ($metadata as $k => $v) {
    if (!is_string($k) || !(is_string($v) || is_int($v) || is_float($v))) $bad('metadata', 'metadata values must be strings or numbers.');
}
$metaJson = json_encode((object) $metadata, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
if (strlen($metaJson) > 2048) $bad('metadata', 'metadata must be at most 2 KB.');

$db = account_db($config);
if (!$db) {
    respond(503, ['error' => 'The payment ledger is unavailable. Please try again.']);
}
pay_after($config, $db);

$answer = function (int $status, array $intent) use ($config) {
    respond($status, [
        'intent_id' => $intent['intent_id'],
        'status' => $intent['status'],
        'pay_url' => rtrim((string) ($config['site_url'] ?? 'https://walnutdatatech.com'), '/') . '/pay/?i=' . $intent['intent_id'],
        'razorpay_order_id' => $intent['razorpay_order_id'],
        'expires_at' => iso($intent['expires_at']),
    ]);
};

// One open or paid intent per reference. The same request again gets that intent back; a different amount
// for the same reference is a conflict; an open intent whose time is up gives way to a new one.
$existing = db_row($db, 'SELECT * FROM wa_pay_intents WHERE open_key = ?', [$appId . '|' . $reference]);
if ($existing) {
    if (in_array($existing['status'], ['paid', 'refund_pending', 'refunded', 'partially_refunded'], true)) {
        respond(409, ['error' => 'This reference is already paid.', 'status' => 'paid', 'intent_id' => $existing['intent_id']]);
    }
    if ((int) $existing['amount'] !== $amount || $existing['currency'] !== $currency) {
        respond(409, ['error' => 'reference_conflict', 'intent_id' => $existing['intent_id']]);
    }
    if (strtotime($existing['expires_at'] . ' UTC') > time() + 60) {
        $answer(200, $existing);
    }
    // nearly or already expired: if it was paid after all, say so; otherwise it gives the reference up
    if (pay_settle_from_razorpay($config, $db, $existing)) {
        respond(409, ['error' => 'This reference is already paid.', 'status' => 'paid', 'intent_id' => $existing['intent_id']]);
    }
    if (db_run($db, "UPDATE wa_pay_intents SET status = 'expired', open_key = NULL, updated_at = ? WHERE intent_id = ? AND status = 'created'", [utc(), $existing['intent_id']])->rowCount() === 1) {
        pay_queue($db, $existing['intent_id'], 'payment.expired');
    }
}

$intentId = pay_new_id();
[$status, $order] = pay_razorpay($config, 'POST', '/orders', [
    'amount' => $amount,
    'currency' => $currency,
    'receipt' => $intentId,
    'notes' => ['intent_id' => $intentId, 'app_id' => $appId, 'reference' => $reference],
]);
if ($status !== 200 || !is_string($order['id'] ?? null)) {
    respond(502, ['error' => 'The payment service could not create the order. Please try again.']);
}
try {
    db_run($db, 'INSERT INTO wa_pay_intents (intent_id, app_id, reference, open_key, amount, currency, description, customer_email, customer_name, customer_phone, customer_account_id, return_url, cancel_url, metadata, status, razorpay_order_id, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        $intentId, $appId, $reference, $appId . '|' . $reference, $amount, $currency, $description, strtolower($email), $name !== '' ? $name : null, $phone, $accountId,
        $in['return_url'], $in['cancel_url'], $metaJson, 'created', $order['id'], gmdate('Y-m-d H:i:s', time() + $expiresIn), utc(), utc(),
    ]);
} catch (Throwable $e) {
    // the same reference arrived twice at once: the other request made the intent
    $twin = db_row($db, 'SELECT * FROM wa_pay_intents WHERE open_key = ?', [$appId . '|' . $reference]);
    if ($twin && (int) $twin['amount'] === $amount) {
        $answer(200, $twin);
    }
    error_log('Payment intent was not recorded: ' . $e->getMessage());
    respond(500, ['error' => 'The intent could not be recorded. Please try again.']);
}
$answer(201, db_row($db, 'SELECT * FROM wa_pay_intents WHERE intent_id = ?', [$intentId]));
