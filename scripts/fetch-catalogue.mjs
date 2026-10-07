// Takes a fresh snapshot of the Walnut LMS course catalogue for the build:
//   node scripts/fetch-catalogue.mjs
// Reads {WALNUT_LMS_URL or lms.url in site.config.mjs}/api/public/courses, checks every course and writes
// src/data/lms-catalogue.json — but only when at least one course is valid. If the LMS is down or sends
// nothing usable, the snapshot already there is kept and a warning is printed. It always exits 0, so a
// deploy never fails because the LMS is unavailable; the site is then built from the last good snapshot.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import config from '../site.config.mjs';
import { parseFeed } from '../src/assets/js/lms-catalogue.js';

const lmsUrl = (process.env.WALNUT_LMS_URL || config.lms.url).replace(/\/+$/, '');
const snapshot = fileURLToPath(new URL('../src/data/lms-catalogue.json', import.meta.url));

function keepSnapshot(reason) {
  let kept = 'no snapshot yet';
  try {
    const { courses, updatedAt } = parseFeed(JSON.parse(readFileSync(snapshot, 'utf8')));
    kept = `${courses.length} ${courses.length === 1 ? 'course' : 'courses'}${updatedAt ? `, updated ${updatedAt}` : ''}`;
  } catch {}
  console.warn(`⚠ Walnut LMS catalogue not refreshed (${reason}) — keeping the existing snapshot (${kept}).`);
}

try {
  const res = await fetch(`${lmsUrl}/api/public/courses`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${lmsUrl}`);
  const feed = await res.json();
  const { courses, updatedAt, rejected } = parseFeed(feed);
  if (!courses.length) {
    keepSnapshot(`no valid courses in the feed from ${lmsUrl}`);
  } else {
    // The feed is stored as it came, so the build and the browser check it with the same rules.
    writeFileSync(snapshot, `${JSON.stringify({ courses: feed.courses, updated_at: feed.updated_at ?? null }, null, 2)}\n`);
    console.log(`✓ Walnut LMS catalogue: ${courses.length} ${courses.length === 1 ? 'course' : 'courses'} (updated ${updatedAt || 'date not given'})${rejected ? ` — ${rejected} left out as invalid` : ''}`);
  }
} catch (err) {
  keepSnapshot(err.name === 'TimeoutError' ? `no answer from ${lmsUrl} within 10 seconds` : err.message);
}
