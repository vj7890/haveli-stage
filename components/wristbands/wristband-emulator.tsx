'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Download, Eraser, Hand, Image as ImageIcon, Link2, Paintbrush, RotateCcw, Rows3, Square, SquareDashed, Upload, X } from 'lucide-react'
import { GELS } from '@/lib/rig'
import { ViewerLayout, GroupLabel, Row } from '@/components/viewer-layout'
import { SiteNav } from '@/components/site-nav'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { cn, hex } from '@/lib/utils'
import {
  applyPreset, buildSeats, CHASES, coerce, decodeMap, decodeShare, defaultState, encodeMap, encodeShare, FX, kmeans, LOOKS, nearestZone, PRESETS,
  rgbHex, STORE_KEY, ZONE_COUNT, type Fx, type WbState, type Zone,
} from '@/lib/wristbands/model'
import { drawFrame, fitView, toWorld, type Underlay, type View } from '@/lib/wristbands/render'

type Tool = 'brush' | 'rect' | 'block' | 'row' | 'pan'
const TOOLS: { id: Tool; label: string; Icon: typeof Paintbrush; hint: string }[] = [
  { id: 'brush', label: 'Brush', Icon: Paintbrush, hint: 'Paint seats with the selected zone' },
  { id: 'rect', label: 'Box', Icon: SquareDashed, hint: 'Drag a box; every seat inside takes the zone' },
  { id: 'row', label: 'Row', Icon: Rows3, hint: 'Click a seat: its whole row in that section' },
  { id: 'block', label: 'Section', Icon: Square, hint: 'Click a section: all of it' },
  { id: 'pan', label: 'Pan', Icon: Hand, hint: 'Drag to move, wheel to zoom (shift-drag pans in any tool)' },
]

type UnderUi = { has: boolean; name: string; alpha: number; scale: number; dx: number; dy: number; tol: number }
const UNDER0: UnderUi = { has: false, name: '', alpha: 0.5, scale: 1, dx: 0, dy: 0, tol: 110 }

/**
 * The wristband emulator page: the hall from above, one dot per seat, nine
 * zones you paint onto the seats, a colour and an effect per zone.
 *
 * The live zone map lives in a Uint8Array ref (painting is per-frame work);
 * `state.map` is its run-length string, refreshed when a stroke ends, and is
 * what the share link and autosave carry.
 */
