<?php
// The Walnut payment gateway. Every Walnut product (an "app") takes its payments here, on walnutdatatech.com,
// the website registered with Razorpay. The app creates an intent with a signed call from its server; the
// buyer pays on /pay/; this site confirms the payment (the checkout's signature, and Razorpay's webhook as
// the source of truth), keeps the ledger (wa_pay_intents) and tells the app with a signed callback, retried
// until the app answers. The app never sees a Razorpay key, and the browser never sets an amount.
//
// The contract with the apps (v1.1) is described in README.md. Calls from an app are signed like every other
// Walnut integration: X-Walnut-Timestamp (unix seconds, within 5 minutes) and X-Walnut-Signature:
// sha256=<hex HMAC-SHA256 of "<timestamp>.<signed>">, where <signed> is the raw body, or for a GET the path
// and query exactly as received; each app has its own secret.
declare(strict_types=1);

// How long after an intent's expiry its Razorpay order is checked once more before it is declared expired,
// so a buyer who paid in the last minute (or whose webhook is late) is not turned away.
const PAY_GRACE = 600;
// Callback retries: how long to wait after each failed attempt, then every 6 hours for a week.
const PAY_RETRY = [60, 120, 300, 900, 1800, 3600, 7200, 21600];
const PAY_RETRY_FOR = 7 * 86400;

// The apps that may take payments here. Each signs its calls with its own secret (config pay_secret_<id>,
// from WALNUT_PAY_SECRET_<ID> in .env), so one app can never act for another. Only an app whose secret is
// set is open. A buyer is only ever sent back to one of the app's own origins.
function pay_apps(array $config): array
{
    $apps = [
        'walnut-lms' => [
            'name' => 'Walnut LMS',
            'return_origins' => ['https://walnut-lms.vercel.app', 'https://lms.walnutdatatech.com'],
            'callback_url' => (string) ($config['pay_callback_walnut_lms'] ?? 'https://walnut-lms.vercel.app/api/payments/walnut/callback'),
            'secret' => (string) ($config['pay_secret_walnut_lms'] ?? ''),
        ],
    ];
    return array_filter($apps, function (array $app): bool {
        return $app['secret'] !== '';
    });
}

// The gateway can take payments: Razorpay keys, the webhook secret, and at least one app.
function pay_configured(array $config): bool
{
    return !empty($config['key_id']) && !empty($config['key_secret']) && !empty($config['rzp_webhook_secret']) && pay_apps($config) !== [];
}

/* ---------- signing ---------- */

function pay_signature(string $secret, string $ts, string $signed): string
{
    return 'sha256=' . hash_hmac('sha256', $ts . '.' . $signed, $secret);
}

// Whether this request is signed by the app whose secret is given.
function pay_signed(string $secret, string $signed): bool
{
    $ts = (string) ($_SERVER['HTTP_X_WALNUT_TIMESTAMP'] ?? '');
    $sig = (string) ($_SERVER['HTTP_X_WALNUT_SIGNATURE'] ?? '');
    return $secret !== '' && preg_match('/^\d{9,11}\z/', $ts) === 1 && abs(time() - (int) $ts) <= 300 && hash_equals(pay_signature($secret, $ts, $signed), $sig);
}

/* ---------- Razorpay ---------- */

// One call to Razorpay's API: [HTTP status, decoded body or null]. Never exits and never logs a secret.
function pay_razorpay(array $config, string $method, string $path, ?array $payload = null): array
{
    if (!function_exists('curl_init')) {
        return [0, null];
    }
    $ch = curl_init(rtrim((string) ($config['razorpay_api'] ?? 'https://api.razorpay.com/v1'), '/') . $path);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_USERPWD => $config['key_id'] . ':' . $config['key_secret'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
    ]);
    if ($payload !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    }
    $body = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $data = is_string($body) ? json_decode($body, true) : null;
    if ($status < 200 || $status >= 300) {
        error_log('Razorpay ' . $method . ' ' . preg_replace('/[^\/a-zA-Z0-9_]/', '', $path) . ' answered HTTP ' . $status);
    }
    return [$status, is_array($data) ? $data : null];
}

/* ---------- intents ---------- */

