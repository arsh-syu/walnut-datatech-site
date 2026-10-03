import config from '../../site.config.mjs';
import { areas, stages } from '../data/services.mjs';
import { audiences, externalApps } from '../data/site.mjs';
import { courses, currency, inr, offerOf } from '../data/courses.mjs';
import { icon } from './icons.mjs';
import { button, mark, splitWords, sectionHead, videoTile, enquiryForm, ctaBand, esc, accountPrompt } from './layout.mjs';
import { journeySteps, priceFlow, courseCard, appLauncher } from './blocks.mjs';

const audience = (id) => audiences.find((a) => a.id === id);

/* ---------- /partners/ — agents and partners: explore → select an application → open it ---------- */

export function partners({ root }) {
  const a = audience('partners');
  // The tutorial section only exists once the onboarding video URL is set.
  const onboarding = config.videos.partnerOnboarding
    ? `<section class="section" id="onboarding-video">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'Onboarding', title: 'See how partner onboarding works.', center: true })}
    ${videoTile({ title: 'Partner onboarding — tutorial', kicker: 'Tutorial video', url: config.videos.partnerOnboarding, cls: 'video-tile-xl' })}
  </div>
</section>`
    : '<div class="section-gap"></div>';
  const body = `
<section class="page-hero">
  <div class="wrap">
    <p class="eyebrow hero-fade">For agents and partners</p>
    <h1 class="display display-md">${splitWords('Join Walnut.')}</h1>
    <p class="lede hero-fade" style="--d:.4s">Become a Walnut agent. Get onboarded, find the right online programme for every student you advise, and work the leads we send your way.</p>
    <div class="actions hero-fade" style="--d:.55s">
      ${button({ href: '#apps', label: 'Open an application', size: 'lg', arrow: true })}
      ${config.videos.partnerOnboarding ? `<a class="btn btn-ghost btn-lg" href="#onboarding-video">${icon('play')}<span>Watch the onboarding tutorial</span></a>` : ''}
    </div>
    <div class="hero-fade" style="--d:.7s">${journeySteps(a.steps)}</div>
  </div>
</section>

<section class="section section-dark" id="apps">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'Partner applications', title: 'Three applications. Pick the one you need.', text: 'New to Walnut? Start with Agent Onboard.' })}
    <div data-reveal>${appLauncher('partner-app')}</div>
  </div>
</section>

${onboarding}

${ctaBand(root, {
  title: 'Questions before you start?',
  text: 'Tell us about your work and we’ll help you get set up as a Walnut agent.',
  actions: [
    { href: `${root}contact/`, label: 'Talk to us' },
    { href: '#apps', label: 'Open an application' },
  ],
})}
`;
  return {
    title: 'Partners — join Walnut as an agent',
    description: 'Join Walnut Data Tech as an agent or partner: Agent Onboard, Course Finder and Online Leads — the applications education agents use to grow.',
    body,
    bodyClass: 'page-partners',
  };
}

/* ---------- /academy/ — learners: explore courses → course information → enrol ---------- */

export function academy({ root }) {
  const a = audience('learners');
  const body = `
<section class="page-hero">
  <div class="wrap">
    <p class="eyebrow hero-fade">For counsellors, students and professionals</p>
    <h1 class="display display-md">${splitWords('Upgrade your skills.')}</h1>
    <p class="lede hero-fade" style="--d:.4s">Short online courses from Walnut Data Tech. Choose a course to see what it covers, who it’s for and what it costs — then enrol when you’re ready.</p>
    <div class="hero-fade" style="--d:.55s">${journeySteps(a.steps)}</div>
  </div>
</section>

<section class="section section-tight" id="courses">
  <div class="wrap">
    <h2 class="sr-only">Courses</h2>
    <div class="course-grid">${courses.map((c, i) => courseCard(root, c, i)).join('')}</div>
  </div>
</section>

${ctaBand(root, {
  title: 'Not sure which course fits?',
  text: 'Tell us where you are in your career and we’ll help you choose.',
  actions: [{ href: `${root}contact/`, label: 'Talk to us' }],
})}
`;
  return {
    title: 'Courses — upgrade your skills',
    description: `Short online courses from Walnut Data Tech: ${courses.map((c) => c.name).join(' and ')}. See the details and enrol online.`,
    body,
    bodyClass: 'page-academy',
  };
}

