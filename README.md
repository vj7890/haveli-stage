# haveli-stage

The Haveli stage in 3D, for two jobs: seeing content on the back LED at its
real size and resolution, and seeing what six moving heads do to the set.
Same chassis as `ovo.content.baps.solutions` (Next.js 15, Three.js, Tailwind 4,
Vercel) with none of the OVO-specific pipeline — the model loads straight from
`public/haveli-stage.obj`.

Three tools. `/stage` is the 3D stage: everything is a control on the left and
every control is in the share link. `/blocking` is stage setup: a plan of the
stage you drop people and props on, saved as named setups and exported as PNGs. `/wristbands` is the RFID
wristband emulator: the hall from above, nine zones painted onto the seats.
`/` lists them, and every page has the site menu in its corner to jump
between them.

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

## Stage setup — `/blocking`

A plan of the Haveli stage to show who stands where: the main stage, the
cabin, the LED wall and the **performance stage, 40 × 16 ft**, with a ramp on
each side. Pick a role in the toolbar at the bottom and click the plan to
place markers (Esc when done). Drag to move, Alt-drag to copy, double-click to
name one, Delete to remove. The arrow tool draws a move. **Hall** zooms out to
the whole room with its seating; it is the same plan, so markers carry over.

- **Setups** — the list on the left. Each one is a named layout. They save in
  this browser as you work. **Duplicate** keeps a version before you change it.
- **Export PNG** — the open setup as a 3200 px picture with its name on top and
  a key of who is on. **Export all as PNGs** puts every setup in one zip.
- **Backup / Load** — all setups as one JSON file, to move them between
  computers or keep a copy. Loading merges: the newer copy of a setup wins.
- **Copy link to this setup** — a link that opens the setup for anyone.

Keys: `V` select, `A` arrow, `1`–`9` the first nine roles, `⌘Z` / `⇧⌘Z` undo
and redo, wheel or pinch to zoom, drag empty floor (or shift-drag) to pan.

The ramps are drawn from photos, not a drawing: change `RAMP` in
`lib/venue.ts` when the real size and position are known. The performance
stage is `PERF` there; the 3D model still has the old 9.75 m forestage.

## Wristbands — `/wristbands`

Every seat in the hall is one wristband — 2244 of them, from the same
seating model as the blocking tool. Each belongs to one of nine zones (or
none), and each zone has a colour, an effect and a level.

- **Zones** — the list on the left is the palette: click a zone (or press
  1–9; 0 erases) and paint it onto the hall with the **Brush** (1–6 seats
  wide), a **Box**, a whole **Row** or a whole **Section**. The presets are
  starting layouts: Grid 3 × 3, Stripes, Bands, Rings (out from the chair),
  Fan (wedges from the chair), Sections, Checker, Clear. The count next to
  each zone is how many wristbands it needs.
- **Colour and effect** — any colour, or a gel from the same set as the
  rig. Effects per zone: Solid, Slow pulse (≈4 s), Fast pulse (1 s), Flash
  (a hit every 2 s), Strobe (10 Hz), Twinkle (every band sparkles on its
  own), Off. **Chase** runs across the zones in order — 1→9, Bounce, Build,
  Random — with a step time and a floor level for the zones not lit;
  Rings + Chase is a ripple out from the stage. Master, Speed and Glow are
  global. The Effects buttons are whole-hall looks to start from.
- **From a picture** — drop in any drawing of the hall coloured by zone. It
  sits under the seats (opacity, scale and position sliders line it up);
  **Match zone colours** gives each seat the zone whose colour is nearest
  the picture under it, and **Find 9 zones** finds the nine most distinct
  colours in the picture, makes them the zone colours and assigns every
  seat. Either way you can then paint over the result. The picture itself
  doesn't travel in the link.
- **Share** — **Copy link** carries the zone map, colours, effects and
  view; **Render PNG** writes a 2400 px still with the zone counts along the
  bottom; **Export / Import JSON** move the whole thing as a file. Autosaves
  in the browser.

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
| `lib/blocking/geometry.js` | The main stage outline and the hall's seating model, shared by stage setup and wristbands. |
| `lib/blocking/setups.ts` | Setups and roles, browser saving, backup merge, the share link, the zip writer, carrying over the old cue tool's markers. |
| `components/blocking/plan.tsx` | The plan drawing, used both live and for the PNG export. |
| `components/blocking/stage-setup.tsx`, `app/blocking/` | The page: setups list, plan, toolbar, marker editor, export. |
| `lib/wristbands/model.ts` | Seats from the seating model, zones, effects, chase, presets, looks, state + share codec, the image → zones maths (nearest colour, k-means). |
| `lib/wristbands/render.ts` | The top-down canvas drawing: room, stage, sections, one glowing dot per wristband. |
| `components/wristbands/wristband-emulator.tsx`, `app/wristbands/` | The page: canvas loop, painting tools, the panel, underlay, share/export. |

To add a fixture: append to `defaultFixtures()` in `lib/rig.ts` and give it a
slot in each `PLACEMENTS` entry for its group. To change the LED: edit `LED` in
`lib/venue.ts`. To swap the model: replace the OBJ, keep the LED face named
`led_surface`, and adjust `MODEL_GROUPS` name patterns and the numbers in
`lib/venue.ts`.

In the browser console, `__haveli` exposes `{ rig, scene, camera, led, model }`.
