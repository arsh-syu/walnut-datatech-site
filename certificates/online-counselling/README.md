# Online Counselling Course — certificate

Two things live here:

1. **The specimen** (`out/specimen.pdf`, `out/specimen.png`) — watermarked "SPECIMEN", placeholder name and
   number. Show it on the website and on the LMS course page. It is not a valid certificate and says so.
2. **The template** (`template.html`) — what the LMS backend fills in for each learner who completes the
   course and passes the assessment. `render.mjs` shows the fill-and-print step end to end and produces the
   reference renders.

## The template's fields

| Field | What goes in | Example |
|---|---|---|
| `{{holder}}` | the learner's full name, as on their Walnut account | Priya Sharma |
| `{{certificateId}}` | the certificate number the LMS issues — unique, never reused | WDT-OCC-2026-000123 |
| `{{issuedOn}}` | date of issue, written out | 11 October 2026 |
| `{{place}}` | place of issue | Noida, India |
| `{{signatoryName}}` | the person who signs (leave empty until decided) | |
| `{{signatoryTitle}}` | their title | Director |
| `{{mode}}` | `specimen` for the watermarked sample, empty for a real certificate | |

Suggested number format: `WDT-OCC-<year>-<6 digits>` (Walnut DataTech, Online Counselling Course). The number
is what `/verify-certificate/` on the website will look up once the LMS provides its verification endpoint
(`CERT_VERIFY_URL`), so the LMS should keep `{ certificateId, holder, course, issuedOn, status }` per certificate.

## Printing it

A4 landscape, no margins, backgrounds on. Fonts are Lexend (headings) and Inter (text) from Google Fonts, the
website's own; the backend can self-host them instead. Nothing on the page depends on JavaScript.

```bash
cd ~/code/walnut-react-site-new   # any folder with Playwright installed
node ~/code/walnut-datatech-site/certificates/online-counselling/render.mjs --specimen --out ~/code/walnut-datatech-site/certificates/online-counselling/out/specimen
node ~/code/walnut-datatech-site/certificates/online-counselling/render.mjs --holder "Priya Sharma" --id WDT-OCC-2026-000123 --date "11 October 2026" --out /tmp/priya
```

## What it says

"Certificate of Completion · Online Counselling Course · This is to certify that *name* has successfully
completed the course and passed its assessment, and is recognised as a Certified Online Programme Counsellor,
Foundation level" — the credential title the LMS carries for this course — with the course facts (23 modules,
111 lessons, 29 hours, on Walnut LMS), the date and place of issue, the Walnut seal, the signatory and the
verification line.

Still to decide by the business: the signatory's name and title, and whether to add a QR code to the
verification line (the number and the address are enough for `/verify-certificate/`).
