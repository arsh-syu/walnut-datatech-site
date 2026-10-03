<?php
// POST { reference, email } → where a University empanelment request stands:
// { ok, reference, status, universityName, submittedAt, updatedAt }.
// The Request ID and the registered email together are the credential; the answer comes from the
// Onboarding Tool, server to server, and carries nothing internal.
declare(strict_types=1);
require __DIR__ . '/lib.php';

$in = read_post();
$reference = strtoupper(trim(is_string($in['reference'] ?? null) ? $in['reference'] : ''));
$email = trim(is_string($in['email'] ?? null) ? $in['email'] : '');

if (!preg_match('/^UR-\d{1,9}$/', $reference)) {
    respond(422, ['error' => 'Please enter your Request ID, for example UR-000123.', 'field' => 'reference']);
}
if (strlen($email) > 254 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    respond(422, ['error' => 'Please enter a valid email address.', 'field' => 'email']);
}

$config = load_config();
if (!onboarding_configured($config) || !function_exists('curl_init')) {
    respond(503, ['error' => 'Request status is not available right now. Please try again later.']);
}
rate_limit('request-status', 15, 600);

[$status, $reply] = onboarding_post($config, '/api/v1/public/university-requests/status', ['reference' => $reference, 'email' => $email]);
if ($status === 404) {
    respond(404, ['error' => 'We could not find a request with that Request ID and email address.']);
}
if ($status !== 200 || !is_string($reply['status'] ?? null)) {
    error_log('Request status lookup failed: the Onboarding Tool responded HTTP ' . $status);
    respond(502, ['error' => 'We could not check your request right now. Please try again later.']);
}

respond(200, [
    'ok' => true,
    'reference' => (string) ($reply['reference'] ?? $reference),
    'status' => $reply['status'],
    'universityName' => (string) ($reply['universityName'] ?? ''),
    'submittedAt' => (string) ($reply['submittedAt'] ?? ''),
    'updatedAt' => (string) ($reply['updatedAt'] ?? ''),
]);
