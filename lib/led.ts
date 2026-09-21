import * as THREE from 'three'
import { LED, cabinPx } from './venue'

/**
 * LED content for the back wall. One channel: a hidden <video> or a canvas
 * behind a THREE texture on an unlit material, so the picture shows exactly
 * as authored. Built-in patterns are drawn procedurally at the wall's own
 * 5.33:1 aspect so there is nothing to download; uploads are object URLs.
 */

export type FitMode = 'cover' | 'stretch'
export type LedClip = { id: string; label: string; hint: string; kind: 'gen' | 'off' }
export const LED_CLIPS: LedClip[] = [
  { id: 'gen:testcard', label: 'Test card', hint: 'Pixel map at 10240 × 1920 — 640 px cells, the cabin zone marked', kind: 'gen' },
  { id: 'gen:bars', label: 'Colour bars', hint: 'Full-field colour bars with a grey ramp', kind: 'gen' },
  { id: 'gen:saffron', label: 'Saffron flow', hint: 'Slow saffron and gold bands drifting across the wall', kind: 'gen' },
  { id: 'gen:stars', label: 'Stars', hint: 'Drifting starfield → warp → starburst, 24 s loop', kind: 'gen' },
  { id: 'gen:rise', label: 'Rise', hint: 'Embers lift into a column and wash out, 20 s loop', kind: 'gen' },
  { id: 'gen:ripple', label: 'Ripple', hint: 'Neon rings and a wave sheet, cyan → violet, 18 s loop', kind: 'gen' },
  { id: 'gen:off', label: 'Black', hint: 'The wall on, showing nothing', kind: 'off' },
]

// Generated clips draw at a quarter of the raster: same aspect, cheap to redraw.
const W = 2560, H = 480
const smooth = (x: number) => x * x * (3 - 2 * x)
const window01 = (t: number, a: number, b: number, f: number) => {
  if (t <= a || t >= b) return 0
  if (t < a + f) return smooth((t - a) / f)
  if (t > b - f) return smooth((b - t) / f)
  return 1
}
const canvas = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return [c, c.getContext('2d')!] as const }
function stars(seed: number, count: number) {
  let s = seed >>> 0
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s % 100000) / 100000 }
  return Array.from({ length: count }, () => ({ x: rnd(), y: rnd(), z: 0.15 + rnd() * 0.85, tw: rnd() * Math.PI * 2, ts: 0.5 + rnd() * 2.5 }))
}

type Gen = { tex: THREE.CanvasTexture; draw: (t: number) => void; live: boolean }
const mk = (c: HTMLCanvasElement, draw: (t: number) => void, live: boolean): Gen => {
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return { tex, draw: (t) => { draw(t); tex.needsUpdate = true }, live }
}

