<?php
// POST { topic?, name, organisation, email, phone?, message?, interests?, configuration?, page? }
// → emails the enquiry to the team and an acknowledgement to the sender.
declare(strict_types=1);
require __DIR__ . '/lib.php';

$in = read_post();

// Honeypot: a real visitor never ticks this hidden box. Answer as if it worked and send nothing.
if (!empty($in['botcheck'])) {
    respond(200, ['ok' => true]);
}

// Reads one text field: trimmed, control characters removed, length-checked (never silently cut).
$field = function (string $key, int $max, bool $multiline = false) use ($in): string {
    $value = $in[$key] ?? '';
    if (!is_string($value)) {
        $value = '';
    }
    $value = trim((string) preg_replace($multiline ? '/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+/' : '/[\x00-\x1F\x7F]+/', ' ', $value));
    if (strlen($value) > $max) {
        respond(422, ['error' => 'That is longer than we can accept. Please shorten it and try again.', 'field' => $key]);
    }
    return $value;
};

$topic = $field('topic', 80);
$name = $field('name', 120);
$organisation = $field('organisation', 160);
$email = $field('email', 254);
$phone = $field('phone', 40);
$message = $field('message', 4000, true);
$interests = $field('interests', 300);
$configuration = $field('configuration', 8000, true);
$page = $field('page', 200);

if (strlen($name) < 2) {
    respond(422, ['error' => 'Please enter your name.', 'field' => 'name']);
}
if (strlen($organisation) < 2) {
    respond(422, ['error' => 'Please enter your organisation.', 'field' => 'organisation']);
}
if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    respond(422, ['error' => 'Please enter a valid email address.', 'field' => 'email']);
}
if ($topic === '') {
    $topic = 'General enquiry';
}

$config = load_config();
if (!email_configured($config)) {
    respond(503, ['error' => 'Enquiries cannot be sent right now. Please try again later.']);
}
rate_limit('enquiry', 8, 600);

$vars = ['topic' => $topic, 'name' => $name, 'email' => $email, 'from' => $organisation];
$rows = [
    ['Name', $name],
    ['Organisation', $organisation],
    ['Email', $email],
    ['Phone', $phone],
    ['Message', $message],
    ['Interested in', $interests],
    ['Configuration', $configuration],
];

// The enquiry only counts as sent if the team's copy went out.
if (!send_email($config, 'enquiry_notify', $config['email_notify'], 'Walnut Data Tech', $vars, array_merge([['Topic', $topic]], $rows, [['Sent from', $page]]))) {
    respond(502, ['error' => 'Sorry — your enquiry could not be sent. Please try again in a moment.']);
}
send_email($config, 'enquiry_ack', $email, $name, $vars, array_merge([['Topic', $topic]], $rows));

respond(200, ['ok' => true]);
