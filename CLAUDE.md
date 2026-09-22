# CLAUDE.md — haveli-stage

Project memory for Claude Code. Read this before touching anything.

## What this is

A stage-visualisation website for the **Haveli stage** (BAPS, London): put
content on the back LED at its real size and resolution, point six moving
heads at the set, and share the exact look as a URL. Built for Ved (GitHub
`VJ7890`) to run locally and deploy on Vercel so others can open it.

It is modelled on `ovo.content.baps.solutions` — the OVO Arena Wembley
Janma Jayanti stage app (Next.js 15 + Three.js 0.180 + Tailwind 4 + shadcn,
two Vercel sites from one repo). Same chassis and UI feel, same LED-content
mechanism, same "fake beams + a few real lights" approach to lighting — but
none of the OVO pipeline (no DWG, no SketchUp extraction, no Google Sheet cue
list, no Vercel Blob). The model here loads straight from an OBJ.

## History (what has happened so far)

1. **Read the OVO repo end to end** (14.6k lines TS + Python DWG pipeline).
   Key takeaways carried over: each viewer is one big `'use client'`
   component that builds a Three.js scene imperatively inside a `useEffect`
   and exposes an imperative api object; LED surfaces are unlit
   `MeshBasicMaterial`s wearing a `VideoTexture`/`CanvasTexture`, content
   cover-fitted via `texture.repeat/offset`, UVs deciding which part of the
   picture a mesh samples; lighting is additive cone meshes re-aimed per frame
   plus two or three real `SpotLight`s; `/cues` drives a headless viewer through
   that api; looks persist in localStorage and export as JSON.
2. **Ved supplied `haveli-stage.obj` + `.mtl`** (a previz export from a
   separate tool: "Source: data/venue.json … SPEC.md §10"). Parsed: 53
   axis-aligned boxes, metres, +X house right, +Y up, +Z toward audience,
   origin at the centre of the main stage front edge on the hall floor. No UVs.
   Hall 45 × 50 m with **7.6 m walls and no ceiling**; main stage +1.3 m;
   forestage 4 × 4 decks at +1.1 m; a 7.44 × 3.3 m glass cabin with the chair;
   curtain wings, drape, cordons; LED **25.6 × 4.8 m**, bottom +1.605 m.
3. **Back LED is 10240 × 1920 px** (Ved). 25.6 m ÷ 10240 = 2.5 mm → the
   raster is the physical wall 1:1 at P2.5. Content authored at that size lands
   edge to edge.
4. **Rig brief (Ved):** "assume 4 moving heads up top, 2 at the bottom"; no
   truss positions — so hang positions are placement presets + free x/y/z.
5. **Built this site** and verified it headless (Playwright + SwiftShader):
   builds clean, no console errors, share link round-trips, every look and view
   screenshotted. Bugs found and fixed on the way (see *Gotchas*).
6. **Delivered as a zip**; `git` initialised on `main` with one commit and
   `origin` = `https://github.com/VJ7890/haveli-stage.git`. **The push has not
   happened yet** — the cloud session's git proxy refused to attach
   credentials for that repo. First job in Claude Code: `git push -u origin
   main`, then connect the repo in Vercel (Add New → Project → Deploy, no
   settings needed).

7. **Added `/blocking`** — a port of Prash's "Scene Blocking" tool
   (`StageDiagramPrash/index0.html`, a single-file vanilla-JS app for the OVO
   show, with `HANDOVER-scene-blocking.md`) onto this site and this stage.
   Kept: markers/groups/seat-snapping, numbered move arrows, ghosted previous
   cue, cue list text, print, PNG export, Supabase live-sync via `#s=` link,
   PNG publishing for the sheet/doc. Replaced: OVO `STAGE_CAD` → a stage plate
   drawn from `lib/venue.ts`; the arena bowl → an editable Haveli floor-seating
   model (placeholder numbers). Dropped: the shape-tracer/underlay mode (it
   referenced venue fields that no longer exist and would have thrown) and the
   Claude-artifact `window.storage` backend. Added: localStorage autosave when
   not connected, a paste-TSV cue-sheet importer, a Backup **Import** button.
   Surface ids are `stage` and `hall` (was `arena`); both share one coordinate
   frame (x across, svg y = 10 − metres upstage).

