<?php
// Shared helpers for the payment API. Works on PHP 7.4+ with the curl extension.
declare(strict_types=1);

// Errors go to the server log, never to the visitor.
ini_set('display_errors', '0');

function respond(int $status, array $body): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// Accepts only same-origin JSON POSTs and returns the decoded body.
function read_post(): array
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST');
        respond(405, ['error' => 'Method not allowed.']);
    }
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '') {
        $host = strtolower((string) preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? ''));
        if (strtolower((string) parse_url($origin, PHP_URL_HOST)) !== $host) {
            respond(403, ['error' => 'Cross-site requests are not allowed.']);
        }
    }
    // Browsers cannot send JSON cross-site without a preflight, so insisting on it blocks forged form posts.
    if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
        respond(400, ['error' => 'Invalid request.']);
    }
    $raw = file_get_contents('php://input');
    if ($raw === false || strlen($raw) > 8192) {
        respond(400, ['error' => 'Invalid request.']);
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        respond(400, ['error' => 'Invalid request.']);
    }
    return $data;
}

// Allows $max calls per $window seconds from one visitor, so the endpoint cannot be used to flood
// the payment account with orders. State lives in the system temp directory.
function rate_limit(string $bucket, int $max, int $window): void
{
    // Behind a proxy every request shares one REMOTE_ADDR, so prefer the forwarded client address.
    $forwarded = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '')[0]);
    $client = $forwarded !== '' ? $forwarded : ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $handle = @fopen(sys_get_temp_dir() . '/walnut-rl-' . hash('sha256', $bucket . '|' . $client), 'c+');
    if ($handle === false) {
        return; // never block a payment because the temp directory is unavailable
    }
    flock($handle, LOCK_EX);
    $now = time();
    $hits = array_values(array_filter(
        array_map('intval', explode("\n", (string) stream_get_contents($handle))),
        function ($time) use ($now, $window) {
            return $time > $now - $window;
        }
    ));
    $blocked = count($hits) >= $max;
    if (!$blocked) {
        $hits[] = $now;
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, implode("\n", $hits));
    }
    flock($handle, LOCK_UN);
    fclose($handle);
    if ($blocked) {
        header('Retry-After: ' . $window);
        respond(429, ['error' => 'Too many attempts. Please wait a few minutes and try again.']);
    }
}

// config.php is written by the deploy script and never committed.
function load_config(): array
{
    $file = __DIR__ . '/config.php';
    $config = is_file($file) ? require $file : null;
    if (!is_array($config) || empty($config['key_id']) || empty($config['key_secret'])) {
        respond(503, ['error' => 'Online payment is not set up yet. Please try again later.']);
    }
    return $config;
}

// Calls the Razorpay REST API with the account's key pair.
function razorpay(string $method, string $path, ?array $payload, array $config): array
{
    if (!function_exists('curl_init')) {
        respond(500, ['error' => 'Payment service is unavailable.']);
    }
    $ch = curl_init('https://api.razorpay.com/v1' . $path);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_USERPWD => $config['key_id'] . ':' . $config['key_secret'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    ]);
    if ($payload !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    }
    $body = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);

    $data = is_string($body) ? json_decode($body, true) : null;
    if ($status < 200 || $status >= 300 || !is_array($data)) {
        error_log('Razorpay ' . $method . ' ' . $path . ' failed with HTTP ' . $status);
        respond(502, ['error' => 'We could not reach the payment service. Please try again.']);
    }
    return $data;
}