// 128 random bits, base32: unguessable, since the pay link carries it.
function pay_new_id(): string
{
    $bits = '';
    foreach (str_split(random_bytes(17)) as $byte) {
        $bits .= str_pad(decbin(ord($byte)), 8, '0', STR_PAD_LEFT);
    }
    $id = '';
    foreach (str_split(substr($bits, 0, 130), 5) as $chunk) {
        $id .= 'abcdefghijklmnopqrstuvwxyz234567'[bindec($chunk)];
    }
    return 'pi_' . $id;
}

function pay_intent(PDO $db, string $intentId): ?array
{
    return preg_match('/^pi_[a-z2-7]{26}\z/', $intentId) === 1 ? db_row($db, 'SELECT * FROM wa_pay_intents WHERE intent_id = ?', [$intentId]) : null;
}

// What the app is told about an intent: in the status answer and in every callback.
function pay_view(array $i, ?string $event = null): array
{
    return ($event ? ['event' => $event] : []) + [
        'intent_id' => $i['intent_id'],
        'app_id' => $i['app_id'],
        'reference' => $i['reference'],
        'status' => $i['status'],
        'amount_paise' => (int) $i['amount'],
        'currency' => $i['currency'],
        'razorpay_order_id' => $i['razorpay_order_id'],
        'razorpay_payment_id' => $i['payment_id'],
        'method' => $i['method'],
        'last_failure_reason' => $i['last_failure_reason'],
        'refunded_amount_paise' => (int) $i['refunded_amount'],
        'paid_at' => $i['paid_at'] ? iso($i['paid_at']) : null,
        'expires_at' => iso($i['expires_at']),
        'metadata' => json_decode((string) $i['metadata'], true) ?: (object) [],
    ];
}

// A URL the app gave us, with our parameters added to its query.
function pay_url_with(string $url, array $params): string
{
    $hash = '';
    if (($at = strpos($url, '#')) !== false) {
        $hash = substr($url, $at);
        $url = substr($url, 0, $at);
    }
    return $url . (strpos($url, '?') === false ? '?' : '&') . http_build_query($params) . $hash;
}

// An app's return or cancel URL is accepted only when its origin is exactly one of the app's own: parsed,
// https, no user or password. (A prefix test would let https://app.example.evil.com through.)
function pay_return_ok(array $app, $url): bool
{
    if (!is_string($url) || strlen($url) > 500 || preg_match('/[\s\x00-\x1f\\\\]/', $url)) {
        return false;
    }
    $p = parse_url($url);
    if (!is_array($p) || ($p['scheme'] ?? '') !== 'https' || empty($p['host']) || isset($p['user']) || isset($p['pass'])) {
        return false;
    }
    $origin = 'https://' . strtolower($p['host']) . (isset($p['port']) ? ':' . $p['port'] : '');
    return in_array($origin, $app['return_origins'], true);
}

/* ---------- the state changes: each happens once ---------- */

// Paid: from the checkout's signature or the webhook, whichever comes first — the other changes nothing.
// A payment after expiry still counts (the money has moved); it gives the reference back its open slot
// only if no newer intent has taken it.
function pay_mark_paid(PDO $db, array $intent, string $paymentId, ?string $method): bool
{
    $done = db_run($db, "UPDATE wa_pay_intents SET status = 'paid', payment_id = ?, method = ?, paid_at = ?, updated_at = ? WHERE intent_id = ? AND status IN ('created', 'expired') AND payment_id IS NULL", [
        $paymentId, $method ? substr($method, 0, 30) : null, utc(), utc(), $intent['intent_id'],
    ])->rowCount() === 1;
    if ($done) {
        try {
            db_run($db, 'UPDATE wa_pay_intents SET open_key = ? WHERE intent_id = ? AND open_key IS NULL', [$intent['app_id'] . '|' . $intent['reference'], $intent['intent_id']]);
        } catch (Throwable $e) {
            // a newer intent holds the reference; this one is paid all the same
        }
        pay_queue($db, $intent['intent_id'], 'payment.paid');
    }
    return $done;
}

function pay_note_failure(PDO $db, string $intentId, string $reason): void
{
    db_run($db, "UPDATE wa_pay_intents SET last_failure_reason = ?, updated_at = ? WHERE intent_id = ? AND status = 'created'", [text_cut($reason, 200), utc(), $intentId]);
}

