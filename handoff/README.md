# Handoff: Always Hungry Records — Homepage ("The Watcher")

For Eduardo. Build target: **Framer**.

## Overview
The homepage for Always Hungry Records, a vinyl-only label. It's a single scrolling page with no shop yet. There are five sections: Hero, A1 Who, A2 What we do, B1 DNA, B2 Contact. They're named like the sides of a record.

The one big idea: **a large cat head is pinned to the bottom-left corner of the screen while the page scrolls under it.** It is ink on light sections. Where the dark "What we do" section passes behind it, the head turns paper-coloured, line for line. Everything else is deliberately quiet: one typeface, three colours, a lot of empty space.

## About the files
`reference/AHR Homepage.html` is a **design reference built in HTML**, not code to ship. Open it in a browser. Both the desktop and mobile frames scroll inside themselves, so you can feel the pinned head flip. Rebuild it natively in Framer using Framer stacks, breakpoints and components.

`framer/WatcherHead.tsx.txt` is the one exception. It's a working Framer code component for the pinned, flipping head, because Framer can't do that interaction without code. Everything else should be plain Framer layers. (It ships as `.txt` so it opens anywhere: paste its contents into a new Framer code component.)

## Fidelity
**High fidelity.** Colours, type, spacing and copy are final, apart from the placeholders listed below. Your design touch is welcome: see "What's locked vs. open".

---

## What's locked vs. open

