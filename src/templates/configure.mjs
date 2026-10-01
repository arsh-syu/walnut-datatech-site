import { areas, stages, models, goals } from '../data/services.mjs';
import { icon } from './icons.mjs';
import { enquiryForm, mark } from './layout.mjs';

// The configurator is an app: the shell is rendered here, the steps are rendered client-side
// from the same service data (embedded below as JSON) by assets/js/configure.js.
export default function configure({ root }) {
  const data = {
    stages,
    goals,
    models,
    areas: areas.map(({ slug, stage, name, short, tagline, items }) => ({ slug, stage, name, short, tagline, items })),
  };
  const icons = Object.fromEntries([...areas.map((a) => a.slug), 'check', 'chevron', 'arrow'].map((n) => [n, icon(n)]));
  const steps = ['Goal', 'Services', 'Modules', 'Engagement', 'Review'];

  const body = `
<section class="cfg" data-configurator>
  <div class="wrap">
    <ol class="cfg-progress" aria-label="Steps">
      ${steps.map((s, i) => `<li><button type="button" data-goto="${i}"${i === 0 ? ' aria-current="step"' : ' disabled'}><span class="cfg-progress-n">${i + 1}</span><span class="cfg-progress-label">${s}</span></button></li>`).join('')}
    </ol>
    <header class="cfg-head">
      <p class="eyebrow">Build your solution</p>
      <h1 class="title" id="cfg-title" tabindex="-1">What would you like to do?</h1>
      <p class="lede" id="cfg-sub">Pick a starting point. You can change everything in the next steps.</p>
    </header>
    <div class="cfg-layout">
      <div class="cfg-main">
        <div class="cfg-step" id="cfg-step"></div>
        <div class="cfg-form" id="cfg-form" hidden>
          <h2 class="cfg-form-title">Where should we send your proposal?</h2>
          ${enquiryForm({ id: 'cfg', topic: 'Solution configuration', root, submit: 'Request a consultation', messageLabel: 'Anything else we should know?' })}
        </div>
        <div class="cfg-nav" id="cfg-nav">
          <button class="btn btn-ghost" type="button" data-back hidden><span>Back</span></button>
          <p class="cfg-hint" id="cfg-hint" role="status"></p>
          <button class="btn btn-primary btn-lg" type="button" data-next><span>Continue</span>${icon('arrow')}</button>
        </div>
      </div>
      <aside class="cfg-summary" id="cfg-summary" aria-label="Your solution"></aside>
    </div>
    <noscript><p class="cfg-noscript">The solution builder needs JavaScript. You can still <a href="${root}contact/">send us an enquiry</a> or <a href="${root}solutions/">browse all solutions</a>.</p></noscript>
  </div>
  <div class="cfg-done" id="cfg-done" hidden tabindex="-1">
    ${mark('cfg-done-mark')}
    <h2 class="title">Your solution is on its way to us.</h2>
    <p class="lede">Thank you. Our team will review your configuration and get back to you with a proposal.</p>
    <div class="actions center">
      <a class="btn btn-primary btn-lg" href="${root || './'}"><span>Back to home</span></a>
      <button class="btn btn-ghost btn-lg" type="button" data-restart><span>Start a new configuration</span></button>
    </div>
  </div>
</section>
<script type="application/json" id="cfg-data">${JSON.stringify({ data, icons }).replace(/</g, '\\u003c')}</script>
`;

  return {
    title: 'Build your solution',
    description: 'Configure the services your university needs for its online programmes — choose service areas, select modules, pick an engagement model and request a consultation.',
    body,
    bodyClass: 'page-configure',
    scripts: ['configure.js'],
    stickyCta: false,
  };
}
