import config from '../../site.config.mjs';
import { areas, stages } from '../data/services.mjs';
import { audiences, externalApps } from '../data/site.mjs';
import { courses } from '../data/courses.mjs';
import { icon } from './icons.mjs';
import { vignette } from './vignettes.mjs';
import { button, mark, splitWords, sectionHead, videoTile, ctaBand, esc } from './layout.mjs';
import { journeySteps, courseCard, appLauncher } from './blocks.mjs';

// Interactive service showcase: a tab list of all service areas, grouped by lifecycle stage.
export function showcase(root) {
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
            <h4>${a.name}</h4>
            <p>${a.tagline}</p>
          </div>
          <a class="link-arrow" href="${root}solutions/${a.slug}/"><span>Explore<span class="sr-only"> ${a.name}</span></span>${icon('arrow')}</a>
        </div>
      </div>`;
    })
    .join('');

  return `<div class="showcase" data-showcase>
    <div class="showcase-rail" role="tablist" aria-label="Service areas">${rail}</div>
    <div class="showcase-stage">${panels}</div>
  </div>`;
}

// What each audience sees after choosing "What brings you to Walnut?"
function audienceBody(root, id) {
  const moduleCount = areas.reduce((t, a) => t + a.items.length, 0);
  if (id === 'universities') {
    return `${showcase(root)}
      <p class="showcase-foot">${areas.length} service areas · ${moduleCount} modules</p>
      <div class="actions center">
        ${button({ href: `${root}solutions/`, label: 'Explore all solutions', size: 'lg', arrow: true })}
        ${button({ href: `${root}configure/`, label: 'Build your solution', variant: 'ghost', size: 'lg' })}
      </div>`;
  }
  if (id === 'learners') {
    return `<div class="course-grid">${courses.map((c, i) => courseCard(root, c, i)).join('')}</div>
      <div class="actions center">
        ${button({ href: `${root}academy/`, label: 'See all courses', variant: 'ghost', size: 'lg', arrow: true })}
      </div>`;
  }
  return `<div class="app-preview">
      ${externalApps.map((app) => `<div class="app-preview-item"><span class="app-ico">${icon(app.icon)}</span><div><p class="app-name">${app.name}</p><p class="app-desc">${app.desc}</p></div></div>`).join('')}
    </div>
    <div class="actions center">
      ${button({ href: '#apps', label: 'Open an application', size: 'lg', arrow: true })}
      ${button({ href: `${root}partners/`, label: 'How the partnership works', variant: 'ghost', size: 'lg' })}
    </div>`;
}

export default function home({ root }) {
  const body = `
<section class="hero">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap hero-in">
    ${mark('hero-mark')}
    <p class="eyebrow hero-fade" style="--d:.5s">Technology · Learning · Partnerships</p>
    <h1 class="display">${splitWords('The technology ecosystem behind online education.')}</h1>
    <p class="lede hero-fade" style="--d:.75s">Walnut Data Tech runs online programmes for universities, teaches career skills through short courses, and gives education agents the tools to grow.</p>
    <div class="actions center hero-fade" style="--d:.9s">
      ${button({ href: '#start', label: 'Find your path', size: 'lg', arrow: true })}
      <button class="btn btn-ghost btn-lg" type="button" data-video="${esc(config.videos.company)}" data-video-title="Walnut Data Tech — company film">${icon('play')}<span>Watch the film</span></button>
    </div>
  </div>
</section>

<section class="start" id="start">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'Start here', title: 'What brings you to Walnut?', center: true })}
    <div class="audience" data-tabs data-remember="walnut-audience">
      <div class="audience-tabs" role="tablist" aria-label="Choose what describes you">
        ${audiences
          .map(
            (a, i) => `<button class="audience-tab${i === 0 ? ' is-active' : ''}" type="button" role="tab" id="aud-tab-${a.id}" aria-controls="aud-${a.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-tab="${a.id}">
          <span class="audience-top"><span class="audience-ico">${icon(a.icon)}</span><span class="check-badge" aria-hidden="true">${icon('check')}</span></span>
          <span class="audience-who">${a.who}</span>
          <span class="audience-title">${a.title}</span>
        </button>`
          )
          .join('\n        ')}
      </div>
      ${audiences
        .map(
          (a, i) => `<div class="audience-panel${i === 0 ? ' is-active' : ''}" role="tabpanel" id="aud-${a.id}" aria-labelledby="aud-tab-${a.id}" tabindex="-1">
        <div class="audience-intro">
          <div>
            <h3>${a.title}</h3>
            <p>${a.line}</p>
          </div>
          ${journeySteps(a.steps)}
        </div>
        ${audienceBody(root, a.id)}
      </div>`
        )
        .join('\n      ')}
    </div>
  </div>
</section>

<section class="section" id="film">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'The film', title: 'See how it all comes together.', text: 'A short walkthrough of what Walnut Data Tech does, and who we do it for.', center: true })}
    ${videoTile({ title: 'How Walnut Data Tech works', kicker: 'Company film', url: config.videos.company, cls: 'video-tile-xl' })}
  </div>
</section>

<section class="section section-dark" id="apps">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'Walnut applications', title: 'Already working with us? Open your application.', text: 'Pick the tool you need and jump straight in.' })}
    <div data-reveal>${appLauncher('home-app')}</div>
  </div>
</section>

${ctaBand(root, {
  title: 'Not sure where you fit?',
  text: 'Tell us what you’re trying to do and we’ll point you in the right direction.',
  actions: [
    { href: `${root}contact/`, label: 'Talk to us' },
    { href: '#start', label: 'Choose your path' },
  ],
})}
`;

  return {
    title: 'Walnut Data Tech — Technology, courses and partnerships for online education',
    description:
      'Walnut Data Tech powers online education: technology and services for universities, short certification courses for learners, and applications for education agents and partners.',
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
