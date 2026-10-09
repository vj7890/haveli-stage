/**
 * The Haveli plan, drawn to scale in metres: x across (+ = stage left), z
 * toward the audience from the main stage's front edge. One drawing serves
 * the live page and the PNG export, so what you see is what you export.
 *
 * Text is kept to what a reader needs to orient: LED wall, cabin, the
 * performance stage and its size, the ramps, SR/SL and the audience.
 */
import type { ReactNode } from 'react'
import { buildHall, CORDON, DECK_OUTLINE, DEFAULT_VENUE, DRAPE, MAIN, STAGE_TOP, STAIR, WING, seatXY } from '@/lib/blocking/geometry'
import { CABIN, CHAIR, HALL, LED, PERF, RAMP } from '@/lib/venue'
import { roleOf, type Arrow, type Marker, type Role, type Setup } from '@/lib/blocking/setups'

export type Mode = 'stage' | 'hall'
export type VB = { x: number; y: number; w: number; h: number }

/** What "fit" shows in each mode, and what an export frames. */
export const FIT: Record<Mode, VB> = {
  stage: { x: -17.5, y: -8.1, w: 35, h: 15.2 },
  hall: { x: -24.5, y: -8.6, w: 49, h: 52.4 },
}

/** The live view leaves room under the plan for the toolbar. */
export const liveFit = (m: Mode): VB => { const v = FIT[m], pad = m === 'hall' ? 5 : 2.6; return { ...v, h: v.h + pad } }

const FONT = 'Onest, Helvetica, Arial, sans-serif'
export const C = {
  paper: '#F4F5F2', floor: '#ECEEEF', deck: '#E1E4E7', back: '#D5DADE', line: '#9AA3AB', hair: '#C3CAD0',
  perf: '#EBD3CB', perfLine: '#B88A2E', seam: '#D9B9AE', ramp: '#E6CFC6', chevron: '#B98F84',
  led: '#3E4852', cabin: '#ECE8DE', cabinLine: '#968E7C', glass: '#6FA3BE', chair: '#C8761B',
  text: '#5C6670', faint: '#9AA3AB', ink: '#2F363D', seat: '#C2CAD0',
}

const T = ({ x, y, s, c = C.text, a = 'middle', w, rot, children }: { x: number; y: number; s: number; c?: string; a?: 'start' | 'middle' | 'end'; w?: number; rot?: number; children: ReactNode }) => (
  <text x={x} y={y} fontSize={s} fill={c} textAnchor={a} fontFamily={FONT} fontWeight={w} transform={rot ? `rotate(${rot} ${x} ${y})` : undefined} style={{ pointerEvents: 'none', userSelect: 'none' }}>
    {children}
  </text>
)

/** Rect from x0..x1, z0..z1 (either order). */
const R = ({ x0, x1, z0, z1, ...p }: { x0: number; x1: number; z0: number; z1: number } & React.SVGProps<SVGRectElement>) => (
  <rect x={Math.min(x0, x1)} y={Math.min(z0, z1)} width={Math.abs(x1 - x0)} height={Math.abs(z1 - z0)} {...p} />
)

/* ---- the hall's seats, built once ------------------------------------------ */
type HallBlock = { id: string; x: number; z: number; w: number; h: number; seats: string }
let HALL_CACHE: HallBlock[] | null = null
function hallBlocks(): HallBlock[] {
  if (HALL_CACHE) return HALL_CACHE
  const h = buildHall(DEFAULT_VENUE) as { blocks: Array<Record<string, number> & { id: string }> }
  HALL_CACHE = h.blocks.map((b) => {
    const sz = Math.min(0.34, b.pitchSeat * 0.56), hs = sz / 2
    let d = ''
    for (let r = 0; r < b.rows; r++) for (let s = 0; s < b.seats; s++) {
      const p = seatXY(b, r, s) as { x: number; y: number }
      d += `M${(p.x - hs).toFixed(2)} ${(p.y - STAGE_TOP - hs).toFixed(2)}h${sz}v${sz}h-${sz}z`
    }
    return { id: b.id, x: b.x, z: b.y - STAGE_TOP, w: b.w, h: b.h, seats: d }
  })
  return HALL_CACHE
}

/* ---- the venue ------------------------------------------------------------- */

