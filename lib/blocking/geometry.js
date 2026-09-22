// @ts-nocheck
/**
 * Plan geometry for the blocking tool — the Haveli stage and hall, drawn to
 * scale as SVG, in one frame shared by both plans:
 *
 *   x  metres across the stage, + = stage left = house right (the OBJ's +X)
 *   y  SVG y, = STAGE_TOP − metres upstage of the main stage's front edge, so
 *      upstage is up the page and the audience is below. The forestage and
 *      the hall are at negative "upstage" = larger SVG y.
 *
 * Every dimension comes from lib/venue.ts, read off haveli-stage.obj, so the
 * 2D plans and the 3D stage can never disagree.
 */
import { CABIN, CHAIR, HALL, LED, STAGE } from '../venue'

/* ---- the frame ------------------------------------------------------------ */
export const STAGE_TOP = 10                       // svg y of "10 m upstage"
export const SY = (up) => STAGE_TOP - up          // upstage metres → svg y
export const UP = (sy) => STAGE_TOP - sy          // svg y → upstage metres

/** Views: what "fit" shows for each plan. */
export const STAGE_VIEW = { x: -24, y: 0.3, w: 48, h: 24.6 }
/** The hall runs from the back wall (upstage +7.9) to the far wall (−42.9). */
export const hallView = () => ({ x: -HALL.w / 2 - 3, y: SY(-HALL.floorZ[0] + 0.4) - 2.6, w: HALL.w + 6, h: HALL.d + 5.8 })

/* ---- the stage, in plan (upstage-metres, not svg) ------------------------ */
// Numbers off the OBJ. z in the model is toward the audience, so upstage = −z.
const MAIN = { frontW: 22.5, frontD: 1.45, midW: 26.3, midD: 3.395, backW: 44.2, backD: 7.5 }
const STAIR = { w: 1.9, treads: 5, tread: 0.29, rise: 0.26 }
const FORE = { w: 9.75, d: 4.876, cols: 4, rows: 4 }
const WING = { x0: 12.01, x1: 22.25, at: 3.7 }
const DRAPE = { x: 22, at: 7.38 }
const CORDON = { x0: 13.15, x1: 22.1 }

/** The deck outline as one polygon, [x, upstage] going clockwise from stage right front. */
export const DECK_OUTLINE = [
  [-MAIN.frontW / 2, 0], [MAIN.frontW / 2, 0],
  [MAIN.frontW / 2, MAIN.frontD], [MAIN.midW / 2, MAIN.frontD],
  [MAIN.midW / 2, MAIN.midD], [MAIN.backW / 2, MAIN.midD],
  [MAIN.backW / 2, MAIN.backD], [-MAIN.backW / 2, MAIN.backD],
  [-MAIN.backW / 2, MAIN.midD], [-MAIN.midW / 2, MAIN.midD],
  [-MAIN.midW / 2, MAIN.frontD], [-MAIN.frontW / 2, MAIN.frontD],
]

/** Is a plan point (x, upstage) on a raised surface, and which. */
export function zoneAt(x, up) {
  const ax = Math.abs(x)
  if (ax <= CABIN.x[1] && up >= -CABIN.z[1] && up <= -CABIN.z[0]) return 'in the cabin'
  if (up >= 0 && up <= MAIN.frontD && ax <= MAIN.frontW / 2) return 'main stage'
  if (up >= 0 && up <= MAIN.frontD && ax > MAIN.frontW / 2 && ax <= MAIN.midW / 2) return 'on the stairs'
  if (up > MAIN.frontD && up <= MAIN.midD && ax <= MAIN.midW / 2) return 'main stage'
  if (up > MAIN.midD && up <= MAIN.backD && ax <= MAIN.backW / 2) return ax > WING.x0 ? 'backstage, behind the wing' : up > -LED.z - 0.3 ? 'behind the LED' : 'backstage'
  if (up < 0 && up >= -FORE.d && ax <= FORE.w / 2) return 'forestage'
  if (up < 0 && up >= -HALL.floorZ[1]) return 'hall floor'
  return 'off the plan'
}

/** "2.3 m SL · 1.2 m US" — a stage position in words. */
export function stagePos(x, sy) {
  const up = UP(sy)
  const across = Math.abs(x) < 0.05 ? 'CL' : x > 0 ? `${x.toFixed(1)} m SL` : `${(-x).toFixed(1)} m SR`
  const depth = up < 0 ? `${(-up).toFixed(1)} m out` : `${up.toFixed(1)} m US`
  return `${across} · ${depth} · ${zoneAt(x, up)}`
}

