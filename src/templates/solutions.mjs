import config from '../../site.config.mjs';
import { areas, stages, models, journey } from '../data/services.mjs';
import { compliancePoints } from '../data/site.mjs';
import { icon } from './icons.mjs';
import { vignette } from './vignettes.mjs';
import { button, splitWords, sectionHead, videoTile, ctaBand } from './layout.mjs';

const stageOf = (a) => stages.find((s) => s.id === a.stage);

/* ---------- /solutions/ ---------- */

export function solutionsIndex({ root }) {
  const moduleCount = areas.reduce((t, a) => t + a.items.length, 0);

  const stageSections = stages
    .map((s) => {
      const rows = areas
        .filter((a) => a.stage === s.id)
        .map((a) => {
          const more = a.items.length - 3;
          return `<article class="area-card spot" data-reveal>
          <div class="area-card-text">
            <span class="area-ico">${icon(a.slug)}</span>
            <h3><a href="${root}solutions/${a.slug}/">${a.name}</a></h3>
            <p class="area-tagline">${a.tagline}</p>
            <ul class="area-points">
              ${a.items.slice(0, 3).map((it) => `<li>${icon('check')}${it.title}</li>`).join('')}
              ${more > 0 ? `<li class="more">+ ${more} more</li>` : ''}
            </ul>
            <div class="actions">
              ${button({ href: `${root}solutions/${a.slug}/`, label: 'Explore', variant: 'primary', size: 'sm', arrow: true, attrs: `aria-label="Explore ${a.name}"` })}
              <a class="btn btn-ghost btn-sm" href="${root}configure/?add=${a.slug}" aria-label="Add ${a.name} to my solution">${icon('plus')}<span>Add to my solution</span></a>
            </div>
          </div>
          <div class="area-card-visual" aria-hidden="true">${vignette(a.slug, a.name)}</div>
        </article>`;
        })
        .join('\n');
      return `<section class="stage" id="${s.id}" aria-labelledby="stage-${s.id}">
      <div class="wrap stage-grid">
        <header class="stage-head" data-reveal>
          <p class="stage-n">${s.n}</p>
          <h2 id="stage-${s.id}">${s.name}</h2>
          <p>${s.line}</p>
        </header>
        <div class="stage-areas">${rows}</div>
      </div>
    </section>`;
    })
    .join('\n');

  const body = `
<section class="page-hero">
  <div class="wrap">
    <p class="eyebrow hero-fade">For universities and institutions</p>
    <h1 class="display display-md">${splitWords('One partner for the whole programme lifecycle.')}</h1>
    <p class="lede hero-fade" style="--d:.5s">${areas.length} service areas and ${moduleCount} modules, organised around how an online programme actually runs. Take one — or take them all.</p>
    <nav class="stage-nav hero-fade" style="--d:.65s" aria-label="Lifecycle stages">
      ${stages.map((s) => `<a href="#${s.id}"><span>${s.n}</span>${s.name}</a>`).join('')}
    </nav>
  </div>
</section>
${stageSections}

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
    ${sectionHead({ eyebrow: 'Regulation-ready', title: 'Built around UGC and DEB requirements.', text: 'Where regulation applies, the services are delivered in line with it.' })}
    <div class="facts">
      ${compliancePoints.map((p, i) => `<div class="fact" data-reveal style="--d:${i * 0.08}s"><h3>${p.label}</h3><p>${p.text}</p></div>`).join('\n      ')}
    </div>
    <a class="link-arrow" href="${root}solutions/compliance/" data-reveal><span>Reporting &amp; regulatory support</span>${icon('arrow')}</a>
  </div>
</section>

<div class="section-gap"></div>
${ctaBand(root, { title: 'Not sure where to start?', text: 'Tell us your goal and we’ll suggest the right services — you stay in control of every choice.' })}
`;

  return {
    title: 'Solutions for universities',
    description: `Explore Walnut Data Tech's ${areas.length} service areas for university online programmes — from infrastructure and content to admissions, examinations, compliance, student support and placements.`,
    body,
    bodyClass: 'page-solutions',
    sticky: { href: `${root}configure/`, label: 'Build your solution' },
  };
}

/* ---------- /solutions/<slug>/ ---------- */

