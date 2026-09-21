'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Camera, ChevronDown, ChevronRight, Copy, Crosshair, Download, Link2, RotateCcw, Upload, Check } from 'lucide-react'
import { createScene, houseLights, type Stage } from '@/lib/scene'
import { loadModel } from '@/lib/model'
import { buildLedGuides, createLedChannel, LED_CLIPS, type FitMode } from '@/lib/led'
import { aimAt, applyLook, beamDir, buildRig, GELS, LOOKS, PLACEMENTS, type Fixture } from '@/lib/rig'
import { buildFigures, buildSizes } from '@/lib/extras'
import { cabinPx, LED, MODEL_GROUPS, TARGETS } from '@/lib/venue'
import { coerce, decodeShare, defaultState, encodeShare, STORE_KEY, VIEWS, type AppState } from '@/lib/state'
import { ViewerLayout, GroupLabel, Row } from '@/components/viewer-layout'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { cn, hex } from '@/lib/utils'

type Api = {
  apply: (s: AppState, prev: AppState | null) => void
  setView: (id: string) => void
  upload: (f: File) => void
  still: () => string
}

const Seg = <T extends string>({ value, options, onChange, title }: { value: T; options: { id: T; label: string; hint?: string }[]; onChange: (v: T) => void; title?: string }) => (
  <div className="bg-secondary flex rounded-lg p-0.5" title={title}>
    {options.map((o) => (
      <button key={o.id} type="button" title={o.hint} onClick={() => onChange(o.id)}
        className={cn('flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors', value === o.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
        {o.label}
      </button>
    ))}
  </div>
)

export default function StageViewer() {
  const mount = useRef<HTMLDivElement>(null)
  const api = useRef<Api | null>(null)
  const [state, setState] = useState<AppState>(() => defaultState())
  const prev = useRef<AppState | null>(null)
  const [loading, setLoading] = useState(true)
  const [openFx, setOpenFx] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState(false)
  const [look, setLook] = useState('darshan')
  const fileRef = useRef<HTMLInputElement>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const [uploadName, setUploadName] = useState('')

  const patch = useCallback((fn: (s: AppState) => AppState) => setState((s) => fn(s)), [])
  const setLed = (p: Partial<AppState['led']>) => patch((s) => ({ ...s, led: { ...s.led, ...p } }))
  const setRig = (p: Partial<AppState['rig']>) => patch((s) => ({ ...s, rig: { ...s.rig, ...p } }))
  const setFx = (id: string, p: Partial<Fixture>) => { setLook(''); patch((s) => ({ ...s, fixtures: s.fixtures.map((f) => (f.id === id ? { ...f, ...p } : f)) })) }
  const setAllFx = (fn: (f: Fixture) => Partial<Fixture>) => { setLook(''); patch((s) => ({ ...s, fixtures: s.fixtures.map((f) => ({ ...f, ...fn(f) })) })) }

  // ---- the scene, built once -------------------------------------------------------
  useEffect(() => {
    const el = mount.current
    if (!el) return
    let stage: Stage | null = null
    let dead = false
    // the look: the link's, else this browser's last, else the default
    let initial = decodeShare(location.hash)
    if (!initial) { try { const raw = localStorage.getItem(STORE_KEY); if (raw) initial = coerce(JSON.parse(raw)) } catch {} }
    if (!initial) initial = defaultState()
    setState(initial)

    ;(async () => {
      const model = await loadModel()
      if (dead || !mount.current) return
      stage = createScene(el)
      const { scene, camera, controls, root } = stage
      const house = houseLights(scene)
      const houseBase = house.map((l) => l.intensity)
      root.add(model.root)

      // the LED
      const led = createLedChannel()
      model.led.material = led.mat
      const guides = buildLedGuides()
      root.add(guides.group)

      // the rig — beams stop at the set and the room, but not at the cabin's glass
      const rig = buildRig(initial!.fixtures, model.meshes.filter((m) => !m.name.startsWith('cabin_glass')))
      root.add(rig.group)

      const sizes = buildSizes(); root.add(sizes)
      const figures = buildFigures(); root.add(figures)

      const setView = (id: string) => {
        const f = (w: number, h: number) => stage!.fitDistance(w, h, 1.12)
        const V: Record<string, [number[], number[]]> = {
          audience: [[0, 1.7, 26], [0, 3.6, -4]],
          front: [[0, 4.2, f(48, 12) - 6], [0, 3.8, -4]],
          iso: [[30, 17, 26], [0, 2.5, -1]],
          plan: [[0, 58, 4.001], [0, 0, 4]],
          side: [[40, 4.5, -1], [0, 3, -2]],
          cabin: [[4.5, 2.7, 3.2], [0, 2.7, -3.3]],
          stage: [[6.5, 2.9, -1.2], [0, 2.2, 24]],
          led: [[0, 4.2, 6], [0, 4, LED.z]],
        }
        const v = V[id]
        if (!v) return
        camera.position.set(v[0][0], v[0][1], v[0][2])
        controls.target.set(v[1][0], v[1][1], v[1][2])
        controls.update()
      }

      const apply = (s: AppState, p: AppState | null) => {
        // LED
        if (!p || p.led.clip !== s.led.clip) { if (s.led.clip !== 'upload') led.show(s.led.clip); else led.show('upload') }
        if (!p || p.led.fit !== s.led.fit) led.setFit(s.led.fit)
        led.setLevel(s.led.level)
        led.setOn(s.led.on)
        stage!.bloom.strength = s.led.bloom
        guides.cabin.visible = s.led.guides.cabin
        guides.grid.visible = s.led.guides.grid
        // rig
        rig.setSettings(s.rig)
        rig.setFixtures(s.fixtures)
        const hz = s.rig.on && s.rig.haze > 0.01
        scene.fog = hz ? rig.haze : null
        house.forEach((l, i) => { l.intensity = houseBase[i] * (s.rig.on ? s.rig.house : 0.6) })
        // extras
        sizes.visible = s.sizes
        figures.visible = s.figures
        for (const g of MODEL_GROUPS) model.groups[g.id].visible = s.vis[g.id] !== false
        if (!p || p.view !== s.view) setView(s.view)
      }

      stage.setFrame((dt, t) => {
        rig.update(dt)
        led.tick(t)
      })

      api.current = {
        apply,
        setView,
        upload: (f) => led.upload(f),
        still: () => stage!.still(),
      }
      apply(initial!, null)
      prev.current = initial!
      setLoading(false)
      // a hook for the console: window.__haveli.rig.heads[0].f, camera, scene
      ;(window as unknown as { __haveli?: unknown }).__haveli = { rig, scene, camera, led, model }
    })()

    return () => { dead = true; api.current = null; stage?.dispose() }
  }, [])

  // every change goes to the scene, and to this browser
  useEffect(() => {
    if (loading) return
    api.current?.apply(state, prev.current)
    prev.current = state
    const t = setTimeout(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)) } catch {} }, 300)
    return () => clearTimeout(t)
  }, [state, loading])

  // ---- actions ---------------------------------------------------------------------
  const copyLink = async () => {
    const url = `${location.origin}${location.pathname}#s=${encodeShare(state)}`
    history.replaceState(null, '', `#s=${encodeShare(state)}`)
    try { await navigator.clipboard.writeText(url) } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 1600)
  }
  const saveStill = () => {
    const url = api.current?.still(); if (!url) return
    const a = document.createElement('a'); a.href = url; a.download = 'haveli-stage-4k.png'; a.click()
  }
  const exportJson = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ exported: new Date().toISOString(), ...state }, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = 'haveli-stage-look.json'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }
  const importJson = (f: File) => { void f.text().then((t) => { try { setState(coerce(JSON.parse(t))); setLook('') } catch {} }) }
  const reset = () => { if (confirm('Back to the default look?')) { setState(defaultState()); setLook('darshan'); history.replaceState(null, '', location.pathname) } }
  const pickLook = (id: string) => {
    const l = LOOKS.find((x) => x.id === id); if (!l) return
    setLook(id)
    patch((s) => ({ ...s, fixtures: applyLook(l, s.fixtures), rig: { ...s.rig, ...(l.rig ?? {}), sweep: { ...s.rig.sweep, ...(l.rig?.sweep ?? {}) } } }))
  }
  const place = (pid: string) => {
    const p = PLACEMENTS.find((x) => x.id === pid); if (!p) return
    setLook('')
    patch((s) => {
      let i = 0
      return { ...s, fixtures: s.fixtures.map((f) => {
        if (f.group !== p.group) return f
        const pos = p.pos[i++] ?? f.pos
        // keep the head on whatever it was looking at, 8 m out along its beam
        const d = beamDir(f)
        const at: [number, number, number] = [f.pos[0] + d[0] * 8, f.pos[1] + d[1] * 8, f.pos[2] + d[2] * 8]
        const nf = { ...f, pos }
        return { ...nf, ...aimAt(nf, at) }
      }) }
    })
  }

  const cb = useMemo(() => cabinPx(), [])
  const clipLabel = state.led.clip === 'upload' ? (uploadName || 'Upload') : (LED_CLIPS.find((c) => c.id === state.led.clip)?.label ?? state.led.clip)

  // ---- the panel --------------------------------------------------------------------
  const panel = (
    <div className="space-y-2">
      {/* LED */}
      <GroupLabel className="mt-1">Back LED — {LED.px[0]} × {LED.px[1]}</GroupLabel>
      <div className="border-border/70 space-y-2 rounded-lg border px-2 pt-1.5 pb-2">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-[11.5px]"><Switch checked={state.led.on} onCheckedChange={(on) => setLed({ on })} /> LED on</label>
          <span className="text-muted-foreground text-[10px]">{LED.w} × {LED.h} m · P{LED.pitchMm}</span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {LED_CLIPS.map((c) => (
            <Button key={c.id} size="xs" variant={state.led.clip === c.id ? 'default' : 'outline'} title={c.hint} onClick={() => setLed({ clip: c.id })}>{c.label}</Button>
          ))}
          <Button size="xs" variant={state.led.clip === 'upload' ? 'default' : 'outline'} className="col-span-2 truncate" title="Your own video or image — stays in this browser"
            onClick={() => fileRef.current?.click()}><Upload className="size-3" /> {state.led.clip === 'upload' && uploadName ? uploadName : 'Upload video / image'}</Button>
          <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => {
            const f = e.target.files?.[0]; if (f) { setUploadName(f.name); api.current?.upload(f); setLed({ clip: 'upload' }) } e.target.value = ''
          }} />
        </div>
        <Seg<FitMode> value={state.led.fit} onChange={(fit) => setLed({ fit })} options={[{ id: 'cover', label: 'Cover-fit', hint: 'Fill the wall, crop the excess' }, { id: 'stretch', label: 'Stretch', hint: 'Fill the wall, ignore the aspect' }]} />
        <Row label="Brightness" value={`${Math.round(state.led.level * 100)}%`}><Slider min={0} max={1.5} step={0.02} value={[state.led.level]} onValueChange={([v]) => setLed({ level: v })} /></Row>
        <Row label="Glow" value={state.led.bloom.toFixed(2)}><Slider min={0} max={1.2} step={0.05} value={[state.led.bloom]} onValueChange={([v]) => setLed({ bloom: v })} /></Row>
        <div className="grid grid-cols-2 gap-1.5">
          <label className="flex items-center gap-2 text-[11px]"><Switch checked={state.led.guides.cabin} onCheckedChange={(v) => setLed({ guides: { ...state.led.guides, cabin: v } })} /> Cabin zone</label>
          <label className="flex items-center gap-2 text-[11px]"><Switch checked={state.led.guides.grid} onCheckedChange={(v) => setLed({ guides: { ...state.led.guides, grid: v } })} /> 640 px grid</label>
        </div>
        <p className="text-muted-foreground text-[10px] leading-relaxed">
          Author at <span className="text-foreground">{LED.px[0]} × {LED.px[1]}</span> (5.33:1) — one picture, house left to house right, top-left origin; it lands on the wall 1:1. Other sizes are cover-fitted. The cabin stands in front of px <span className="text-foreground">{cb.x0}–{cb.x1}</span> across and <span className="text-foreground">{cb.y0}–{cb.y1}</span> down, so keep anything that must be read out of that box. Uploads stay in this browser.
        </p>
      </div>

      {/* Lighting */}
      <GroupLabel>Lighting — 4 heads up, 2 on the deck</GroupLabel>
      <div className="border-border/70 space-y-2 rounded-lg border px-2 pt-1.5 pb-2">
        <label className="flex items-center gap-2 text-[11.5px]"><Switch checked={state.rig.on} onCheckedChange={(on) => setRig({ on })} /> Rig on</label>
        <div className="grid grid-cols-4 gap-1">
          {LOOKS.map((l) => (
            <Button key={l.id} size="xs" variant={look === l.id ? 'default' : 'outline'} className="px-1 text-[10.5px]" title={l.hint} onClick={() => pickLook(l.id)}>{l.label}</Button>
          ))}
        </div>
        <Row label="Haze" value={`${state.rig.haze.toFixed(1)}×`}><Slider min={0} max={3} step={0.1} value={[state.rig.haze]} onValueChange={([v]) => { setLook(''); setRig({ haze: v }) }} /></Row>
        <Row label="House light" value={`${Math.round(state.rig.house * 100)}%`}><Slider min={0} max={1} step={0.02} value={[state.rig.house]} onValueChange={([v]) => { setLook(''); setRig({ house: v }) }} /></Row>
        <Row label="Beam visibility" value={`${state.rig.beamGain.toFixed(2)}×`}><Slider min={0} max={2.5} step={0.05} value={[state.rig.beamGain]} onValueChange={([v]) => setRig({ beamGain: v })} /></Row>
        <div className="border-border/60 space-y-1.5 rounded-md border px-2 pt-1.5 pb-2">
          <label className="flex items-center gap-2 text-[11px]"><Switch checked={state.rig.sweep.on} onCheckedChange={(on) => { setLook(''); setRig({ sweep: { ...state.rig.sweep, on } }) }} /> Movement — heads sweep about their aim</label>
          {state.rig.sweep.on && (<>
            <Row label="Speed" value={`${state.rig.sweep.speed.toFixed(1)}×`}><Slider min={0} max={3} step={0.1} value={[state.rig.sweep.speed]} onValueChange={([v]) => setRig({ sweep: { ...state.rig.sweep, speed: v } })} /></Row>
            <Row label="Spread" value={`${state.rig.sweep.spread.toFixed(1)}×`}><Slider min={0} max={2} step={0.1} value={[state.rig.sweep.spread]} onValueChange={([v]) => setRig({ sweep: { ...state.rig.sweep, spread: v } })} /></Row>
          </>)}
        </div>

        <div className="text-muted-foreground text-[10px] tracking-wide uppercase">All six heads</div>
        <div className="grid grid-cols-6 gap-1">
          {GELS.map((g) => (
            <button key={g.id} type="button" title={g.label} className="h-5 rounded border border-border" style={{ background: hex(g.hex) }} onClick={() => setAllFx(() => ({ color: g.hex }))} />
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1">
          {TARGETS.map((t) => (
            <Button key={t.id} size="xs" variant="outline" className="px-1 text-[10px]" title={`Every head on ${t.label.toLowerCase()}`} onClick={() => setAllFx((f) => aimAt(f, t.at))}><Crosshair className="size-3" />{t.label}</Button>
          ))}
        </div>

        <div className="text-muted-foreground text-[10px] tracking-wide uppercase">Where they hang</div>
        <div className="grid grid-cols-2 gap-1">
          {PLACEMENTS.filter((p) => p.group === 'top').map((p) => <Button key={p.id} size="xs" variant="outline" className="text-[10.5px]" title={p.hint} onClick={() => place(p.id)}>Top · {p.label}</Button>)}
          {PLACEMENTS.filter((p) => p.group === 'bottom').map((p) => <Button key={p.id} size="xs" variant="outline" className="text-[10.5px]" title={p.hint} onClick={() => place(p.id)}>Deck · {p.label}</Button>)}
        </div>

        <div className="text-muted-foreground text-[10px] tracking-wide uppercase">Each head</div>
        <div className="space-y-1">
          {state.fixtures.map((f) => {
            const open = !!openFx[f.id]
            return (
              <div key={f.id} className="border-border/60 rounded-md border px-1.5 py-1">
                <div className="flex items-center gap-1.5">
                  <Switch checked={f.on} onCheckedChange={(on) => setFx(f.id, { on })} />
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-1 text-left text-[11.5px]" onClick={() => setOpenFx((o) => ({ ...o, [f.id]: !open }))}>
                    {open ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
                    <span className="truncate">{f.label}</span>
                    <span className="text-muted-foreground tabular ml-auto shrink-0 text-[10px]">{f.zoom}° · pan {Math.round(f.pan)}° · tilt {Math.round(f.tilt)}°</span>
                  </button>
                  <input type="color" value={hex(f.color)} className="size-5 shrink-0 cursor-pointer" onChange={(e) => setFx(f.id, { color: parseInt(e.target.value.slice(1), 16) })} />
                </div>
                {open && (
                  <div className="mt-1.5 space-y-1.5 pl-1">
                    <Row label="Intensity" value={`${Math.round(f.intensity * 100)}%`}><Slider min={0} max={1} step={0.02} value={[f.intensity]} onValueChange={([v]) => setFx(f.id, { intensity: v })} /></Row>
                    <Row label="Zoom — beam angle" value={`${f.zoom}°`}><Slider min={4} max={60} step={1} value={[f.zoom]} onValueChange={([v]) => setFx(f.id, { zoom: v })} /></Row>
                    <Row label="Pan" value={`${f.pan.toFixed(0)}°`}><Slider min={-270} max={270} step={1} value={[f.pan]} onValueChange={([v]) => setFx(f.id, { pan: v })} /></Row>
                    <Row label={`Tilt — 0° is straight ${f.mount === 'hung' ? 'down' : 'up'}`} value={`${f.tilt.toFixed(0)}°`}><Slider min={0} max={180} step={1} value={[f.tilt]} onValueChange={([v]) => setFx(f.id, { tilt: v })} /></Row>
                    <div className="grid grid-cols-4 gap-1">
                      {TARGETS.map((t) => <Button key={t.id} size="xs" variant="outline" className="px-1 text-[10px]" onClick={() => setFx(f.id, aimAt(f, t.at))}>{t.label}</Button>)}
                    </div>
                    <div className="grid grid-cols-6 gap-1">
                      {GELS.map((g) => <button key={g.id} type="button" title={g.label} className={cn('h-4 rounded border', f.color === g.hex ? 'border-foreground' : 'border-border')} style={{ background: hex(g.hex) }} onClick={() => setFx(f.id, { color: g.hex })} />)}
                    </div>
                    {([['x', 'Across', -22, 22], ['y', 'Height', 0, 7.5], ['z', 'Fore / aft', -7.4, 30]] as const).map(([k, lab, min, max], i) => (
                      <Row key={k} label={lab} value={`${f.pos[i].toFixed(1)} m`}>
                        <Slider min={min} max={max} step={0.1} value={[f.pos[i]]} onValueChange={([v]) => { const pos = [...f.pos] as [number, number, number]; pos[i] = v; setFx(f.id, { pos }) }} />
                      </Row>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* View */}
      <GroupLabel>View</GroupLabel>
      <div className="border-border/70 space-y-2 rounded-lg border px-2 pt-1.5 pb-2">
        <div className="grid grid-cols-4 gap-1">
          {VIEWS.map((v) => <Button key={v.id} size="xs" variant={state.view === v.id ? 'default' : 'secondary'} className="px-1" onClick={() => { patch((s) => ({ ...s, view: v.id })); api.current?.setView(v.id) }}>{v.label}</Button>)}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <label className="flex items-center gap-2 text-[11px]"><Switch checked={state.sizes} onCheckedChange={(sizes) => patch((s) => ({ ...s, sizes }))} /> Dimensions</label>
          <label className="flex items-center gap-2 text-[11px]"><Switch checked={state.figures} onCheckedChange={(figures) => patch((s) => ({ ...s, figures }))} /> Scale figures</label>
        </div>
        <div className="space-y-0.5">
          {MODEL_GROUPS.map((g) => (
            <label key={g.id} className="hover:bg-accent/40 flex cursor-pointer items-center gap-2 rounded-md px-1 py-1">
              <Switch checked={state.vis[g.id] !== false} onCheckedChange={(on) => patch((s) => ({ ...s, vis: { ...s.vis, [g.id]: on } }))} />
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: g.color, boxShadow: `0 0 8px ${g.color}66` }} />
              <span className="truncate text-[11px]">{g.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Share */}
      <GroupLabel>Share</GroupLabel>
      <div className="border-border/70 space-y-1.5 rounded-lg border px-2 pt-1.5 pb-2">
        <div className="grid grid-cols-2 gap-1.5">
          <Button size="xs" onClick={copyLink} title="A link that opens this exact look — heads, colours, LED pattern, view">{copied ? <Check className="size-3" /> : <Link2 className="size-3" />}{copied ? 'Copied' : 'Copy link'}</Button>
          <Button size="xs" variant="outline" onClick={saveStill} title="A 4K PNG of the current view"><Camera className="size-3" /> Save 4K still</Button>
          <Button size="xs" variant="outline" onClick={exportJson}><Download className="size-3" /> Export look</Button>
          <Button size="xs" variant="outline" onClick={() => importRef.current?.click()}><Upload className="size-3" /> Import look</Button>
          <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = '' }} />
        </div>
        <textarea value={state.note} onChange={(e) => patch((s) => ({ ...s, note: e.target.value }))} placeholder="Notes for whoever opens this look — cue, content file, what to check…"
          className="bg-secondary/60 focus:border-ring min-h-14 w-full rounded-md border border-transparent px-2 py-1 text-[11px] outline-none" />
        <Button size="xs" variant="ghost" className="w-full" onClick={reset}><RotateCcw className="size-3" /> Reset to the default look</Button>
        <p className="text-muted-foreground text-[10px] leading-relaxed">Looks save in this browser as you go. A link carries everything except an uploaded clip — send the file alongside it.</p>
      </div>
    </div>
  )

  return (
    <ViewerLayout
      mountRef={mount}
      loading={loading}
      title="Haveli stage"
      subtitle="The stage as modelled: 25.6 × 4.8 m back LED at 10240 × 1920, the cabin and chair, the forestage. Put content on the wall, point the six heads, share the look."
      hud="drag orbit · scroll zoom · right-drag pan"
      panel={panel}
      corner={
        <div className="flex flex-col items-end gap-1.5">
          <div className="bg-primary text-primary-foreground rounded-md px-2.5 py-1 text-[11px] font-bold tracking-[0.12em] shadow">HAVELI · {LED.px[0]} × {LED.px[1]}</div>
          <div className="card-glass text-muted-foreground rounded-md px-2 py-1 text-[10.5px]"><Copy className="mr-1 inline size-3" />{clipLabel} · {state.led.fit}</div>
        </div>
      }
    />
  )
}
