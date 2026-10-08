# Always Hungry Records

Homepage for Always Hungry Records, a vinyl-only label.

One scrolling page, named like the sides of a record — Hero, **A1 Who**, **A2 What we do**, **B1 DNA**, **B2 Contact** — with a large cat head pinned to the bottom-left corner of the screen. It's ink on light sections; where the dark "What we do" section passes behind it, the head turns paper-coloured, line for line.

**Live:** https://always-hungry-records.vercel.app  ·  **Repo:** https://github.com/eduuusama/always-hungry-records

Plain HTML, CSS and a little JavaScript. No framework, no build step, no dependencies.

## Run it

```bash
python3 scripts/serve.py          # http://localhost:4173
node scripts/verify.mjs           # headless-Chrome checks (needs Node 22+ and Google Chrome)
node scripts/verify.mjs <url>     # the same checks against a deployed URL
node scripts/verify.mjs --shots=out   # also save screenshots of the key states
```

`serve.py` applies the headers, clean URLs and 404 page from `vercel.json`, so local behaves like production (including the Content-Security-Policy).

## What's where

| Path | |
|---|---|
| `public/` | The site. Vercel serves this folder (`vercel.json` → `outputDirectory`). |
| `public/index.html` | All the copy. Section texts are final; don't reword. |
| `public/styles.css` | Tokens at the top (colours, type, spacing), then components. |
| `public/main.js` | The pinned head, the phone menu, the reveal fades. |
| `public/boot.js` | 150 bytes that run before first paint (stops the fades flashing). |
| `public/fonts/` | Overpass Mono, self-hosted (SIL OFL 1.1, licence included). |
| `handoff/` | The original design handoff: spec, the HTML reference, the Framer component and the master SVGs. |
| `scripts/` | Local server and the verification script. |

## Deploy

Vercel project **always-hungry-records**, connected to this repo. Pushes to `main` go to production; other branches and PRs get preview URLs. There's no build: the `public/` folder is served as is, with the security headers and cache rules in `vercel.json`.

## Still to do

- **Contact links.** Email, Instagram and Bandcamp aren't supplied yet, so `index.html` has bracketed placeholders (`[ Contact email ]` …). Replace each `<span class="placeholder">` with `<a href="…">[ Label ]</a>`; link styling is already in place.
- **Custom domain.** Add it in Vercel (Project → Settings → Domains), then change the `canonical`, `og:url`, `og:image` and `twitter:image` URLs in `index.html` from `always-hungry-records.vercel.app` to the new host.

## Design rules this follows

From the handoff, kept exactly:

- **Colour:** ink `#141310`, paper `#F7F5F0`, white `#FFFFFF`, plus `dim` `#6E6A62` for small secondary text only. Variation comes from flipping ink and paper. No gradients, tints, textures, shadows or radius.
- **Type:** Overpass Mono only. Caps with wide tracking for labels and titles, sentence case for paragraphs.
- **The cat:** never rotated, stretched, outlined or put in a badge. It always runs off the bottom-left corner. The drawing exists once in `index.html` (an SVG sprite); the header mark and the pinned head both reuse it.
- **Grid:** at 1440 everything sits on column 6 (x = 626), side margins 96, rules 1px ink.

Where the handoff left things open, or where its numbers didn't hold up, these are the choices made:

- **Between 1024 and 1920** every measure scales proportionally from the 1440 design (small type has pixel floors). Beyond 1920 it stops scaling. **Below 1024** it's the phone layout, with margins, type and the head growing smoothly from 390 up to the 810 tablet size.
- **The head is also capped by viewport height** (never taller than the viewport minus 150px), so on short laptop screens it can't climb into the header. Proportions never change.
- **The wordmark shift** is `-0.05em` of the wordmark's own size, as the handoff text says. (The handoff's desktop reference applied it to the wrong element and shifted by under 1px.)
- **The head is click-through** (`pointer-events: none`), so links can scroll under it.
- **Motion:** quick ease-out fades on load and on scroll (under 400ms), a 1px underline on hover, smooth anchor scrolling. All of it is off for `prefers-reduced-motion`.
- **Phone / tablet menu:** a full-screen ink panel with paper rules. The pinned head flips to paper over it like any dark section.

## How the head flips

The head is two stacked copies of the same drawing: ink, and paper clipped to nothing. Any element marked `data-head-dark` counts as dark. On each frame `main.js` works out which bands of the head overlap a dark element and clips the paper copy to exactly those bands, snapped to device pixels, so the colour change follows the section's edge with no fade.

It re-measures on scroll, resize, orientation and font loads, and whenever the page, the head or a dark element changes size, so a late font swap can't leave it stale. Elements that aren't rendered are ignored, and several dark elements can overlap the head at once. To make another section dark, give it a dark background and add `data-head-dark`.

## Notes

- Strict Content-Security-Policy: scripts, styles and fonts only from the site itself, so there are no inline styles or scripts and none should be added. Set styles from `styles.css` or through the CSSOM.
- No analytics, cookies or third-party requests.
- Fonts: Overpass Mono © The Overpass Project Authors, SIL Open Font License 1.1 (`public/fonts/OFL.txt`).
