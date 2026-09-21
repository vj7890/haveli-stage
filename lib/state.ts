import { defaultFixtures, RIG_DEFAULTS, type Fixture, type RigSettings } from './rig'
import type { FitMode } from './led'

/** Everything a look is — what the panel edits, what a share link carries. */
export type AppState = {
  v: 1
  led: { on: boolean; clip: string; fit: FitMode; level: number; bloom: number; guides: { cabin: boolean; grid: boolean } }
  rig: RigSettings
  fixtures: Fixture[]
  view: string
  sizes: boolean
  figures: boolean
  vis: Record<string, boolean>
  note: string
}

export const VIEWS: { id: string; label: string }[] = [
  { id: 'audience', label: 'Audience' },
  { id: 'front', label: 'Front' },
  { id: 'iso', label: 'Iso' },
  { id: 'plan', label: 'Plan' },
  { id: 'side', label: 'Side' },
  { id: 'cabin', label: 'Cabin' },
  { id: 'stage', label: 'On stage' },
  { id: 'led', label: 'LED close' },
]

export function defaultState(): AppState {
  return {
    v: 1,
    led: { on: true, clip: 'gen:testcard', fit: 'cover', level: 1, bloom: 0.25, guides: { cabin: false, grid: false } },
    rig: { ...RIG_DEFAULTS, sweep: { ...RIG_DEFAULTS.sweep } },
    fixtures: defaultFixtures(),
    view: 'audience',
    sizes: false,
    figures: true,
    vis: { stage: true, forestage: true, led: true, cabin: true, masking: true, hall: true },
    note: '',
  }
}

export const STORE_KEY = 'haveli-stage-look-v1'

/** Merge a partial/unknown object onto the defaults, keeping shapes sane. */
export function coerce(input: unknown): AppState {
  const d = defaultState()
  if (!input || typeof input !== 'object') return d
  const o = input as Partial<AppState>
  const fx = Array.isArray(o.fixtures)
    ? d.fixtures.map((f) => {
        const u = (o.fixtures as Fixture[]).find((x) => x && x.id === f.id)
        if (!u) return f
        const pos = Array.isArray(u.pos) && u.pos.length === 3 && u.pos.every((n) => typeof n === 'number' && Number.isFinite(n)) ? (u.pos as [number, number, number]) : f.pos
        return { ...f, ...u, pos, id: f.id, group: f.group, mount: f.mount }
      })
    : d.fixtures
  return {
    v: 1,
    led: { ...d.led, ...(o.led ?? {}), guides: { ...d.led.guides, ...(o.led?.guides ?? {}) } },
    rig: { ...d.rig, ...(o.rig ?? {}), sweep: { ...d.rig.sweep, ...(o.rig?.sweep ?? {}) } },
    fixtures: fx,
    view: typeof o.view === 'string' ? o.view : d.view,
    sizes: !!o.sizes,
    figures: o.figures === undefined ? d.figures : !!o.figures,
    vis: { ...d.vis, ...(o.vis ?? {}) },
    note: typeof o.note === 'string' ? o.note.slice(0, 2000) : '',
  }
}

// ---- share link: the whole look in the URL hash ----------------------------------
// An uploaded clip can't travel in a link; the link falls back to the test card.

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64 = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))

export function encodeShare(s: AppState): string {
  const out: AppState = { ...s, led: { ...s.led, clip: s.led.clip === 'upload' || !s.led.clip.startsWith('gen:') ? 'gen:testcard' : s.led.clip } }
  return b64(JSON.stringify(out))
}
export function decodeShare(hash: string): AppState | null {
  const m = /[#&]s=([A-Za-z0-9_-]+)/.exec(hash)
  if (!m) return null
  try { return coerce(JSON.parse(unb64(m[1]))) } catch { return null }
}