/** The pixel map: a grid every 640 px with coordinates, the centre, and the cabin's footprint. */
function testcard(): Gen {
  const [c, g] = canvas()
  const K = W / LED.px[0]   // canvas px per raster px
  const draw = () => {
    g.fillStyle = '#12224a'; g.fillRect(0, 0, W, H)
    // 640 px cells, alternating tint
    for (let x = 0; x < LED.px[0]; x += 640) for (let y = 0; y < LED.px[1]; y += 480) {
      g.fillStyle = ((x / 640 + y / 480) % 2) ? '#1a3068' : '#12224a'
      g.fillRect(x * K, y * K, 640 * K, 480 * K)
    }
    g.strokeStyle = 'rgba(180,205,255,0.8)'; g.lineWidth = 1.5
    for (let x = 0; x <= LED.px[0]; x += 640) { g.beginPath(); g.moveTo(x * K, 0); g.lineTo(x * K, H); g.stroke() }
    for (let y = 0; y <= LED.px[1]; y += 480) { g.beginPath(); g.moveTo(0, y * K); g.lineTo(W, y * K); g.stroke() }
    // coordinates along the top and left
    g.fillStyle = '#e4eeff'; g.font = '700 18px system-ui, sans-serif'; g.textBaseline = 'top'; g.textAlign = 'left'
    for (let x = 640; x < LED.px[0]; x += 640) g.fillText(String(x), x * K + 4, 4)
    for (let y = 480; y < LED.px[1]; y += 480) g.fillText(String(y), 4, y * K + 4)
    // centre cross and circle
    g.strokeStyle = '#ffb020'; g.lineWidth = 2
    g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke()
    g.beginPath(); g.arc(W / 2, H / 2, H * 0.42, 0, Math.PI * 2); g.stroke()
    // the cabin zone
    const cb = cabinPx()
    g.fillStyle = 'rgba(255,90,90,0.16)'; g.fillRect(cb.x0 * K, cb.y0 * K, (cb.x1 - cb.x0) * K, (cb.y1 - cb.y0) * K)
    g.strokeStyle = '#ff5a5a'; g.setLineDash([8, 6]); g.strokeRect(cb.x0 * K, cb.y0 * K, (cb.x1 - cb.x0) * K, (cb.y1 - cb.y0) * K); g.setLineDash([])
    g.fillStyle = '#ffb0b0'; g.font = '600 15px system-ui, sans-serif'; g.textAlign = 'center'
    g.fillText(`CABIN  ·  ${cb.x0}–${cb.x1} × ${cb.y0}–${cb.y1}`, W / 2, cb.y0 * K + 6)
    // corner marks + title
    g.fillStyle = '#fff'; g.font = '700 30px system-ui, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'
    g.fillText('TL', 14, 46); g.textAlign = 'right'; g.fillText('TR', W - 14, 46); g.fillText('BR', W - 14, H - 16); g.textAlign = 'left'; g.fillText('BL', 14, H - 16)
    g.textAlign = 'center'; g.font = '700 44px system-ui, sans-serif'; g.fillStyle = '#ffffff'
    g.fillText(`${LED.px[0]} × ${LED.px[1]}  ·  ${LED.w} × ${LED.h} m  ·  P${LED.pitchMm}`, W / 2, H * 0.31)
    g.font = '500 20px system-ui, sans-serif'; g.fillStyle = '#9cc0ff'
    g.fillText('one picture, house left → house right · top-left origin · the cabin stands in front of the red zone', W / 2, H * 0.31 + 34)
  }
  return mk(c, draw, false)
}

function bars(): Gen {
  const [c, g] = canvas()
  const cols = ['#ffffff', '#ffff00', '#00ffff', '#00ff00', '#ff00ff', '#ff0000', '#0000ff', '#000000']
  const draw = () => {
    const w = W / cols.length
    cols.forEach((k, i) => { g.fillStyle = k; g.fillRect(i * w, 0, w + 1, H * 0.72) })
    for (let i = 0; i < 16; i++) { const v = Math.round((i / 15) * 255); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect((i * W) / 16, H * 0.72, W / 16 + 1, H * 0.28) }
    g.fillStyle = '#000'; g.font = '700 28px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText(`${LED.px[0]} × ${LED.px[1]}`, W / 2, H * 0.36)
  }
  return mk(c, draw, false)
}

function saffron(): Gen {
  const [c, g] = canvas()
  const draw = (t: number) => {
    g.fillStyle = '#1a0800'; g.fillRect(0, 0, W, H)
    for (let i = 0; i < 9; i++) {
      const ph = t * 0.12 + i * 0.7
      const x = ((Math.sin(ph) * 0.5 + 0.5) * 1.4 - 0.2) * W
      const grd = g.createRadialGradient(x, H * (0.3 + 0.4 * Math.sin(ph * 1.3 + i)), 0, x, H / 2, W * 0.22)
      const warm = i % 3 === 0 ? '255,122,0' : i % 3 === 1 ? '255,176,32' : '255,61,31'
      grd.addColorStop(0, `rgba(${warm},0.55)`); grd.addColorStop(1, `rgba(${warm},0)`)
      g.fillStyle = grd; g.fillRect(0, 0, W, H)
    }
    // fine gold threads
    g.strokeStyle = 'rgba(255,214,102,0.25)'; g.lineWidth = 1.5
    for (let i = 0; i < 14; i++) {
      g.beginPath()
      for (let x = 0; x <= W; x += 16) g.lineTo(x, H / 2 + Math.sin(x * 0.004 + t * 0.5 + i) * H * 0.35 * Math.sin(i * 0.4 + t * 0.2))
      g.stroke()
    }
  }
  return mk(c, draw, true)
}