export function Venue({ mode }: { mode: Mode }) {
  const deck = 'M ' + DECK_OUTLINE.map(([x, up]) => `${x} ${-up}`).join(' L ') + ' Z'
  const pw = PERF.w / 2, pd = PERF.d
  const [dw, dd] = PERF.deckFt
  const cols = PERF.wFt / dw, rows = PERF.dFt / dd
  return (
    <g>
      {mode === 'hall' && (
        <g>
          <R x0={-HALL.w / 2} x1={HALL.w / 2} z0={HALL.floorZ[0]} z1={HALL.floorZ[1]} fill={C.floor} />
          <R x0={-HALL.w / 2} x1={HALL.w / 2} z0={HALL.floorZ[1]} z1={HALL.floorZ[1] + 0.4} fill="#8F8778" />
          <R x0={-HALL.w / 2} x1={HALL.w / 2} z0={HALL.floorZ[0] - 0.4} z1={HALL.floorZ[0]} fill="#8F8778" />
          <line x1={0} y1={PERF.d + 0.6} x2={0} y2={HALL.floorZ[1]} stroke={C.hair} strokeWidth={0.06} strokeDasharray="0.8 0.5" />
          {hallBlocks().map((b) => (
            <g key={b.id}>
              <rect x={b.x} y={b.z} width={b.w} height={b.h} rx={0.25} fill="#E4E8EA" stroke={C.hair} strokeWidth={0.06} />
              <path d={b.seats} fill={C.seat} />
              <T x={b.x + b.w / 2} y={b.z + b.h / 2 + 1.0} s={2.8} c="#A9B1B8" w={700}>{b.id}</T>
            </g>
          ))}
        </g>
      )}

      {/* main stage and backstage */}
      <path d={deck} fill={C.deck} stroke={C.line} strokeWidth={0.08} />
      <R x0={-MAIN.backW / 2} x1={MAIN.backW / 2} z0={-MAIN.midD} z1={-MAIN.backD} fill={C.back} />
      <line x1={-MAIN.frontW / 2} y1={0} x2={MAIN.frontW / 2} y2={0} stroke={C.perfLine} strokeWidth={0.1} />

      {/* stairs at the main stage ends */}
      {[-1, 1].map((sx) =>
        Array.from({ length: STAIR.treads }, (_, i) => (
          <R key={`${sx}${i}`} x0={(sx * MAIN.frontW) / 2} x1={sx * (MAIN.frontW / 2 + STAIR.w)} z0={-i * STAIR.tread} z1={-(i + 1) * STAIR.tread} fill={i % 2 ? '#D6DBDF' : '#CDD3D8'} stroke={C.line} strokeWidth={0.025} />
        )),
      )}

      {/* masking: wings, drape, cordons */}
      {[-1, 1].map((sx) => <line key={`w${sx}`} x1={sx * WING.x0} y1={-WING.at} x2={sx * WING.x1} y2={-WING.at} stroke="#3A332E" strokeWidth={0.16} />)}
      <line x1={-DRAPE.x} y1={-DRAPE.at} x2={DRAPE.x} y2={-DRAPE.at} stroke="#3A332E" strokeWidth={0.08} strokeDasharray="0.5 0.3" opacity={0.6} />
      {[-1, 1].map((sx) => <line key={`c${sx}`} x1={sx * CORDON.x0} y1={0} x2={sx * CORDON.x1} y2={0} stroke="#8A8270" strokeWidth={0.1} />)}

      {/* LED wall */}
      <R x0={LED.x[0]} x1={LED.x[1]} z0={LED.z - 0.2} z1={LED.z + 0.05} fill={C.led} />
      <T x={0} y={LED.z + 0.78} s={0.44} c={C.text}>LED wall</T>

      {/* cabin */}
      <R x0={CABIN.x[0]} x1={CABIN.x[1]} z0={CABIN.z[0]} z1={CABIN.z[1]} fill={C.cabin} stroke={C.cabinLine} strokeWidth={0.07} />
      <line x1={CABIN.x[0] + 0.1} y1={CABIN.z[1]} x2={CABIN.x[1] - 0.1} y2={CABIN.z[1]} stroke={C.glass} strokeWidth={0.13} />
      <R x0={CHAIR.x - 0.38} x1={CHAIR.x + 0.38} z0={CHAIR.z - 0.36} z1={CHAIR.z + 0.36} rx={0.08} fill={C.chair} opacity={0.85} />
      <T x={0} y={CABIN.z[1] - 0.7} s={0.48} c={C.cabinLine}>Cabin</T>

      {/* ramps either side of the performance stage, rising toward the stage */}
      {[-1, 1].map((sx) => {
        const xa = sx * pw, xb = sx * (pw + RAMP.w), xm = (xa + xb) / 2, hw = RAMP.w * 0.28
        return (
          <g key={`r${sx}`}>
            <R x0={xa} x1={xb} z0={0} z1={RAMP.len} fill={C.ramp} stroke={C.perfLine} strokeWidth={0.06} />
            {[0.22, 0.42, 0.62, 0.82].map((f) => {
              const z = RAMP.len * f
              return <path key={f} d={`M ${xm - hw} ${z + 0.22} L ${xm} ${z - 0.1} L ${xm + hw} ${z + 0.22}`} fill="none" stroke={C.chevron} strokeWidth={0.07} strokeLinecap="round" strokeLinejoin="round" />
            })}
            <T x={xb + sx * 0.32} y={RAMP.len / 2} s={0.4} c={C.chevron} rot={sx * 90}>Ramp</T>
          </g>
        )
      })}

      {/* the performance stage: 40 × 16 ft in 8 × 4 ft decks */}
      <R x0={-pw} x1={pw} z0={0} z1={pd} fill={C.perf} stroke={C.perfLine} strokeWidth={0.1} />
      {Array.from({ length: cols - 1 }, (_, i) => {
        const x = -pw + ((i + 1) * PERF.w) / cols
        return <line key={`dc${i}`} x1={x} y1={0.05} x2={x} y2={pd - 0.05} stroke={C.seam} strokeWidth={0.03} />
      })}
      {Array.from({ length: rows - 1 }, (_, i) => {
        const z = ((i + 1) * pd) / rows
        return <line key={`dr${i}`} x1={-pw + 0.05} y1={z} x2={pw - 0.05} y2={z} stroke={C.seam} strokeWidth={0.03} />
      })}

      {/* centre line */}
      <line x1={0} y1={-MAIN.backD} x2={0} y2={pd + 0.5} stroke={C.faint} strokeWidth={0.03} strokeDasharray="0.45 0.35" opacity={0.7} />

      <T x={-MAIN.midW / 2 + 0.7} y={-2.25} s={0.6} c={C.faint} a="start" w={600}>SR</T>
      <T x={MAIN.midW / 2 - 0.7} y={-2.25} s={0.6} c={C.faint} a="end" w={600}>SL</T>
      <T x={0} y={pd + 0.85} s={0.46} c={C.text}>Performance stage · {PERF.wFt} × {PERF.dFt} ft</T>
      {mode === 'stage' && <T x={0} y={pd + 1.75} s={0.4} c={C.faint}>audience ↓</T>}
    </g>
  )
}