**Locked (brand rules — please don't change)**
- **Colours:** only three. Ink `#141310`, paper `#F7F5F0`, white `#FFFFFF`. Create variation by flipping ink and paper, never by adding a colour. No gradients, tints, textures or shadows.
- **The cat head:** never rotate, stretch, squash, outline or put it in a circle or badge. Keep the eye angles. Nothing goes inside the eyes. To make it fit a space, crop it; don't distort it.
- **Peeking lockup:** the head always runs off the bottom-left corner. The drawing's flat left and bottom edges sit flush with the screen edges.
- **Header mark:** the whole head at **56px tall**. Favicon: the **eyes-only** file.
- **Type:** **Overpass Mono only** on this page, one family. Caps with wide letter-spacing for labels and titles. Sentence case for paragraphs.
- **Copy:** the four section texts are final. Use them as written.

**Open (yours to improve)**
- Hover states, link treatments and the mobile menu (currently just the word "Menu").
- Small motion: page-load reveals and scroll-triggered fades. Keep them subtle and quick, under about 400ms, ease-out.
- Tablet breakpoint behaviour.
- How the contact links look, once the real links exist.
- Anything that makes it feel more crafted without adding colour, icons or a second font.

---

## Layout grid

| | Desktop 1440 | Phone 390 |
|---|---|---|
| Side margins | 96 | 24 |
| Columns | 12 × 82, 24 gutters | 4 × 77.5, 16 gutters |
| Main text column | starts at **x = 626** (column 6), runs to 1344 (718 wide) | full width, 24 → 366 |
| Vertical rhythm | everything in multiples of 8 | same |

On desktop, **every** piece of text from the nav down starts at x = 626: nav, wordmark, labels, paragraphs, DNA rows, contact and sign-off. Only the header logo sits on column 1 (x = 96). That shared left line is the main structural move. The left 516px belongs to the cat.

In Framer: make the page a vertical stack. Give each section left padding 626 / right 96 on Desktop, and 24 / 24 on Phone.

---

## Design tokens

**Colour**
- `ink` `#141310`: text, rules, the cat, the dark section
- `paper` `#F7F5F0`: background of Who and Contact, and the head's flipped colour
- `white` `#FFFFFF`: page background (Hero, DNA)
- `dim` `#6E6A62`: section labels, row numbers, "Records" in the header, secondary notes

**Type: Overpass Mono (Google Fonts, available in Framer), weights 400 / 600 / 700**

| Style | Desktop | Phone | Weight | Line height | Tracking | Case |
|---|---|---|---|---|---|---|
| Hero wordmark | 128 | 58 | 700 | 1.0 | 0.14em (phone 0.12em) | caps |
| DNA title | 34 | 20 | 600 | 40px / 24px | 0.06em | caps |
| Who paragraph | 26 | 17 | 400 | 40px / 28px | -0.01em / 0 | sentence |
| Contact links | 24 | 17 | 400 | — | 0.02em | as written |
| What-we-do paragraph | 19 | 15 | 400 | 32px / 24px | 0 | sentence |
| Header name | 14 | — | 600 | — | 0.24em | caps |
| Tagline "Vinyl-Only Label" | 12 | 11 | 600 | — | 0.30em | caps |
| Nav / labels / notes | 11 | 10 | 600 (labels, nav) / 400 (notes) | — | 0.16–0.20em | caps |

Optical alignment: shift the hero wordmark left by **0.05em** so the "A" looks flush with the column.

**Rules:** 1px, ink. No border radius anywhere. No shadows.

---

## Sections (desktop / phone)

### Header: 104 tall / 80 tall
- Background white. Not sticky.
- Left: head mark (`assets/ahr-mark-peeking.svg`) **47 × 56**. 20px gap (phone: 12px), then `ALWAYS HUNGRY` (600) followed by `RECORDS` in weight 400, colour dim. Phone shows only the mark.
- Desktop nav starts at x = 626, gap 48: `WHO`, `WHAT WE DO`, `DNA`, `CONTACT` (11 / 600 / 0.2em). Each scrolls to its section.
- Phone: `MENU` on the right (11 / 600 / 0.2em). Menu design is open.

### Hero: 796 tall / 764 tall (header + hero = exactly one screen)
- Background white.
- Desktop: padding 120 top, 72 bottom. `ALWAYS` / `HUNGRY` on two lines at the top of the column. The bottom row is `VINYL-ONLY LABEL` on the left and `SIDE A ↓` (11 / 400 / dim / 0.16em) on the right.
- Phone: padding 56 top. Wordmark, a 28px gap, then `VINYL-ONLY LABEL`.
- The cat sits in the bottom-left (see Interactions). There is no other image.
- 1px ink rule at the bottom.

### A1 — Who
- Background **paper**. Padding 192 top/bottom (phone 96).
- Label `A1 — WHO` (dim), 40px gap (phone 28), then:
  > Vinyl-only label. Pressing the kind of timeless records the founders personally love and wish existed. Dedicated to creating collector-level timepieces that preserve rare sounds and analog craftsmanship.

### A2 — What we do (the dark section)
- Background **ink**, text paper. Padding 192 top / 240 bottom (phone 96 / 120).
- **Frame ID: `what-we-do`.** The cat component needs this ID.
- Label `A2 — WHAT WE DO`, then:
  > We work with artists and archives to create collector-level vinyl that feels as good as it sounds: rare pressings, bold visual aesthetic & variants, and attention to every groove and sleeve. Each release is a small tribute to timeless human-made music and timeless analog technology — created for those that appreciate the thrill of owning a rare physical slice of history.

### B1 — DNA
- Background white. Padding 192 top / 160 bottom (phone 96 / 72).
- Label `B1 — DNA`. Then four rows. Desktop rows start at x = 626, so **the rules never run into the cat**.
- Each row: 1px ink top rule (the last row also has a bottom rule), 32px vertical padding (phone 24). Number in an 80px column on the left (11 / dim), title on the right.
- **All four rows must be the same height**, matching the tallest. In Framer: set each row's height to the tallest row's, or use a grid with equal rows.

| # | Title | Note under title (11 / 0.2em, 16px above) |
|---|---|---|
| 01 | TIMEPIECE CREATION | — |
| 02 | LIMITED SIGNATURE PRESSINGS | ALL NUMBERED |
| 03 | ELEVATED VISUAL IDENTITY | — |
| 04 | CATALOG CURATION | INDIE ROCK · DEEP HOUSE · DISCO HOUSE · JAZZ HOUSE (wrapping row, 32px gaps, phone 20px) |

On phone the number sits above the title, and the rules run full width.

### B2 — Contact + footer
- Background **paper**, 1px ink rule on top. Padding 160 top (phone 72).
- Label `B2 — CONTACT`, then three stacked lines, gap 20 (phone 14), 24px (phone 17):
  `[ Contact email ]` · `[ Instagram ]` · `[ Bandcamp ]` ← **placeholders, real links to come**
- Footer row 192 below (phone: 320, leaving room for the cat): `STAY HUNGRY. — AHR` on the left and `END OF SIDE B` (dim) on the right, 11 / 0.2em. Bottom padding 48. Phone shows only the sign-off, right-aligned.

---

## Interactions

**1. The pinned head (the signature moment)** → `framer/WatcherHead.tsx.txt`
- Position: **Fixed**, pinned to left 0 / bottom 0 of the viewport, above the content, pointer events off.
- Size: Desktop **516 × 620**, Phone **158 × 190**. Tablet suggestion: about 300 × 360. Always keep the 199 : 239 ratio.
- Behaviour: ink by default. Where a section listed in "Dark sections" overlaps the head, that slice turns paper. It's a hard edge that tracks the section boundary exactly as you scroll, with no fade.
- The head covers whatever scrolls behind it. Body copy starts at x = 626, so on desktop nothing important passes under it. On phone the head is smaller for the same reason.
- The flip can be turned off ("Flip on dark") to compare with a solid ink head.

**2. Nav links** scroll smoothly to their section. Hover state is open: suggestion is a 1px ink underline, offset 3px.

**3. Responsive:** two designed breakpoints, 1440 and 390. Tablet (810) is yours to define. Suggestion: phone layout with 48px margins and a bigger head.

---

## Assets (`assets/`)
- `ahr-mark-peeking.svg`: the cat head. Use it in the header, and its paths are already inside the Framer component.
- `ahr-mark-contained.svg`: the floating version, if you need the mark somewhere without an edge to run off.
- `ahr-eyes-favicon.svg`: **favicon / social avatar.** Export at 16, 32, 180 and 512.
- `ahr-square.svg`: the square crop, if a square slot has room for more than the eyes.
- **Placeholders, not supplied:** contact email, Instagram URL, Bandcamp URL. Don't invent them.

Don't redraw the mark, and don't import it as a PNG. Paste the SVG or use the component.

## Files
- `reference/AHR Homepage.html`: open in a browser. Scroll inside each frame.
- `framer/WatcherHead.tsx.txt`: Framer code component.
- `assets/*.svg`: master artwork.