// A captured (or capturable) payment on this intent's order, if Razorpay says it has one.
function pay_settle_from_razorpay(array $config, PDO $db, array $intent): bool
{
    [$status, $data] = pay_razorpay($config, 'GET', '/orders/' . rawurlencode($intent['razorpay_order_id']) . '/payments');
    if ($status !== 200 || !is_array($data['items'] ?? null)) {
        return false;
    }
    foreach ($data['items'] as $p) {
        if (!is_array($p) || (int) ($p['amount'] ?? 0) !== (int) $intent['amount']) {
            continue;
        }
        if (($p['status'] ?? '') === 'authorized') {
            $p = pay_capture($config, $p) ?? $p;
        }
        if (($p['status'] ?? '') === 'captured') {
            pay_mark_paid($db, $intent, (string) $p['id'], $p['method'] ?? null);
            return true;
        }
    }
    return false;
}

// An authorised payment is captured here, so money is never left uncaptured whatever the account's setting.
function pay_capture(array $config, array $payment): ?array
{
    [$status, $data] = pay_razorpay($config, 'POST', '/payments/' . rawurlencode((string) $payment['id']) . '/capture', [
        'amount' => (int) $payment['amount'], 'currency' => (string) ($payment['currency'] ?? 'INR'),
    ]);
    return $status === 200 && is_array($data) ? $data : null;
}

/* ---------- callbacks to the apps ---------- */

// The callback is a snapshot of the intent at the moment it changed; it is sent at once and then retried.
function pay_queue(PDO $db, string $intentId, string $event, array $extra = []): void
{
    $intent = db_row($db, 'SELECT * FROM wa_pay_intents WHERE intent_id = ?', [$intentId]);
    if (!$intent) {
        return;
    }
    $body = json_encode(pay_view($intent, $event) + $extra, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    db_run($db, 'INSERT INTO wa_pay_callbacks (intent_id, event, body, next_at, created_at) VALUES (?, ?, ?, ?, ?)', [$intentId, $event, $body, utc(), utc()]);
}

// Sends the callbacks that are due, a few at a time, signed with the owning app's secret.
function pay_deliver(array $config, PDO $db, int $limit = 10): void
{
    $apps = pay_apps($config);
    $due = db_run($db, 'SELECT c.*, i.app_id FROM wa_pay_callbacks c JOIN wa_pay_intents i ON i.intent_id = c.intent_id WHERE c.delivered_at IS NULL AND c.next_at <= ? ORDER BY c.id LIMIT ' . $limit, [utc()])->fetchAll();
    $started = time();
    foreach ($due as $c) {
        if (time() - $started > 8) {
            break;
        }
        $app = $apps[$c['app_id']] ?? null;
        if (!$app || strtotime($c['created_at'] . ' UTC') < time() - PAY_RETRY_FOR) {
            db_run($db, 'UPDATE wa_pay_callbacks SET next_at = ?, last_error = ? WHERE id = ?', [gmdate('Y-m-d H:i:s', time() + 86400 * 365), $app ? 'given up after a week' : 'app not configured', $c['id']]);
            continue;
        }
        $ts = (string) time();
        $ch = curl_init($app['callback_url']);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $c['body'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_TIMEOUT => 6,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json', 'X-Walnut-Timestamp: ' . $ts, 'X-Walnut-Signature: ' . pay_signature($app['secret'], $ts, $c['body'])],
        ]);
        curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        if ($status >= 200 && $status < 300) {
            db_run($db, 'UPDATE wa_pay_callbacks SET delivered_at = ?, attempts = attempts + 1, last_error = NULL WHERE id = ?', [utc(), $c['id']]);
        } else {
            $wait = PAY_RETRY[min((int) $c['attempts'], count(PAY_RETRY) - 1)];
            db_run($db, 'UPDATE wa_pay_callbacks SET attempts = attempts + 1, next_at = ?, last_error = ? WHERE id = ?', [gmdate('Y-m-d H:i:s', time() + $wait), 'HTTP ' . $status, $c['id']]);
        }
    }
}

/* ---------- the sweep: runs after the gateway answers a request ---------- */

