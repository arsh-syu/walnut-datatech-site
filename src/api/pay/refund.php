<?php
// POST ?id=pi_… { refund_reference, amount_paise | null (all that is left), reason } → refunds a paid intent
// through Razorpay. Signed by the intent's own app over the raw body. refund_reference makes it safe to
// repeat: the same reference answers with the refund already made, never a second one. Razorpay settles a
// refund later; the app hears "payment.refunded" when it has.
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
    respond(503, ['error' => 'Payments are not set up yet.']);
}
pay_after($config, $db);
$raw = (string) file_get_contents('php://input');
$intent = pay_intent($db, is_string($_GET['id'] ?? null) ? $_GET['id'] : '');
$app = $intent ? (pay_apps($config)[$intent['app_id']] ?? null) : null;
if (!$app || !pay_signed($app['secret'], $raw)) {
    respond(404, ['error' => 'Not found.']);
}
$in = json_decode($raw, true);
$refRef = is_array($in) ? ($in['refund_reference'] ?? null) : null;
$amount = is_array($in) ? ($in['amount_paise'] ?? null) : null;
$reason = is_array($in) && is_string($in['reason'] ?? null) ? text_cut(trim($in['reason']), 200) : '';
if (!is_string($refRef) || !preg_match('/^[A-Za-z0-9._-]{1,64}\z/', $refRef)) {
    respond(400, ['error' => 'refund_reference must be 1–64 letters, digits, dots, dashes or underscores.', 'field' => 'refund_reference']);
}
$view = function (array $refund) use ($db, $intent) {
    $now = db_row($db, 'SELECT * FROM wa_pay_intents WHERE intent_id = ?', [$intent['intent_id']]);
    return ['refund_reference' => $refund['refund_reference'], 'refund_status' => $refund['status'], 'refund_amount_paise' => (int) $refund['amount'], 'razorpay_refund_id' => $refund['razorpay_refund_id']] + pay_view($now);
};

// Razorpay's own record of this refund, found by the reference in its notes — for a call whose answer was
// lost (a timeout), so the outcome is learnt rather than guessed.
$find = function () use ($config, $intent, $refRef): ?array {
    [$status, $data] = pay_razorpay($config, 'GET', '/payments/' . rawurlencode($intent['payment_id']) . '/refunds?count=100');
    foreach ($status === 200 && is_array($data['items'] ?? null) ? $data['items'] : [] as $r) {
        if (is_array($r) && ($r['notes']['refund_reference'] ?? null) === $refRef && is_string($r['id'] ?? null)) {
            return $r;
        }
    }
    return null;
};
$adopt = function (array $refund, array $r) use ($db) {
    db_run($db, "UPDATE wa_pay_refunds SET razorpay_refund_id = ?, status = 'pending', updated_at = ? WHERE id = ?", [$r['id'], utc(), $refund['id']]);
    $refund = db_row($db, 'SELECT * FROM wa_pay_refunds WHERE id = ?', [$refund['id']]);
    if (($r['status'] ?? '') === 'processed') {
        pay_refund_settled($db, $refund, 'processed');
    }
    return db_row($db, 'SELECT * FROM wa_pay_refunds WHERE id = ?', [$refund['id']]);
};

// The same refund_reference again: the refund already made — or, if the first call's outcome was never
// heard, what Razorpay says about it.
$same = db_row($db, 'SELECT * FROM wa_pay_refunds WHERE intent_id = ? AND refund_reference = ?', [$intent['intent_id'], $refRef]);
if ($same && $same['status'] === 'requesting' && $intent['payment_id']) {
    $found = $find();
    if ($found) {
        respond(200, $view($adopt($same, $found)));
    }
    if (strtotime($same['created_at'] . ' UTC') > time() - 120) {
        respond(409, ['error' => 'This refund is still being made. Ask again in a couple of minutes.', 'refund_reference' => $refRef]);
    }
    // Razorpay has no record of it two minutes on: the first call never reached it, so it is made now.
    $refund = $same;
    $amount = (int) $same['amount'];
} elseif ($same) {
    respond(200, $view($same));
}
if (!isset($refund)) {
    if (!in_array($intent['status'], ['paid', 'refund_pending', 'partially_refunded'], true) || !$intent['payment_id']) {
        respond(409, ['error' => 'Only a paid intent can be refunded.', 'status' => $intent['status']]);
    }
    // What is left to refund: the amount paid, less refunds made, pending, or still being made.
    $taken = (int) db_row($db, "SELECT COALESCE(SUM(amount), 0) AS n FROM wa_pay_refunds WHERE intent_id = ? AND status IN ('requesting', 'pending', 'processed')", [$intent['intent_id']])['n'];
    $left = (int) $intent['amount'] - $taken;
    if ($amount === null) {
        $amount = $left;
    }
    if (!is_int($amount) || $amount < 100 || $amount > $left) {
        respond(400, ['error' => "amount_paise must be between 100 and the $left paise left to refund, or null for all of it.", 'field' => 'amount_paise']);
    }
    // Recorded before Razorpay is called, so a retry of a call whose answer was lost finds it and never
    // refunds twice.
    try {
        db_run($db, 'INSERT INTO wa_pay_refunds (intent_id, refund_reference, amount, reason, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [$intent['intent_id'], $refRef, $amount, $reason !== '' ? $reason : null, 'requesting', utc(), utc()]);
    } catch (Throwable $e) {
        respond(409, ['error' => 'This refund is already being made.', 'refund_reference' => $refRef]);
    }
    $refund = db_row($db, 'SELECT * FROM wa_pay_refunds WHERE intent_id = ? AND refund_reference = ?', [$intent['intent_id'], $refRef]);
}
[$status, $data] = pay_razorpay($config, 'POST', '/payments/' . rawurlencode($intent['payment_id']) . '/refund', [
    'amount' => $amount,
    'notes' => ['intent_id' => $intent['intent_id'], 'refund_reference' => $refRef],
]);
if ($status !== 200 || !is_string($data['id'] ?? null)) {
    // A clear refusal (4xx) is final. No answer, or a server error, may still have made the refund: the
    // record stays "requesting" and the next call with this refund_reference finds out from Razorpay.
    if ($status >= 400 && $status < 500) {
        db_run($db, "UPDATE wa_pay_refunds SET status = 'failed', updated_at = ? WHERE id = ?", [utc(), $refund['id']]);
        respond(502, ['error' => 'Razorpay refused the refund: ' . lms_text(is_array($data) ? ($data['error']['description'] ?? '') : '', 150), 'refund_reference' => $refRef]);
    }
    respond(502, ['error' => 'Razorpay did not answer. Repeat this request with the same refund_reference to learn the outcome; it will not refund twice.', 'refund_reference' => $refRef]);
}
db_run($db, "UPDATE wa_pay_refunds SET razorpay_refund_id = ?, status = 'pending', updated_at = ? WHERE id = ?", [$data['id'], utc(), $refund['id']]);
db_run($db, "UPDATE wa_pay_intents SET status = 'refund_pending', updated_at = ? WHERE intent_id = ?", [utc(), $intent['intent_id']]);
$refund = db_row($db, 'SELECT * FROM wa_pay_refunds WHERE id = ?', [$refund['id']]);
// Razorpay sometimes settles a refund at once.
if (($data['status'] ?? '') === 'processed') {
    pay_refund_settled($db, $refund, 'processed');
    $refund = db_row($db, 'SELECT * FROM wa_pay_refunds WHERE id = ?', [$refund['id']]);
}
respond(202, $view($refund));
