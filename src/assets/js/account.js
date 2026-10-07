// The signed-in profile page: who the person is on the left, what they have done with Walnut on the right.
// Everything shown comes from the account service for the signed-in person only.

import { track } from './analytics.js';
import { portal, siteRoot, esc, call, restore, signOut, paintHeader } from './session.js';
import { otpStep } from './otp.js';
import { isShown, fieldHtml, readAnswer, display, bindFields } from './questions.js';
import { setError } from './forms.js';

const box = document.getElementById('account');
const day = (iso) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const initials = (name) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
};
const TYPE = { UNIVERSITY: 'University', STUDENT: 'Learner', AGENT: 'Partner' };
const tick = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

// What the account is used for: one or several of UNIVERSITY, STUDENT, AGENT (the first is the main one).
const typesOf = (p) => (p.accountTypes?.length ? p.accountTypes : p.accountType ? [p.accountType] : []);

// An account kept only for university onboarding. The other journeys' apps and invitations are not
// theirs, so they are not shown. An account that is also AGENT or STUDENT keeps everything it had.
const universityOnly = () => {
  const types = typesOf(data.profile);
  return types.includes('UNIVERSITY') && !types.includes('AGENT') && !types.includes('STUDENT');
};
// Which journey each Walnut app belongs to. An app nobody has claimed stays visible to everyone.
const APP_JOURNEY = { onboarding: 'UNIVERSITY', 'course-finder': 'AGENT', leads: 'AGENT', 'walnut-lms': 'STUDENT' };
const appsForAccount = () => (data.apps ?? []).filter((a) => !universityOnly() || !['AGENT', 'STUDENT'].includes(APP_JOURNEY[a.id]));

let data; // the dashboard as the service last sent it
let tab; // the open tab
let applying = false; // an agent application being written or edited

/* ---------- the three activities ---------- */

// Where a request stands, in the words a university should read, and how far along it is (of 3).
const REQUEST = {
  PENDING_REVIEW: ['Submitted', 'Your request has been received and is waiting for review.', 1],
  RESUBMITTED: ['Resubmitted', 'Your updated request has been received and is waiting for review.', 1],
  UNDER_REVIEW: ['Under review', 'Our team is reviewing your request.', 2],
  CHANGES_REQUIRED: ['Changes required', 'We have asked for some changes. Please use the link in the email we sent you to respond.', 2],
  COUNTER_PROPOSAL: ['Counter proposal', 'We have sent you a proposal. Please use the link in the email we sent you to respond.', 2],
  APPROVED: ['Approved', 'Your request is approved.', 3, 'is-ok'],
  POC_ACCOUNT_CREATED: ['Approved', 'Your request is approved. Your onboarding is ready.', 3, 'is-ok'],
  REJECTED: ['Not approved', 'We are unable to take this request forward. The details were sent to your email.', 0, 'is-stop'],
};
const steps = (done) => `<ol class="acct-steps">${['Submitted', 'Under review', 'Approved'].map((label, i) => `<li class="${i < done ? 'is-done' : ''}"><span>${i < done ? tick : i + 1}</span>${label}</li>`).join('')}</ol>`;
const empty = (title, text, href, label) => `<div class="acct-empty"><h3>${title}</h3><p>${text}</p><a class="btn btn-primary" href="${href}"><span>${label}</span></a></div>`;

function requestsPanel() {
  const { requests, onboarding } = data.university;
  const ready = onboarding && portal ? `<div class="acct-item acct-ready"><div><h3>${esc(onboarding.name)}</h3><p>Your university is approved. Continue its onboarding.</p></div><a class="btn btn-primary" href="${esc(portal)}/university/${encodeURIComponent(onboarding.id)}"><span>Continue onboarding</span></a></div>` : '';
  if (!requests.length && !ready) return empty('No empanelment request yet', `Choose the services your university needs and send your request. Use ${esc(data.profile.email)} as the official email so it appears here.`, `${siteRoot}configure/`, 'Start your request');
  return (
    ready +
    requests
      .map((r) => {
        const [label, text, done, tone = ''] = REQUEST[r.status] ?? ['In progress', 'Your request is being processed.', 1];
        return `<article class="acct-item">
          <header><h3>${esc(r.universityName)}</h3><span class="acct-ref">${esc(r.reference)}</span><span class="status-badge ${tone}">${label}</span></header>
          <p>${text}</p>
          ${r.status === 'REJECTED' ? '' : steps(done)}
          ${r.summary ? `<p class="acct-summary">${esc(r.summary)}</p>` : ''}
          <p class="acct-meta">Submitted ${day(r.submittedAt)} · Last updated ${day(r.updatedAt)}</p>
        </article>`;
      })
      .join('')
  );
}

