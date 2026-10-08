// Where handing past website purchases to Walnut LMS stands, and running it now:
//   node scripts/lms-backfill.mjs          — the counts per course (waiting, sent, refused)
//   node scripts/lms-backfill.mjs --run    — sweep until nothing is waiting (or nothing moves)
// Asks the live site's api/lms-sync.php, signed with ACCOUNT_SECRET from .env (see that file). The sweep is
// the one the dashboard runs, so it is safe to repeat: the LMS takes each purchase once.

import { createHmac } from 'node:crypto';
import { loadEnv } from './env.mjs';

// WALNUT_ENV_FILE points it at another settings file (as for dev-server.mjs), e.g. to try it locally.
const env = loadEnv(process.env.WALNUT_ENV_FILE);
const fail = (msg) => {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
};
if (!env.SITE_URL || !env.ACCOUNT_SECRET) fail('SITE_URL and ACCOUNT_SECRET must be set in .env.');
const siteUrl = env.SITE_URL.replace(/\/+$/, '');
const run = process.argv.includes('--run');
const stamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

async function ask(sweep) {
  const body = JSON.stringify({ run: sweep });
  const ts = String(Math.floor(Date.now() / 1000));
  const signature = `sha256=${createHmac('sha256', env.ACCOUNT_SECRET).update(`${ts}.${body}`).digest('hex')}`;
  const res = await fetch(`${siteUrl}/api/lms-sync.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Walnut-Timestamp': ts, 'X-Walnut-Signature': signature },
    body,
    signal: AbortSignal.timeout(30_000),
  });
  const data = await res.json().catch(() => null);
  if (res.status === 404) fail('The site did not accept the request (404): api/lms-sync.php is not deployed yet, or ACCOUNT_SECRET in .env is not the one on the server.');
  if (!res.ok || !data?.ok) fail(`api/lms-sync.php answered HTTP ${res.status}${data?.error ? `: ${String(data.error).replace(/\.$/, '')}` : ''}.`);
  return data;
}

const totals = (d) => d.courses.reduce((t, c) => ({ total: t.total + c.total, waiting: t.waiting + c.waiting, sent: t.sent + c.sent, refused: t.refused + c.refused }), { total: 0, waiting: 0, sent: 0, refused: 0 });
function show(d, label) {
  const t = totals(d);
  console.log(`${stamp()}  ${label}: ${t.total} purchases — ${t.waiting} waiting, ${t.sent} sent, ${t.refused} refused`);
  for (const c of d.courses) console.log(`    ${c.courseSlug.padEnd(28)} total ${String(c.total).padStart(4)}   waiting ${String(c.waiting).padStart(4)}   sent ${String(c.sent).padStart(4)}   refused ${String(c.refused).padStart(4)}`);
  for (const r of d.refusals) console.log(`    refused #${r.id} (${r.courseSlug}): ${r.reason}`);
  return t;
}

let data = await ask(false);
let t = show(data, 'now');
if (!data.lms) console.log('  ! Walnut LMS is not connected on the server (WALNUT_LMS_INTEGRATION_SECRET), so nothing can be sent.');
else if (!data.backfill) console.log('  ! The backfill is switched off on the server (WALNUT_LMS_BACKFILL=1 in .env, then deploy).');
if (!run || !data.lms || !data.backfill) process.exit(0);

// Each sweep sends at most 10 purchases within a few seconds; stop when nothing is waiting, or after three
// sweeps in a row that moved nothing (the LMS resting after an error, or refusing to answer).
let still = 0;
for (let sweep = 1; t.waiting > 0 && still < 3 && sweep <= 200; sweep++) {
  const before = t.waiting;
  data = await ask(true);
  t = show(data, `sweep ${sweep}`);
  still = t.waiting < before ? 0 : still + 1;
  if (data.resting) console.log('  … Walnut LMS did not answer or answered with an error; it is left alone for a minute.');
  if (t.waiting > 0) await new Promise((ok) => setTimeout(ok, data.resting ? 61_000 : 3_000));
}
if (t.waiting === 0) console.log(`✓ Every purchase has been handed to Walnut LMS (${t.sent} sent, ${t.refused} refused).`);
else fail(`${t.waiting} purchases are still waiting; Walnut LMS has not taken them. Run this again later.`);
