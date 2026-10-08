import config from '../../site.config.mjs';
import { areas, stages } from '../data/services.mjs';
import { audiences, externalApps } from '../data/site.mjs';
import { lmsCourses, lmsCategories, lmsUpdatedAt, lmsKey, lmsUrl, lmsHost, lmsSso, lmsOptions, lmsIconsJson, learnerSteps } from '../data/lms.mjs';
import { renderCatalogue, courseLinks } from '../assets/js/lms-catalogue.js';
import { icon } from './icons.mjs';
import { button, mark, splitWords, sectionHead, videoTile, enquiryForm, ctaBand, esc, accountPrompt, clientele } from './layout.mjs';
import { journeySteps, appLauncher } from './blocks.mjs';

const audience = (id) => audiences.find((a) => a.id === id);

/* ---------- /partners/ — partners: explore → select an application → open it ---------- */

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
  // Applying creates (or continues) a partner application on the Walnut account. Without accounts
  // switched on there is no application form yet, so the page sends people to Partner Onboarding instead.
  const applyHref = config.accounts ? `${root}login/?type=agent` : '#apps';
  const applyLabel = config.accounts ? 'Start your partner application' : 'Open Partner Onboarding';

  const benefits = [
    ['cap', 'Real programmes to offer', 'Online degree programmes from the universities Walnut works with — so every student you advise has a genuine option.'],
    ['counselling', 'Course Finder', 'Search and compare programmes by subject, fee and university, and give a student a straight answer in one sitting.'],
    ['marketing', 'Leads sent to you', 'Students who come to Walnut looking for an online programme are passed to partners through Online Leads.'],
    ['handshake', 'Onboarding and support', 'You are taken through onboarding step by step, and our team stays reachable once you are working.'],
    ['user', 'One account for everything', 'Your application, your status and your applications all sit behind a single Walnut sign-in.'],
    ['compliance', 'A transparent process', 'You can see exactly where your application stands at every point, with no chasing required.'],
  ];

  const who = [
    ['Independent counsellors', 'You advise students on where and what to study, on your own or as a small practice.'],
    ['Education consultancies', 'You already place students with institutions and want online programmes in your portfolio.'],
    ['Coaching and training institutes', 'You teach students who go on to look for a degree, and want something to offer them next.'],
    ['Schools and colleges', 'You guide your own students and alumni towards further study.'],
    ['Recruitment and staffing firms', 'You work with people whose next step is a qualification they can take while working.'],
  ];

  const how = [
    ['Apply', 'Create your Walnut account and fill in the partner application — about you, where you work, your experience and what you want to work on.'],
    ['We review', 'Our team reads every application. You can come back and edit yours while it is still under review.'],
    ['Get onboarded', 'Once you are approved we take you through onboarding, the programmes on offer and how referrals are handled.'],
    ['Open your applications', 'Partner Onboarding, Course Finder and Online Leads become yours to use — all three are listed below.'],
    ['Start working', 'Advise students, submit them through the programmes you have access to, and work the leads we send.'],
  ];

  const needs = [
    'Your name, email address and mobile number',
    'The city and state you work in, and the areas you cover',
    'Your organisation’s name and type, if you are applying as an organisation',
    'How long you have worked in counselling or admissions',
    'Roughly how many students you can reach in a year',
    'What you want to work on — degree programmes, short courses or referring universities',
  ];

  const body = `
<section class="page-hero">
  <div class="wrap">
    <p class="eyebrow hero-fade">For partners</p>
    <h1 class="display display-md">${splitWords('Become a Walnut partner.')}</h1>
    <p class="lede hero-fade" style="--d:.4s">Get onboarded as a Walnut partner, find the right online programme for every student you advise, and work the leads we send your way.</p>
    <div class="actions hero-fade" style="--d:.55s">
      ${button({ href: applyHref, label: applyLabel, size: 'lg', arrow: true })}
      ${config.videos.partnerOnboarding ? `<a class="btn btn-ghost btn-lg" href="#onboarding-video">${icon('play')}<span>Watch the onboarding tutorial</span></a>` : `${button({ href: '#how', label: 'How it works', variant: 'ghost', size: 'lg' })}`}
    </div>
    <div class="hero-fade" style="--d:.7s">${journeySteps(a.steps)}</div>
  </div>
</section>

<section class="section" id="why">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'Why Walnut', title: 'What you get as a partner.', text: 'Programmes to offer, tools to work with and a team behind you — not just a listing.' })}
    <div class="facts">
      ${benefits
        .map(
          ([ico, label, text], i) => `<div class="fact" data-reveal style="--d:${i * 0.06}s">
        <span class="area-ico">${icon(ico)}</span>
        <h3>${label}</h3>
        <p>${text}</p>
      </div>`
        )
        .join('\n      ')}
    </div>
  </div>
</section>

<section class="section section-mist" id="who">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'Who can apply', title: 'Who becomes a Walnut partner.', text: 'You can apply as an individual or as an organisation. Experience helps, but it is not a requirement.' })}
    <div class="models models-compact">
      ${who
        .map(
          ([name, text], i) => `<article class="model-card spot" data-reveal style="--d:${i * 0.06}s">
        <h3>${name}</h3>
        <p>${text}</p>
      </article>`
        )
        .join('\n      ')}
    </div>
  </div>
</section>

<section class="section" id="how">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'How it works', title: 'From applying to your first student.', text: 'Five steps. You can see where you stand at every one of them.' })}
    <ol class="caps">
      ${how
        .map(
          ([title, text], i) => `<li class="cap" data-reveal style="--d:${(i % 2) * 0.08}s">
        <span class="cap-n">${String(i + 1).padStart(2, '0')}</span>
        <div><h3>${title}</h3><p>${text}</p></div>
      </li>`
        )
        .join('\n      ')}
    </ol>
  </div>
</section>

<section class="section section-mist" id="apply">
  <div class="wrap course-details">
    <div data-reveal>
      <p class="eyebrow">The application</p>
      <h2 class="title">What you’ll need to hand.</h2>
      <p class="lede">The partner application takes a few minutes. It saves as you go, so you can finish it later and edit it while it is still under review.</p>
      <div class="actions">
        ${button({ href: applyHref, label: applyLabel, variant: 'accent', size: 'lg', arrow: true })}
      </div>
      ${accountPrompt(root, 'agent', 'Your application lives in your Walnut account — that is where you come back to check its status and continue it.')}
    </div>
    <ul class="who-list" data-reveal style="--d:.1s">
      ${needs.map((n) => `<li>${icon('check')}${n}</li>`).join('\n      ')}
    </ul>
  </div>
</section>

<section class="section section-dark" id="apps">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'Partner applications', title: 'Three applications. Pick the one you need.', text: 'New to Walnut? Start with Partner Onboarding.' })}
    <div data-reveal>${appLauncher(root, 'partner-app')}</div>
  </div>
</section>

${onboarding}

${ctaBand(root, {
  title: 'Questions before you start?',
  text: 'Tell us about your work and we’ll help you get set up as a Walnut partner.',
  actions: [
    { href: `${root}contact/`, label: 'Talk to us' },
    { href: '#apply', label: 'Start your application' },
  ],
})}
`;
  return {
    title: 'Partners — become a Walnut partner',
    description:
      'Become a Walnut Data Tech partner: who can apply, what you get, how onboarding works, and the applications education partners use to grow — Partner Onboarding, Course Finder and Online Leads.',
    body,
    bodyClass: 'page-partners',
    sticky: { href: applyHref, label: applyLabel },
  };
}