// Where a course on Walnut LMS stands, in plain words.
const COURSE = {
  active: ['In progress'],
  completed: ['Completed', 'is-ok'],
  expired: ['Access ended', 'is-stop'],
};
// The links in a course come from our own server; anything else is left out rather than linked.
const safeLink = (href) => (typeof href === 'string' && /^(\/api\/sso\.php\?|https:\/\/)/.test(href) ? href : '');
const lmsCourses = () => data.student.lms?.courses ?? [];

function courseItem(c) {
  const [label, tone = ''] = COURSE[c.status] ?? COURSE.active;
  const progress = Math.min(100, Math.max(0, Number(c.progress) || 0));
  const open = safeLink(c.open);
  const verify = safeLink(c.certificate?.verifyUrl);
  const action = c.status === 'completed' ? 'Review course' : progress > 0 ? 'Continue' : 'Open course';
  return `<article class="acct-item">
      <header><h3>${esc(c.title)}</h3><span class="status-badge ${tone}">${label}</span></header>
      <div class="acct-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}" aria-valuetext="${progress}% complete" aria-label="Progress in ${esc(c.title)}"><span style="width:${progress}%"></span></div>
      <p class="acct-meta"><strong>${progress}% complete</strong>${c.totalLessons ? ` · ${Number(c.completedLessons) || 0} of ${Number(c.totalLessons)} lessons` : ''}${c.lastActivityAt ? ` · Last activity ${day(c.lastActivityAt)}` : ''}</p>
      ${c.certificate ? `<p class="acct-cert"><span>${tick}</span><strong>${esc(c.certificate.title)}</strong>${verify ? `<a href="${esc(verify)}" target="_blank" rel="noopener">Verify certificate<span class="sr-only"> (opens in a new tab)</span></a>` : ''}</p>` : ''}
      ${open ? `<div class="acct-actions"><a class="btn btn-primary btn-sm" href="${esc(open)}" data-track="course_open" data-track-item="${esc(c.slug)}"><span>${action}</span></a></div>` : ''}
    </article>`;
}

// Courses bought on this website before Walnut LMS sold them: a record of the payment, not of progress.
const purchases = (enrolments) => `<section class="acct-history" aria-labelledby="acct-history-title">
    <h3 class="acct-more-title" id="acct-history-title">Purchase history</h3>
    <p class="acct-meta">Courses bought on this website before they moved to Walnut LMS.</p>
    <ul class="acct-purchases">${enrolments
      .map((e) => `<li><div><strong>${esc(e.courseName)}</strong><span>${day(e.purchasedAt)} · payment reference ${esc(e.paymentId)}</span></div><span class="acct-paid">${rupees(e.amount)}</span></li>`)
      .join('')}</ul>
  </section>`;

// What 'My courses' counts: the courses on Walnut LMS, plus purchases from this site not handed to it yet.
// The tab and the panel's own figure use this one number, so they always agree.
function courseTotal() {
  const { enrolments, lms } = data.student;
  return lms?.available ? lmsCourses().length + enrolments.filter((e) => !e.onLms).length : enrolments.length;
}

function coursesPanel() {
  const { enrolments, lms } = data.student;
  const courses = lmsCourses();
  // Said only when this site asks Walnut LMS and it did not answer just now; not when the LMS is not set up here.
  const calm = lms && lms.configured !== false && !lms.available ? '<p class="acct-calm">Your courses on Walnut LMS are unavailable right now. Your courses are safe; please check again in a little while.</p>' : '';
  if (!courses.length && !enrolments.length && calm) return `${calm}<p><a class="link-arrow" href="${siteRoot}academy/"><span>Browse courses</span></a></p>`;
  if (!courses.length && !enrolments.length) return empty('No courses yet', `Enrol on a course with ${esc(data.profile.email)} and it appears here, with your progress.`, `${siteRoot}academy/`, 'Browse courses');
  const completed = courses.filter((c) => c.status === 'completed').length;
  const active = courses.filter((c) => c.status === 'active').length;
  return `${calm}
    ${courses.length ? `<dl class="acct-stats">${[['Courses', courseTotal()], ['In progress', active], ['Completed', completed]].map(([label, value]) => `<div><dd>${value}</dd><dt>${label}</dt></div>`).join('')}</dl>${courses.map(courseItem).join('')}` : ''}
    ${enrolments.length ? purchases(enrolments) : ''}
    <p><a class="link-arrow" href="${siteRoot}academy/"><span>Browse more courses</span></a></p>`;
}