export default function WristbandEmulator() {
  const hall = useMemo(() => buildSeats(), [])
  const [state, setState] = useState<WbState>(() => defaultState(hall))
  const [zone, setZone] = useState(1)          // the brush: 1–9, 0 = erase
  const [tool, setTool] = useState<Tool>('brush')
  const [brush, setBrush] = useState(2)
  const [counts, setCounts] = useState<number[]>(() => new Array(ZONE_COUNT + 1).fill(0))
  const [hover, setHover] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [under, setUnder] = useState<UnderUi>(UNDER0)
  const [loaded, setLoaded] = useState(false)

  const mount = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const stateRef = useRef(state); stateRef.current = state
  const mapRef = useRef<Uint8Array>(decodeMap(state.map, hall.seats.length))
  const viewRef = useRef<View>({ cx: 0, cy: 20, scale: 10 })
  const fitted = useRef(false)
  const hoverRef = useRef<number | null>(null)
  const dragRect = useRef<[number, number, number, number] | null>(null)
  const underRef = useRef<{ img: HTMLImageElement; data: ImageData; base: { x: number; y: number; w: number; h: number } } | null>(null)
  const underUi = useRef(under); underUi.current = under
  const countsRef = useRef<number[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const jsonRef = useRef<HTMLInputElement>(null)

  const patch = useCallback((f: (s: WbState) => WbState) => setState((s) => f(s)), [])
  const setZoneProp = (id: number, p: Partial<Zone>) => patch((s) => ({ ...s, zones: s.zones.map((z) => (z.id === id ? { ...z, ...p } : z)) }))
  const commitMap = useCallback(() => patch((s) => ({ ...s, map: encodeMap(mapRef.current) })), [patch])
  const setMap = useCallback((m: Uint8Array) => { mapRef.current = m; commitMap() }, [commitMap])

  // ---- load: link → saved → default --------------------------------------------
  useEffect(() => {
    const fromLink = decodeShare(location.hash, hall)
    let next: WbState | null = fromLink
    if (!next) { try { const raw = localStorage.getItem(STORE_KEY); if (raw) next = coerce(JSON.parse(raw), hall) } catch {} }
    if (next) { mapRef.current = decodeMap(next.map, hall.seats.length); setState(next) }
    setLoaded(true)
  }, [hall])
  useEffect(() => {
    if (!loaded) return
    const id = setTimeout(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)) } catch {} }, 300)
    return () => clearTimeout(id)
  }, [state, loaded])

  // ---- the underlay's placement in metres -----------------------------------------
  const underlay = useCallback((): Underlay => {
    const u = underRef.current, ui = underUi.current
    if (!u || !ui.has) return null
    const w = u.base.w * ui.scale, h = u.base.h * ui.scale
    return { img: u.img, x: u.base.x - (w - u.base.w) / 2 + ui.dx, y: u.base.y - (h - u.base.h) / 2 + ui.dy, w, h, alpha: ui.alpha }
  }, [])

  // ---- canvas + loop ---------------------------------------------------------------
  useEffect(() => {
    const el = mount.current
    if (!el) return
    const c = document.createElement('canvas')
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:crosshair'
    el.appendChild(c); canvas.current = c
    const ctx = c.getContext('2d')!
    let W = 1, H = 1, dpr = 1
    const size = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      W = el.clientWidth; H = el.clientHeight
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr)
      if (!fitted.current) { viewRef.current = fitView(hall, W, H, 36, W >= 768 ? 384 : 0); fitted.current = true }
    }
    size()
    const ro = new ResizeObserver(size); ro.observe(el)
    let raf = 0
    const t0 = performance.now()
    const loop = () => {
      const t = (performance.now() - t0) / 1000
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const out = drawFrame(ctx, W, H, viewRef.current, hall, mapRef.current, stateRef.current, t, underlay(), hoverRef.current)
      const r = dragRect.current
      if (r) {
        const v = viewRef.current
        const [x0, y0] = [W / 2 + (r[0] - v.cx) * v.scale, H / 2 + (r[1] - v.cy) * v.scale]
        const [x1, y1] = [W / 2 + (r[2] - v.cx) * v.scale, H / 2 + (r[3] - v.cy) * v.scale]
        ctx.strokeStyle = '#ffffff'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1
        ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)); ctx.setLineDash([])
      }
      if (out.counts.some((n, i) => n !== countsRef.current[i])) { countsRef.current = out.counts; setCounts(out.counts) }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); ro.disconnect(); c.remove(); canvas.current = null }
  }, [hall, underlay])

  // ---- pointer -----------------------------------------------------------------------
  const toolRef = useRef(tool); toolRef.current = tool
  const zoneRef = useRef(zone); zoneRef.current = zone
  const brushRef = useRef(brush); brushRef.current = brush
  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const world = (e: PointerEvent | WheelEvent) => { const r = c.getBoundingClientRect(); return toWorld(viewRef.current, r.width, r.height, e.clientX - r.left, e.clientY - r.top) }
    const nearest = (x: number, y: number, within = 0.45) => {
      let best = -1, bd = within * within
      for (const s of hall.seats) { const d = (s.x - x) ** 2 + (s.y - y) ** 2; if (d < bd) { bd = d; best = s.i } }
      return best
    }
    const paintAt = (x: number, y: number) => {
      const z = zoneRef.current, rad = 0.36 + (brushRef.current - 1) * 0.55, r2 = rad * rad
      let changed = false
      for (const s of hall.seats) if ((s.x - x) ** 2 + (s.y - y) ** 2 <= r2 && mapRef.current[s.i] !== z) { mapRef.current[s.i] = z; changed = true }
      return changed
    }
    let mode: 'none' | 'paint' | 'pan' | 'rect' = 'none'
    let last: [number, number] = [0, 0]
    let dirty = false
    const down = (e: PointerEvent) => {
      c.setPointerCapture(e.pointerId)
      const [x, y] = world(e)
      const t = toolRef.current
      if (e.button === 1 || e.button === 2 || e.shiftKey || t === 'pan') { mode = 'pan'; last = [e.clientX, e.clientY]; return }
      if (e.button !== 0) return
      const z = zoneRef.current
      if (t === 'brush') { mode = 'paint'; dirty = paintAt(x, y) }
      else if (t === 'rect') { mode = 'rect'; dragRect.current = [x, y, x, y] }
      else if (t === 'block') {
        const b = hall.blocks.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)
        if (b) { for (let i = b.first; i < b.first + b.count; i++) mapRef.current[i] = z; commitMap() }
      } else if (t === 'row') {
        const i = nearest(x, y, 0.8)
        if (i >= 0) { const s = hall.seats[i]; for (const q of hall.seats) if (q.block === s.block && q.r === s.r) mapRef.current[q.i] = z; commitMap() }
      }
    }
    const move = (e: PointerEvent) => {
      const [x, y] = world(e)
      if (mode === 'pan') {
        const v = viewRef.current
        v.cx -= (e.clientX - last[0]) / v.scale; v.cy -= (e.clientY - last[1]) / v.scale; last = [e.clientX, e.clientY]
        return
      }
      if (mode === 'paint') { if (paintAt(x, y)) dirty = true; return }
      if (mode === 'rect' && dragRect.current) { dragRect.current[2] = x; dragRect.current[3] = y; return }
      const i = nearest(x, y)
      hoverRef.current = i >= 0 ? i : null
      if (i >= 0) { const s = hall.seats[i]; const z = mapRef.current[i]; setHover(`${s.block} · row ${s.r + 1} · seat ${s.s + 1} · ${z ? `zone ${z}` : 'no zone'}`) }
      else setHover('')
    }
    const up = () => {
      if (mode === 'paint' && dirty) commitMap()
      if (mode === 'rect' && dragRect.current) {
        const [ax, ay, bx, by] = dragRect.current
        const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by)
        const z = zoneRef.current
        for (const s of hall.seats) if (s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1) mapRef.current[s.i] = z
        dragRect.current = null; commitMap()
      }
      mode = 'none'; dirty = false
    }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const v = viewRef.current
      const [wx, wy] = world(e)
      const f = Math.exp(-e.deltaY * 0.0015)
      v.scale = Math.max(2, Math.min(80, v.scale * f))
      const r = c.getBoundingClientRect()
      const [nx, ny] = toWorld(v, r.width, r.height, e.clientX - r.left, e.clientY - r.top)
      v.cx += wx - nx; v.cy += wy - ny
    }
    const leave = () => { hoverRef.current = null; setHover('') }
    const ctxmenu = (e: Event) => e.preventDefault()
    c.addEventListener('pointerdown', down); c.addEventListener('pointermove', move); c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up)
    c.addEventListener('wheel', wheel, { passive: false }); c.addEventListener('pointerleave', leave); c.addEventListener('contextmenu', ctxmenu)
    return () => {
      c.removeEventListener('pointerdown', down); c.removeEventListener('pointermove', move); c.removeEventListener('pointerup', up); c.removeEventListener('pointercancel', up)
      c.removeEventListener('wheel', wheel); c.removeEventListener('pointerleave', leave); c.removeEventListener('contextmenu', ctxmenu)
    }
  }, [hall, commitMap, loaded])

  // keys: 1–9 pick a zone, 0 erase, B/X/R/S/H tools
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return
      if (/^[0-9]$/.test(e.key)) setZone(parseInt(e.key, 10))
      else if (e.key === 'b') setTool('brush'); else if (e.key === 'x') setTool('rect'); else if (e.key === 'r') setTool('row'); else if (e.key === 's') setTool('block'); else if (e.key === 'h') setTool('pan')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ---- underlay image → zones -----------------------------------------------------------
  const loadUnderlay = (file: File) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const off = document.createElement('canvas'); off.width = img.naturalWidth; off.height = img.naturalHeight
      const octx = off.getContext('2d', { willReadFrequently: true })!; octx.drawImage(img, 0, 0)
      const data = octx.getImageData(0, 0, off.width, off.height)
      // contain the picture in the seating extent
      const e = hall.ext, ew = e.x1 - e.x0, eh = e.y1 - e.y0
      const k = Math.min(ew / img.naturalWidth, eh / img.naturalHeight)
      const w = img.naturalWidth * k, h = img.naturalHeight * k
      underRef.current = { img, data, base: { x: (e.x0 + e.x1) / 2 - w / 2, y: (e.y0 + e.y1) / 2 - h / 2, w, h } }
      setUnder((u) => ({ ...u, has: true, name: file.name, scale: 1, dx: 0, dy: 0 }))
    }
    img.src = url
  }
  /** The image colour under each seat, or null when the seat is off the picture. */
  const sampleSeats = (): Array<[number, number, number] | null> => {
    const u = underRef.current, pl = underlay()
    if (!u || !pl) return hall.seats.map(() => null)
    const { data } = u
    return hall.seats.map((s) => {
      const px = Math.floor(((s.x - pl.x) / pl.w) * data.width), py = Math.floor(((s.y - pl.y) / pl.h) * data.height)
      if (px < 0 || py < 0 || px >= data.width || py >= data.height) return null
      const o = (py * data.width + px) * 4
      if (data.data[o + 3] < 96) return null
      return [data.data[o], data.data[o + 1], data.data[o + 2]]
    })
  }
  const assignByColour = () => {
    const samples = sampleSeats()
    const m = new Uint8Array(mapRef.current)
    samples.forEach((c, i) => { if (c) m[i] = nearestZone(c, stateRef.current.zones, under.tol) })
    setMap(m)
  }
  const findZones = () => {
    const samples = sampleSeats()
    const idx: number[] = [], pts: Array<[number, number, number]> = []
    samples.forEach((c, i) => { if (c) { idx.push(i); pts.push(c) } })
    if (pts.length < ZONE_COUNT) return
    const { centres, labels } = kmeans(pts, ZONE_COUNT)
    // order the found colours by how many seats they cover, biggest first → zone 1
    const order = centres.map((_, c) => c).sort((a, b) => { let na = 0, nb = 0; for (const l of labels) { if (l === a) na++; if (l === b) nb++ } return nb - na })
    const rank = new Array(centres.length).fill(0); order.forEach((c, r) => (rank[c] = r))
    const m = new Uint8Array(mapRef.current)
    idx.forEach((seatI, k) => (m[seatI] = rank[labels[k]] + 1))
    mapRef.current = m
    patch((s) => ({ ...s, map: encodeMap(m), zones: s.zones.map((z, i) => (order[i] != null ? { ...z, color: rgbHex(...centres[order[i]]) } : z)) }))
  }

  // ---- share / export -----------------------------------------------------------------------
  const copyLink = async () => {
    const url = `${location.origin}${location.pathname}#s=${encodeShare(state)}`
    history.replaceState(null, '', `#s=${encodeShare(state)}`)
    try { await navigator.clipboard.writeText(url) } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 1600)
  }
  const download = (name: string, blob: Blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000) }
  const exportPng = () => {
    const W = 2400, r = hall.room, H = Math.round(W * ((r.y1 - r.y0) / (r.x1 - r.x0))) + 120
    const c = document.createElement('canvas'); c.width = W; c.height = H
    const ctx = c.getContext('2d')!
    drawFrame(ctx, W, H, fitView(hall, W, H, 60), hall, mapRef.current, state, performance.now() / 1000, underlay(), null)
    ctx.fillStyle = '#8d8579'; ctx.font = '600 22px ui-sans-serif, system-ui'; ctx.textAlign = 'left'
    ctx.fillText(`Haveli wristbands — ${state.zones.filter((z) => counts[z.id]).map((z) => `${z.id} ${z.name} (${counts[z.id]})`).join(' · ')}`, 40, H - 36)
    c.toBlob((b) => b && download('haveli-wristbands.png', b), 'image/png')
  }
  const exportJson = () => download('haveli-wristbands.json', new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }))
  const importJson = (f: File) => f.text().then((t) => { const s = coerce(JSON.parse(t), hall); mapRef.current = decodeMap(s.map, hall.seats.length); setState(s) }).catch(() => {})
  const reset = () => { const s = defaultState(hall); mapRef.current = decodeMap(s.map, hall.seats.length); setState(s); history.replaceState(null, '', location.pathname) }

  const sel = state.zones[zone - 1]
  const total = hall.seats.length
  const assigned = total - (counts[0] || 0)

  const panel = (
    <div className="pb-2">
      <GroupLabel className="mt-1">Zones — {assigned} of {total} wristbands assigned</GroupLabel>
      <div className="card-glass rounded-xl p-1.5">
        {state.zones.map((z) => (
          <button
            key={z.id} type="button" onClick={() => setZone(z.id)}
            className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-[11.5px] transition-colors', zone === z.id ? 'bg-accent' : 'hover:bg-accent/50')}
          >
            <span className="text-muted-foreground tabular w-3 text-[10px]">{z.id}</span>
            <span className="size-3.5 shrink-0 rounded-full border border-white/15" style={{ background: z.color, boxShadow: `0 0 8px ${z.color}88` }} />
            <span className="min-w-0 flex-1 truncate">{z.name}</span>
            <span className="text-muted-foreground text-[10.5px]">{FX.find((f) => f.id === z.fx)?.label}</span>
            <span className="tabular text-primary w-9 text-right text-[10.5px]">{counts[z.id] || 0}</span>
          </button>
        ))}
        <button type="button" onClick={() => setZone(0)} className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-[11.5px]', zone === 0 ? 'bg-accent' : 'hover:bg-accent/50')}>
          <span className="text-muted-foreground w-3 text-[10px]">0</span>
          <Eraser className="text-muted-foreground size-3.5" />
          <span className="text-muted-foreground flex-1">No zone (erase)</span>
          <span className="tabular text-muted-foreground w-9 text-right text-[10.5px]">{counts[0] || 0}</span>
        </button>
      </div>

      {sel && (
        <div className="card-glass mt-2 rounded-xl p-2.5">
          <div className="flex items-center gap-2">
            <label className="relative size-7 shrink-0 cursor-pointer overflow-hidden rounded-md border border-white/15" style={{ background: sel.color }} title="Pick any colour">
              <input type="color" value={sel.color} onChange={(e) => setZoneProp(sel.id, { color: e.target.value })} className="absolute inset-0 size-full cursor-pointer opacity-0" />
            </label>
            <input value={sel.name} onChange={(e) => setZoneProp(sel.id, { name: e.target.value.slice(0, 24) })} className="bg-muted/60 h-7 min-w-0 flex-1 rounded-md px-2 text-[12px] outline-none focus:ring-2 focus:ring-ring" />
            <span className="text-muted-foreground tabular text-[10.5px]">{sel.color}</span>
          </div>
          <div className="mt-2 grid grid-cols-6 gap-1">
            {GELS.map((g) => (
              <button key={g.id} type="button" title={g.label} onClick={() => setZoneProp(sel.id, { color: hex(g.hex) })} className={cn('h-5 rounded-md border border-white/10', sel.color === hex(g.hex) && 'ring-2 ring-white/70')} style={{ background: hex(g.hex) }} />
            ))}
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1">
            {FX.map((f) => (
              <Button key={f.id} size="xs" variant={sel.fx === f.id ? 'default' : 'outline'} title={f.hint} onClick={() => setZoneProp(sel.id, { fx: f.id as Fx })}>{f.label}</Button>
            ))}
            <Button size="xs" variant="ghost" title="Every zone gets this zone's colour and effect" onClick={() => patch((s) => ({ ...s, zones: s.zones.map((z) => ({ ...z, color: sel.color, fx: sel.fx, level: sel.level })) }))}>To all</Button>
          </div>
          <div className="mt-2">
            <Row label="Level" value={`${Math.round(sel.level * 100)}%`}><Slider min={0} max={1} step={0.02} value={[sel.level]} onValueChange={([v]) => setZoneProp(sel.id, { level: v })} /></Row>
          </div>
        </div>
      )}

      <GroupLabel>Paint the zones</GroupLabel>
      <div className="grid grid-cols-5 gap-1">
        {TOOLS.map(({ id, label, Icon, hint }) => (
          <Button key={id} size="xs" variant={tool === id ? 'default' : 'outline'} title={hint} onClick={() => setTool(id)} className="flex-col gap-0 py-1 h-auto"><Icon className="size-3.5" /><span className="text-[10px]">{label}</span></Button>
        ))}
      </div>
      {tool === 'brush' && <div className="mt-2"><Row label="Brush" value={`${brush} seat${brush > 1 ? 's' : ''} wide`}><Slider min={1} max={6} step={1} value={[brush]} onValueChange={([v]) => setBrush(v)} /></Row></div>}
      <p className="text-muted-foreground mt-1.5 text-[10.5px] leading-relaxed">Pick a zone above (keys 1–9, 0 erases), then paint. Wheel zooms, shift-drag pans.</p>
      <div className="mt-2 grid grid-cols-4 gap-1">
        {PRESETS.map((p) => (
          <Button key={p.id} size="xs" variant="secondary" title={p.hint} onClick={() => setMap(applyPreset(p, hall))}>{p.label}</Button>
        ))}
      </div>

      <GroupLabel>From a picture</GroupLabel>
      <div className="card-glass rounded-xl p-2.5">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadUnderlay(f); e.target.value = '' }} />
        {!under.has ? (
          <>
            <Button size="xs" variant="outline" onClick={() => fileRef.current?.click()} className="w-full"><ImageIcon className="size-3" />Drop in a zone drawing…</Button>
            <p className="text-muted-foreground mt-1.5 text-[10.5px] leading-relaxed">Any picture of the hall coloured by zone — a sketch, a screenshot, a plan. It sits under the seats; then either match seats to the nine zone colours, or let it find nine colours of its own.</p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-[11px]"><ImageIcon className="text-muted-foreground size-3" /><span className="min-w-0 flex-1 truncate">{under.name}</span><button type="button" onClick={() => { underRef.current = null; setUnder(UNDER0) }} className="text-muted-foreground hover:text-foreground" title="Remove"><X className="size-3.5" /></button></div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
              <Row label="Opacity" value={`${Math.round(under.alpha * 100)}%`}><Slider min={0} max={1} step={0.05} value={[under.alpha]} onValueChange={([v]) => setUnder((u) => ({ ...u, alpha: v }))} /></Row>
              <Row label="Scale" value={`${under.scale.toFixed(2)}×`}><Slider min={0.3} max={2.5} step={0.01} value={[under.scale]} onValueChange={([v]) => setUnder((u) => ({ ...u, scale: v }))} /></Row>
              <Row label="Across" value={`${under.dx.toFixed(1)} m`}><Slider min={-20} max={20} step={0.1} value={[under.dx]} onValueChange={([v]) => setUnder((u) => ({ ...u, dx: v }))} /></Row>
              <Row label="Down the hall" value={`${under.dy.toFixed(1)} m`}><Slider min={-20} max={20} step={0.1} value={[under.dy]} onValueChange={([v]) => setUnder((u) => ({ ...u, dy: v }))} /></Row>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1">
              <Button size="xs" title="Each seat takes the zone whose colour is nearest the picture under it" onClick={assignByColour}>Match zone colours</Button>
              <Button size="xs" variant="secondary" title="Finds the nine most distinct colours in the picture, sets the zone colours to them, and assigns every seat" onClick={findZones}>Find 9 zones</Button>
            </div>
            <div className="mt-2"><Row label="Colour tolerance" value={`${under.tol}`}><Slider min={20} max={300} step={5} value={[under.tol]} onValueChange={([v]) => setUnder((u) => ({ ...u, tol: v }))} /></Row></div>
          </>
        )}
      </div>

      <GroupLabel>Effects</GroupLabel>
      <div className="grid grid-cols-4 gap-1">
        {LOOKS.map((l) => <Button key={l.id} size="xs" variant="secondary" onClick={() => patch(l.apply)}>{l.label}</Button>)}
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1">
        {CHASES.map((c) => <Button key={c.id} size="xs" variant={state.chase.mode === c.id ? 'default' : 'outline'} title={c.hint} onClick={() => patch((s) => ({ ...s, chase: { ...s.chase, mode: c.id } }))}>{c.label}</Button>)}
      </div>
      {state.chase.mode !== 'none' && (
        <div className="mt-2 grid grid-cols-2 gap-x-3">
          <Row label="Step" value={`${state.chase.step.toFixed(2)} s`}><Slider min={0.05} max={3} step={0.05} value={[state.chase.step]} onValueChange={([v]) => patch((s) => ({ ...s, chase: { ...s.chase, step: v } }))} /></Row>
          <Row label="Others at" value={`${Math.round(state.chase.floor * 100)}%`}><Slider min={0} max={1} step={0.02} value={[state.chase.floor]} onValueChange={([v]) => patch((s) => ({ ...s, chase: { ...s.chase, floor: v } }))} /></Row>
        </div>
      )}
      <div className="mt-2 space-y-2">
        <Row label="Master" value={`${Math.round(state.master * 100)}%`}><Slider min={0} max={1} step={0.02} value={[state.master]} onValueChange={([v]) => patch((s) => ({ ...s, master: v }))} /></Row>
        <Row label="Speed" value={`${state.speed.toFixed(2)}×`}><Slider min={0.1} max={4} step={0.05} value={[state.speed]} onValueChange={([v]) => patch((s) => ({ ...s, speed: v }))} /></Row>
        <Row label="Glow" value={state.glow.toFixed(2)}><Slider min={0} max={1} step={0.05} value={[state.glow]} onValueChange={([v]) => patch((s) => ({ ...s, glow: v }))} /></Row>
      </div>

      <GroupLabel>View</GroupLabel>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-2 text-[11px]"><Switch checked={state.labels} onCheckedChange={(v) => patch((s) => ({ ...s, labels: v }))} /> Zone numbers</label>
        <label className="flex items-center gap-2 text-[11px]"><Switch checked={state.plan} onCheckedChange={(v) => patch((s) => ({ ...s, plan: v }))} /> Stage &amp; sections</label>
        <Button size="xs" variant="outline" onClick={() => { const el = mount.current; if (el) viewRef.current = fitView(hall, el.clientWidth, el.clientHeight, 36, el.clientWidth >= 768 ? 384 : 0) }}>Fit</Button>
      </div>
      <div className="mt-2"><Row label="Wristband size" value={`${state.seatSize.toFixed(1)}×`}><Slider min={0.5} max={2} step={0.1} value={[state.seatSize]} onValueChange={([v]) => patch((s) => ({ ...s, seatSize: v }))} /></Row></div>

      <GroupLabel>Share</GroupLabel>
      <div className="grid grid-cols-2 gap-1">
        <Button size="xs" onClick={copyLink} title="A link that opens this exact zone map, colours and effects">{copied ? <Check className="size-3" /> : <Link2 className="size-3" />}{copied ? 'Copied' : 'Copy link'}</Button>
        <Button size="xs" variant="outline" onClick={exportPng} title="A 2400 px render of the hall as it is right now"><Download className="size-3" />Render PNG</Button>
        <Button size="xs" variant="outline" onClick={exportJson}><Download className="size-3" />Export JSON</Button>
        <Button size="xs" variant="outline" onClick={() => jsonRef.current?.click()}><Upload className="size-3" />Import JSON</Button>
        <input ref={jsonRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = '' }} />
        <Button size="xs" variant="ghost" onClick={reset} className="col-span-2"><RotateCcw className="size-3" />Reset to the 3 × 3 grid</Button>
      </div>
      <p className="text-muted-foreground mt-2 text-[10.5px] leading-relaxed">Autosaves in this browser. The link carries everything but the picture.</p>
    </div>
  )

  return (
    <ViewerLayout
      mountRef={mount}
      title="Wristbands"
      subtitle={`${total} RFID wristbands, one per seat, in nine zones. Paint the zones onto the hall, give each a colour and an effect, share the link.`}
      hud={hover || 'wheel zoom · shift-drag pan · 1–9 pick a zone'}
      panel={panel}
      corner={
        <div className="flex flex-col items-end gap-1.5">
          <SiteNav />
          <div className="card-glass text-muted-foreground rounded-md px-2 py-1 text-[10.5px]">{zone ? `painting zone ${zone} · ${sel?.name}` : 'erasing'} · {TOOLS.find((t) => t.id === tool)?.label}</div>
        </div>
      }
    />
  )
}