/* ---------- /academy/ — learners: explore courses → enrol and learn on Walnut LMS ---------- */

// Courses are sold and taken on Walnut LMS; this page lists its catalogue. Every count on it comes from
// the catalogue, and the browser swaps in the live catalogue when it has changed (see main.js).
export function academy({ root }) {
  const courses = lmsCourses;
  // Only courses open for enrolment can be taken (or taken free); the rest are announced as upcoming.
  const open = courses.filter((c) => !c.upcoming);
  const soon = courses.length - open.length;
  const free = open.filter((c) => c.isFree);
  const certified = courses.filter((c) => c.certificateTitle).length;
  const hours = courses.map((c) => c.durationHours).filter((h) => h > 0);
  const levels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].filter((l) => courses.some((c) => c.level === l)).map((l) => l.toLowerCase());
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const list = (items) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : items[0]);
  const freeLine = free.length ? `${free.length === open.length ? (open.length === 1 ? 'free' : 'all free') : `${free.length} free`}` : '';
  // "7 online courses, 2 free" while all are open; "1 course open now (free) and 6 upcoming" otherwise.
  const offer = soon
    ? `${plural(open.length, 'course')} open now${freeLine ? ` (${freeLine})` : ''} and ${soon} upcoming`
    : `${plural(courses.length, 'online course')}${freeLine ? `, ${freeLine}` : ''}`;

  const included = [
    ['screen', `${plural(lmsCategories.length, 'subject')} to choose from`, `${list(lmsCategories)}.`],
    hours.length
      ? ['clock', 'Short and focused', Math.min(...hours) === Math.max(...hours) ? `Each course takes about ${plural(hours[0], 'hour')} of learning.` : `Courses take from ${plural(Math.min(...hours), 'hour')} to ${plural(Math.max(...hours), 'hour')} of learning.`]
      : null,
    certified
      ? ['certificate', 'A certificate at the end', certified === courses.length ? 'Every course ends with a certificate once you complete it.' : `${certified} of the ${plural(courses.length, 'course')} end with a certificate once you complete them.`]
      : null,
    ['cap', levels.length > 1 ? `From ${levels[0]} to ${levels.at(-1)}` : `${levels[0].charAt(0).toUpperCase()}${levels[0].slice(1)} level`, `Each course states its level, so you can start where you are: ${list(levels)}.`],
    free.length ? ['tag', free.length === 1 ? 'A free course to start with' : 'Free courses to start with', `${list(free.map((c) => c.title))} ${free.length === 1 ? 'costs' : 'cost'} nothing to take.`] : null,
    lmsSso
      ? ['user', 'One Walnut account', 'Sign in to Walnut LMS with the account you use on this site — there is no second password to remember.']
      : ['lock', 'Taught on Walnut LMS', 'Enrolment, payment, lessons and certificates are all handled on Walnut LMS, our learning platform.'],
  ].filter(Boolean);

  const steps = [
    ['Choose a course', 'Pick a course above. Its title opens the course on Walnut LMS, with its lessons, level and price.'],
    lmsSso
      ? ['Sign in with your Walnut account', 'Press Enrol and sign in with the account you use on this site. You arrive on Walnut LMS already signed in.']
      : ['Enrol on Walnut LMS', 'Press Enrol to open the course on Walnut LMS, and enrol there.'],
    ['Pay on Walnut LMS', `Paid courses are paid for on Walnut LMS, at the price shown on the course.${free.length ? ' Free courses skip this step.' : ''}`],
    ['Learn and earn the certificate', `Work through the lessons on Walnut LMS.${certified ? ' Complete a course that carries a certificate and it is issued to you there.' : ''}`],
  ];

  const body = `
<section class="page-hero">
  <div class="wrap">
    <p class="eyebrow hero-fade">For counsellors, students and professionals</p>
    <h1 class="display display-md">${splitWords('Upgrade your skills.')}</h1>
    <p class="lede hero-fade" style="--d:.4s">${soon ? `Online courses from Walnut Data Tech, taught on Walnut LMS: ${offer}.` : `${offer} from Walnut Data Tech, taught on Walnut LMS.`} ${lmsSso ? 'Choose a course, sign in with your Walnut account and start learning.' : 'Choose a course here, then enrol and learn on Walnut LMS.'}</p>
    <div class="actions hero-fade" style="--d:.55s">
      ${button({ href: '#courses', label: 'Explore courses', size: 'lg', arrow: true })}
      ${button({ href: '#how', label: 'How enrolling works', variant: 'ghost', size: 'lg' })}
    </div>
    <div class="hero-fade" style="--d:.7s">${journeySteps(learnerSteps)}</div>
  </div>
</section>

<section class="section" id="courses">
  <div class="wrap">
    ${sectionHead({
      eyebrow: 'The catalogue',
      title: 'Choose your course.',
      text: `${plural(courses.length, 'course')} across ${plural(lmsCategories.length, 'subject')}${soon ? `: ${open.length} open now, ${soon} upcoming` : freeLine ? `, ${freeLine}` : ''}. Press i on a course for its details${courses.some((c) => c.preview) ? ' and preview' : ''}.`,
    })}
    <div class="course-groups" data-lms-catalogue data-lms-url="${esc(lmsUrl)}" data-lms-sso="${lmsSso ? 1 : 0}" data-root="${esc(root)}" data-updated="${esc(lmsUpdatedAt)}" data-lms-key="${lmsKey}" data-level="3">
      ${renderCatalogue(courses, { ...lmsOptions(root), level: 3 })}
    </div>
    <script type="application/json" id="lms-icons">${lmsIconsJson()}</script>
  </div>
</section>

<section class="section section-mist" id="included">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'What you get', title: 'What Walnut courses offer.', text: 'Short, practical courses with the level, length and price stated up front.' })}
    <div class="facts">
      ${included
        .map(
          ([ico, label, text], i) => `<div class="fact" data-reveal style="--d:${i * 0.06}s">
        <span class="area-ico">${icon(ico)}</span>
        <h3>${esc(label)}</h3>
        <p>${esc(text)}</p>
      </div>`
        )
        .join('\n      ')}
    </div>
  </div>
</section>

<section class="section" id="how">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'Enrolment', title: 'From choosing a course to your certificate.', text: lmsSso ? 'Four steps, with one Walnut sign-in. Enrolment and payment happen on Walnut LMS.' : 'Four steps. Enrolment and payment happen on Walnut LMS.' })}
    <ol class="caps">
      ${steps
        .map(
          ([title, text], i) => `<li class="cap" data-reveal style="--d:${(i % 2) * 0.08}s">
        <span class="cap-n">${String(i + 1).padStart(2, '0')}</span>
        <div><h3>${title}</h3><p>${text}</p></div>
      </li>`
        )
        .join('\n      ')}
    </ol>
    <div class="actions" data-reveal>
      ${button({ href: '#courses', label: 'Explore courses', size: 'lg', arrow: true })}
      ${button({ href: `${root}contact/`, label: 'Ask a question', variant: 'ghost', size: 'lg' })}
    </div>
    ${lmsSso ? accountPrompt(root, 'student', 'One Walnut account signs you in here and on Walnut LMS.') : ''}
    <p class="account-prompt" id="bought-here">Bought a course on this website before it moved to Walnut LMS? ${
      config.accounts ? `<a href="${root}login/" data-track="account_sign_in">Sign in</a> with the email you paid with to see it, with its payment reference, under My courses — or <a href="${root}contact/">contact us</a>.` : `<a href="${root}contact/">Contact us</a> with your payment reference.`
    }</p>
  </div>
</section>

${ctaBand(root, {
  title: 'Not sure which course fits?',
  text: 'Tell us where you are in your career and we’ll help you choose.',
  actions: [
    { href: `${root}contact/`, label: 'Talk to us' },
    { href: '#courses', label: 'See the courses' },
  ],
})}
`;
  return {
    title: 'Courses — upgrade your skills',
    description: `${plural(courses.length, 'online course')} from Walnut Data Tech across ${plural(lmsCategories.length, 'subject')}${soon ? `: ${open.length} open now, ${soon} upcoming` : freeLine ? `, ${freeLine}` : ''}. Choose a course here, then enrol and learn on Walnut LMS.`,
    body,
    bodyClass: 'page-academy',
    sticky: { href: '#courses', label: 'Explore courses' },
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: courses.map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Course',
            name: c.title,
            description: c.subtitle || c.title,
            url: courseLinks(c, lmsOptions(root)).page,
            provider: { '@type': 'Organization', name: config.company.name, ...(config.siteUrl ? { sameAs: config.siteUrl } : {}) },
          },
        })),
      },
    ],
  };
}