/* ---------- /academy/<slug>/ — course information first, enrolment last ---------- */

export function coursePage({ root }, course) {
  const offer = offerOf(course);
  const details = [
    ['screen', 'Format', course.format],
    ['clock', 'Duration', course.duration || 'Short course'],
    course.certificate ? ['certificate', 'Certification', 'Certificate on completion'] : null,
  ].filter(Boolean);

  const body = `
<section class="course-hero">
  <div class="wrap course-hero-grid">
    <div class="course-hero-text">
      <nav class="crumbs hero-fade" aria-label="Breadcrumb"><a href="${root}academy/">Courses</a><span aria-hidden="true">/</span><span>${course.name}</span></nav>
      <p class="eyebrow hero-fade">${course.kicker}</p>
      <h1 class="display display-sm">${splitWords(course.name)}</h1>
      <p class="svc-tagline hero-fade" style="--d:.45s">${course.tagline}</p>
      <p class="lede hero-fade" style="--d:.55s">${course.summary}</p>
      <ul class="course-meta hero-fade" style="--d:.65s">
        ${details.map(([ico, , value]) => `<li>${icon(ico)}${value}</li>`).join('')}
      </ul>
    </div>
    <aside class="buy-card hero-fade" style="--d:.35s" aria-label="Course fee">
      <p class="buy-card-title">Course fee</p>
      ${priceFlow(course)}
      ${button({ href: '#enrol', label: 'Enrol now', variant: 'accent', size: 'lg', arrow: true })}
      <p class="buy-note">${icon('lock')}Secure payment by Razorpay</p>
    </aside>
  </div>
</section>

<section class="section section-tight" id="learn">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'What you’ll learn', title: 'What this course covers.' })}
    <ol class="caps">
      ${course.outcomes
        .map(
          (o, i) => `<li class="cap" data-reveal style="--d:${(i % 2) * 0.08}s">
        <span class="cap-n">${String(i + 1).padStart(2, '0')}</span>
        <div><h3>${o}</h3></div>
      </li>`
        )
        .join('\n      ')}
    </ol>
  </div>
</section>

<section class="section section-mist" id="details">
  <div class="wrap course-details">
    <div data-reveal>
      <p class="eyebrow">Who it’s for</p>
      <h2 class="title">Made for you if you are…</h2>
      <ul class="who-list">
        ${course.audience.map((w) => `<li>${icon('check')}${w}</li>`).join('')}
      </ul>
    </div>
    <dl class="detail-list" data-reveal style="--d:.1s">
      ${details.map(([ico, label, value]) => `<div><dt>${icon(ico)}${label}</dt><dd>${value}</dd></div>`).join('')}
      <div><dt>${icon('tag')}Fee</dt><dd>${inr(course.price)}${offer ? ` · ${inr(offer.finalPrice)} with coupon ${offer.code}` : ' · no discount currently'}</dd></div>
    </dl>
  </div>
</section>

<section class="section" id="enrol">
  <div class="wrap enrol-grid" data-checkout>
    <div class="enrol-intro" data-reveal>
      <p class="eyebrow">Enrol</p>
      <h2 class="title">Ready? Enrol in a minute.</h2>
      <p class="lede">Tell us who’s enrolling, then pay securely online.</p>
      <div class="order" aria-live="polite">
        <h3>Order summary</h3>
        <dl>
          <div><dt>${course.name}</dt><dd>${inr(course.price)}</dd></div>
          <div class="order-discount" data-order-discount hidden><dt>Coupon <span data-order-code></span></dt><dd data-order-saving></dd></div>
          <div class="order-total"><dt>You pay</dt><dd data-order-total>${inr(course.price)}</dd></div>
        </dl>
      </div>
    </div>
    <div class="form-card" data-reveal style="--d:.1s" data-form-wrap>
      <form class="form" data-checkout-form novalidate>
        <div class="field field-wide">
          <label for="enrol-name">Full name</label>
          <input id="enrol-name" name="name" type="text" autocomplete="name" required>
        </div>
        <div class="field">
          <label for="enrol-email">Email</label>
          <input id="enrol-email" name="email" type="email" autocomplete="email" inputmode="email" required>
        </div>
        <div class="field">
          <label for="enrol-phone">Phone</label>
          <input id="enrol-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" required pattern="[0-9+ \\(\\)\\-]{7,20}">
        </div>
        ${
          offer
            ? `<div class="field field-wide coupon">
          <label for="enrol-coupon">Coupon code <span class="optional">optional</span></label>
          <div class="coupon-row">
            <input id="enrol-coupon" name="coupon" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false">
            <button class="btn btn-ghost" type="button" data-coupon-apply><span>Apply</span></button>
          </div>
          <p class="coupon-offer" data-coupon-offer>Use <button class="coupon-chip" type="button" data-coupon-use="${offer.code}">${icon('tag')}${offer.code}</button> to pay ${inr(offer.finalPrice)} instead of ${inr(course.price)}.</p>
          <p class="coupon-status" data-coupon-status role="status"></p>
        </div>`
            : `<p class="field-wide coupon-none">${icon('tag')}No discount is currently available for this course.</p>`
        }
        <div class="form-foot field-wide">
          <button class="btn btn-accent btn-lg" type="submit" data-pay>${icon('lock')}<span data-pay-label>Pay ${inr(course.price)}</span></button>
          <p class="form-note">Payments are processed securely by Razorpay. By paying you agree to our <a href="${root}terms/">terms</a> and <a href="${root}privacy/">privacy policy</a>.</p>
        </div>
        <p class="form-status field-wide" role="status" aria-live="polite"></p>
        <noscript><p class="form-status field-wide is-error">Online enrolment needs JavaScript. Please enable it, or <a href="${root}contact/">contact us</a> to enrol.</p></noscript>
      </form>
      <div class="form-success" hidden tabindex="-1">
        <span class="success-check" aria-hidden="true">${icon('check')}</span>
        <h2>You’re enrolled.</h2>
        <p>Payment received for ${course.name}. ${config.legal.courseAccess ? `Your course access is delivered ${esc(config.legal.courseAccess)}, to` : 'We’ll send your course access details to'} <strong data-success-email></strong>.</p>
        <p class="pay-ref">Payment reference: <span data-success-ref></span></p>
        ${accountPrompt(root, 'student', 'Use the same email to see your courses and progress.')}
      </div>
    </div>
  </div>
</section>
<script type="application/json" id="course-data">${JSON.stringify({ slug: course.slug, name: course.name, price: course.price, currency, coupons: course.coupons, api: `${root}api/` }).replace(/</g, '\\u003c')}</script>
`;

  return {
    title: course.name,
    description: `${course.summary} Fee ${inr(course.price)}${offer ? `, or ${inr(offer.finalPrice)} with coupon ${offer.code}` : ''}.`,
    body,
    bodyClass: 'page-course',
    scripts: ['checkout.js'],
    sticky: { href: '#enrol', label: 'Enrol now' },
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'Course',
        name: course.name,
        description: course.summary,
        provider: { '@type': 'Organization', name: config.company.name, ...(config.siteUrl ? { sameAs: config.siteUrl } : {}) },
        offers: { '@type': 'Offer', category: 'Paid', price: course.price, priceCurrency: currency },
      },
      ...(config.siteUrl
        ? [{
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Courses', item: `${config.siteUrl}/academy/` },
              { '@type': 'ListItem', position: 2, name: course.name, item: `${config.siteUrl}/academy/${course.slug}/` },
            ],
          }]
        : []),
    ],
  };
}

