import config from '../../site.config.mjs';
import { areas, stages } from '../data/services.mjs';
import { partnerModules, courses } from '../data/site.mjs';
import { icon } from './icons.mjs';
import { button, mark, splitWords, sectionHead, videoTile, enquiryForm, ctaBand, esc } from './layout.mjs';

// A selectable tile. Pressed tiles in a [data-interest-scope] are sent along with that scope's enquiry form.
function interestTile({ id, name, desc, kicker = '', extra = '', n }) {
  return `<button class="pick" type="button" aria-pressed="false" data-interest="${esc(name)}" data-reveal style="--d:${n * 0.08}s">
    <span class="pick-check" aria-hidden="true">${icon('check')}</span>
    ${kicker ? `<span class="pick-kicker">${kicker}</span>` : ''}
    <span class="pick-name">${name}</span>
    <span class="pick-desc">${desc}</span>
    ${extra}
    <span class="pick-state" aria-hidden="true"><span class="off">Select</span><span class="on">Selected</span></span>
  </button>`;
}

/* ---------- /partners/ ---------- */

export function partners({ root }) {
  const body = `
<section class="page-hero">
  <div class="wrap">
    <p class="eyebrow hero-fade">Partners</p>
    <h1 class="display display-md">${splitWords('Welcome, partners.')}</h1>
    <p class="lede hero-fade" style="--d:.4s">For counsellors and education agents. Find the right online programme for every student, get onboarded, and grow with Walnut Data Tech.</p>
    <div class="actions hero-fade" style="--d:.55s">
      ${button({ href: '#join', label: 'Become a partner', size: 'lg', arrow: true })}
      <a class="btn btn-ghost btn-lg" href="#onboarding-video">${icon('play')}<span>Watch the onboarding tutorial</span></a>
    </div>
  </div>
</section>

<div data-interest-scope>
<section class="section section-tight">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'What you get', title: 'Three tools. Choose what you’re interested in.', text: 'Select one or more — we’ll include them in your partner enquiry.' })}
    <div class="picks picks-3">
      ${partnerModules.map((p, i) => interestTile({ ...p, n: i })).join('\n      ')}
    </div>
  </div>
</section>

<section class="section" id="onboarding-video">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'Onboarding', title: 'See how partner onboarding works.', center: true })}
    ${videoTile({ title: 'Partner onboarding — tutorial', kicker: 'Tutorial video', url: config.videos.partnerOnboarding, cls: 'video-tile-xl' })}
  </div>
</section>

<section class="section section-mist" id="join">
  <div class="wrap form-section">
    <div data-reveal>
      <p class="eyebrow">Join</p>
      <h2 class="title">Become a partner.</h2>
      <p class="lede">Tell us about yourself and we’ll get you started.</p>
      <p class="interest-echo" data-interest-echo hidden></p>
    </div>
    <div class="form-card" data-reveal style="--d:.1s">
      ${enquiryForm({ id: 'partner', topic: 'Partner enquiry', orgLabel: 'Agency or organisation', submit: 'Send partner enquiry', root, messageLabel: 'Tell us about your work' })}
    </div>
  </div>
</section>
</div>
`;
  return {
    title: 'Partners',
    description: 'Partner with Walnut Data Tech: Course Finder, agent onboarding and student leads for counsellors and education agents.',
    body,
    bodyClass: 'page-partners',
  };
}

/* ---------- /academy/ ---------- */

export function academy({ root }) {
  const body = `
<section class="page-hero">
  <div class="wrap">
    <p class="eyebrow hero-fade">Academy</p>
    <h1 class="display display-md">${splitWords('Short courses for what’s next.')}</h1>
    <p class="lede hero-fade" style="--d:.45s">Focused programmes from Walnut Data Tech. Select the course you’re interested in and we’ll send you the details.</p>
  </div>
</section>

<div data-interest-scope>
<section class="section section-tight">
  <div class="wrap">
    <h2 class="sr-only">Courses</h2>
    <div class="picks picks-2">
      ${courses
        .map((c, i) =>
          interestTile({
            ...c,
            n: i,
            extra: c.topics ? `<span class="pick-tags">${c.topics.map((t) => `<span>${t}</span>`).join('')}</span>` : '',
          })
        )
        .join('\n      ')}
    </div>
  </div>
</section>

<section class="section section-mist" id="register">
  <div class="wrap form-section">
    <div data-reveal>
      <p class="eyebrow">Register</p>
      <h2 class="title">Register your interest.</h2>
      <p class="lede">We’ll share course details, schedule and fees.</p>
      <p class="interest-echo" data-interest-echo hidden></p>
    </div>
    <div class="form-card" data-reveal style="--d:.1s">
      ${enquiryForm({ id: 'course', topic: 'Short course enquiry', orgLabel: 'Organisation or college', submit: 'Register interest', root, messageLabel: 'Questions for us?' })}
    </div>
  </div>
</section>
</div>
`;
  return {
    title: 'Academy — short courses',
    description: 'Short courses from Walnut Data Tech: Online Counsellor Training and Agentic AI covering AI agents and RAG.',
    body,
    bodyClass: 'page-academy',
  };
}

