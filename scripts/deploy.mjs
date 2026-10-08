// Builds the site and publishes it to the web host over FTP (explicit TLS when the server offers it).
//
//   node scripts/deploy.mjs          — build, upload, verify
//   node scripts/deploy.mjs --yes    — skip the "overwrite existing site?" question
//
// Reads .env (see .env.example): FTP_HOST, FTP_USER, FTP_PASS, FTP_DIR, SITE_URL,
// RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, TWILIO_API_KEY, TWILIO_API_SECRET, EMAIL_FROM, EMAIL_FROM_NAME, EMAIL_NOTIFY,
// DB_HOST, DB_NAME, DB_USER, DB_PASS, ACCOUNT_SECRET, TWILIO_ACCOUNT_SID, SMS_FROM, WALNUT_SSO_SECRET_<APP>,
// WALNUT_LMS_URL, WALNUT_LMS_INTEGRATION_SECRET, WALNUT_LMS_BACKFILL, RAZORPAY_WEBHOOK_SECRET, WALNUT_PAY_SECRET_<APP>.
//
// Order matters for safety: the API is uploaded first and checked to be executing as PHP, and only then
// is the file holding the secrets (config.php) uploaded. The host loads a new config.php (and new PHP)
// only minutes after it is uploaded, so the deploy waits until health.php answers with this deploy's
// config_id, checks the settings, and only then publishes the pages that rely on them. (On a host where
// PHP is not running yet, the pages have to go up first, with the API.)

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { waitForConfig, describeState } from './wait-config.mjs';
import { mkdtempSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { loadEnv, projectRoot } from './env.mjs';
import config from '../site.config.mjs';

const env = loadEnv();
const fail = (msg) => {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
};
for (const key of ['FTP_HOST', 'FTP_USER', 'FTP_PASS', 'SITE_URL']) {
  if (!env[key]) fail(`${key} is missing from .env (copy .env.example to .env and fill it in).`);
}
const siteUrl = env.SITE_URL.replace(/\/+$/, '');
const hasKeys = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
const hasEmail = Boolean(env.TWILIO_API_KEY && env.TWILIO_API_SECRET && env.EMAIL_FROM && env.EMAIL_NOTIFY);
// The Onboarding Tool must be a public https address: a localhost value left over from development
// would make the live site try to reach itself.
const onboardingUrl = (env.ONBOARDING_API_URL || '').replace(/\/+$/, '');
const onboardingPublic = /^https:\/\/(?!localhost\b|127\.|\[::1\])/i.test(onboardingUrl);
const hasOnboarding = Boolean(onboardingPublic && env.ONBOARDING_API_KEY);
// Walnut accounts kept in the web host's own MySQL database (used when there is no Onboarding Tool).
// One-time codes go out by email, so accounts need the email settings too.
const hasAccounts = Boolean(env.DB_NAME && env.DB_USER && env.ACCOUNT_SECRET && hasEmail);
const hasSms = Boolean(hasAccounts && env.TWILIO_ACCOUNT_SID && env.SMS_FROM);
// Certificate verification talks to the LMS over https only.
const certVerifyUrl = /^https:\/\//i.test(env.CERT_VERIFY_URL || '') ? env.CERT_VERIFY_URL : '';
if (env.CERT_VERIFY_URL && !certVerifyUrl) fail('CERT_VERIFY_URL must be an https:// address.');
const hasLogin = hasOnboarding || hasAccounts;
// Walnut LMS sells the courses. Our server asks it for course progress with a shared secret, and the Enrol
// buttons sign the person in to it — both only with the account database, which holds the learners.
const lmsUrl = (env.WALNUT_LMS_URL || 'https://walnut-lms.vercel.app').replace(/\/+$/, '');
const hasLms = Boolean(hasAccounts && env.WALNUT_LMS_INTEGRATION_SECRET);
const hasLmsSso = Boolean(hasAccounts && env.WALNUT_SSO_SECRET_LMS);
// The payment gateway (api/pay/): every Walnut product's payments, on this site. Its ledger is the account
// database; each product (app) has its own secret, WALNUT_PAY_SECRET_<APP> → config pay_secret_<app>.
const PAY_APPS = ['WALNUT_LMS'];
const payApps = PAY_APPS.filter((k) => env[`WALNUT_PAY_SECRET_${k}`]);
const hasPay = Boolean(hasAccounts && hasKeys && env.RAZORPAY_WEBHOOK_SECRET && payApps.length);
// This deploy's config.php ID, and how long (in seconds) to wait for the host to load that file.
const configId = randomBytes(8).toString('hex');
const CONFIG_WAIT = 15 * 60;
// Always checked: the course links, the redirects in .htaccess and the sign-in tokens all go to this
// address. A public https origin with no path (the LMS checks each signature against the path it
// receives), the rule main.js uses too.
if (!/^https:\/\/(?!localhost\b|127\.|\[::1\])[A-Za-z0-9.-]+(:\d{1,5})?$/i.test(lmsUrl)) fail('WALNUT_LMS_URL must be the public https address of Walnut LMS, with no path (e.g. https://walnut-lms.vercel.app).');

// Real money must not be taken before the refund terms are published.
if (hasKeys && env.RAZORPAY_KEY_ID.startsWith('rzp_live_') && !config.legal.refundPolicy) {
  fail('Live Razorpay keys are set, but legal.refundPolicy in site.config.mjs is empty.\n  Publish your refund and cancellation terms there first (they appear on the Terms page), then deploy again.');
}
const dist = join(projectRoot, 'dist');
const tmp = mkdtempSync(join(tmpdir(), 'walnut-deploy-'));
process.on('exit', () => rmSync(tmp, { recursive: true, force: true }));

/* ---------- curl plumbing ---------- */

const q = (v) => `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`; // curl config-file quoting
const encodePath = (p) => p.split('/').map(encodeURIComponent).join('/');
let tlsFlags = null;

// Credentials go to curl through a private config file, never on the command line.
function curl(lines, { quiet = false } = {}) {
  const file = join(tmp, `curl-${Math.random().toString(36).slice(2)}.cfg`);
  writeFileSync(file, [`user = ${q(`${env.FTP_USER}:${env.FTP_PASS}`)}`, 'silent', 'show-error', 'connect-timeout = 20', ...(tlsFlags || []), ...lines].join('\n'), { mode: 0o600 });
  const run = spawnSync('curl', ['-K', file], { encoding: 'utf8' });
  rmSync(file, { force: true });
  if (run.status !== 0 && !quiet) console.error(run.stderr.trim());
  return run;
}

const ftpUrl = (path = '') => `ftp://${env.FTP_HOST}/${encodePath(path)}`;
const list = (dir) => curl([`url = ${q(ftpUrl(dir))}`, 'list-only'], { quiet: true });

function connect() {
  // Prefer verified TLS, then TLS without certificate verification (common when connecting by IP), then plain FTP.
  // Windows' curl (Schannel) breaks FTP uploads larger than one TLS 1.3 record, leaving an empty file
  // on the server; TLS 1.2 works.
  const tls = process.platform === 'win32' ? ['ssl-reqd', 'tls-max = "1.2"'] : ['ssl-reqd'];
  const modes = [
    ['verified TLS', tls],
    ['TLS (certificate not verified)', [...tls, 'insecure']],
    ['plain FTP — not encrypted', []],
  ];
  for (const [label, flags] of modes) {
    tlsFlags = flags;
    const run = list('');
    if (run.status === 0) {
      console.log(`✓ Connected to ${env.FTP_HOST} using ${label}`);
      return run.stdout.split(/\r?\n/).filter(Boolean);
    }
    if (run.status === 67) fail('The FTP server rejected the username or password in .env.');
  }
  fail(`Could not connect to ${env.FTP_HOST} over FTP.`);
}

// What the server said last, for a failed transfer — with the sign-in lines removed.
const transcript = (run) =>
  (run.stderr || '')
    .split(/\r?\n/)
    .filter((line) => /^[<>*] /.test(line) && !/^> (USER|PASS)\b/i.test(line) && !/^\* (Connected|Trying|TLS|SSL|ALPN|CAfile|CApath|Server certificate|subject|issuer|start date|expire date)/i.test(line))
    .slice(-8)
    .map((line) => `      ${line}`)
    .join('\n');

// Each file goes up on a connection of its own. This host confirms the first file of a connection
// and then stops answering for the ones that follow, so sending several per connection stalls;
// one at a time is slower but goes through. A file that fails is tried again, and if it still will
// not go the conversation with the server is shown. Sending a file twice is harmless: each upload
// replaces the whole file.
function upload(files, remoteDir) {
  const TRIES = 3;
  const send = (file, extra = []) => curl(['ftp-create-dirs', ...extra, `upload-file = ${q(file[0])}`, `url = ${q(ftpUrl(remoteDir + file[1]))}`], { quiet: true });
  files.forEach((file, i) => {
    for (let attempt = 1; attempt <= TRIES; attempt++) {
      const run = send(file, attempt === TRIES ? ['verbose'] : []);
      if (run.status === 0) break;
      if (attempt === TRIES) {
        console.log(`  ${file[1]} could not be uploaded: ${(run.stderr.match(/curl: \(\d+\)[^\n]*/) || [run.stderr.trim().split('\n').pop() || 'no answer'])[0]}\n    What the server said last:\n${transcript(run) || '      (nothing)'}`);
        fail(`Upload stopped at file ${i + 1} of ${files.length}.${i ? ` The first ${i} are in place; run the deploy again to finish.` : ''}`);
      }
      spawnSync('sleep', [String(3 * attempt)]);
    }
    if ((i + 1) % 10 === 0 || i + 1 === files.length) console.log(`  ✓ ${i + 1} of ${files.length}`);
  });
}

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));