/* ---------- /about/ ---------- */

export function about({ root }) {
  const moduleCount = areas.reduce((t, a) => t + a.items.length, 0);
  const links = { universities: 'solutions/', learners: 'academy/', partners: 'partners/' };

  // Client and certification sections exist only when there is something real to show.
  const clients = config.clients.length
    ? `<section class="section section-mist" id="clients">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'Our clients', title: 'The institutions we work with.' })}
    <ul class="clients" data-reveal>${config.clients.map((c) => `<li class="client"><img src="${root}assets/img/${esc(c.logo)}" alt="${esc(c.name)}" loading="lazy"></li>`).join('')}</ul>
  </div>
</section>`
    : '';

  const certifications = config.certifications.length
    ? `<section class="section" id="certifications">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'Certifications', title: 'Certifications and compliance.' })}
    <ul class="certs">${config.certifications.map((c) => `<li><h3>${esc(c.name)}</h3><p>${esc(c.detail || '')}</p></li>`).join('')}</ul>
  </div>
</section>`
    : '';

  const body = `
<section class="page-hero">
  <div class="wrap">
    <p class="eyebrow hero-fade">About</p>
    <h1 class="display display-md">${splitWords('We build the technology ecosystem behind online education.')}</h1>
    <p class="lede hero-fade" style="--d:.7s">${config.company.name} is a technology and services company. We set up and run online programmes for universities, teach career skills through short courses, and give education agents the applications they work with every day.</p>
  </div>
</section>

<section class="section section-tight">
  <div class="wrap">
    <div class="about-stats" data-reveal>
      <div><strong>${areas.length}</strong><span>service areas for universities</span></div>
      <div><strong>${moduleCount}</strong><span>modules to choose from</span></div>
      <div><strong>${courses.length}</strong><span>short courses</span></div>
      <div><strong>${externalApps.length}</strong><span>partner applications</span></div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'Who we serve', title: 'Three audiences. One ecosystem.' })}
    <div class="serve">
      ${audiences
        .map(
          (a, i) => `<a class="serve-card spot" href="${root}${links[a.id]}" data-reveal style="--d:${i * 0.08}s">
        <span class="audience-ico">${icon(a.icon)}</span>
        <h3>${a.title}</h3>
        <p>${a.line}</p>
        <span class="link-arrow"><span>${a.id === 'universities' ? 'For universities' : a.id === 'learners' ? 'For learners' : 'For agents and partners'}</span>${icon('arrow')}</span>
      </a>`
        )
        .join('\n      ')}
    </div>
  </div>
</section>

<section class="section section-mist">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'For universities', title: 'The whole lifecycle of an online programme.' })}
    <ol class="lifecycle">
      ${stages
        .map(
          (s, i) => `<li data-reveal style="--d:${i * 0.08}s">
        <p class="stage-n">${s.n}</p>
        <h3>${s.name}</h3>
        <p>${s.line}.</p>
        <ul>${areas.filter((a) => a.stage === s.id).map((a) => `<li><a href="${root}solutions/${a.slug}/">${a.name}</a></li>`).join('')}</ul>
      </li>`
        )
        .join('\n      ')}
    </ol>
  </div>
</section>

<section class="section">
  <div class="wrap about-how">
    ${sectionHead({ eyebrow: 'How we work with universities', title: 'Your university. Your faculty. Your terms.' })}
    <div class="facts">
      <div class="fact" data-reveal><h3>Built with your faculty</h3><p>Content is created from material provided by University faculty and customised to your syllabus and curriculum.</p></div>
      <div class="fact" data-reveal style="--d:.08s"><h3>Managed day to day</h3><p>We don’t just set systems up. We maintain, upgrade and operate them alongside your team.</p></div>
      <div class="fact" data-reveal style="--d:.16s"><h3>Data on your terms</h3><p>Data is stored in accordance with the University’s requirements and mutually agreed terms and conditions.</p></div>
    </div>
  </div>
</section>

${clients}

${certifications}

<section class="section section-tight">
  <div class="wrap about-legal" data-reveal>
    <img src="${root}assets/img/logo.svg" alt="${esc(config.company.legalName)}" width="260" height="50" loading="lazy">
    <p>${esc(config.company.legalName)}</p>
  </div>
</section>

${ctaBand(root, {
  title: 'Find your place in the ecosystem.',
  text: 'University, learner or agent — there’s a path built for you.',
  actions: [
    { href: `${root}#start`, label: 'Choose your path' },
    { href: `${root}contact/`, label: 'Talk to us' },
  ],
})}
`;
  return {
    title: 'About',
    description: `${config.company.name} is a technology and services company for online education — serving universities, learners and education agents.`,
    body,
    bodyClass: 'page-about',
  };
}

/* ---------- /contact/ ---------- */

// Where a university looks up the empanelment request it submitted (assets/js/status.js).
export function requestStatus({ root }) {
  const body = `