/* ---------- /academy/<old course>/ — a course this site used to sell ---------- */

// The web server answers these addresses with a 301 (see the .htaccess written by build.mjs); this page
// is for every other host. It forwards at once with a meta refresh (the CSP allows no inline script)
// and shows the link too, for a browser that does not follow it.
export function courseMoved({ root }, course) {
  const away = /^https?:\/\//.test(course.target);
  const href = away ? course.target : `${root}academy/`;
  const lmsCourse = away ? lmsCourses.find((c) => c.slug === course.lms) : null;
  const body = `
<section class="page-hero notfound">
  <div class="wrap center">
    ${mark('hero-mark')}
    <p class="eyebrow">${esc(course.name)}</p>
    <h1 class="display display-md">${away ? 'This course is now on Walnut LMS.' : 'This course is no longer offered.'}</h1>
    <p class="lede">${
      away
        ? `${esc(course.name)} is now taught on Walnut LMS${lmsCourse ? ` as ${esc(lmsCourse.title)}` : ''}. Taking you there…`
        : `${esc(course.name)} is not available any more. Taking you to the courses we offer now…`
    }</p>
    <div class="actions center">
      ${button({ href: esc(href), label: away ? 'Open the course on Walnut LMS' : 'See all courses', size: 'lg', arrow: true })}
    </div>
  </div>
</section>
`;
  return {
    title: `${course.name} has moved`,
    description: away
      ? `${course.name} has moved to Walnut LMS, where the courses of ${config.company.name} are now taken.`
      : `${course.name} is no longer offered by ${config.company.name}. See the courses available now on Walnut LMS.`,
    body,
    bodyClass: 'page-system',
    noindex: true,
    redirect: { href, canonical: away ? course.target : config.siteUrl ? `${config.siteUrl}/academy/` : '' },
  };
}