/* ---- the hall's seating: a compact spec, editable in Venue setup ---------- */
/**
 * A placeholder layout until the real seating plan is known: rows of chairs
 * facing the stage, four sections across with aisles, three bands of rows.
 * Row 1 is nearest the stage. Everything here is a guess to be replaced; the
 * markers people place stay put when the numbers change.
 */
export const DEFAULT_VENUE = {
  seatPitch: 0.5,          // seat to seat, centre to centre
  rowPitch: 0.9,
  firstRow: 6.5,           // metres downstage of the main stage front edge
  aisle: 1.5,              // between sections
  bandGap: 2.0,            // cross aisle between bands
  sections: [{ id: '1', seats: 20 }, { id: '2', seats: 20 }, { id: '3', seats: 20 }, { id: '4', seats: 20 }],
  bands: [{ n: 'A', rows: 13, start: 1 }, { n: 'B', rows: 13, start: 14 }, { n: 'C', rows: 12, start: 27 }],
  seats: true,             // false: an open floor, no blocks
}

/** A block: origin is the centre of the row-1 / seat-1 seat, in SVG space. */
export function mkBlock(o) {
  const b = {
    id: o.id, ox: o.ox, oy: o.oy, rvx: o.rvx, rvy: o.rvy, svx: o.svx, svy: o.svy,
    rows: o.rows, seats: o.seats, rowStart: o.rowStart || 1, seatStart: o.seatStart == null ? 1 : o.seatStart,
    pitchRow: Math.hypot(o.rvx, o.rvy), pitchSeat: Math.hypot(o.svx, o.svy),
  }
  const xs = [], ys = []
  for (const [r, s] of [[0, 0], [b.rows - 1, 0], [0, b.seats - 1], [b.rows - 1, b.seats - 1]]) {
    xs.push(b.ox + b.rvx * r + b.svx * s); ys.push(b.oy + b.rvy * r + b.svy * s)
  }
  const padX = Math.max(Math.abs(o.rvx), Math.abs(o.svx)) / 2 + 0.05
  const padY = Math.max(Math.abs(o.rvy), Math.abs(o.svy)) / 2 + 0.05
  b.x = Math.min(...xs) - padX; b.w = Math.max(...xs) - Math.min(...xs) + 2 * padX
  b.y = Math.min(...ys) - padY; b.h = Math.max(...ys) - Math.min(...ys) + 2 * padY
  return b
}
export const rowLabel = (b, r) => String(b.rowStart + r)
export const seatLabel = (b, s) => b.seatStart + s
export const seatXY = (b, r, s) => ({ x: b.ox + b.rvx * r + b.svx * s, y: b.oy + b.rvy * r + b.svy * s })

/** Lay the blocks out from the spec. */
export function buildHall(V) {
  const blocks = []
  if (V.seats !== false && V.sections?.length && V.bands?.length) {
    const P = V.seatPitch, R = V.rowPitch
    const widths = V.sections.map((s) => (s.seats - 1) * P)
    const total = widths.reduce((a, w) => a + w, 0) + (V.sections.length - 1) * V.aisle
    let x = -total / 2
    let up = -V.firstRow                       // row 1, in upstage metres (negative = in the hall)
    for (const band of V.bands) {
      let bx = x
      V.sections.forEach((sec, i) => {
        const b = mkBlock({ id: band.n + sec.id, ox: bx, oy: SY(up), rvx: 0, rvy: R, svx: P, svy: 0,
          rows: band.rows, seats: sec.seats, rowStart: band.start, seatStart: 1 })
        b.edgeL = i === 0; b.edgeR = i === V.sections.length - 1   // row numbers only on the outer aisles
        blocks.push(b)
        bx += widths[i] + V.aisle
      })
      up -= band.rows * R + V.bandGap
    }
  }
  return { blocks, bounds: { x0: -HALL.w / 2, x1: HALL.w / 2, y0: SY(-HALL.floorZ[0]), y1: SY(-HALL.floorZ[1]) } }
}

