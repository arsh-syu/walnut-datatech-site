// Solution configurator: Goal → Services → Modules → Engagement → Review.
// State lives in one object, is saved to sessionStorage, and every view is derived from it.

const { data, icons } = JSON.parse(document.getElementById('cfg-data').textContent);
const root = document.querySelector('[data-configurator]');
const $ = (sel) => root.querySelector(sel);
const el = {
  step: $('#cfg-step'),
  head: $('.cfg-head'),
  title: $('#cfg-title'),
  sub: $('#cfg-sub'),
  layout: $('.cfg-layout'),
  summary: $('#cfg-summary'),
  form: $('#cfg-form'),
  hint: $('#cfg-hint'),
  back: $('[data-back]'),
  next: $('[data-next]'),
  done: $('#cfg-done'),
  progress: [...root.querySelectorAll('[data-goto]')],
};

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const STORAGE_KEY = 'walnut-solution-v1';
const areaBy = Object.fromEntries(data.areas.map((a) => [a.slug, a]));
const modelBy = Object.fromEntries(data.models.map((m) => [m.id, m]));
const ADVISE = 'advise';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const check = `<span class="check-badge" aria-hidden="true">${icons.check}</span>`;

/* ---------- state ---------- */

const fresh = () => ({ step: 0, maxStep: 0, goal: null, areas: [], items: {}, model: null, areaModel: {} });

// Saved state comes back from the browser, so it is rebuilt field by field rather than trusted.
function load() {
  const state = fresh();
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== 'object') return state;
    const models = data.models.map((m) => m.id);
    state.areas = (Array.isArray(saved.areas) ? saved.areas : []).filter((s) => areaBy[s]);
    for (const slug of state.areas) {
      const ids = areaBy[slug].items.map((it) => it.id);
      const picked = Array.isArray(saved.items?.[slug]) ? saved.items[slug] : ids;
      state.items[slug] = ids.filter((id) => picked.includes(id));
      if (models.includes(saved.areaModel?.[slug])) state.areaModel[slug] = saved.areaModel[slug];
    }
    if (data.goals.some((g) => g.id === saved.goal)) state.goal = saved.goal;
    if ([...models, ADVISE].includes(saved.model)) state.model = saved.model;
    const clampStep = (n) => (Number.isInteger(n) && n >= 0 && n <= 4 ? n : 0);
    state.step = clampStep(saved.step);
    state.maxStep = Math.max(state.step, clampStep(saved.maxStep));
  } catch {}
  return state;
}
function save() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

let state = load();

function setAreas(slugs) {
  state.areas = data.areas.map((a) => a.slug).filter((s) => slugs.includes(s)); // keep catalogue order
  for (const slug of state.areas) state.items[slug] ??= areaBy[slug].items.map((it) => it.id);
}
const modelOf = (slug) => (state.model === ADVISE || !state.model ? state.model : state.areaModel[slug] || state.model);
const modelName = (id) => (id === ADVISE ? 'To be advised' : modelBy[id]?.name ?? '—');
const selectedCount = (slug) => state.items[slug]?.length ?? 0;
const totalModules = () => state.areas.reduce((t, s) => t + selectedCount(s), 0);

function engagementLabel() {
  if (!state.model) return '—';
  if (state.model === ADVISE) return modelName(ADVISE);
  const used = new Set(state.areas.map(modelOf));
  return used.size > 1 ? 'Mixed' : modelName(state.model);
}

// Totals appear only once pricing has been filled in for every selected module (see src/data/services.mjs).
function estimate() {
  let pct = 0;
  let price = 0;
  if (!state.areas.length || !state.model || state.model === ADVISE) return null;
  for (const slug of state.areas) {
    const model = modelOf(slug);
    for (const it of areaBy[slug].items) {
      if (!state.items[slug].includes(it.id)) continue;
      const value = model === 'revenue' ? it.revSharePct : it.oneTimePrice;
      if (value == null) return null;
      if (model === 'revenue') pct += value;
      else price += value;
    }
  }
  return [pct && `${pct}% revenue share`, price && `₹${price.toLocaleString('en-IN')} one-time`].filter(Boolean).join(' + ') || null;
}

