<?php
// Walnut accounts kept on this server, in its own MySQL database: sign-in with a one-time code,
// the session, and what the dashboard shows (empanelment requests, course purchases, the partner
// application). When the Onboarding Tool is configured too (ONBOARDING_API_URL), University requests
// are also filed in it through its API, and it numbers them.
//
// It answers the same calls, in the same shapes, as that service — assets/js/login.js and
// account.js do not know which of the two is behind api/account.php.
// Works on PHP 7.4+ with the pdo_mysql extension. Tables are created on first use (wa_*).
declare(strict_types=1);

const SESSION_COOKIE = 'walnut_rt';
const SESSION_DAYS = 30;
const ACCESS_SECONDS = 900;
const REGISTRATION_SECONDS = 900;
const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 300;
const OTP_RESEND_COOLDOWN_SECONDS = 30;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RATE_LIMIT_WINDOW_SECONDS = 900;
const OTP_MAX_REQUESTS_PER_WINDOW = 5;
const DEFAULT_COUNTRY_CODE = '+91';
const ACCOUNT_TYPES = ['UNIVERSITY', 'AGENT', 'STUDENT'];
const ACCOUNT_SCHEMA = 'v5';

function accounts_configured(array $config): bool
{
    return !empty($config['db_name']) && !empty($config['db_user']) && !empty($config['account_secret'])
        && extension_loaded('pdo_mysql');
}

// Mobile codes need an SMS sender; without one the pages offer email only.
function sms_configured(array $config): bool
{
    return !empty($config['twilio_sid']) && !empty($config['sms_from'])
        && !empty($config['twilio_key']) && !empty($config['twilio_secret']);
}

function account_fail(int $status, string $message, array $details = []): void
{
    respond($status, ['error' => ['message' => $message] + ($details ? ['details' => $details] : [])]);
}

/* ---------- database ---------- */

// The connection, or null when the database cannot be reached. All times are stored in UTC.
function account_db(array $config): ?PDO
{
    static $db = false;
    if ($db !== false) {
        return $db;
    }
    try {
        $db = new PDO(
            'mysql:host=' . ($config['db_host'] ?? 'localhost') . ';dbname=' . $config['db_name'] . ';charset=utf8mb4',
            (string) $config['db_user'],
            (string) ($config['db_pass'] ?? ''),
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false, PDO::ATTR_TIMEOUT => 5]
        );
        // The tables are created once; a marker in the temp directory saves asking on every request.
        $marker = sys_get_temp_dir() . '/walnut-schema-' . ACCOUNT_SCHEMA . '-' . hash('sha256', $config['db_name'] . '|' . __DIR__);
        if (!is_file($marker)) {
            foreach (account_schema() as $statement) {
                $db->exec($statement);
            }
            @file_put_contents($marker, (string) time());
        }
    } catch (Throwable $e) {
        error_log('Account database is unavailable: ' . $e->getMessage());
        $db = null;
    }
    return $db;
}