function starfield(): Gen {
  const [c, g] = canvas()
  const field = stars(20260830, 900)
  const PERIOD = 24
  const draw = (t: number) => {
    const ph = ((t % PERIOD) + PERIOD) % PERIOD
    g.fillStyle = '#020208'; g.fillRect(0, 0, W, H)
    const bg = g.createRadialGradient(W / 2, H * 0.6, 0, W / 2, H * 0.6, W * 0.5)
    bg.addColorStop(0, `rgba(30, 24, 70, ${0.5 + 0.2 * Math.sin(t * 0.3)})`); bg.addColorStop(1, 'rgba(2, 2, 8, 0)')
    g.fillStyle = bg; g.fillRect(0, 0, W, H)
    const drift = window01(ph, -1, 11, 2.5) + window01(ph, 21.5, PERIOD + 1, 2.5)
    const warp = window01(ph, 9, 17, 2.5)
    const burst = window01(ph, 15, 23, 2.5)
    for (const st of field) {
      const tw = 0.55 + 0.45 * Math.sin(t * st.ts + st.tw)
      const dx = ((st.x + t * 0.006 * st.z) % 1) * W, dy = st.y * H
      if (drift > 0.01) { g.fillStyle = `rgba(255,255,255,${(0.85 * tw * drift).toFixed(3)})`; g.beginPath(); g.arc(dx, dy, (0.6 + st.z * 1.7) * tw, 0, Math.PI * 2); g.fill() }
      if (warp > 0.01) {
        const vx = dx - W / 2, vy = dy - H / 2, d = Math.hypot(vx, vy) || 1, sp = (0.2 + st.z) * warp
        g.strokeStyle = `rgba(190,215,255,${(0.7 * warp * st.z).toFixed(3)})`; g.lineWidth = st.z * 1.6
        g.beginPath(); g.moveTo(dx, dy); g.lineTo(dx + (vx / d) * 60 * sp, dy + (vy / d) * 60 * sp); g.stroke()
      }
    }
    if (burst > 0.01) {
      const R = burst * W * 0.4
      const rb = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(1, R))
      rb.addColorStop(0, `rgba(255,244,214,${(0.5 * burst).toFixed(3)})`); rb.addColorStop(0.55, `rgba(255,176,32,${(0.28 * burst).toFixed(3)})`); rb.addColorStop(1, 'rgba(255,176,32,0)')
      g.fillStyle = rb; g.fillRect(0, 0, W, H)
      g.save(); g.translate(W / 2, H / 2)
      for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); const grd = g.createLinearGradient(0, 0, R, 0); grd.addColorStop(0, `rgba(255,255,255,${(0.35 * burst).toFixed(3)})`); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(0, -1.2, R, 2.4) }
      g.restore()
    }
  }
  return mk(c, draw, true)
}

function rise(): Gen {
  const [c, g] = canvas()
  const N = 520, field = stars(11223344, N), PERIOD = 20
  const draw = (t: number) => {
    const ph = ((t % PERIOD) + PERIOD) % PERIOD
    g.fillStyle = '#0a0402'; g.fillRect(0, 0, W, H)
    const gather = window01(ph, 5, 15, 4), wash = window01(ph, 13, 21, 3)
    if (wash > 0.01) { const grd = g.createLinearGradient(0, H, 0, 0); grd.addColorStop(0, `rgba(255,122,0,${(0.5 * wash).toFixed(3)})`); grd.addColorStop(1, `rgba(255,46,60,${(0.16 * wash).toFixed(3)})`); g.fillStyle = grd; g.fillRect(0, 0, W, H) }
    for (let i = 0; i < N; i++) {
      const p = field[i], speed = 0.05 + p.z * 0.1
      const y0 = 1 - (((t * speed + p.y) % 1) + 1) % 1
      const swirl = W / 2 + Math.sin(y0 * 5 + t * 0.9) * 160 * p.z
      const x = (p.x * W) * (1 - gather) + swirl * gather, y = y0 * H
      const a = (1 - y0) * 0.9 + 0.1, r = 0.8 + p.z * 2.2 * (1 + gather)
      const warm = p.z > 0.6 ? '255,196,61' : p.z > 0.35 ? '255,122,0' : '255,61,31'
      g.fillStyle = `rgba(${warm},${(a * (0.5 + 0.5 * Math.sin(t * p.ts + p.tw))).toFixed(3)})`
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill()
    }
  }
  return mk(c, draw, true)
}