<section class="page-hero page-hero-form">
  <div class="wrap form-section">
    <div>
      <p class="eyebrow hero-fade">For universities</p>
      <h1 class="display display-md">${splitWords('Check your request.')}</h1>
      <p class="lede hero-fade" style="--d:.4s">Enter the Request ID from your confirmation and the official email address you registered with.</p>
      <ul class="contact-alt hero-fade" style="--d:.55s">
        <li><a class="link-arrow" href="${root}configure/"><span>No request yet? Start one</span>${icon('arrow')}</a></li>
        <li><a class="link-arrow" href="${root}contact/"><span>Lost your Request ID? Contact us</span>${icon('arrow')}</a></li>
      </ul>
    </div>
    <div class="form-card hero-fade" style="--d:.3s">
      <form class="form" data-status-form novalidate>
        <div class="field field-wide">
          <label for="status-reference">Request ID</label>
          <input id="status-reference" name="reference" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="20" placeholder="UR-000123" required>
        </div>
        <div class="field field-wide">
          <label for="status-email">Official email</label>
          <input id="status-email" name="email" type="email" autocomplete="email" inputmode="email" maxlength="254" required>
        </div>
        <div class="form-foot field-wide">
          <button class="btn btn-primary btn-lg" type="submit"><span>Check status</span>${icon('arrow')}</button>
        </div>
        <p class="form-status field-wide" role="alert"></p>
      </form>
      <div class="status-result" data-status-result hidden tabindex="-1"></div>
    </div>
  </div>
