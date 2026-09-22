/**
 * The wristband emulator's model: every seat in the hall as one wristband,
 * a zone (1–9, or 0 for none) per seat, a colour and an effect per zone.
 *
 * Frame: x metres across the hall (+ = house right, the OBJ's +X), y metres
 * in front of the main stage's front edge (+ = into the audience). The seats
 * come from the same seating spec the blocking tool draws, so a "zone" here
 * is exactly a set of blocking positions.
 */
import { buildHall, DEFAULT_VENUE, DECK_OUTLINE, STAGE_TOP, seatXY } from '@/lib/blocking/geometry'
import { CABIN, CHAIR, HALL, LED, STAGE } from '@/lib/venue'
import { clamp } from '@/lib/utils'

export type Seat = { i: number; block: string; r: number; s: number; x: number; y: number }
export type Block = { id: string; x: number; y: number; w: number; h: number; rows: number; seats: number; first: number; count: number }
export type Hall = {
  seats: Seat[]
  blocks: Block[]
  /** Seating extent, metres. */
  ext: { x0: number; x1: number; y0: number; y1: number }
  /** The whole room. */
  room: { x0: number; x1: number; y0: number; y1: number }
  crossAisle: number
}

/** Seats from the blocking tool's seating model, in this module's frame. */
export function buildSeats(venue: unknown = DEFAULT_VENUE): Hall {
  const h = buildHall(venue) as { blocks: Array<Record<string, number> & { id: string }>; crossAisle: number }
  const seats: Seat[] = []
  const blocks: Block[] = []
  for (const b of h.blocks) {
    const first = seats.length
    for (let r = 0; r < b.rows; r++) {
      for (let s = 0; s < b.seats; s++) {
        const p = seatXY(b, r, s) as { x: number; y: number }
        seats.push({ i: seats.length, block: b.id, r, s, x: p.x, y: p.y - STAGE_TOP })
      }
    }
    blocks.push({ id: b.id, x: b.x, y: b.y - STAGE_TOP, w: b.w, h: b.h, rows: b.rows, seats: b.seats, first, count: seats.length - first })
  }
  const xs = seats.map((s) => s.x), ys = seats.map((s) => s.y)
  const ext = seats.length
    ? { x0: Math.min(...xs) - 0.3, x1: Math.max(...xs) + 0.3, y0: Math.min(...ys) - 0.5, y1: Math.max(...ys) + 0.5 }
    : { x0: -HALL.w / 2, x1: HALL.w / 2, y0: 0, y1: HALL.floorZ[1] }
  return { seats, blocks, ext, room: { x0: -HALL.w / 2, x1: HALL.w / 2, y0: -STAGE.depth - 0.4, y1: HALL.floorZ[1] }, crossAisle: h.crossAisle }
}

/** Plan furniture for the drawing, in the same frame. */
export const PLAN = {
  deck: DECK_OUTLINE.map(([x, up]) => [x, -up] as [number, number]),
  fore: { x0: -STAGE.foreW / 2, x1: STAGE.foreW / 2, y0: 0, y1: STAGE.foreD },
  led: { x0: LED.x[0], x1: LED.x[1], y: LED.z },
  cabin: { x0: CABIN.x[0], x1: CABIN.x[1], y0: CABIN.z[0], y1: CABIN.z[1] },
  chair: { x: CHAIR.x, y: CHAIR.z },
}

/* ---- zones ----------------------------------------------------------------- */

export const ZONE_COUNT = 9
export type Fx = 'solid' | 'pulse' | 'pulseFast' | 'flash' | 'strobe' | 'twinkle' | 'off'
export const FX: { id: Fx; label: string; hint: string }[] = [
  { id: 'solid', label: 'Solid', hint: 'Steady colour' },
  { id: 'pulse', label: 'Slow pulse', hint: 'Breathes over about four seconds' },
  { id: 'pulseFast', label: 'Fast pulse', hint: 'One beat a second' },
  { id: 'flash', label: 'Flash', hint: 'A hit every two seconds, then fades' },
  { id: 'strobe', label: 'Strobe', hint: 'Ten flashes a second' },
  { id: 'twinkle', label: 'Twinkle', hint: 'Each band sparkles on its own' },
  { id: 'off', label: 'Off', hint: 'Dark' },
]

export type Zone = { id: number; name: string; color: string; fx: Fx; level: number }
export type ChaseMode = 'none' | 'seq' | 'pingpong' | 'build' | 'random'
export const CHASES: { id: ChaseMode; label: string; hint: string }[] = [
  { id: 'none', label: 'None', hint: 'Every zone runs its own effect' },
  { id: 'seq', label: 'Chase 1→9', hint: 'One zone at a time, in order' },
  { id: 'pingpong', label: 'Bounce', hint: '1→9→1' },
  { id: 'build', label: 'Build', hint: 'Zones join one by one, then reset' },
  { id: 'random', label: 'Random', hint: 'A random zone each step' },
]

