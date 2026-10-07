<?php
// GET → whether the payment API can run on this server. Reveals no secrets.
declare(strict_types=1);
require __DIR__ . '/lib.php';
require __DIR__ . '/account-lib.php';

$config = load_config();
$configured = !empty($config['key_id']) && !empty($config['key_secret']);

respond(200, [
    'ok' => true,
    'curl' => function_exists('curl_init'),
    'php' => PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION,
    'pdo_mysql' => extension_loaded('pdo_mysql'),
    'configured' => $configured,
    'email' => email_configured($config),
    'onboarding' => onboarding_configured($config),
    // the site's own account database: configured, and reachable right now
    'accounts' => accounts_configured($config) && account_db($config) !== null,
    'sms' => sms_configured($config),
    // Walnut LMS: course progress (signed calls to it) and opening it with this sign-in
    'lms' => lms_configured($config),
    'lms_sso' => !empty($config['sso_lms']),
    'mode' => $configured ? (strpos($config['key_id'], 'rzp_live_') === 0 ? 'live' : 'test') : null,
]);