/* ---------- /about/ ---------- */

export function about({ root }) {
  const moduleCount = areas.reduce((t, a) => t + a.items.length, 0);
  const links = { universities: 'solutions/', learners: 'academy/', partners: 'partners/' };

  // Client and certification sections exist only when there is something real to show.
  const clients = clientele(root);

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
    <p class="lede hero-fade" style="--d:.7s">${config.company.name} is a technology and services company. We set up and run online programmes for universities, teach career skills through short courses, and give education partners the applications they work with every day.</p>
  </div>
</section>

<section class="section section-tight">
  <div class="wrap">
    <div class="about-stats" data-reveal>
      <div><strong>${areas.length}</strong><span>service areas for universities</span></div>
      <div><strong>${moduleCount}</strong><span>modules to choose from</span></div>
      <div><strong>${lmsCourses.length}</strong><span>online courses</span></div>
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
        <span class="link-arrow"><span>${a.id === 'universities' ? 'For universities' : a.id === 'learners' ? 'For learners' : 'For partners'}</span>${icon('arrow')}</span>
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
    ${config.company.address ? `<p>${esc(config.company.address)}</p>` : ''}
    ${config.company.gstin ? `<p>GSTIN ${esc(config.company.gstin)}</p>` : ''}
  </div>
</section>

${ctaBand(root, {
  title: 'Find your place in the ecosystem.',
  text: 'University, learner or partner — there’s a path built for you.',
  actions: [
    { href: `${root}#start`, label: 'Choose your path' },
    { href: `${root}contact/`, label: 'Talk to us' },
  ],
})}
`;
  return {
    title: 'About',
    description: `${config.company.name} is a technology and services company for online education — serving universities, learners and education partners.`,
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
        <li><a class="link-arrow" href="${root}partners/"><span>Partner? Join Walnut</span>${icon('arrow')}</a></li>
      </ul>
      <dl class="contact-details hero-fade" style="--d:.65s">
        ${config.company.email ? `<div><dt>Email</dt><dd><a href="mailto:${esc(config.company.email)}">${esc(config.company.email)}</a></dd></div>` : ''}
        ${config.company.address ? `<div><dt>Office</dt><dd>${esc(config.company.legalName)}<br>${esc(config.company.address)}</dd></div>` : ''}
      </dl>
    </div>
    <div class="form-card hero-fade" style="--d:.3s">
      ${enquiryForm({ id: 'contact', topic: 'General enquiry', root, orgLabel: 'Organisation', messageLabel: 'How can we help?' })}
    </div>
  </div>
</section>
`;
  return {
    title: 'Contact',
    description: `Talk to ${config.company.name} — about online programmes for your university, our short courses, or becoming a partner.`,
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
      <li><strong>Courses.</strong> Courses are enrolled in and paid for on Walnut LMS (${lmsHost}), not on this website.${lmsSso ? ' When you open Walnut LMS with your Walnut account, we send it your name, email address, mobile number and the kind of Walnut account you hold, so it can sign you in.' : ''}</li>
      <li><strong>Earlier course purchases.</strong> If you bought a course on this website before courses moved to Walnut LMS, we keep the record of that purchase: your name, email address, phone number, the course and coupon you chose, and the payment reference issued by Razorpay.</li>
      ${config.payments ? `<li><strong>Payments.</strong> When you pay for one of our products on this website, we keep a record of the payment: what you paid for and the amount, your name, email address and phone number as the product you are buying gave them to us, the kind of payment method you used (for example UPI or card), the date, and the payment references Razorpay issues. We never receive your card, UPI or bank details.</li>` : ''}
    </ul>
    <p>We do not ask for, and you should not send us, sensitive information such as identity documents or bank details through this website.</p>`],
      ['automatic', 'Information collected automatically', `<p>Like most websites, the servers that host this site record technical information about each request — such as your IP address, browser type, the page requested and the time — in standard server logs kept for security and troubleshooting.${ga ? ' With your consent we also use Google Analytics, described under “Cookies and similar technologies”.' : ' We do not use analytics, advertising or tracking tools on this website.'}</p>`],
      ['use', 'How we use your information', `<ul>
      <li>to respond to your enquiry and prepare a proposal, and to email you a copy of what you sent;</li>
      <li>to keep a record of the courses bought on this website, and to give their buyers access to them on Walnut LMS;</li>
      ${config.payments ? '<li>to take payments for our products, confirm them to the product you bought from, and handle refunds;</li>' : ''}
      <li>to keep the website secure and working;</li>
      <li>to meet our legal, tax and accounting obligations.</li>
    </ul>
    <p>We do not sell your personal information, and we do not use it for automated decision-making.</p>`],
      ['payments', 'Payments', config.payments
        ? `<p>Payments for our products are made on this website through Razorpay’s checkout, where you enter your card, UPI or bank details; they go to Razorpay and are never seen or stored by us. We keep the record described under “Information you give us”, and Razorpay handles your payment information under its own privacy policy.</p>`
        : `<p>This website no longer takes payments: courses are paid for on Walnut LMS. Courses bought on this website earlier were paid through Razorpay’s checkout, where your card, UPI or bank details were entered; they were never seen or stored by us. We keep the payment status and reference Razorpay returned to us. Razorpay handles your information under its own privacy policy.</p>`],
      ['sharing', 'Who we share information with', `<p>We share information only with service providers that help us run this website, and only as far as they need it:</p>
    <ul>
      <li><strong>${esc(config.email.provider)}</strong> — sends our emails: your enquiry is emailed to our team, and a confirmation is emailed to you.</li>
      <li><strong>Walnut LMS</strong> — where courses are taken.${lmsSso ? ' It receives the details listed under “Courses” when you open it with your Walnut account.' : ''}${config.payments ? ' When you pay for a course, it is told whether the payment went through, the amount and the payment references, so it can give you the course.' : ''} For a course bought on this website earlier, it may receive the purchase record so you can take the course there.</li>
      <li><strong>Razorpay</strong> — ${config.payments ? 'processes the payments made on this website.' : 'processed the payments for courses bought on this website earlier.'}</li>
      <li><strong>Our hosting providers</strong> — serve the website and keep server logs.</li>
      <li><strong>Google Fonts</strong> — serves the typefaces; your browser requests them from Google, which receives your IP address.</li>
      <li><strong>Video platforms</strong> — if you choose to play a video, it is loaded from the platform that hosts it.</li>
      ${ga ? '<li><strong>Google Analytics</strong> — only if you accept analytics cookies.</li>' : ''}
    </ul>
    <p>Our partner applications (Partner Onboarding, Course Finder and Online Leads) open on their own websites and handle information under their own terms. We may also disclose information where the law requires it.</p>`],
      ['cookies', 'Cookies and similar technologies', `<p>This website itself does not set any cookies${ga ? ' unless you accept analytics' : ''}. It stores a small amount of information in your browser so the site works as you expect:</p>
    <ul>
      <li><strong>Your chosen path</strong> — the homepage remembers whether you chose universities, courses or partners.</li>
      <li><strong>Solution builder progress</strong> — your in-progress selections are kept until you close the tab, so they survive a page refresh.</li>
      ${ga ? '<li><strong>Your analytics choice</strong> — whether you accepted or declined analytics.</li>' : ''}
    </ul>
    <p>This information stays on your device and is not sent to us.${ga ? ' If you accept, Google Analytics sets cookies to measure how the site is used; you can change your choice at any time through “Cookie settings” at the bottom of any page.' : ''}</p>`],
      ['retention', 'How long we keep it', `<p>${legal.retention ? `We keep enquiry and enrolment records ${esc(legal.retention)}.` : 'We keep enquiry and enrolment records only for as long as we need them for the purposes above, and for as long as the law requires us to keep financial records.'}</p>`],
      ['rights', 'Your choices and rights', `<p>You can ask us to tell you what information we hold about you, to correct it, or to delete it, and you can withdraw a consent you have given. To do so, ${contactLine(root)}. We will respond as required by applicable data-protection law.${legal.grievanceOfficer ? ` Complaints can be addressed to our grievance officer, ${esc(legal.grievanceOfficer)}.` : ''}</p>`],
      ['security', 'Security', `<p>The website is served over an encrypted connection${config.payments ? ', and payment details are entered only in Razorpay’s checkout, so they never reach our servers' : ' and does not take payments'}. No method of transmission or storage is completely secure, so we cannot guarantee absolute security.</p>`],
      ['changes', 'Changes to this policy', `<p>We may update this policy when the website or the law changes. The date at the top shows when it was last revised.</p>`],
    ],
  });
  return {
    title: 'Privacy policy',
    description: `How ${config.company.name} collects, uses and protects the information you share through this website, including enquiries and course purchases.`,
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
      ['use', 'Using this website', `<p>You may use this website for lawful purposes only. You must not attempt to disrupt it, gain unauthorised access to it, or use it to send unlawful, misleading or harmful material. Information you submit must be accurate and must be your own, or sent with the permission of the person it belongs to.</p>`],
      ['services', 'Services for universities and institutions', `<p>The descriptions of our services on this website are for general information. Submitting an enquiry or a configuration through the solution builder is a request for a proposal — it is not an order and does not create a contract. Services are provided only under a separate written agreement between us and the institution, which sets out the scope, fees and terms.</p>`],
      ['courses', 'Courses and enrolment', `<ul>
      ${config.payments
        ? `<li>Courses are listed on this website and taken on Walnut LMS (${lmsHost}). You pay for them on this website’s secure payment page. Each course’s page on Walnut LMS describes what it covers, its level and whether it carries a certificate.</li>
      <li>Fees are shown in Indian rupees. The amount you are charged is the amount shown on our payment page when you pay. How courses are delivered is set out in our <a href="${root}delivery-policy/">shipping &amp; delivery policy</a>.</li>`
        : `<li>Courses are listed on this website and are enrolled in, paid for and taken on Walnut LMS (${lmsHost}). Each course’s page there describes what it covers, its level and whether it carries a certificate.</li>
      <li>Fees are shown in Indian rupees, on this website and on Walnut LMS. The amount you are charged is the amount Walnut LMS shows when you pay.</li>`}
      <li>A course bought on this website before courses moved to Walnut LMS remains yours. ${legal.courseAccess ? `Course access is delivered ${esc(legal.courseAccess)}.` : 'For anything about it, contact us with your payment reference.'}</li>
      <li>Course access is for the enrolled person only and may not be shared or resold.</li>
    </ul>`],
      ['payments', 'Payments', config.payments
        ? `<p>Payments for our products, including courses taken on Walnut LMS, are made on this website through Razorpay’s secure checkout, under Razorpay’s terms. You enter your card, UPI or bank details there; they are never seen or stored by us. If you have a question about a payment, contact us with your order or payment reference and we will resolve it.</p>`
        : `<p>Course payments are taken on Walnut LMS, not on this website. Courses bought on this website earlier were paid through Razorpay’s checkout, under Razorpay’s terms; if you have a question about one of those payments, contact us with your payment reference and we will resolve it.</p>`],
      ['refunds', 'Refunds and cancellations', legal.refundPolicy ? `<p>${esc(legal.refundPolicy)} Read our <a href="${root}refund-policy/">cancellation &amp; refund policy</a> for the details.</p>` : `<p>To cancel an enrolment or ask for a refund, ${contactLine(root)} with your payment reference. Requests are handled in line with our refund policy and applicable consumer law.</p>`],
      ['partners', 'Partner applications and external links', `<p>Walnut LMS is Walnut Data Tech’s own learning platform, where courses are sold and taken; it opens on its own website. Partner Onboarding, Course Finder and Online Leads are separate applications that open on their own websites and have their own terms. This website may also link to other third-party sites. We are not responsible for the content or practices of websites we do not operate.</p>`],
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

// The refund rule is the business's (site.config.mjs → legal: refundDays, refundMaxCompleted); this page
// explains it, and how a refund is asked for and paid back.
export function refundPolicy({ root }) {
  const days = legal.refundDays;
  const share = legal.refundMaxCompleted;
  const body = legalPage({
    title: 'Cancellation &amp; refund policy',
    intro: `<p>This policy explains when you can cancel a purchase from ${esc(config.company.legalName)} (“${config.company.name}”, “we”, “us”) and get your money back, and how. It covers courses bought from us, which are taken on Walnut LMS, our learning platform.</p>`,
    sections: [
      ['cancel', 'Cancelling before you pay', `<p>Nothing is charged until you complete a payment. If you close the payment window or leave the payment page, no money is taken, and there is nothing to cancel.</p>`],
      ['refund', 'Refunds on courses', `<p>You can have a <strong>full refund</strong> of a course if both of these are true:</p>
    <ul>
      <li>you ask for it within <strong>${days} days</strong> of paying; and</li>
      <li>you have completed <strong>less than ${share}%</strong> of the course on Walnut LMS.</li>
    </ul>
    <p>After ${days} days, or once you have completed ${share}% of the course or more, the course is not refundable. Courses marked “Upcoming” cannot be bought until they open, so there is nothing to refund on them.</p>`],
      ['errors', 'Payments taken in error', `<p>If a payment failed but money was deducted, you were charged twice for the same purchase, or you were charged an amount other than the one shown when you paid, we refund the amount taken in error in full, whenever you tell us.</p>`],
      ['ask', 'How to ask for a refund', `<p>Please ${contactLine(root)} from the email address you paid with, and give your order or payment reference and the course. We check the request against this policy and reply to you by email.</p>`],
      ['paid', 'How refunds are paid', `<p>An approved refund is paid back to the payment method you used — your card, UPI account, bank account or wallet — through Razorpay, our payment provider. It usually reaches you within 5–7 working days of approval; how soon it shows depends on your bank. Once a course is refunded in full, your access to it on Walnut LMS is withdrawn, including its lessons, files and any certificate.</p>`],
      ['law', 'Your rights', `<p>Nothing in this policy limits a right you have under the law that cannot be excluded.${legal.grievanceOfficer ? ` Complaints can be addressed to our grievance officer, ${esc(legal.grievanceOfficer)}.` : ''}</p>`],
      ['contact', 'Contact', `<p>${esc(config.company.legalName)}${legal.registeredAddress ? `, ${esc(legal.registeredAddress)}` : ''}. To ask about a refund, ${contactLine(root)}.</p>`],
    ],
  });
  return {
    title: 'Cancellation & refund policy',
    description: `When and how you can cancel a purchase from ${config.company.name} and get a refund: within ${days} days of paying, with less than ${share}% of the course completed.`,
    body,
    bodyClass: 'page-legal',
  };
}

// Everything Walnut sells is digital: this page says how and when it is delivered (payment providers ask
// for it under the name "shipping and delivery policy").
export function deliveryPolicy({ root }) {
  const body = legalPage({
    title: 'Shipping &amp; delivery policy',
    intro: `<p>${esc(config.company.legalName)} (“${config.company.name}”) sells digital products only. This policy explains how they are delivered.</p>`,
    sections: [
      ['shipping', 'Nothing is shipped', `<p>We do not sell or ship physical goods, so there are no shipping charges and nothing is sent by post or courier.</p>`],
      ['courses', 'Courses', `<p>Courses are delivered online, on Walnut LMS (${lmsHost}), our learning platform. You get access ${esc(legal.courseAccess || 'once your payment is confirmed')} — usually within minutes. Sign in to Walnut LMS with the email address you paid with${lmsSso ? ', or with your Walnut account' : ''}, and the course is there. Walnut LMS also emails you a receipt.</p>`],
      ['missing', 'If your course does not appear', `<p>If you have paid and cannot see your course within 24 hours, please ${contactLine(root)} with your order or payment reference, and we will put it right. If a payment failed but money was deducted, see our <a href="${root}refund-policy/">refund policy</a>.</p>`],
      ['contact', 'Contact', `<p>${esc(config.company.legalName)}${legal.registeredAddress ? `, ${esc(legal.registeredAddress)}` : ''}. For anything about delivery, ${contactLine(root)}.</p>`],
    ],
  });
  return {
    title: 'Shipping & delivery policy',
    description: `How ${config.company.name}'s digital products are delivered: courses on Walnut LMS, as soon as payment is confirmed. Nothing is shipped.`,
    body,
    bodyClass: 'page-legal',
  };
}

