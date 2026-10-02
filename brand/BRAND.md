# Walnut Data Tech — brand book

Walnut Data Tech is a technology and services company for online education. It serves three audiences — universities, learners and education agents — and the brand has to feel like one calm, capable product to all three: premium, minimal, spacious and precise. One violet from the logo, near-black ink, a lot of white, and type that does most of the work.

Use this page as the rulebook. Token names in `code` are the exact names in the Colors, Typography, Spacing and Radius tabs.

## Voice and wording

- Write plainly and confidently, the way a knowledgeable colleague talks. Short sentences. No hype, no exclamation marks, no emoji.
- Say what the reader can do, from their side: "Build your solution", "Enrol now", "Talk to us" — not "Submit" or "Click here".
- Headlines are statements that end with a full stop: "Upgrade your skills.", "Join Walnut.", "Two ways to work with us."
- Use sentence case everywhere — headings, buttons, labels. Capitals appear only in the tiny `overline` style.
- Use British spelling: programme, enrolment, organisation, digitisation, counsellor.
- Write the company name as "Walnut Data Tech" in text. The legal name is "Walnut DataTech Private Limited" and belongs only in the footer and legal pages.
- Prices are in Indian rupees with the symbol and Indian digit grouping, no decimals: ₹999, ₹1,999. Show a discount as three steps — original price, coupon, what you pay — never as a struck-through number alone.
- Address the reader as "you" and the company as "we".
- Error messages say what went wrong and what to do: "Please enter a valid email address." Never blame, never apologise twice.

## Colour

The palette is deliberately small. Most of any screen is `paper` and `ink`; violet is the accent, not the wallpaper.

**Surfaces**

| Token | Value | Use |
|---|---|---|
| `paper` | `#ffffff` | Page background and raised cards. The default ground. |
| `mist` | `#f6f5fb` | Soft section backgrounds and quiet cards on `paper`. |
| `selected` | `#faf9ff` | Background of a selected card, always with a `violet-600` border. |
| `violet-soft` | `#efebff` | Tinted surface: icon tiles, chips, coupon codes. Carries `violet-700` text. |
| `night` | `#0c0a17` | Dark sections, footer and closing call-to-action. Carries white and `on-dark-muted` text. |
| `night-2` | `#171429` | Raised surface on `night`. |

**Text**

| Token | Value | Use |
|---|---|---|
| `ink` | `#0d0c14` | Headings and body text on `paper`, `mist` and `violet-soft`. Also the fill of the primary button. |
| `ink-2` | `#2b2937` | Secondary text such as navigation links, on `paper` and `mist`. |
| `muted` | `#63607a` | Supporting text and descriptions on `paper` and `mist`. |
| `on-dark-muted` | `#b9b5cc` | Supporting text on `night`. |

**Brand violet**

| Token | Value | Use |
|---|---|---|
| `violet` | `#7d62ff` | The brand colour, taken from the logo. Use it for marks, progress, illustration and glows — not for small text on white (4.1:1). |
| `violet-600` | `#6a4df5` | Accent fills that carry white text: accent buttons, selected ticks and icon tiles. |
| `violet-700` | `#5b3fe6` | Accent text on light surfaces: links, eyebrows, small labels on `paper`, `mist` and `violet-soft`. |
| `violet-on-dark` | `#b3a3ff` | Accent text on `night`: eyebrows and links in dark sections. |

**Lines and status**

| Token | Value | Use |
|---|---|---|
| `line` | `#e8e6f0` | Hairline borders and dividers. Decorative — never the only sign of a control. |
| `line-strong` | `#cfccdd` | Borders of inputs and outline buttons. |
| `ok` | `#17b26a` | Success marks: tick circles and status dots. Always paired with a word or a tick. |
| `ok-text` | `#0b7a43` | Success text on `paper` and `ok-soft`. |
| `ok-soft` | `#e6f8ee` | Tinted background behind success text. |
| `danger` | `#b42318` | Error text and the border of an invalid field, on `paper`. Always paired with a message. |

Rules:

- Three violets, three jobs. `violet` is the brand colour for marks, progress and illustration. `violet-600` is for fills that carry white text. `violet-700` is for violet text on a light surface. Do not swap them: white on `violet` is 4.1:1 and `violet` text on `paper` is 4.1:1, both below the 4.5:1 that small text needs.
- Checked contrast: `ink` on `paper` 19.4:1 · `muted` on `paper` 6.0:1 · `muted` on `mist` 5.6:1 · `violet-700` on `paper` 6.4:1 · `violet-700` on `violet-soft` 5.5:1 · white on `violet-600` 5.3:1 · `on-dark-muted` on `night` 9.8:1 · `violet-on-dark` on `night` 9.0:1 · `ok-text` on `paper` 5.4:1 · `danger` on `paper` 6.6:1.
- The page is light. There is no dark theme. `night` is used for whole sections — a feature band, the footer, the closing call to action — to create rhythm between light sections.
- Gradients are rare: one soft violet glow behind a hero, and the tinted wash inside illustrations. Never a gradient on a button, a card or text.
- Status is never colour alone. Success is `ok` with a tick or a word; an error is `danger` with a message.

## Typography

Two typefaces, both free on Google Fonts.

- **Lexend** (`display`), weight 500 only — every heading. Set it tight: letter-spacing from -0.02em on small headings to -0.045em on the largest.
- **Inter** (`body`), weights 400, 500 and 600 — everything else.
- A system monospace (`mono`) appears only for coupon codes and payment references.

Rules:

- One `display` per page, for the main headline. Section headings use `title`.
- Headings are never bold — weight 500 is the heaviest Lexend gets. Emphasis comes from size and space.
- Put an `eyebrow` above a heading to say who or what the section is for. It is violet, sentence case, and never capitals.
- Body text is `body` (17px, line height 1.55). Paragraphs under headlines use `lede` in `muted`, at most 38em wide.
- Let headings wrap evenly (`text-wrap: balance`).
- The large sizes are fluid on the website — each style's note gives its `clamp()`. In a fixed-layout tool, use the listed size on wide screens and about 55% of it on phones.

## Spacing and layout

- Spacing is a 4px scale: `s-1` to `s-10`. Use the tokens; do not invent in-between values.
- Be generous. Sections are separated by 72–140px of vertical space (`s-9` to `s-10`); a heading sits `s-8` above its content on wide screens.
- Content sits in a centred column at most 1240px wide, with a side gutter of 20–40px.
- Prefer few, large things to many small ones. A grid of two or three large cards beats a grid of eight small ones.
- Layouts change at these widths: 1100px (the top navigation becomes a menu button); 900px (two-column layouts stack); 820px (card grids go to one column; selectable cards become rows); 560px (form fields go to one column).
- On phones, a card grid becomes a list of rows: icon on the left, text in the middle, tick on the right.

## Shape, borders and elevation

- Corners are large and soft. Big cards use `r-xl`, selectable cards `r-lg`, inputs `r-field`. Buttons, chips and tags are always full pills (`r-pill`).
- Borders are 1.5px. `line` for quiet dividers and card outlines, `line-strong` for inputs and outline buttons.
- Most cards have no border and no shadow — just a `mist` fill on `paper`. Shadow is reserved for things that float or respond: `shadow-lg` on a form card, `shadow-md` on a card lifting under the pointer.
- Shadows are tinted violet, never grey. Use the three shadow tokens as written.

## States

- **Hover:** cards rise 2–4px and gain a shadow; the primary button turns from `ink` to `violet-600` with `glow-accent`; an arrow inside a button slides 3px right.
- **Press:** buttons scale to 0.96.
- **Selected:** border `violet-600`, background `selected`, halo `ring-selected`, the icon tile fills with `violet-600`, and a tick is drawn into a filled circle. All five together — a colour change alone is not a selected state.
- **Focus:** a 2px `violet-600` outline, 3px outside the element. Inputs instead get a `violet-600` border with `ring-focus`.
- **Disabled:** 55% opacity, no pointer.
- **Error:** the field border turns `danger` and a `danger` message appears under it.
- **Loading:** the button keeps its size, its label fades to 35% and a small spinner turns in the middle.

## Motion

Motion is quiet and always explains something: where content came from, what was chosen, that a tap registered.

- Two curves. `ease` for almost everything; `spring` (a slight overshoot) only for confirmations — a tick popping, an icon growing, a dialog opening.
- Three speeds. `dur-fast` for hover and press, `dur-base` for state changes, `dur-reveal` for content arriving.
- Content fades in and rises 28px as it scrolls into view, once. Items in a row arrive 80ms apart.
- A headline rises word by word on page load.
- When a panel is swapped, the old one fades out quickly (180ms), the container glides to its new height, and the new content rises in.
- Clicking a button or card sends a soft ripple from the pointer.
- Honour "reduce motion": turn all of it off.