/* ---------- /about/ ---------- */

export function about({ root }) {
  const moduleCount = areas.reduce((t, a) => t + a.items.length, 0);

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
    <h1 class="display display-md">${splitWords('We help universities take programmes online — and run them well.')}</h1>
    <p class="lede hero-fade" style="--d:.7s">${config.company.name} is a technology and services company for higher education. We set up the platforms, produce the content and operate the day-to-day services behind university online programmes.</p>
  </div>
</section>

<section class="section section-tight">
  <div class="wrap">
    <div class="about-stats" data-reveal>
      <div><strong>${areas.length}</strong><span>service areas</span></div>
      <div><strong>${moduleCount}</strong><span>modules to choose from</span></div>
      <div><strong>${stages.length}</strong><span>lifecycle stages covered</span></div>
      <div><strong>2</strong><span>engagement models</span></div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'What we do', title: 'The whole lifecycle of an online programme.' })}
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

<section class="section section-mist">
  <div class="wrap about-how">
    ${sectionHead({ eyebrow: 'How we work', title: 'Your university. Your faculty. Your terms.' })}
    <div class="facts">
      <div class="fact" data-reveal><h3>Built with your faculty</h3><p>Content is created from material provided by University faculty and customised to your syllabus and curriculum.</p></div>
      <div class="fact" data-reveal style="--d:.08s"><h3>Managed day to day</h3><p>We don’t just set systems up. We maintain, upgrade and operate them alongside your team.</p></div>
      <div class="fact" data-reveal style="--d:.16s"><h3>Data on your terms</h3><p>Data is stored in accordance with the University’s requirements and mutually agreed terms and conditions.</p></div>
    </div>
  </div>
</section>

<section class="section" id="clients">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'Our clients', title: 'The institutions we work with.' })}
    <ul class="clients" data-reveal>${clients}</ul>
    ${config.clients.length ? '' : '<p class="placeholder-note">Client names and logos will appear here.</p>'}
  </div>
</section>

<section class="section section-mist" id="certifications">
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

${ctaBand(root)}
`;
  return {
    title: 'About',
    description: `${config.company.name} is a technology and services company that sets up and runs online programmes for universities.`,
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
      <h1 class="display display-md">${splitWords('Talk to an expert.')}</h1>
      <p class="lede hero-fade" style="--d:.4s">Tell us about your university and your online programmes. We’ll come back with next steps.</p>
      <ul class="contact-alt hero-fade" style="--d:.55s">
        <li><a class="link-arrow" href="${root}configure/"><span>Prefer to explore first? Build your solution</span>${icon('arrow')}</a></li>
        <li><a class="link-arrow" href="${root}partners/"><span>Counsellor or agent? Become a partner</span>${icon('arrow')}</a></li>
      </ul>
    </div>
    <div class="form-card hero-fade" style="--d:.3s">
      ${enquiryForm({ id: 'contact', topic: 'General enquiry', root, messageLabel: 'How can we help?' })}
    </div>
  </div>
</section>
`;
  return {
    title: 'Contact',
    description: `Talk to ${config.company.name} about setting up and running online programmes at your university.`,
    body,
    bodyClass: 'page-contact',
    stickyCta: false,
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
    <p>We collect the details you choose to send us through the forms on this site: your name, organisation, email address, phone number, your message and — if you use the solution builder — the services and modules you selected.</p>
    <h2>How we use it</h2>
    <p>We use this information only to respond to your enquiry, prepare a proposal and stay in touch about it. We do not sell your information.</p>
    <h2>Storage in your browser</h2>
    <p>The solution builder saves your in-progress selections in your browser so they survive a page refresh. They stay on your device until you submit the form and are cleared when you close the tab.</p>
    <h2>Third-party services</h2>
    <p>${config.form.provider ? `Enquiries you submit are delivered to our inbox by ${esc(config.form.provider)}, a form-delivery service. ` : ''}Fonts on this site are served by Google Fonts. Videos, when you choose to play them, are loaded from the video platform that hosts them. These providers may receive technical information such as your IP address.</p>
    <h2>Your choices</h2>
    <p>You can ask us to access, correct or delete the information you have sent us at any time.</p>
    <h2>Contact</h2>
    <p>Questions about this policy? <a href="${root}contact/">Get in touch with us</a>.</p>
  </div>
</section>
`;
  return {
    title: 'Privacy policy',
    description: `How ${config.company.name} handles the information you share through this website.`,
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
      ${button({ href: `${root}solutions/`, label: 'Browse solutions', variant: 'ghost', size: 'lg' })}
    </div>
  </div>
</section>
`;
  return { title: 'Page not found', description: 'This page could not be found.', body, bodyClass: 'page-404', stickyCta: false };
}
