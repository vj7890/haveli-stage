'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { Copy, Download, FileDown, Link2, MousePointer2, MoveUpRight, Plus, Trash2, Upload, Maximize, Minus, Check } from 'lucide-react'
import Link from 'next/link'
import { SiteNav } from '@/components/site-nav'
import { cn } from '@/lib/utils'
import {
  ROLES, blankSetup, cleanSetup, decodeLink, download, encodeLink, loadLibrary, mergeSetups, roleOf, saveLibrary, slug, uid, zipStore,
  type Arrow, type Library, type Marker, type Setup,
} from '@/lib/blocking/setups'
import { ArrowArt, ExportSheet, MarkerArt, liveFit, Shape, Venue, usesHall, type Mode, type VB } from './plan'

type Tool = 'select' | 'arrow' | string
type Sel = { kind: 'marker' | 'arrow'; id: string } | null
type Drag =
  | { kind: 'pan'; cx: number; cy: number; vb: VB; inv: DOMMatrix }
  | { kind: 'move'; id: string; dx: number; dz: number; pushed: boolean }
  | { kind: 'arrow' }
  | null

const snap = (v: number) => Math.round(v * 10) / 10
const copyOf = (s: Setup, name: string): Setup => ({
  ...s, id: uid('s_'), name, updated: Date.now(),
  markers: s.markers.map((m) => ({ ...m, id: uid('m_') })),
  arrows: s.arrows.map((a) => ({ ...a, id: uid('a_') })),
})

/* ---- PNG export: render the same drawing off-screen, rasterise it ---------- */
function sheetSvg(setup: Setup, mode: Mode, px: number): string {
  const div = document.createElement('div')
  const root = createRoot(div)
  flushSync(() => root.render(<ExportSheet setup={setup} mode={mode} px={px} />))
  const svg = new XMLSerializer().serializeToString(div.firstElementChild as Element)
  root.unmount()
  return svg
}
function toPng(svg: string): Promise<Blob> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => {
      const cv = document.createElement('canvas')
      cv.width = img.naturalWidth; cv.height = img.naturalHeight
      cv.getContext('2d')!.drawImage(img, 0, 0)
      cv.toBlob((b) => (b ? res(b) : rej(new Error('no image'))), 'image/png')
    }
    img.onerror = () => rej(new Error('could not draw the plan'))
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  })
}
const pngOf = (s: Setup, mode: Mode) => toPng(sheetSvg(s, mode, mode === 'hall' ? 2400 : 3200))