export type WbState = {
  v: 1
  zones: Zone[]
  /** One zone digit per seat, run-length encoded: "1x40,2x12,0x8". */
  map: string
  chase: { mode: ChaseMode; step: number; floor: number }
  master: number
  speed: number
  glow: number
  labels: boolean
  plan: boolean
  seatSize: number
}

/** Nine distinguishable colours to start with — swap any of them. */
export const DEFAULT_COLORS = ['#ff7a00', '#ffc63d', '#ff2a2a', '#ff2e88', '#7b4dff', '#286eff', '#12d8e8', '#1ee8a0', '#fff4e0']

export const defaultZones = (): Zone[] =>
  Array.from({ length: ZONE_COUNT }, (_, i) => ({ id: i + 1, name: `Zone ${i + 1}`, color: DEFAULT_COLORS[i], fx: 'solid' as Fx, level: 1 }))

export const STORE_KEY = 'haveli-wristbands-v1'

/* ---- the map: a Uint8Array of zone ids, RLE'd for storage ------------------ */

export function encodeMap(m: Uint8Array): string {
  const out: string[] = []
  let i = 0
  while (i < m.length) {
    const z = m[i]
    let n = 1
    while (i + n < m.length && m[i + n] === z) n++
    out.push(n === 1 ? String(z) : `${z}x${n}`)
    i += n
  }
  return out.join(',')
}
export function decodeMap(s: string, n: number): Uint8Array {
  const m = new Uint8Array(n)
  let i = 0
  for (const tok of (s || '').split(',')) {
    if (!tok) continue
    const [z, c] = tok.split('x')
    const zone = clamp(parseInt(z, 10) || 0, 0, ZONE_COUNT)
    const count = c ? Math.max(0, parseInt(c, 10) || 0) : 1
    for (let k = 0; k < count && i < n; k++) m[i++] = zone
  }
  return m
}

/* ---- preset layouts ---------------------------------------------------------- */

export type Preset = { id: string; label: string; hint: string; zone: (s: Seat, hall: Hall) => number }
const bin9 = (t: number) => clamp(Math.floor(t * 9), 0, 8) + 1
const bin3 = (t: number) => clamp(Math.floor(t * 3), 0, 2)
const spanX = (h: Hall, x: number) => (x - h.ext.x0) / (h.ext.x1 - h.ext.x0)
const spanY = (h: Hall, y: number) => (y - h.ext.y0) / (h.ext.y1 - h.ext.y0)
const origin = PLAN.chair
const dist = (s: Seat) => Math.hypot(s.x - origin.x, s.y - origin.y)
const ang = (s: Seat) => Math.atan2(s.x - origin.x, s.y - origin.y) // 0 = straight down the hall

export const PRESETS: Preset[] = [
  { id: 'grid', label: 'Grid 3 × 3', hint: 'Left / centre / right by front / middle / back; 1–3 nearest the stage', zone: (s, h) => 1 + bin3(spanY(h, s.y)) * 3 + bin3(spanX(h, s.x)) },
  { id: 'stripes', label: 'Stripes', hint: 'Nine columns, house left to house right', zone: (s, h) => bin9(spanX(h, s.x)) },
  { id: 'bands', label: 'Bands', hint: 'Nine rows of zones, front to back', zone: (s, h) => bin9(spanY(h, s.y)) },
  {
    id: 'rings', label: 'Rings', hint: 'Nine rings out from the chair — chase them for a ripple',
    zone: (s, h) => { const d = h.seats.map(dist); const lo = Math.min(...d), hi = Math.max(...d); return bin9((dist(s) - lo) / (hi - lo + 1e-6)) },
  },
  {
    id: 'fan', label: 'Fan', hint: 'Nine wedges from the chair, house left to house right',
    zone: (s, h) => { const a = h.seats.map(ang); const lo = Math.min(...a), hi = Math.max(...a); return bin9((ang(s) - lo) / (hi - lo + 1e-6)) },
  },
  { id: 'sections', label: 'Sections', hint: 'FL, FR, BL, BR as zones 1–4', zone: (s, h) => 1 + h.blocks.findIndex((b) => b.id === s.block) },
  { id: 'checker', label: 'Checker', hint: 'Alternating 3 × 3 cells of two zones', zone: (s, h) => ((bin3(spanY(h, s.y)) + bin3(spanX(h, s.x))) % 2 ? 2 : 1) },
  { id: 'clear', label: 'Clear', hint: 'No zones', zone: () => 0 },
]

