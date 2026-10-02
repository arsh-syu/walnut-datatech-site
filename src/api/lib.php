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
    if ($raw === false || strlen($raw) > 16384) {
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

// config.php is written by the deploy script and never committed. It holds the Razorpay keys
// and the Twilio email settings; either part may be missing.
function load_config(): array
{
    $file = __DIR__ . '/config.php';
    $config = is_file($file) ? require $file : null;
    return is_array($config) ? $config : [];
}

function require_payments(array $config): void
{
    if (empty($config['key_id']) || empty($config['key_secret'])) {
        respond(503, ['error' => 'Online payment is not set up yet. Please try again later.']);
    }
}

function email_configured(array $config): bool
{
    return !empty($config['twilio_key']) && !empty($config['twilio_secret'])
        && !empty($config['email_from']) && !empty($config['email_notify']);
}

// True the first time it is called for a key, false afterwards (state in the system temp directory).
// Used so a retried request does not send the same email twice.
function first_time(string $key): bool
{
    $file = sys_get_temp_dir() . '/walnut-once-' . hash('sha256', $key);
    if (is_file($file)) {
        return false;
    }
    @file_put_contents($file, (string) time());
    return true;
}

// {{name}} is HTML-escaped in the HTML part; {{{name}}} is inserted as given (already escaped by the caller).
function render_template(string $template, array $vars, array $raw, bool $html): string
{
    return (string) preg_replace_callback(
        '/\{\{\{(\w+)\}\}\}|\{\{(\w+)\}\}/',
        function ($m) use ($vars, $raw, $html) {
            if ($m[1] !== '') {
                return (string) ($raw[$m[1]] ?? '');
            }
            $value = (string) ($vars[$m[2]] ?? '');
            return $html ? htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') : $value;
        },
        $template
    );
}

// Sends one templated email through Twilio. $rows is a list of [label, value]; empty values are skipped.
// Returns false instead of failing the request: callers decide whether a failed email matters.
function send_email(array $config, string $template, string $toAddress, string $toName, array $vars, array $rows = []): bool
{
    static $templates = null;
    if ($templates === null) {
        $templates = json_decode((string) @file_get_contents(__DIR__ . '/emails.json'), true);
    }
    if (!is_array($templates) || !isset($templates['emails'][$template]) || !function_exists('curl_init') || !email_configured($config)) {
        error_log('Email "' . $template . '" was not sent: email is not set up on this server.');
        return false;
    }

    $rowsHtml = '';
    $rowsText = '';
    foreach ($rows as $row) {
        $value = (string) $row[1];
        if ($value === '') {
            continue;
        }
        $rowsHtml .= render_template($templates['row'], ['label' => $row[0]], ['value' => nl2br(htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'))], true);
        $rowsText .= $row[0] . ': ' . $value . "\n";
    }
    $parts = $templates['emails'][$template];
    $subject = trim((string) preg_replace('/[\x00-\x1F\x7F]+/', ' ', render_template($parts['subject'], $vars, [], false)));

    $ch = curl_init('https://comms.twilio.com/v1/Emails');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_USERPWD => $config['twilio_key'] . ':' . $config['twilio_secret'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode([
            'from' => ['address' => $config['email_from'], 'name' => $config['email_from_name'] ?? 'Walnut Data Tech'],
            'to' => [['address' => $toAddress, 'name' => $toName !== '' ? $toName : $toAddress]],
            'content' => [
                'subject' => $subject,
                'html' => render_template($parts['html'], $vars, ['rows' => $rowsHtml], true),
                'text' => render_template($parts['text'], $vars, ['rows' => $rowsText], false),
            ],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);
    curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    if ($status < 200 || $status >= 300) {
        error_log('Email "' . $template . '" failed: Twilio responded HTTP ' . $status);
        return false;
    }
    return true;
}

// Calls the Razorpay REST API with the account's key pair.
// With $fatal false, a failure returns [] instead of ending the request.
function razorpay(string $method, string $path, ?array $payload, array $config, bool $fatal = true): array
{
    if (!function_exists('curl_init')) {
        if (!$fatal) {
            return [];
        }
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
        if (!$fatal) {
            return [];
        }
        respond(502, ['error' => 'We could not reach the payment service. Please try again.']);
    }
    return $data;
}
