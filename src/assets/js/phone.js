// International mobile number field: a searchable country picker (flag + dialling code) beside the
// national number, validated per country and submitted as one E.164 value (+919876543210).
//
// Usage: mountPhone(input) on an <input type="tel" name="phone">. The visible input becomes the
// national number; a hidden input takes over the name and always holds the E.164 value, so forms
// and scripts that read `form.elements.phone` keep working. Pasting a full number (+44 7700 900123,
// 0091…) switches the country automatically. India (+91) is the default.

import { COUNTRIES } from './countries.js';

// Where several countries share a dialling code, the one a pasted number most likely means.
const PREFERRED = { 1: 'US', 7: 'RU', 39: 'IT', 44: 'GB', 47: 'NO', 61: 'AU', 970: 'PS' };
const DEFAULT_ALPHA2 = 'IN';
const byAlpha2 = (code) => COUNTRIES.find((c) => c.alpha2 === code) || COUNTRIES.find((c) => c.alpha2 === DEFAULT_ALPHA2);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Splits a pasted or typed value into { country, national } when it starts with + or 00.
function detect(raw) {
  const text = String(raw).trim().replace(/^00/, '+');
  if (!text.startsWith('+')) return null;
  const digits = text.slice(1).replace(/\D/g, '');
  for (let len = 4; len >= 1; len--) {
    const dial = digits.slice(0, len);
    const matches = COUNTRIES.filter((c) => c.dial === `+${dial}`);
    if (!matches.length) continue;
    const country = matches.find((c) => c.alpha2 === PREFERRED[dial]) || matches[0];
    return { country, national: digits.slice(len) };
  }
  return null;
}

// The national significant number: digits only, without the trunk prefix most countries use when
// dialling at home (the leading 0 of 098765 43210). Italy keeps its leading zero.
export const nationalDigits = (value, country) => {
  const digits = String(value).replace(/\D/g, '');
  return country.alpha2 === 'IT' ? digits : digits.replace(/^0+/, '');
};

// '' when the number is fine for the country, otherwise what to fix.
export function phoneProblem(value, country, { required = true } = {}) {
  const digits = nationalDigits(value, country);
  if (!digits) return required ? 'Please enter your mobile number.' : '';
  const [min, max] = country.nsn;
  // India: 10 digits. Mobiles start with 6–9; a landline with its STD code (020 2695 0000) also has 10.
  if (country.alpha2 === 'IN' && !/^[2-9]\d{9}$/.test(digits)) return 'An Indian number has 10 digits (mobile numbers start with 6, 7, 8 or 9).';
  if (digits.length < min || digits.length > max) {
    return `A ${country.name} number has ${min === max ? `${min} digits` : `${min} to ${max} digits`} after ${country.dial}.`;
  }
  return '';
}

export const toE164 = (value, country) => {
  const digits = nationalDigits(value, country);
  return digits ? `${country.dial}${digits}` : '';
};