</section>
`;
  return {
    title: 'Check your request',
    description: `Check the status of your university empanelment request with ${config.company.name} using your Request ID and registered email address.`,
    body,
    bodyClass: 'page-contact',
    scripts: ['status.js'],
  };
}

export function contact({ root }) {
  const body = `
<section class="page-hero page-hero-form">
  <div class="wrap form-section">
    <div>
      <p class="eyebrow hero-fade">Contact</p>
      <h1 class="display display-md">${splitWords('Talk to us.')}</h1>
      <p class="lede hero-fade" style="--d:.4s">Tell us who you are and what you need. We’ll come back with next steps.</p>
      <ul class="contact-alt hero-fade" style="--d:.55s">
        <li><a class="link-arrow" href="${root}configure/"><span>University? Build your solution</span>${icon('arrow')}</a></li>
        <li><a class="link-arrow" href="${root}academy/"><span>Here to learn? Browse courses</span>${icon('arrow')}</a></li>
        <li><a class="link-arrow" href="${root}partners/"><span>Agent or partner? Join Walnut</span>${icon('arrow')}</a></li>
      </ul>
    </div>
    <div class="form-card hero-fade" style="--d:.3s">
      ${enquiryForm({ id: 'contact', topic: 'General enquiry', root, orgLabel: 'Organisation', messageLabel: 'How can we help?' })}
    </div>
  </div>
