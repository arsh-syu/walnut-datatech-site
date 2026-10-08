<?php
// POST from Razorpay (set up in the Razorpay dashboard: Settings → Webhooks, this URL, the secret in .env as
// RAZORPAY_WEBHOOK_SECRET, and the events payment.authorized, payment.captured, payment.failed, order.paid,
// refund.processed and refund.failed). The source of truth for payments: it also covers a buyer who paid and
// closed the tab.
declare(strict_types=1);
require __DIR__ . '/../lib.php';
require __DIR__ . '/../account-lib.php';
require __DIR__ . '/../pay-lib.php';

$config = load_config();
$raw = (string) file_get_contents('php://input');
$secret = (string) ($config['rzp_webhook_secret'] ?? '');
$signature = (string) ($_SERVER['HTTP_X_RAZORPAY_SIGNATURE'] ?? '');
if ($secret === '' || !hash_equals(hash_hmac('sha256', $raw, $secret), $signature)) {
    respond(401, ['error' => 'Invalid signature.']);
}
$db = pay_configured($config) && accounts_configured($config) ? account_db($config) : null;
if (!$db) {
    respond(503, ['error' => 'Try again later.']); // Razorpay retries
}
pay_after($config, $db);
$event = json_decode($raw, true);
$name = is_array($event) && is_string($event['event'] ?? null) ? $event['event'] : '';
$eventId = (string) ($_SERVER['HTTP_X_RAZORPAY_EVENT_ID'] ?? '');
$eventId = preg_match('/^[A-Za-z0-9_-]{1,64}\z/', $eventId) ? $eventId : '';
// Every change below happens at most once whatever arrives, so an event seen before needs no work. One not
// yet seen is recorded only after it has been handled, so a failure halfway is retried by Razorpay.
if ($eventId !== '' && db_row($db, 'SELECT event_id FROM wa_pay_events WHERE event_id = ?', [$eventId])) {
    respond(200, ['ok' => true, 'repeat' => true]);
}
$payment = $event['payload']['payment']['entity'] ?? null;
$refundEntity = $event['payload']['refund']['entity'] ?? null;
$intentFor = function (?array $p) use ($db): ?array {
    return is_array($p) && is_string($p['order_id'] ?? null) ? db_row($db, 'SELECT * FROM wa_pay_intents WHERE razorpay_order_id = ?', [$p['order_id']]) : null;
};

try {
    if (in_array($name, ['payment.captured', 'order.paid', 'payment.authorized'], true)) {
        $intent = $intentFor($payment);
        if ($intent && (int) ($payment['amount'] ?? 0) === (int) $intent['amount']) {
            if (($payment['status'] ?? '') === 'authorized') {
                $payment = pay_capture($config, $payment) ?? $payment;
            }
            if (($payment['status'] ?? '') === 'captured') {
                pay_mark_paid($db, $intent, (string) $payment['id'], $payment['method'] ?? null);
            }
        }
    } elseif ($name === 'payment.failed') {
        // Not the end: the buyer can try again on the same order. Kept for the app to show.
        $intent = $intentFor($payment);
        if ($intent) {
            pay_note_failure($db, $intent['intent_id'], (string) ($payment['error_description'] ?? $payment['error_reason'] ?? 'The payment did not go through.'));
        }
    } elseif (in_array($name, ['refund.processed', 'refund.failed'], true) && is_array($refundEntity) && is_string($refundEntity['id'] ?? null)) {
        $refund = db_row($db, 'SELECT * FROM wa_pay_refunds WHERE razorpay_refund_id = ?', [$refundEntity['id']]);
        if ($refund) {
            pay_refund_settled($db, $refund, $name === 'refund.processed' ? 'processed' : 'failed');
        }
    }
    if ($eventId !== '') {
        db_run($db, 'INSERT INTO wa_pay_events (event_id, received_at) VALUES (?, ?)', [$eventId, utc()]);
    }
} catch (Throwable $e) {
    error_log('Razorpay webhook ' . $name . ' was not handled: ' . $e->getMessage());
    respond(500, ['error' => 'Try again.']); // Razorpay retries; nothing above happens twice
}
respond(200, ['ok' => true]);