/** The seat under a point, if inside a block. */
export function seatAt(hall, x, y) {
  for (const b of hall.blocks) {
    if (x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) continue
    const dx = x - b.ox, dy = y - b.oy
    const r = Math.round((dx * b.rvx + dy * b.rvy) / (b.pitchRow * b.pitchRow))
    const s = Math.round((dx * b.svx + dy * b.svy) / (b.pitchSeat * b.pitchSeat))
    if (r < 0 || r >= b.rows || s < 0 || s >= b.seats) continue
    const c = seatXY(b, r, s)
    return { block: b, r, s, x: c.x, y: c.y }
  }
  return null
}
export function nearZone(hall, x, sy) {
  const z = zoneAt(x, UP(sy))
  if (z !== 'hall floor') return z
  let best = null, bd = 1e9
  for (const b of hall.blocks) {
    const dx = Math.max(b.x - x, 0, x - (b.x + b.w)), dy = Math.max(b.y - sy, 0, sy - (b.y + b.h))
    const d = Math.hypot(dx, dy); if (d < bd) { bd = d; best = b }
  }
  return best && bd < 4 ? `aisle by ${best.id}` : 'hall floor'
}
export function hallLabel(hall, it) {
  if (it.seat && it.seat.block) {
    const b = hall.blocks.find((x) => x.id === it.seat.block)
    if (b) {
      const n = it.count || 1
      const first = seatLabel(b, it.seat.s), last = seatLabel(b, Math.min(b.seats - 1, it.seat.s + n - 1))
      return `${b.id} · row ${rowLabel(b, it.seat.r)} · seat${n > 1 ? `s ${first}–${last}` : ` ${first}`}`
    }
  }
  return `${nearZone(hall, it.x, it.y)}  (${it.x.toFixed(1)}, ${UP(it.y).toFixed(1)} m)`
}

/* ---- SVG helpers ----------------------------------------------------------- */
export const el = (t, a = {}, k = []) => {
  const n = document.createElementNS('http://www.w3.org/2000/svg', t)
  for (const q in a) if (a[q] !== undefined && a[q] !== null) n.setAttribute(q, a[q])
  k.forEach((c) => n.appendChild(c))
  return n
}
export const txt = (s) => document.createTextNode(s)
export function label(x, y, s, size, fill, anchor, extra) {
  const t = el('text', Object.assign({ x, y, 'text-anchor': anchor || 'start', 'font-family': 'Onest, Helvetica, Arial, sans-serif', 'font-size': size, fill }, extra || {}))
  t.appendChild(txt(s)); return t
}
export const P = { line: '#98A2AB', hair: '#C6CDD3', seat: '#B9C2C9', floorTint: '#EAEDEF', deck: '#DCE0E3', deck2: '#CBD1D6', led: '#495560', ink: '#333A41', dim: '#79838C', paper: '#F4F5F2' }
const pathOf = (pts, close) => 'M ' + pts.map((q) => `${q[0].toFixed(3)} ${SY(q[1]).toFixed(3)}`).join(' L ') + (close ? ' Z' : '')
const rectUp = (x0, x1, up0, up1, attrs) => el('rect', { x: Math.min(x0, x1), y: SY(Math.max(up0, up1)), width: Math.abs(x1 - x0), height: Math.abs(up1 - up0), ...attrs })
function dimH(x1, x2, y, l, c) {
  const g = el('g', { stroke: '#8E979F', 'stroke-width': 0.03 })
  g.appendChild(el('line', { x1, y1: y, x2, y2: y }))
  g.appendChild(el('line', { x1, y1: y - 0.25, x2: x1, y2: y + 0.25 }))
  g.appendChild(el('line', { x1: x2, y1: y - 0.25, x2, y2: y + 0.25 }))
  const t = label((x1 + x2) / 2, y + 0.62, l, 0.42, c || '#6B747C', 'middle'); t.setAttribute('stroke', 'none'); g.appendChild(t); return g
}
function dimV(x, y1, y2, l, c) {
  const g = el('g', { stroke: '#8E979F', 'stroke-width': 0.03 })
  g.appendChild(el('line', { x1: x, y1, x2: x, y2 }))
  g.appendChild(el('line', { x1: x - 0.25, y1, x2: x + 0.25, y2: y1 }))
  g.appendChild(el('line', { x1: x - 0.25, y1: y2, x2: x + 0.25, y2 }))
  const t = label(x + 0.3, (y1 + y2) / 2 + 0.15, l, 0.42, c || '#6B747C', 'start'); t.setAttribute('stroke', 'none'); g.appendChild(t); return g
}

