import { areas, stages, models, goals } from '../data/services.mjs';
import { questionsFor } from '../data/questions.mjs';
import { icon } from './icons.mjs';
import { mark, accountPrompt } from './layout.mjs';

// The university empanelment request is an app: the shell is rendered here, the steps are rendered
// client-side from the same service and question data (embedded below as JSON) by assets/js/configure.js.
export default function configure({ root }) {
  const data = {
    stages,
    goals,
    models,
    areas: areas.map(({ slug, stage, name, short, tagline, items }) => ({ slug, stage, name, short, tagline, items })),
    questions: questionsFor('university'),
  };
  const icons = Object.fromEntries([...areas.map((a) => a.slug), 'check', 'chevron', 'arrow'].map((n) => [n, icon(n)]));
  const steps = ['Goal', 'Services', 'Modules', 'Engagement', 'Requirements', 'University', 'Review'];

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
          <h2 class="cfg-form-title">Ready to submit?</h2>
          <p class="cfg-form-text">Your request goes to the Walnut team for review. We reply to the official email address you gave, and supporting documents are collected securely once the request is approved.</p>
          <input class="hp" type="checkbox" name="botcheck" tabindex="-1" autocomplete="off" aria-hidden="true">
          <div class="form-foot">
            <button class="btn btn-primary btn-lg" type="button" data-submit><span>Submit university request</span>${icon('arrow')}</button>
            <p class="form-note">We use these details only to review and respond to your request. See our <a href="${root}privacy/">privacy policy</a> and <a href="${root}terms/">terms</a>.</p>
          </div>
          <p class="form-status" id="cfg-status" role="alert"></p>
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
    <h2 class="title" id="cfg-done-title">Request submitted successfully</h2>
    <p class="lede" id="cfg-done-text">Your university empanelment request has been submitted successfully.</p>
    <div class="cfg-ref" id="cfg-ref-box" hidden>
      <span class="cfg-ref-label">Request ID</span>
      <strong class="cfg-ref-value" id="cfg-ref"></strong>
      <button class="text-btn" type="button" data-copy>Copy</button>
    </div>
    <p class="cfg-done-note">Our team will review your request and communicate with you on your registered email address.</p>
    <p class="cfg-done-note" id="cfg-done-keep" hidden>Please keep your Request ID for future reference.</p>
    ${accountPrompt(root, 'university', 'Create an account with the same official email to follow this request.')}
    <div class="actions center">
      <a class="btn btn-primary btn-lg" href="${root || './'}"><span>Back to Walnut Data Tech</span></a>
      <a class="btn btn-ghost btn-lg" id="cfg-done-status" href="${root}request-status/" hidden><span>Check request status</span></a>
    </div>
  </div>
</section>
<script type="application/json" id="cfg-data">${JSON.stringify({ data, icons }).replace(/</g, '\\u003c')}</script>
`;

  return {
    title: 'Build your solution',
    description: 'Request empanelment with Walnut Data Tech: choose the services your university needs for its online programmes, tell us your requirements and submit your request.',
    body,
    bodyClass: 'page-configure',
    scripts: ['configure.js'],
  };
}
