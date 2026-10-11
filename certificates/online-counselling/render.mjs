// Renders the Online Counselling Course certificate from template.html to PDF and PNG (A4 landscape, 300 dpi).
//
//   node render.mjs --holder "Priya Sharma" --id WDT-OCC-2026-000123 --date "11 October 2026" --out ./out/priya
//   node render.mjs --specimen --out ./out/specimen
//
// Options: --holder, --id, --date, --place (default Noida, India), --signatory "Name", --title "Director",
//          --specimen (the SPECIMEN watermark and notice), --out (path without extension), --png-only, --pdf-only.
// Needs Playwright (any project that has it installed: run from that folder, or set PLAYWRIGHT_DIR to it).
// The LMS backend can do the same with its own HTML-to-PDF step: fill the {{fields}} and print A4 landscape, no margins.

import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : [])).filter((p) => p.length));

const specimen = Boolean(args.specimen);
const fields = {
  mode: specimen ? 'specimen' : '',
  holder: specimen ? 'Learner Name' : args.holder || '',
  certificateId: specimen ? 'WDT-OCC-2026-000000' : args.id || '',
  issuedOn: specimen ? 'DD Month YYYY' : args.date || new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
  place: args.place || 'Noida, India',
  signatoryName: args.signatory || '',
  signatoryTitle: args.title || 'Authorised Signatory',
};
if (!specimen && (!fields.holder || !fields.certificateId)) {
  console.error('Give --holder and --id (or --specimen).');
  process.exit(1);
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const html = readFileSync(resolve(here, 'template.html'), 'utf8').replace(/\{\{(\w+)\}\}/g, (_, k) => esc(fields[k] ?? ''));

const out = resolve(args.out || `./out/${specimen ? 'specimen' : fields.certificateId}`);
mkdirSync(dirname(out), { recursive: true });

// Playwright from the current project (or PLAYWRIGHT_DIR)
const require = createRequire(resolve(process.env.PLAYWRIGHT_DIR || process.cwd(), 'package.json'));
const pw = await import(pathToFileURL(require.resolve('playwright')).href);
const { chromium } = pw.default ?? pw; // CommonJS package: the exports sit on default under ESM
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1123, height: 794 }, deviceScaleFactor: 3 }); // A4 landscape at 96 dpi, PNG at 3×
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(200);
if (!args['pdf-only']) await page.screenshot({ path: `${out}.png`, fullPage: false, clip: { x: 0, y: 0, width: 1123, height: 794 } });
if (!args['png-only']) await page.pdf({ path: `${out}.pdf`, width: '297mm', height: '210mm', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
await browser.close();
console.log(`rendered ${out}.pdf / .png (${specimen ? 'specimen' : fields.certificateId})`);
