// Transactional emails, written once and used by both the PHP API (production) and its Node mirror
// (local development). The build turns this into dist/api/emails.json.
//
// Placeholders:  {{name}}   → the value, HTML-escaped in the HTML part
//                {{{rows}}} → pre-built detail rows (the server escapes each value before building them)
//
// Styling is inline and table-based because that is what email apps support. Colours and type
// follow the brand tokens in src/assets/css/base.css.

import config from '../../site.config.mjs';

const ink = '#0d0c14';
const muted = '#63607a';
const line = '#e8e6f0';
const mist = '#f6f5fb';
const violet700 = '#5b3fe6';
const bodyFont = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const displayFont = "Lexend,'Avenir Next','Segoe UI',Helvetica,Arial,sans-serif";

const p = (html) => `<p style="margin:0 0 16px;">${html}</p>`;
const button = (label, href) =>
  `<p style="margin:24px 0 0;"><a href="${href}" style="display:inline-block;padding:13px 24px;border-radius:999px;background:${ink};color:#ffffff;font-family:${bodyFont};font-size:15px;font-weight:600;text-decoration:none;">${label}</a></p>`;
const details = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0;border-bottom:1px solid ${line};">{{{rows}}}</table>`;

// One detail row; the servers repeat it for every non-empty field.
export const row = `<tr><td style="padding:11px 16px 11px 0;border-top:1px solid ${line};width:140px;vertical-align:top;font-family:${bodyFont};font-size:14px;line-height:1.5;color:${muted};">{{label}}</td><td style="padding:11px 0;border-top:1px solid ${line};vertical-align:top;font-family:${bodyFont};font-size:15px;line-height:1.5;color:${ink};">{{{value}}}</td></tr>`;

function shell({ preheader, heading, body, footer }) {
  const site = config.siteUrl;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:${mist};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${mist};">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">
    <tr><td style="padding:0 8px 24px;">
      <a href="${site}/" style="text-decoration:none;"><img src="${site}/assets/img/logo-email.png" width="188" height="36" alt="${config.company.name}" style="display:block;border:0;font-family:${displayFont};font-size:20px;font-weight:500;color:${ink};"></a>
    </td></tr>
    <tr><td style="padding:36px 32px;border-radius:22px;background:#ffffff;font-family:${bodyFont};font-size:16px;line-height:1.55;color:${ink};">
      <h1 style="margin:0 0 16px;font-family:${displayFont};font-size:26px;line-height:1.15;font-weight:500;letter-spacing:-0.02em;color:${ink};">${heading}</h1>
      ${body}
    </td></tr>
    <tr><td style="padding:20px 8px 0;font-family:${bodyFont};font-size:13px;line-height:1.5;color:${muted};">
      ${footer}<br>${config.company.legalName} · <a href="${site}/" style="color:${violet700};text-decoration:none;">${site.replace(/^https?:\/\//, '')}</a>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

const access = config.legal.courseAccess
  ? `Your course access is delivered ${config.legal.courseAccess}.`
  : 'We’ll send your course access details to this address.';

export const emails = {
  // → the Walnut team, when someone submits an enquiry form
  enquiry_notify: {
    subject: 'New enquiry: {{topic}} — {{from}}',
    html: shell({
      preheader: '{{name}} sent an enquiry through the website.',
      heading: '{{topic}}',
      body: p('{{name}} sent this through the website.') + details + button('Reply to {{name}}', 'mailto:{{email}}'),
      footer: 'Sent by the website’s enquiry form.',
    }),
    text: '{{topic}}\n\n{{name}} sent this through the website.\n\n{{{rows}}}\nReply to: {{email}}\n',
  },

  // → the visitor, confirming their enquiry arrived
  enquiry_ack: {
    subject: 'We’ve received your enquiry',
    html: shell({
      preheader: 'Thank you — our team will reply to this address.',
      heading: 'Thank you, {{name}}.',
      body: p('We’ve received your enquiry. Our team will read it and reply to this address.') + p('Here’s a copy of what you sent:') + details + button('Visit the website', `${config.siteUrl}/`),
      footer: 'You’re receiving this because you sent an enquiry through our website.',
    }),
    text: `Thank you, {{name}}.\n\nWe’ve received your enquiry. Our team will read it and reply to this address.\n\nHere’s a copy of what you sent:\n\n{{{rows}}}\n${config.company.name}\n${config.siteUrl}/\n`,
  },

  // → the learner, after a verified payment
  enrol_confirm: {
    subject: 'You’re enrolled: {{course}}',
    html: shell({
      preheader: 'Payment received for {{course}}.',
      heading: 'You’re enrolled.',
      body: p('Hi {{name}}, your payment for <strong>{{course}}</strong> has been received.') + details + p(`<span style="display:block;margin-top:20px;">${access}</span>`) + p(`Please keep this email for your records. If anything looks wrong, reply with your payment reference.`) + button('View the course', `${config.siteUrl}/academy/{{slug}}/`),
      footer: 'You’re receiving this because you enrolled in a course on our website.',
    }),
    text: `You’re enrolled.\n\nHi {{name}}, your payment for {{course}} has been received.\n\n{{{rows}}}\n${access}\n\nPlease keep this email for your records. If anything looks wrong, reply with your payment reference.\n\n${config.company.name}\n${config.siteUrl}/\n`,
  },

  // → the Walnut team, after a verified payment
  enrol_notify: {
    subject: 'New enrolment: {{course}} — {{name}}',
    html: shell({
      preheader: '{{name}} enrolled in {{course}}.',
      heading: 'New enrolment',
      body: p('{{name}} has paid for <strong>{{course}}</strong>. The payment was verified with Razorpay.') + details + button('Email {{name}}', 'mailto:{{email}}'),
      footer: 'Sent by the website’s checkout.',
    }),
    text: 'New enrolment\n\n{{name}} has paid for {{course}}. The payment was verified with Razorpay.\n\n{{{rows}}}\nLearner email: {{email}}\n',
  },
};
