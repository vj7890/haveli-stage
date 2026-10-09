/**
 * Stage setups: a named layout of markers and arrows on the Haveli plan.
 * They are saved in this browser as you work, can be duplicated to keep a
 * version, backed up to a file, and shared as a link.
 *
 * Frame: x metres across (+ = stage left = house right, the OBJ's +X),
 * z metres toward the audience from the main stage's front edge (the OBJ's +Z),
 * so upstage is negative and the performance stage runs 0 → PERF.d.
 */
import { STAGE_TOP } from './geometry'

export type Shape = 'circle' | 'square' | 'triangle'
export type Role = { id: string; name: string; color: string; shape: Shape }
export type Marker = { id: string; role: string; x: number; z: number; label: string }
export type Arrow = { id: string; x1: number; z1: number; x2: number; z2: number }
export type Setup = { id: string; name: string; markers: Marker[]; arrows: Arrow[]; updated: number }
export type Library = { v: 1; setups: Setup[]; current: string }

export const ROLES: Role[] = [
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
export const roleOf = (id: string) => ROLES.find((r) => r.id === id) ?? ROLES[0]

export const uid = (p: string) => p + Math.random().toString(36).slice(2, 9)
export const blankSetup = (name: string): Setup => ({ id: uid('s_'), name, markers: [], arrows: [], updated: Date.now() })

export const STORE_KEY = 'haveli-setups-v1'
/** The old cue-by-cue tool's browser save; read once to carry its markers over. */
const OLD_KEY = 'haveli-blocking-v1'

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d)

/** Make anything that claims to be a setup safe to use. */
export function cleanSetup(s: unknown): Setup | null {
  if (!s || typeof s !== 'object') return null
  const o = s as Record<string, unknown>
  const markers = Array.isArray(o.markers) ? o.markers : []
  const arrows = Array.isArray(o.arrows) ? o.arrows : []
  return {
    id: str(o.id) || uid('s_'),
    name: str(o.name, 'Setup') || 'Setup',
    updated: num(o.updated, Date.now()),
    markers: markers.flatMap((m) => {
      if (!m || typeof m !== 'object') return []
      const q = m as Record<string, unknown>
      return [{ id: str(q.id) || uid('m_'), role: ROLES.some((r) => r.id === q.role) ? (q.role as string) : 'r_actor', x: num(q.x), z: num(q.z), label: str(q.label) }]
    }),
    arrows: arrows.flatMap((a) => {
      if (!a || typeof a !== 'object') return []
      const q = a as Record<string, unknown>
      return [{ id: str(q.id) || uid('a_'), x1: num(q.x1), z1: num(q.z1), x2: num(q.x2), z2: num(q.z2) }]
    }),
  }
}

/** The old tool kept one document of sections → cues → items. Any cue with markers becomes a setup. */
function fromOldTool(): Setup[] {
  try {
    const raw = localStorage.getItem(OLD_KEY)
    if (!raw) return []
    const d = JSON.parse(raw)
    const roleName = new Map<string, string>((d.roles || []).map((r: { id: string; name: string }) => [r.id, r.name]))
    const out: Setup[] = []
    for (const sec of d.sections || []) {
      for (const q of sec.cues || []) {
        const items = (q.items || []).filter((i: { x: number }) => Number.isFinite(i.x))
        const paths = (q.paths || []).filter((p: { x1: number }) => Number.isFinite(p.x1))
        if (!items.length && !paths.length) continue
        const name = [sec.code, q.no, q.title].filter(Boolean).join(' · ') || 'Old cue'
        out.push({
          id: uid('s_'), name, updated: Date.now(),
          markers: items.map((i: { roleId: string; x: number; y: number; label?: string; count?: number }) => {
            const known = ROLES.find((r) => r.id === i.roleId) ?? ROLES.find((r) => r.name === roleName.get(i.roleId))
            const n = i.count || 1
            return { id: uid('m_'), role: known?.id ?? 'r_actor', x: i.x, z: i.y - STAGE_TOP, label: i.label || (n > 1 ? `${n}×` : '') }
          }),
          arrows: paths.map((p: { x1: number; y1: number; x2: number; y2: number }) => ({ id: uid('a_'), x1: p.x1, z1: p.y1 - STAGE_TOP, x2: p.x2, z2: p.y2 - STAGE_TOP })),
        })
      }
    }
    return out
  } catch {
    return []
  }
}

