<?php
// POST { certificateId } → { ok: true, valid: bool, certificate: { holder, course, issuedOn, status } }
// Looks the certificate up on the LMS — the only source of truth; nothing is stored here.
//
// The LMS endpoint and key are set as CERT_VERIFY_URL / CERT_VERIFY_KEY in .env and arrive here
// through api/config.php. Until they are set the page answers "not available yet" rather than
// pretending to verify anything.
declare(strict_types=1);

require __DIR__ . '/lib.php';

$in = read_post();
$id = strtoupper(trim(is_string($in['certificateId'] ?? null) ? $in['certificateId'] : ''));
if (!preg_match('~^[A-Z0-9][A-Z0-9\-/]{3,39}$~', $id)) {
    respond(422, ['error' => 'Enter the Certificate ID exactly as printed on the certificate.', 'field' => 'certificateId']);
}

$config = load_config();
$url = (string) ($config['cert_verify_url'] ?? '');
if ($url === '') {
    respond(503, ['error' => 'Certificate verification is not available yet. Please email us the Certificate ID and we will confirm it for you.']);
}
rate_limit('verify-certificate', 10, 600);

$headers = ['Content-Type: application/json', 'Accept: application/json'];
if (!empty($config['cert_verify_key'])) {
    $headers[] = 'Authorization: Bearer ' . $config['cert_verify_key'];
}
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode(['certificateId' => $id]),
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_TIMEOUT => 10,
]);
$raw = curl_exec($ch);
$status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
curl_close($ch);
$reply = is_string($raw) ? json_decode($raw, true) : null;

if ($raw === false || $status >= 500 || ($status < 400 && !is_array($reply))) {
    error_log("verify-certificate: LMS responded HTTP $status");
    respond(502, ['error' => 'The verification service is not responding right now. Please try again in a few minutes.']);
}
// 404 from the LMS means "no such certificate", which is a valid answer, not a failure.
$valid = $status < 400 && !empty($reply['valid']);
$cert = is_array($reply['certificate'] ?? null) ? $reply['certificate'] : (is_array($reply) ? $reply : []);
$str = function ($key) use ($cert) {
    return is_scalar($cert[$key] ?? null) ? mb_substr(trim((string) $cert[$key]), 0, 200) : '';
};
respond(200, [
    'ok' => true,
    'valid' => $valid,
    'certificate' => $valid
        ? ['holder' => $str('holder') ?: $str('name'), 'course' => $str('course'), 'issuedOn' => $str('issuedOn'), 'status' => $str('status')]
        : ['status' => $str('status')],
]);