/* ---- markers and arrows ---------------------------------------------------- */

export const MARK_R = 0.3

export function Shape({ role, r = MARK_R, opacity }: { role: Role; r?: number; opacity?: number }) {
  const p = { fill: role.color, stroke: '#fff', strokeWidth: 0.06, opacity }
  if (role.shape === 'square') return <rect x={-r * 0.9} y={-r * 0.9} width={r * 1.8} height={r * 1.8} rx={r * 0.2} {...p} />
  if (role.shape === 'triangle') return <path d={`M 0 ${-r * 1.08} L ${r} ${r * 0.78} L ${-r} ${r * 0.78} Z`} {...p} />
  return <circle r={r} {...p} />
}

export function MarkerArt({ m, selected }: { m: Marker; selected?: boolean }) {
  const role = roleOf(m.role)
  return (
    <g transform={`translate(${m.x} ${m.z})`}>
      {selected && <circle r={MARK_R + 0.2} fill="none" stroke="#F08A2B" strokeWidth={0.07} />}
      <Shape role={role} />
      {m.label && (
        <text y={MARK_R + 0.46} fontSize={0.36} fill={C.ink} textAnchor="middle" fontFamily={FONT} fontWeight={500}
          stroke={C.paper} strokeWidth={0.12} strokeLinejoin="round" style={{ paintOrder: 'stroke', pointerEvents: 'none', userSelect: 'none' }}>
          {m.label}
        </text>
      )}
    </g>
  )
}