export function mountPhone(input, { defaultAlpha2 = DEFAULT_ALPHA2, onChange } = {}) {
  if (!input || input.dataset.phoneMounted) return null;
  input.dataset.phoneMounted = '1';
  const required = input.required;
  const field = input.closest('.field') || input.parentElement;
  let country = byAlpha2(defaultAlpha2);

  // The hidden input inherits the name and carries the E.164 value; the visible one is the national number.
  const hidden = document.createElement('input');
  hidden.type = 'hidden';
  hidden.name = input.name;
  input.removeAttribute('name');
  input.setAttribute('inputmode', 'tel');
  input.setAttribute('autocomplete', 'tel-national');
  input.removeAttribute('pattern');
  if (!input.placeholder) input.placeholder = country.alpha2 === 'IN' ? '98765 43210' : 'Mobile number';

  const wrap = document.createElement('div');
  wrap.className = 'phone-field';
  wrap.dataset.phone = '';
  const picker = document.createElement('div');
  picker.className = 'phone-picker';
  const listId = `${input.id || hidden.name}-countries`;
  picker.innerHTML = `
    <button class="phone-country" type="button" aria-haspopup="listbox" aria-expanded="false" aria-controls="${esc(listId)}" aria-label="Country code"></button>
    <div class="phone-menu" hidden>
      <input class="phone-search" type="search" placeholder="Search country or code" aria-label="Search country" autocomplete="off" spellcheck="false">
      <ul class="phone-list" id="${esc(listId)}" role="listbox" tabindex="-1"></ul>
    </div>`;
  input.replaceWith(wrap);
  wrap.append(picker, input, hidden);
  const button = picker.querySelector('.phone-country');
  const menu = picker.querySelector('.phone-menu');
  const search = picker.querySelector('.phone-search');
  const list = picker.querySelector('.phone-list');

  const paint = () => {
    button.innerHTML = `<span class="phone-flag" aria-hidden="true">${country.flag}</span><span class="phone-dial">${esc(country.dial)}</span>`;
    button.setAttribute('aria-label', `Country code: ${country.name} ${country.dial}`);
    button.title = `${country.name} (${country.alpha3})`;
  };
  const sync = () => {
    const problem = phoneProblem(input.value, country, { required });
    input.setCustomValidity(problem);
    hidden.value = problem ? '' : toE164(input.value, country);
    hidden.dataset.alpha3 = country.alpha3;
    onChange?.({ e164: hidden.value, country, problem });
  };

  const options = (query = '') => {
    const q = query.trim().toLowerCase().replace(/^\+/, '');
    const found = COUNTRIES.filter((c) => !q || c.name.toLowerCase().includes(q) || c.alpha3.toLowerCase() === q || c.alpha2.toLowerCase() === q || c.dial.slice(1).startsWith(q));
    list.innerHTML = found.length
      ? found.map((c) => `<li class="phone-option" role="option" data-alpha2="${c.alpha2}" aria-selected="${c === country}"><span class="phone-flag" aria-hidden="true">${c.flag}</span><span class="phone-name">${esc(c.name)}</span><span class="phone-code">${esc(c.dial)}</span></li>`).join('')
      : '<li class="phone-note" role="presentation">No country matches. Try the name or the dialling code.</li>';
  };
  const open = () => {
    options();
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    // Open upward when there is more room above than below (never clipped off-screen).
    const rect = picker.getBoundingClientRect();
    picker.classList.toggle('is-up', window.innerHeight - rect.bottom < 320 && rect.top > window.innerHeight - rect.bottom);
    search.value = '';
    search.focus();
    list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  };
  const close = (refocus = false) => {
    if (menu.hidden) return;
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (refocus) button.focus();
  };
  const choose = (alpha2) => {
    country = byAlpha2(alpha2);
    paint();
    close();
    sync();
    input.focus();
  };

  button.addEventListener('click', () => (menu.hidden ? open() : close()));
  search.addEventListener('input', () => options(search.value));
  search.addEventListener('keydown', (e) => {
    const items = [...list.querySelectorAll('.phone-option')];
    const active = items.findIndex((li) => li.classList.contains('is-active'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = items[(active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
      items.forEach((li) => li.classList.remove('is-active'));
      next?.classList.add('is-active');
      next?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = items[active] || items[0];
      if (pick) choose(pick.dataset.alpha2);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    }
  });
  list.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus in the search box
  list.addEventListener('click', (e) => {
    const option = e.target.closest('.phone-option');
    if (option) choose(option.dataset.alpha2);
  });
  document.addEventListener('pointerdown', (e) => {
    if (!picker.contains(e.target)) close();
  });
  picker.addEventListener('focusout', (e) => {
    if (!picker.contains(e.relatedTarget)) close();
  });

  input.addEventListener('input', () => {
    const full = detect(input.value);
    if (full) {
      country = full.country;
      input.value = full.national;
      paint();
    }
    sync();
  });
  input.addEventListener('paste', (e) => {
    const text = e.clipboardData?.getData('text') || '';
    if (!detect(text)) return;
    e.preventDefault();
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // A value already in the field (a saved profile, browser autofill) is read the same way.
  const initial = detect(input.value);
  if (initial) {
    country = initial.country;
    input.value = initial.national;
  }
  paint();
  sync();
  return { get value() { return hidden.value; }, get country() { return country; }, set(alpha2) { choose(alpha2); } };
}

// Every <input type="tel" data-phone> on the page gets the picker.
export const initPhones = (root = document) => root.querySelectorAll('input[type="tel"][data-phone]').forEach((input) => mountPhone(input, { defaultAlpha2: input.dataset.phone || DEFAULT_ALPHA2 }));
