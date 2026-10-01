import config from '../../site.config.mjs';
import { areas, stages, models, journey } from '../data/services.mjs';
import { compliancePoints } from '../data/site.mjs';
import { icon } from './icons.mjs';
import { vignette } from './vignettes.mjs';
import { button, mark, splitWords, sectionHead, videoTile, ctaBand, esc } from './layout.mjs';

// The hero's interactive service showcase: a tab list of all service areas, grouped by lifecycle stage.
function showcase(root) {
  let n = 0;
  const rail = stages
    .map((s) => {
      const tabs = areas
        .filter((a) => a.stage === s.id)
        .map((a) => {
          const first = n++ === 0;
          return `<button class="rail-item${first ? ' is-active' : ''}" type="button" role="tab" id="tab-${a.slug}" aria-controls="panel-${a.slug}" aria-selected="${first}" tabindex="${first ? 0 : -1}" data-slug="${a.slug}">
            <span class="rail-ico">${icon(a.slug)}</span><span class="rail-name">${a.short}</span><span class="rail-progress" aria-hidden="true"></span>
          </button>`;
        })
        .join('');
      return `<div class="rail-group"><p class="rail-stage"><span>${s.n}</span>${s.name}</p>${tabs}</div>`;
    })
    .join('');

  const panels = areas
    .map((a, i) => {
      const stage = stages.find((s) => s.id === a.stage);
      return `<div class="showcase-panel${i === 0 ? ' is-active' : ''}" role="tabpanel" id="panel-${a.slug}" aria-labelledby="tab-${a.slug}"${i === 0 ? '' : ' inert'}>
        ${vignette(a.slug, a.name)}
        <div class="showcase-caption">
          <div>
            <p class="showcase-kicker">${stage.n} · ${stage.name}</p>
            <h3>${a.name}</h3>
            <p>${a.tagline}</p>
          </div>
          <a class="link-arrow" href="${root}solutions/${a.slug}/"><span>Explore<span class="sr-only"> ${a.name}</span></span>${icon('arrow')}</a>
        </div>
      </div>`;
    })
    .join('');

  return `<div class="showcase" id="services" data-showcase data-reveal>
    <div class="showcase-rail" role="tablist" aria-label="Service areas">${rail}</div>
    <div class="showcase-stage">${panels}</div>
  </div>`;
}

