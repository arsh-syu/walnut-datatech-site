<?php
// GET → whether the payment API can run on this server. Reveals no secrets.
declare(strict_types=1);
require __DIR__ . '/lib.php';

$file = __DIR__ . '/config.php';
$config = is_file($file) ? require $file : null;
$configured = is_array($config) && !empty($config['key_id']) && !empty($config['key_secret']);

respond(200, [
    'ok' => true,
    'curl' => function_exists('curl_init'),
    'configured' => $configured,
    'mode' => $configured ? (strpos($config['key_id'], 'rzp_live_') === 0 ? 'live' : 'test') : null,
]);