## Run / build / deploy

```bash
npm install          # once
npm run dev          # http://localhost:3000 → /stage
npm run build        # must stay clean; `npx tsc --noEmit` too
git push -u origin main
```

Vercel: framework auto-detected (`vercel.json`), no env vars. Every push to
`main` redeploys.

## Layout

```
app/
  layout.tsx            html.dark, Onest via <link>, dot-grid body
  globals.css           Tailwind 4 + HSL tokens (dark only), --scene-bg
  page.tsx              redirect → /stage
  stage/page.tsx        renders <StageViewer/>
  blocking/page.tsx     renders <BlockingClient/>, imports blocking.css
  blocking/blocking.css scoped under .blk; maps the site tokens onto the tool
components/
  blocking/blocking-client.tsx  the tool's DOM (ids are the API app.js wires to)
  stage-viewer.tsx      THE PAGE: scene wiring (useEffect IIFE), api ref,
                        apply(state, prev) diff-push, the whole control panel,
                        share/still/export/import
  viewer-layout.tsx     full-viewport shell: canvas, glass side panel, phone
                        drawer, corner + HUD slots; GroupLabel, Row helpers
  ui/{button,slider,switch}.tsx   minimal shadcn-style primitives (Radix)
lib/
  venue.ts              SET-OUT NUMBERS from the OBJ: LED (px, size, x/y/z,
                        aspect), STAGE, HALL, CABIN, CHAIR, ledPx(), cabinPx(),
                        TARGETS (aim points), MODEL_GROUPS (name → group)
  model.ts              loadModel(): OBJ+MTL → lit materials by MTL name,
                        planar UVs on `led_surface`, meshes grouped
  led.ts                createLedChannel(): one channel (video/image/canvas →
                        unlit material), LED_CLIPS + generated patterns
                        (testcard, bars, saffron, stars, rise, ripple, off),
                        cover/stretch fit, level; buildLedGuides() (cabin zone,
                        640 px grid)
  rig.ts                Fixture type, PLACEMENTS, GELS, defaultFixtures(),
                        aimAt() / beamDir() kinematics, buildRig() (yoke+head
                        meshes, additive cone, SpotLight, raycast beam cut,
                        sweep), LOOKS + applyLook()
  state.ts              AppState (led, rig, fixtures, view, sizes, figures,
                        vis, note), defaultState(), coerce(), VIEWS,
                        encodeShare()/decodeShare() (#s=base64url JSON),
                        STORE_KEY for localStorage
  scene.ts              createScene(): renderer (ACES, shadows, local
                        clipping), camera, OrbitControls, EffectComposer with
                        UnrealBloom + OutputPass, animation loop, still(),
                        fitDistance(); houseLights()
  extras.ts             buildSizes() dimension arrows/labels, buildFigures()
  utils.ts              cn, hex, clamp
  blocking/geometry.js  plan frame (STAGE_TOP, SY/UP), stage + hall plates,
                        DEFAULT_VENUE seating spec, buildHall(), seatAt(),
                        zoneAt()/stagePos()/hallLabel(); reads lib/venue.ts
  blocking/app.js       mountBlocking(root) → teardown. Vanilla JS on purpose
                        (@ts-nocheck): the whole tool is closures over `show`;
                        do not React-ify piecemeal. Doc shape: show.v = 4,
                        sections[].cues[].{items[], paths[]}, item.surface ∈
                        {stage, hall}, item.seat = {block,r,s} on the hall
public/
  haveli-stage.obj / .mtl   the model, as supplied — do not edit by hand
```

## Conventions

- Scene units are metres in the OBJ's frame: x across (house right +),
  y up from the hall floor, z toward the audience (+), upstage is −z.
  (The OVO app used z downstage-positive too; feet only inside its stage
  params. Nothing here is in feet.)
- **State is one object** (`AppState`). The panel edits React state; a
  `useEffect` pushes it to the scene through `api.current.apply(state, prev)`,
  which diffs the expensive bits (LED clip, view) and re-applies the cheap
  ones. Never reach into Three.js objects from JSX.
- Every user-visible change must be representable in `AppState` so it rides
  the share link. Uploads are the exception (object URLs) — the link falls
  back to the test card.