function ripple(): Gen {
  const [c, g] = canvas()
  const PERIOD = 18
  const draw = (t: number) => {
    const ph = ((t % PERIOD) + PERIOD) % PERIOD
    g.fillStyle = '#02040a'; g.fillRect(0, 0, W, H)
    const rings = window01(ph, -1, 10, 3) + window01(ph, 16, PERIOD + 1, 2), sheet = window01(ph, 8, 18, 3)
    if (rings > 0.01) {
      for (const [cx0, k] of [[0.25, 0], [0.75, 2.1]] as [number, number][]) {
        const cx = W * cx0 + Math.sin(t * 0.25 + k) * W * 0.12, cy = H / 2 + Math.cos(t * 0.2 + k) * H * 0.25
        for (let i = 0; i < 7; i++) {
          const r = ((t * 55 + i * 90) % 630), a = Math.max(0, 1 - r / 630) * 0.8 * rings
          g.strokeStyle = i % 2 ? `rgba(18,216,232,${a.toFixed(3)})` : `rgba(123,77,255,${a.toFixed(3)})`
          g.lineWidth = 5 - (r / 630) * 3.6; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke()
        }
      }
    }
    if (sheet > 0.01) for (let x = 0; x < W; x += 6) {
      const v = Math.sin(x * 0.008 + t * 1.6) + Math.sin(x * 0.019 - t * 1.1), y = H / 2 + v * H * 0.2
      const a = (0.25 + 0.2 * Math.sin(x * 0.004 + t)) * sheet
      g.fillStyle = `rgba(18,216,232,${a.toFixed(3)})`; g.fillRect(x, y - 2, 6, 4)
      g.fillStyle = `rgba(123,77,255,${(a * 0.7).toFixed(3)})`; g.fillRect(x, H - y - 2, 6, 4)
    }
  }
  return mk(c, draw, true)
}

export type LedChannel = ReturnType<typeof createLedChannel>

