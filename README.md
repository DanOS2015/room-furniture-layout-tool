# Living room fit check

A 2D room planner: draw the room to scale from its wall lengths, drop furniture in,
drag it around, and see what clashes, what blocks the door and what won't fit through
the doorway on delivery.

## Running it

```
npm install
npm run dev          # http://localhost:5173
```

```
npm run build        # one self-contained dist/index.html - double-click it, no server
npm test             # geometry + DOM tests
npm run icons        # regenerate the app icons (rarely needed - see below)
```

The build inlines all JS, CSS **and the IBM Plex webfont** into a single file, so
`dist/index.html` can be copied anywhere or emailed and fetches nothing from the
network at all.

`dist/` is no longer only that file: it also carries `manifest.webmanifest`, `sw.js`
and `icons/`, which are what make the app installable on a phone. `dist/index.html`
on its own still works when double-clicked — the service worker and manifest are
both guarded and fail silently on `file://` — it just can't be installed that way.

## Installing it on a phone

It is a Progressive Web App: served over HTTPS it installs to an Android home
screen, runs fullscreen with its own icon, and works with no signal.

**Publishing it.** `.github/workflows/deploy.yml` builds and deploys to GitHub Pages
on every push to `main`. Push the repo, then set **Settings → Pages → Source** to
*GitHub Actions* once. The site lands at `https://<you>.github.io/<repo>/`. Nothing
is hard-coded to that path — `base: "./"` in [vite.config.ts](vite.config.ts) plus
relative `start_url`/`scope` in the manifest mean it works at a domain root or under
a project subpath unchanged. To try it without a repo, run `npm run build` and drag
`dist/` onto <https://app.netlify.com/drop>.

**Installing it.** Open that URL in Chrome on Android and take the install prompt, or
menu → *Install app*. On an iPhone, Safari → Share → *Add to Home Screen*.

**Offline.** `public/sw.js` precaches the shell on first visit. It serves navigations
network-first so a redeploy is picked up as soon as you have signal, and falls back to
the cache when you don't. Bump `CACHE` in that file if you ever need to force every
client to drop its old copy. The layout itself lives in `localStorage` as it always
has, so an installed app keeps your furniture between launches.

**Icons.** `npm run icons` regenerates `public/icons/` from the measured room's own
outline — the four PNGs total about 7 KB and are committed, so this only needs
running if the room or the palette changes. The script
([scripts/make-icons.mjs](scripts/make-icons.mjs)) writes PNGs using only `node:zlib`,
which keeps a 10 MB native image dependency out of a project whose only runtime deps
are React.

**A note on testing it.** Service workers need a secure origin, so `npm run dev --
--host` over a LAN IP will *not* register one. Test on `localhost` (which counts as
secure) or on the deployed URL.

## The room

The room is five-sided: four walls plus a short angled one carrying the door. Only
the four are typed in; the angled wall is worked out from them and shown under the
fields. Going round from the fireplace: **top** is the fireplace wall, **right** the
short wall the door opens back against, then the **door wall**, then **bottom** the
radiator wall, then **left** the window wall.

**Room** at the top of *Room shape* is a dropdown of rooms measured on site. Picking
one loads its walls, fireplace, radiator and door; the furniture already on the plan
stays where it is, so the same pieces can be tried against another room. Edit any of
those numbers and the dropdown reads *Custom room (edited)* until you pick a room
again.

### Living room, as measured

| | mm | source |
| --- | ---: | --- |
| Top wall (fireplace) | 4290 | 1445 + 1385 + 1460, measured either side of the breast |
| Right wall | 2890 | measured with the door shut |
| Door wall (angled) | 1245 | measured; falls out of the other four |
| Bottom wall (radiator) | 3163 | **derived** — see below |
| Left wall (window) | 3420 | measured |
| Fireplace | 1385 wide × 380 out | 1445 off the window wall |
| Radiator | 2045 long × 130 out | 720 off the window wall |
| Door leaf | 864 (34") | hinged at the right-wall end, off = 0 |

Five measurements for four walls never quite agree, and here they disagree by about
250 mm. The radiator wall is the figure that gave: the tape read 3445 (720 + 2045 +
680), but that shortens the angled wall to 998 mm, which will not take an 864 mm door
and its frame. Setting it to 3163 makes the angled wall the 1245 mm that *was*
measured directly, and lands within 90 mm of the architect's 3255. The other four
walls are all within 80 mm of the plan.

The knock-on: the radiator is pinned by its 720 mm gap to the window wall, the
easier of its two gaps to measure, so its gap to the door wall comes out at 398 mm
rather than the 680 read into that splayed corner. If the 680 turns out to be right,
raise the bottom wall in *Room shape* and the angled wall will grow to match.

Two cross-checks that do hold: 2890 − 864 = 2026 mm of right wall left clear with
the door open, against the ~2090 measured; and the fireplace's two gaps, 1445 and
1460, are as measured with nothing left over.

## Saving

The layout is written to `localStorage` automatically, about a second after you stop
making changes. **Export layout** writes a `.json` file; **Import layout** reads one
back. Import is tolerant — missing fields fall back to the measured room rather than
failing, and anything unreadable reports why instead of blanking the page.

## How pieces are described

All dimensions are millimetres.

- **Rectangle** — `width` × `depth`, where width runs left–right before you turn it.
- **L-shape / chaise** — `width` is the whole sofa; `depth over chaise` is measured at
  the deepest point, over the chaise leg *only*. The rest of the sofa is `depth
  without chaise` deep. So a 2770 × 1610 chaise couch is a 2770 × 1030 body with a
  950 mm-wide leg reaching 580 mm further out — not a 2770 × 1610 block. The panel
  spells this out under the chaise fields.

  Retailer diagrams don't print the depth over the chaise. They print *seat* depths,
  which leave out the backrest, so the chaise seat figure alone is 30–40 cm short.
  **Work "depth over chaise" out from a retailer diagram** in the chaise panel does
  the sum: give it the main sofa's seat depth and the chaise's seat length and it
  fills the field in, using `depth without chaise` as the overall body depth. For a
  sofa quoted at 235 × 93 overall with a 58 cm seat and a 119 cm chaise seat, the
  backrest is 93 − 58 = 35 cm and the depth over the chaise is 119 + 35 = **154 cm**.
  It opens automatically if the chaise you've entered projects less than 300 mm,
  which almost always means the seat length was entered by mistake.
- **Corner unit** — `front width` is the face the screen sits on, `depth` is from the
  corner apex to that face, and `wall run` is how far each rear edge lies along its
  wall (how retailers quote them). Geometry note: a true 90° corner unit can be at
  most twice as wide as it is deep. Go past that and the front corners would have to
  poke through the walls; the panel says so and tells you the minimum depth.

Corner shapes are opt-in — the three corner TV presets, or Shape = *Corner unit* on
the Custom piece form. There is no way to turn a piece you've already placed into a
different shape.

## Keyboard

Arrow keys nudge the selected piece 10 mm, Shift+arrow 100 mm, `r` turns it 90°,
`f` flips a chaise. Dragging a piece within 80 mm of a wall snaps it flat against it.

## `living-room-fit-planner.html`

The original single-file version, kept as a reference. It has known bugs — dimension
fields that snap to 10 while you type, a clearance halo that is far too wide sideways
and too narrow front-to-back, and saving that silently fails outside the Claude
artifact runtime — all of which are fixed here. Safe to delete once you're happy.
