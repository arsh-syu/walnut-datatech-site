<?php
// GET | POST | PATCH /api/account.php?p=/auth/otp/send
// Relays the login and dashboard calls of this site's own pages to the account service, so the
// browser only ever talks to this domain. Only the sign-in and "my account" endpoints can be
// reached through it — never the service's admin or university endpoints.
//
// The session cookie the service issues is handed to the browser as this site's own cookie
// (HttpOnly; the page scripts cannot read it) and sent back to the service on later calls.
declare(strict_types=1);
require __DIR__ . '/lib.php';

const SESSION_COOKIE = 'walnut_rt';

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if (!in_array($method, ['GET', 'POST', 'PATCH'], true)) {
    header('Allow: GET, POST, PATCH');
    respond(405, ['error' => ['message' => 'Method not allowed.']]);
}
$path = is_string($_GET['p'] ?? null) ? $_GET['p'] : '';
if (!preg_match('#^/(auth|account)(/[A-Za-z0-9_-]{1,60}){1,4}$#', $path)) {
    respond(404, ['error' => ['message' => 'Not found.']]);
}
// Another site must not be able to act with a visitor's session.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '') {
    $host = strtolower((string) preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? ''));
    if (strtolower((string) parse_url($origin, PHP_URL_HOST)) !== $host) {
        respond(403, ['error' => ['message' => 'Cross-site requests are not allowed.']]);
    }
}
$body = null;
if ($method !== 'GET') {
    $body = (string) file_get_contents('php://input');
    if (strlen($body) > 32768 || ($body !== '' && stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0)) {
        respond(400, ['error' => ['message' => 'Invalid request.']]);
    }
}

$config = load_config();
if (!onboarding_configured($config) || !function_exists('curl_init')) {
    respond(503, ['error' => ['message' => 'Login is not available right now. Please try again later.']]);
}
rate_limit('account', 240, 600);

$forwarded = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '')[0]);
$headers = [
    'Accept: application/json',
    'X-Walnut-Key: ' . $config['onboarding_key'],
    'X-Walnut-Client-Ip: ' . ($forwarded !== '' ? $forwarded : ($_SERVER['REMOTE_ADDR'] ?? '')),
    'User-Agent: ' . substr((string) preg_replace('/[\x00-\x1F\x7F]+/', ' ', $_SERVER['HTTP_USER_AGENT'] ?? 'walnut-site'), 0, 250),
];
// The page keeps its short-lived access token in memory and sends it in this header.
$token = $_SERVER['HTTP_X_WALNUT_TOKEN'] ?? '';
if (preg_match('/^[A-Za-z0-9._-]{20,2000}$/', $token)) {
    $headers[] = 'Authorization: Bearer ' . $token;
}
$session = $_COOKIE[SESSION_COOKIE] ?? '';
if (is_string($session) && preg_match('/^[A-Za-z0-9._~-]{20,400}$/', $session)) {
    $headers[] = 'Cookie: ' . SESSION_COOKIE . '=' . $session;
}
if ($body !== null && $body !== '') {
    $headers[] = 'Content-Type: application/json';
}

$cookies = [];
$ch = curl_init(rtrim((string) $config['onboarding_url'], '/') . '/api/v1' . $path);
curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_TIMEOUT => 20,
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_HEADERFUNCTION => function ($curl, string $line) use (&$cookies): int {
        if (stripos($line, 'Set-Cookie:') === 0) {
            $cookies[] = trim(substr($line, 11));
        }
        return strlen($line);
    },
]);
if ($body !== null && $body !== '') {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}
$reply = curl_exec($ch);
$status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
if (!is_string($reply) || $status === 0) {
    error_log('Account service could not be reached for ' . $path);
    respond(502, ['error' => ['message' => 'We couldn’t reach the server. Please try again in a moment.']]);
}

// Only the session cookie is passed on, re-scoped to this site.
foreach ($cookies as $cookie) {
    if (strpos($cookie, SESSION_COOKIE . '=') !== 0) {
        continue;
    }
    $parts = array_filter(array_map('trim', explode(';', $cookie)), function (string $part): bool {
        return $part !== '' && stripos($part, 'Path=') !== 0 && stripos($part, 'Domain=') !== 0;
    });
    header('Set-Cookie: ' . implode('; ', $parts) . '; Path=/', false);
}

http_response_code($status);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
echo $reply;