/* ---------- steps ---------- */

const steps = [
  {
    title: 'What would you like to do?',
    sub: 'Pick a starting point. You can change everything in the next steps.',
    render: renderGoal,
    problem: () => (state.goal ? '' : 'Choose a starting point to continue.'),
  },
  {
    title: 'Choose your services.',
    sub: 'Select every service area you need. They follow the life of an online programme.',
    render: renderAreas,
    problem: () => (state.areas.length ? '' : 'Select at least one service to continue.'),
  },
  {
    title: 'Fine-tune the modules.',
    sub: 'Everything is included by default. Untick anything you don’t need.',
    render: renderModules,
    problem: () => {
      const empty = state.areas.find((s) => selectedCount(s) === 0);
      return empty ? `Select at least one ${areaBy[empty].short} module, or go back and remove the service.` : '';
    },
  },
  {
    title: 'How would you like to engage?',
    sub: 'Choose one model for everything — or set it service by service.',
    render: renderModel,
    problem: () => (state.model ? '' : 'Choose an engagement model to continue.'),
  },
  {
    title: 'Review your solution.',
    sub: 'Check the details, then tell us where to send your proposal.',
    render: renderReview,
    problem: () => '',
  },
];

function renderGoal() {
  el.step.innerHTML = `<div class="opts opts-lg opts-goal" role="radiogroup" aria-labelledby="cfg-title">${data.goals
    .map(
      (g) => `<label class="opt">
      <input class="sr-only" type="radio" name="goal" value="${g.id}"${state.goal === g.id ? ' checked' : ''}>
      <span class="opt-top">${check}</span>
      <span class="opt-name">${esc(g.name)}</span>
      <span class="opt-desc">${esc(g.desc)}</span>
      <span class="opt-meta">${g.areas.length ? plural(g.areas.length, 'service') + ' pre-selected' : 'Nothing pre-selected'}</span>
    </label>`
    )
    .join('')}</div>`;
}

function renderAreas() {
  el.step.innerHTML =
    `<div class="cfg-tools"><button class="text-btn" type="button" data-areas="all">Select all</button><button class="text-btn" type="button" data-areas="none">Clear</button></div>` +
    data.stages
      .map(
        (s) => `<fieldset class="cfg-group">
      <legend><span>${s.n}</span>${esc(s.name)}<small>${esc(s.line)}</small></legend>
      <div class="opts opts-area">${data.areas
        .filter((a) => a.stage === s.id)
        .map(
          (a) => `<label class="opt">
          <input class="sr-only" type="checkbox" name="area" value="${a.slug}"${state.areas.includes(a.slug) ? ' checked' : ''}>
          <span class="opt-top"><span class="opt-ico">${icons[a.slug]}</span>${check}</span>
          <span class="opt-name">${esc(a.name)}</span>
          <span class="opt-desc">${esc(a.tagline)}</span>
          <span class="opt-meta">${plural(a.items.length, 'module')}</span>
        </label>`
        )
        .join('')}</div>
    </fieldset>`
      )
      .join('');
}

const countLabel = (slug) => `${selectedCount(slug)} of ${areaBy[slug].items.length}`;