/** The one channel: owns the material the LED mesh wears and every source it can show. */
export function createLedChannel() {
  const vid = document.createElement('video')
  Object.assign(vid, { muted: true, loop: true, playsInline: true, preload: 'auto', crossOrigin: 'anonymous' })
  const vtex = new THREE.VideoTexture(vid)
  vtex.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.MeshBasicMaterial({ map: vtex, side: THREE.DoubleSide, toneMapped: false })
  const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1)
  black.needsUpdate = true

  const gens: Record<string, Gen> = {
    'gen:testcard': testcard(), 'gen:bars': bars(), 'gen:saffron': saffron(),
    'gen:stars': starfield(), 'gen:rise': rise(), 'gen:ripple': ripple(),
  }
  for (const k of Object.keys(gens)) if (!gens[k].live) gens[k].draw(0)

  const S = { src: 'gen:testcard', fit: 'cover' as FitMode, level: 1, on: true, gen: null as Gen | null, upload: null as THREE.Texture | null, uploadName: '' }

  /** Fit whatever is on the texture to the wall's 5.33:1: cover crops, stretch fills. */
  const fit = () => {
    const tex = mat.map
    const img = tex?.image as { videoWidth?: number; width?: number; videoHeight?: number; height?: number } | undefined
    const iw = img?.videoWidth || img?.width || 0, ih = img?.videoHeight || img?.height || 0
    if (!tex || !iw || !ih) return
    let ru = 1, rv = 1
    if (S.fit === 'cover') { const tA = iw / ih; if (LED.aspect >= tA) rv = tA / LED.aspect; else ru = LED.aspect / tA }
    tex.repeat.set(ru, rv); tex.offset.set((1 - ru) / 2, (1 - rv) / 2); tex.needsUpdate = true
  }
  vid.addEventListener('loadedmetadata', fit)

  const apply = () => {
    mat.color.setScalar(S.on ? S.level : 0)
    if (S.on && mat.map === vtex) void vid.play().catch(() => {})
    else vid.pause()
  }

  const show = (src: string) => {
    S.src = src
    S.gen = null
    if (src === 'gen:off') { vid.pause(); mat.map = black; mat.needsUpdate = true; apply(); return }
    if (src.startsWith('gen:')) {
      S.gen = gens[src] ?? null
      vid.pause()
      if (S.gen) { mat.map = S.gen.tex; mat.needsUpdate = true; fit() }
      apply(); return
    }
    if (src === 'upload') {
      if (S.upload) { vid.pause(); mat.map = S.upload; mat.needsUpdate = true; fit(); apply(); return }
      if (!S.uploadName) { show('gen:testcard'); return }   // a remembered upload that isn't in this session
      return   // a video upload: already playing on vtex
    }
    // a video URL — an upload's object URL, or anything served from /public
    mat.map = vtex; mat.needsUpdate = true
    vid.src = src; vid.load(); fit(); apply()
  }

  const upload = (file: File) => {
    const url = URL.createObjectURL(file)
    S.uploadName = file.name
    if (file.type.startsWith('video/')) { S.upload?.dispose(); S.upload = null; show(url); S.src = 'upload'; return }
    new THREE.TextureLoader().load(url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 8
      S.upload?.dispose(); S.upload = tex
      show('upload')
      URL.revokeObjectURL(url)
    })
  }

  show(S.src)

  return {
    mat,
    get state() { return { src: S.src, fit: S.fit, level: S.level, on: S.on, uploadName: S.uploadName } },
    show, upload,
    setFit: (f: FitMode) => { S.fit = f; fit() },
    setLevel: (v: number) => { S.level = v; apply() },
    setOn: (b: boolean) => { S.on = b; apply() },
    /** Once a frame: advance whichever generated clip is live. */
    tick: (t: number) => { if (S.on && S.gen?.live) S.gen.draw(t) },
    dispose: () => { vid.pause(); vid.src = ''; mat.dispose(); vtex.dispose(); black.dispose(); Object.values(gens).forEach((g) => g.tex.dispose()); S.upload?.dispose() },
  }
}

/**
 * Guides drawn just in front of the LED for whoever is authoring the picture:
 * the cabin's footprint in the raster, and a 640 px grid.
 */
export function buildLedGuides() {
  const group = new THREE.Group()
  const z = LED.z + 0.02
  const cabin = new THREE.Group()
  const grid = new THREE.Group()
  group.add(cabin, grid)

  // cabin zone: a red tint and a dashed outline where the cabin stands in front of the wall
  {
    const cb = cabinPx()
    const x0 = LED.x[0] + (cb.x0 / LED.px[0]) * LED.w, x1 = LED.x[0] + (cb.x1 / LED.px[0]) * LED.w
    const y1 = LED.y[1] - (cb.y0 / LED.px[1]) * LED.h, y0 = LED.y[1] - (cb.y1 / LED.px[1]) * LED.h
    const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0)
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, z)
    const tint = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xff5a5a, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }))
    tint.renderOrder = 5
    cabin.add(tint)
    const pts = [x0, y0, z, x1, y0, z, x1, y0, z, x1, y1, z, x1, y1, z, x0, y1, z, x0, y1, z, x0, y0, z]
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    const ln = new THREE.LineSegments(lg, new THREE.LineDashedMaterial({ color: 0xff7a7a, dashSize: 0.3, gapSize: 0.18, depthTest: false }))
    ln.computeLineDistances(); ln.renderOrder = 6
    cabin.add(ln)
  }
  // the 640 px grid
  {
    const pts: number[] = []
    for (let px = 0; px <= LED.px[0]; px += 640) { const x = LED.x[0] + (px / LED.px[0]) * LED.w; pts.push(x, LED.y[0], z, x, LED.y[1], z) }
    for (let py = 0; py <= LED.px[1]; py += 480) { const y = LED.y[1] - (py / LED.px[1]) * LED.h; pts.push(LED.x[0], y, z, LED.x[1], y, z) }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    const ln = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x9cc0ff, transparent: true, opacity: 0.55, depthTest: false }))
    ln.renderOrder = 6
    grid.add(ln)
  }
  cabin.visible = false
  grid.visible = false
  return { group, cabin, grid }
}
