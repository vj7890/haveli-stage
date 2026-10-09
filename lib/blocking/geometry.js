// @ts-nocheck
/**
 * Plan geometry shared by the stage-setup page and the wristbands page: the
 * Haveli main stage's outline and the hall's seating, read from lib/venue.ts.
 *
 * The seating keeps its original frame: x metres across (+ = house right, the
 * OBJ's +X), and SVG y = STAGE_TOP − metres upstage of the main stage's front
 * edge. Callers convert with `z = y − STAGE_TOP` (z = the OBJ's +Z, metres
 * toward the audience).
 */
import { HALL } from '../venue'

/* ---- the frame ------------------------------------------------------------ */
export const STAGE_TOP = 10                       // svg y of "10 m upstage"
export const SY = (up) => STAGE_TOP - up          // upstage metres → svg y
export const UP = (sy) => STAGE_TOP - sy          // svg y → upstage metres

/* ---- the main stage, in plan (upstage metres) ------------------------------- */
// Numbers off the OBJ. z in the model is toward the audience, so upstage = −z.
export const MAIN = { frontW: 22.5, frontD: 1.45, midW: 26.3, midD: 3.395, backW: 44.2, backD: 7.5 }
export const STAIR = { w: 1.9, treads: 5, tread: 0.29, rise: 0.26 }
export const WING = { x0: 12.01, x1: 22.25, at: 3.7 }
export const DRAPE = { x: 22, at: 7.38 }
export const CORDON = { x0: 13.15, x1: 22.1 }

/** The deck outline as one polygon, [x, upstage] going clockwise from stage right front. */
export const DECK_OUTLINE = [
  [-MAIN.frontW / 2, 0], [MAIN.frontW / 2, 0],
  [MAIN.frontW / 2, MAIN.frontD], [MAIN.midW / 2, MAIN.frontD],
  [MAIN.midW / 2, MAIN.midD], [MAIN.backW / 2, MAIN.midD],
  [MAIN.backW / 2, MAIN.backD], [-MAIN.backW / 2, MAIN.backD],
  [-MAIN.backW / 2, MAIN.midD], [-MAIN.midW / 2, MAIN.midD],
  [-MAIN.midW / 2, MAIN.frontD], [-MAIN.frontW / 2, MAIN.frontD],
]

/* ---- the hall's seating: a compact spec, editable in the Seating dialog ----- */
/**
 * The prayer hall as the ground-floor plan draws it: four sections, two
 * across (either side of the centre line) by two deep (the hall is split
 * 29.85 m from the stage's back wall; 19.3 m beyond that to the far wall).
 * People sit on the carpet in rows facing the stage, so a "seat" here is one
 * sitting position: 0.6 m across, rows 1 m apart. Row 1 is nearest the stage.
 *
 * Columns are across the hall (x, metres, + = house right); bands are how far
 * in front of the main stage's front edge each block starts and ends. Block
 * ids are band + column, e.g. "FL" = front, house left. Change any of it in
 * the Seating dialog — markers already placed stay where they are.
 */
export const DEFAULT_VENUE = {
  seatPitch: 0.6,          // one person sitting, across
  rowPitch: 1.0,           // one row of people sitting, front to back
  columns: [{ id: 'L', x0: -21.0, x1: -1.0 }, { id: 'R', x0: 1.0, x1: 21.0 }],
  bands: [{ id: 'F', from: 7.0, to: 21.5, rowStart: 1 }, { id: 'B', from: 23.5, to: 41.0, rowStart: 15 }],
  crossAisle: 22.35,       // the plan's halfway line, metres in front of the stage front edge
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

/** Lay the blocks out from the spec: one block per band × column, filled with positions at the pitch. */
export function buildHall(V) {
  const blocks = []
  if (V.seats !== false && V.columns?.length && V.bands?.length) {
    const P = V.seatPitch || 0.6, R = V.rowPitch || 1.0
    V.bands.forEach((band) => {
      const rows = Math.max(1, Math.floor((band.to - band.from) / R) + 1)
      V.columns.forEach((col, i) => {
        const seats = Math.max(1, Math.floor((col.x1 - col.x0) / P) + 1)
        const ox = col.x0 + ((col.x1 - col.x0) - (seats - 1) * P) / 2       // centred in the column
        const b = mkBlock({ id: band.id + col.id, ox, oy: SY(-band.from), rvx: 0, rvy: R, svx: P, svy: 0,
          rows, seats, rowStart: band.rowStart || 1, seatStart: 1 })
        b.edgeL = i === 0; b.edgeR = i === V.columns.length - 1   // row numbers only on the outer aisles
        blocks.push(b)
      })
    })
  }
  return { blocks, crossAisle: V.crossAisle, bounds: { x0: -HALL.w / 2, x1: HALL.w / 2, y0: SY(-HALL.floorZ[0]), y1: SY(-HALL.floorZ[1]) } }
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