export function ArrowArt({ a, selected, ghost }: { a: Arrow; selected?: boolean; ghost?: boolean }) {
  const dx = a.x2 - a.x1, dz = a.z2 - a.z1, L = Math.hypot(dx, dz) || 1
  const ux = dx / L, uz = dz / L, hl = 0.42, hw = 0.24
  const bx = a.x2 - ux * hl, bz = a.z2 - uz * hl
  const col = selected ? '#F08A2B' : C.ink
  return (
    <g opacity={ghost ? 0.55 : 1}>
      <line x1={a.x1} y1={a.z1} x2={bx} y2={bz} stroke={col} strokeWidth={0.075} strokeLinecap="round" strokeDasharray={ghost ? '0.3 0.2' : undefined} />
      <path d={`M ${a.x2} ${a.z2} L ${bx - uz * hw} ${bz + ux * hw} L ${bx + uz * hw} ${bz - ux * hw} Z`} fill={col} />
    </g>
  )
}

/* ---- the export sheet ------------------------------------------------------ */

/** A finished plan for a PNG: the setup's name on top, the plan, a key of who is on. */
export function ExportSheet({ setup, mode, px }: { setup: Setup; mode: Mode; px: number }) {
  const v = FIT[mode]
  const k = mode === 'hall' ? 1.6 : 1                  // type scale: the hall is a bigger drawing
  const head = 2.2 * k, used = usedRoles(setup)
  // lay the key out in rows
  const items: { role: Role; n: number; x: number; row: number }[] = []
  let x = 0, row = 0
  const fs = 0.5 * k, maxW = v.w - 1.6 * k
  for (const u of used) {
    const w = (u.role.name.length + String(u.n).length + 2) * fs * 0.56 + 1.2 * k
    if (x + w > maxW && x > 0) { x = 0; row++ }
    items.push({ ...u, x, row }); x += w
  }
  const foot = used.length ? (row + 1) * 1.0 * k + 0.9 * k : 0.6 * k
  const vb = { x: v.x, y: v.y - head, w: v.w, h: v.h + head + foot }
  const H = Math.round((px * vb.h) / vb.w)
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={px} height={H} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}>
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill={C.paper} />
      <T x={vb.x + 0.8 * k} y={vb.y + 1.35 * k} s={0.95 * k} c={C.ink} a="start" w={700}>{setup.name}</T>
      <T x={vb.x + vb.w - 0.8 * k} y={vb.y + 1.35 * k} s={0.42 * k} c={C.faint} a="end">Haveli {mode === 'hall' ? 'hall' : 'stage'}</T>
      <Venue mode={mode} />
      {setup.arrows.map((a) => <ArrowArt key={a.id} a={a} />)}
      {setup.markers.map((m) => <MarkerArt key={m.id} m={m} />)}
      {items.map(({ role, n, x, row }) => (
        <g key={role.id} transform={`translate(${v.x + 0.8 * k + x} ${v.y + v.h + 0.75 * k + row * 1.0 * k})`}>
          <g transform={`scale(${k})`}><Shape role={role} r={0.24} /></g>
          <T x={0.5 * k} y={0.18 * k} s={fs} c={C.ink} a="start">{role.name} {n}</T>
        </g>
      ))}
    </svg>
  )
}

export function usedRoles(s: Setup): { role: Role; n: number }[] {
  const n = new Map<string, number>()
  for (const m of s.markers) n.set(m.role, (n.get(m.role) || 0) + 1)
  return [...n].map(([id, c]) => ({ role: roleOf(id), n: c }))
}

/** Does anything sit outside the stage drawing (so the hall plan is worth exporting too)? */
export function usesHall(s: Setup) {
  const v = FIT.stage, out = (x: number, z: number) => x < v.x || x > v.x + v.w || z < v.y || z > v.y + v.h
  return s.markers.some((m) => out(m.x, m.z)) || s.arrows.some((a) => out(a.x1, a.z1) || out(a.x2, a.z2))
}