export default function home({ root }) {
  const moduleCount = areas.reduce((t, a) => t + a.items.length, 0);

  const body = `
<section class="hero">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap hero-in">
    ${mark('hero-mark')}
    <p class="eyebrow hero-fade" style="--d:.5s">For universities offering online programmes</p>
    <h1 class="display">${splitWords('The engine behind university online programmes.')}</h1>
    <p class="lede hero-fade" style="--d:.75s">Walnut Data Tech sets up and runs the technology, content, admissions, examinations and student support behind online degrees — so your university can focus on teaching.</p>
    <div class="actions center hero-fade" style="--d:.9s">
      ${button({ href: `${root}configure/`, label: 'Build your solution', size: 'lg', arrow: true })}
      <button class="btn btn-ghost btn-lg" type="button" data-video="${esc(config.videos.company)}" data-video-title="Walnut Data Tech — company film">${icon('play')}<span>Watch the film</span></button>
    </div>
  </div>
  <div class="wrap">
    <h2 class="sr-only">Service areas</h2>
    ${showcase(root)}
    <p class="showcase-foot" data-reveal>${areas.length} service areas · ${moduleCount} modules · <a href="${root}solutions/">See all solutions</a></p>
  </div>
</section>

<section class="section" id="film">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'The film', title: 'See how it all comes together.', text: 'A short walkthrough of how Walnut Data Tech works with universities.', center: true })}
    ${videoTile({ title: 'How Walnut Data Tech works', kicker: 'Company film', url: config.videos.company, cls: 'video-tile-xl' })}
  </div>
</section>

<section class="section section-dark" id="platform">
  <div class="wrap journey-grid">
    <div class="journey-intro" data-reveal>
      <p class="eyebrow">One connected platform</p>
      <h2 class="title">Every step of the student journey. One platform.</h2>
      <p class="lede">Admissions, student records, learning, examinations and support are set up as one integrated system — and managed for you, day to day.</p>
      <a class="link-arrow" href="${root}solutions/infrastructure/"><span>Explore the infrastructure</span>${icon('arrow')}</a>
    </div>
    <ol class="journey" data-journey>
      ${journey
        .map(
          (j, i) => `<li class="journey-step${i === 0 ? ' is-active' : ''}">
        <a href="${root}solutions/${j.area}/">
          <span class="journey-verb">${j.verb}</span>
          <span class="journey-body"><span class="journey-system">${j.system}</span><span class="journey-desc">${j.desc}</span></span>
          ${icon('arrow')}
        </a>
      </li>`
        )
        .join('\n      ')}
    </ol>
  </div>
</section>

<section class="section" id="engagement">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'Engagement', title: 'Two ways to work with us.', text: 'Choose one model for everything — or decide service by service.', center: true })}
    <div class="models">
      ${models
        .map(
          (m, i) => `<article class="model-card spot" data-reveal style="--d:${i * 0.1}s">
        <p class="model-n">Model ${i + 1}</p>
        <h3>${m.name}</h3>
        <p class="model-line">${m.line}</p>
        <p>${m.desc}</p>
        <p class="model-unit">${icon('check')}${m.unit}</p>
        <p class="model-unit">${icon('check')}Pay only for the modules you select</p>
      </article>`
        )
        .join('\n      ')}
    </div>
    <div class="actions center" data-reveal>
      ${button({ href: `${root}configure/`, label: 'Configure your engagement', variant: 'accent', size: 'lg', arrow: true })}
    </div>
  </div>
</section>

<section class="section section-mist" id="compliance">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'Regulation-ready', title: 'Built around UGC and DEB requirements.', text: 'Compliance is designed into the services, not bolted on afterwards.' })}
    <div class="facts">
      ${compliancePoints.map((p, i) => `<div class="fact" data-reveal style="--d:${i * 0.08}s"><h3>${p.label}</h3><p>${p.text}</p></div>`).join('\n      ')}
    </div>
    <a class="link-arrow" href="${root}solutions/compliance/" data-reveal><span>Reporting &amp; regulatory support</span>${icon('arrow')}</a>
  </div>
</section>

<section class="section" id="more">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'Beyond universities', title: 'For partners and professionals, too.' })}
    <div class="duo">
      <a class="duo-card duo-partners spot" href="${root}partners/" data-reveal>
        <p class="eyebrow">Partners</p>
        <h3>Welcome, partners.</h3>
        <p>Course Finder, agent onboarding and student leads for counsellors and education agents.</p>
        <span class="link-arrow"><span>Partner with Walnut</span>${icon('arrow')}</span>
      </a>
      <a class="duo-card duo-academy spot" href="${root}academy/" data-reveal style="--d:.1s">
        <p class="eyebrow">Academy</p>
        <h3>Short courses.</h3>
        <p>Online Counsellor Training and Agentic AI — AI agents and RAG.</p>
        <span class="link-arrow"><span>Browse courses</span>${icon('arrow')}</span>
      </a>
    </div>
  </div>
</section>

${ctaBand(root)}
`;

  return {
    title: 'Walnut Data Tech — Technology and services for university online programmes',
    description:
      'Walnut Data Tech sets up and runs online programmes for universities: cloud infrastructure, content, admissions, online examinations, UGC/DEB reporting, student support and placements.',
    body,
    bodyClass: 'page-home',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: config.company.name,
        legalName: config.company.legalName,
        ...(config.siteUrl ? { url: config.siteUrl, logo: `${config.siteUrl}/assets/img/logo.svg` } : {}),
        sameAs: ['youtube', 'linkedin', 'facebook', 'instagram'].map((k) => config.links[k]).filter(Boolean),
      },
    ],
  };
}