export default function StageSetup() {
  const [lib, setLib] = useState<Library | null>(null)
  const [mode, setMode] = useState<Mode>('stage')
  const [vb, setVb] = useState<VB>(liveFit('stage'))
  const [tool, setTool] = useState<Tool>('select')
  const [sel, setSel] = useState<Sel>(null)
  const [hover, setHover] = useState<{ x: number; z: number } | null>(null)
  const [temp, setTemp] = useState<Arrow | null>(null)
  const [saveState, setSaveState] = useState<'saved' | 'failed'>('saved')
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)

  const svgRef = useRef<SVGSVGElement>(null)
  const labelRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const libRef = useRef<Library | null>(null)
  libRef.current = lib
  const hist = useRef<{ past: Setup[]; future: Setup[] }>({ past: [], future: [] })
  const drag = useRef<Drag>(null)

  const say = useCallback((t: string) => { setToast(t); window.setTimeout(() => setToast((x) => (x === t ? '' : x)), 2200) }, [])

  /* load: this browser's setups, plus a setup arriving by link */
  useEffect(() => {
    document.documentElement.classList.add('viewer-page')
    let l = loadLibrary()
    const shared = decodeLink(location.hash)
    if (shared) {
      l = { ...mergeSetups(l, [shared]).lib, current: shared.id }
      history.replaceState(null, '', location.pathname)
      window.setTimeout(() => say(`Opened “${shared.name}”`), 50)
    }
    setLib(l)
    // a link pasted into a tab that already has the page open
    const onHash = () => {
      const s = decodeLink(location.hash)
      if (!s) return
      history.replaceState(null, '', location.pathname)
      setLib((p) => (p ? { ...mergeSetups(p, [s]).lib, current: s.id } : p))
      hist.current = { past: [], future: [] }; setSel(null)
      say(`Opened “${s.name}”`)
    }
    window.addEventListener('hashchange', onHash)
    return () => { window.removeEventListener('hashchange', onHash); document.documentElement.classList.remove('viewer-page') }
  }, [say])

  /* save as you go */
  useEffect(() => {
    if (!lib) return
    const t = window.setTimeout(() => setSaveState(saveLibrary(lib) ? 'saved' : 'failed'), 250)
    return () => window.clearTimeout(t)
  }, [lib])

  const cur = lib?.setups.find((s) => s.id === lib.current) ?? null

  /** Change the open setup. `push` records an undo step first. */
  const update = useCallback((fn: (s: Setup) => Setup, push = true) => {
    const l = libRef.current
    if (!l) return
    const s = l.setups.find((x) => x.id === l.current)
    if (!s) return
    if (push) { hist.current.past.push(s); hist.current.future = []; if (hist.current.past.length > 200) hist.current.past.shift() }
    setLib((p) => (p ? { ...p, setups: p.setups.map((x) => (x.id === p.current ? { ...fn(x), updated: Date.now() } : x)) } : p))
  }, [])

  const replaceCurrent = (s: Setup) => setLib((p) => (p ? { ...p, setups: p.setups.map((x) => (x.id === p.current ? s : x)) } : p))
  const undo = useCallback(() => {
    const s = libRef.current?.setups.find((x) => x.id === libRef.current?.current)
    const prev = hist.current.past.pop()
    if (!s || !prev) return
    hist.current.future.push(s); replaceCurrent({ ...prev, updated: Date.now() }); setSel(null)
  }, [])
  const redo = useCallback(() => {
    const s = libRef.current?.setups.find((x) => x.id === libRef.current?.current)
    const next = hist.current.future.pop()
    if (!s || !next) return
    hist.current.past.push(s); replaceCurrent({ ...next, updated: Date.now() }); setSel(null)
  }, [])

  const open = (id: string) => {
    setLib((p) => (p ? { ...p, current: id } : p))
    hist.current = { past: [], future: [] }
    setSel(null); setTemp(null)
  }
  const addSetup = () => {
    const l = libRef.current; if (!l) return
    const s = blankSetup(`Setup ${l.setups.length + 1}`)
    setLib({ ...l, setups: [...l.setups, s], current: s.id }); hist.current = { past: [], future: [] }; setSel(null)
  }
  const duplicate = (id: string) => {
    const l = libRef.current; if (!l) return
    const i = l.setups.findIndex((s) => s.id === id); if (i < 0) return
    const c = copyOf(l.setups[i], `${l.setups[i].name} copy`)
    const setups = [...l.setups]; setups.splice(i + 1, 0, c)
    setLib({ ...l, setups, current: c.id }); hist.current = { past: [], future: [] }; setSel(null)
  }
  const remove = (id: string) => {
    const l = libRef.current; if (!l) return
    const s = l.setups.find((x) => x.id === id); if (!s) return
    if (!window.confirm(`Delete “${s.name}”?`)) return
    let setups = l.setups.filter((x) => x.id !== id)
    if (!setups.length) setups = [blankSetup('Setup 1')]
    setLib({ ...l, setups, current: l.current === id ? setups[0].id : l.current }); setSel(null)
  }

  /* ---- the plan's pointer handling ---------------------------------------- */
  const toPlan = (cx: number, cy: number, inv?: DOMMatrix) => {
    const m = inv ?? svgRef.current!.getScreenCTM()!.inverse()
    const p = new DOMPoint(cx, cy).matrixTransform(m)
    return { x: p.x, z: p.y }
  }

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.button !== 1) return
    const p = toPlan(e.clientX, e.clientY)
    const panning = e.button === 1 || e.shiftKey
    if (!panning && tool === 'arrow') {
      setTemp({ id: uid('a_'), x1: snap(p.x), z1: snap(p.z), x2: snap(p.x), z2: snap(p.z) })
      drag.current = { kind: 'arrow' }
    } else if (!panning && tool !== 'select') {
      const m: Marker = { id: uid('m_'), role: tool, x: snap(p.x), z: snap(p.z), label: '' }
      update((s) => ({ ...s, markers: [...s.markers, m] }))
      setSel({ kind: 'marker', id: m.id })
      return
    } else {
      setSel(null)
      drag.current = { kind: 'pan', cx: e.clientX, cy: e.clientY, vb, inv: svgRef.current!.getScreenCTM()!.inverse() }
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onMarkerDown = (e: React.PointerEvent, m: Marker) => {
    if (e.button !== 0) return
    e.stopPropagation()
    if (tool === 'arrow') {
      setTemp({ id: uid('a_'), x1: m.x, z1: m.z, x2: m.x, z2: m.z })
      drag.current = { kind: 'arrow' }
    } else {
      let id = m.id
      if (e.altKey) {
        const c = { ...m, id: uid('m_') }
        update((s) => ({ ...s, markers: [...s.markers, c] })); id = c.id
      }
      const p = toPlan(e.clientX, e.clientY)
      setSel({ kind: 'marker', id })
      drag.current = { kind: 'move', id, dx: m.x - p.x, dz: m.z - p.z, pushed: e.altKey }
    }
    svgRef.current?.setPointerCapture(e.pointerId)
  }

  const onArrowDown = (e: React.PointerEvent, a: Arrow) => {
    if (e.button !== 0 || tool !== 'select') return
    e.stopPropagation(); setSel({ kind: 'arrow', id: a.id })
  }

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) { if (tool !== 'select') setHover(toPlan(e.clientX, e.clientY)); return }
    if (d.kind === 'pan') {
      const a = toPlan(d.cx, d.cy, d.inv), b = toPlan(e.clientX, e.clientY, d.inv)
      setVb({ ...d.vb, x: d.vb.x - (b.x - a.x), y: d.vb.y - (b.z - a.z) })
    } else if (d.kind === 'move') {
      const p = toPlan(e.clientX, e.clientY)
      const x = snap(p.x + d.dx), z = snap(p.z + d.dz)
      update((s) => ({ ...s, markers: s.markers.map((m) => (m.id === d.id ? { ...m, x, z } : m)) }), !d.pushed)
      d.pushed = true
    } else if (d.kind === 'arrow') {
      const p = toPlan(e.clientX, e.clientY)
      setTemp((t) => (t ? { ...t, x2: snap(p.x), z2: snap(p.z) } : t))
    }
  }

  const onUp = () => {
    const d = drag.current
    drag.current = null
    if (d?.kind === 'arrow' && temp) {
      if (Math.hypot(temp.x2 - temp.x1, temp.z2 - temp.z1) > 0.4) {
        const a = temp
        update((s) => ({ ...s, arrows: [...s.arrows, a] }))
      }
      setTemp(null)
    }
  }

  /* wheel / pinch zoom about the cursor; two-finger scroll pans */
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const zoom = e.ctrlKey || e.metaKey || (e.deltaMode === 1) || (Math.abs(e.deltaY) >= 40 && e.deltaX === 0 && Number.isInteger(e.deltaY))
      setVb((v) => {
        const m = svg.getScreenCTM()!.inverse()
        if (!zoom) {
          const a = new DOMPoint(0, 0).matrixTransform(m), b = new DOMPoint(e.deltaX, e.deltaY).matrixTransform(m)
          return { ...v, x: v.x + (b.x - a.x), y: v.y + (b.y - a.y) }
        }
        const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m)
        const f = Math.min(1.6, Math.max(0.62, Math.exp(e.deltaY * (e.ctrlKey ? 0.012 : 0.0018))))
        const w = Math.min(160, Math.max(3, v.w * f)), k = w / v.w
        return { x: p.x - (p.x - v.x) * k, y: p.y - (p.y - v.y) * k, w, h: v.h * k }
      })
    }
    svg.addEventListener('wheel', wheel, { passive: false })
    return () => svg.removeEventListener('wheel', wheel)
  }, [lib !== null])

  const zoomBy = (f: number) => setVb((v) => {
    const cx = v.x + v.w / 2, cy = v.y + v.h / 2, w = v.w * f, h = v.h * f
    return { x: cx - w / 2, y: cy - h / 2, w, h }
  })
  const switchMode = (m: Mode) => { setMode(m); setVb(liveFit(m)) }

  const deleteSel = useCallback(() => {
    if (!sel) return
    update((s) => sel.kind === 'marker' ? { ...s, markers: s.markers.filter((m) => m.id !== sel.id) } : { ...s, arrows: s.arrows.filter((a) => a.id !== sel.id) })
    setSel(null)
  }, [sel, update])

  /* keys */
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.('input, textarea, select')
      if (e.key === 'Escape') { (document.activeElement as HTMLElement)?.blur?.(); setTool('select'); setSel(null); setTemp(null); drag.current = null; return }
      if (typing) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSel(); return }
      if (mod) return
      if (e.key === 'v') setTool('select')
      if (e.key === 'a') setTool('arrow')
      const n = Number(e.key)
      if (n >= 1 && n <= 9) setTool(ROLES[n - 1].id)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [undo, redo, deleteSel])

  /* ---- files -------------------------------------------------------------- */
  const exportOne = async () => {
    if (!cur) return
    setBusy(true)
    try { download(await pngOf(cur, mode), `${slug(cur.name)}${mode === 'hall' ? '-hall' : ''}.png`); say('PNG saved to Downloads') }
    catch { say('Export failed') } finally { setBusy(false) }
  }
  const exportAll = async () => {
    if (!lib) return
    setBusy(true)
    try {
      const files: { name: string; data: Uint8Array }[] = []
      for (const [i, s] of lib.setups.entries()) {
        const nn = String(i + 1).padStart(2, '0')
        files.push({ name: `${nn}-${slug(s.name)}.png`, data: new Uint8Array(await (await pngOf(s, 'stage')).arrayBuffer()) })
        if (usesHall(s)) files.push({ name: `${nn}-${slug(s.name)}-hall.png`, data: new Uint8Array(await (await pngOf(s, 'hall')).arrayBuffer()) })
      }
      download(zipStore(files), `haveli-setups-${new Date().toISOString().slice(0, 10)}.zip`)
      say(`${lib.setups.length} setups exported`)
    } catch { say('Export failed') } finally { setBusy(false) }
  }
  const backup = () => {
    if (!lib) return
    download(new Blob([JSON.stringify(lib, null, 1)], { type: 'application/json' }), `haveli-setups-backup-${new Date().toISOString().slice(0, 10)}.json`)
    say('Backup saved to Downloads')
  }
  const loadBackup = async (f: File) => {
    try {
      const d = JSON.parse(await f.text())
      const list = (Array.isArray(d) ? d : Array.isArray(d.setups) ? d.setups : [d]).map(cleanSetup).filter(Boolean) as Setup[]
      if (!list.length || !lib) { say('No setups in that file'); return }
      const r = mergeSetups(lib, list)
      setLib(r.lib); say(`${r.added} added · ${r.updated} updated`)
    } catch { say('That file is not a setups backup') }
  }
  const copyLink = async () => {
    if (!cur) return
    const url = `${location.origin}${location.pathname}#setup=${encodeLink(cur)}`
    try { await navigator.clipboard.writeText(url); say('Link copied') } catch { window.prompt('Copy this link', url) }
  }

  const selMarker = sel?.kind === 'marker' ? cur?.markers.find((m) => m.id === sel.id) : undefined
  const selArrow = sel?.kind === 'arrow' ? cur?.arrows.find((a) => a.id === sel.id) : undefined
  const armed = tool !== 'select' && tool !== 'arrow' ? roleOf(tool) : null
  const counts = useMemo(() => {
    const n = new Map<string, number>()
    for (const m of cur?.markers ?? []) n.set(m.role, (n.get(m.role) || 0) + 1)
    return n
  }, [cur])

  if (!lib || !cur) return <div className="bg-background fixed inset-0" />

  return (
    <div className="bg-background fixed inset-0 grid grid-cols-[minmax(0,1fr)] grid-rows-[52px_1fr] md:grid-cols-[232px_minmax(0,1fr)]">
      {/* top bar */}
      <header className="bg-card col-span-full flex min-w-0 items-center gap-2 border-b px-3 md:gap-3">
        <SiteNav className="hidden lg:flex" />
        <Link href="/" className="text-muted-foreground hover:text-foreground text-[10px] font-bold tracking-[0.14em] uppercase lg:hidden">Haveli</Link>
        <select className="bg-secondary min-w-0 flex-1 rounded-md border px-2 py-1.5 md:hidden" value={cur.id} onChange={(e) => open(e.target.value)} aria-label="Setup">
          {lib.setups.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input
          className="hover:bg-secondary focus:bg-secondary hidden min-w-0 flex-1 rounded-md md:block bg-transparent px-2 py-1.5 text-[15px] font-semibold outline-none md:max-w-md"
          value={cur.name} aria-label="Setup name" spellCheck={false}
          onChange={(e) => update((s) => ({ ...s, name: e.target.value }), false)}
          onBlur={(e) => { if (!e.target.value.trim()) update((s) => ({ ...s, name: 'Untitled setup' }), false) }}
        />
        <span className={cn('hidden items-center gap-1 text-[11.5px] sm:flex', saveState === 'saved' ? 'text-muted-foreground' : 'text-bad')} title="Setups save in this browser as you work. Use Backup to keep a file.">
          {saveState === 'saved' ? <><Check className="size-3.5" /> Saved</> : 'Not saved — browser storage is blocked'}
        </span>
        <div className="hidden flex-1 md:block" />
        <div className="bg-secondary flex rounded-lg border p-0.5">
          {(['stage', 'hall'] as Mode[]).map((m) => (
            <button key={m} type="button" onClick={() => switchMode(m)}
              className={cn('rounded-md px-3 py-1 text-[12.5px] capitalize', mode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              {m}
            </button>
          ))}
        </div>
        <button type="button" onClick={exportOne} disabled={busy}
          className="bg-primary text-primary-foreground flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-60">
          <Download className="size-4" /><span className="hidden sm:inline">Export PNG</span>
        </button>
      </header>

      {/* setups */}
      <aside className="bg-card hidden min-h-0 flex-col border-r md:flex">
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.08em] uppercase">Setups</span>
          <button type="button" onClick={addSetup} className="hover:bg-accent flex items-center gap-1 rounded-md px-2 py-1 text-[12px]"><Plus className="size-3.5" /> New</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {lib.setups.map((s) => (
            <div key={s.id} onClick={() => open(s.id)}
              className={cn('group flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2', s.id === cur.id ? 'border-primary/40 bg-primary/12' : 'hover:bg-secondary border-transparent')}>
              <span className="min-w-0 flex-1 truncate text-[13px]">{s.name}</span>
              <span className="text-muted-foreground tabular text-[11px] group-hover:hidden">{s.markers.length || ''}</span>
              <button type="button" title="Duplicate" onClick={(e) => { e.stopPropagation(); duplicate(s.id) }} className="text-muted-foreground hover:text-foreground hidden group-hover:block"><Copy className="size-3.5" /></button>
              <button type="button" title="Delete" onClick={(e) => { e.stopPropagation(); remove(s.id) }} className="text-muted-foreground hover:text-bad hidden group-hover:block"><Trash2 className="size-3.5" /></button>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5 border-t p-2 text-[12px]">
          <button type="button" onClick={exportAll} disabled={busy} className="hover:bg-accent col-span-2 flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 disabled:opacity-60"><FileDown className="size-3.5" /> Export all as PNGs</button>
          <button type="button" onClick={backup} className="hover:bg-accent flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5"><Download className="size-3.5" /> Backup</button>
          <button type="button" onClick={() => fileRef.current?.click()} className="hover:bg-accent flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5"><Upload className="size-3.5" /> Load</button>
          <button type="button" onClick={copyLink} className="hover:bg-accent col-span-2 flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5"><Link2 className="size-3.5" /> Copy link to this setup</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) loadBackup(f); e.target.value = '' }} />
        </div>
      </aside>

      {/* the plan */}
      <main className="relative min-h-0 overflow-hidden" style={{ background: 'color-mix(in oklab, hsl(var(--background)) 70%, black)' }}>
        <svg
          ref={svgRef}
          className="absolute inset-0 h-full w-full touch-none select-none"
          style={{ background: '#F4F5F2', cursor: tool === 'select' ? (drag.current?.kind === 'pan' ? 'grabbing' : 'default') : 'crosshair' }}
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          onPointerLeave={() => setHover(null)}
          onDoubleClick={(e) => {
            const id = (document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-mid]') as HTMLElement | null)?.dataset.mid
            if (!id) return
            setSel({ kind: 'marker', id })
            window.setTimeout(() => labelRef.current?.focus(), 30)
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <rect x={vb.x - 500} y={vb.y - 500} width={vb.w + 1000} height={vb.h + 1000} fill="#F4F5F2" />
          <Venue mode={mode} />
          {cur.arrows.map((a) => (
            <g key={a.id} onPointerDown={(e) => onArrowDown(e, a)} style={{ cursor: tool === 'select' ? 'pointer' : undefined }}>
              <line x1={a.x1} y1={a.z1} x2={a.x2} y2={a.z2} stroke="transparent" strokeWidth={0.6} />
              <ArrowArt a={a} selected={sel?.kind === 'arrow' && sel.id === a.id} />
            </g>
          ))}
          {temp && <ArrowArt a={temp} ghost />}
          {cur.markers.map((m) => (
            <g key={m.id} data-mid={m.id} onPointerDown={(e) => onMarkerDown(e, m)}
              style={{ cursor: tool === 'arrow' ? 'crosshair' : 'grab' }}>
              <MarkerArt m={m} selected={sel?.kind === 'marker' && sel.id === m.id} />
            </g>
          ))}
          {armed && hover && !drag.current && (
            <g transform={`translate(${snap(hover.x)} ${snap(hover.z)})`} style={{ pointerEvents: 'none' }}><Shape role={armed} opacity={0.45} /></g>
          )}
        </svg>

        {/* selected marker */}
        {(selMarker || selArrow) && (
          <div className="card-glass absolute top-3 right-3 w-60 rounded-xl p-3 shadow-xl" onPointerDown={(e) => e.stopPropagation()}>
            {selMarker ? (
              <>
                <input
                  ref={labelRef}
                  className="bg-secondary mb-2.5 w-full rounded-md border px-2 py-1.5 outline-none focus:border-primary/60"
                  placeholder={`Name (${roleOf(selMarker.role).name})`} value={selMarker.label}
                  onFocus={() => update((s) => s, true)}
                  onChange={(e) => { const v = e.target.value; update((s) => ({ ...s, markers: s.markers.map((m) => (m.id === selMarker.id ? { ...m, label: v } : m)) }), false) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                />
                <div className="mb-2.5 flex flex-wrap gap-1">
                  {ROLES.map((r) => (
                    <button key={r.id} type="button" title={r.name}
                      onClick={() => update((s) => ({ ...s, markers: s.markers.map((m) => (m.id === selMarker.id ? { ...m, role: r.id } : m)) }))}
                      className={cn('grid size-6 place-items-center rounded-md border', selMarker.role === r.id ? 'border-primary bg-accent' : 'border-transparent hover:bg-accent')}>
                      <svg viewBox="-0.45 -0.45 0.9 0.9" className="size-3.5"><Shape role={r} r={0.34} /></svg>
                    </button>
                  ))}
                </div>
              </>
            ) : <div className="text-muted-foreground mb-2.5 text-[12px]">Arrow</div>}
            <button type="button" onClick={deleteSel} className="text-bad hover:bg-bad/10 flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[12px]">
              <Trash2 className="size-3.5" /> Delete
            </button>
          </div>
        )}

        {/* toolbar */}
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-2 px-3">
          {(armed || tool === 'arrow') && (
            <div className="card-glass text-muted-foreground rounded-full px-3 py-1 text-[11.5px]">
              {armed ? `Click the plan to place ${armed.name.toLowerCase()}s · Esc when done` : 'Drag to draw a move · Esc when done'}
            </div>
          )}
          <div className="card-glass pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl p-1 shadow-xl">
            <ToolBtn on={tool === 'select'} onClick={() => setTool('select')} title="Select and move (V)"><MousePointer2 className="size-4" /></ToolBtn>
            <ToolBtn on={tool === 'arrow'} onClick={() => setTool(tool === 'arrow' ? 'select' : 'arrow')} title="Draw a move (A)"><MoveUpRight className="size-4" /></ToolBtn>
            <span className="bg-border mx-1 h-5 w-px shrink-0" />
            {ROLES.map((r, i) => (
              <button key={r.id} type="button" title={i < 9 ? `${r.name} (${i + 1})` : r.name}
                onClick={() => setTool(tool === r.id ? 'select' : r.id)}
                className={cn('flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px]', tool === r.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}>
                <svg viewBox="-0.45 -0.45 0.9 0.9" className="size-3.5 shrink-0"><Shape role={r} r={0.34} /></svg>
                {r.name}
                {counts.get(r.id) ? <span className={cn('tabular text-[10.5px]', tool === r.id ? 'opacity-70' : 'text-muted-foreground')}>{counts.get(r.id)}</span> : null}
              </button>
            ))}
          </div>
        </div>

        {/* zoom */}
        <div className="card-glass absolute right-3 bottom-3 hidden flex-col rounded-xl p-1 shadow-xl lg:flex">
          <ToolBtn onClick={() => zoomBy(0.8)} title="Zoom in"><Plus className="size-4" /></ToolBtn>
          <ToolBtn onClick={() => setVb(liveFit(mode))} title="Fit"><Maximize className="size-4" /></ToolBtn>
          <ToolBtn onClick={() => zoomBy(1.25)} title="Zoom out"><Minus className="size-4" /></ToolBtn>
        </div>

        {toast && <div className="card-glass absolute top-3 left-1/2 -translate-x-1/2 rounded-lg px-3.5 py-2 text-[12.5px] shadow-xl">{toast}</div>}
      </main>
    </div>
  )
}

function ToolBtn({ on, onClick, title, children }: { on?: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick}
      className={cn('grid size-8 shrink-0 place-items-center rounded-lg', on ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent')}>
      {children}
    </button>
  )
}
