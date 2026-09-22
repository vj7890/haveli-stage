// @ts-nocheck
/**
 * Scene blocking for the Haveli stage — a port of the Janma Jayanti blocking
 * tool onto this site and this stage. Two plans per cue: the stage, and the
 * whole hall with its seating. People drop role markers on them, group them,
 * draw numbered move arrows, ghost the previous cue, and the cue list writes
 * itself. Live sync through Supabase when connected (the config travels in
 * the link); otherwise the plan autosaves in this browser.
 *
 * mountBlocking(root) wires the markup inside `root` and returns a teardown.
 */
import {
  DEFAULT_VENUE, STAGE_VIEW, hallView, SY, UP, buildHall, seatAt, seatXY, rowLabel, seatLabel,
  nearZone, hallLabel, stagePos, stagePlate, hallPlate, el, label, P,
} from './geometry'
import { CUE_SHEET } from './cues'

export const ROLE_SHAPES = ['circle', 'square', 'triangle']
export const DEFAULT_ROLES = [
  { id: 'r_sant', name: 'Sant', color: '#C8761B', shape: 'circle' },
  { id: 'r_speaker', name: 'Speaker', color: '#7A3E9D', shape: 'circle' },
  { id: 'r_dancer', name: 'Dancer', color: '#1F7A4D', shape: 'circle' },
  { id: 'r_singer', name: 'Singer', color: '#0F6F9E', shape: 'circle' },
  { id: 'r_musician', name: 'Musician', color: '#4A5AA8', shape: 'circle' },
  { id: 'r_actor', name: 'Actor', color: '#C22E4A', shape: 'circle' },
  { id: 'r_child', name: 'Child', color: '#2F6FD0', shape: 'circle' },
  { id: 'r_marshal', name: 'Marshal', color: '#6B7280', shape: 'circle' },
  { id: 'r_prop', name: 'Prop', color: '#8B5E34', shape: 'square' },
  { id: 'r_set', name: 'Set piece', color: '#3F6B5B', shape: 'square' },
  { id: 'r_camera', name: 'Camera', color: '#111827', shape: 'triangle' },
]
const uid = (p) => p + Math.random().toString(36).slice(2, 9)
const plural = (name) => { const n = name.toLowerCase(); return n.endsWith('child') ? n.slice(0, -5) + 'children' : n.endsWith('s') ? n : n + 's' }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const SURFACES = ['stage', 'hall']
const SURF_NAME = { stage: 'stage', hall: 'hall' }
const LOCAL_KEY = 'haveli-blocking-v1'
const DOC_ID = 'haveli'

const blankCue = (no) => ({ id: uid('q_'), no: String(no), title: '', time: '', presenters: '', props: '', notes: '', items: [], paths: [] })
/** A pasted row: [no, item, start, duration, presenters, props]. */
const cueFrom = (r) => ({ id: uid('q_'), no: String(r[0]), title: r[1] || '', time: (r[2] || '') + (r[3] ? '  ·  ' + r[3] : ''), presenters: r[4] || '', props: r[5] || '', notes: '', items: [], paths: [] })
/** A row of the bundled sheet: [no, item, duration, act/scene, presenters, notes]. */
const cueFromSheet = (r) => ({ id: uid('q_'), no: String(r[0]), title: r[1] || '', time: r[2] || '', presenters: r[4] || '', props: '', notes: (r[3] ? r[3] + '\n\n' : '') + (r[5] || ''), items: [], paths: [] })
const blankSection = (code, title) => ({ id: uid('sec_'), code, title, script: '', cues: [blankCue(1)] })
const seedSections = () => CUE_SHEET.map(([code, title, cues]) => ({ id: uid('sec_'), code, title, script: '', cues: cues.map(cueFromSheet) }))
const blankShow = () => ({ v: 4, name: 'Haveli', venue: null, roles: DEFAULT_ROLES.map((r) => ({ ...r })), sections: seedSections() })
function migrate(d) {
  if (!d || !d.sections) return blankShow()
  if (d.v < 4) {
    // an OVO-era document: its arena positions were in a different frame, so they go
    for (const s of d.sections) for (const q of s.cues) { q.items = (q.items || []).filter((i) => i.surface === 'stage'); q.paths = (q.paths || []).filter((p) => p.surface === 'stage') }
    d.venue = null; d.v = 4
  }
  return d
}

/* ---- a zip with no compression (PNGs are already compressed), for browsers without a folder picker ---- */
let CRC_TABLE = null
function crc32(u8) {
  if (!CRC_TABLE) { CRC_TABLE = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC_TABLE[n] = c >>> 0 } }
  let crc = -1
  for (let i = 0; i < u8.length; i++) crc = CRC_TABLE[(crc ^ u8[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ -1) >>> 0
}
function zipStore(files) {
  const enc = new TextEncoder(), parts = [], central = []
  const now = new Date(), dosT = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1), dosD = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()
  let off = 0
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), n = f.data.length
    const lh = new DataView(new ArrayBuffer(30))
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true); lh.setUint16(10, dosT, true); lh.setUint16(12, dosD, true)
    lh.setUint32(14, crc, true); lh.setUint32(18, n, true); lh.setUint32(22, n, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true)
    parts.push(lh.buffer, name, f.data)
    const cd = new DataView(new ArrayBuffer(46))
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true); cd.setUint16(10, 0, true); cd.setUint16(12, dosT, true); cd.setUint16(14, dosD, true)
    cd.setUint32(16, crc, true); cd.setUint32(20, n, true); cd.setUint32(24, n, true); cd.setUint16(28, name.length, true); cd.setUint16(30, 0, true); cd.setUint16(32, 0, true); cd.setUint16(34, 0, true); cd.setUint16(36, 0, true); cd.setUint32(38, 0, true); cd.setUint32(42, off, true)
    central.push(cd.buffer, name)
    off += 30 + name.length + n
  }
  const cdSize = central.reduce((a, b) => a + b.byteLength, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true); end.setUint16(4, 0, true); end.setUint16(6, 0, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, off, true); end.setUint16(20, 0, true)
  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' })
}