async function health() {
  try {
    const res = await fetch(`${siteUrl}/api/health.php?t=${Date.now()}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
    const text = await res.text();
    try {
      return { status: res.status, data: JSON.parse(text) };
    } catch {
      return { status: res.status, raw: text };
    }
  } catch (err) {
    return { status: 0, raw: err.message };
  }
}

/* ---------- deploy ---------- */

console.log(`Building for ${siteUrl} …`);
// Login and the dashboard are published exactly when the accounts they rely on are configured.
if (config.accounts && !hasLogin) console.log('! `accounts` is on in site.config.mjs but neither the account database (DB_NAME, DB_USER, ACCOUNT_SECRET) nor ONBOARDING_API_URL / ONBOARDING_API_KEY is set — login and the dashboard are left out of this deploy.');
// The course catalogue comes from Walnut LMS. When it cannot be fetched the build uses the last copy,
// so this never stops a deploy.
spawnSync(process.execPath, ['scripts/fetch-catalogue.mjs'], { cwd: projectRoot, stdio: 'inherit', env: { ...process.env, WALNUT_LMS_URL: lmsUrl } });
// Enrol signs the person in to the LMS only when the LMS can receive that sign-in; otherwise it opens the course on the LMS.
const build = spawnSync(process.execPath, ['build.mjs'], { cwd: projectRoot, stdio: 'inherit', env: { ...process.env, SITE_URL: siteUrl, ACCOUNTS: hasLogin ? '1' : '', ACCOUNTS_OFF: hasLogin ? '' : '1', WALNUT_LMS_URL: lmsUrl, LMS_SSO: hasLmsSso ? '1' : '', PAY: hasPay ? '1' : '' } });
if (build.status !== 0) fail('The build failed.');
const check = spawnSync(process.execPath, ['check.mjs'], { cwd: projectRoot, stdio: 'inherit', env: { ...process.env, SITE_URL: siteUrl } });
if (check.status !== 0) fail('Link check failed — nothing was uploaded.');

const home = connect();
let remoteDir = (env.FTP_DIR || '').replace(/^\/+|\/+$/g, '');
if (!remoteDir && home.includes('public_html')) remoteDir = 'public_html';
if (remoteDir) remoteDir += '/';
const existing = remoteDir ? list(remoteDir).stdout.split(/\r?\n/).filter(Boolean) : home;
console.log(`  Remote folder: /${remoteDir}  (${existing.filter((n) => n !== '.' && n !== '..').length} existing items)`);

const indexFiles = existing.filter((n) => /^index\.(html?|php)$/i.test(n));
if (indexFiles.length && !process.argv.includes('--yes')) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`  A site already exists there (${indexFiles.join(', ')}). Replace it? [y/N] `);
  rl.close();
  if (!/^y(es)?$/i.test(answer.trim())) fail('Cancelled — nothing was uploaded.');
}

const files = walk(dist).map((f) => [f, relative(dist, f).split(sep).join('/')]);
// Where the API already runs, it goes up first and its new settings are loaded (which takes the host
// minutes) before the pages that rely on them are published, so a page never points at something the
// server cannot do yet. On a host where PHP is not running yet, everything goes up at once, as it must
// before PHP can be proved to execute.
let state = await health();
const warm = Boolean(state.data?.ok);
const api = files.filter(([, path]) => path.startsWith('api/'));
const pages = files.filter(([, path]) => !path.startsWith('api/'));
if (warm) {
  console.log(`Uploading the API (${api.length} files); the pages follow once the server has loaded it …`);
  upload(api, remoteDir);
  console.log('✓ API uploaded');
} else {
  console.log(`Uploading ${files.length} files …`);
  upload(files, remoteDir);
  console.log('✓ Site uploaded');
}

// The secret is only uploaded once the server has proved it executes PHP (otherwise it could be served as text).
state = await health();
if (!state.data?.ok) {
  console.log(`\n! ${siteUrl}/api/health.php did not answer as expected (HTTP ${state.status}).`);
  console.log(state.status === 404
    ? '  The files may have gone to a folder that is not the website root. Set FTP_DIR in .env to the web root and run again.'
    : '  PHP may not be enabled for this site. The pages are live, but online payment is NOT active.');
  console.log(`  FTP login folder contains: ${home.join(', ') || '(empty)'}`);
  fail('Razorpay keys were not uploaded.');
}
console.log(`✓ Payment API is running${state.data.curl ? '' : ' — WARNING: the PHP curl extension is missing, payments will fail'}`);

if (!hasKeys) console.log('! RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set in .env — checkout is disabled.');
if (!hasEmail) console.log('! TWILIO_API_KEY / TWILIO_API_SECRET / EMAIL_FROM / EMAIL_NOTIFY are not all set in .env — enquiry forms and confirmation emails are disabled.');

if (!hasOnboarding) {
  console.log(
    onboardingUrl && !onboardingPublic
      ? '! ONBOARDING_API_URL is not a public https address — University requests will not be filed in the Onboarding Tool.'
      : hasAccounts
        ? '  No Onboarding Tool is set — University requests are kept in the site\'s own account database.'
        : '! ONBOARDING_API_URL / ONBOARDING_API_KEY are not set in .env — University requests reach the team by email only.'
  );
}
if (!hasAccounts && !hasOnboarding) console.log('! DB_NAME / DB_USER / ACCOUNT_SECRET (and the email settings) are not all set in .env — login and the dashboard are not published.');
if (hasAccounts && !hasSms) console.log('  TWILIO_ACCOUNT_SID / SMS_FROM are not set in .env — login offers the email code only (no SMS).');
if (hasAccounts && !hasLms) console.log('  WALNUT_LMS_INTEGRATION_SECRET is not set in .env — the dashboard shows past purchases but not course progress from Walnut LMS.');
if (hasAccounts && !hasLmsSso) console.log('  WALNUT_SSO_SECRET_LMS is not set in .env — Enrol opens the course on Walnut LMS, where the learner signs in there.');

if (hasKeys || hasEmail || hasOnboarding || hasAccounts) {
  const phpStr = (v) => `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const settings = {
    ...(hasKeys ? { key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET } : {}),
    ...(hasEmail ? { twilio_key: env.TWILIO_API_KEY, twilio_secret: env.TWILIO_API_SECRET, email_from: env.EMAIL_FROM, email_from_name: env.EMAIL_FROM_NAME || 'Walnut Data Tech', email_notify: env.EMAIL_NOTIFY } : {}),
    ...(hasOnboarding ? { onboarding_url: onboardingUrl, onboarding_key: env.ONBOARDING_API_KEY } : {}),
    ...(hasAccounts ? { db_host: env.DB_HOST || 'localhost', db_name: env.DB_NAME, db_user: env.DB_USER, db_pass: env.DB_PASS || '', account_secret: env.ACCOUNT_SECRET } : {}),
    ...(hasSms ? { twilio_sid: env.TWILIO_ACCOUNT_SID, sms_from: env.SMS_FROM } : {}),
    ...(certVerifyUrl ? { cert_verify_url: certVerifyUrl, ...(env.CERT_VERIFY_KEY ? { cert_verify_key: env.CERT_VERIFY_KEY } : {}) } : {}),
    // one sign-in for the other Walnut apps: each app's own secret, set only once that app can receive it
    ...(hasAccounts ? Object.fromEntries(['ONBOARDING', 'COURSE_FINDER', 'LEADS', 'LMS'].filter((k) => env[`WALNUT_SSO_SECRET_${k}`]).map((k) => [`sso_${k.toLowerCase()}`, env[`WALNUT_SSO_SECRET_${k}`]])) : {}),
    // Walnut LMS: its address, the secret our server signs its calls with, and whether past website
    // purchases are handed to it (off until the LMS has confirmed how it receives them)
    ...(hasAccounts ? { lms_url: lmsUrl } : {}),
    ...(hasLms ? { lms_secret: env.WALNUT_LMS_INTEGRATION_SECRET } : {}),
    ...(hasLms && env.WALNUT_LMS_BACKFILL === '1' ? { lms_backfill: true } : {}),
    // the payment gateway: Razorpay's webhook secret, each app's secret, and this site's address (pay links)
    ...(hasPay ? { rzp_webhook_secret: env.RAZORPAY_WEBHOOK_SECRET, site_url: siteUrl, ...Object.fromEntries(payApps.map((k) => [`pay_secret_${k.toLowerCase()}`, env[`WALNUT_PAY_SECRET_${k}`]])) } : {}),
    // which deploy wrote this file (not a secret): health.php reports it once the server has loaded it
    config_id: configId,
  };
  const configFile = join(tmp, 'config.php');
  writeFileSync(
    configFile,
    `<?php\n// Written by scripts/deploy.mjs. Never commit or share this file.\nreturn [\n${Object.entries(settings).map(([k, v]) => `  '${k}' => ${v === true ? 'true' : phpStr(v)},`).join('\n')}\n];\n`,
    { mode: 0o600 }
  );
  upload([[configFile, 'api/config.php']], remoteDir);

  // The secrets must never be readable over the web.
  const probe = await fetch(`${siteUrl}/api/config.php?t=${Date.now()}`, { signal: AbortSignal.timeout(20_000) }).then((r) => r.text()).catch(() => '');
  const leaked = ['key_secret', 'twilio_secret', 'onboarding_key', 'db_pass', 'account_secret', 'lms_secret', 'sso_lms', 'rzp_webhook_secret', 'pay_secret_', 'cert_verify_key', env.CERT_VERIFY_KEY, env.RAZORPAY_KEY_SECRET, env.TWILIO_API_SECRET, env.ONBOARDING_API_KEY, env.DB_PASS, env.ACCOUNT_SECRET, env.WALNUT_LMS_INTEGRATION_SECRET, env.RAZORPAY_WEBHOOK_SECRET, ...['ONBOARDING', 'COURSE_FINDER', 'LEADS', 'LMS'].map((k) => env[`WALNUT_SSO_SECRET_${k}`]), ...PAY_APPS.map((k) => env[`WALNUT_PAY_SECRET_${k}`])].filter(Boolean).some((needle) => probe.includes(needle));
  if (leaked) {
    curl([`url = ${q(ftpUrl(remoteDir))}`, `quote = ${q(`DELE ${remoteDir}api/config.php`)}`, 'list-only'], { quiet: true });
    fail('The server exposed api/config.php as text, so it was deleted again. Rotate the Razorpay, Twilio, database, Onboarding Tool and Walnut app (SSO and LMS) secrets and contact the host about PHP handling.');
  }

  // The host caches compiled PHP and loads the new config.php (and new API code) only minutes later.
  // Until then the API still runs on the previous settings, so they are checked only once health.php
  // answers with this deploy's config_id — and, where the API was already running, the pages are
  // published only after that.
  const wait = await waitForConfig({ configId, health, limit: CONFIG_WAIT, log: (line) => console.log(line) });
  state = wait.state;
  if (!wait.loaded) {
    fail(`The new settings were uploaded, but after ${CONFIG_WAIT / 60} minutes the server is not using them yet (${describeState(state)}).${warm ? ' The new pages were NOT published, so the site still shows the previous ones.' : ''}
  Uploading again restarts the host's delay, so first check ${siteUrl}/api/health.php until it shows "config_id":"${configId}", then run the deploy again. If it never does, ask the host to clear the PHP cache (OPcache).`);
  }
  console.log(`✓ The server is using the new settings (after ${wait.seconds} s)`);
  if (hasKeys && !state.data?.configured) fail('The keys were uploaded but the payment API does not see them.');
  if (hasEmail && !state.data?.email) fail('The email settings were uploaded but the API does not see them.');
  if (hasOnboarding && !state.data?.onboarding) fail('The Onboarding Tool settings were uploaded but the API does not see them.');
  if (hasLms && !state.data?.lms) fail('The Walnut LMS settings were uploaded but the API does not see them. Check WALNUT_LMS_URL (a public https address) and WALNUT_LMS_INTEGRATION_SECRET in .env.');
  if (hasLmsSso && !state.data?.lms_sso) fail('WALNUT_SSO_SECRET_LMS was uploaded but the API does not see it.');
  if (hasPay && !state.data?.pay) fail('The payment gateway settings were uploaded but the API does not see them (Razorpay keys, RAZORPAY_WEBHOOK_SECRET, WALNUT_PAY_SECRET_<APP>).');
  if (hasAccounts && !state.data?.accounts) fail('The account database settings were uploaded, but the server could not connect to the database. Check DB_HOST, DB_NAME, DB_USER and DB_PASS in .env, and that PHP has the pdo_mysql extension.');
  if (hasKeys) console.log(`✓ Razorpay connected in ${state.data.mode.toUpperCase()} mode`);
  if (hasEmail) console.log(`✓ Email connected — sending from ${env.EMAIL_FROM}, notifications to ${env.EMAIL_NOTIFY}`);
  if (hasOnboarding) console.log(`✓ University requests will be filed in the Onboarding Tool at ${onboardingUrl}`);
  if (hasAccounts) console.log(`✓ Walnut accounts connected — database ${env.DB_NAME}, one-time codes by email${hasSms ? ' and SMS' : ''}`);
  if (hasLms) console.log(`✓ Walnut LMS connected at ${lmsUrl} — course progress on the dashboard${env.WALNUT_LMS_BACKFILL === '1' ? ', past website purchases handed to the LMS' : ''}`);
  if (hasLmsSso) console.log('✓ Walnut LMS sign-in connected — Enrol and Continue open the LMS signed in');
  if (hasPay) console.log(`✓ Payment gateway open for ${state.data.pay_apps.join(', ')} — Razorpay in ${state.data.mode.toUpperCase()} mode; webhook ${siteUrl}/api/pay/webhook.php`);
}

// The API and its settings are in place, so now the pages that use them.
if (warm) {
  console.log(`Uploading the pages (${pages.length} files) …`);
  upload(pages, remoteDir);
  console.log('✓ Pages uploaded');
}

const home200 = await fetch(`${siteUrl}/?t=${Date.now()}`).then((r) => r.status).catch(() => 0);
console.log(`${home200 === 200 ? '✓' : '!'} ${siteUrl}/ responded with HTTP ${home200}`);
console.log(`\nDone. Live at ${siteUrl}/\n`);
