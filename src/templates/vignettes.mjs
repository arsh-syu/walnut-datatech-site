// Product-style illustrations for each service area, composed from a small set of CSS atoms
// (see vignettes.css). They are illustrative UI, not screenshots, and carry no real data.

const card = (i, pos, inner, cls = '') =>
  `<div class="vg-card${cls ? ' ' + cls : ''}" style="--i:${i};${pos}">${inner}</div>`;
const pill = (text, tone = '') => `<span class="vg-pill${tone ? ' ' + tone : ''}">${text}</span>`;
const head = (title, right = '') => `<div class="vg-row"><span class="vg-title">${title}</span>${right}</div>`;
const sub = (text) => `<span class="vg-sub">${text}</span>`;
const line = (w) => `<span class="vg-line" style="width:${w}%"></span>`;
const bar = (v) => `<span class="vg-bar"><i style="width:${v}%"></i></span>`;
const dot = (tone) => `<i class="vg-dot ${tone}"></i>`;
const tick = '<span class="vg-tick"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>';
const chips = (...labels) => `<div class="vg-chips">${labels.map((l) => `<span>${l}</span>`).join('')}</div>`;
const item = (label, right = dot('ok')) => `<div class="vg-item"><span class="vg-sq"></span><span>${label}</span>${right}</div>`;
const done = (label) => `<div class="vg-done">${tick}<span>${label}</span></div>`;

const scenes = {
  infrastructure: () =>
    card(0, 'left:6%;top:9%;width:57%', head('Cloud data centre', pill(`${dot('ok')}Running`, 'ok')) + item('Learning Management System') + item('Student Management System') + item('Admissions Management System')) +
    card(1, 'right:5%;top:36%;width:36%', head('Payment gateway') + sub('Admission fee') + done('Received')) +
    card(2, 'left:18%;bottom:8%;width:50%', head('Messaging') + chips('SMS', 'Email', 'WhatsApp')),

  content: () =>
    card(0, 'left:6%;top:9%;width:58%', `<div class="vg-video"><span class="vg-play"></span></div>` + head('Lecture', sub('Recorded with faculty')) + bar(38)) +
    card(1, 'right:5%;top:30%;width:38%', head('Self-assessment') + line(92) + line(60) + `<div class="vg-opts"><span></span><span class="on"></span><span></span></div>`) +
    card(2, 'left:16%;bottom:8%;width:44%', head('Learning progress') + bar(64)),

  marketing: () =>
    card(0, 'left:6%;top:9%;width:42%', `<div class="vg-media"></div>` + line(88) + line(54)) +
    card(1, 'right:5%;top:14%;width:46%', head('Channels') + chips('Social', 'Influencers', 'TV', 'Radio')) +
    card(2, 'right:8%;bottom:9%;width:52%', head('Enquiries', pill('This month', 'violet')) + `<svg class="vg-spark" viewBox="0 0 120 36" preserveAspectRatio="none"><path d="M2 30 L20 26 L38 28 L56 19 L74 21 L92 11 L118 5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/></svg>`),

  counselling: () =>
    card(0, 'left:6%;top:10%;width:54%', `<div class="vg-person"><span class="vg-avatar"></span><span><span class="vg-title">Programme counsellor</span>${sub('On call')}</span></div><div class="vg-wave">${'<i></i>'.repeat(16)}</div>`) +
    card(1, 'right:5%;top:32%;width:42%', head('Programme advice') + `<div class="vg-item"><span class="vg-sq"></span>${line(70)}${pill('Best fit', 'violet')}</div><div class="vg-item"><span class="vg-sq"></span>${line(80)}</div>`) +
    card(2, 'left:20%;bottom:9%;width:46%', done('Callback scheduled')),

  admissions: () =>
    card(0, 'left:6%;top:10%;width:62%', head('Application', pill('In review', 'violet')) + `<div class="vg-steps"><span class="done">Applied</span><span class="done">Verified</span><span class="done">Fees paid</span><span class="now">Admitted</span></div>`) +
    card(1, 'right:5%;top:44%;width:40%', `<div class="vg-person"><span class="vg-avatar"></span><span style="flex:1">${line(80)}${line(50)}</span></div>` + pill(`${dot('ok')}Verified`, 'ok')) +
    card(2, 'left:14%;bottom:8%;width:42%', head('Fee reconciliation') + done('Matched')),

  examinations: () =>
    card(0, 'left:6%;top:9%;width:58%', head('Semester examination', pill('00:42:10', 'violet')) + line(94) + line(68) + `<div class="vg-opts wide"><span>A</span><span class="on">B</span><span>C</span><span>D</span></div>`) +
    card(1, 'right:5%;top:14%;width:28%', `<div class="vg-cam"><span class="vg-avatar"></span></div><span class="vg-sub">${dot('rec')}Proctored</span>`, 'dark') +
    card(2, 'right:7%;bottom:10%;width:46%', head('Results') + done('Consolidated marks list')),

  'student-support': () =>
    card(0, 'left:6%;top:9%;width:62%', head('Student support', pill(`${dot('ok')}Online`, 'ok')) + `<p class="vg-bubble">How do I download my hall ticket?</p><p class="vg-bubble us"><b>AI assistant</b>Here’s the link to your hall ticket.</p>`) +
    card(1, 'right:5%;top:52%;width:36%', head('Ticket') + sub('Fee receipt') + pill('Resolved', 'ok')) +
    card(2, 'left:16%;bottom:7%;width:42%', chips('Call', 'Email', 'Chat')),

  compliance: () =>
    card(0, 'left:6%;top:10%;width:56%', head('Regulatory reports') + chips('UGC', 'DEB', 'ABC') + `<div class="vg-chart">${[42, 58, 50, 72, 64, 88].map((h) => `<i style="height:${h}%"></i>`).join('')}</div>`) +
    card(1, 'right:5%;top:36%;width:40%', done('Admissions') + done('Fees collection') + done('Examination data') + done('Academic records')),

  careers: () =>
    card(0, 'left:6%;top:10%;width:58%', head('Placement drive', pill(`${dot('ok')}Open`, 'ok')) + `<div class="vg-item"><span class="vg-sq"></span>${line(60)}${pill('Hiring', 'violet')}</div><div class="vg-item"><span class="vg-sq"></span>${line(74)}${pill('Hiring', 'violet')}</div><div class="vg-item"><span class="vg-sq"></span>${line(52)}</div>`) +
    card(1, 'right:5%;top:42%;width:40%', head('Apprenticeship') + sub('On-job learning') + bar(70)) +
    card(2, 'left:18%;bottom:8%;width:42%', done('Offer accepted')),
};

export function vignette(slug, label) {
  if (!scenes[slug]) throw new Error(`No vignette for ${slug}`);
  return `<div class="vg vg-${slug}" role="img" aria-label="Illustration of ${label}">${scenes[slug]()}</div>`;
}