const APPLICATION = {
  SUBMITTED: ['Submitted', 'Your application has been received and is waiting for review.'],
  UNDER_REVIEW: ['Under review', 'Our team is reviewing your application.'],
  APPROVED: ['Approved', 'Welcome to Walnut. Your application is approved.', 'is-ok'],
  REJECTED: ['Not approved', 'We are unable to take your application forward at this time.', 'is-stop'],
};

function agentPanel() {
  const { application, questions } = data.agent;
  if (application && !applying) {
    const [label, text, tone = ''] = APPLICATION[application.status];
    const open = application.status === 'SUBMITTED' || application.status === 'UNDER_REVIEW';
    return `<article class="acct-item">
        <header><h3>Partner application</h3><span class="acct-ref">${esc(application.reference)}</span><span class="status-badge ${tone}">${label}</span></header>
        <p>${text}</p>
        ${application.decisionNote ? `<p class="acct-note">${esc(application.decisionNote)}</p>` : ''}
        <p class="acct-meta">Submitted ${day(application.submittedAt)} · Last updated ${day(application.updatedAt)}</p>
      </article>
      <dl class="review-answers">${questions
        .filter((q) => isShown(q, application.answers) && display(application.answers[q.id]))
        .map((q) => `<div><dt>${esc(q.label)}</dt><dd>${esc(display(application.answers[q.id]))}</dd></div>`)
        .join('')}</dl>
      <div class="acct-actions">${open ? '<button class="btn btn-ghost" type="button" data-edit-application><span>Edit application</span></button>' : ''}${application.status === 'APPROVED' ? `<a class="btn btn-primary" href="${siteRoot}partners/"><span>Open the partner applications</span></a>` : ''}</div>`;
  }
  const answers = agentAnswers;
  const shown = questions.filter((q) => isShown(q, answers));
  const groups = [...new Set(shown.map((q) => q.group))];
  return `<p class="acct-lead">Tell us about yourself and how you would like to work with Walnut. We review every application.</p>
    <form class="form q-form" data-agent-form novalidate>
      ${groups.map((group) => `<h3 class="q-group field-wide">${esc(group)}</h3>` + shown.filter((q) => q.group === group).map((q) => fieldHtml(q, answers[q.id], 'agent')).join('')).join('')}
      <div class="form-foot field-wide">
        <button class="btn btn-primary btn-lg" type="submit"><span>${application ? 'Save changes' : 'Submit application'}</span></button>
        ${application ? '<button class="btn btn-ghost" type="button" data-cancel-application><span>Cancel</span></button>' : ''}
      </div>
      <p class="form-status field-wide is-error" role="alert"></p>
    </form>`;
}
let agentAnswers = {};

/* ---------- profile ---------- */

