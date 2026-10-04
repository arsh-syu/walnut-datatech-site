// Builds the site and publishes it to the web host over FTP (explicit TLS when the server offers it).
//
//   node scripts/deploy.mjs          — build, upload, verify
//   node scripts/deploy.mjs --yes    — skip the "overwrite existing site?" question
//
// Reads .env (see .env.example): FTP_HOST, FTP_USER, FTP_PASS, FTP_DIR, SITE_URL,
// RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, TWILIO_API_KEY, TWILIO_API_SECRET, EMAIL_FROM, EMAIL_FROM_NAME, EMAIL_NOTIFY,
// DB_HOST, DB_NAME, DB_USER, DB_PASS, ACCOUNT_SECRET, TWILIO_ACCOUNT_SID, SMS_FROM.
//
// Order matters for safety: the site and the payment API are uploaded first, the API is checked
// to be executing as PHP, and only then is the file holding the Razorpay secret uploaded.

import { spawnSync } from 'node:child_process';
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
const hasLogin = hasOnboarding || hasAccounts;

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

// Files go up a few at a time, and a batch the server drops is sent again. If it still will not go,
// one file is sent on its own with the conversation recorded, so the reason is shown rather than
// guessed. Sending a file twice is harmless: each upload replaces the whole file.
function upload(files, remoteDir) {
  const BATCH = 10;
  const send = (batch, extra = []) => {
    const lines = ['ftp-create-dirs', 'fail-early', ...extra];
    for (const [local, remote] of batch) lines.push(`upload-file = ${q(local)}`, `url = ${q(ftpUrl(remoteDir + remote))}`);
    return curl(lines, { quiet: true });
  };
  for (let start = 0; start < files.length; start += BATCH) {
    const batch = files.slice(start, start + BATCH);
    const range = `${start + 1}–${start + batch.length} of ${files.length}`;
    if (send(batch).status === 0) {
      console.log(`  ✓ files ${range}`);
      continue;
    }
    console.log(`  The server stopped answering; trying files ${range} again …`);
    spawnSync('sleep', ['5']);
    if (send(batch).status === 0) {
      console.log(`  ✓ files ${range}`);
      continue;
    }
    const run = send([batch[0]], ['verbose']);
    if (run.status === 0) {
      console.log(`  ${batch[0][1]} went through on its own — the server is slow rather than refusing. Run the deploy again.`);
    } else {
      console.log(`  ${batch[0][1]} could not be uploaded: ${(run.stderr.match(/curl: \(\d+\)[^\n]*/) || [run.stderr.trim().split('\n').pop() || 'no answer'])[0]}\n    What the server said last:\n${transcript(run) || '      (nothing)'}`);
    }
    fail(`Upload stopped at files ${range}.${start ? ' The earlier files are in place.' : ' Nothing was uploaded.'}`);
  }
}

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));