</section>
`;
  return {
    title: 'Contact',
    description: `Talk to ${config.company.name} — about online programmes for your university, our short courses, or becoming an agent.`,
    body,
    bodyClass: 'page-contact',
  };
}

/* ---------- legal pages ---------- */

const legal = config.legal;
const contactLine = (root) =>
  legal.contactEmail
    ? `email <a href="mailto:${esc(legal.contactEmail)}">${esc(legal.contactEmail)}</a> or use our <a href="${root}contact/">contact page</a>`
    : `use our <a href="${root}contact/">contact page</a>`;

function legalPage({ title, intro, sections }) {
  return `
<section class="page-hero">
  <div class="wrap">
    <p class="eyebrow">Legal</p>
    <h1 class="display display-sm">${title}</h1>
    <p class="lede">Last updated ${esc(legal.lastUpdated)}</p>
  </div>
</section>
<section class="section section-tight">
  <div class="wrap prose">
    ${intro}
    ${sections.filter(Boolean).map(([id, heading, html]) => `<h2 id="${id}">${heading}</h2>\n    ${html}`).join('\n    ')}
  </div>
</section>
`;
}

// Describes what the site actually does. Every statement here is backed by the implementation:
// update it when a form, a third party or a storage key is added or removed.
export function privacy({ root }) {
  const ga = Boolean(config.analytics.gaMeasurementId);
  const body = legalPage({
    title: 'Privacy policy',
    intro: `<p>This policy explains what information ${esc(config.company.legalName)} (“${config.company.name}”, “we”, “us”) collects through this website, why, and what you can do about it.</p>`,
    sections: [
      ['who', 'Who we are', `<p>This website is operated by ${esc(config.company.legalName)}${legal.registeredAddress ? `, ${esc(legal.registeredAddress)}` : ''}. For anything in this policy, ${contactLine(root)}.</p>`],
      ['collect', 'Information you give us', `<ul>
      <li><strong>Enquiries.</strong> When you use a contact form or the solution builder: your name, organisation, email address, phone number (optional), your message, and the services and modules you selected.</li>
      <li><strong>Course enrolment.</strong> When you enrol in a course: your name, email address, phone number, the course and coupon you chose, and the payment reference issued by our payment provider.</li>
    </ul>
    <p>We do not ask for, and you should not send us, sensitive information such as identity documents or bank details through this website.</p>`],
      ['automatic', 'Information collected automatically', `<p>Like most websites, the servers that host this site record technical information about each request — such as your IP address, browser type, the page requested and the time — in standard server logs kept for security and troubleshooting.${ga ? ' With your consent we also use Google Analytics, described under “Cookies and similar technologies”.' : ' We do not use analytics, advertising or tracking tools on this website.'}</p>`],
      ['use', 'How we use your information', `<ul>
      <li>to respond to your enquiry and prepare a proposal, and to email you a copy of what you sent;</li>
      <li>to process your enrolment, email you a confirmation of your payment and give you access to your course;</li>
      <li>to keep the website secure and working;</li>
      <li>to meet our legal, tax and accounting obligations.</li>
    </ul>
    <p>We do not sell your personal information, and we do not use it for automated decision-making.</p>`],
      ['payments', 'Payments', `<p>Course payments are processed by Razorpay. Your card, UPI or bank details are entered on Razorpay’s secure checkout and are never seen or stored by us. We send Razorpay your name, email address, phone number, the course and the amount so it can process the payment, and Razorpay returns the payment status and reference to us. Razorpay handles your information under its own privacy policy.</p>`],
      ['sharing', 'Who we share information with', `<p>We share information only with service providers that help us run this website, and only as far as they need it:</p>
    <ul>
      <li><strong>${esc(config.email.provider)}</strong> — sends our emails: your enquiry is emailed to our team, and a confirmation is emailed to you.</li>
      <li><strong>Razorpay</strong> — processes course payments.</li>
      <li><strong>Our hosting providers</strong> — serve the website and keep server logs.</li>
      <li><strong>Google Fonts</strong> — serves the typefaces; your browser requests them from Google, which receives your IP address.</li>
      <li><strong>Video platforms</strong> — if you choose to play a video, it is loaded from the platform that hosts it.</li>
      ${ga ? '<li><strong>Google Analytics</strong> — only if you accept analytics cookies.</li>' : ''}
    </ul>
    <p>Our partner applications (Agent Onboard, Course Finder and Online Leads) open on their own websites and handle information under their own terms. We may also disclose information where the law requires it.</p>`],
      ['cookies', 'Cookies and similar technologies', `<p>This website itself does not set any cookies${ga ? ' unless you accept analytics' : ''}. It stores a small amount of information in your browser so the site works as you expect:</p>
    <ul>
      <li><strong>Your chosen path</strong> — the homepage remembers whether you chose universities, courses or partners.</li>
      <li><strong>Solution builder progress</strong> — your in-progress selections are kept until you close the tab, so they survive a page refresh.</li>
      ${ga ? '<li><strong>Your analytics choice</strong> — whether you accepted or declined analytics.</li>' : ''}
    </ul>
    <p>This information stays on your device and is not sent to us. When you pay, Razorpay’s checkout may set its own cookies to process the payment securely.${ga ? ' If you accept, Google Analytics sets cookies to measure how the site is used; you can change your choice at any time through “Cookie settings” at the bottom of any page.' : ''}</p>`],
      ['retention', 'How long we keep it', `<p>${legal.retention ? `We keep enquiry and enrolment records ${esc(legal.retention)}.` : 'We keep enquiry and enrolment records only for as long as we need them for the purposes above, and for as long as the law requires us to keep financial records.'}</p>`],
      ['rights', 'Your choices and rights', `<p>You can ask us to tell you what information we hold about you, to correct it, or to delete it, and you can withdraw a consent you have given. To do so, ${contactLine(root)}. We will respond as required by applicable data-protection law.${legal.grievanceOfficer ? ` Complaints can be addressed to our grievance officer, ${esc(legal.grievanceOfficer)}.` : ''}</p>`],
      ['security', 'Security', `<p>The website is served over an encrypted connection and payment details are handled entirely by Razorpay. No method of transmission or storage is completely secure, so we cannot guarantee absolute security.</p>`],
      ['changes', 'Changes to this policy', `<p>We may update this policy when the website or the law changes. The date at the top shows when it was last revised.</p>`],
    ],
  });
  return {
    title: 'Privacy policy',
    description: `How ${config.company.name} collects, uses and protects the information you share through this website, including enquiries and course payments.`,
    body,
    bodyClass: 'page-legal',
  };
}

// Terms cover what the website actually offers. Commercial terms that only the business can decide
// (refunds, course access, governing law) come from site.config.mjs → legal and are never invented here.
export function terms({ root }) {
  const body = legalPage({
    title: 'Terms &amp; conditions',
    intro: `<p>These terms apply to your use of this website, which is operated by ${esc(config.company.legalName)} (“${config.company.name}”, “we”, “us”). By using the website you agree to them.</p>`,
    sections: [
      ['use', 'Using this website', `<p>You may use this website for lawful purposes only. You must not attempt to disrupt it, gain unauthorised access to it, interfere with its payment process, or use it to send unlawful, misleading or harmful material. Information you submit must be accurate and must be your own, or sent with the permission of the person it belongs to.</p>`],
      ['services', 'Services for universities and institutions', `<p>The descriptions of our services on this website are for general information. Submitting an enquiry or a configuration through the solution builder is a request for a proposal — it is not an order and does not create a contract. Services are provided only under a separate written agreement between us and the institution, which sets out the scope, fees and terms.</p>`],
      ['courses', 'Courses and enrolment', `<ul>
      <li>Course descriptions, including what a course covers and whether it carries a certificate, are shown on each course page.</li>
      <li>Fees are shown in Indian rupees on the course page and again at checkout before you pay. The amount you are charged is the amount shown at checkout.</li>
      <li>A coupon applies only to the course it is offered for, cannot be exchanged for cash, and may be changed or withdrawn at any time before you pay.</li>
      <li>Your enrolment is confirmed once your payment has been received and verified. ${legal.courseAccess ? `Course access is delivered ${esc(legal.courseAccess)}.` : 'We will then contact you at the email address you provided with your course access details.'}</li>
      <li>Course access is for the enrolled person only and may not be shared or resold.</li>
    </ul>`],
      ['payments', 'Payments', `<p>Payments are processed by Razorpay. Your payment details are entered on Razorpay’s checkout and are subject to Razorpay’s terms; we do not see or store them. If a payment is deducted but your enrolment is not confirmed on screen, contact us with your payment reference and we will resolve it.</p>`],
      ['refunds', 'Refunds and cancellations', legal.refundPolicy ? `<p>${esc(legal.refundPolicy)}</p>` : `<p>To cancel an enrolment or ask for a refund, ${contactLine(root)} with your payment reference. Requests are handled in line with our refund policy and applicable consumer law.</p>`],
      ['partners', 'Partner applications and external links', `<p>Agent Onboard, Course Finder and Online Leads are separate applications that open on their own websites and have their own terms. This website may also link to other third-party sites. We are not responsible for the content or practices of websites we do not operate.</p>`],
      ['ip', 'Intellectual property', `<p>The content of this website — including text, design, graphics, logos and course materials — belongs to ${esc(config.company.legalName)} or its licensors. You may view it for your own use. You may not copy, republish or use it commercially without our written permission.</p>`],
      ['liability', 'Availability and liability', `<p>We work to keep this website accurate and available, but we provide it “as is” and cannot promise that it will always be available or free of errors. To the extent the law allows, we are not liable for indirect or consequential loss arising from your use of the website. Nothing in these terms limits any right you have under law that cannot be excluded.</p>`],
      ['suspension', 'Suspension', `<p>We may restrict or end access to the website or to a course for anyone who breaks these terms.</p>`],
      legal.governingLaw ? ['law', 'Governing law', `<p>These terms are governed by the laws of ${esc(legal.governingLaw)}${legal.jurisdiction ? `, and the courts of ${esc(legal.jurisdiction)} have jurisdiction over any dispute` : ''}.</p>`] : null,
      ['changes', 'Changes to these terms', `<p>We may update these terms from time to time. The date at the top shows when they were last revised. The terms that apply to a purchase are those in force when you pay.</p>`],
      ['contact', 'Contact', `<p>Questions about these terms? Please ${contactLine(root)}.${legal.registeredAddress ? ` ${esc(config.company.legalName)}, ${esc(legal.registeredAddress)}.` : ''}</p>`],
    ],
  });
  return {
    title: 'Terms & conditions',
    description: `The terms that apply to using the ${config.company.name} website, enquiring about our services and enrolling in our courses.`,
    body,
    bodyClass: 'page-legal',
  };
}

/* ---------- system pages ---------- */

function systemPage(root, { code, heading, text }) {
  return `
<section class="page-hero notfound">
  <div class="wrap center">
    ${mark('hero-mark')}
    <p class="eyebrow">${code}</p>
    <h1 class="display display-md">${heading}</h1>
    <p class="lede">${text}</p>
    <div class="actions center">
      ${button({ href: root || './', label: 'Back to home', size: 'lg' })}
      ${button({ href: `${root}contact/`, label: 'Contact us', variant: 'ghost', size: 'lg' })}
    </div>
  </div>
</section>
`;
}

export function notFound({ root }) {
  return {
    title: 'Page not found',
    description: 'This page could not be found.',
    body: systemPage(root, { code: '404', heading: 'This page isn’t here.', text: 'The link may be old, or the page may have moved.' }),
    bodyClass: 'page-system',
    noindex: true,
  };
}

// Served by the web server when something fails on its side (5xx).
export function serverError({ root }) {
  return {
    title: 'Something went wrong',
    description: 'The page could not be loaded.',
    body: systemPage(root, { code: 'Error', heading: 'Something went wrong.', text: 'The problem is on our side. Please try again in a moment.' }),
    bodyClass: 'page-system',
    noindex: true,
  };
}