function profilePanel() {
  const p = data.profile;
  return `<form class="form" data-profile-form novalidate>
      <div class="field field-wide"><label for="profile-name">Full name</label><input id="profile-name" name="name" type="text" autocomplete="name" maxlength="120" value="${esc(p.name)}" required></div>
      <div class="form-foot field-wide"><button class="btn btn-ghost" type="submit"><span>Save name</span></button></div>
      <p class="form-status field-wide" role="status"></p>
    </form>
    <div class="acct-verify">
      <div class="acct-row"><div><strong>Email</strong><span>${esc(p.email)}</span></div>${p.emailVerified ? `<span class="status-badge is-ok">Verified</span>` : '<button class="btn btn-ghost btn-sm" type="button" data-verify="email"><span>Verify email</span></button>'}</div>
      <div class="acct-row"><div><strong>Mobile</strong><span>${p.mobile ? esc(p.mobile) : p.phone ? esc(p.phone) : 'Not added yet'}</span></div>${p.mobileVerified ? `<span class="status-badge is-ok">Verified</span>` : p.phone ? '<span class="status-badge">Saved</span>' : ''}</div>
      ${
        // With SMS codes the number is proved with an OTP and can then be used to login. Without them it
        // is still saved to the profile, as the number Walnut can reach the person on.
        p.mobileCodes === false
          ? `<form class="acct-mobile" data-phone-form novalidate>
        <div class="field"><label for="profile-phone">${p.phone ? 'Change mobile number' : 'Add mobile number'}</label><input id="profile-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="+91 98765 43210" value="${esc(p.phone ?? '')}"></div>
        <button class="btn btn-ghost" type="submit"><span>Save number</span></button>
        <p class="field-help">Login with a mobile OTP is not switched on yet, so for now you login with your email. Your number is kept on your profile.</p>
      </form>`
          : `<form class="acct-mobile" data-mobile-form novalidate>
        <div class="field"><label for="profile-mobile">${p.mobile ? 'Change mobile number' : 'Add mobile number'}</label><input id="profile-mobile" name="mobile" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="+91 98765 43210"></div>
        <button class="btn btn-ghost" type="submit"><span>Send OTP</span></button>
        <p class="field-help">We send a one-time code to the number. Once verified, you can login with it.</p>
      </form>`
      }
      <div data-verify-box></div>
    </div>
    ${more().length ? `<h3 class="acct-more-title">More from Walnut</h3><ul class="acct-more">${more().map((m) => `<li><div><strong>${m.label}</strong><span>${m.line}</span></div>${m.href ? `<a class="btn btn-ghost btn-sm" href="${m.href}"><span>Open</span></a>` : `<button class="btn btn-ghost btn-sm" type="button" data-start="${m.start}"><span>Start</span></button>`}</li>`).join('')}</ul>` : ''}`;
}

// The same account can take up another Walnut service — nothing below needs a second sign-up.
function more() {
  const types = typesOf(data.profile);
  // An account kept only for university onboarding is not invited into the other journeys, and
  // a partner or learner account is not invited into the university one: that flow stays separate.
  if (universityOnly()) return [];
  return [
    !types.includes('AGENT') && !data.agent.application && !applying && { label: 'Become a partner', line: 'Apply with this account.', start: 'agent' },
    !types.includes('STUDENT') && !data.student.enrolments.length && !lmsCourses().length && { label: 'Take a short course', line: 'Enrol on Walnut LMS with this account; your progress appears here.', href: `${siteRoot}academy/` },
  ].filter(Boolean);
}

/* ---------- page ---------- */

// A tab for everything the person chose for their account, the main one first; the others appear once they hold something.
function tabs() {
  const type = data.profile.accountType;
  const types = typesOf(data.profile);
  const hasRequests = data.university.requests.length > 0 || Boolean(data.university.onboarding);
  const others = !universityOnly(); // a university account has the university flow and nothing else
  // Courses are counted on Walnut LMS when it answered, with the purchases made on this website that
  // have not been handed to it yet; otherwise by the purchases made on this website.
  const { enrolments, lms } = data.student;
  const courseCount = courseTotal();
  return [
    (types.includes('UNIVERSITY') || hasRequests) && ['requests', `My requests (${data.university.requests.length})`, requestsPanel],
    others && (types.includes('STUDENT') || enrolments.length > 0 || lmsCourses().length > 0) && ['courses', `My courses (${courseCount})`, coursesPanel],
    others && (types.includes('AGENT') || data.agent.application || applying) && ['agent', 'Partner application', agentPanel],
    ['profile', 'Profile', profilePanel],
  ]
    .filter(Boolean)
    .sort((a, b) => Number(b[0] === { UNIVERSITY: 'requests', STUDENT: 'courses', AGENT: 'agent' }[type]) - Number(a[0] === { UNIVERSITY: 'requests', STUDENT: 'courses', AGENT: 'agent' }[type]));
}