export function applyPreset(p: Preset, hall: Hall): Uint8Array {
  const m = new Uint8Array(hall.seats.length)
  // presets that scan the whole hall per seat are cheap enough at ~2k seats, but memoise the two that do
  for (const s of hall.seats) m[s.i] = clamp(p.zone(s, hall), 0, ZONE_COUNT)
  return m
}

/* ---- looks: whole-hall starting points ------------------------------------- */

export type Look = { id: string; label: string; apply: (s: WbState) => WbState }
const allFx = (s: WbState, fx: Fx) => ({ ...s, zones: s.zones.map((z) => ({ ...z, fx })) })
const allColor = (s: WbState, color: string, fx: Fx = 'solid') => ({ ...s, zones: s.zones.map((z) => ({ ...z, color, fx, level: 1 })) })
export const LOOKS: Look[] = [
  { id: 'rainbow', label: 'Nine colours', apply: (s) => ({ ...s, zones: s.zones.map((z, i) => ({ ...z, color: DEFAULT_COLORS[i], fx: 'solid', level: 1 })), chase: { ...s.chase, mode: 'none' }, master: 1 }) },
  { id: 'saffron', label: 'Saffron wash', apply: (s) => ({ ...allColor(s, '#ff7a00'), chase: { ...s.chase, mode: 'none' }, master: 1 }) },
  { id: 'breathe', label: 'Slow breathe', apply: (s) => ({ ...allFx(s, 'pulse'), chase: { ...s.chase, mode: 'none' }, master: 1 }) },
  { id: 'aarti', label: 'Aarti twinkle', apply: (s) => ({ ...allColor(s, '#ffc63d', 'twinkle'), chase: { ...s.chase, mode: 'none' }, master: 1 }) },
  { id: 'chase', label: 'Chase', apply: (s) => ({ ...allFx(s, 'solid'), chase: { mode: 'seq', step: 0.5, floor: 0.08 }, master: 1 }) },
  { id: 'ripple', label: 'Ripple', apply: (s) => ({ ...allColor(s, '#12d8e8'), chase: { mode: 'seq', step: 0.18, floor: 0.12 }, master: 1 }) },
  { id: 'hit', label: 'Flash all', apply: (s) => ({ ...allFx(s, 'flash'), chase: { ...s.chase, mode: 'none' }, master: 1 }) },
  { id: 'off', label: 'Blackout', apply: (s) => ({ ...s, master: 0 }) },
]

/* ---- state ------------------------------------------------------------------- */

export function defaultState(hall: Hall): WbState {
  return {
    v: 1,
    zones: defaultZones(),
    map: encodeMap(applyPreset(PRESETS[0], hall)),
    chase: { mode: 'none', step: 0.5, floor: 0.08 },
    master: 1, speed: 1, glow: 0.6, labels: true, plan: true, seatSize: 1,
  }
}

const isHex = (s: unknown): s is string => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s)
const num = (v: unknown, d: number, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : d)

/** Anything (a saved doc, a link, garbage) → a valid state. */
export function coerce(input: unknown, hall: Hall): WbState {
  const d = defaultState(hall)
  if (!input || typeof input !== 'object') return d
  const o = input as Partial<WbState> & Record<string, unknown>
  const zones = d.zones.map((z, i) => {
    const q = (Array.isArray(o.zones) ? o.zones[i] : null) as Partial<Zone> | null
    if (!q) return z
    return {
      id: z.id,
      name: typeof q.name === 'string' && q.name.trim() ? q.name.slice(0, 24) : z.name,
      color: isHex(q.color) ? q.color.toLowerCase() : z.color,
      fx: FX.some((f) => f.id === q.fx) ? (q.fx as Fx) : z.fx,
      level: num(q.level, 1, 0, 1),
    }
  })
  const c = (o.chase || {}) as Partial<WbState['chase']>
  return {
    v: 1,
    zones,
    map: typeof o.map === 'string' ? encodeMap(decodeMap(o.map, hall.seats.length)) : d.map,
    chase: { mode: CHASES.some((x) => x.id === c.mode) ? (c.mode as ChaseMode) : 'none', step: num(c.step, 0.5, 0.05, 5), floor: num(c.floor, 0.08, 0, 1) },
    master: num(o.master, 1, 0, 1),
    speed: num(o.speed, 1, 0.1, 4),
    glow: num(o.glow, 0.6, 0, 1),
    labels: typeof o.labels === 'boolean' ? o.labels : true,
    plan: typeof o.plan === 'boolean' ? o.plan : true,
    seatSize: num(o.seatSize, 1, 0.5, 2),
  }
}

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64 = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))
export const encodeShare = (s: WbState) => b64(JSON.stringify(s))
export function decodeShare(hash: string, hall: Hall): WbState | null {
  const m = /[#&]s=([A-Za-z0-9_-]+)/.exec(hash)
  if (!m) return null
  try { return coerce(JSON.parse(unb64(m[1])), hall) } catch { return null }
}

/* ---- effects: brightness 0–1 for a zone at time t ----------------------------- */

const TAU = Math.PI * 2
export function fxLevel(fx: Fx, t: number): number {
  switch (fx) {
    case 'solid': return 1
    case 'pulse': return 0.15 + 0.85 * (0.5 + 0.5 * Math.sin((TAU * t) / 4 - Math.PI / 2))
    case 'pulseFast': return 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(TAU * t - Math.PI / 2))
    case 'flash': { const p = t % 2; return p < 0.08 ? 1 : 0.06 + 0.94 * Math.exp(-(p - 0.08) * 6) }
    case 'strobe': return (t * 10) % 1 < 0.35 ? 1 : 0
    case 'twinkle': return 0.35 // per-seat sparkle is added in the renderer
    case 'off': return 0
  }
}
/** A cheap per-seat phase for twinkle, stable across frames. */
export const seatPhase = (i: number) => ((i * 2654435761) >>> 0) / 4294967296
export function twinkle(i: number, t: number): number {
  const ph = seatPhase(i)
  const w = Math.sin(TAU * (t * (0.35 + ph * 0.5) + ph))
  return 0.18 + 0.82 * Math.pow(Math.max(0, w), 10)
}

