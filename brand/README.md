# Walnut Data Tech brand kit

Everything needed to give another tool the same look as the website.

| File | What it is |
|---|---|
| `brand-book.html` | The visual brand book. Open it in a browser to see every colour, type style and component |
| `BRAND.md` | The brand book: voice, colour, type, spacing, shape, states, motion, icons, logo — and how to apply it |
| `tokens.css` | Every design token as a CSS variable. Start here |
| `tokens.json` | The same tokens as data, for scripts and other tools |
| `components.css` | Ready-made styles: buttons, fields, selectable cards, chips, price steps, cards |
| `shadcn-theme.css` | Theme variables for tools built on shadcn/ui (Lovable, v0, Vercel starters) |
| `tailwind.preset.cjs` | A Tailwind preset with the colours, fonts, sizes, radii and shadows |
| `logos/` | Logo for light and dark backgrounds, the mark, and the app icon |
| `icons/` | The icon set as SVG files |
| `social/` | The link-sharing image |

Fonts are Lexend (headings) and Inter (text), both free on Google Fonts:

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Lexend:wght@500&display=swap">
```

These files mirror the website's own styles, which remain the source of truth: `src/assets/css/base.css`. When a token changes on the website, change it here too.