/** The stage and everything on it, shared by both plates. `detail` adds the grid, dims and notes. */
function stageDrawing(detail) {
  const g = el('g', {})
  // backstage first (lowest), then the deck on top, then the forestage
  g.appendChild(el('path', { d: pathOf(DECK_OUTLINE, true), fill: P.deck, stroke: P.line, 'stroke-width': 0.09 }))
  // the backstage band reads a shade darker, behind the wings
  g.appendChild(rectUp(-MAIN.backW / 2, MAIN.backW / 2, MAIN.midD, MAIN.backD, { fill: '#D2D7DB', stroke: 'none' }))
  // stairs: five treads either side
  for (const sx of [-1, 1]) for (let i = 0; i < STAIR.treads; i++) {
    const x0 = sx * MAIN.frontW / 2, x1 = sx * (MAIN.frontW / 2 + STAIR.w)
    g.appendChild(rectUp(x0, x1, i * STAIR.tread, (i + 1) * STAIR.tread, { fill: i % 2 ? '#D4D9DD' : '#CDD3D8', stroke: P.line, 'stroke-width': 0.03 }))
  }
  // forestage: 4 × 4 decks
  g.appendChild(rectUp(-FORE.w / 2, FORE.w / 2, -FORE.d, 0, { fill: P.deck2, stroke: P.line, 'stroke-width': 0.08 }))
  if (detail) {
    const cw = FORE.w / FORE.cols, rh = FORE.d / FORE.rows
    for (let c = 1; c < FORE.cols; c++) g.appendChild(el('line', { x1: -FORE.w / 2 + c * cw, y1: SY(0), x2: -FORE.w / 2 + c * cw, y2: SY(-FORE.d), stroke: '#B4BBC1', 'stroke-width': 0.03 }))
    for (let r = 1; r < FORE.rows; r++) g.appendChild(el('line', { x1: -FORE.w / 2, y1: SY(-r * rh), x2: FORE.w / 2, y2: SY(-r * rh), stroke: '#B4BBC1', 'stroke-width': 0.03 }))
    // 1 m grid on the main deck
    const grid = el('g', { stroke: '#C6CCD1', 'stroke-width': 0.022 })
    for (let x = -13; x <= 13; x++) grid.appendChild(el('line', { x1: x, y1: SY(0), x2: x, y2: SY(MAIN.midD) }))
    for (let u = 1; u < MAIN.midD; u++) grid.appendChild(el('line', { x1: -MAIN.midW / 2, y1: SY(u), x2: MAIN.midW / 2, y2: SY(u) }))
    g.appendChild(grid)
  }
  // cordons at the deck ends
  for (const sx of [-1, 1]) g.appendChild(el('line', { x1: sx * CORDON.x0, y1: SY(0), x2: sx * CORDON.x1, y2: SY(0), stroke: '#8A8270', 'stroke-width': 0.12 }))
  // curtain wings and the drape
  for (const sx of [-1, 1]) g.appendChild(el('line', { x1: sx * WING.x0, y1: SY(WING.at), x2: sx * WING.x1, y2: SY(WING.at), stroke: '#2A2420', 'stroke-width': 0.18 }))
  g.appendChild(el('line', { x1: -DRAPE.x, y1: SY(DRAPE.at), x2: DRAPE.x, y2: SY(DRAPE.at), stroke: '#2A2420', 'stroke-width': 0.1, 'stroke-dasharray': '0.5 0.3' }))
  // the LED: a solid bar on its face line
  g.appendChild(rectUp(LED.x[0], LED.x[1], -LED.z - 0.05, -LED.z + 0.2, { fill: P.led }))
  // the cabin: plinth, walls, glass front, chair
  g.appendChild(rectUp(CABIN.x[0], CABIN.x[1], -CABIN.z[1], -CABIN.z[0], { fill: '#E9E5DA', stroke: '#8E8776', 'stroke-width': 0.08 }))
  g.appendChild(el('line', { x1: CABIN.x[0] + 0.12, y1: SY(-CABIN.z[1]), x2: CABIN.x[1] - 0.12, y2: SY(-CABIN.z[1]), stroke: '#6FA3BE', 'stroke-width': 0.14 }))  // glass front
  g.appendChild(rectUp(CHAIR.x - 0.39, CHAIR.x + 0.39, -CHAIR.z - 0.36, -CHAIR.z + 0.36, { fill: '#C8761B', stroke: '#8C5210', 'stroke-width': 0.05, rx: 0.08 }))
  // centre line
  g.appendChild(el('line', { x1: 0, y1: SY(MAIN.backD), x2: 0, y2: SY(-FORE.d - 1), stroke: '#8E979F', 'stroke-width': 0.035, 'stroke-dasharray': '0.5 0.35' }))
  return g
}