- Fixture ids are fixed: `t1..t4` (group `top`, mount `hung`), `b1`, `b2`
  (group `bottom`, mount `floor`). `coerce()` merges any saved/linked data onto
  these ids, so adding a fixture means adding it to `defaultFixtures()` and to
  every `PLACEMENTS` entry for its group.
- Pan/tilt convention (see `rig.ts` header): tilt 0 = straight down for a
  hung head, straight up for a floor head; local beam =
  `Ry(−pan)·Rx(tilt)·(0,−1,0)`; floor mount = whole fixture rotated π about X.
  `aimAt()` inverts this. If you change `pose()`, change `aimAt()` and
  `beamDir()` together.
- LED material is `toneMapped: false` so authored colours show as-is; bloom
  (`led.bloom`, "Glow" slider) is what makes it read as light.
- Copy in the UI is plain and specific (m, px, degrees) — keep the tone of
  the OVO app: numbers, not adjectives.
- Prefer editing `lib/venue.ts` for any set-out change; the rest reads from it.

## Gotchas already hit (don't reintroduce)

- **No `polygonOffset` on the LED material.** The OVO app used it for coplanar
  overlays; here the OBJ puts `led_surface` 5 mm proud of `led_carcass`, and
  the offset pushed the face behind the carcass at oblique angles → LED looked
  black from iso/side views.
- **Beams must be cut at the first hit.** A fixed 34 m cone passes through the
  deck and LED and re-emerges; six of them overlap into big washes. `cut()` in
  `rig.ts` raycasts along the beam against `model.meshes` (minus
  `cabin_glass_*`) and scales a unit cone to the hit distance. Runs on every
  applyHead and every frame while sweeping.
- **Fog density.** `FogExp2` at OVO's arena values blacks out a 50 m hall; it's
  0.006 × haze here, and "haze" mostly scales beam opacity instead.
- **Button labels must be unique** if Playwright scripts click by name — the
  aim target "Audience" collided with the view "Audience"; the target is now
  "The room".
- **Headless SwiftShader renders a frame every few seconds** (4 shadow maps +
  bloom), so screenshot scripts must wait on `requestAnimationFrame` counts,
  not timeouts, or they capture the previous state. Real GPUs are fine.
- `useLook` is not a hook — it's `pickLook`, keep it that way (lint).
- `window.__haveli = { rig, scene, camera, led, model }` is a debug hook set
  after load; handy for `page.evaluate` probes.

- Blocking: every DOM id in `blocking-client.tsx` is load-bearing — app.js
  finds controls by id. The `.blk` root is `position: fixed; inset: 0`, so
  the page has no chrome of its own; the top bar links back to `/stage`.
- Blocking: `migrate()` drops `arena`-surface items from OVO-era (v3) docs —
  their coordinates were a different frame. Stage items carry over.
- Blocking: the hall seating is a **placeholder**. `DEFAULT_VENUE` in
  geometry.js is the shape to fill from the real plan; users can also paste
  JSON in *Seating*. It is stored in `show.venue`, so it syncs.

## What's deliberately not built (yet)

- No cue list / per-cue looks (OVO's `/cues` + Google Sheet). Looks are presets
  + share links. If wanted: a `cues` array in state, one look per cue, carry-
  forward — the OVO `cues-viewer.tsx` is the pattern.
- No trusses or hang geometry — the hall has no ceiling in the model. Trim
  heights unknown; "top" defaults to 7.0 m. Ask Ved for real positions.
- Only one LED surface. The curtain wings are drape, not screens, as far as we
  know.
- No gobos, strobe, or fixture profiles; `kind` exists on `Fixture` but only
  changes wash intensity.
- No mobile testing beyond the drawer layout existing.
- Fonts: Onest via a Google Fonts `<link>` (not `next/font`) so an offline
  build can't fail on it.

## Open questions for Ved

- Real hang positions / trim heights for the four top heads.
- Whether any other surface is LED (wings? floor?).
- Whether content will also come as a live feed (NDI/capture) — needs a
  different source than `<video src>`.
- Whether to add a cue-by-cue mode like the OVO content site (the blocking
  page now holds the cue list; the 3D looks could hang off the same cues).
- The real Haveli seating plan (sections, rows, seats, aisles) for `/blocking`.
- The cue sheet for this show, to paste into *Load cue sheet…*.
