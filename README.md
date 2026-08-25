# Ace Developers — site

Neo-futurist / Y2K holographic portfolio site. Zero dependencies, zero build
tooling, no framework. Two files matter:

```
src/page.html   ← the single source of truth (edit this)
build.sh        ← wraps it in a document skeleton
index.html      ← generated. open it directly in a browser
```

## Working on it

```sh
sh build.sh          # regenerates index.html from src/page.html
node serve.js 8080   # then open http://localhost:8080
```

Or just open `index.html` directly — it works from `file://` too. No install,
no build tooling beyond the one shell script.
`src/page.html` is deliberately skeleton-free (no `<html>`/`<head>`/`<body>`)
so the exact same file can be published as a Claude Artifact.

## The mark

Two different marks, on purpose:

- **The sequence ending is drawn entirely in code** — inline SVG. Chrome-
  gradient rim, radial core glow, outlined `A` monogram. No raster anywhere.
- **The hero uses the supplied artwork**, cropped and keyed by
  `tools/crop-logo.js` and inlined as the `--logo` data URI.

`node tools/crop-logo.js` regenerates the hero asset if the artwork changes
(needs `playwright-core`). Two notes on that keying, if you ever touch it:

- The cutout is a **flood fill inwards from the border**, not a luminance key.
  A luminance key punches holes through the spade's own dark interior; the
  flood fill is stopped by the bright chrome rim, so the inside survives.
- **A blend mode cannot do this job.** `mix-blend-mode: screen` composites only
  within its own stacking context, and the fade wrapper sets `opacity`, which
  creates one — so the blend never reaches the page and the logo renders as a
  grey rectangle. Real alpha is the only thing that works.

## How the scroll sequence works

The mark is a word cloud of the languages it's built in, so in `#sequence` the
languages build it. 34 tokens — the 14 languages plus small repeats — fly in
from every direction and land on the spot each occupies inside the spade. Then
the mark draws itself **around** them: the rim strokes on via
`stroke-dashoffset`, the core blooms behind, the monogram lands last. The words
stay put at 78% — they are the fill of the mark, not something it replaces.

| progress | what happens |
|---|---|
| `0.00 – 0.40` | tokens launch, staggered, from off-screen in every direction |
| `0.40 – 0.64` | the last of them land; the cloud resolves into a spade |
| `0.64 – 0.78` | the chrome rim draws itself on, the core glow blooms |
| `0.72 – 0.86` | reticle snaps on; the monogram scales into place |
| `0.84 – 1.00` | the four capability nodes fan out to the corners |

Layout comes from `packWords()`: it rasterises the spade path to a mask, then
for each token takes the **best of 600 candidate positions**, scored by
distance from the nearest token already placed. Taking the first position that
merely fits clumps everything centrally; scoring for spread pushes tokens into
the point and the stem, which is what makes the silhouette read.

### Centring

Three separate fixes, all measured at runtime rather than hardcoded, so they
stay correct if the artwork changes:

- The spade path runs `y 14..194`, so its centre is 4 units below the middle of
  a `0..200` viewBox. `SHIFT` is derived from `getBBox()` and applied to both
  SVG groups **and** the packing mask, so words and rim share one origin.
- The `A` glyph runs `y 48..170` and sat visibly low; `#monoShift` aligns its
  own bbox centre to the spade's.
- `fitAsm()` sizes the mark from the room actually left under the copy —
  `(viewportHeight / 2 - copyBottom) * 2`. A fixed fraction of the viewport
  overlapped the headline on shorter screens.

### Traps

- **Pack only after `document.fonts.ready`.** Packing measures with canvas
  `measureText`; measuring a fallback face gives widths that don't match what
  renders, and words overlap once Chakra Petch swaps in.
- The tiny 9–11px entries in `LANGS` aren't filler for its own sake — they're
  the only tokens narrow enough to reach the point and the stem.
- **Never set `opacity` on an element with `transform-style: preserve-3d`.**
- **Keep filters out of anything that animates.** The rim's "glow" is a fat
  translucent stroke, not a `drop-shadow`, so nothing re-renders while it draws.