// Expires intents whose time is up (after checking Razorpay once more), and asks Razorpay about refunds
// still pending (in case a webhook was missed). At most every 30 seconds. (Callbacks are not waiting on
// this: pay_after sends the due ones after every request.)
function pay_sweep(array $config, PDO $db): void
{
    if (!pay_configured($config) || !due('pay-sweep', 30)) {
        return;
    }
    try {
        $stale = db_run($db, "SELECT * FROM wa_pay_intents WHERE status = 'created' AND expires_at < ? ORDER BY expires_at LIMIT 5", [gmdate('Y-m-d H:i:s', time() - PAY_GRACE)])->fetchAll();
        foreach ($stale as $intent) {
            if (pay_settle_from_razorpay($config, $db, $intent)) {
                continue;
            }
            $gone = db_run($db, "UPDATE wa_pay_intents SET status = 'expired', open_key = NULL, updated_at = ? WHERE intent_id = ? AND status = 'created'", [utc(), $intent['intent_id']])->rowCount() === 1;
            if ($gone) {
                pay_queue($db, $intent['intent_id'], 'payment.expired');
            }
        }
        foreach (db_run($db, "SELECT * FROM wa_pay_refunds WHERE status = 'pending' AND razorpay_refund_id IS NOT NULL ORDER BY id LIMIT 5")->fetchAll() as $refund) {
            [$status, $data] = pay_razorpay($config, 'GET', '/refunds/' . rawurlencode($refund['razorpay_refund_id']));
            if ($status === 200 && in_array($data['status'] ?? '', ['processed', 'failed'], true)) {
                pay_refund_settled($db, $refund, (string) $data['status']);
            }
        }
    } catch (Throwable $e) {
        error_log('Payment sweep stopped: ' . $e->getMessage());
    }
}

// After the response has gone to the caller, where the server allows it: the sweep (when its time has come),
// then every callback that is due — so an app hears of a payment the moment it is made, whatever the sweep's
// timer says, and of an expiry in the same request that found it.
function pay_after(array $config, ?PDO $db): void
{
    if (!$db) {
        return;
    }
    register_shutdown_function(function () use ($config, $db) {
        if (function_exists('fastcgi_finish_request')) {
            fastcgi_finish_request();
        } elseif (function_exists('litespeed_finish_request')) {
            litespeed_finish_request();
        }
        pay_sweep($config, $db);
        if (pay_configured($config)) {
            try {
                pay_deliver($config, $db);
            } catch (Throwable $e) {
                error_log('Payment callbacks stopped: ' . $e->getMessage());
            }
        }
    });
}

/* ---------- refunds ---------- */

// A refund Razorpay has finished: the intent's refunded amount and status follow, and the app is told.
function pay_refund_settled(PDO $db, array $refund, string $outcome): void
{
    $done = db_run($db, "UPDATE wa_pay_refunds SET status = ?, updated_at = ? WHERE id = ? AND status = 'pending'", [$outcome === 'processed' ? 'processed' : 'failed', utc(), $refund['id']])->rowCount() === 1;
    if (!$done) {
        return;
    }
    $intent = db_row($db, 'SELECT * FROM wa_pay_intents WHERE intent_id = ?', [$refund['intent_id']]);
    if (!$intent) {
        return;
    }
    $refunded = (int) db_row($db, "SELECT COALESCE(SUM(amount), 0) AS n FROM wa_pay_refunds WHERE intent_id = ? AND status = 'processed'", [$intent['intent_id']])['n'];
    $pending = (int) db_row($db, "SELECT COUNT(*) AS n FROM wa_pay_refunds WHERE intent_id = ? AND status = 'pending'", [$intent['intent_id']])['n'];
    $status = $pending ? 'refund_pending' : ($refunded >= (int) $intent['amount'] ? 'refunded' : ($refunded > 0 ? 'partially_refunded' : 'paid'));
    db_run($db, 'UPDATE wa_pay_intents SET refunded_amount = ?, status = ?, updated_at = ? WHERE intent_id = ?', [$refunded, $status, utc(), $intent['intent_id']]);
    if ($outcome === 'processed') {
        pay_queue($db, $intent['intent_id'], 'payment.refunded', ['refund_reference' => $refund['refund_reference'], 'refund_amount_paise' => (int) $refund['amount']]);
    }
}