async function health() {
  try {
    const res = await fetch(`${siteUrl}/api/health.php?t=${Date.now()}`, { headers: { Accept: 'application/json' } });
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
const build = spawnSync(process.execPath, ['build.mjs'], { cwd: projectRoot, stdio: 'inherit', env: { ...process.env, SITE_URL: siteUrl, ACCOUNTS: hasLogin ? '1' : '', ACCOUNTS_OFF: hasLogin ? '' : '1' } });
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
console.log(`Uploading ${files.length} files …`);
upload(files, remoteDir);
console.log('✓ Site uploaded');

// The secret is only uploaded once the server has proved it executes PHP (otherwise it could be served as text).
let state = await health();
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

if (hasKeys || hasEmail || hasOnboarding || hasAccounts) {
  const phpStr = (v) => `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const settings = {
    ...(hasKeys ? { key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET } : {}),
    ...(hasEmail ? { twilio_key: env.TWILIO_API_KEY, twilio_secret: env.TWILIO_API_SECRET, email_from: env.EMAIL_FROM, email_from_name: env.EMAIL_FROM_NAME || 'Walnut Data Tech', email_notify: env.EMAIL_NOTIFY } : {}),
    ...(hasOnboarding ? { onboarding_url: onboardingUrl, onboarding_key: env.ONBOARDING_API_KEY } : {}),
    ...(hasAccounts ? { db_host: env.DB_HOST || 'localhost', db_name: env.DB_NAME, db_user: env.DB_USER, db_pass: env.DB_PASS || '', account_secret: env.ACCOUNT_SECRET } : {}),
    ...(hasSms ? { twilio_sid: env.TWILIO_ACCOUNT_SID, sms_from: env.SMS_FROM } : {}),
    // one sign-in for the other Walnut apps: each app's own secret, set only once that app can receive it
    ...(hasAccounts ? Object.fromEntries(['ONBOARDING', 'COURSE_FINDER', 'LEADS'].filter((k) => env[`WALNUT_SSO_SECRET_${k}`]).map((k) => [`sso_${k.toLowerCase()}`, env[`WALNUT_SSO_SECRET_${k}`]])) : {}),
  };
  const configFile = join(tmp, 'config.php');
  writeFileSync(
    configFile,
    `<?php\n// Written by scripts/deploy.mjs. Never commit or share this file.\nreturn [\n${Object.entries(settings).map(([k, v]) => `  '${k}' => ${phpStr(v)},`).join('\n')}\n];\n`,
    { mode: 0o600 }
  );
  upload([[configFile, 'api/config.php']], remoteDir);

  // The secrets must never be readable over the web.
  const probe = await fetch(`${siteUrl}/api/config.php?t=${Date.now()}`).then((r) => r.text()).catch(() => '');
  const leaked = ['key_secret', 'twilio_secret', 'onboarding_key', 'db_pass', 'account_secret', env.RAZORPAY_KEY_SECRET, env.TWILIO_API_SECRET, env.ONBOARDING_API_KEY, env.DB_PASS, env.ACCOUNT_SECRET].filter(Boolean).some((needle) => probe.includes(needle));
  if (leaked) {
    curl([`url = ${q(ftpUrl(remoteDir))}`, `quote = ${q(`DELE ${remoteDir}api/config.php`)}`, 'list-only'], { quiet: true });
    fail('The server exposed api/config.php as text, so it was deleted again. Rotate the Razorpay, Twilio, database and Onboarding Tool secrets and contact the host about PHP handling.');
  }

  state = await health();
  if (hasKeys && !state.data?.configured) fail('The keys were uploaded but the payment API does not see them.');
  if (hasEmail && !state.data?.email) fail('The email settings were uploaded but the API does not see them.');
  if (hasOnboarding && !state.data?.onboarding) fail('The Onboarding Tool settings were uploaded but the API does not see them.');
  if (hasAccounts && !state.data?.accounts) fail('The account database settings were uploaded, but the server could not connect to the database. Check DB_HOST, DB_NAME, DB_USER and DB_PASS in .env, and that PHP has the pdo_mysql extension.');
  if (hasKeys) console.log(`✓ Razorpay connected in ${state.data.mode.toUpperCase()} mode`);
  if (hasEmail) console.log(`✓ Email connected — sending from ${env.EMAIL_FROM}, notifications to ${env.EMAIL_NOTIFY}`);
  if (hasOnboarding) console.log(`✓ University requests will be filed in the Onboarding Tool at ${onboardingUrl}`);
  if (hasAccounts) console.log(`✓ Walnut accounts connected — database ${env.DB_NAME}, one-time codes by email${hasSms ? ' and SMS' : ''}`);
}

const home200 = await fetch(`${siteUrl}/?t=${Date.now()}`).then((r) => r.status).catch(() => 0);
console.log(`${home200 === 200 ? '✓' : '!'} ${siteUrl}/ responded with HTTP ${home200}`);
console.log(`\nDone. Live at ${siteUrl}/\n`);