/** Which zones the chase lights at time t, as a 0–1 multiplier per zone id (index 1–9). */
export function chaseLevels(mode: ChaseMode, step: number, floor: number, t: number, present: boolean[]): number[] {
  const out = new Array(ZONE_COUNT + 1).fill(1)
  if (mode === 'none') return out
  const ids = present.map((p, i) => (p && i > 0 ? i : 0)).filter(Boolean)
  const n = ids.length
  if (!n) return out
  const k = Math.floor(t / Math.max(0.05, step))
  for (let i = 1; i <= ZONE_COUNT; i++) out[i] = floor
  if (mode === 'seq') out[ids[k % n]] = 1
  else if (mode === 'pingpong') { const m = n > 1 ? 2 * n - 2 : 1; const j = k % m; out[ids[j < n ? j : m - j]] = 1 }
  else if (mode === 'build') { const j = k % (n + 1); for (let i = 0; i < j; i++) out[ids[i]] = 1 }
  else if (mode === 'random') { const r = ((k * 2654435761) >>> 0) % n; out[ids[r]] = 1 }
  return out
}

/* ---- colours ----------------------------------------------------------------- */

export const hexRgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
export const rgbHex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('')

/**
 * k-means over one sample per seat: finds the k most distinct colours in an
 * image and which seat sits on which. Deterministic (seeded by spread), so
 * the same picture gives the same zones every time.
 */
export function kmeans(samples: Array<[number, number, number]>, k: number, iters = 24): { centres: Array<[number, number, number]>; labels: Int16Array } {
  const n = samples.length
  const labels = new Int16Array(n)
  if (!n) return { centres: [], labels }
  const d2 = (a: [number, number, number], b: [number, number, number]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
  // k-means++ without randomness: farthest-point seeding from the first sample
  const centres: Array<[number, number, number]> = [samples[0]]
  while (centres.length < k) {
    let best = 0, bd = -1
    for (let i = 0; i < n; i++) {
      let m = Infinity
      for (const c of centres) m = Math.min(m, d2(samples[i], c))
      if (m > bd) { bd = m; best = i }
    }
    if (bd <= 0) break
    centres.push(samples[best])
  }
  for (let it = 0; it < iters; it++) {
    const sum = centres.map(() => [0, 0, 0, 0])
    for (let i = 0; i < n; i++) {
      let bi = 0, bd = Infinity
      for (let c = 0; c < centres.length; c++) { const d = d2(samples[i], centres[c]); if (d < bd) { bd = d; bi = c } }
      labels[i] = bi
      const s = sum[bi]; s[0] += samples[i][0]; s[1] += samples[i][1]; s[2] += samples[i][2]; s[3]++
    }
    for (let c = 0; c < centres.length; c++) if (sum[c][3]) centres[c] = [sum[c][0] / sum[c][3], sum[c][1] / sum[c][3], sum[c][2] / sum[c][3]]
  }
  return { centres, labels }
}

/** Nearest zone by colour, or 0 if nothing is within `tol` (0–441). */
export function nearestZone(rgb: [number, number, number], zones: Zone[], tol: number): number {
  let best = 0, bd = tol * tol
  for (const z of zones) {
    const c = hexRgb(z.color)
    const d = (rgb[0] - c[0]) ** 2 + (rgb[1] - c[1]) ** 2 + (rgb[2] - c[2]) ** 2
    if (d < bd) { bd = d; best = z.id }
  }
  return best
}