function renderModules() {
  el.step.innerHTML = state.areas
    .map((slug, i) => {
      const a = areaBy[slug];
      const open = i === 0;
      return `<section class="acc${open ? ' is-open' : ''}" data-acc="${slug}">
      <h2 style="margin:0;font:inherit"><button class="acc-btn" type="button" aria-expanded="${open}" aria-controls="acc-${slug}">
        <span class="opt-ico">${icons[slug]}</span>
        <span class="acc-name">${esc(a.name)}</span>
        <span class="acc-count" data-count="${slug}">${countLabel(slug)}</span>
        ${icons.chevron}
      </button></h2>
      <div class="acc-panel" id="acc-${slug}"${open ? '' : ' inert'}><div class="acc-inner"><div class="acc-body">
        <div class="acc-tools"><button class="text-btn" type="button" data-all="${slug}">Select all</button><button class="text-btn" type="button" data-none="${slug}">Clear</button></div>
        ${a.items
          .map(
            (it) => `<label class="mod">
          <input class="sr-only" type="checkbox" data-item="${slug}:${it.id}"${state.items[slug].includes(it.id) ? ' checked' : ''}>
          <span class="mod-box" aria-hidden="true">${icons.check}</span>
          <span class="mod-text"><span class="mod-title">${esc(it.title)}</span><span class="mod-desc">${esc(it.desc)}</span></span>
        </label>`
          )
          .join('')}
      </div></div></div>
    </section>`;
    })
    .join('');
  state.areas.forEach(updateCount);
}

function updateCount(slug) {
  const badge = el.step.querySelector(`[data-count="${slug}"]`);
  if (!badge) return;
  badge.textContent = countLabel(slug);
  badge.classList.toggle('is-partial', selectedCount(slug) !== areaBy[slug].items.length);
}

function renderModel() {
  const options = [
    ...data.models,
    { id: ADVISE, name: 'Not sure yet', line: 'Help me decide.', desc: 'We’ll recommend a model for each service in your proposal.' },
  ];
  el.step.innerHTML = `<div class="opts opts-lg" role="radiogroup" aria-labelledby="cfg-title">${options
    .map(
      (m) => `<label class="opt">
      <input class="sr-only" type="radio" name="model" value="${m.id}"${state.model === m.id ? ' checked' : ''}>
      <span class="opt-top"><span class="opt-meta" style="margin:0;padding:0">${esc(m.line)}</span>${check}</span>
      <span class="opt-name">${esc(m.name)}</span>
      <span class="opt-desc">${esc(m.desc)}</span>
    </label>`
    )
    .join('')}</div><div class="per-area" id="per-area"></div>`;
  renderPerArea();
}

function renderPerArea() {
  const box = el.step.querySelector('#per-area');
  if (!box) return;
  const show = state.model && state.model !== ADVISE && state.areas.length > 1;
  box.hidden = !show;
  if (!show) return;
  box.innerHTML = `<h2>Set it per service</h2><p>Optional. Every service follows your choice above unless you change it here.</p>${state.areas
    .map(
      (slug) => `<div class="per-row"><span>${esc(areaBy[slug].name)}</span>
      <span class="seg" role="radiogroup" aria-label="Engagement model for ${esc(areaBy[slug].name)}">${data.models
        .map((m) => `<label><input class="sr-only" type="radio" name="am-${slug}" value="${m.id}" data-area-model="${slug}"${modelOf(slug) === m.id ? ' checked' : ''}><span>${esc(m.name)}</span></label>`)
        .join('')}</span></div>`
    )
    .join('')}`;
}

function renderReview() {
  el.step.innerHTML = `<div class="review">${state.areas
    .map((slug) => {
      const a = areaBy[slug];
      const chosen = a.items.filter((it) => state.items[slug].includes(it.id));
      return `<article class="review-item">
      <header>
        <span class="opt-ico">${icons[slug]}</span>
        <h2>${esc(a.name)}</h2>
        <span class="chip">${esc(modelName(modelOf(slug)))}</span>
        <button class="text-btn" type="button" data-goto="2" aria-label="Edit ${esc(a.name)} modules">Edit</button>
      </header>
      <ul class="review-mods">${chosen.map((it) => `<li>${icons.check}<span>${esc(it.title)}</span></li>`).join('')}</ul>
    </article>`;
    })
    .join('')}</div>`;
}

/* ---------- summary ---------- */

let lastTotals = '';