## Iconography

- One icon style: line icons on a 24px grid, 1.7px stroke, round caps and joins, no fills. The set is in Assets → Icons, and each icon is described in its group note.
- Icons inherit the text colour. In a tile they sit on `violet-soft` in `violet-700`, or on `violet-600` in white when selected.
- Icons are for navigation and recognition, not decoration. No emoji, no illustrated or two-colour icons.
- Product illustrations are small scenes built from the interface's own pieces — white cards, pills, progress bars — floating on a tinted, dot-gridded panel. No stock photos, no people.

## Logo

- The logo is the violet mark — four "W" shapes turned around a square — with the wordmark "Walnut DataTech" and the line "Private Limited". Files are in Assets → Logos.
- Use `logo.svg` on `paper` and `mist`, and `logo-on-dark.svg` on `night`. Use `mark.svg` alone where space is tight; `app-icon.svg` is the mark on a dark rounded square for browser tabs and app icons.
- Keep clear space around the logo equal to the height of one arm of the mark. Do not recolour, stretch, outline or rebuild it, and do not set the wordmark in another font.
- In the website header the full logo is 36px tall; do not go below 28px.

---

# Applying the theme to another tool

Three ways to bring this look into a tool that already exists. Pick the one that matches how the tool is built.

## 1. Any website or app: CSS variables

Load the two fonts, then paste the variables. Everything else in this system is written in terms of them.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Lexend:wght@500&display=swap">
```

```css
:root {
  /* colour */
  --paper: #ffffff;
  --mist: #f6f5fb;
  --selected: #faf9ff;
  --violet-soft: #efebff;
  --night: #0c0a17;
  --night-2: #171429;
  --ink: #0d0c14;
  --ink-2: #2b2937;
  --muted: #63607a;
  --on-dark-muted: #b9b5cc;
  --violet: #7d62ff;
  --violet-600: #6a4df5;
  --violet-700: #5b3fe6;
  --violet-on-dark: #b3a3ff;
  --line: #e8e6f0;
  --line-strong: #cfccdd;
  --ok: #17b26a;
  --ok-text: #0b7a43;
  --ok-soft: #e6f8ee;
  --danger: #b42318;

  /* type */
  --font-display: "Lexend", "Avenir Next", "Segoe UI", system-ui, sans-serif;
  --font-body: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  /* space (4px base) */
  --s-1: 4px;
  --s-2: 8px;
  --s-3: 12px;
  --s-4: 16px;
  --s-5: 24px;
  --s-6: 32px;
  --s-7: 48px;
  --s-8: 64px;
  --s-9: 96px;
  --s-10: 128px;

  /* shape */
  --r-sm: 10px;
  --r-field: 14px;
  --r: 16px;
  --r-lg: 22px;
  --r-xl: 30px;
  --r-pill: 999px;

  /* elevation and rings */
  --shadow-sm: 0 1px 2px rgba(13, 12, 20, .06), 0 4px 14px -6px rgba(48, 30, 140, .18);
  --shadow-md: 0 2px 4px rgba(13, 12, 20, .04), 0 18px 40px -18px rgba(48, 30, 140, .3);
  --shadow-lg: 0 2px 6px rgba(13, 12, 20, .04), 0 40px 80px -36px rgba(48, 30, 140, .38);
  --ring-selected: 0 0 0 4px rgba(125, 98, 255, .16);
  --ring-focus: 0 0 0 4px rgba(125, 98, 255, .2);
  --glow-accent: 0 10px 24px -10px rgba(106, 77, 245, .7);

  /* motion */
  --ease: cubic-bezier(.2, .7, .2, 1);
  --spring: cubic-bezier(.34, 1.56, .64, 1);
  --dur-fast: .25s;
  --dur-base: .45s;
  --dur-reveal: .8s;
}

