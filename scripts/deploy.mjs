// Builds the site and publishes it to the web host over FTP (explicit TLS when the server offers it).
//
//   node scripts/deploy.mjs          — build, upload, verify
//   node scripts/deploy.mjs --yes    — skip the "overwrite existing site?" question
//
// Reads .env (see .env.example): FTP_HOST, FTP_USER, FTP_PASS, FTP_DIR, SITE_URL,
// RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET.
//
// Order matters for safety: the site and the payment API are uploaded first, the API is checked
// to be executing as PHP, and only then is the file holding the Razorpay secret uploaded.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { loadEnv, projectRoot } from './env.mjs';

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
  const modes = [
    ['verified TLS', ['ssl-reqd']],
    ['TLS (certificate not verified)', ['ssl-reqd', 'insecure']],
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

function upload(files, remoteDir) {
  const lines = ['ftp-create-dirs', 'fail-early'];
  for (const [local, remote] of files) {
    lines.push(`upload-file = ${q(local)}`, `url = ${q(ftpUrl(remoteDir + remote))}`);
  }
  if (curl(lines).status !== 0) fail('Upload failed — see the message above.');
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
const build = spawnSync(process.execPath, ['build.mjs'], { cwd: projectRoot, stdio: 'inherit', env: { ...process.env, SITE_URL: siteUrl } });
if (build.status !== 0) fail('Build failed.');
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
console.log(`✓ Payment API is running (PHP ${state.data.php}${state.data.curl ? '' : ' — WARNING: curl extension missing'})`);

if (!hasKeys) {
  console.log('! RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set in .env — the site is live but checkout is disabled.');
} else {
  const phpStr = (v) => `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const configFile = join(tmp, 'config.php');
  writeFileSync(configFile, `<?php\n// Written by scripts/deploy.mjs. Never commit or share this file.\nreturn [\n  'key_id' => ${phpStr(env.RAZORPAY_KEY_ID)},\n  'key_secret' => ${phpStr(env.RAZORPAY_KEY_SECRET)},\n];\n`, { mode: 0o600 });
  upload([[configFile, 'api/config.php']], remoteDir);

  // The secret must never be readable over the web.
  const probe = await fetch(`${siteUrl}/api/config.php?t=${Date.now()}`).then((r) => r.text()).catch(() => '');
  if (probe.includes('key_secret') || probe.includes(env.RAZORPAY_KEY_SECRET)) {
    curl([`url = ${q(ftpUrl(remoteDir))}`, `quote = ${q(`DELE ${remoteDir}api/config.php`)}`, 'list-only'], { quiet: true });
    fail('The server exposed api/config.php as text, so it was deleted again. Rotate the Razorpay key secret and contact the host about PHP handling.');
  }

  state = await health();
  if (!state.data?.configured) fail('The keys were uploaded but the payment API does not see them.');
  console.log(`✓ Razorpay connected in ${state.data.mode.toUpperCase()} mode`);
}

const home200 = await fetch(`${siteUrl}/?t=${Date.now()}`).then((r) => r.status).catch(() => 0);
console.log(`${home200 === 200 ? '✓' : '!'} ${siteUrl}/ responded with HTTP ${home200}`);
console.log(`\nDone. Live at ${siteUrl}/\n`);
