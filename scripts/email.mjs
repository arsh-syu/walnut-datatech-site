// Email rendering and sending for the Node side (local dev server and the email test script).
// It mirrors send_email() / render_template() in src/api/lib.php — keep the two in step.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectRoot } from './env.mjs';

const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

// {{name}} is escaped in HTML; {{{name}}} is inserted as given (the caller has already escaped it).
export function renderTemplate(template, vars, raw, html) {
  return template.replace(/\{\{\{(\w+)\}\}\}|\{\{(\w+)\}\}/g, (match, rawKey, key) => {
    if (rawKey) return raw[rawKey] ?? '';
    const value = String(vars[key] ?? '');
    return html ? escapeHtml(value) : value;
  });
}

export const loadTemplates = () => JSON.parse(readFileSync(join(projectRoot, 'dist/api/emails.json'), 'utf8'));

// rows: [[label, value], …] — empty values are skipped.
export function buildEmail(templates, name, vars, rows = []) {
  const template = templates.emails[name];
  if (!template) throw new Error(`Unknown email template: ${name}`);
  const filled = rows.filter(([, value]) => value !== '' && value != null);
  const rowsHtml = filled.map(([label, value]) => renderTemplate(templates.row, { label }, { value: escapeHtml(value).replace(/\n/g, '<br>') }, true)).join('');
  const rowsText = filled.map(([label, value]) => `${label}: ${value}\n`).join('');
  return {
    subject: renderTemplate(template.subject, vars, {}, false).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim(),
    html: renderTemplate(template.html, vars, { rows: rowsHtml }, true),
    text: renderTemplate(template.text, vars, { rows: rowsText }, false),
  };
}

// Sends one email through Twilio. `settings` comes from .env: TWILIO_API_KEY, TWILIO_API_SECRET, EMAIL_FROM, EMAIL_FROM_NAME.
export async function sendEmail(settings, to, content) {
  const res = await fetch('https://comms.twilio.com/v1/Emails', {
    method: 'POST',
    signal: AbortSignal.timeout(20000),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${settings.TWILIO_API_KEY}:${settings.TWILIO_API_SECRET}`).toString('base64')}`,
    },
    body: JSON.stringify({
      from: { address: settings.EMAIL_FROM, name: settings.EMAIL_FROM_NAME || 'Walnut Data Tech' },
      to: [{ address: to.address, name: to.name || to.address }],
      content,
    }),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

export const emailConfigured = (settings) => Boolean(settings.TWILIO_API_KEY && settings.TWILIO_API_SECRET && settings.EMAIL_FROM && settings.EMAIL_NOTIFY);
