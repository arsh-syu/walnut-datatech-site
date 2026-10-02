import config from '../../site.config.mjs';
import { areas, stages } from '../data/services.mjs';
import { audiences, externalApps } from '../data/site.mjs';
import { courses, currency, inr, offerOf } from '../data/courses.mjs';
import { icon } from './icons.mjs';
import { button, mark, splitWords, sectionHead, videoTile, enquiryForm, ctaBand, esc } from './layout.mjs';
import { journeySteps, priceFlow, courseCard, appLauncher } from './blocks.mjs';

const audience = (id) => audiences.find((a) => a.id === id);

/* ---------- /partners/ — agents and partners: explore → select an application → open it ---------- */

export function partners({ root }) {
  const a = audience('partners');
  const body = `
<section class="page-hero">
  <div class="wrap">
    <p class="eyebrow hero-fade">For agents and partners</p>
    <h1 class="display display-md">${splitWords('Join Walnut.')}</h1>
    <p class="lede hero-fade" style="--d:.4s">Become a Walnut agent. Get onboarded, find the right online programme for every student you advise, and work the leads we send your way.</p>
    <div class="actions hero-fade" style="--d:.55s">
      ${button({ href: '#apps', label: 'Open an application', size: 'lg', arrow: true })}
      <a class="btn btn-ghost btn-lg" href="#onboarding-video">${icon('play')}<span>Watch the onboarding tutorial</span></a>
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

<section class="section" id="onboarding-video">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'Onboarding', title: 'See how partner onboarding works.', center: true })}
    ${videoTile({ title: 'Partner onboarding — tutorial', kicker: 'Tutorial video', url: config.videos.partnerOnboarding, cls: 'video-tile-xl' })}
  </div>
</section>

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
          <p class="form-note">Payments are processed securely by Razorpay. See our <a href="${root}privacy/">privacy policy</a>.</p>
        </div>
        <p class="form-status field-wide" role="status" aria-live="polite"></p>
      </form>
      <div class="form-success" hidden tabindex="-1">
        <span class="success-check" aria-hidden="true">${icon('check')}</span>
        <h3>You’re enrolled.</h3>
        <p>Payment received for ${course.name}. We’ll send your course access details to <strong data-success-email></strong>.</p>
        <p class="pay-ref">Payment reference: <span data-success-ref></span></p>
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
    ],
  };
}

/* ---------- /about/ ---------- */

export function about({ root }) {
  const moduleCount = areas.reduce((t, a) => t + a.items.length, 0);
  const links = { universities: 'solutions/', learners: 'academy/', partners: 'partners/' };

  const clients = config.clients.length
    ? config.clients.map((c) => `<li class="client"><img src="${root}assets/img/${esc(c.logo)}" alt="${esc(c.name)}" loading="lazy"></li>`).join('')
    : Array.from({ length: 5 }, () => `<li class="client is-empty" aria-hidden="true"></li>`).join('');

  const certs = config.certifications.length
    ? `<ul class="certs">${config.certifications.map((c) => `<li><h3>${esc(c.name)}</h3><p>${esc(c.detail || '')}</p></li>`).join('')}</ul>`
    : `<p class="placeholder-note">Our certifications will be listed here.</p>`;

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

<section class="section section-mist" id="clients">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'Our clients', title: 'The institutions we work with.' })}
    <ul class="clients" data-reveal>${clients}</ul>
    ${config.clients.length ? '' : '<p class="placeholder-note">Client names and logos will appear here.</p>'}
  </div>
</section>

<section class="section" id="certifications">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'Certifications', title: 'Certifications and compliance.' })}
    ${certs}
  </div>
</section>

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

/* ---------- /privacy/ ---------- */

export function privacy({ root }) {
  const updated = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const body = `
<section class="page-hero">
  <div class="wrap">
    <p class="eyebrow">Legal</p>
    <h1 class="display display-sm">Privacy policy</h1>
    <p class="lede">Last updated ${updated}</p>
  </div>
</section>
<section class="section section-tight">
  <div class="wrap prose">
    <h2>Who we are</h2>
    <p>This website is operated by ${esc(config.company.legalName)} (“${config.company.name}”, “we”).</p>
    <h2>Information we collect</h2>
    <p>We collect the details you choose to send us through the forms on this site: your name, organisation, email address, phone number, your message and — if you use the solution builder — the services and modules you selected. When you enrol in a course we also receive the course you chose and your payment reference.</p>
    <h2>How we use it</h2>
    <p>We use this information only to respond to your enquiry, prepare a proposal, confirm your enrolment and stay in touch about it. We do not sell your information.</p>
    <h2>Payments</h2>
    <p>Course payments are processed by Razorpay. Your card, UPI or bank details are entered on Razorpay’s secure checkout and are never seen or stored by us. Razorpay shares the payment status and reference with us so we can confirm your enrolment.</p>
    <h2>Storage in your browser</h2>
    <p>The solution builder saves your in-progress selections in your browser so they survive a page refresh, and the homepage remembers which path you chose. This stays on your device.</p>
    <h2>Third-party services</h2>
    <p>${config.form.provider ? `Enquiries you submit are delivered to our inbox by ${esc(config.form.provider)}, a form-delivery service. ` : ''}Fonts on this site are served by Google Fonts. Videos, when you choose to play them, are loaded from the video platform that hosts them. Our partner applications open on their own websites, which have their own policies. These providers may receive technical information such as your IP address.</p>
    <h2>Your choices</h2>
    <p>You can ask us to access, correct or delete the information you have sent us at any time.</p>
    <h2>Contact</h2>
    <p>Questions about this policy? <a href="${root}contact/">Get in touch with us</a>.</p>
  </div>
</section>
`;
  return {
    title: 'Privacy policy',
    description: `How ${config.company.name} handles the information you share through this website, including enquiries and course payments.`,
    body,
    bodyClass: 'page-legal',
  };
}

/* ---------- 404 ---------- */

export function notFound({ root }) {
  const body = `
<section class="page-hero notfound">
  <div class="wrap center">
    ${mark('hero-mark')}
    <p class="eyebrow">404</p>
    <h1 class="display display-md">This page isn’t here.</h1>
    <p class="lede">The link may be old, or the page may have moved.</p>
    <div class="actions center">
      ${button({ href: root || './', label: 'Back to home', size: 'lg' })}
      ${button({ href: `${root}solutions/`, label: 'For universities', variant: 'ghost', size: 'lg' })}
      ${button({ href: `${root}academy/`, label: 'Courses', variant: 'ghost', size: 'lg' })}
    </div>
  </div>
</section>
`;
  return { title: 'Page not found', description: 'This page could not be found.', body, bodyClass: 'page-404' };
}
