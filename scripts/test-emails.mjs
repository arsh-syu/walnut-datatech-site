// Sends every website email, filled with sample data, to the addresses you name — so you can see
// exactly what visitors and the team will receive, and confirm Twilio accepts the sending address.
//
//   node scripts/test-emails.mjs you@example.com [another@example.com …]
//
// Uses TWILIO_API_KEY, TWILIO_API_SECRET, EMAIL_FROM and EMAIL_FROM_NAME from .env.
// Each subject is prefixed with [TEST]. Nothing is sent to anyone you did not name.

import { spawnSync } from 'node:child_process';
import { loadEnv, projectRoot } from './env.mjs';
import { loadTemplates, buildEmail, sendEmail } from './email.mjs';

const env = loadEnv();
const recipients = process.argv.slice(2).filter((a) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a));
if (!recipients.length) {
  console.error('Give at least one email address:  node scripts/test-emails.mjs you@example.com');
  process.exit(1);
}
for (const key of ['TWILIO_API_KEY', 'TWILIO_API_SECRET', 'EMAIL_FROM']) {
  if (!env[key]) {
    console.error(`${key} is missing from .env`);
    process.exit(1);
  }
}

// Build first so the templates are current (links in the emails point at SITE_URL).
const build = spawnSync(process.execPath, ['build.mjs'], { cwd: projectRoot, encoding: 'utf8', env: { ...process.env, ...(env.SITE_URL ? { SITE_URL: env.SITE_URL } : {}) } });
if (build.status !== 0) {
  console.error(build.stderr || build.stdout);
  process.exit(1);
}
const templates = loadTemplates();

const enquiry = {
  vars: { topic: 'Solution configuration', name: 'Asha Rao', email: 'asha.rao@example.com', from: 'Example University' },
  rows: [
    ['Topic', 'Solution configuration'],
    ['Name', 'Asha Rao'],
    ['Organisation', 'Example University'],
    ['Email', 'asha.rao@example.com'],
    ['Phone', '+91 98765 43210'],
    ['Message', 'We are planning to launch two online programmes next year.\nCould we see a demo of the examination module?'],
    ['Configuration', 'Goal: Run examinations online\nEngagement: Revenue sharing\nServices: 2, modules: 13\n\nOnline Examination Management — Revenue sharing (9 of 9 modules)\nReporting & Regulatory Support — Revenue sharing (4 of 4 modules)'],
  ],
};
const enrolment = {
  vars: { name: 'Asha Rao', email: 'asha.rao@example.com', course: 'Online Programme Course', slug: 'online-programme-course' },
  rows: [['Course', 'Online Programme Course'], ['Amount paid', '₹499'], ['Coupon', 'SYUSANDEEP'], ['Payment reference', 'pay_TESTsample0001']],
};
const samples = [
  ['otp', 'Login code → visitor', { code: '482913', purpose: 'sign in to your Walnut account', minutes: '5' }, []],
  ['enquiry_notify', 'Enquiry → team', enquiry.vars, [...enquiry.rows, ['Sent from', '/configure/']]],
  ['enquiry_ack', 'Enquiry → visitor', enquiry.vars, enquiry.rows],
  ['enrol_confirm', 'Enrolment → learner', enrolment.vars, enrolment.rows],
  ['enrol_notify', 'Enrolment → team', enrolment.vars, [...enrolment.rows, ['Order reference', 'order_TESTsample0001'], ['Name', 'Asha Rao'], ['Email', 'asha.rao@example.com'], ['Phone', '+91 98765 43210']]],
];

console.log(`Sending ${samples.length} sample emails from ${env.EMAIL_FROM} to: ${recipients.join(', ')}\n`);
let failures = 0;
for (const address of recipients) {
  for (const [template, label, vars, rows] of samples) {
    const content = buildEmail(templates, template, vars, rows);
    content.subject = `[TEST] ${content.subject}`;
    let result;
    try {
      result = await sendEmail(env, { address, name: address }, content);
    } catch (err) {
      result = { ok: false, status: 0, body: err.message };
    }
    if (result.ok) {
      console.log(`✓ ${label.padEnd(22)} → ${address}`);
    } else {
      failures++;
      console.log(`✗ ${label.padEnd(22)} → ${address}   HTTP ${result.status}: ${String(result.body).replace(/\s+/g, ' ').slice(0, 300)}`);
    }
  }
}

console.log(
  failures
    ? `\n${failures} email(s) were not accepted. The message after each ✗ is Twilio's reason — most often the sending domain is not verified yet, or the API key lacks permission.`
    : '\nTwilio accepted every email. Check the inboxes (and spam folders) — delivery can take a minute.'
);
process.exit(failures ? 1 : 0);