export function mountBlocking(root) {
  const $ = (s) => root.querySelector(s)
  const $$ = (s) => Array.from(root.querySelectorAll(s))

  let show = blankShow()
  let sel = { sec: 0, cue: 0, itemId: null, pathId: null }
  let armedRole = null, arrowMode = false, arrowStart = null
  let surface = 'stage'
  const opts = { snap: true, labels: true, ghost: false }
  let editorName = '', dirty = false, lastSavedAt = 0, backend = null
  let VENUE = JSON.parse(JSON.stringify(DEFAULT_VENUE))
  let HALL = buildHall(VENUE)
  const timers = []

  const section = () => show.sections[Math.min(sel.sec, show.sections.length - 1)]
  const scene = () => { const sc = section(); return sc.cues[Math.min(sel.cue, sc.cues.length - 1)] }
  const cueTitle = () => { const sc = section(), q = scene(); return `${sc.code || ''}${sc.code ? ' · ' : ''}cue ${q.no}  —  ${q.title || sc.title || ''}` }
  const prevCue = () => {
    if (sel.cue > 0) return section().cues[sel.cue - 1]
    for (let i = sel.sec - 1; i >= 0; i--) { const c = show.sections[i].cues; if (c.length) return c[c.length - 1] }
    return null
  }
  const role = (id) => show.roles.find((r) => r.id === id) || { name: '?', color: '#666', shape: 'circle' }
  const toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2400) }
  const locationOf = (it) => (it.surface === 'hall' ? hallLabel(HALL, it) : stagePos(it.x, it.y))

  /* ---- markers and moves --------------------------------------------------- */
  function markerShape(shape, r) {
    if (shape === 'square') return el('rect', { x: -r * 0.88, y: -r * 0.88, width: r * 1.76, height: r * 1.76, rx: r * 0.18 })
    if (shape === 'triangle') return el('path', { d: `M 0 ${-r * 1.05} L ${r} ${r * 0.75} L ${-r} ${r * 0.75} Z` })
    return el('circle', { r })
  }
  function markerNumbers(sc, surf) {
    const c = {}, m = {}
    sc.items.filter((i) => i.surface === surf).forEach((it) => { c[it.roleId] = (c[it.roleId] || 0) + 1; m[it.id] = c[it.roleId] })
    return m
  }
  function moveTag(sc, surf, p) {
    const list = sc.paths.filter((x) => x.surface === surf)
    const owner = p.ownerId ? sc.items.find((i) => i.id === p.ownerId && i.surface === surf) : null
    if (owner) {
      const nums = markerNumbers(sc, surf), mine = list.filter((x) => x.ownerId === p.ownerId), idx = mine.indexOf(p)
      return { tag: String(nums[owner.id] || '?') + (mine.length > 1 ? String.fromCharCode(97 + idx) : ''), owner, colour: role(owner.roleId).color, n: idx + 1, of: mine.length }
    }
    const loose = list.filter((x) => !x.ownerId)
    return { tag: String(loose.indexOf(p) + 1), owner: null, colour: '#C22E4A', n: loose.indexOf(p) + 1, of: loose.length }
  }
  function drawItems(g, sc, surf, S, ghost) {
    const counters = {}
    sc.items.filter((i) => i.surface === surf).forEach((it) => {
      counters[it.roleId] = (counters[it.roleId] || 0) + 1
      const rl = role(it.roleId), r = S.r, n = it.count || 1
      const grp = el('g', { transform: `translate(${it.x} ${it.y})`, 'data-item': it.id, opacity: ghost ? 0.22 : 1 })
      let sh
      const b = surf === 'hall' && it.seat ? HALL.blocks.find((x) => x.id === it.seat.block) : null
      if (b && n > 1) {   // a run of seats: draw the span it actually occupies
        const len = (n - 1) * b.pitchSeat
        sh = el('rect', { x: -r, y: -r, width: len + 2 * r, height: 2 * r, rx: r })
      } else sh = markerShape(rl.shape, r)
      sh.setAttribute('fill', rl.color)
      sh.setAttribute('stroke', it.id === sel.itemId && !ghost ? '#111' : 'rgba(255,255,255,.9)')
      sh.setAttribute('stroke-width', it.id === sel.itemId && !ghost ? r * 0.3 : r * 0.15)
      grp.appendChild(sh)
      const inner = n > 1 ? '×' + n : String(counters[it.roleId])
      grp.appendChild(label(0, r * 0.36, inner, r * (inner.length > 2 ? 0.72 : 0.95), '#fff', 'middle', { 'font-weight': '700', 'pointer-events': 'none' }))
      if (opts.labels && !ghost) {
        const lab = it.label || (n > 1 ? `${n} ${plural(rl.name)}` : rl.name)
        grp.appendChild(label(0, r * 2.2, lab, r * 0.85, '#2F373E', 'middle', { 'pointer-events': 'none', 'paint-order': 'stroke', stroke: P.paper, 'stroke-width': r * 0.26 }))
      }
      g.appendChild(grp)
    })
  }
  function drawPaths(g, sc, surf, S, ghost) {
    sc.paths.filter((p) => p.surface === surf).forEach((p) => {
      const info = moveTag(sc, surf, p), col = info.colour
      const grp = el('g', { 'data-path': p.id, opacity: ghost ? 0.22 : 1 })
      const ang = Math.atan2(p.y2 - p.y1, p.x2 - p.x1), head = S.r * 1.6, halfW = S.r * 0.95, len = Math.hypot(p.x2 - p.x1, p.y2 - p.y1) || 1
      const bx = p.x2 - Math.cos(ang) * head, by = p.y2 - Math.sin(ang) * head, px = -Math.sin(ang) * halfW, py = Math.cos(ang) * halfW
      if (p.id === sel.pathId && !ghost) grp.appendChild(el('path', { d: `M ${p.x1} ${p.y1} L ${p.x2} ${p.y2}`, fill: 'none', stroke: '#111', 'stroke-width': S.r * 0.62, 'stroke-linecap': 'round', opacity: 0.35 }))
      grp.appendChild(el('path', { d: `M ${p.x1} ${p.y1} L ${bx} ${by}`, fill: 'none', stroke: col, 'stroke-width': S.r * 0.3, 'stroke-linecap': 'round' }))
      grp.appendChild(el('path', { d: `M ${p.x2} ${p.y2} L ${bx + px} ${by + py} L ${bx - px} ${by - py} Z`, fill: col }))
      const t = Math.min(0.4, Math.max(0.22, (S.r * 2.4) / len))
      const mx = p.x1 + (p.x2 - p.x1) * t, my = p.y1 + (p.y2 - p.y1) * t, nx = -Math.sin(ang) * S.r * 1.35, ny = Math.cos(ang) * S.r * 1.35, R = S.r * 0.98
      grp.appendChild(el('circle', { cx: mx + nx, cy: my + ny, r: R, fill: col, stroke: P.paper, 'stroke-width': R * 0.2 }))
      grp.appendChild(label(mx + nx, my + ny + R * 0.36, info.tag, R * (info.tag.length > 2 ? 0.72 : 0.9), '#fff', 'middle', { 'font-weight': '700', 'pointer-events': 'none' }))
      if (p.label) grp.appendChild(label(mx + nx * 2.3, my + ny * 2.3, p.label, S.r * 0.8, col, 'middle', { 'paint-order': 'stroke', stroke: P.paper, 'stroke-width': S.r * 0.26 }))
      g.appendChild(grp)
    })
  }
  function legendFor(sc, surf, x, y, size) {
    const used = [...new Set(sc.items.filter((i) => i.surface === surf).map((i) => i.roleId))]
    if (!used.length) return el('g', {})
    const g = el('g', { transform: `translate(${x} ${y})` }); let cx = 0
    used.forEach((rid) => {
      const rl = role(rid), n = sc.items.filter((it) => it.surface === surf && it.roleId === rid).reduce((a, b) => a + (b.count || 1), 0)
      const lab = `${rl.name}  (${n})`
      const sh = markerShape(rl.shape, size * 0.42); sh.setAttribute('fill', rl.color)
      const h = el('g', { transform: `translate(${cx} 0)` })
      h.appendChild(sh); h.appendChild(label(size * 0.8, size * 0.34, lab, size * 0.85, '#4A535B', 'start'))
      g.appendChild(h); cx += size * 0.8 + lab.length * size * 0.48 + size * 1.6
    })
    return g
  }
  const fullView = (surf) => (surf === 'stage' ? { ...STAGE_VIEW } : hallView())
  const S_OF = { stage: { r: 0.34 }, hall: { r: 0.5 } }

  function buildSurface(surf, sc, ghost, view, heading) {
    const v = view || fullView(surf)
    const svg = el('svg', { viewBox: `${v.x} ${v.y} ${v.w} ${v.h}`, xmlns: 'http://www.w3.org/2000/svg', preserveAspectRatio: 'xMidYMid meet' })
    svg.appendChild(el('rect', { x: v.x - 500, y: v.y - 500, width: v.w + 1000, height: v.h + 1000, fill: P.paper }))
    const gPlate = el('g', {}); gPlate.appendChild(surf === 'hall' ? hallPlate(HALL) : stagePlate())
    svg.appendChild(gPlate)
    const ctx = { svg, S: S_OF[surf], surf, view: v, heading, gPlate, gGhost: el('g', {}), gMain: el('g', {}), gTop: el('g', {}) }
    svg.appendChild(ctx.gGhost); svg.appendChild(ctx.gMain); svg.appendChild(ctx.gTop)
    paint(ctx, sc, ghost)
    return ctx
  }
  function paint(ctx, sc, ghost) {
    const { gGhost, gMain, gTop, S, surf, view } = ctx
    for (const g of [gGhost, gMain, gTop]) while (g.firstChild) g.removeChild(g.firstChild)
    if (ghost) { drawPaths(gGhost, ghost, surf, S, true); drawItems(gGhost, ghost, surf, S, true) }
    drawPaths(gMain, sc, surf, S, false); drawItems(gMain, sc, surf, S, false)
    const ts = view.w * 0.017, pad = view.w * 0.008
    gTop.appendChild(label(view.x + pad, view.y + ts + pad, ctx.heading || cueTitle(), ts, '#2F373E', 'start'))
    gTop.appendChild(label(view.x + view.w - pad, view.y + ts + pad, (sc.time ? sc.time + '   ·   ' : '') + (surf === 'hall' ? 'hall positions' : 'stage positions'), ts * 0.58, '#8A939B', 'end'))
    gTop.appendChild(legendFor(sc, surf, view.x + pad, view.y + view.h - ts * 1.1, ts * 0.78))
  }
  function plainSVG(surf, sc, heading) {
    const k = sel.itemId, kp = sel.pathId; sel.itemId = null; sel.pathId = null
    const c = buildSurface(surf, sc, null, fullView(surf), heading)
    sel.itemId = k; sel.pathId = kp; return c.svg
  }

  /* ---- live view, zoom, pointer ------------------------------------------- */
  let LIVE = null, VIEWS = { stage: null, hall: null }
  const ghostScene = () => (opts.ghost ? prevCue() : null)
  function mount() {
    const wrap = $('#sheet'); wrap.innerHTML = ''
    if (!VIEWS[surface]) VIEWS[surface] = fullView(surface)
    LIVE = buildSurface(surface, scene(), ghostScene(), VIEWS[surface])
    wrap.appendChild(LIVE.svg); wireCanvas(LIVE.svg)
  }
  function draw() { if (!LIVE || LIVE.surf !== surface) { mount(); return } paint(LIVE, scene(), ghostScene()) }
  function applyView() {
    const v = VIEWS[surface]; LIVE.view = v
    LIVE.svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`)
    const bg = LIVE.svg.firstChild
    bg.setAttribute('x', v.x - 500); bg.setAttribute('y', v.y - 500); bg.setAttribute('width', v.w + 1000); bg.setAttribute('height', v.h + 1000)
    paint(LIVE, scene(), ghostScene())
  }
  function zoomBy(k, cx, cy) {
    const v = VIEWS[surface], full = fullView(surface)
    const nw = clamp(v.w * k, full.w / 40, full.w * 1.6), nh = (nw * v.h) / v.w
    if (cx == null) { cx = v.x + v.w / 2; cy = v.y + v.h / 2 }
    VIEWS[surface] = { x: cx - ((cx - v.x) * nw) / v.w, y: cy - ((cy - v.y) * nh) / v.h, w: nw, h: nh }
    applyView()
  }
  const ptOf = (svg, e) => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(svg.getScreenCTM().inverse()); return { x: q.x, y: q.y } }
  function snapPoint(x, y) {
    const grid = (v) => Math.round(v * 4) / 4
    if (surface === 'hall') { const s = opts.snap ? seatAt(HALL, x, y) : null; if (s) return { x: s.x, y: s.y, seat: { block: s.block.id, r: s.r, s: s.s } } }
    return opts.snap ? { x: grid(x), y: grid(y), seat: null } : { x, y, seat: null }
  }
  /** Whose move: the marker it starts on, or the marker whose last arrow ended here. */
  function ownerNear(x, y) {
    const tol = S_OF[surface].r * 3.2
    let best = null, bd = tol
    scene().items.filter((i) => i.surface === surface).forEach((i) => { const d = Math.hypot(i.x - x, i.y - y); if (d < bd) { bd = d; best = i.id } })
    if (best) return best
    let bp = null, bpd = tol
    scene().paths.filter((p) => p.surface === surface).forEach((p) => { const d = Math.hypot(p.x2 - x, p.y2 - y); if (d < bpd && p.ownerId) { bpd = d; bp = p.ownerId } })
    return bp
  }
  function wireCanvas(svg) {
    let drag = null, pan = null
    svg.addEventListener('wheel', (e) => { e.preventDefault(); const p = ptOf(svg, e); zoomBy(e.deltaY > 0 ? 1.15 : 1 / 1.15, p.x, p.y) }, { passive: false })
    svg.addEventListener('contextmenu', (e) => e.preventDefault())
    svg.addEventListener('pointermove', (e) => {
      const p = ptOf(svg, e)
      if (pan) {
        const v = VIEWS[surface]
        VIEWS[surface] = { ...v, x: pan.vx - ((e.clientX - pan.cx) * v.w) / svg.clientWidth, y: pan.vy - ((e.clientY - pan.cy) * v.h) / svg.clientHeight }
        applyView(); return
      }
      if (surface === 'hall') {
        const s = seatAt(HALL, p.x, p.y)
        $('#stPos').textContent = s ? `${s.block.id} · row ${rowLabel(s.block, s.r)} · seat ${seatLabel(s.block, s.s)}` : `${nearZone(HALL, p.x, p.y)}  (${p.x.toFixed(1)}, ${UP(p.y).toFixed(1)} m)`
      } else { const q = snapPoint(p.x, p.y); $('#stPos').textContent = stagePos(q.x, q.y) }
      if (drag) {
        const q = snapPoint(p.x - drag.dx, p.y - drag.dy)
        drag.it.x = q.x; drag.it.y = q.y; drag.it.seat = q.seat
        paint(LIVE, scene(), ghostScene()); markDirty()
      }
    })
    svg.addEventListener('pointerdown', (e) => {
      const p = ptOf(svg, e)
      if (e.button === 1 || e.shiftKey || e.button === 2) { pan = { cx: e.clientX, cy: e.clientY, vx: VIEWS[surface].x, vy: VIEWS[surface].y }; svg.setPointerCapture(e.pointerId); return }
      const hi = e.target.closest('[data-item]'), hp = e.target.closest('[data-path]')
      if (arrowMode) {
        const q = snapPoint(p.x, p.y)
        if (!arrowStart) { arrowStart = q; renderStatus() }
        else {
          const owner = ownerNear(arrowStart.x, arrowStart.y)
          scene().paths.push({ id: uid('p_'), surface, ownerId: owner, x1: arrowStart.x, y1: arrowStart.y, x2: q.x, y2: q.y, label: '' })
          arrowStart = null; arrowMode = false; $('#btnArrow').classList.remove('key'); renderAll(); markDirty()
        }
        return
      }
      if (hi) {
        const id = hi.getAttribute('data-item')
        let it = scene().items.find((i) => i.id === id)
        if (e.altKey) { const c = JSON.parse(JSON.stringify(it)); c.id = uid('i_'); scene().items.push(c); it = c }
        sel.itemId = it.id; sel.pathId = null
        drag = { it, dx: p.x - it.x, dy: p.y - it.y }
        svg.setPointerCapture(e.pointerId); renderInspector(); draw(); return
      }
      if (hp) { sel.pathId = hp.getAttribute('data-path'); sel.itemId = null; renderInspector(); draw(); return }
      if (armedRole) {
        const q = snapPoint(p.x, p.y)
        const it = { id: uid('i_'), roleId: armedRole, surface, x: q.x, y: q.y, seat: q.seat, count: 1, label: '', note: '' }
        scene().items.push(it); sel.itemId = it.id; sel.pathId = null
        renderPalette(); renderInspector(); renderScenes(); draw(); markDirty(); return
      }
      sel.itemId = null; sel.pathId = null; renderInspector(); draw()
    })
    const up = () => { if (drag) { drag = null; renderInspector() } pan = null }
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up)
  }

  /* ---- panels ----------------------------------------------------------------- */
  function renderScenes() {
    const c = $('#scenes'); c.innerHTML = ''
    let total = 0
    show.sections.forEach((sc, si) => {
      total += sc.cues.length
      const h = document.createElement('div'); h.className = 'sechead'
      h.innerHTML = `<b>${esc(sc.code || '—')}</b><span>${esc(sc.title || '')}</span><em>${sc.cues.length} cue${sc.cues.length === 1 ? '' : 's'}</em>`
      h.onclick = () => { sel = { sec: si, cue: 0, itemId: null, pathId: null }; renderAll() }
      c.appendChild(h)
      sc.cues.forEach((q, qi) => {
        const d = document.createElement('div')
        d.className = 'cue' + (si === sel.sec && qi === sel.cue ? ' sel' : '')
        d.innerHTML = `<code>${esc(q.no)}</code><span class="nm">${esc(q.title || '(untitled)')}</span><span class="ct">${q.items.length || ''}</span>`
        d.onclick = () => { sel = { sec: si, cue: qi, itemId: null, pathId: null }; renderAll() }
        c.appendChild(d)
      })
    })
    $('#sceneCount').textContent = total
    const selEl = c.querySelector('.cue.sel'); if (selEl) selEl.scrollIntoView({ block: 'nearest' })
  }
  function renderPalette() {
    const c = $('#palette'); c.innerHTML = ''
    show.roles.forEach((r) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'prole' + (armedRole === r.id ? ' armed' : '')
      const n = scene().items.filter((i) => i.roleId === r.id).reduce((a, x) => a + (x.count || 1), 0)
      b.innerHTML = `<span class="swatch ${r.shape === 'square' ? 'sq' : r.shape === 'triangle' ? 'tri' : ''}" style="background:${r.color}"></span><span class="nm">${esc(r.name)}</span><span class="n">${n || ''}</span>`
      b.onclick = () => { armedRole = armedRole === r.id ? null : r.id; arrowMode = false; $('#btnArrow').classList.remove('key'); renderPalette(); renderStatus() }
      c.appendChild(b)
    })
  }
  function renderInspector() {
    const box = $('#inspector')
    const it = scene().items.find((i) => i.id === sel.itemId), pt = scene().paths.find((p) => p.id === sel.pathId)
    if (!it && !pt) { box.innerHTML = '<h3>Selected</h3><div class="empty">Pick a role, then click the plan. Click a marker to edit it, drag to move it, Alt-drag to copy.</div>'; return }
    if (pt) {
      const info = moveTag(scene(), pt.surface, pt), nums = markerNumbers(scene(), pt.surface)
      const opts2 = scene().items.filter((i) => i.surface === pt.surface).map((i) => `<option value="${i.id}" ${pt.ownerId === i.id ? 'selected' : ''}>${esc(i.label || role(i.roleId).name)} ${nums[i.id]}</option>`).join('')
      box.innerHTML = `<h3>Move ${esc(info.tag)}${info.of > 1 ? `  (${info.n} of ${info.of})` : ''}</h3>` +
        `<div class="field"><label>Who is moving</label><select id="pOwner"><option value="">— not linked —</option>${opts2}</select></div>` +
        `<div class="field"><label>Label</label><input id="pLabel" value="${esc(pt.label || '')}" placeholder="cross to CL"></div>` +
        '<div class="row2"><button type="button" class="tbtn" id="pUp">Earlier</button><button type="button" class="tbtn" id="pDown">Later</button></div>' +
        '<div style="height:9px"></div><button type="button" class="del" id="pDel">Delete arrow</button>'
      $('#pOwner').onchange = (e) => { pt.ownerId = e.target.value || null; renderInspector(); draw(); markDirty() }
      $('#pLabel').oninput = (e) => { pt.label = e.target.value; draw(); markDirty() }
      const swap = (d) => {
        const all = scene().paths, same = all.filter((p) => p.surface === pt.surface && (p.ownerId || null) === (pt.ownerId || null))
        const i = same.indexOf(pt), j = i + d; if (j < 0 || j >= same.length) return
        const a = all.indexOf(same[i]), b = all.indexOf(same[j]); [all[a], all[b]] = [all[b], all[a]]
        renderInspector(); draw(); markDirty()
      }
      $('#pUp').onclick = () => swap(-1); $('#pDown').onclick = () => swap(1)
      $('#pDel').onclick = () => { scene().paths = scene().paths.filter((p) => p.id !== pt.id); sel.pathId = null; renderAll(); markDirty() }
      return
    }
    const rl = role(it.roleId)
    let posUI
    if (it.surface === 'hall') {
      const b = it.seat ? HALL.blocks.find((x) => x.id === it.seat.block) : null
      posUI = `<div class="row3">
        <div class="field"><label>Block</label><select id="iBlock"><option value="">— free —</option>${HALL.blocks.map((x) => `<option ${b && b.id === x.id ? 'selected' : ''}>${x.id}</option>`).join('')}</select></div>
        <div class="field"><label>Row</label><select id="iRow" ${b ? '' : 'disabled'}>${b ? Array.from({ length: b.rows }, (_, r) => `<option value="${r}" ${it.seat.r === r ? 'selected' : ''}>${rowLabel(b, r)}</option>`).join('') : ''}</select></div>
        <div class="field"><label>Seat</label><select id="iSeat" ${b ? '' : 'disabled'}>${b ? Array.from({ length: b.seats }, (_, s) => `<option value="${s}" ${it.seat.s === s ? 'selected' : ''}>${seatLabel(b, s)}</option>`).join('') : ''}</select></div></div>`
    } else {
      posUI = `<div class="row2"><div class="field"><label>Across (m, + = SL)</label><input id="iX" type="number" step="0.25" value="${(+it.x).toFixed(2)}"></div>
        <div class="field"><label>Upstage (m)</label><input id="iY" type="number" step="0.25" value="${UP(it.y).toFixed(2)}"></div></div>`
    }
    box.innerHTML = '<h3>Selected marker</h3>' +
      `<div class="field"><label>Role</label><select id="iRole">${show.roles.map((r) => `<option value="${r.id}" ${r.id === it.roleId ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>` +
      `<div class="row2"><div class="field"><label>Label</label><input id="iLabel" value="${esc(it.label || '')}" placeholder="${esc(rl.name)}"></div>
       <div class="field"><label>How many</label><input id="iCount" type="number" min="1" value="${it.count || 1}"></div></div>` +
      posUI +
      `<div class="field"><label>Position</label><div class="zone">${esc(locationOf(it))}</div></div>` +
      `<div class="field"><label>Note</label><textarea id="iNote" placeholder="entrance, business, prop handled">${esc(it.note || '')}</textarea></div>` +
      '<button type="button" class="del" id="iDel">Delete marker</button>'
    const zone = () => { const z = box.querySelector('.zone'); if (z) z.textContent = locationOf(it) }
    $('#iRole').onchange = (e) => { it.roleId = e.target.value; renderAll(); markDirty() }
    $('#iLabel').oninput = (e) => { it.label = e.target.value; draw(); markDirty() }
    $('#iCount').oninput = (e) => { it.count = Math.max(1, +e.target.value || 1); renderPalette(); draw(); zone(); markDirty() }
    $('#iNote').oninput = (e) => { it.note = e.target.value; markDirty() }
    if (it.surface === 'hall') {
      const setSeat = () => {
        const bid = $('#iBlock').value
        if (!bid) { it.seat = null; renderInspector(); draw(); markDirty(); return }
        const b = HALL.blocks.find((x) => x.id === bid)
        const r = clamp(+($('#iRow').value || 0), 0, b.rows - 1), s = clamp(+($('#iSeat').value || 0), 0, b.seats - 1)
        const c = seatXY(b, r, s); it.seat = { block: bid, r, s }; it.x = c.x; it.y = c.y
        renderInspector(); draw(); markDirty()
      }
      $('#iBlock').onchange = () => {
        const b = HALL.blocks.find((x) => x.id === $('#iBlock').value)
        if (b) { it.seat = { block: b.id, r: 0, s: 0 }; const c = seatXY(b, 0, 0); it.x = c.x; it.y = c.y } else it.seat = null
        renderInspector(); draw(); markDirty()
      }
      if ($('#iRow')) $('#iRow').onchange = setSeat
      if ($('#iSeat')) $('#iSeat').onchange = setSeat
    } else {
      $('#iX').oninput = (e) => { it.x = +e.target.value; draw(); zone(); markDirty() }
      $('#iY').oninput = (e) => { it.y = SY(+e.target.value); draw(); zone(); markDirty() }
    }
    $('#iDel').onclick = deleteSelected
  }
  function renderFields() {
    const sc = section(), q = scene()
    $('#fSecCode').value = sc.code || ''; $('#fSecTitle').value = sc.title || ''; $('#fScript').value = sc.script || ''
    $('#fNo').value = q.no || ''; $('#fTitle').value = q.title || ''; $('#fTime').value = q.time || ''
    $('#fPres').value = q.presenters || ''; $('#fProps').value = q.props || ''; $('#fNotes').value = q.notes || ''
  }
  function renderStatus() {
    $('#stMode').textContent = arrowMode ? (arrowStart ? 'Move arrow — click the end' : 'Move arrow — click the start') : armedRole ? `Placing: ${role(armedRole).name}  (Esc to stop)` : 'Select'
  }
  function renderAll() { renderScenes(); renderPalette(); renderFields(); renderInspector(); renderStatus(); draw() }
  function deleteSelected() {
    const s = scene()
    if (sel.itemId) { s.items = s.items.filter((i) => i.id !== sel.itemId); sel.itemId = null }
    else if (sel.pathId) { s.paths = s.paths.filter((p) => p.id !== sel.pathId); sel.pathId = null }
    else return
    renderAll(); markDirty()
  }
  const onKey = (e) => {
    const t = (e.target.tagName || '').toLowerCase()
    if (t === 'input' || t === 'textarea' || t === 'select') return
    if (e.key === 'Escape') { armedRole = null; arrowMode = false; arrowStart = null; $('#btnArrow').classList.remove('key'); renderPalette(); renderStatus() }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected() }
  }
  document.addEventListener('keydown', onKey)

  $$('.tab').forEach((t) => (t.onclick = () => {
    $$('.tab').forEach((x) => x.classList.remove('on'))
    t.classList.add('on'); surface = t.dataset.surface
    sel.itemId = null; sel.pathId = null; arrowMode = false; arrowStart = null; $('#btnArrow').classList.remove('key')
    renderInspector(); renderStatus(); mount()
  }))
  for (const [id, k] of [['fSecCode', 'code'], ['fSecTitle', 'title'], ['fScript', 'script']]) $('#' + id).oninput = (e) => { section()[k] = e.target.value; renderScenes(); draw(); markDirty() }
  for (const [id, k] of [['fNo', 'no'], ['fTitle', 'title'], ['fTime', 'time'], ['fPres', 'presenters'], ['fProps', 'props'], ['fNotes', 'notes']]) {
    $('#' + id).oninput = (e) => { scene()[k] = e.target.value; renderScenes(); if (k === 'no' || k === 'title' || k === 'time') draw(); markDirty() }
  }
  $('#optSnap').onchange = (e) => (opts.snap = e.target.checked)
  $('#optLabels').onchange = (e) => { opts.labels = e.target.checked; draw() }
  $('#optGhost').onchange = (e) => { opts.ghost = e.target.checked; draw() }
  $('#btnZoomIn').onclick = () => zoomBy(1 / 1.4)
  $('#btnZoomOut').onclick = () => zoomBy(1.4)
  $('#btnFit').onclick = () => { VIEWS[surface] = fullView(surface); applyView() }
  $('#btnArrow').onclick = (e) => { arrowMode = !arrowMode; armedRole = null; arrowStart = null; e.currentTarget.classList.toggle('key', arrowMode); renderPalette(); renderStatus() }
  $('#btnClear').onclick = () => ask('Clear this plan', `Removes every marker and arrow on the ${SURF_NAME[surface]} plan for cue ${scene().no}.`, `Clear the ${SURF_NAME[surface]}`, () => {
    scene().items = scene().items.filter((i) => i.surface !== surface); scene().paths = scene().paths.filter((p) => p.surface !== surface); renderAll(); markDirty()
  })
  $('#btnAddCue').onclick = () => { const sc = section(); sc.cues.splice(sel.cue + 1, 0, blankCue('')); sel.cue++; sel.itemId = null; renderAll(); markDirty() }
  $('#btnDupCue').onclick = () => {
    const sc = section(), q = JSON.parse(JSON.stringify(scene()))
    q.id = uid('q_'); q.no = (q.no || '') + 'a'; q.items.forEach((i) => (i.id = uid('i_'))); q.paths.forEach((x) => (x.id = uid('p_')))
    sc.cues.splice(sel.cue + 1, 0, q); sel.cue++; sel.itemId = null; renderAll(); markDirty()
  }
  $('#btnAddSec').onclick = () => { show.sections.splice(sel.sec + 1, 0, blankSection('NEW', 'New section')); sel = { sec: sel.sec + 1, cue: 0, itemId: null, pathId: null }; renderAll(); markDirty() }
  $('#btnDelCue').onclick = () => {
    const sc = section()
    if (sc.cues.length > 1) ask('Delete cue', `Cue ${scene().no} and everything placed on it.`, 'Delete cue', () => { sc.cues.splice(sel.cue, 1); sel.cue = Math.max(0, sel.cue - 1); sel.itemId = null; renderAll(); markDirty() })
    else if (show.sections.length > 1) ask('Delete section', `"${sc.title || sc.code}" is down to its last cue, so the whole section goes.`, 'Delete section', () => { show.sections.splice(sel.sec, 1); sel = { sec: Math.max(0, sel.sec - 1), cue: 0, itemId: null, pathId: null }; renderAll(); markDirty() })
    else toast('Keep at least one cue.')
  }

  /* ---- modal ---------------------------------------------------------------- */
  function modal(title, sub, body, btns) {
    $('#mTitle').textContent = title; $('#mSub').textContent = sub; $('#mBody').innerHTML = body; $('#mFoot').innerHTML = ''
    btns.forEach((b) => { const x = document.createElement('button'); x.type = 'button'; x.className = 'tbtn' + (b.key ? ' key' : ''); x.textContent = b.label; x.onclick = b.fn; $('#mFoot').appendChild(x) })
    $('#modal').classList.add('show')
  }
  const closeModal = () => $('#modal').classList.remove('show')
  const ask = (t, s, l, fn) => modal(t, s, '', [{ label: 'Cancel', fn: closeModal }, { label: l, key: true, fn: () => { closeModal(); fn() } }])
  $('#modal').onclick = (e) => { if (e.target.id === 'modal') closeModal() }

  /* ---- roles ------------------------------------------------------------------ */
  $('#btnRoles').onclick = () => {
    const rows = show.roles.map((r) => `<div class="row2 rolerow" data-r="${r.id}">
      <div class="field"><input class="rn" value="${esc(r.name)}"></div>
      <div class="field"><input class="rc" type="color" value="${r.color}"></div>
      <div class="field"><select class="rs">${ROLE_SHAPES.map((s) => `<option ${s === r.shape ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <button type="button" class="tbtn rx">×</button></div>`).join('')
    modal('Roles', 'Colour and shape are shared across every cue.', `<div id="roleRows">${rows}</div>`, [
      { label: 'Add role', fn: () => { show.roles.push({ id: uid('r_'), name: 'New role', color: '#4A5AA8', shape: 'circle' }); closeModal(); $('#btnRoles').click() } },
      { label: 'Done', key: true, fn: () => {
        $$('#roleRows [data-r]').forEach((row) => { const r = show.roles.find((x) => x.id === row.dataset.r); if (!r) return; r.name = row.querySelector('.rn').value || r.name; r.color = row.querySelector('.rc').value; r.shape = row.querySelector('.rs').value })
        closeModal(); renderAll(); markDirty()
      } }])
    $$('#roleRows .rx').forEach((b) => (b.onclick = (e) => {
      const id = e.currentTarget.closest('[data-r]').dataset.r, nm = role(id).name
      let n = 0
      for (const s of show.sections) for (const q of s.cues) { n += q.items.filter((i) => i.roleId === id).length; q.items = q.items.filter((i) => i.roleId !== id) }
      show.roles = show.roles.filter((r) => r.id !== id)
      closeModal(); renderAll(); markDirty(); toast(n ? `Removed ${nm} and ${n} marker${n === 1 ? '' : 's'}` : `Removed ${nm}`)
    }))
  }

  /* ---- venue setup ----------------------------------------------------------- */
  const applyVenue = (v) => { VENUE = v || JSON.parse(JSON.stringify(DEFAULT_VENUE)); HALL = buildHall(VENUE); VIEWS = { stage: null, hall: null } }
  $('#btnSetup').onclick = () => {
    modal('Hall seating', 'The prayer hall\u2019s four sections as the ground-floor plan draws them: two columns across (metres either side of the centre line) by two bands deep (metres in front of the stage front edge). A position is one person sitting — seatPitch across, rowPitch front to back. Edit the numbers and every marker stays put; set "seats" to false for an open floor.',
      `<textarea id="vTa" style="height:340px">${esc(JSON.stringify(show.venue || VENUE, null, 2))}</textarea>`,
      [{ label: 'Reset to defaults', fn: () => { show.venue = null; applyVenue(null); closeModal(); mount(); renderAll(); markDirty() } },
       { label: 'Cancel', fn: closeModal },
       { label: 'Apply', key: true, fn: () => {
         try { const v = JSON.parse($('#vTa').value); show.venue = v; applyVenue(v); closeModal(); mount(); renderAll(); markDirty(); toast('Seating updated') }
         catch (err) { toast('That JSON will not parse: ' + err.message) }
       } }])
  }

  /* ---- cue list text ----------------------------------------------------------- */
  function cueListText(sec, q) {
    const L = [`${sec.code} · cue ${q.no} — ${q.title}${q.time ? '  [' + q.time + ']' : ''}`]
    if (q.presenters) L.push('  PRESENTERS: ' + q.presenters)
    for (const surf of SURFACES) {
      const its = q.items.filter((i) => i.surface === surf); if (!its.length) continue
      L.push(surf === 'stage' ? '  ON STAGE' : '  IN THE HALL')
      its.forEach((i) => { const rl = role(i.roleId); L.push(`    ${i.count > 1 ? i.count + ' × ' : ''}${i.label || rl.name} — ${locationOf(i)}${i.note ? '  (' + i.note + ')' : ''}`) })
    }
    for (const surf of SURFACES) {
      const ps = q.paths.filter((p) => p.surface === surf); if (!ps.length) continue
      L.push(surf === 'stage' ? '  MOVES ON STAGE' : '  MOVES IN THE HALL')
      ps.forEach((p) => { const info = moveTag(q, surf, p); const who = info.owner ? `${info.owner.label || role(info.owner.roleId).name} ${markerNumbers(q, surf)[info.owner.id] || ''}` : 'unassigned'; L.push(`    ${info.tag}  ${who} — ${p.label || 'move'}`) })
    }
    if (q.props) L.push('  PROPS: ' + q.props)
    if (q.notes) L.push('  NOTES: ' + q.notes)
    if (sec.script) L.push('  SCRIPT: ' + sec.script)
    return L.join('\n')
  }
  const allListText = () => show.sections.map((sec) => `=== ${sec.code} — ${sec.title} ===\n\n` + sec.cues.map((q) => cueListText(sec, q)).join('\n\n')).join('\n\n')
  $('#btnList').onclick = () => {
    const all = allListText()
    modal('Cue list', 'Plain text for the script doc. Positions, movement order, props.', `<pre>${esc(all)}</pre>`, [
      { label: 'Copy this cue', fn: () => copyText(cueListText(section(), scene())) },
      { label: 'Copy this section', fn: () => copyText(section().cues.map((q) => cueListText(section(), q)).join('\n\n')) },
      { label: 'Copy all', key: true, fn: () => copyText(all) }, { label: 'Close', fn: closeModal }])
  }
  function copyText(t) {
    const done = () => toast('Copied')
    const fallback = () => { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done() } catch { toast('Select the text and copy manually') } ta.remove() }
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(done).catch(fallback); else fallback()
  }

  /* ---- load a cue sheet (paste from Sheets) ------------------------------------ */
  $('#btnLoad').onclick = () => {
    modal('Load a cue sheet',
      'Paste rows copied from the cue sheet — tab-separated, one cue per row. Columns, in order: section code, section name, cue no., item, start time, duration, presenters, props. A header row is skipped; cues with the same section code group together. This replaces the cue list but keeps roles and seating.',
      '<textarea id="csvTa" style="height:260px" placeholder="OPEN\tOpening\t1\tIntro\t5:00 PM\t0:30\tAVL\t"></textarea>',
      [{ label: 'Cancel', fn: closeModal }, { label: 'Load', key: true, fn: () => {
        const rows = $('#csvTa').value.split(/\r?\n/).map((l) => l.split('\t').map((c) => c.trim())).filter((r) => r.some((c) => c))
        const body = rows.filter((r, i) => !(i === 0 && /^(section|code|sec)/i.test(r[0] || '') && /cue/i.test(r.join(' '))))
        const secs = []
        for (const r of body) {
          const [code, name, no, item, start, dur, pres, props] = r
          if (!no && !item) continue
          let s = secs.find((x) => x.code === (code || 'SHOW'))
          if (!s) { s = { id: uid('sec_'), code: code || 'SHOW', title: name || '', script: '', cues: [] }; secs.push(s) }
          if (name && !s.title) s.title = name
          s.cues.push(cueFrom([no || String(s.cues.length + 1), item, start, dur, pres, props]))
        }
        if (!secs.length) { toast('No cues found — check the columns'); return }
        show.sections = secs; sel = { sec: 0, cue: 0, itemId: null, pathId: null }
        closeModal(); renderAll(); markDirty(); toast(`${secs.reduce((a, s) => a + s.cues.length, 0)} cues in ${secs.length} sections`)
      } }])
  }

  /* ---- export ----------------------------------------------------------------- */
  function serialize(svg, w, h) {
    const c = svg.cloneNode(true)
    c.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); c.setAttribute('width', w); c.setAttribute('height', h)
    const st = document.createElementNS('http://www.w3.org/2000/svg', 'style'); st.textContent = 'text{font-family:Onest,Helvetica,Arial,sans-serif}'
    c.insertBefore(st, c.firstChild)
    return new XMLSerializer().serializeToString(c)
  }
  const rasterise = (svg, w, h) => new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const cx = cv.getContext('2d'); cx.fillStyle = P.paper; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h); cv.toBlob((b) => (b ? res(b) : rej(new Error('canvas produced nothing'))), 'image/png') }
    img.onerror = () => rej(new Error('could not rasterise the plan'))
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(serialize(svg, w, h))
  })
  const download = (blob, fn) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fn; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000) }
  const safeName = (s) => String(s || 'cue').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_')
  // ---- export: this cue as a PNG, or a whole run of cues into a folder --------
  /** [section, cue, running number] for every cue in the given sections, numbered across the whole show. */
  const runNumbered = (secs) => { const out = []; let i = 0; for (const sec of show.sections) for (const q of sec.cues) { i++; if (secs.includes(sec)) out.push([sec, q, i]) } return out }
  async function exportSet(list, tag) {
    // ask for the folder first, while the click still counts as a user gesture
    let dir = null
    if (window.showDirectoryPicker) {
      try { dir = await window.showDirectoryPicker({ mode: 'readwrite', id: 'haveli-blocking' }) }
      catch (e) { if (e && e.name === 'AbortError') return; dir = null }
    }
    const stat = $('#expStat'), files = []
    const put = async (name, blob) => {
      if (dir) { const fh = await dir.getFileHandle(name, { create: true }); const w = await fh.createWritable(); await w.write(blob); await w.close() }
      else files.push({ name, data: new Uint8Array(await blob.arrayBuffer()) })
    }
    let n = 0
    for (const [sec, q, idx] of list) {
      const head = `${sec.code || ''}${sec.code ? ' · ' : ''}cue ${q.no}  —  ${q.title || ''}`
      const base = `${String(idx).padStart(2, '0')}-${safeName(sec.code || 'sec')}-cue${safeName(q.no)}`
      for (const surf of SURFACES) {
        const v = fullView(surf), w = 2400, h = Math.round((w * v.h) / v.w)
        await put(`${base}-${surf}.png`, await rasterise(plainSVG(surf, q, head), w, h))
      }
      if (stat) stat.textContent = `rendered ${++n} of ${list.length}…`
    }
    await put('positions.txt', new Blob([list.map(([sec, q]) => cueListText(sec, q)).join('\n\n')], { type: 'text/plain' }))
    if (!dir) download(zipStore(files), `haveli-blocking-${tag}.zip`)
    if (stat) stat.textContent = dir ? `Done — ${list.length} cue${list.length === 1 ? '' : 's'} written to the folder (${list.length * 2} plans + positions.txt).` : `Done — a zip of ${list.length * 2} plans + positions.txt has downloaded (this browser can't write straight into a folder; Chrome and Edge can).`
    toast('Exported')
  }
  $('#btnPng').onclick = () => {
    const sc = scene(), sec = section(), which = surface
    const nAll = show.sections.reduce((a, s) => a + s.cues.length, 0)
    modal('Export', 'One PNG of what you see, or every cue’s two plans as numbered files in a folder you pick, with a positions.txt.',
      `<div id="expStat" class="mono">Files are named 07-SAM-cue7-stage.png / -hall.png so they sort in running order.</div>`, [
      { label: 'This view as PNG', fn: () => { closeModal(); const v = VIEWS[which] || fullView(which); const k = sel.itemId; sel.itemId = null; const svg = buildSurface(which, sc, null, v, cueTitle()).svg; sel.itemId = k; const w = 2600, h = Math.round((w * v.h) / v.w); rasterise(svg, w, h).then((b) => { download(b, `${safeName(sec.code)}_cue${safeName(sc.no)}_${which}_view.png`); toast('Saved') }).catch((e) => toast(e.message)) } },
      { label: 'This cue → folder', fn: () => exportSet(runNumbered([sec]).filter(([, q]) => q === sc), `cue${safeName(sc.no)}`) },
      { label: `This section (${sec.cues.length}) → folder`, fn: () => exportSet(runNumbered([sec]), safeName(sec.code)) },
      { label: `Every cue (${nAll}) → folder`, key: true, fn: () => exportSet(runNumbered(show.sections), 'all') },
      { label: 'Close', fn: closeModal }])
  }
  $('#btnPrint').onclick = () => {
    const only = section()
    const run = (secs) => {
      closeModal()
      const pr = $('#printRoot'); pr.innerHTML = ''
      secs.forEach((sec) => sec.cues.forEach((q) => {
        const head = `${sec.code || ''}${sec.code ? ' · ' : ''}cue ${q.no}  —  ${q.title || ''}`
        const d = document.createElement('div'); d.className = 'psheet'
        d.innerHTML = `<h2>${esc(head)}</h2><div class="pmeta">${esc(q.time || '')}${q.presenters ? '   ·   ' + esc(q.presenters) : ''}${sec.script ? '   ·   ' + esc(sec.script) : ''}</div>`
        d.appendChild(plainSVG('stage', q, head)); d.appendChild(plainSVG('hall', q, head))
        const pre = document.createElement('pre'); pre.textContent = cueListText(sec, q); d.appendChild(pre); pr.appendChild(d)
      }))
      setTimeout(() => window.print(), 80)
    }
    const nAll = show.sections.reduce((a, s) => a + s.cues.length, 0)
    modal('Print', 'Two plans and a position list per cue.', '', [
      { label: 'This cue', fn: () => run([{ ...only, cues: [scene()] }]) },
      { label: `This section (${only.cues.length})`, fn: () => run([only]) },
      { label: `Every cue (${nAll})`, key: true, fn: () => run(show.sections) }])
  }
  $('#btnBackup').onclick = () => { download(new Blob([JSON.stringify(show, null, 2)], { type: 'application/json' }), 'haveli-blocking_' + new Date().toISOString().slice(0, 10) + '.json'); toast('Backup saved') }
  $('#btnImport').onclick = () => $('#importFile').click()
  $('#importFile').onchange = (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return
    f.text().then((t) => { try { show = migrate(JSON.parse(t)); applyVenue(show.venue); sel = { sec: 0, cue: 0, itemId: null, pathId: null }; mount(); renderAll(); markDirty(); toast('Backup restored') } catch (err) { toast('Could not read that file: ' + err.message) } })
    e.target.value = ''
  }

  /* ---- live sync ------------------------------------------------------------------ */
  const readHashCfg = () => { const m = location.hash.match(/s=([A-Za-z0-9+/=_-]+)/); if (!m) return null; try { return JSON.parse(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))) } catch { return null } }
  const writeHashCfg = (c) => { location.hash = 's=' + btoa(JSON.stringify(c)).replace(/\+/g, '-').replace(/\//g, '_') }
  function supa(cfg) {
    const base = cfg.url.replace(/\/$/, '') + '/rest/v1/' + (cfg.table || 'blocking')
    const H = /^sb_/.test(cfg.key) ? { apikey: cfg.key, 'Content-Type': 'application/json' } : { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key, 'Content-Type': 'application/json' }
    return {
      kind: 'supabase', cfg,
      async load() {
        const r = await fetch(`${base}?id=eq.${encodeURIComponent(cfg.id)}&select=doc,updated_at,updated_by`, { headers: H })
        if (!r.ok) throw new Error('HTTP ' + r.status + ' — ' + (await r.text()).slice(0, 140))
        const j = await r.json()
        return j[0] ? { data: j[0].doc, updatedAt: Date.parse(j[0].updated_at) || 0, by: j[0].updated_by } : null
      },
      async save(doc, by) {
        const r = await fetch(base, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: cfg.id, doc, updated_by: by || 'someone', updated_at: new Date().toISOString() }) })
        if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 120))
        return true
      },
    }
  }
  const saveLocal = () => { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(show)) } catch {} }
  let saveTimer = null
  function markDirty() {
    dirty = true; setSync('unsaved')
    clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
      saveLocal()
      if (!backend) { setSync('saved here'); dirty = false; return }
      try { await backend.save(show, editorName || 'someone'); lastSavedAt = Date.now(); dirty = false; setSync('saved') }
      catch (e) { dirty = false; setSync('save failed'); toast('Save failed: ' + e.message) }
    }, 900)
  }
  function setSync(s) { const n = $('#sync'); n.textContent = s; n.classList.toggle('on', s === 'unsaved' || s === 'save failed') }
  async function poll() {
    if (!backend || dirty) return
    try {
      const r = await backend.load()
      if (r && r.updatedAt > lastSavedAt + 800) {
        lastSavedAt = r.updatedAt; show = migrate(r.data); applyVenue(show.venue)
        sel.sec = Math.min(sel.sec, show.sections.length - 1); sel.cue = 0; sel.itemId = null
        mount(); renderAll(); toast('Updated by ' + (r.by || 'someone'))
      }
    } catch {}
  }
  const TABLE_SQL = 'create table blocking (\n  id text primary key,\n  doc jsonb,\n  updated_by text,\n  updated_at timestamptz default now()\n);\n\nalter table blocking enable row level security;\n\ncreate policy "anyone can read and write" on blocking\n  for all using (true) with check (true);'
  $('#btnShare').onclick = () => {
    const cfg = readHashCfg() || { url: '', key: '', table: 'blocking', id: DOC_ID }
    const steps = '<ol class="steps">' +
      '<li><b>Create the shared database.</b> Go to supabase.com, sign in, click <b>New project</b>. Any name, a region near the UK, keep the password it gives you. About two minutes to build.</li>' +
      '<li><b>Make the table.</b> In that project open <b>SQL Editor</b>, paste the block below, press <b>Run</b>.</li>' +
      '<li><b>Copy the two keys.</b> <b>Project Settings</b> → <b>Data API</b> for the Project URL; <b>API Keys</b> for the <b>publishable</b> key (or the legacy <b>anon public</b> one). Never a secret or service_role key.</li>' +
      '<li><b>Connect</b> below. The address bar gains a <code>#s=…</code> tail: that whole URL is the invitation. Everyone on it edits the same plan; each person types their name top right.</li>' +
      '</ol>'
    modal('Put this online for everyone', backend ? 'Connected. Copy the link to invite someone, or change the connection.' : 'Four steps, once. After that the link does the work.',
      steps + `<pre>${esc(TABLE_SQL)}</pre><div style="height:12px"></div>` +
      `<div class="field"><label>Supabase project URL</label><input id="sbUrl" value="${esc(cfg.url)}" placeholder="https://abcdefgh.supabase.co"></div>` +
      `<div class="field"><label>Publishable / anon key</label><input id="sbKey" value="${esc(cfg.key)}" placeholder="sb_publishable_…"></div>` +
      `<div class="row2"><div class="field"><label>Table</label><input id="sbTable" value="${esc(cfg.table)}"></div><div class="field"><label>Document name</label><input id="sbId" value="${esc(cfg.id)}"></div></div>`,
      [{ label: 'Copy the SQL', fn: () => copyText(TABLE_SQL) },
       { label: 'Copy this link', fn: () => copyText(location.href) },
       { label: 'Close', fn: closeModal },
       { label: 'Connect', key: true, fn: async () => {
         const c = { url: $('#sbUrl').value.trim().replace(/\/$/, ''), key: $('#sbKey').value.trim(), table: $('#sbTable').value.trim() || 'blocking', id: $('#sbId').value.trim() || DOC_ID }
         if (!c.url || !c.key) { toast('Paste both the URL and the key'); return }
         const b = supa(c)
         try {
           const r = await b.load()
           if (r && r.data) { show = migrate(r.data); applyVenue(show.venue); lastSavedAt = r.updatedAt }
           else { await b.save(show, editorName || 'someone'); lastSavedAt = Date.now() }
           backend = b; writeHashCfg(c); closeModal(); setSync('live'); mount(); renderAll()
           copyText(location.href); toast('Connected — the share link is on your clipboard.')
         } catch (e) { toast('Could not connect: ' + e.message) }
       } }])
  }
  $('#who').oninput = (e) => { editorName = e.target.value; try { sessionStorage.setItem('blk_who', editorName) } catch {} }

  /* ---- init ---------------------------------------------------------------------- */
  ;(async () => {
    try { editorName = sessionStorage.getItem('blk_who') || ''; $('#who').value = editorName } catch {}
    const cfg = readHashCfg()
    if (cfg && cfg.url && cfg.key) {
      backend = supa(cfg)
      try { const r = await backend.load(); if (r && r.data) { show = migrate(r.data); lastSavedAt = r.updatedAt } setSync('live') }
      catch (e) { setSync('offline'); toast('Sync unreachable: ' + e.message) }
    } else {
      try { const raw = localStorage.getItem(LOCAL_KEY); if (raw) show = migrate(JSON.parse(raw)) } catch {}
      setSync('saved here')
    }
    applyVenue(show.venue)
    timers.push(setInterval(poll, 6000))
    mount(); renderAll()
  })()

  return () => {
    document.removeEventListener('keydown', onKey)
    timers.forEach(clearInterval); clearTimeout(saveTimer)
    if (dirty) saveLocal()
  }
}
