<?php
// GET ?id=pi_… → an intent as its app sees it (the same object as the callbacks, with its status).
// Signed with the app's secret over the path and query exactly as received. An app sees only its own intents;
// any other id answers 404, as an unknown one does.
declare(strict_types=1);
require __DIR__ . '/../lib.php';
require __DIR__ . '/../account-lib.php';
require __DIR__ . '/../pay-lib.php';

$config = load_config();
$db = pay_configured($config) && accounts_configured($config) ? account_db($config) : null;
if (!$db) {
    respond(503, ['error' => 'Payments are not set up yet.']);
}
pay_after($config, $db);
$intent = pay_intent($db, is_string($_GET['id'] ?? null) ? $_GET['id'] : '');
$app = $intent ? (pay_apps($config)[$intent['app_id']] ?? null) : null;
// Checked against the intent's own app, so a valid signature from another app still finds nothing.
if (!$app || !pay_signed($app['secret'], (string) ($_SERVER['REQUEST_URI'] ?? ''))) {
    respond(404, ['error' => 'Not found.']);
}
// The buyer may have landed on the return page before Razorpay's webhook: an open intent is checked with
// Razorpay first, so a buyer who has just paid is never told the payment is pending.
if ($intent['status'] === 'created' && pay_settle_from_razorpay($config, $db, $intent)) {
    $intent = pay_intent($db, $intent['intent_id']);
}
respond(200, pay_view($intent));