export function servicePage({ root }, a) {
  const stage = stageOf(a);
  const idx = areas.indexOf(a);
  const prev = areas[(idx - 1 + areas.length) % areas.length];
  const next = areas[(idx + 1) % areas.length];
  const videoUrl = config.videos.services[a.slug] || '';
  // The tutorial section only exists once this service's video URL is set.
  const tutorial = videoUrl
    ? `<section class="section" id="tutorial">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'Tutorial', title: `See ${a.short} in action.`, center: true })}
    ${videoTile({ title: `${a.name} — tutorial`, kicker: 'Tutorial video', url: videoUrl, cls: 'video-tile-xl' })}
  </div>
</section>`
    : '<div class="section-gap"></div>';

  const body = `
<section class="svc-hero">
  <div class="wrap svc-hero-grid">
    <div class="svc-hero-text">
      <nav class="crumbs hero-fade" aria-label="Breadcrumb">
        <a href="${root}solutions/">Solutions</a><span aria-hidden="true">/</span><a href="${root}solutions/#${stage.id}">${stage.n} ${stage.name}</a>
      </nav>
      <h1 class="display display-sm">${splitWords(a.name)}</h1>
      <p class="svc-tagline hero-fade" style="--d:.45s">${a.tagline}</p>
      <p class="lede hero-fade" style="--d:.55s">${a.summary}</p>
      <div class="actions hero-fade" style="--d:.7s">
        ${button({ href: `${root}configure/?add=${a.slug}`, label: 'Add to my solution', size: 'lg', arrow: true })}
        ${videoUrl ? `<a class="btn btn-ghost btn-lg" href="#tutorial">${icon('play')}<span>Watch the tutorial</span></a>` : ''}
      </div>
    </div>
    <div class="svc-hero-visual hero-fade" style="--d:.3s">${vignette(a.slug, a.name)}</div>
  </div>
</section>

<nav class="subnav" aria-label="On this page" data-subnav>
  <div class="wrap subnav-in">
    <span class="subnav-title">${a.short}</span>
    <ul>
      <li><a href="#capabilities">What’s included</a></li>
      <li><a href="#engagement">Pricing</a></li>
      ${videoUrl ? '<li><a href="#tutorial">Tutorial</a></li>' : ''}
    </ul>
    ${button({ href: `${root}configure/?add=${a.slug}`, label: 'Add to my solution', variant: 'accent', size: 'sm' })}
  </div>
</nav>

<section class="section" id="capabilities">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'What’s included', title: `${a.items.length} modules. Take them all, or only what you need.` })}
    <ol class="caps">
      ${a.items
        .map(
          (it, i) => `<li class="cap" data-reveal style="--d:${(i % 2) * 0.08}s">
        <span class="cap-n">${String(i + 1).padStart(2, '0')}</span>
        <div><h3>${it.title}</h3><p>${it.desc}</p></div>
      </li>`
        )
        .join('\n      ')}
    </ol>
  </div>
</section>

<section class="section section-mist" id="engagement">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'Pricing', title: 'Priced the way that suits you.', text: `Select ${a.short} modules under either model. Your proposal sets out the detail.` })}
    <div class="models models-compact">
      ${models
        .map(
          (m, i) => `<article class="model-card" data-reveal style="--d:${i * 0.1}s">
        <h3>${m.name}</h3>
        <p class="model-line">${m.line}</p>
        <p>${m.desc}</p>
      </article>`
        )
        .join('\n      ')}
    </div>
    <div class="actions" data-reveal>
      ${button({ href: `${root}configure/?add=${a.slug}`, label: 'Select your modules', variant: 'accent', size: 'lg', arrow: true })}
    </div>
  </div>
</section>

${tutorial}

<nav class="svc-next" aria-label="More solutions">
  <div class="wrap svc-next-grid">
    <a class="svc-next-link prev" href="${root}solutions/${prev.slug}/">${icon('arrow')}<span><small>Previous</small>${prev.name}</span></a>
    <a class="svc-next-link next" href="${root}solutions/${next.slug}/"><span><small>Next</small>${next.name}</span>${icon('arrow')}</a>
  </div>
</nav>

${ctaBand(root, { title: `Add ${a.short} to your solution.`, text: 'Pick the modules you need, choose how you’d like to engage, and send us your configuration.' })}
`;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: a.name,
      description: a.summary,
      provider: { '@type': 'Organization', name: config.company.name },
      audience: { '@type': 'EducationalAudience', educationalRole: 'University' },
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: `${a.name} modules`,
        itemListElement: a.items.map((it) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: it.title, description: it.desc } })),
      },
    },
  ];
  if (config.siteUrl) {
    jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Solutions', item: `${config.siteUrl}/solutions/` },
        { '@type': 'ListItem', position: 2, name: a.name, item: `${config.siteUrl}/solutions/${a.slug}/` },
      ],
    });
  }

  return {
    title: a.name,
    description: a.summary,
    body,
    bodyClass: 'page-service',
    sticky: { href: `${root}configure/?add=${a.slug}`, label: 'Add to my solution' },
    jsonLd,
  };
}