/* ---------- /pay/ — the payment gateway's page ---------- */

// Where the buyer of any Walnut product pays. What is being paid for, and how much, comes from the gateway
// (api/pay/checkout.php) for the intent in the link; the page holds nothing about any payment itself.
export function pay({ root }) {
  const body = `
<section class="section pay-section">
  <div class="wrap">
    <div class="pay-card">
      <p class="eyebrow">Secure payment</p>
      <h1 class="pay-title">Complete your payment</h1>
      <div class="pay-body" id="pay" data-root="${esc(root)}" aria-live="polite">
        <p class="pay-note">Loading your payment…</p>
        <noscript><p class="pay-note">Paying needs JavaScript. Please turn it on and reload this page.</p></noscript>
      </div>
    </div>
    <p class="pay-trust">Payments are processed by Razorpay: UPI, cards, netbanking and wallets. Your card and bank details go to Razorpay, never to us. ${esc(config.company.legalName)} · <a href="${root}refund-policy/">Refund policy</a> · <a href="${root}terms/">Terms</a> · <a href="${root}privacy/">Privacy</a></p>
  </div>
</section>`;
  return {
    title: 'Secure payment',
    description: `Pay for a ${config.company.name} product securely, through Razorpay: UPI, cards, netbanking and wallets.`,
    body,
    bodyClass: 'page-pay',
    scripts: ['pay.js'],
    noindex: true,
    payments: true,
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