function paint() {
  const p = data.profile;
  const list = tabs();
  const apps = appsForAccount();
  if (!list.some(([id]) => id === tab)) tab = list[0][0];
  const [, , panel] = list.find(([id]) => id === tab);
  box.innerHTML = `<div class="acct-grid">
    <aside class="acct-card" aria-label="Your profile">
      <div class="acct-avatar" aria-hidden="true">${esc(initials(p.name))}</div>
      <h2 class="acct-name">${esc(p.name)}</h2>
      ${typesOf(p).length ? `<p class="acct-chips">${typesOf(p).map((t) => `<span class="chip">${TYPE[t]}</span>`).join('')}</p>` : ''}
      <dl class="acct-facts">
        <div><dt>Email</dt><dd>${esc(p.email)}${p.emailVerified ? ` <span class="acct-ok" title="Verified">${tick}<span class="sr-only">verified</span></span>` : ''}</dd></div>
        <div><dt>Mobile</dt><dd>${p.mobile ? `${esc(p.mobile)} <span class="acct-ok" title="Verified">${tick}<span class="sr-only">verified</span></span>` : p.phone ? esc(p.phone) : '—'}</dd></div>
        <div><dt>Member since</dt><dd>${day(p.memberSince)}</dd></div>
      </dl>
      <button class="btn btn-ghost" type="button" data-sign-out><span>Sign out</span></button>
    </aside>
    <div class="acct-main">
      <div class="acct-hello"><p>${greeting()},</p><h2>${esc(p.name)}</h2></div>
      ${apps.length ? `<nav class="acct-apps" aria-label="Walnut apps"><p>Open with this account</p><ul>${apps.map((a) => `<li><a class="btn btn-ghost btn-sm" href="${esc(a.href)}" data-track="app_open" data-track-item="${esc(a.id)}"><span>${esc(a.name)}</span></a></li>`).join('')}</ul></nav>` : ''}
      ${p.emailVerified ? '' : `<div class="acct-notice"><div><strong>Verify your email to see your activity</strong><span>Requests and courses linked to ${esc(p.email)} appear once you confirm the address is yours.</span></div><button class="btn btn-primary btn-sm" type="button" data-verify="email"><span>Verify email</span></button></div>`}
      <div class="acct-panel">
        <div class="acct-tabs" role="tablist" aria-label="Your account">${list.map(([id, label]) => `<button type="button" role="tab" id="tab-${id}" aria-selected="${id === tab}" aria-controls="acct-view" data-tab="${id}"${id === tab ? '' : ' tabindex="-1"'}>${label}</button>`).join('')}</div>
        <div class="acct-view" id="acct-view" role="tabpanel" aria-labelledby="tab-${tab}" tabindex="0">${panel()}</div>
      </div>
    </div>
  </div>`;
}

async function load() {
  data = await call('/account/dashboard');
  agentAnswers = { ...(data.agent.application?.answers ?? {}) };
  paint();
}

/* ---------- actions ---------- */

