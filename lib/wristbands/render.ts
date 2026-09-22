/**
 * Draws the hall from above onto a 2D canvas: the room, the stage, the
 * seating sections, and one glowing dot per wristband, coloured by zone and
 * dimmed by that zone's effect and the chase.
 */
import { PLAN, chaseLevels, fxLevel, hexRgb, twinkle, type Hall, type WbState, ZONE_COUNT } from './model'

export type View = { cx: number; cy: number; scale: number } // world → screen: sx = W/2 + (x − cx)·scale
export type Underlay = { img: CanvasImageSource; x: number; y: number; w: number; h: number; alpha: number } | null

export const toScreen = (v: View, W: number, H: number, x: number, y: number) => [W / 2 + (x - v.cx) * v.scale, H / 2 + (y - v.cy) * v.scale] as const
export const toWorld = (v: View, W: number, H: number, sx: number, sy: number) => [(sx - W / 2) / v.scale + v.cx, (sy - H / 2) / v.scale + v.cy] as const

/** A view that shows the whole room with a margin, centred in the canvas right of `inset` px (the side panel). */
export function fitView(hall: Hall, W: number, H: number, pad = 36, inset = 0): View {
  const r = hall.room
  const w = r.x1 - r.x0, h = r.y1 - r.y0
  const scale = Math.min((W - inset - pad * 2) / w, (H - pad * 2) / h)
  return { cx: (r.x0 + r.x1) / 2 - inset / 2 / scale, cy: (r.y0 + r.y1) / 2, scale }
}

const INK = { bg: '#0f0e0c', wall: '#3a352f', floor: '#151311', deck: '#221e1a', deckLine: '#5a5148', led: '#8a7a68', cabin: '#3b3a45', chair: '#c9a27a', block: '#2a2621', aisle: '#2f2a24', label: '#8d8579', seatOff: '#2b2723' }

export type FrameOut = { present: boolean[]; counts: number[] }

/**
 * One frame. `map` is the live zone-per-seat array (not the RLE string), `t`
 * is seconds. Returns which zones have seats, for the chase and the panel.
 */