function renderSummary() {
  const totals = [
    ['Services', state.areas.length],
    ['Modules', totalModules()],
    ['Engagement', engagementLabel()],
  ];
  const price = estimate();
  const signature = JSON.stringify(totals);
  const previous = lastTotals ? JSON.parse(lastTotals) : [];

  el.summary.innerHTML = `<h2>Your solution</h2>
    ${
      state.areas.length
        ? `<ul class="sum-list">${state.areas
            .map((slug) => `<li><span class="sum-ico">${icons[slug]}</span><span class="sum-name">${esc(areaBy[slug].short)}</span><span class="sum-count">${countLabel(slug)}</span></li>`)
            .join('')}</ul>`
        : '<p class="sum-empty">Nothing selected yet. Your services will appear here.</p>'
    }
    <dl class="sum-totals">
      ${totals.map(([k, v], i) => `<div><dt>${k}</dt><dd${previous[i] && previous[i][1] !== v ? ' class="bump"' : ''}>${esc(v)}</dd></div>`).join('')}
      <div><dt>Estimate</dt><dd>${price ? esc(price) : 'In your proposal'}</dd></div>
    </dl>
    ${price ? '' : '<p class="sum-note">Pricing depends on your programmes and is set out in your proposal.</p>'}`;
  lastTotals = signature;
}

function configurationText() {
  const goal = data.goals.find((g) => g.id === state.goal);
  const lines = [`Goal: ${goal?.name ?? '—'}`, `Engagement: ${engagementLabel()}`, `Services: ${state.areas.length}, modules: ${totalModules()}`];
  const price = estimate();
  if (price) lines.push(`Estimate: ${price}`);
  for (const slug of state.areas) {
    const a = areaBy[slug];
    lines.push('', `${a.name} — ${modelName(modelOf(slug))} (${countLabel(slug)} modules)`);
    for (const it of a.items) if (state.items[slug].includes(it.id)) lines.push(`  • ${it.title}`);
  }
  return lines.join('\n');
}

/* ---------- navigation ---------- */

function firstProblem(upTo) {
  for (let i = 0; i < upTo; i++) {
    const problem = steps[i].problem();
    if (problem) return { step: i, problem };
  }
  return null;
}

function setHint(text = '', isError = false) {
  el.hint.classList.remove('is-error');
  if (isError) {
    void el.hint.offsetWidth;
    el.hint.classList.add('is-error');
  }
  el.hint.textContent = text;
}

function defaultHint() {
  if (state.step === 0 || !state.areas.length) return '';
  return `${plural(state.areas.length, 'service')} · ${plural(totalModules(), 'module')}`;
}

function paint(direction = 1, focus = false) {
  const step = steps[state.step];
  el.step.classList.toggle('is-back', direction < 0);
  step.render();
  el.title.textContent = step.title;
  el.sub.textContent = step.sub;
  el.layout.classList.toggle('is-wide', state.step === 0);
  el.form.hidden = state.step !== steps.length - 1;
  el.next.hidden = state.step === steps.length - 1;
  el.back.hidden = state.step === 0;
  el.progress.forEach((btn, i) => {
    btn.disabled = i > state.maxStep;
    btn.classList.toggle('is-done', i < state.step);
    if (i === state.step) btn.setAttribute('aria-current', 'step');
    else btn.removeAttribute('aria-current');
  });
  setHint(defaultHint());
  renderSummary();
  save();

  el.step.classList.remove('is-leaving');
  el.step.classList.add('is-entering');
  el.head.classList.remove('is-swapping');
  void el.head.offsetWidth;
  el.head.classList.add('is-swapping');
  if (focus) {
    const top = root.getBoundingClientRect().top + scrollY - 70;
    if (scrollY > top) scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    el.title.focus({ preventScroll: true });
  }
}

function go(target) {
  if (target === state.step) return;
  if (target > state.step) {
    const blocked = firstProblem(target);
    if (blocked) {
      if (blocked.step !== state.step) {
        state.step = blocked.step;
        paint(-1, true);
      }
      return setHint(blocked.problem, true);
    }
  }
  const direction = target > state.step ? 1 : -1;
  state.step = target;
  state.maxStep = Math.max(state.maxStep, target);
  el.step.classList.toggle('is-back', direction < 0);
  el.step.classList.remove('is-entering');
  el.step.classList.add('is-leaving');
  setTimeout(() => paint(direction, true), reduceMotion ? 0 : 200);
}