body { font: 400 1.0625rem/1.55 var(--font-body); color: var(--ink); background: var(--paper); }
h1, h2, h3 { font-family: var(--font-display); font-weight: 500; letter-spacing: -.035em; }
```

## 2. Tools built with shadcn/ui (Lovable, v0, most Vercel starters)

These tools read a fixed set of variables. Replace the `:root` block in the global stylesheet with this one.

```css
/* Walnut Data Tech theme for shadcn/ui (and any tool built on it, such as Lovable or v0).
   Paste over the :root block in your global stylesheet. Values are H S% L%. */
:root {
  --background: 0 0% 100%;         /* paper #ffffff */
  --foreground: 248 25% 6%;        /* ink #0d0c14 */
  --card: 0 0% 100%;               /* paper #ffffff */
  --card-foreground: 248 25% 6%;   /* ink #0d0c14 */
  --popover: 0 0% 100%;            /* paper #ffffff */
  --popover-foreground: 248 25% 6%; /* ink #0d0c14 */
  --primary: 248 25% 6%;           /* ink #0d0c14 */
  --primary-foreground: 0 0% 100%; /* paper #ffffff */
  --secondary: 250 43% 97%;        /* mist #f6f5fb */
  --secondary-foreground: 248 25% 6%; /* ink #0d0c14 */
  --muted: 250 43% 97%;            /* mist #f6f5fb */
  --muted-foreground: 247 12% 43%; /* muted #63607a */
  --accent: 252 100% 96%;          /* violet-soft #efebff */
  --accent-foreground: 250 77% 57%; /* violet-700 #5b3fe6 */
  --destructive: 4 76% 40%;        /* danger #b42318 */
  --destructive-foreground: 0 0% 100%; /* paper #ffffff */
  --border: 252 25% 92%;           /* line #e8e6f0 */
  --input: 251 20% 83%;            /* line-strong #cfccdd */
  --ring: 250 89% 63%;             /* violet-600 #6a4df5 */
  --radius: 1rem;                 /* r 16px — buttons stay fully round, see below */

  /* extras the website uses beyond the shadcn set */
  --brand: 250 100% 69%;        /* violet #7d62ff — decorative brand colour */
  --brand-strong: 250 89% 63%; /* violet-600 #6a4df5 — accent fills with white text */
  --success: 152 77% 39%;       /* ok #17b26a */
}