export function loadLibrary(): Library {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) {
      const d = JSON.parse(raw)
      const setups = (Array.isArray(d.setups) ? d.setups : []).map(cleanSetup).filter(Boolean) as Setup[]
      if (setups.length) return { v: 1, setups, current: setups.some((s) => s.id === d.current) ? d.current : setups[0].id }
    }
  } catch {}
  const old = fromOldTool()
  const setups = old.length ? old : [blankSetup('Setup 1')]
  return { v: 1, setups, current: setups[0].id }
}

export function saveLibrary(lib: Library): boolean {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(lib))
    return true
  } catch {
    return false
  }
}

/** Merge setups from a backup or a link: same id → the newer one wins; new ids are added. */
export function mergeSetups(lib: Library, incoming: Setup[]): { lib: Library; added: number; updated: number } {
  const setups = [...lib.setups]
  let added = 0, updated = 0
  for (const s of incoming) {
    const i = setups.findIndex((x) => x.id === s.id)
    if (i < 0) { setups.push(s); added++ }
    else if (s.updated > setups[i].updated) { setups[i] = s; updated++ }
  }
  return { lib: { ...lib, setups }, added, updated }
}

/* ---- the share link: #setup=<base64url JSON> ------------------------------- */

const b64url = (u8: Uint8Array) => {
  let s = ''
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const unb64url = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  const u8 = new Uint8Array(b.length)
  for (let i = 0; i < b.length; i++) u8[i] = b.charCodeAt(i)
  return u8
}
const round = (v: number) => Math.round(v * 100) / 100

export function encodeLink(s: Setup): string {
  const slim = {
    ...s,
    markers: s.markers.map((m) => ({ ...m, x: round(m.x), z: round(m.z) })),
    arrows: s.arrows.map((a) => ({ ...a, x1: round(a.x1), z1: round(a.z1), x2: round(a.x2), z2: round(a.z2) })),
  }
  return b64url(new TextEncoder().encode(JSON.stringify(slim)))
}
export function decodeLink(hash: string): Setup | null {
  const m = /[#&]setup=([A-Za-z0-9_-]+)/.exec(hash)
  if (!m) return null
  try {
    return cleanSetup(JSON.parse(new TextDecoder().decode(unb64url(m[1]))))
  } catch {
    return null
  }
}

/* ---- files ---------------------------------------------------------------- */

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'setup'

export function download(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

let CRC: Uint32Array | null = null
function crc32(u8: Uint8Array) {
  if (!CRC) {
    CRC = new Uint32Array(256)
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0 }
  }
  let c = -1
  for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
/** A store-only zip — enough to hand over a folder of PNGs without a dependency. */
export function zipStore(files: { name: string; data: Uint8Array }[]): Blob {
  const enc = new TextEncoder(), parts: BlobPart[] = [], central: BlobPart[] = []
  const now = new Date()
  const dosT = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)
  const dosD = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()
  let off = 0
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), n = f.data.length
    const lh = new DataView(new ArrayBuffer(30))
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true)
    lh.setUint16(10, dosT, true); lh.setUint16(12, dosD, true); lh.setUint32(14, crc, true); lh.setUint32(18, n, true)
    lh.setUint32(22, n, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true)
    parts.push(lh.buffer, name as BlobPart, f.data as BlobPart)
    const cd = new DataView(new ArrayBuffer(46))
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true)
    cd.setUint16(10, 0, true); cd.setUint16(12, dosT, true); cd.setUint16(14, dosD, true); cd.setUint32(16, crc, true)
    cd.setUint32(20, n, true); cd.setUint32(24, n, true); cd.setUint16(28, name.length, true)
    for (const o of [30, 32, 34, 36]) cd.setUint16(o, 0, true)
    cd.setUint32(38, 0, true); cd.setUint32(42, off, true)
    central.push(cd.buffer, name as BlobPart)
    off += 30 + name.length + n
  }
  const size = central.reduce((a: number, b) => a + (b instanceof ArrayBuffer ? b.byteLength : (b as Uint8Array).length), 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true)
  end.setUint32(12, size, true); end.setUint32(16, off, true)
  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' })
}