- **`body` uses `overflow-x: clip`, not `hidden`.** `hidden` makes the body a
  scroll container and kills every `position: sticky` pin on the page.
- **The work section's height is computed from its real overflow.** Hardcoding
  a tall value leaves you scrolling past a stationary row on wide screens.

## Responsive

Verified at 320, 360, 390, 430 and 768 wide: no horizontal overflow, no tap
target under 40px, no element clashes, no console errors. The audit that
checks this lives in the commit history rather than the repo — re-run it by
driving the page with Playwright if you change layout substantially.

Four things that actually broke, and why:

- **`repeat(3, 1fr)` on the hero stats forced 318px of content into a 320px
  phone.** Grid and flex children default to `min-width: auto`, so a track
  can't shrink below its widest un-wrappable word — three uppercase labels
  with letter-spacing were enough. Fixed with `min-width: 0` plus a two-column
  fallback.
- **`aspect-ratio: 1` on a full-width hero stage** made the mark as tall as the
  viewport was wide, which is most of why the hero ran to 1200px. Capped at
  320px and centred.
- **The word cloud became illegible.** The mark scales to ~0.6 on a phone,
  which drops the 9–11px filler tokens to about 5px. On screens under 860px
  the page now packs only the fourteen real languages, sized up 18%, so the
  smallest still renders around 13px.
- **Nodes cut straight through the mark at tablet widths.** Their offsets were
  a fixed `30vw / 19vh`. They're now measured from the mark's rendered box:
  beside it when it genuinely fits, stacked clear above and below when it
  doesn't.

The reticle is sized from the mark in `fitAsm()` rather than from a viewport
clamp, so it always frames the mark instead of guessing.

## Favicon

`tools/crop-logo.js` also emits the favicons, cropping tight to what is
actually opaque above alpha 170 — the hero padding that keeps the rim glow
looking right is wasted space at 32px square.

- 64px is inlined as a data URI (~13KB) so it works from `file://` too
- 180px ships as `assets/favicon.png` for the iOS home-screen icon

## Before this goes live

- [ ] **Contact form has no endpoint.** It validates and reports, but sends
      nothing. Point it at Formspree / Basin / your own handler.
- [ ] **Work section is four empty slots**, each tagged `SLOT · REPLACE`.
      Swap in real projects and remove the tag.
- [ ] **`hello@acedevelopers.dev` is a placeholder** — replace in `#contact`.
- [ ] Replace the `01`–`04` card covers with real screenshots.
- [ ] "Booking: Next quarter" in the hero stats — set to whatever is true.

## Design tokens

All in `:root` at the top of `src/page.html`, taken off the logo:

| token | value | role |
|---|---|---|
| `--void` | `#050a14` | page ground, navy not grey |
| `--beam` | `#2276ff` | royal blue, the primary accent |
| `--beam-lit` | `#3d8bff` | the emphasis half of a headline |
| `--plasma` | `#5b9dff` | HUD, labels, active states |
| `--ice` / `--dim` | `#dde7f5` / `#9fb2c9` | text |
| `--chrome` | 10-stop gradient | the mark and display type |
| `--holo` | blue metallic sweep | iridescent edges |

Taken from the brand collateral, which is monochrome royal blue. Two rules
came out of matching it:

- **No cyan and no rainbow.** An earlier pass used `#6ff2ff` for highlights
  and a cyan-violet-magenta-gold sweep for card edges. Both pulled the page
  teal and read as someone else's brand. Everything is now one blue, stepped.
- **Headlines pair white with blue**, the way the collateral sets "DIGITAL"
  against "REALITY" — `.accent` on the second half. Chrome-on-chrome loses
  that contrast, so chrome is reserved for the mark and the hero H1.

Ambient blue blooms sit behind the hero, capabilities and contact. Without
them the navy reads flat black rather than deep.

Type: **Chakra Petch** (display), **Sora** (body), **JetBrains Mono** (HUD).

The page commits to a single dark visual world rather than shipping a light
theme — every colour is painted explicitly so it holds on any background.
`prefers-reduced-motion` is respected throughout: the boot sequence, marquees,
circuit field and orbits all stop, and reveals resolve instantly.