/* The website has no dark theme. Dark SECTIONS use these on a light page. */
.dark, [data-surface="night"] {
  --background: 249 39% 6%;
  --foreground: 0 0% 100%;
  --card: 249 34% 12%;
  --card-foreground: 0 0% 100%;
  --muted: 249 34% 12%;
  --muted-foreground: 250 18% 75%;
  --primary: 0 0% 100%;
  --primary-foreground: 248 25% 6%;
  --accent: 249 34% 12%;
  --accent-foreground: 250 100% 82%;
  --border: 0 0% 100% / 0.14;
  --input: 0 0% 100% / 0.3;
  --ring: 250 100% 69%;
}
```

Then make four changes shadcn does not cover:

- Buttons, badges and tags: fully round (`rounded-full`).
- Cards: `rounded-[30px]`, no border, `mist` background on a `paper` page.
- Headings: Lexend at weight 500 with tight letter-spacing; body in Inter.
- The primary button is `ink` and turns `violet-600` on hover. If a tool should feel more violet, set `--primary` to `250 89% 63%` and keep `--primary-foreground` white.

## 3. Tailwind

```js
// Walnut Data Tech — Tailwind preset.
// tailwind.config.js:  module.exports = { presets: [require('./brand/tailwind.preset.cjs')], … }
module.exports = {
  theme: {
    extend: {
      colors: {
        'paper': '#ffffff',
        'mist': '#f6f5fb',
        'selected': '#faf9ff',
        'violet-soft': '#efebff',
        'night': '#0c0a17',
        'night-2': '#171429',
        'ink': '#0d0c14',
        'ink-2': '#2b2937',
        'muted': '#63607a',
        'on-dark-muted': '#b9b5cc',
        'violet': '#7d62ff',
        'violet-600': '#6a4df5',
        'violet-700': '#5b3fe6',
        'violet-on-dark': '#b3a3ff',
        'line': '#e8e6f0',
        'line-strong': '#cfccdd',
        'ok': '#17b26a',
        'ok-text': '#0b7a43',
        'ok-soft': '#e6f8ee',
        'danger': '#b42318',
      },
      fontFamily: {
        display: ['Lexend', 'Avenir Next', 'Segoe UI', 'system-ui', 'sans-serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SF Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        'display': ['5.25rem', { lineHeight: '1.02', letterSpacing: '-0.045em', fontWeight: '500' }],
        'display-md': ['4.25rem', { lineHeight: '1.04', letterSpacing: '-0.045em', fontWeight: '500' }],
        'display-sm': ['3.25rem', { lineHeight: '1.06', letterSpacing: '-0.04em', fontWeight: '500' }],
        'title': ['3rem', { lineHeight: '1.08', letterSpacing: '-0.035em', fontWeight: '500' }],
        'card-title': ['1.875rem', { lineHeight: '1.12', letterSpacing: '-0.035em', fontWeight: '500' }],
        'subhead': ['1.25rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '500' }],
        'label-title': ['1.125rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '500' }],
        'lede': ['1.3125rem', { lineHeight: '1.5', letterSpacing: '0', fontWeight: '400' }],
        'body': ['1.0625rem', { lineHeight: '1.55', letterSpacing: '0', fontWeight: '400' }],
        'body-sm': ['0.9375rem', { lineHeight: '1.55', letterSpacing: '0', fontWeight: '400' }],
        'button': ['0.9375rem', { lineHeight: '1.1', letterSpacing: '0', fontWeight: '600' }],
        'eyebrow': ['0.875rem', { lineHeight: '1.55', letterSpacing: '0.005em', fontWeight: '600' }],
        'caption': ['0.8125rem', { lineHeight: '1.5', letterSpacing: '0', fontWeight: '500' }],
        'overline': ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.06em', fontWeight: '600' }],
        'code': ['0.9375rem', { lineHeight: '1.4', letterSpacing: '0.04em', fontWeight: '600' }],
      },
      borderRadius: {
        'sm': '10px',
        'field': '14px',
        'DEFAULT': '16px',
        'lg': '22px',
        'xl': '30px',
        'pill': '999px',
      },
      boxShadow: {
        'sm': '0 1px 2px rgba(13, 12, 20, .06), 0 4px 14px -6px rgba(48, 30, 140, .18)',
        'md': '0 2px 4px rgba(13, 12, 20, .04), 0 18px 40px -18px rgba(48, 30, 140, .3)',
        'lg': '0 2px 6px rgba(13, 12, 20, .04), 0 40px 80px -36px rgba(48, 30, 140, .38)',
        'ring-selected': '0 0 0 4px rgba(125, 98, 255, .16)',
        'ring-focus': '0 0 0 4px rgba(125, 98, 255, .2)',
        'glow-accent': '0 10px 24px -10px rgba(106, 77, 245, .7)',
      },
      transitionTimingFunction: {
        'ease': 'cubic-bezier(.2, .7, .2, 1)',
        'spring': 'cubic-bezier(.34, 1.56, .64, 1)',
      },
    },
  },
};
```

## A brief you can paste into an AI builder

> Restyle this app to the Walnut Data Tech brand without changing what it does.
> Fonts: Lexend 500 for all headings (letter-spacing -0.035em), Inter 400/500/600 for everything else.
> Colours: page background #ffffff; soft panels #f6f5fb; text #0d0c14; secondary text #63607a; borders #e8e6f0 (inputs #cfccdd); brand violet #7d62ff for decoration only; violet fills with white text #6a4df5; violet text and links #5b3fe6; tinted violet surface #efebff; dark sections #0c0a17 with secondary text #b9b5cc; success #17b26a; error #b42318.
> Shape: buttons and chips are full pills; cards have 30px corners and no border; selectable cards 22px; inputs 14px with a 1.5px border.
> Primary button: #0d0c14 with white text, turning #6a4df5 on hover. Secondary button: transparent with a 1.5px #cfccdd border.
> Selected state: 1.5px #6a4df5 border, #faf9ff background, a 4px rgba(125,98,255,.16) halo and a tick.
> Focus: 2px #6a4df5 outline, 3px offset.
> Shadows are violet-tinted and used only on hover and on floating cards: 0 40px 80px -36px rgba(48,30,140,.38).
> Motion: cubic-bezier(.2,.7,.2,1); hover 0.25s; content fades in and rises as it scrolls into view; respect reduced motion.
> Style: generous white space, sentence case, British spelling, no emoji, no gradients on buttons or text, line icons with a 1.7px stroke.