// Proving an email or a mobile number with a one-time code, without leaving the page.
async function verifyContact(channel, destination, host) {
  const start = () => call('/account/verify/start', { body: { channel, destination } });
  const challenge = await start();
  otpStep(host, {
    challenge,
    resend: start,
    onChange: () => (host.innerHTML = ''),
    verify: (challengeId, code) => call('/account/verify/confirm', { body: { channel, challengeId, code } }),
    doneText: channel === 'email' ? 'Your email is verified.' : 'Your mobile number is verified.',
    onDone: () => (track('account_verified', { channel }), load()),
  });
  host.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

box.addEventListener('click', async (e) => {
  const to = e.target.closest('[data-tab]');
  if (to) return (tab = to.dataset.tab), paint(), document.getElementById(`tab-${tab}`)?.focus();
  if (e.target.closest('[data-sign-out]')) {
    await signOut();
    track('account_sign_out');
    return location.assign(`${siteRoot}login/`);
  }
  if (e.target.closest('[data-start="agent"]') && !universityOnly()) return (applying = true), (tab = 'agent'), paint();
  if (e.target.closest('[data-edit-application]')) return (applying = true), paint();
  if (e.target.closest('[data-cancel-application]')) return (applying = false), (agentAnswers = { ...(data.agent.application?.answers ?? {}) }), paint();
  const verify = e.target.closest('[data-verify]');
  if (verify) {
    verify.disabled = true;
    if (tab !== 'profile') (tab = 'profile'), paint();
    const host = box.querySelector('[data-verify-box]');
    try {
      await verifyContact('email', undefined, host);
    } catch (err) {
      host.innerHTML = `<p class="form-status is-error">${esc(err.message)}</p>`;
    }
  }
});

// Left / right move between tabs.
box.addEventListener('keydown', (e) => {
  if (!e.target.matches?.('[role="tab"]') || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  const ids = tabs().map(([id]) => id);
  tab = ids[(ids.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length];
  paint();
  document.getElementById(`tab-${tab}`)?.focus();
});

bindFields(box, (id) => data.agent.questions.find((q) => q.id === id));

// Answers to the agent questions; an answer can bring further questions with it.
box.addEventListener('input', (e) => {
  const form = e.target.closest('[data-agent-form]');
  const q = form && data.agent.questions.find((x) => x.id === e.target.dataset.q);
  if (!q) return;
  const before = data.agent.questions.filter((x) => isShown(x, agentAnswers)).map((x) => x.id).join();
  agentAnswers[q.id] = readAnswer(form, q);
  if (e.target.closest('.field.has-error')) setError(form.querySelector(`[data-q="${q.id}"]`), '');
  if (data.agent.questions.filter((x) => isShown(x, agentAnswers)).map((x) => x.id).join() !== before) {
    paint();
    const option = e.target.type === 'radio' || e.target.type === 'checkbox' ? `[value="${CSS.escape(e.target.value)}"]` : '';
    box.querySelector(`[data-q="${q.id}"]${option}`)?.focus();
  }
});

box.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const button = form.querySelector('[type="submit"]');
  if (button.disabled) return;
  const note = form.querySelector('.form-status');
  const busy = (on) => ((button.disabled = on), button.classList.toggle('is-loading', on));

  if (form.matches('[data-agent-form]')) {
    busy(true);
    note.textContent = '';
    try {
      await call('/account/agent-application', { body: { answers: agentAnswers } });
      track('agent_application_submitted');
      applying = false;
      await load();
    } catch (err) {
      busy(false);
      note.textContent = err.message;
      // The service says which answers are missing; mark them where they are.
      let first = null;
      for (const [id, message] of Object.entries(err.reason ? {} : err.details ?? {})) {
        const input = form.querySelector(`[data-q="${id}"]`);
        if (input && typeof message === 'string') setError(input, message), (first ??= input);
      }
      first?.focus();
    }
  } else if (form.matches('[data-profile-form]')) {
    const name = form.elements.name.value.trim();
    if (name.length < 2) return setError(form.elements.name, 'Please enter your name.');
    busy(true);
    try {
      await call('/account/profile', { method: 'PATCH', body: { name, phone: data.profile.phone || '' } });
      await restore(); // the header's greeting follows the new name
      await load();
      paintHeader();
    } catch (err) {
      busy(false);
      note.classList.add('is-error');
      note.textContent = err.message;
    }
  } else if (form.matches('[data-mobile-form]')) {
    const input = form.elements.mobile;
    if (input.value.replace(/\D/g, '').length < 8) return setError(input, 'Please enter a valid mobile number.');
    setError(input, '');
    busy(true);
    try {
      await verifyContact('mobile', input.value.trim(), box.querySelector('[data-verify-box]'));
    } catch (err) {
      setError(input, err.message);
    }
    busy(false);
  } else if (form.matches('[data-phone-form]')) {
    const input = form.elements.phone;
    const phone = input.value.trim();
    if (!/^[0-9+ ()\-]{7,20}$/.test(phone) || phone.replace(/\D/g, '').length < 8) return setError(input, 'Please enter a valid mobile number.');
    setError(input, '');
    busy(true);
    try {
      await call('/account/profile', { method: 'PATCH', body: { name: data.profile.name, phone } });
      track('account_phone_saved');
      await load();
    } catch (err) {
      busy(false);
      setError(input, err.message);
    }
  }
});

/* ---------- start ---------- */

const user = await restore();
if (!user) {
  location.replace(`${siteRoot}login/`); // the profile is for signed-in people only
} else {
  paintHeader();
  try {
    await load();
    track('account_opened', { type: (data.profile.accountType || '').toLowerCase() });
  } catch (err) {
    box.innerHTML = `<p class="form-status is-error">${esc(err.message)}</p>`;
  }
}