/** The stage plate: the drawing with levels, dimensions and a written schedule. */
export function stagePlate() {
  const g = el('g', {})
  g.appendChild(stageDrawing(true))
  const S = STAGE
  // levels and names
  g.appendChild(label(-9, SY(0.7), `main stage  +${S.deckH} m`, 0.5, '#68727B', 'start'))
  g.appendChild(label(-21.5, SY(5.2), `backstage  +${S.deckH} m`, 0.46, '#68727B', 'start'))
  g.appendChild(label(0, SY(-FORE.d - 0.65), `forestage  ${FORE.w} × ${FORE.d.toFixed(2)} m  ·  +${S.foreH} m`, 0.44, '#68727B', 'middle'))
  g.appendChild(label(0, SY(-CABIN.z[0] + 0.55), `cabin ${(CABIN.x[1] - CABIN.x[0]).toFixed(2)} × ${(CABIN.z[1] - CABIN.z[0]).toFixed(2)} m · floor +${CABIN.y[0]} m · glass front`, 0.36, '#6E6858', 'middle'))
  g.appendChild(label(0, SY(-LED.z - 0.75), `BACK LED  ${LED.w} × ${LED.h} m  ·  ${LED.px[0]} × ${LED.px[1]} px  ·  +${LED.y[0]} → +${LED.y[1]} m`, 0.44, '#3E4A55', 'middle'))
  for (const sx of [-1, 1]) g.appendChild(label(sx * 17, SY(WING.at + 0.45), 'curtain wing', 0.36, '#5A5048', 'middle'))
  for (const sx of [-1, 1]) g.appendChild(label(sx * (MAIN.frontW / 2 + STAIR.w / 2), SY(-0.55), `stairs ×${STAIR.treads}`, 0.32, '#7B858E', 'middle'))
  for (const sx of [-1, 1]) g.appendChild(label(sx * 17.6, SY(-0.55), 'cordon', 0.32, '#8A8270', 'middle'))
  g.appendChild(label(-MAIN.midW / 2 + 0.3, SY(2.7), 'SR', 0.55, '#98A1A9', 'start'))
  g.appendChild(label(MAIN.midW / 2 - 0.3, SY(2.7), 'SL', 0.55, '#98A1A9', 'end'))
  g.appendChild(label(-MAIN.frontW / 2 - 0.2, SY(-5.7), 'audience  ↓', 0.46, '#8A939B', 'start'))
  // dimensions
  g.appendChild(dimH(-MAIN.frontW / 2, MAIN.frontW / 2, SY(-FORE.d) + 1.6, `${MAIN.frontW} m stage front`))
  g.appendChild(dimH(-MAIN.midW / 2, MAIN.midW / 2, SY(-FORE.d) + 2.4, `${MAIN.midW} m over the stairs`))
  g.appendChild(dimH(LED.x[0], LED.x[1], SY(MAIN.backD) - 0.85, `LED ${LED.w} m`))
  g.appendChild(dimV(MAIN.backW / 2 + 0.6, SY(MAIN.backD), SY(0), `${MAIN.backD} m`))
  g.appendChild(dimV(FORE.w / 2 + 0.6, SY(0), SY(-FORE.d), `${FORE.d.toFixed(2)} m`))
  // schedule under the plan, two columns
  const lines = [
    [`Main stage  ${MAIN.frontW} × ${MAIN.frontD} m front, ${MAIN.midW} × ${(MAIN.midD - MAIN.frontD).toFixed(2)} m mid, top +${S.deckH} m`],
    [`Stairs ${STAIR.treads} × ${Math.round(STAIR.rise * 1000)} mm each side  ·  backstage ${MAIN.backW} × ${(MAIN.backD - MAIN.midD).toFixed(2)} m, ${MAIN.backD} m to the back wall`],
    [`Forestage  ${FORE.cols} × ${FORE.rows} decks, ${FORE.w} × ${FORE.d.toFixed(2)} m, +${S.foreH} m`],
    [`Cordons at the deck ends  ·  curtain wings ${(WING.x1 - WING.x0).toFixed(2)} m each at ${WING.at} m upstage`],
    [`Back LED  ${LED.w} × ${LED.h} m, ${LED.px[0]} × ${LED.px[1]} px, P${LED.pitchMm}, bottom +${LED.y[0]} m`],
    [`  ${(-LED.z).toFixed(1)} m upstage of the front edge, drape behind it`],
    [`Cabin  glass box ${(CABIN.x[1] - CABIN.x[0]).toFixed(2)} × ${(CABIN.z[1] - CABIN.z[0]).toFixed(2)} m on a ${CABIN.plinthH} m plinth, floor +${CABIN.y[0]} m`],
    [`  chair on the centreline, ${(-CHAIR.z).toFixed(1)} m upstage  ·  hall ${HALL.w} × ${HALL.d} m, walls ${HALL.wallH} m`, '#98A1A9'],
  ]
  lines.forEach(([t, c], i) => {
    const col = i < 4 ? 0 : 1
    g.appendChild(label(col ? 0.6 : -23.4, SY(-7.9) - 0.2 + (i % 4) * 0.72, t, 0.4, c || '#5F6971', 'start'))
  })
  g.appendChild(label(-23.4, SY(-7.9) + 3.2, 'drawing: haveli-stage.obj · positions are metres from the centreline and the stage front edge', 0.36, '#98A1A9', 'start'))
  return g
}

