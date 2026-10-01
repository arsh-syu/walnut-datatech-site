// Inline SVG icons. Stroke icons inherit `currentColor`; all are decorative (aria-hidden).

const stroke = {
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  external: '<path d="M14 5h5v5M19 5l-8 8M11 7H6a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-5"/>',
  user: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0"/>',
  instagram: '<rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="12" cy="12" r="3.6"/><circle cx="16.8" cy="7.2" r=".7" fill="currentColor" stroke="none"/>',
  // service areas
  infrastructure: '<path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 10a4 4 0 0 1 0 8H7z"/>',
  content: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10.5 9.5l4.5 2.5-4.5 2.5z"/>',
  marketing: '<path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  counselling: '<path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14a2 2 0 0 1 2-2h1v6H6a2 2 0 0 1-2-2v-2zM20 14a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2v-2zM18 18v1a3 3 0 0 1-3 3h-2"/>',
  admissions: '<path d="M15 20v-1.5A3.5 3.5 0 0 0 11.5 15h-5A3.5 3.5 0 0 0 3 18.5V20M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM16 11l2 2 4-4"/>',
  examinations: '<path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1zM8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 14l2 2 4-4"/>',
  'student-support': '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12zM9 11h6M9 14h4"/>',
  compliance: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 17v-3M12 17v-5M15 17v-2"/>',
  careers: '<path d="M4 8h16a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a1 1 0 0 1 1-1zM9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
};

const fill = {
  play: '<path d="M8 5.5v13l11-6.5z"/>',
  youtube: '<path d="M21.6 7.2a2.5 2.5 0 0 0-1.76-1.77C18.25 5 12 5 12 5s-6.25 0-7.84.43A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.76 1.77C5.75 19 12 19 12 19s6.25 0 7.84-.43a2.5 2.5 0 0 0 1.76-1.77A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3z"/>',
  linkedin: '<path d="M6.94 5a1.94 1.94 0 1 1-3.88 0 1.94 1.94 0 0 1 3.88 0zM3.3 8.5h3.4V20H3.3zM9.2 8.5h3.26v1.57h.05c.45-.86 1.56-1.77 3.22-1.77 3.44 0 4.07 2.26 4.07 5.2V20h-3.4v-5.77c0-1.38-.02-3.15-1.92-3.15-1.92 0-2.21 1.5-2.21 3.05V20H9.2z"/>',
  facebook: '<path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.87.24-1.46 1.49-1.46h1.6V4.45a21 21 0 0 0-2.33-.15c-2.3 0-3.87 1.4-3.87 3.98v2.22H7.8v3h2.6V21z"/>',
};

export function icon(name, cls = '') {
  const c = `ico${cls ? ' ' + cls : ''}`;
  if (fill[name]) {
    return `<svg class="${c}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">${fill[name]}</svg>`;
  }
  if (!stroke[name]) throw new Error(`Unknown icon: ${name}`);
  return `<svg class="${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${stroke[name]}</svg>`;
}