export function drawFrame(ctx: CanvasRenderingContext2D, W: number, H: number, view: View, hall: Hall, map: Uint8Array, s: WbState, t: number, under: Underlay, hover?: number | null): FrameOut {
  const S = (x: number, y: number) => toScreen(view, W, H, x, y)
  const k = view.scale
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = INK.bg
  ctx.fillRect(0, 0, W, H)

  // the room
  const r = hall.room
  const [rx0, ry0] = S(r.x0, r.y0), [rx1, ry1] = S(r.x1, r.y1)
  ctx.fillStyle = INK.floor
  ctx.fillRect(rx0, ry0, rx1 - rx0, ry1 - ry0)

  if (under) {
    const [ux, uy] = S(under.x, under.y)
    ctx.save(); ctx.globalAlpha = under.alpha; ctx.imageSmoothingEnabled = true
    ctx.drawImage(under.img, ux, uy, under.w * k, under.h * k)
    ctx.restore()
  }

  if (s.plan) {
    // stage deck, forestage, LED, cabin, chair
    ctx.fillStyle = INK.deck; ctx.strokeStyle = INK.deckLine; ctx.lineWidth = 1
    ctx.beginPath()
    PLAN.deck.forEach(([x, y], i) => { const [px, py] = S(x, y); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py) })
    ctx.closePath(); ctx.fill(); ctx.stroke()
    const f = PLAN.fore; const [fx0, fy0] = S(f.x0, f.y0), [fx1, fy1] = S(f.x1, f.y1)
    ctx.fillRect(fx0, fy0, fx1 - fx0, fy1 - fy0); ctx.strokeRect(fx0, fy0, fx1 - fx0, fy1 - fy0)
    const l = PLAN.led; const [lx0, ly] = S(l.x0, l.y), [lx1] = S(l.x1, l.y)
    ctx.strokeStyle = INK.led; ctx.lineWidth = Math.max(2, 0.25 * k); ctx.beginPath(); ctx.moveTo(lx0, ly); ctx.lineTo(lx1, ly); ctx.stroke()
    const c = PLAN.cabin; const [cx0, cy0] = S(c.x0, c.y0), [cx1, cy1] = S(c.x1, c.y1)
    ctx.fillStyle = INK.cabin; ctx.globalAlpha = 0.7; ctx.fillRect(cx0, cy0, cx1 - cx0, cy1 - cy0); ctx.globalAlpha = 1
    const [chx, chy] = S(PLAN.chair.x, PLAN.chair.y)
    ctx.fillStyle = INK.chair; ctx.fillRect(chx - 0.45 * k, chy - 0.45 * k, 0.9 * k, 0.9 * k)
    // walls
    ctx.strokeStyle = INK.wall; ctx.lineWidth = Math.max(1.5, 0.3 * k)
    ctx.strokeRect(rx0, ry0, rx1 - rx0, ry1 - ry0)
    // blocks and the cross aisle
    ctx.strokeStyle = INK.block; ctx.lineWidth = 1
    for (const b of hall.blocks) { const [bx, by] = S(b.x, b.y); ctx.strokeRect(bx, by, b.w * k, b.h * k) }
    if (hall.crossAisle) {
      const [, ay] = S(0, hall.crossAisle)
      ctx.strokeStyle = INK.aisle; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(rx0, ay); ctx.lineTo(rx1, ay); ctx.stroke(); ctx.setLineDash([])
    }
    // labels
    ctx.fillStyle = INK.label; ctx.font = `${Math.max(9, Math.min(13, 0.6 * k))}px ui-sans-serif, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    const [sx, sy] = S(0, -1.6); ctx.fillText('STAGE', sx, sy)
    ctx.textAlign = 'left'
    for (const b of hall.blocks) { const [bx, by] = S(b.x, b.y); ctx.fillText(b.id, bx + 3, by - 7) }
  }

  // per-zone brightness this frame
  const present = new Array(ZONE_COUNT + 1).fill(false)
  const counts = new Array(ZONE_COUNT + 1).fill(0)
  for (let i = 0; i < map.length; i++) { present[map[i]] = true; counts[map[i]]++ }
  const chase = chaseLevels(s.chase.mode, s.chase.step / s.speed, s.chase.floor, t, present)
  const ts = t * s.speed
  const bright: number[] = [0]
  const rgb: Array<[number, number, number]> = [[0, 0, 0]]
  for (const z of s.zones) { bright[z.id] = fxLevel(z.fx, ts) * z.level * s.master * chase[z.id]; rgb[z.id] = hexRgb(z.color) }

  // seats
  const rad = Math.max(1.2, 0.24 * k * s.seatSize)
  const glowR = rad * (1.6 + 1.6 * s.glow)
  // off / unassigned
  ctx.fillStyle = INK.seatOff
  for (const seat of hall.seats) {
    if (map[seat.i]) continue
    const [x, y] = S(seat.x, seat.y)
    ctx.beginPath(); ctx.arc(x, y, rad * 0.55, 0, Math.PI * 2); ctx.fill()
  }
  // lit, zone by zone: a soft additive halo then the core
  ctx.globalCompositeOperation = 'lighter'
  for (const z of s.zones) {
    if (!present[z.id]) continue
    const [R, G, B] = rgb[z.id]
    const base = bright[z.id]
    const tw = z.fx === 'twinkle'
    if (!tw && base <= 0.001) continue
    for (const seat of hall.seats) {
      if (map[seat.i] !== z.id) continue
      const b = tw ? base * twinkle(seat.i, ts) / 0.35 : base
      if (b <= 0.001) continue
      const [x, y] = S(seat.x, seat.y)
      if (s.glow > 0) {
        ctx.fillStyle = `rgba(${R},${G},${B},${(0.18 * s.glow * b).toFixed(3)})`
        ctx.beginPath(); ctx.arc(x, y, glowR, 0, Math.PI * 2); ctx.fill()
      }
      ctx.fillStyle = `rgba(${R},${G},${B},${Math.min(1, 0.12 + 0.88 * b).toFixed(3)})`
      ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill()
    }
  }
  ctx.globalCompositeOperation = 'source-over'

  // zone labels at each zone's centroid
  if (s.labels) {
    const sum = Array.from({ length: ZONE_COUNT + 1 }, () => [0, 0, 0])
    for (const seat of hall.seats) { const z = map[seat.i]; if (z) { sum[z][0] += seat.x; sum[z][1] += seat.y; sum[z][2]++ } }
    const fs = Math.max(10, Math.min(30, 0.7 * k))
    ctx.font = `600 ${fs}px ui-sans-serif, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    for (let z = 1; z <= ZONE_COUNT; z++) {
      if (!sum[z][2]) continue
      const [x, y] = S(sum[z][0] / sum[z][2], sum[z][1] / sum[z][2])
      const w = fs * 2.2, h = fs * 1.5
      ctx.fillStyle = 'rgba(15,14,12,0.78)'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, fs * 0.4); ctx.fill()
      ctx.strokeStyle = s.zones[z - 1].color; ctx.lineWidth = Math.max(1, fs / 10); ctx.stroke()
      ctx.fillStyle = '#f3efe6'; ctx.fillText(String(z), x, y + 0.5)
    }
  }

  // hover ring
  if (hover != null && hover >= 0 && hover < hall.seats.length) {
    const seat = hall.seats[hover]; const [x, y] = S(seat.x, seat.y)
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, rad + 3, 0, Math.PI * 2); ctx.stroke()
  }
  ctx.restore()
  return { present, counts }
}
