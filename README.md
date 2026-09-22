# haveli-stage

The Haveli stage in 3D, for two jobs: seeing content on the back LED at its
real size and resolution, and seeing what six moving heads do to the set.
Same chassis as `ovo.content.baps.solutions` (Next.js 15, Three.js, Tailwind 4,
Vercel) with none of the OVO-specific pipeline — the model loads straight from
`public/haveli-stage.obj`.

Two tools. `/stage` is the 3D stage: everything is a control on the left and
every control is in the share link. `/blocking` is scene blocking, cue by cue:
a stage plan and a hall plan you drop markers on. `/` lists both, and every
page has the site menu in its corner (Haveli · 3D stage · Scene blocking) to
jump between them.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

## Share it

Push the folder to a GitHub repo and import it into Vercel — no settings
needed (`vercel.json` says it's Next.js). Or from the folder:

```bash
npx vercel deploy --prod
```

Once it's up, **Copy link** in the Share section gives a URL that opens the
exact look: every head's pan/tilt/colour/zoom/position, the LED pattern, haze,
house light, camera, guides. Send that to whoever needs to see it. Looks also
autosave in the browser, and export/import as JSON. An uploaded clip can't
travel in a link — send the file with it, they drop it on **Upload**.

## The LED — brief for content

| | |
| --- | --- |
| Raster | **10240 × 1920** (5.33:1) |
| Physical | 25.6 × 4.8 m at 2.5 mm pitch — the raster is the wall 1:1 |
| Origin | top-left; one picture, house left → house right |
| Bottom edge | +1.605 m above the hall floor, 0.3 m above the +1.3 m deck |
| Cabin | stands in front of px **3632–6608** across, **576–1898** down (see the *Cabin zone* guide and the *Test card*) |

Content at 10240 × 1920 lands edge to edge. Anything else is cover-fitted
(fills the wall, crops the excess) or stretched — a toggle. Upload accepts any
video or image the browser can play; it stays in that browser.

Built-in patterns: a pixel-map test card, colour bars, and four generated
loops (saffron flow, stars, rise, ripple) so there is always something moving
on the wall without downloading anything.

## The rig

Four heads up top, two on the deck. There is no truss in the model — the hall
has 7.6 m walls and no ceiling — so every hang position is a number: pick a
placement (front of house / over the stage / wide / above the LED for the top
four; deck corners / upstage / hall floor / flanking the cabin for the pair) or
move any head on its own x/y/z sliders.

Each head has pan, tilt, colour, intensity and zoom (beam angle 4–60°), plus
aim buttons that solve pan/tilt onto the chair, the cabin, centre stage, the
forestage, the LED ends or the room. Tilt 0° is straight down for a hung head
and straight up for one on the deck. Beams are raycast and stop on the first
surface they hit (not the cabin glass), so the visible beam ends where the
light lands. Each head is also a real shadow-casting spotlight, so the cabin,
deck and drape take its colour.

Looks are starting points: Darshan, Stage wash, Crossing beams, Into the room,
Sweep, Aarti, Rig off. **Movement** oscillates every head about its aim.

## Scene blocking — `/blocking`

A port of the Janma Jayanti blocking tool onto this stage. For every cue:
a **stage plan** (the deck, stairs, forestage, cabin and chair, LED, wings,
drawn from the same numbers as the 3D model) and a **hall plan** (the whole
45 × 50 m room with seating). Pick a role on the right, click the plan to
place a marker, drag to move, Alt-drag to copy, Delete to remove. *How many*
turns a marker into a group — on the hall it draws across the seats it
occupies and reads out "FL · row 3 · seats 15–26". *Draw move* makes a numbered
arrow that belongs to whoever it starts on. *Previous cue* ghosts the cue
before. *Cue list* gives plain text of every position and move.

- **The cue sheet** — the tool starts with `Cue Sheet Master.xlsx` → tab
  *Cue_FINAL6AUG*: 43 cues in nine sections (Pre-Swami, Entry, Introduction,
  Samagam, Smruti, Rajipo, Mahima, Nishkapat, Sukh), with each cue's duration,
  act/scene and explanation in its notes. When the sheet changes, **Load cue
  sheet…** takes rows pasted from it (tab-separated: section code, section
  name, cue no., item, start, duration, presenters, props) — no code to edit.
- **Seating** — the four sections of the prayer hall as the ground-floor plan
  draws them: `FL`/`FR` in front of the halfway line, `BL`/`BR` behind it, a
  position being one person sitting (0.6 m across, rows 1 m apart). The
  dialog takes JSON if the pitches, extents or names need changing; markers
  stay put. `"seats": false` gives an open floor.
- **Export…** — one PNG of the current view, or every cue's two plans written
  straight into a folder you pick (Chrome/Edge; other browsers get a zip):
  `07-SAM-cue7-stage.png`, `07-SAM-cue7-hall.png`, … numbered in running
  order, plus `positions.txt` with every position and move. **Print** does
  the same on paper. There is no script-doc integration.
- **Saving** — the plan autosaves in the browser. For a shared, live plan,
  **Share** walks through creating a free Supabase project (four steps); the
  link it produces (`/blocking#s=…`) is the invitation and everyone on it edits
  the same document. **Backup** / **Import** move the plan as JSON.

## Where things live

| File | What |
| --- | --- |
| `public/haveli-stage.obj` / `.mtl` | The model, as supplied. Metres, +X house right, +Y up, +Z to the audience, origin at the main stage front edge on the hall floor. |
| `lib/venue.ts` | The set-out read from the model: LED size/raster/position, cabin, stage, hall, aim targets, model groups. |
| `lib/model.ts` | Loads the OBJ, swaps in lit materials by MTL name, gives `led_surface` planar UVs. |
| `lib/led.ts` | The LED channel — video/image/canvas → unlit material — the built-in patterns, cover/stretch, the cabin-zone and 640 px guides. |
| `lib/rig.ts` | Fixtures, placements, gels, looks, the yoke-and-head model, pan/tilt kinematics, beam cutting. |
| `lib/state.ts` | The look as one object, defaults, coercion, the share-link codec. |
| `lib/scene.ts` | Renderer, camera, orbit, bloom, the 4K still. |
| `components/stage-viewer.tsx` | The page: scene wiring and the control panel. |
| `lib/features.ts`, `components/site-nav.tsx`, `app/page.tsx` | The list of tools, the corner menu every page carries, and the home page built from that list. |
| `lib/blocking/geometry.js` | The 2D plans: stage plate and hall plate from `lib/venue.ts`, the editable seating model, seat lookup, position labels. |
| `lib/blocking/app.js` | The blocking tool itself: markers, moves, panels, cue list, print, folder/zip export, Supabase sync, local autosave, cue-sheet import. |
| `lib/blocking/cues.js` | The bundled cue sheet (generated from the xlsx's Cue_FINAL6AUG tab). |
| `components/blocking/blocking-client.tsx`, `app/blocking/` | Its markup, styles and route. |

To add a fixture: append to `defaultFixtures()` in `lib/rig.ts` and give it a
slot in each `PLACEMENTS` entry for its group. To change the LED: edit `LED` in
`lib/venue.ts`. To swap the model: replace the OBJ, keep the LED face named
`led_surface`, and adjust `MODEL_GROUPS` name patterns and the numbers in
`lib/venue.ts`.

In the browser console, `__haveli` exposes `{ rig, scene, camera, led, model }`.
