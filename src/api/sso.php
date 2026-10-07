<?php
// GET /api/sso.php?app=onboarding&next=/path
// One sign-in for the Walnut apps. The person's website session is turned into a one-time,
// 60-second token for that app (signed with that app's own secret), and they are sent on to it.
// Each app decides for itself whether that email may come in, and as what: its own user table is the
// authority on roles, so a website account never grants more than the app already gives that address.
// Not signed in → the website's login page first, then back here.
declare(strict_types=1);
require __DIR__ . '/lib.php';
require __DIR__ . '/account-lib.php';

$config = load_config();
$appId = is_string($_GET['app'] ?? null) ? $_GET['app'] : '';
$next = is_string($_GET['next'] ?? null) ? $_GET['next'] : '';
$app = walnut_apps($config)[$appId] ?? null;

// A small page in the site's words, for the few cases that cannot go on.
$stop = function (int $status, string $title, string $text) {
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    $e = function (string $s): string {
        return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
    };
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>' . $e($title) . ' · Walnut Data Tech</title>'
        . '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f5fb;color:#0d0c14;font:16px/1.55 Inter,system-ui,sans-serif}main{max-width:460px;margin:24px;padding:36px 32px;border-radius:22px;background:#fff}h1{margin:0 0 12px;font-size:1.5rem}p{color:#63607a}a{display:inline-block;margin-top:12px;padding:12px 22px;border-radius:999px;background:#0d0c14;color:#fff;text-decoration:none;font-weight:600}</style></head>'
        . '<body><main><h1>' . $e($title) . '</h1><p>' . $e($text) . '</p><a href="/dashboard/">Back to your dashboard</a></main></body></html>';
    exit;
};

if (!$app) {
    $stop(404, 'Unknown app', 'That Walnut app does not exist.');
}
if (!accounts_configured($config) || empty($app['secret']) || !($db = account_db($config))) {
    $stop(503, 'Not available yet', 'Signing in to ' . $app['name'] . ' from here is not switched on yet. Please try again later.');
}
// Only a path inside that app may follow the sign-in — never another site.
if ($next !== '' && !preg_match('#^/(?!/)[A-Za-z0-9/_\-.?=&%]{0,300}$#', $next)) {
    $next = '';
}

$hash = session_token_hash();
$user = $hash ? db_row($db, 'SELECT u.* FROM wa_sessions s JOIN wa_users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND u.is_active = 1', [$hash, utc()]) : null;
if (!$user) {
    header('Cache-Control: no-store');
    header('Location: /login/?continue=' . rawurlencode('/api/sso.php?app=' . $appId . ($next !== '' ? '&next=' . rawurlencode($next) : '')), true, 302);
    exit;
}

// A university account opens the university's own tool and nothing else.
if (university_only($user) && $appId !== 'onboarding') {
    $stop(403, 'Not available for university accounts', $app['name'] . ($appId === 'walnut-lms' ? ' is where learners take Walnut courses.' : ' is part of the partner programme.') . ' A university account is used for the university application only.');
}

// The app trusts this email as proven, so only a verified address is handed over. (An account made with a
// mobile code has an email nobody has confirmed yet.)
if ($user['email_verified_at'] === null) {
    $stop(403, 'Verify your email first', 'Before opening ' . $app['name'] . ', please verify ' . $user['email'] . ' from the Profile tab of your dashboard.');
}

// Opening Walnut LMS is enrolling as a learner (Walnut's decision): an account without the learner type
// is given it here, as /account/services would, so the LMS receives STUDENT in the token. Nothing is
// removed, and a university account never gets this far.
if ($appId === 'walnut-lms' && !in_array('STUDENT', user_types($user), true)) {
    $types = clean_types(array_merge(user_types($user), ['STUDENT']));
    if (allowed_types($types)) {
        db_run($db, 'UPDATE wa_users SET account_types = ?, account_type = COALESCE(account_type, ?), updated_at = ? WHERE id = ?', [implode(',', $types), $types[0], utc(), $user['id']]);
        $user = db_row($db, 'SELECT * FROM wa_users WHERE id = ?', [$user['id']]) ?? $user;
    }
}

$token = sso_token($db, $app, $appId, $user);
header('Cache-Control: no-store');
header('Referrer-Policy: no-referrer');
header('Location: ' . $app['url'] . $app['receiver'] . '?token=' . rawurlencode($token) . ($next !== '' ? '&next=' . rawurlencode($next) : ''), true, 302);
