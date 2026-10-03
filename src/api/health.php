<?php
// GET → whether the payment API can run on this server. Reveals no secrets.
declare(strict_types=1);
require __DIR__ . '/lib.php';

$config = load_config();
$configured = !empty($config['key_id']) && !empty($config['key_secret']);

respond(200, [
    'ok' => true,
    'curl' => function_exists('curl_init'),
    'configured' => $configured,
    'email' => email_configured($config),
    'onboarding' => onboarding_configured($config),
    'mode' => $configured ? (strpos($config['key_id'], 'rzp_live_') === 0 ? 'live' : 'test') : null,
]);
