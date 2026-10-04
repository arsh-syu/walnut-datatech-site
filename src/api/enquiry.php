<?php
// POST { topic?, flow?, name, organisation, institutionType?, email, phone?, message?, interests?, configuration?, form?, page? }
// → emails the enquiry to the team and an acknowledgement to the sender.
// → for the University journey (flow = "university") also files it as an empanelment request in the
//   Onboarding Tool, where an admin reviews it, and answers with its Request ID:
//   { ok, reference?, duplicate? }. No other form or journey does this.
declare(strict_types=1);
require __DIR__ . '/lib.php';
require __DIR__ . '/account-lib.php';

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
$flow = $field('flow', 40);
$name = $field('name', 120);
$organisation = $field('organisation', 160);
$institutionType = $field('institutionType', 80);
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
$university = $flow === 'university';
$answers = $university ? read_answers($in['form'] ?? null) : [];
if ($university) {
    $digits = strlen((string) preg_replace('/\D+/', '', $phone));
    if ($digits < 7 || $digits > 15) {
        respond(422, ['error' => 'Please enter a valid phone number.', 'field' => 'phone']);
    }
}

$config = load_config();
if (!email_configured($config)) {
    respond(503, ['error' => 'Enquiries cannot be sent right now. Please try again later.']);
}
rate_limit('enquiry', 8, 600);

// University journey only. Filed before the team's email so that email can say whether it worked.
$onboarding = [];
$filed = null;
if ($university && accounts_configured($config)) {
    // Kept in this site's own database (it shows in the university's dashboard) and, when the
    // Onboarding Tool is configured, filed there through its API — the tool then gives the Request ID.
    $filed = account_file_request($config, [
        'universityName' => $organisation,
        'universityType' => $institutionType,
        'contactName' => $name,
        'email' => $email,
        'phone' => $phone,
        'message' => $message,
        'configuration' => $configuration,
        'form' => $answers ?: null,
        'page' => $page,
    ]);
    if (onboarding_configured($config)) {
        $onboarding = [['Onboarding Tool', !empty($filed['filed'])
            ? 'Filed as request ' . $filed['reference'] . ($filed['duplicate'] ? ' (an open request from this email was updated)' : '') . ' — review it in the Onboarding Tool.'
            : 'Not filed yet — the Onboarding Tool could not be reached. The website keeps the request and files it automatically when the tool is back.']];
    }
} elseif ($university && onboarding_configured($config)) {
    $filed = forward_university_request($config, [
        'universityName' => $organisation,
        'universityType' => $institutionType,
        'contactName' => $name,
        'email' => $email,
        'phone' => $phone,
        'message' => $message,
        'interests' => $interests,
        'configuration' => $configuration,
        'form' => $answers ?: null,
        'page' => $page,
    ]);
    $onboarding = [['Onboarding Tool', $filed
        ? 'Filed as request ' . $filed['reference'] . ($filed['duplicate'] ? ' (an open request from this email was updated)' : '') . ' — review and approve it in the Onboarding Tool.'
        : 'Could NOT be filed automatically — please add this university in the Onboarding Tool by hand.']];
}
$reference = $filed['reference'] ?? '';

$vars = ['topic' => $topic, 'name' => $name, 'email' => $email, 'from' => $organisation];
$rows = [
    ['Name', $name],
    ['Organisation', $organisation],
    ['Institution type', $institutionType],
    ['Email', $email],
    ['Phone', $phone],
    ['Message', $message],
    ['Interested in', $interests],
];
foreach ($answers as $key => $value) {
    $rows[] = [answer_label($key), is_array($value) ? implode(', ', $value) : $value];
}
$rows[] = ['Configuration', $configuration];
$first = array_merge($reference !== '' ? [['Request ID', $reference]] : [], [['Topic', $topic]]);

// The enquiry only counts as sent if the team's copy went out.
if (!send_email($config, 'enquiry_notify', $config['email_notify'], 'Walnut Data Tech', $vars, array_merge($first, $rows, [['Sent from', $page]], $onboarding))) {
    // A stored request is safe (here or in the Onboarding Tool) even if the team's email could not go out.
    if ($filed === null) {
        respond(502, ['error' => 'Sorry — your enquiry could not be sent. Please try again in a moment.']);
    }
}
if ($university) {
    $vars['subjectRef'] = $reference !== '' ? ' — ' . $reference : '';
    $vars['keep'] = $reference !== '' ? ' Please keep your Request ID for future reference.' : '';
}
send_email($config, $university ? 'request_ack' : 'enquiry_ack', $email, $name, $vars, array_merge($first, $rows));

respond(200, $reference !== '' ? ['ok' => true, 'reference' => $reference, 'duplicate' => $filed['duplicate']] : ['ok' => true]);