function account_schema(): array
{
    $table = function (string $name, string $columns): string {
        return "CREATE TABLE IF NOT EXISTS $name ($columns) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    };
    return [
        $table('wa_users', "
            id CHAR(36) NOT NULL PRIMARY KEY,
            email VARCHAR(191) NOT NULL,
            name VARCHAR(120) NOT NULL,
            mobile VARCHAR(20) NULL,
            phone VARCHAR(40) NULL,
            account_type ENUM('UNIVERSITY','AGENT','STUDENT') NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            email_verified_at DATETIME NULL,
            mobile_verified_at DATETIME NULL,
            last_login_at DATETIME NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            UNIQUE KEY wa_users_email (email),
            UNIQUE KEY wa_users_mobile (mobile)"),
        $table('wa_sessions', "
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id CHAR(36) NOT NULL,
            token_hash CHAR(64) NOT NULL,
            expires_at DATETIME NOT NULL,
            revoked_at DATETIME NULL,
            user_agent VARCHAR(255) NULL,
            ip VARCHAR(64) NULL,
            created_at DATETIME NOT NULL,
            UNIQUE KEY wa_sessions_token (token_hash),
            KEY wa_sessions_user (user_id)"),
        $table('wa_otp', "
            id CHAR(36) NOT NULL PRIMARY KEY,
            user_id CHAR(36) NULL,
            channel ENUM('EMAIL','SMS') NOT NULL,
            destination VARCHAR(254) NOT NULL,
            purpose ENUM('LOGIN','VERIFY_EMAIL','VERIFY_MOBILE') NOT NULL,
            otp_hash CHAR(64) NOT NULL,
            expires_at DATETIME NOT NULL,
            attempt_count INT NOT NULL DEFAULT 0,
            max_attempts INT NOT NULL,
            verified_at DATETIME NULL,
            invalidated_at DATETIME NULL,
            ip VARCHAR(64) NULL,
            created_at DATETIME NOT NULL,
            KEY wa_otp_destination (channel, destination(100), created_at)"),
        $table('wa_requests', "
            seq INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(191) NOT NULL,
            status VARCHAR(40) NOT NULL DEFAULT 'PENDING_REVIEW',
            university_name VARCHAR(160) NOT NULL,
            university_type VARCHAR(80) NULL,
            contact_name VARCHAR(120) NOT NULL,
            phone VARCHAR(40) NULL,
            message TEXT NULL,
            configuration TEXT NULL,
            form_data MEDIUMTEXT NULL,
            page VARCHAR(200) NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            KEY wa_requests_email (email)"),
        $table('wa_enrolments', "
            id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(191) NOT NULL,
            name VARCHAR(120) NULL,
            phone VARCHAR(40) NULL,
            course_slug VARCHAR(80) NOT NULL,
            course_name VARCHAR(160) NOT NULL,
            amount INT NOT NULL,
            currency VARCHAR(8) NOT NULL DEFAULT 'INR',
            coupon VARCHAR(40) NULL,
            payment_id VARCHAR(60) NOT NULL,
            order_id VARCHAR(60) NOT NULL,
            progress INT NOT NULL DEFAULT 0,
            completed_at DATETIME NULL,
            created_at DATETIME NOT NULL,
            UNIQUE KEY wa_enrolments_payment (payment_id),
            KEY wa_enrolments_email (email)"),
        $table('wa_agent_applications', "
            seq INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id CHAR(36) NOT NULL,
            status ENUM('SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED') NOT NULL DEFAULT 'SUBMITTED',
            answers MEDIUMTEXT NOT NULL,
            decision_note TEXT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            UNIQUE KEY wa_agent_applications_user (user_id)"),
        // v2: the Request ID as the university knows it, and when the request was filed in the Onboarding Tool.
        'ALTER TABLE wa_requests ADD COLUMN IF NOT EXISTS reference VARCHAR(40) NULL, ADD COLUMN IF NOT EXISTS filed_at DATETIME NULL',
        // v3: one account can be used for several things (university, courses, partner).
        'ALTER TABLE wa_users ADD COLUMN IF NOT EXISTS account_types VARCHAR(40) NULL',
        'UPDATE wa_users SET account_types = account_type WHERE account_types IS NULL AND account_type IS NOT NULL',
        // v4: Walnut admins — an admin in any one Walnut app is an admin in all of them (the `admin` claim of
        // the sign-in token). Kept by hand: add or remove a row when someone becomes or stops being an admin.
        $table('wa_admins', "
            email VARCHAR(191) NOT NULL PRIMARY KEY,
            source VARCHAR(80) NOT NULL,
            created_at DATETIME NOT NULL"),
        "INSERT IGNORE INTO wa_admins (email, source, created_at) VALUES ('support@walnutdatatech.com', 'onboarding SUPER_ADMIN', UTC_TIMESTAMP()), ('admin@selectyouruniversity.com', 'course-finder master_admin', UTC_TIMESTAMP())",
        // v5: courses are sold on Walnut LMS now. A purchase made on this website is handed to the LMS once
        // (lms_backfill), and either marked as handed over or given the reason the LMS refused it.
        'ALTER TABLE wa_enrolments ADD COLUMN IF NOT EXISTS lms_synced_at DATETIME NULL, ADD COLUMN IF NOT EXISTS lms_error VARCHAR(200) NULL',
    ];
}

function db_run(PDO $db, string $sql, array $params = []): PDOStatement
{
    $statement = $db->prepare($sql);
    $statement->execute($params);
    return $statement;
}

function db_row(PDO $db, string $sql, array $params = []): ?array
{
    $row = db_run($db, $sql, $params)->fetch();
    return $row === false ? null : $row;
}

function utc(int $offset = 0): string
{
    return gmdate('Y-m-d H:i:s', time() + $offset);
}

// A stored time as the browser expects it (ISO 8601, UTC).
function iso(?string $time): ?string
{
    return $time === null ? null : str_replace(' ', 'T', $time) . 'Z';
}

function new_id(): string
{
    $hex = bin2hex(random_bytes(16));
    return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-4' . substr($hex, 13, 3) . '-a' . substr($hex, 17, 3) . '-' . substr($hex, 20, 12);
}

// Length and prefix of a text in characters, without needing the mbstring extension.
function text_length(string $text): int
{
    return (int) preg_match_all('/./su', $text);
}

function text_cut(string $text, int $max): string
{
    return preg_match('/^.{0,' . $max . '}/su', $text, $m) ? $m[0] : '';
}

function client_ip(): string
{
    $forwarded = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '')[0]);
    return substr($forwarded !== '' ? $forwarded : ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 64);
}

/* ---------- signed tokens (HS256) ---------- */

function b64url(string $bytes): string
{
    return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
}

function token_sign(array $config, array $claims, int $seconds): string
{
    $body = b64url('{"alg":"HS256","typ":"JWT"}') . '.' . b64url((string) json_encode($claims + ['exp' => time() + $seconds]));
    return $body . '.' . b64url(hash_hmac('sha256', $body, (string) $config['account_secret'], true));
}

// The claims of a token this server signed and that has not expired, or null.
function token_read(array $config, string $token, string $kind): ?array
{
    $parts = explode('.', $token);
    if (count($parts) !== 3 || !hash_equals(b64url(hash_hmac('sha256', $parts[0] . '.' . $parts[1], (string) $config['account_secret'], true)), $parts[2])) {
        return null;
    }
    $claims = json_decode((string) base64_decode(strtr($parts[1], '-_', '+/')), true);
    return is_array($claims) && ($claims['kind'] ?? '') === $kind && (int) ($claims['exp'] ?? 0) > time() ? $claims : null;
}

/* ---------- one sign-in for the other Walnut apps (api/sso.php) ---------- */

// The apps a Walnut account can open. Each has its own secret (config: sso_<id>, from WALNUT_SSO_SECRET_<ID>
// in .env), so a token for one can never be used at another.
function walnut_apps(array $config): array
{
    return [
        'onboarding' => ['name' => 'Onboarding Tool', 'url' => 'https://walnut-onboarding.vercel.app', 'receiver' => '/api/v1/auth/sso/walnut', 'secret' => $config['sso_onboarding'] ?? ''],
        'course-finder' => ['name' => 'Course Finder', 'url' => 'https://syu-course-finder.vercel.app', 'receiver' => '/api/sso/walnut', 'secret' => $config['sso_course_finder'] ?? ''],
        'leads' => ['name' => 'Online Leads', 'url' => 'https://syu-leads.vercel.app', 'receiver' => '/api/sso/walnut', 'secret' => $config['sso_leads'] ?? ''],
        // Where courses are sold and taken. Its address can be changed (WALNUT_LMS_URL) without a code change.
        'walnut-lms' => ['name' => 'Walnut LMS', 'url' => lms_origin($config) ?: 'https://walnut-lms.vercel.app', 'receiver' => '/api/sso/walnut', 'secret' => $config['sso_lms'] ?? ''],
    ];
}

// The one field the other Walnut apps read to tell the journeys apart: 'university' for an account kept
// only for university onboarding, and null for every other account. It says what to show, not what to
// allow: an app must not refuse a sign-in on this alone, because an account type is what the person chose
// at sign-up, not a record of what they do.
function account_audience(array $types): ?string
{
    return $types === ['UNIVERSITY'] ? 'university' : null;
}

// A one-time, 60-second proof of who this is, for one app only (HS256 JWT). `admin` is true for a Walnut
// admin (wa_admins): the app makes them its top admin. Anyone else who has no account there is created
// with the app's lowest role (agent; in the Onboarding Tool an account waiting for an admin to give it a
// role). `partner` is where the person's partner application stands. `sub` is the website account's UUID.
function sso_token(PDO $db, array $app, string $appId, array $user): string
{
    $now = time();
    $partner = db_row($db, 'SELECT status FROM wa_agent_applications WHERE user_id = ?', [$user['id']]);
    $types = user_types($user);
    $claims = ['iss' => 'walnutdatatech.com', 'aud' => $appId, 'sub' => $user['id'], 'email' => $user['email'], 'email_verified' => true, 'name' => $user['name'], 'phone' => $user['mobile'] ?? $user['phone'], 'account_types' => $types, 'audience' => account_audience($types), 'partner' => $partner['status'] ?? null, 'admin' => (bool) db_row($db, 'SELECT email FROM wa_admins WHERE email = ?', [$user['email']]), 'iat' => $now, 'exp' => $now + 60, 'jti' => bin2hex(random_bytes(16))];
    $body = b64url('{"alg":"HS256","typ":"JWT"}') . '.' . b64url((string) json_encode($claims, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    return $body . '.' . b64url(hash_hmac('sha256', $body, (string) $app['secret'], true));
}

/* ---------- sessions ---------- */

// What the person uses their account for, in the fixed order of ACCOUNT_TYPES. Anything else is dropped.
function clean_types($raw): array
{
    return array_values(array_intersect(ACCOUNT_TYPES, array_filter((array) $raw, 'is_string')));
}

function user_types(array $user): array
{
    return clean_types(explode(',', (string) ($user['account_types'] ?? $user['account_type'])));
}

// University is a flow of its own: an account is either a university account or it is not.
// Partner (AGENT) and learner (STUDENT) may be held together. The pages follow the same rule
// (assets/js/roles.js), but this is where it is enforced.
const UNIVERSITY_ONLY = 'University applications are handled separately. Please continue with University only.';

function allowed_types(array $types): bool
{
    return !in_array('UNIVERSITY', $types, true) || count($types) === 1;
}

// An account kept for a university: it has the university flow and none of the others.
function university_only(array $user): bool
{
    return user_types($user) === ['UNIVERSITY'];
}

function public_user(array $user): array
{
    return ['id' => $user['id'], 'email' => $user['email'], 'name' => $user['name'], 'role' => 'MEMBER', 'accountType' => $user['account_type'], 'accountTypes' => user_types($user)];
}

function session_cookie(string $value, int $expires): void
{
    setcookie(SESSION_COOKIE, $value, [
        'expires' => $expires,
        'path' => '/',
        'secure' => !preg_match('/^(localhost|127\.)/', $_SERVER['HTTP_HOST'] ?? ''),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function access_reply(array $config, array $user): array
{
    return ['user' => public_user($user), 'accessToken' => token_sign($config, ['kind' => 'access', 'sub' => $user['id']], ACCESS_SECONDS)];
}

// Signs the person in: the session is a random token in an HttpOnly cookie, stored here only as a hash.
function session_start_for(PDO $db, array $config, array $user): array
{
    $token = bin2hex(random_bytes(32));
    db_run($db, 'INSERT INTO wa_sessions (user_id, token_hash, expires_at, user_agent, ip, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
        $user['id'], hash('sha256', $token), utc(SESSION_DAYS * 86400), substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255), client_ip(), utc(),
    ]);
    db_run($db, 'UPDATE wa_users SET last_login_at = ? WHERE id = ?', [utc(), $user['id']]);
    session_cookie($token, time() + SESSION_DAYS * 86400);
    if (random_int(1, 50) === 1) { // housekeeping, now and then
        db_run($db, 'DELETE FROM wa_sessions WHERE expires_at < ?', [utc()]);
        db_run($db, 'DELETE FROM wa_otp WHERE created_at < ?', [utc(-7 * 86400)]);
    }
    return access_reply($config, $user);
}

function session_token_hash(): ?string
{
    $token = $_COOKIE[SESSION_COOKIE] ?? '';
    return is_string($token) && preg_match('/^[a-f0-9]{64}$/', $token) ? hash('sha256', $token) : null;
}

// The signed-in person, from the short-lived token the page holds in memory.
function account_user(PDO $db, array $config): array
{
    $claims = token_read($config, (string) ($_SERVER['HTTP_X_WALNUT_TOKEN'] ?? ''), 'access');
    $user = $claims ? db_row($db, 'SELECT * FROM wa_users WHERE id = ? AND is_active = 1', [(string) ($claims['sub'] ?? '')]) : null;
    if (!$user) {
        account_fail(401, 'Please sign in again.');
    }
    return $user;
}

/* ---------- one-time codes ---------- */

// Lower-cased email, or mobile in international format. Refuses with a sentence fit to show.
function normalise(string $channel, string $raw): string
{
    $value = trim($raw);
    if ($channel === 'email') {
        if (strlen($value) > 191 || !preg_match('/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/', $value)) {
            account_fail(400, 'Please enter a valid email address.');
        }
        return strtolower($value);
    }
    // "+91 98765 43210", "09876543210" and "9876543210" all mean the same number.
    $digits = (string) preg_replace('/[\s().-]/', '', $value);
    $international = strpos($digits, '+') === 0 ? $digits : DEFAULT_COUNTRY_CODE . ltrim($digits, '0');
    if (!preg_match('/^\+[1-9]\d{7,14}$/', $international)) {
        account_fail(400, 'Please enter a valid mobile number.');
    }
    if (strpos($international, '+91') === 0 && !preg_match('/^\+91[6-9]\d{9}$/', $international)) {
        account_fail(400, 'Please enter a valid 10-digit mobile number.');
    }
    return $international;
}

function mask(string $channel, string $destination): string
{
    if ($channel === 'mobile') {
        return trim(substr($destination, 0, -10) . ' ******' . substr($destination, -4));
    }
    [$name, $domain] = explode('@', $destination, 2);
    return substr($name, 0, 2) . str_repeat('*', max(3, strlen($name) - 2)) . '@' . $domain;
}

// Keyed with the server secret and bound to its challenge: a leaked table cannot be brute-forced offline.
function otp_hash(array $config, string $challengeId, string $code): string
{
    return hash_hmac('sha256', 'otp:' . $challengeId . ':' . $code, (string) $config['account_secret']);
}

function sms_send(array $config, string $to, string $body): bool
{
    $from = (string) $config['sms_from'];
    $ch = curl_init('https://api.twilio.com/2010-04-01/Accounts/' . rawurlencode((string) $config['twilio_sid']) . '/Messages.json');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_USERPWD => $config['twilio_key'] . ':' . $config['twilio_secret'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        // A Messaging Service (MG…) picks the sender; otherwise sms_from is the sending number.
        CURLOPT_POSTFIELDS => http_build_query(['To' => $to, 'Body' => $body, (strpos($from, 'MG') === 0 ? 'MessagingServiceSid' : 'From') => $from]),
    ]);
    curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    if ($status < 200 || $status >= 300) {
        error_log('SMS failed: Twilio responded HTTP ' . $status);
        return false;
    }
    return true;
}

// Sends a code. The answer is the same whether or not the destination has an account,
// so this cannot be used to find out who is registered.
function otp_send(PDO $db, array $config, string $channel, string $rawDestination, string $purpose, ?string $userId = null): array
{
    if ($channel === 'mobile' && !sms_configured($config)) {
        account_fail(400, 'Mobile codes are not available yet. Please use your email address.');
    }
    $destination = normalise($channel, $rawDestination);
    $kind = $channel === 'email' ? 'EMAIL' : 'SMS';
    $now = time();

    $recent = db_run($db, 'SELECT created_at FROM wa_otp WHERE channel = ? AND destination = ? AND created_at > ? ORDER BY created_at DESC', [$kind, $destination, utc(-OTP_RATE_LIMIT_WINDOW_SECONDS)])->fetchAll();
    $wait = $recent ? strtotime($recent[0]['created_at'] . ' UTC') + OTP_RESEND_COOLDOWN_SECONDS - $now : 0;
    if ($wait > 0 || count($recent) >= OTP_MAX_REQUESTS_PER_WINDOW) {
        account_fail(429, $wait > 0 ? "Please wait $wait seconds before requesting another OTP." : 'Too many OTP requests. Please wait a few minutes before requesting another.', [
            'reason' => 'OTP_RATE_LIMITED',
            'retryAfter' => $wait > 0 ? $wait : OTP_RATE_LIMIT_WINDOW_SECONDS,
        ]);
    }

    // A new code replaces every earlier one for this destination and purpose.
    db_run($db, 'UPDATE wa_otp SET invalidated_at = ? WHERE channel = ? AND destination = ? AND purpose = ? AND verified_at IS NULL AND invalidated_at IS NULL', [utc(), $kind, $destination, $purpose]);
    $code = '';
    for ($i = 0; $i < OTP_LENGTH; $i++) {
        $code .= random_int(0, 9);
    }
    $id = new_id();
    db_run($db, 'INSERT INTO wa_otp (id, user_id, channel, destination, purpose, otp_hash, expires_at, max_attempts, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        $id, $userId, $kind, $destination, $purpose, otp_hash($config, $id, $code), utc(OTP_EXPIRY_SECONDS), OTP_MAX_ATTEMPTS, client_ip(), utc(),
    ]);

    $what = ['LOGIN' => 'sign in to your Walnut account', 'VERIFY_EMAIL' => 'verify your email address', 'VERIFY_MOBILE' => 'verify your mobile number'][$purpose];
    $minutes = (int) round(OTP_EXPIRY_SECONDS / 60);
    $sent = $channel === 'email'
        ? send_email($config, 'otp', $destination, '', ['code' => $code, 'purpose' => $what, 'minutes' => (string) $minutes])
        : sms_send($config, $destination, "$code is your Walnut Data Tech code to $what. It expires in $minutes minutes. Do not share it with anyone.");
    if (!$sent) {
        db_run($db, 'UPDATE wa_otp SET invalidated_at = ? WHERE id = ?', [utc(), $id]);
        account_fail(502, 'We couldn’t send the OTP right now. Please try again.', ['reason' => 'OTP_PROVIDER_ERROR']);
    }
    return ['challengeId' => $id, 'channel' => $channel, 'sentTo' => mask($channel, $destination), 'expiresIn' => OTP_EXPIRY_SECONDS, 'resendIn' => OTP_RESEND_COOLDOWN_SECONDS];
}

// Checks a code and returns its challenge when it is right. A right code is consumed.
function otp_consume(PDO $db, array $config, string $challengeId, string $code, string $purpose): array
{
    $dead = function (string $reason, string $message): void {
        account_fail(400, $message, ['reason' => $reason]);
    };
    if (!preg_match('/^[a-f0-9-]{36}$/', $challengeId) || !preg_match('/^\d{4,8}$/', $code)) {
        account_fail(400, 'Please enter the OTP.');
    }
    $challenge = db_row($db, 'SELECT * FROM wa_otp WHERE id = ?', [$challengeId]);
    if (!$challenge || $challenge['purpose'] !== $purpose || $challenge['verified_at'] || $challenge['invalidated_at']) {
        $dead('OTP_INVALIDATED', 'This OTP is no longer valid. Please request a new OTP.');
    }
    if ($challenge['expires_at'] < utc()) {
        $dead('OTP_EXPIRED', 'This OTP has expired. Please request a new OTP.');
    }
    // Count the try first, in one statement, so parallel guesses cannot exceed the limit.
    $counted = db_run($db, 'UPDATE wa_otp SET attempt_count = attempt_count + 1 WHERE id = ? AND verified_at IS NULL AND invalidated_at IS NULL AND attempt_count < max_attempts', [$challengeId])->rowCount();
    $left = (int) $challenge['max_attempts'] - (int) $challenge['attempt_count'] - 1;
    $right = hash_equals($challenge['otp_hash'], otp_hash($config, $challengeId, $code));
    if ($counted === 0 || (!$right && $left <= 0)) {
        db_run($db, 'UPDATE wa_otp SET invalidated_at = ? WHERE id = ? AND invalidated_at IS NULL', [utc(), $challengeId]);
        $dead('OTP_INVALIDATED', 'Too many attempts. Please request a new OTP.');
    }
    if (!$right) {
        account_fail(400, 'The OTP is incorrect. Please check and try again.', ['reason' => 'OTP_INVALID', 'attemptsLeft' => $left]);
    }
    // Single use: only the first correct entry claims it.
    if (db_run($db, 'UPDATE wa_otp SET verified_at = ? WHERE id = ? AND verified_at IS NULL AND invalidated_at IS NULL', [utc(), $challengeId])->rowCount() === 0) {
        $dead('OTP_INVALIDATED', 'This OTP is no longer valid. Please request a new OTP.');
    }
    return $challenge;
}

/* ---------- partner application questions ---------- */

// agent-questions.json is generated by the build from src/data/agent-questions.mjs.
function agent_questions(): array
{
    $questions = json_decode((string) @file_get_contents(__DIR__ . '/agent-questions.json'), true);
    return is_array($questions) ? $questions : [];
}

function answer_list($value): array
{
    if (is_array($value)) {
        return array_values(array_filter($value, 'is_string'));
    }
    return is_string($value) && $value !== '' ? [$value] : [];
}

function question_shown(array $q, array $answers): bool
{
    $holds = function (array $c) use ($answers): bool {
        $actual = $answers[$c['field']] ?? null;
        $value = (string) ($c['value'] ?? '');
        switch ($c['op']) {
            case 'answered':
                return count(answer_list($actual)) > 0;
            case 'contains':
                return is_array($actual) ? in_array($value, $actual, true) : ($value === '' || strpos((string) $actual, $value) !== false);
            case 'equals':
                return !is_array($actual) && (string) $actual === $value;
            default: // notEquals
                return is_array($actual) || (string) $actual !== $value;
        }
    };
    if (empty($q['showIf'])) {
        return true;
    }
    $all = $q['showIf']['all'] ?? [];
    $any = $q['showIf']['any'] ?? [];
    return count(array_filter($all, $holds)) === count($all) && (!$any || count(array_filter($any, $holds)) > 0);
}

// Keeps only answers to questions that apply, in the shape each question expects.
// Returns [cleaned answers, what is wrong per question id].
function check_answers(array $questions, array $raw): array
{
    $answers = [];
    $problems = [];
    // Cleaned first, so conditions see the same values that are stored.
    foreach ($questions as $q) {
        $given = $raw[$q['id']] ?? null;
        if ($q['type'] === 'multi') {
            $picked = array_values(array_intersect($q['options'] ?? [], answer_list($given)));
            if ($picked) {
                $answers[$q['id']] = $picked;
            }
        } else {
            $value = is_string($given) ? text_cut(trim($given), $q['type'] === 'textarea' ? 2000 : 300) : '';
            if ($value !== '' && (empty($q['options']) || in_array($value, $q['options'], true))) {
                $answers[$q['id']] = $value;
            }
        }
    }
    foreach ($questions as $q) {
        if (!question_shown($q, $answers)) {
            unset($answers[$q['id']]);
            continue;
        }
        $value = $answers[$q['id']] ?? null;
        if ($value === null) {
            if (!empty($q['required'])) {
                $problems[$q['id']] = !empty($q['options']) ? 'Please choose an option.' : 'This is required.';
            }
        } elseif ($q['type'] === 'tel' && !preg_match('/^[0-9+ ()\-]{7,20}$/', $value)) {
            $problems[$q['id']] = 'Please enter a valid phone number.';
        } elseif ($q['type'] === 'url' && !preg_match('#^(https?://)?[^\s/]+\.[^\s]+$#i', $value)) {
            $problems[$q['id']] = 'Please enter a valid web address.';
        }
    }
    return [$answers, $problems];
}

/* ---------- records the other endpoints write ---------- */

function request_reference(int $seq): string
{
    return sprintf('UR-%06d', $seq);
}

// True at most once every $seconds for a key (state in the system temp directory).
function due(string $key, int $seconds): bool
{
    $file = sys_get_temp_dir() . '/walnut-due-' . hash('sha256', $key . '|' . __DIR__);
    if (is_file($file) && filemtime($file) > time() - $seconds) {
        return false;
    }
    @touch($file);
    return true;
}

// Files in the Onboarding Tool, through its API, every request it does not have yet (or that the
// university has sent again), and keeps the Request ID it answers with. The tool numbers requests;
// an open request from the same email is updated there, not duplicated. A request that cannot be
// filed now stays here and is tried again later — nothing is lost while the tool is unreachable.
function onboarding_push(array $config, PDO $db): void
{
    if (!onboarding_configured($config) || !function_exists('curl_init')) {
        return;
    }
    foreach (db_run($db, 'SELECT * FROM wa_requests WHERE filed_at IS NULL ORDER BY seq LIMIT 10')->fetchAll() as $w) {
        // The tool has no field for the further answers, so they travel in the message.
        $lines = array_filter([(string) $w['message'], $w['university_type'] ? 'Institution type: ' . $w['university_type'] : '']);
        foreach ((array) json_decode((string) $w['form_data'], true) as $key => $value) {
            $lines[] = answer_label((string) $key) . ': ' . (is_array($value) ? implode(', ', $value) : $value);
        }
        [$status, $reply] = onboarding_post($config, '/api/v1/public/university-requests', array_filter([
            'universityName' => $w['university_name'],
            'contactName' => $w['contact_name'],
            'email' => $w['email'],
            'phone' => text_cut((string) $w['phone'], 40),
            'message' => text_cut(implode("\n", $lines), 4000),
            'configuration' => text_cut((string) $w['configuration'], 8000),
            'page' => text_cut((string) $w['page'], 200),
        ], 'strlen'));
        if (($status === 200 || $status === 201) && is_string($reply['reference'] ?? null) && preg_match('/^UR-\d{1,9}$/', $reply['reference'])) {
            db_run($db, 'UPDATE wa_requests SET reference = ?, filed_at = ? WHERE seq = ?', [$reply['reference'], utc(), $w['seq']]);
            continue;
        }
        error_log('Request ' . $w['seq'] . ' was not filed in the Onboarding Tool (HTTP ' . $status . '); it will be tried again.');
        if ($status === 0) {
            break; // unreachable: the rest would only wait for the same timeout
        }
    }
}

// Brings the status a reviewer set in the Onboarding Tool back to a filed request, so the university
// sees it here. Asked at most once a minute per request ($fresh asks regardless); a tool without the
// status call changes nothing.
function onboarding_pull(array $config, PDO $db, array $w, bool $fresh = false): array
{
    if (!onboarding_configured($config) || !function_exists('curl_init') || $w['filed_at'] === null || (!due('status-' . $w['seq'], 60) && !$fresh)) {
        return $w;
    }
    [$status, $reply] = onboarding_post($config, '/api/v1/public/university-requests/status', ['reference' => $w['reference'], 'email' => $w['email']]);
    if ($status !== 200 || !is_string($reply['status'] ?? null) || !preg_match('/^[A-Z_]{2,40}$/', $reply['status'])) {
        return $w;
    }
    $now = $reply['status'] === 'NEW' ? 'PENDING_REVIEW' : $reply['status']; // the tool's name for a request nobody has opened yet
    if ($now !== $w['status']) {
        $changed = strtotime((string) ($reply['updatedAt'] ?? ''));
        $w['status'] = $now;
        $w['updated_at'] = gmdate('Y-m-d H:i:s', $changed ?: time());
        db_run($db, 'UPDATE wa_requests SET status = ?, updated_at = ? WHERE seq = ?', [$w['status'], $w['updated_at'], $w['seq']]);
    }
    return $w;
}

// Files a University empanelment request. An email that already has an open request updates it and
// keeps its Request ID. Returns ['reference', 'duplicate', 'filed'], or null when it could not be stored.
// The Request ID is '' while a request is waiting to be filed in the Onboarding Tool, which numbers it.
function account_file_request(array $config, array $r): ?array
{
    $db = account_db($config);
    if (!$db) {
        return null;
    }
    try {
        $email = strtolower($r['email']);
        $values = [$r['universityName'], $r['universityType'] ?: null, $r['contactName'], $r['phone'] ?: null, $r['message'] ?: null, $r['configuration'] ?: null, $r['form'] ? json_encode($r['form'], JSON_UNESCAPED_UNICODE) : null, $r['page'] ?: null, utc()];
        $open = db_row($db, "SELECT * FROM wa_requests WHERE email = ? AND status NOT IN ('APPROVED', 'POC_ACCOUNT_CREATED', 'REJECTED') ORDER BY seq DESC LIMIT 1", [$email]);
        // The tool may have decided on it since we last asked; a decided request is not reopened —
        // what arrives now is a new request, there and here.
        if ($open && in_array(onboarding_pull($config, $db, $open, true)['status'], ['APPROVED', 'POC_ACCOUNT_CREATED', 'REJECTED'], true)) {
            $open = null;
        }
        if ($open) {
            db_run($db, "UPDATE wa_requests SET university_name = ?, university_type = ?, contact_name = ?, phone = ?, message = ?, configuration = ?, form_data = ?, page = ?, updated_at = ?, filed_at = NULL, status = IF(status IN ('CHANGES_REQUIRED', 'COUNTER_PROPOSAL'), 'RESUBMITTED', status) WHERE seq = ?", array_merge($values, [$open['seq']]));
            $seq = (int) $open['seq'];
        } else {
            db_run($db, 'INSERT INTO wa_requests (university_name, university_type, contact_name, phone, message, configuration, form_data, page, updated_at, created_at, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', array_merge($values, [utc(), $email]));
            $seq = (int) $db->lastInsertId();
            // Without an Onboarding Tool this site numbers its own requests.
            if (!onboarding_configured($config)) {
                db_run($db, 'UPDATE wa_requests SET reference = ? WHERE seq = ?', [request_reference($seq), $seq]);
            }
        }
        onboarding_push($config, $db);
        $saved = db_row($db, 'SELECT reference, filed_at FROM wa_requests WHERE seq = ?', [$seq]);
        return ['reference' => (string) $saved['reference'], 'duplicate' => (bool) $open, 'filed' => $saved['filed_at'] !== null];
    } catch (Throwable $e) {
        error_log('University request was not stored: ' . $e->getMessage());
        return null;
    }
}

// Where a request stands, for the Request ID and registered email together; null when there is no such request.
function account_request_status(array $config, PDO $db, string $reference, string $email): ?array
{
    if (due('push', 300)) {
        onboarding_push($config, $db); // requests still waiting to be filed get their Request ID
    }
    $row = db_row($db, 'SELECT * FROM wa_requests WHERE reference = ? AND email = ? ORDER BY seq DESC LIMIT 1', [$reference, strtolower($email)]);
    $row = $row ? onboarding_pull($config, $db, $row) : null;
    return $row ? [
        'reference' => $row['reference'],
        'status' => $row['status'],
        'universityName' => $row['university_name'],
        'submittedAt' => iso($row['created_at']),
        'updatedAt' => iso($row['updated_at']),
    ] : null;
}

// Records a verified course purchase against the learner's email. Recording the same payment twice changes nothing.
function account_record_enrolment(array $config, array $e): void
{
    $db = account_db($config);
    try {
        if (!$db) {
            throw new RuntimeException('the database is unavailable');
        }
        db_run($db, 'INSERT IGNORE INTO wa_enrolments (email, name, phone, course_slug, course_name, amount, coupon, payment_id, order_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            strtolower($e['email']), $e['name'] ?: null, $e['phone'] ?: null, $e['courseSlug'], $e['courseName'], $e['amount'], $e['coupon'], $e['paymentId'], $e['orderId'], utc(),
        ]);
    } catch (Throwable $err) {
        error_log('Enrolment ' . $e['paymentId'] . ' was not recorded: ' . $err->getMessage());
    }
}

/* ---------- Walnut LMS: where courses are sold and taken ---------- */

// The LMS answers our server, not the browser: each call is signed with the integration secret
// (config lms_secret, from WALNUT_LMS_INTEGRATION_SECRET; the LMS holds it as WALNUT_INTEGRATION_SECRET).
function lms_configured(array $config): bool
{
    return lms_origin($config) !== '' && !empty($config['lms_secret']);
}

// The LMS's address (config lms_url) when it is an https origin with no path, otherwise ''. A path would
// break every signed call: the LMS checks the signature against the path it receives, prefix included.
// Sign-in tokens travel to this address too, so it is never plain http.
function lms_origin(array $config): string
{
    $url = rtrim((string) ($config['lms_url'] ?? ''), '/');
    return preg_match('~^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?\z~i', $url) === 1 ? $url : '';
}

// While the LMS is down or slow, each call would hold the person's dashboard for seconds. After a call
// it did not answer (or answered with a 5xx), it is left alone for a minute.
function lms_resting(): bool
{
    $file = lms_rest_file();
    return is_file($file) && filemtime($file) > time() - 60;
}

function lms_rest_file(): string
{
    return sys_get_temp_dir() . '/walnut-lms-down-' . hash('sha256', __DIR__);
}

// One signed call to the LMS. $pathAndQuery is sent exactly as given, and the signature covers exactly
// that string ("<timestamp>.<path and query>" for a GET, "<timestamp>.<raw body>" for a POST), so it is
// built with rawurlencode() on every value and may hold nothing curl would encode again.
// Returns [HTTP status (0 when it could not be reached), decoded reply or null]. Never throws.
function lms_call(array $config, string $method, string $pathAndQuery, ?array $body): array
{
    try {
        if (!lms_configured($config) || lms_resting() || !function_exists('curl_init') || !preg_match('#^/[A-Za-z0-9/_.~%=&?-]{0,1000}$#', $pathAndQuery)) {
            return [0, null];
        }
        $raw = $body === null ? null : json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
        if ($raw === false) {
            return [0, null];
        }
        $ts = (string) time();
        $signed = $method === 'POST' ? (string) $raw : $pathAndQuery;
        $headers = ['Accept: application/json', 'X-Walnut-Timestamp: ' . $ts, 'X-Walnut-Signature: sha256=' . hash_hmac('sha256', $ts . '.' . $signed, (string) $config['lms_secret'])];
        $ch = curl_init(lms_origin($config) . $pathAndQuery);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_TIMEOUT => 5,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_PATH_AS_IS => true, // the path goes out as signed, without "/./" or "/../" being tidied
        ]);
        if ($method === 'POST') {
            $headers[] = 'Content-Type: application/json';
            curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $raw]);
        } else {
            curl_setopt($ch, CURLOPT_HTTPGET, true);
        }
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        $answer = curl_exec($ch);
        $reply = is_string($answer) ? json_decode($answer, true) : null;
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        if ($status === 0 || $status >= 500) {
            @touch(lms_rest_file());
        }
        return [$status, is_array($reply) ? $reply : null];
    } catch (Throwable $e) {
        error_log('Walnut LMS call failed: ' . get_class($e));
        return [0, null];
    }
}

// A time from the LMS as the browser expects it (ISO 8601, UTC), or null when it is not a time.
function lms_time($value): ?string
{
    $time = is_string($value) && strlen($value) <= 40 ? strtotime($value) : false;
    return $time ? gmdate('Y-m-d\TH:i:s\Z', $time) : null;
}

// A line of text from the LMS, fit to show: no control characters, and not longer than $max.
function lms_text($value, int $max): string
{
    return is_string($value) ? text_cut(trim((string) preg_replace('/[\x00-\x1F\x7F]+/', ' ', $value)), $max) : '';
}

// The person's courses on the LMS, with how far they have got. Only the fields the dashboard shows are
// kept, and every link is made here: a link in the LMS's answer is never passed on to the page.
// 'configured' is false when this site does not ask the LMS at all (no integration secret), and
// 'available' is false when it could not be asked just now; the dashboard then shows the rest as usual.
function lms_progress(array $config, array $user): array
{
    if (!lms_configured($config)) {
        return ['configured' => false, 'available' => false, 'courses' => []];
    }
    $none = ['configured' => true, 'available' => false, 'courses' => []];
    if (lms_resting()) {
        return $none; // it failed a moment ago and is asked again after a minute
    }
    [$status, $reply] = lms_call($config, 'GET', '/api/integrations/walnut/progress?account_id=' . rawurlencode((string) $user['id']) . '&email=' . rawurlencode((string) $user['email']), null);
    if ($status !== 200 || !is_array($reply) || !is_array($reply['courses'] ?? [])) {
        if ($status !== 200) {
            error_log('Course progress was not available from Walnut LMS (HTTP ' . $status . ').');
        }
        return $none;
    }
    $lms = lms_origin($config);
    // Without the sign-in secret a course is opened on the LMS itself, where the person signs in there.
    $sso = !empty($config['sso_lms']);
    $count = function ($value): int {
        return is_numeric($value) ? max(0, min(100000, (int) $value)) : 0;
    };
    $courses = [];
    foreach (array_slice(array_values((array) ($reply['courses'] ?? [])), 0, 50) as $c) {
        $slug = is_array($c) && is_string($c['lms_course_slug'] ?? null) ? $c['lms_course_slug'] : '';
        $state = is_array($c) && is_string($c['status'] ?? null) ? $c['status'] : '';
        if (!preg_match('/^[a-z0-9][a-z0-9-]{0,79}$/', $slug) || !in_array($state, ['active', 'completed', 'expired'], true)) {
            continue;
        }
        $total = $count($c['total_lessons'] ?? 0);
        $certificate = null;
        if (is_array($c['certificate'] ?? null)) {
            $serial = is_string($c['certificate']['serial'] ?? null) && preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/', $c['certificate']['serial']) ? $c['certificate']['serial'] : null;
            $score = $c['certificate']['score'] ?? null;
            $certificate = [
                'title' => lms_text($c['certificate']['title'] ?? null, 160) ?: 'Certificate',
                'serial' => $serial,
                'score' => is_numeric($score) ? max(0, min(100, round((float) $score, 1))) : null,
                'verifyUrl' => $serial !== null ? $lms . '/verify/' . rawurlencode($serial) : null,
            ];
        }
        $courses[] = [
            'slug' => $slug,
            'title' => lms_text($c['title'] ?? null, 160) ?: $slug,
            'status' => $state,
            'progress' => is_numeric($c['progress_percent'] ?? null) ? max(0, min(100, (int) round((float) $c['progress_percent']))) : 0,
            'completedLessons' => $total > 0 ? min($total, $count($c['completed_lessons'] ?? 0)) : $count($c['completed_lessons'] ?? 0),
            'totalLessons' => $total,
            'lastActivityAt' => lms_time($c['last_activity_at'] ?? null),
            'enrolledAt' => lms_time($c['enrolled_at'] ?? null),
            'completedAt' => lms_time($c['completed_at'] ?? null),
            'certificate' => $certificate,
            'open' => $sso ? '/api/sso.php?app=walnut-lms&next=' . rawurlencode('/learn/' . $slug) : $lms . '/courses/' . rawurlencode($slug),
        ];
    }
    return ['configured' => true, 'available' => true, 'courses' => $courses];
}

// The LMS's address for a purchase made on this website. PROPOSED, NOT YET CONFIRMED by the LMS team:
// keep WALNUT_LMS_BACKFILL off until they confirm this path and the body below.
const LMS_BACKFILL_PATH = '/api/integrations/walnut/enrolments';

// Hands the courses bought on this website, before the LMS sold them, to the LMS once, so those learners
// have them there. Switched off unless config lms_backfill is set (WALNUT_LMS_BACKFILL=1). At most 10
// purchases every two minutes, oldest first, after the dashboard that set it off has been answered (see
// account_dashboard). The LMS keys each one on its payment ID, so sending one again is harmless.
// A purchase carries the account ID only when that account has proved the email is theirs; otherwise
// account_id is null and the LMS keys it on the email.
//   2xx               → handed over (lms_synced_at), never sent again.
//   a refusal (4xx)   → the reason is kept (lms_error) and the purchase is not tried again, so one bad
//                       row cannot block the rest. To try it again: UPDATE wa_enrolments SET lms_error = NULL.
//   401, 403, 404, 408, 429, 5xx or no answer → about the connection, not the purchase: this run stops
//                       and the purchase waits for the next one.
// `$now` is for the site's own tooling (api/lms-sync.php): it runs a sweep straight away instead of at most
// every two minutes; everything else about it is the same.
function lms_backfill(array $config, PDO $db, bool $now = false): void
{
    if (!lms_configured($config) || empty($config['lms_backfill']) || lms_resting() || (!$now && !due('lms-backfill', 120))) {
        return;
    }
    try {
        $started = time();
        $rows = db_run($db, 'SELECT e.*, u.id AS account_id FROM wa_enrolments e LEFT JOIN wa_users u ON u.email = e.email AND u.email_verified_at IS NOT NULL WHERE e.lms_synced_at IS NULL AND e.lms_error IS NULL ORDER BY e.id LIMIT 10')->fetchAll();
        foreach ($rows as $e) {
            if (time() - $started > 4) {
                break; // checked before each call, so a run ends within a few seconds; the rest go next time
            }
            [$status, $reply] = lms_call($config, 'POST', LMS_BACKFILL_PATH, [
                'event' => 'enrolment.created',
                'account_id' => $e['account_id'],
                'email' => $e['email'],
                'name' => $e['name'],
                'phone' => $e['phone'],
                'course_slug' => $e['course_slug'],
                'course_name' => $e['course_name'],
                'amount_paise' => (int) $e['amount'] * 100, // stored here in whole rupees
                'coupon' => $e['coupon'],
                'payment_id' => $e['payment_id'],
                'order_id' => $e['order_id'],
                'created_at' => iso($e['created_at']),
            ]);
            if ($status >= 200 && $status < 300) {
                db_run($db, 'UPDATE wa_enrolments SET lms_synced_at = ? WHERE id = ?', [utc(), $e['id']]);
            } elseif ($status === 400) { // the LMS's word for a body it will never accept; every other answer is worth retrying
                $why = lms_text(is_array($reply) ? ($reply['error']['message'] ?? $reply['error'] ?? $reply['message'] ?? null) : null, 150);
                db_run($db, 'UPDATE wa_enrolments SET lms_error = ? WHERE id = ?', [text_cut('HTTP ' . $status . ($why !== '' ? ': ' . $why : ''), 200), $e['id']]);
                error_log('Walnut LMS refused purchase ' . $e['id'] . ' (HTTP ' . $status . '); it will not be sent again.');
            } else {
                error_log('Walnut LMS did not take purchase ' . $e['id'] . ' (HTTP ' . $status . '); it will be tried again.');
                break;
            }
        }
    } catch (Throwable $err) {
        error_log('Purchases were not handed to Walnut LMS: ' . $err->getMessage());
    }
}

// Where the backfill stands, per course: purchases waiting to be sent, sent (acknowledged by the LMS), and
// refused (a 400, never sent again, with the LMS's reason). Counts only, plus the reasons — no buyer details.
function lms_backfill_counts(PDO $db): array
{
    $courses = array_map(function (array $r): array {
        return ['courseSlug' => $r['course_slug'], 'total' => (int) $r['total'], 'waiting' => (int) $r['waiting'], 'sent' => (int) $r['sent'], 'refused' => (int) $r['refused']];
    }, db_run($db, 'SELECT course_slug, COUNT(*) AS total,'
        . ' SUM(CASE WHEN lms_synced_at IS NULL AND lms_error IS NULL THEN 1 ELSE 0 END) AS waiting,'
        . ' SUM(CASE WHEN lms_synced_at IS NOT NULL THEN 1 ELSE 0 END) AS sent,'
        . ' SUM(CASE WHEN lms_error IS NOT NULL THEN 1 ELSE 0 END) AS refused'
        . ' FROM wa_enrolments GROUP BY course_slug ORDER BY course_slug')->fetchAll());
    $refusals = array_map(function (array $r): array {
        return ['id' => (int) $r['id'], 'courseSlug' => $r['course_slug'], 'reason' => $r['lms_error']];
    }, db_run($db, 'SELECT id, course_slug, lms_error FROM wa_enrolments WHERE lms_error IS NOT NULL ORDER BY id')->fetchAll());
    return ['courses' => $courses, 'refusals' => $refusals];
}

/* ---------- the calls of the login page and the dashboard ---------- */

function account_dashboard(PDO $db, array $config, array $user): array
{
    // Requests and purchases are matched by email, so they are shown only once the person has proved the address is theirs.
    $verified = $user['email_verified_at'] !== null;
    if ($verified && due('push', 300)) {
        onboarding_push($config, $db);
    }
    // Off unless switched on, and asks itself at most every two minutes. It runs once this answer has been
    // sent where the server allows it (PHP-FPM, LiteSpeed), so the person does not wait on the LMS for it.
    register_shutdown_function(function () use ($config, $db) {
        if (function_exists('fastcgi_finish_request')) {
            fastcgi_finish_request();
        } elseif (function_exists('litespeed_finish_request')) {
            litespeed_finish_request();
        }
        lms_backfill($config, $db);
    });
    $requests = $verified ? db_run($db, 'SELECT * FROM wa_requests WHERE email = ? ORDER BY seq DESC LIMIT 20', [$user['email']])->fetchAll() : [];
    foreach ($requests as $i => $request) {
        if (!in_array($request['status'], ['APPROVED', 'POC_ACCOUNT_CREATED', 'REJECTED'], true)) {
            $requests[$i] = onboarding_pull($config, $db, $request);
        }
    }
    // A university account is shown the university flow only: no courses, no partner application, no partner apps.
    $universityOnly = university_only($user);
    $enrolments = $verified && !$universityOnly ? db_run($db, 'SELECT * FROM wa_enrolments WHERE email = ? ORDER BY id DESC', [$user['email']])->fetchAll() : [];
    $app = $universityOnly ? null : db_row($db, 'SELECT * FROM wa_agent_applications WHERE user_id = ?', [$user['id']]);
    $apps = array_filter(walnut_apps($config), function (array $app, string $id) use ($universityOnly): bool {
        return $app['secret'] !== '' && (!$universityOnly || $id === 'onboarding');
    }, ARRAY_FILTER_USE_BOTH);
    return [
        'profile' => [
            'name' => $user['name'],
            'email' => $user['email'],
            'emailVerified' => $verified,
            'mobile' => $user['mobile'],
            'mobileVerified' => $user['mobile_verified_at'] !== null,
            'phone' => $user['phone'],
            'accountType' => $user['account_type'],
            'accountTypes' => user_types($user),
            'hasPassword' => false,
            'memberSince' => iso($user['created_at']),
            'mobileCodes' => sms_configured($config),
        ],
        // The other Walnut apps this account can open with the same sign-in (api/sso.php); each app
        // decides for itself whether to let this email in.
        'apps' => array_values(array_map(function (string $id, array $app): array {
            return ['id' => $id, 'name' => $app['name'], 'href' => '/api/sso.php?app=' . $id];
        }, array_keys($apps), $apps)),
        'university' => [
            'onboarding' => null,
            'requests' => array_map(function (array $r): array {
                return [
                    'reference' => (string) $r['reference'], // empty until the Onboarding Tool has numbered it
                    'status' => $r['status'],
                    'universityName' => $r['university_name'],
                    // the first lines of the configuration are its summary (goal, engagement, counts)
                    'summary' => explode("\n\n", (string) $r['configuration'])[0] ?: null,
                    'submittedAt' => iso($r['created_at']),
                    'updatedAt' => iso($r['updated_at']),
                ];
            }, $requests),
        ],
        'student' => [
            'enrolments' => array_map(function (array $e): array {
                return [
                    'id' => (int) $e['id'],
                    'courseSlug' => $e['course_slug'],
                    'courseName' => $e['course_name'],
                    'amount' => (int) $e['amount'],
                    'currency' => $e['currency'],
                    'coupon' => $e['coupon'],
                    'paymentId' => $e['payment_id'],
                    'purchasedAt' => iso($e['created_at']),
                    'progress' => (int) $e['progress'],
                    'completedAt' => iso($e['completed_at']),
                    'onLms' => !empty($e['lms_synced_at']), // handed to Walnut LMS, so it is counted there
                ];
            }, $enrolments),
            // Courses are taken on Walnut LMS. Asked of it for a proven email only, and never for a
            // university account (not asked at all: 'configured' false, so no "unavailable" note); the
            // dashboard works the same when the LMS cannot be reached.
            'lms' => $verified && !$universityOnly ? lms_progress($config, $user) : ['configured' => false, 'available' => false, 'courses' => []],
        ],
        'agent' => [
            'questions' => agent_questions(),
            'application' => $app ? [
                'reference' => sprintf('AG-%06d', $app['seq']),
                'status' => $app['status'],
                'answers' => json_decode($app['answers'], true) ?: new stdClass(),
                'decisionNote' => $app['decision_note'],
                'submittedAt' => iso($app['created_at']),
                'updatedAt' => iso($app['updated_at']),
            ] : null,
        ],
    ];
}

function account_handle(array $config, string $method, string $path, ?string $body): void
{
    $in = $body !== null && $body !== '' ? json_decode($body, true) : [];
    if (!is_array($in)) {
        account_fail(400, 'Invalid request.');
    }
    $text = function (string $key) use ($in): string {
        return is_string($in[$key] ?? null) ? trim($in[$key]) : '';
    };
    $db = account_db($config);
    if (!$db) {
        account_fail(503, 'Login is not available right now. Please try again later.');
    }

    switch ($method . ' ' . $path) {
        case 'GET /auth/otp/options':
            respond(200, ['defaultCountryCode' => DEFAULT_COUNTRY_CODE, 'length' => OTP_LENGTH, 'mobile' => sms_configured($config), 'password' => false]);

        case 'POST /auth/otp/send':
            rate_limit('otp-send', 20, 900);
            if (!in_array($text('channel'), ['email', 'mobile'], true)) {
                account_fail(400, 'Invalid request.');
            }
            respond(200, otp_send($db, $config, $text('channel'), $text('destination'), 'LOGIN'));

        case 'POST /auth/otp/verify':
            rate_limit('otp-verify', 60, 900);
            $challenge = otp_consume($db, $config, $text('challengeId'), $text('code'), 'LOGIN');
            $channel = $challenge['channel'] === 'EMAIL' ? 'email' : 'mobile';
            $user = db_row($db, 'SELECT * FROM wa_users WHERE ' . ($channel === 'email' ? 'email' : 'mobile') . ' = ?', [$challenge['destination']]);
            if (!$user) {
                // Someone new: the page asks who they are, and proves with this token that the code was right.
                respond(200, ['needsProfile' => true, 'channel' => $channel, 'registrationToken' => token_sign($config, ['kind' => 'registration', 'channel' => $channel, 'destination' => $challenge['destination']], REGISTRATION_SECONDS)]);
            }
            if (!$user['is_active']) {
                account_fail(401, 'This account is inactive. Please contact Walnut.');
            }
            if ($channel === 'email' && $user['email_verified_at'] === null) {
                db_run($db, 'UPDATE wa_users SET email_verified_at = ?, updated_at = ? WHERE id = ?', [utc(), utc(), $user['id']]);
            }
            respond(200, session_start_for($db, $config, $user));

        case 'POST /auth/otp/register':
            rate_limit('otp-register', 20, 900);
            $proof = token_read($config, $text('registrationToken'), 'registration');
            if (!$proof) {
                account_fail(400, 'This sign-up has expired. Please request a new OTP.');
            }
            $name = (string) preg_replace('/[\x00-\x1F\x7F]+/', ' ', $text('name'));
            if (text_length($name) < 2 || text_length($name) > 120) {
                account_fail(400, 'Please enter your name.');
            }
            // One or several of: university, courses, partner. The first is the account's main one.
            $types = clean_types($in['accountTypes'] ?? [$text('accountType')]);
            if (!$types) {
                account_fail(400, 'Please choose at least one.');
            }
            if (!allowed_types($types)) {
                account_fail(400, UNIVERSITY_ONLY, ['reason' => 'UNIVERSITY_EXCLUSIVE']);
            }
            $byEmail = $proof['channel'] === 'email';
            $email = $byEmail ? $proof['destination'] : normalise('email', $text('email'));
            if (db_row($db, 'SELECT id FROM wa_users WHERE email = ?', [$email])) {
                account_fail(409, $byEmail ? 'An account with this email already exists. Please sign in.' : 'An account already uses this email. Sign in with it, then add your mobile number from your profile.');
            }
            if (!$byEmail && db_row($db, 'SELECT id FROM wa_users WHERE mobile = ?', [$proof['destination']])) {
                account_fail(409, 'An account with this mobile number already exists. Please sign in.');
            }
            // Only what the code proved is marked verified.
            $user = ['id' => new_id(), 'email' => $email, 'name' => $name, 'account_type' => $types[0], 'account_types' => implode(',', $types)];
            $mobile = $byEmail ? null : $proof['destination'];
            try {
                db_run($db, 'INSERT INTO wa_users (id, email, name, account_type, account_types, mobile, phone, email_verified_at, mobile_verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
                    $user['id'], $email, $name, $user['account_type'], $user['account_types'], $mobile, $mobile, $byEmail ? utc() : null, $byEmail ? null : utc(), utc(), utc(),
                ]);
            } catch (PDOException $e) { // two sign-ups for the same person at once
                account_fail(409, 'An account with these details already exists. Please sign in.');
            }
            respond(201, session_start_for($db, $config, $user));

        case 'POST /auth/login':
            account_fail(401, 'Password sign-in is not available. Please use a one-time code.');

        case 'POST /auth/refresh':
            $hash = session_token_hash();
            $user = $hash ? db_row($db, 'SELECT u.* FROM wa_sessions s JOIN wa_users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND u.is_active = 1', [$hash, utc()]) : null;
            if (!$user) {
                account_fail(401, 'Session expired, please sign in again');
            }
            respond(200, access_reply($config, $user));

        case 'POST /auth/logout':
            $hash = session_token_hash();
            if ($hash) {
                db_run($db, 'UPDATE wa_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL', [utc(), $hash]);
            }
            session_cookie('', 1);
            respond(200, ['ok' => true]);

        case 'GET /account/dashboard':
            respond(200, account_dashboard($db, $config, account_user($db, $config)));

        case 'PATCH /account/profile':
            $user = account_user($db, $config);
            $name = (string) preg_replace('/[\x00-\x1F\x7F]+/', ' ', $text('name'));
            if (text_length($name) < 2 || text_length($name) > 120) {
                account_fail(400, 'Please enter your name.');
            }
            if ($text('phone') !== '' && !preg_match('/^[0-9+ ()\-]{7,40}$/', $text('phone'))) {
                account_fail(400, 'Please enter a valid phone number.');
            }
            db_run($db, 'UPDATE wa_users SET name = ?, phone = ?, updated_at = ? WHERE id = ?', [$name, $text('phone') ?: null, utc(), $user['id']]);
            respond(200, ['ok' => true]);

        case 'POST /account/services':
            // Adds to what the account is used for (chosen on the home page before signing in). Nothing is ever removed here.
            $user = account_user($db, $config);
            $current = user_types($user);
            // A university account stays a university account, and no other account becomes one.
            $extra = in_array('UNIVERSITY', $current, true) ? [] : array_diff(clean_types($in['types'] ?? []), $current ? ['UNIVERSITY'] : []);
            $types = clean_types(array_merge($current, $extra));
            if (!allowed_types($types)) {
                $types = $current;
            }
            if ($types) {
                db_run($db, 'UPDATE wa_users SET account_types = ?, account_type = COALESCE(account_type, ?), updated_at = ? WHERE id = ?', [implode(',', $types), $types[0], utc(), $user['id']]);
            }
            respond(200, ['ok' => true, 'accountTypes' => $types]);

        case 'POST /account/verify/start':
            rate_limit('otp-send', 20, 900);
            $user = account_user($db, $config);
            if ($text('channel') === 'email') {
                respond(200, otp_send($db, $config, 'email', $user['email'], 'VERIFY_EMAIL', $user['id']));
            }
            if ($text('channel') !== 'mobile') {
                account_fail(400, 'Invalid request.');
            }
            $mobile = normalise('mobile', $text('destination'));
            // A number that signs someone else in is never moved silently from one account to another.
            if (db_row($db, 'SELECT id FROM wa_users WHERE mobile = ? AND id <> ?', [$mobile, $user['id']])) {
                account_fail(409, 'This mobile number is already used by another Walnut account.');
            }
            respond(200, otp_send($db, $config, 'mobile', $mobile, 'VERIFY_MOBILE', $user['id']));

        case 'POST /account/verify/confirm':
            rate_limit('otp-verify', 60, 900);
            $user = account_user($db, $config);
            $email = $text('channel') === 'email';
            $challenge = otp_consume($db, $config, $text('challengeId'), $text('code'), $email ? 'VERIFY_EMAIL' : 'VERIFY_MOBILE');
            if ($challenge['user_id'] !== $user['id']) {
                account_fail(400, 'This OTP is no longer valid. Please request a new OTP.', ['reason' => 'OTP_INVALIDATED']);
            }
            try {
                if ($email) {
                    db_run($db, 'UPDATE wa_users SET email_verified_at = ?, updated_at = ? WHERE id = ?', [utc(), utc(), $user['id']]);
                } else {
                    db_run($db, 'UPDATE wa_users SET mobile = ?, phone = ?, mobile_verified_at = ?, updated_at = ? WHERE id = ?', [$challenge['destination'], $challenge['destination'], utc(), utc(), $user['id']]);
                }
            } catch (PDOException $e) {
                account_fail(409, 'This mobile number is already used by another Walnut account.');
            }
            respond(200, ['ok' => true]);

        case 'POST /account/agent-application':
            rate_limit('agent-application', 20, 900);
            $user = account_user($db, $config);
            if (university_only($user)) {
                account_fail(403, 'A university account cannot apply as a partner. Please use a separate account for the partner programme.', ['reason' => 'UNIVERSITY_EXCLUSIVE']);
            }
            $questions = agent_questions();
            [$answers, $problems] = check_answers($questions, is_array($in['answers'] ?? null) ? $in['answers'] : []);
            if ($problems) {
                account_fail(422, 'Please complete the highlighted answers.', $problems);
            }
            $existing = db_row($db, 'SELECT seq, status FROM wa_agent_applications WHERE user_id = ?', [$user['id']]);
            // An application can be corrected until Walnut has decided on it.
            if ($existing && in_array($existing['status'], ['APPROVED', 'REJECTED'], true)) {
                account_fail(409, 'This application has already been decided.');
            }
            $json = json_encode($answers, JSON_UNESCAPED_UNICODE);
            if ($existing) {
                db_run($db, 'UPDATE wa_agent_applications SET answers = ?, updated_at = ? WHERE seq = ?', [$json, utc(), $existing['seq']]);
            } else {
                db_run($db, 'INSERT INTO wa_agent_applications (user_id, answers, created_at, updated_at) VALUES (?, ?, ?, ?)', [$user['id'], $json, utc(), utc()]);
            }
            $reference = sprintf('AG-%06d', $existing ? $existing['seq'] : $db->lastInsertId());
            // Applying makes the account a partner account as well as whatever it already was (a learner keeps their courses).
            $withPartner = clean_types(array_merge(user_types($user), ['AGENT']));
            if (allowed_types($withPartner) && $withPartner !== user_types($user)) {
                db_run($db, 'UPDATE wa_users SET account_types = ?, updated_at = ? WHERE id = ?', [implode(',', $withPartner), utc(), $user['id']]);
            }
            // The team hears about it by email; the application itself is safe either way.
            $rows = [['Application', $reference . ($existing ? ' (updated)' : '')], ['Name', $user['name']], ['Email', $user['email']], ['Phone', (string) ($user['mobile'] ?? $user['phone'])]];
            foreach ($questions as $q) {
                if (isset($answers[$q['id']])) {
                    $rows[] = [$q['label'], implode(', ', (array) $answers[$q['id']])];
                }
            }
            send_email($config, 'enquiry_notify', $config['email_notify'], 'Walnut Data Tech', ['topic' => 'Partner application ' . $reference, 'name' => $user['name'], 'email' => $user['email'], 'from' => $answers['organisationName'] ?? $user['name']], $rows);
            respond(200, ['ok' => true, 'reference' => $reference, 'status' => $existing ? $existing['status'] : 'SUBMITTED']);
    }
    account_fail(404, 'Not found.');
}
