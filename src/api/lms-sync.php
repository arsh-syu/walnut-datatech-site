<?php
// POST { run: bool } → where handing past website purchases to Walnut LMS stands, per course:
// { ok, lms, backfill, resting, courses: [{ courseSlug, total, waiting, sent, refused }], refusals: [...] }.
// For this site's own tooling (scripts/lms-backfill.mjs), not for visitors: the request is signed with the
// site's account secret, as the calls to Walnut LMS are signed with theirs — X-Walnut-Timestamp (unix
// seconds, within 5 minutes) and X-Walnut-Signature: sha256=<HMAC-SHA256 of "<timestamp>.<raw body>">.
// Anything else gets the same 404 as a page that does not exist. With run: true a sweep goes straight away,
// rather than waiting for someone to open their dashboard; it is the same sweep, so it is safe to repeat.
declare(strict_types=1);
require __DIR__ . '/lib.php';
require __DIR__ . '/account-lib.php';

$config = load_config();
$secret = (string) ($config['account_secret'] ?? '');
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' || !accounts_configured($config) || $secret === '') {
    respond(404, ['error' => 'Not found.']);
}
rate_limit('lms-sync', 60, 600);
$raw = (string) file_get_contents('php://input');
$ts = (string) ($_SERVER['HTTP_X_WALNUT_TIMESTAMP'] ?? '');
$signature = (string) ($_SERVER['HTTP_X_WALNUT_SIGNATURE'] ?? '');
if (!preg_match('/^\d{9,11}\z/', $ts) || abs(time() - (int) $ts) > 300 || !hash_equals('sha256=' . hash_hmac('sha256', $ts . '.' . $raw, $secret), $signature)) {
    respond(404, ['error' => 'Not found.']);
}
$in = json_decode($raw, true);
$db = account_db($config);
if (!$db) {
    respond(503, ['error' => 'The account database is unavailable.']);
}
if (is_array($in) && ($in['run'] ?? false) === true) {
    lms_backfill($config, $db, true);
}
respond(200, ['ok' => true, 'lms' => lms_configured($config), 'backfill' => !empty($config['lms_backfill']), 'resting' => lms_resting()] + lms_backfill_counts($db));