/** The hall plate: the whole room, the stage at the top, every seat drawn. */
export function hallPlate(hall) {
  const g = el('g', {})
  // floor and walls
  g.appendChild(rectUp(-HALL.w / 2, HALL.w / 2, -HALL.floorZ[1], -HALL.floorZ[0], { fill: P.floorTint, stroke: 'none' }))
  g.appendChild(rectUp(-HALL.w / 2, HALL.w / 2, -HALL.floorZ[1] - 0.4, -HALL.floorZ[1], { fill: '#8F8778' }))   // front wall (far end)
  g.appendChild(rectUp(-HALL.w / 2, HALL.w / 2, -HALL.floorZ[0], -HALL.floorZ[0] + 0.4, { fill: '#8F8778' }))   // back wall
  g.appendChild(stageDrawing(false))
  g.appendChild(label(-8, SY(2.35), 'STAGE', 1.3, '#5D6872', 'start', { 'font-weight': '700' }))
  g.appendChild(label(0, SY(-LED.z - 0.9), `back LED ${LED.w} m`, 0.7, P.dim, 'middle'))
  // seating
  for (const b of hall.blocks) {
    g.appendChild(el('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 0.25, fill: '#E3E7EA', stroke: P.hair, 'stroke-width': 0.07 }))
    let d = ''
    const sz = 0.38, h = sz / 2
    for (let r = 0; r < b.rows; r++) for (let s = 0; s < b.seats; s++) { const c = seatXY(b, r, s); d += `M${(c.x - h).toFixed(2)} ${(c.y - h).toFixed(2)}h${sz}v${sz}h-${sz}z` }
    g.appendChild(el('path', { d, fill: P.seat, stroke: 'none' }))
    const bs = Math.min(b.w, b.h) * 0.42
    g.appendChild(label(b.x + b.w / 2, b.y + b.h / 2 + bs * 0.35, b.id, bs, '#5A646D', 'middle', { 'font-weight': '700', opacity: 0.4, 'pointer-events': 'none' }))
    for (let r = 0; r < b.rows; r++) {
      const a = seatXY(b, r, 0), z = seatXY(b, r, b.seats - 1)
      if (b.edgeL !== false) g.appendChild(label(a.x - 0.55, a.y + 0.16, rowLabel(b, r), 0.4, '#8A939B', 'end'))
      if (b.edgeR !== false) g.appendChild(label(z.x + 0.55, z.y + 0.16, rowLabel(b, r), 0.4, '#8A939B', 'start'))
    }
    for (let s = 0; s < b.seats; s++) {
      const n = seatLabel(b, s)
      if (n % 5 !== 0 && s !== 0 && s !== b.seats - 1) continue
      const a = seatXY(b, 0, s)
      g.appendChild(label(a.x, a.y - 0.5, n, 0.38, '#96A0A8', 'middle'))
    }
  }
  // scale bar and the room's size
  const bx = -HALL.w / 2 + 1.5, by = SY(-HALL.floorZ[1]) - 1.2
  g.appendChild(el('line', { x1: bx, y1: by, x2: bx + 10, y2: by, stroke: '#7C868E', 'stroke-width': 0.12 }))
  for (const o of [0, 10]) g.appendChild(el('line', { x1: bx + o, y1: by - 0.5, x2: bx + o, y2: by + 0.5, stroke: '#7C868E', 'stroke-width': 0.12 }))
  g.appendChild(label(bx + 5, by - 0.8, '10 m', 0.9, '#7C868E', 'middle'))
  g.appendChild(dimH(-HALL.w / 2, HALL.w / 2, SY(-HALL.floorZ[1]) + 2.2, `hall ${HALL.w} m`, '#7C868E'))
  return g
}