/* ---------- events ---------- */

el.next.addEventListener('click', () => go(state.step + 1));
el.back.addEventListener('click', () => go(state.step - 1));

root.addEventListener('click', (e) => {
  const jump = e.target.closest('[data-goto]');
  if (jump && !jump.disabled) return go(Number(jump.dataset.goto));

  const bulkAreas = e.target.closest('[data-areas]');
  if (bulkAreas) {
    setAreas(bulkAreas.dataset.areas === 'all' ? data.areas.map((a) => a.slug) : []);
    renderAreas();
    return refresh();
  }

  const all = e.target.closest('[data-all]');
  const none = e.target.closest('[data-none]');
  if (all || none) {
    const slug = (all || none).dataset[all ? 'all' : 'none'];
    state.items[slug] = all ? areaBy[slug].items.map((it) => it.id) : [];
    el.step.querySelectorAll(`[data-item^="${slug}:"]`).forEach((box) => (box.checked = Boolean(all)));
    updateCount(slug);
    return refresh();
  }

  const accBtn = e.target.closest('.acc-btn');
  if (accBtn) {
    const acc = accBtn.closest('.acc');
    const open = !acc.classList.contains('is-open');
    acc.classList.toggle('is-open', open);
    accBtn.setAttribute('aria-expanded', String(open));
    acc.querySelector('.acc-panel').inert = !open;
  }

  if (e.target.closest('[data-restart]')) {
    state = fresh();
    lastTotals = '';
    root.classList.remove('is-done');
    el.done.hidden = true;
    const form = el.form.querySelector('form');
    form.reset();
    form.hidden = false;
    el.form.querySelector('.form-success').hidden = true;
    paint(1, true);
  }
});

root.addEventListener('change', (e) => {
  const input = e.target;
  if (input.name === 'goal') {
    state.goal = input.value;
    setAreas(data.goals.find((g) => g.id === input.value).areas);
  } else if (input.name === 'area') {
    setAreas(input.checked ? [...state.areas, input.value] : state.areas.filter((s) => s !== input.value));
    if (!state.goal) state.goal = 'custom';
  } else if (input.dataset.item) {
    const [slug, id] = input.dataset.item.split(':');
    const set = new Set(state.items[slug]);
    input.checked ? set.add(id) : set.delete(id);
    state.items[slug] = areaBy[slug].items.map((it) => it.id).filter((x) => set.has(x));
    updateCount(slug);
  } else if (input.name === 'model') {
    state.model = input.value;
    state.areaModel = {};
    renderPerArea();
  } else if (input.dataset.areaModel) {
    state.areaModel[input.dataset.areaModel] = input.value;
  } else {
    return;
  }
  refresh();
});

function refresh() {
  setHint(defaultHint());
  renderSummary();
  save();
}

// Hand the configuration to the shared enquiry form, and celebrate once it is sent.
const form = el.form.querySelector('form');
form.addEventListener('enquiry:collect', (e) => {
  e.detail.extra.configuration = configurationText();
});
form.addEventListener('enquiry:sent', () => {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
  root.classList.add('is-done');
  el.done.hidden = false;
  scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  el.done.focus({ preventScroll: true });
});

/* ---------- start ---------- */

// Deep link from a service page: /configure/?add=<slug> adds that service and opens the Services step.
const add = new URLSearchParams(location.search).get('add');
if (add && areaBy[add]) {
  setAreas([...state.areas, add]);
  state.goal ??= 'custom';
  state.step = 1;
  state.maxStep = Math.max(state.maxStep, 1);
  history.replaceState(null, '', location.pathname);
}
if (firstProblem(state.step)) state.step = firstProblem(state.step).step;

paint();
