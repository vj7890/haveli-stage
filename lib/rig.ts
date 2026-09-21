import * as THREE from 'three'
import { STAGE, TARGETS } from './venue'

/**
 * The rig: six moving heads — four up top, two on the deck — each a real
 * yoke-and-head with pan and tilt, a beam you can see, and a real SpotLight so
 * the set actually takes its colour. Nothing is on a truss: the model has no
 * ceiling, so every hang position is a number you can move.
 *
 * Pan 0 / tilt 0 is the head pointing straight down for a hung fixture, and
 * straight up for one standing on the deck. At pan 0, tilt tips the beam
 * upstage as it grows; pan then swings that tilted beam round the fixture's
 * axis, positive toward house right. Aim buttons solve both from a target.
 */

export type Mount = 'hung' | 'floor'
export type FixtureKind = 'spot' | 'wash' | 'beam'
export type Fixture = {
  id: string
  label: string
  group: 'top' | 'bottom'
  mount: Mount
  kind: FixtureKind
  pos: [number, number, number]
  pan: number
  tilt: number
  color: number
  intensity: number   // 0–1
  zoom: number        // full beam angle, degrees
  on: boolean
}

export type Sweep = { on: boolean; speed: number; spread: number }
export type RigSettings = { on: boolean; haze: number; house: number; beamGain: number; sweep: Sweep }

export const RIG_DEFAULTS: RigSettings = { on: true, haze: 0.9, house: 0.14, beamGain: 1, sweep: { on: false, speed: 1, spread: 1 } }

/** Where the fixtures can be put, per group. Metres. */
export const PLACEMENTS: { id: string; group: 'top' | 'bottom'; label: string; hint: string; pos: [number, number, number][] }[] = [
  { id: 'top-foh', group: 'top', label: 'Front of house', hint: 'A line 7 m up, 5 m into the room — a front truss position',
    pos: [[-9, 7, 5], [-3, 7, 5], [3, 7, 5], [9, 7, 5]] },
  { id: 'top-stage', group: 'top', label: 'Over the stage', hint: '7 m up over the main stage front edge',
    pos: [[-9, 7, -0.8], [-3, 7, -0.8], [3, 7, -0.8], [9, 7, -0.8]] },
  { id: 'top-wide', group: 'top', label: 'Wide, either side', hint: 'Two each side, 7 m up, out over the cordons',
    pos: [[-16, 7, 2], [-12, 7, -1], [12, 7, -1], [16, 7, 2]] },
  { id: 'top-back', group: 'top', label: 'Above the LED', hint: 'Just under the 7.6 m wall top, in front of the screen',
    pos: [[-9, 7.1, -6.5], [-3, 7.1, -6.5], [3, 7.1, -6.5], [9, 7.1, -6.5]] },
  { id: 'bot-front', group: 'bottom', label: 'Deck front corners', hint: 'On the main stage at the stair heads',
    pos: [[-10.6, STAGE.deckH, -0.6], [10.6, STAGE.deckH, -0.6]] },
  { id: 'bot-back', group: 'bottom', label: 'Upstage, by the LED', hint: 'On the backstage deck against the screen ends',
    pos: [[-11.5, STAGE.deckH, -6.6], [11.5, STAGE.deckH, -6.6]] },
  { id: 'bot-floor', group: 'bottom', label: 'Hall floor, by the forestage', hint: 'On the hall floor either side of the forestage',
    pos: [[-6.2, 0, 1.5], [6.2, 0, 1.5]] },
  { id: 'bot-cabin', group: 'bottom', label: 'Either side of the cabin', hint: 'On the main stage flanking the cabin',
    pos: [[-5.2, STAGE.deckH, -3], [5.2, STAGE.deckH, -3]] },
]

export const GELS: { id: string; label: string; hex: number }[] = [
  { id: 'white', label: 'White', hex: 0xfff4e0 },
  { id: 'cool', label: 'Cool white', hex: 0xe6f0ff },
  { id: 'saffron', label: 'Saffron', hex: 0xff7a00 },
  { id: 'gold', label: 'Gold', hex: 0xffc63d },
  { id: 'amber', label: 'Amber', hex: 0xffb020 },
  { id: 'red', label: 'Red', hex: 0xff2a2a },
  { id: 'magenta', label: 'Magenta', hex: 0xff2e88 },
  { id: 'violet', label: 'Violet', hex: 0x7b4dff },
  { id: 'blue', label: 'Blue', hex: 0x286eff },
  { id: 'cyan', label: 'Cyan', hex: 0x12d8e8 },
  { id: 'emerald', label: 'Emerald', hex: 0x1ee8a0 },
  { id: 'lav', label: 'Lavender', hex: 0xc4a3ff },
]

const F = (id: string, label: string, group: 'top' | 'bottom', pos: [number, number, number], extra: Partial<Fixture> = {}): Fixture => ({
  id, label, group, mount: group === 'top' ? 'hung' : 'floor', kind: 'spot', pos, pan: 0, tilt: 0,
  color: 0xfff4e0, intensity: 0.8, zoom: 18, on: true, ...extra,
})

/** The six as delivered: four up top over the stage front, two on the deck corners. */
export function defaultFixtures(): Fixture[] {
  const top = PLACEMENTS.find((p) => p.id === 'top-stage')!.pos
  const bot = PLACEMENTS.find((p) => p.id === 'bot-front')!.pos
  const fx = [
    F('t1', 'Top 1', 'top', top[0]), F('t2', 'Top 2', 'top', top[1]), F('t3', 'Top 3', 'top', top[2]), F('t4', 'Top 4', 'top', top[3]),
    F('b1', 'Bottom 1', 'bottom', bot[0], { zoom: 12, intensity: 0.7 }), F('b2', 'Bottom 2', 'bottom', bot[1], { zoom: 12, intensity: 0.7 }),
  ]
  // the Darshan look to start: every head on the chair
  return applyLook(LOOKS[0], fx)
}

// ---- kinematics -------------------------------------------------------------

const up = new THREE.Vector3(0, 1, 0)
/** Pan and tilt that point a fixture at a scene point. */
export function aimAt(f: Pick<Fixture, 'pos' | 'mount'>, at: [number, number, number]): { pan: number; tilt: number } {
  const d = new THREE.Vector3(at[0] - f.pos[0], at[1] - f.pos[1], at[2] - f.pos[2]).normalize()
  // into fixture-local: a floor fixture is the hung one turned over (π about X)
  if (f.mount === 'floor') { d.y = -d.y; d.z = -d.z }
  // local beam = Ry(−pan) · Rx(tilt) · (0,−1,0) = (sin t sin p, −cos t, −sin t cos p)
  const tilt = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(-d.y, -1, 1)))
  const st = Math.sin(THREE.MathUtils.degToRad(tilt))
  const pan = st < 1e-4 ? 0 : THREE.MathUtils.radToDeg(Math.atan2(d.x / st, -d.z / st))
  return { pan: Math.round(pan * 10) / 10, tilt: Math.round(tilt * 10) / 10 }
}

/** The world direction a fixture's beam points, from its pan and tilt. */
export function beamDir(f: Pick<Fixture, 'pan' | 'tilt' | 'mount'>): [number, number, number] {
  const t = THREE.MathUtils.degToRad(f.tilt), p = THREE.MathUtils.degToRad(f.pan)
  const d: [number, number, number] = [Math.sin(t) * Math.sin(p), -Math.cos(t), -Math.sin(t) * Math.cos(p)]
  if (f.mount === 'floor') { d[1] = -d[1]; d[2] = -d[2] }
  return d
}

// ---- the 3D rig -----------------------------------------------------------------

type Head = {
  f: Fixture
  root: THREE.Group      // at pos, flipped for floor mounts
  yoke: THREE.Group      // pans about Y
  head: THREE.Group      // tilts about X, inside the yoke
  lens: THREE.Mesh
  cone: THREE.Mesh
  coneMat: THREE.MeshBasicMaterial
  spot: THREE.SpotLight
  phase: number
  base: { pan: number; tilt: number }
}

export type Rig = ReturnType<typeof buildRig>

/**
 * @param occluders what a beam stops at — the set, the LED, the hall. Each
 * beam is raycast along its axis every frame and its cone cut at the first
 * hit, so light ends on the surface it lands on instead of passing through.
 */
export function buildRig(fixtures: Fixture[], occluders: THREE.Object3D[] = []) {
  const group = new THREE.Group()
  const mats: THREE.Material[] = []
  const metal = new THREE.MeshStandardMaterial({ color: 0x1b1e23, roughness: 0.55, metalness: 0.7 })
  const metalDim = new THREE.MeshStandardMaterial({ color: 0x2a2e35, roughness: 0.7, metalness: 0.5 })
  mats.push(metal, metalDim)
  const FLOOR = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const BEAM_LEN = 34
  const ray = new THREE.Raycaster()
  ray.far = BEAM_LEN
  const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion()

  const heads: Head[] = []
  const S: RigSettings = { ...RIG_DEFAULTS, sweep: { ...RIG_DEFAULTS.sweep } }
  let clock = 0

  const makeHead = (f: Fixture): Head => {
    const root = new THREE.Group()
    root.position.set(...f.pos)
    if (f.mount === 'floor') root.rotation.x = Math.PI
    // base plate and yoke
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.36), metal); base.position.y = -0.06
    const yoke = new THREE.Group(); yoke.position.y = -0.12
    const arm = (sx: number) => { const a = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.14), metalDim); a.position.set(sx * 0.2, -0.2, 0); return a }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.06, 0.16), metalDim); bridge.position.y = -0.03
    yoke.add(arm(-1), arm(1), bridge)
    // head, pivoting on the yoke arms
    const head = new THREE.Group(); head.position.y = -0.36
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.135, 0.4, 20), metal); body.position.y = -0.02
    const lensMat = new THREE.MeshBasicMaterial({ color: f.color, toneMapped: false }); mats.push(lensMat)
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.105, 24), lensMat); lens.rotation.x = Math.PI / 2; lens.position.y = -0.225
    head.add(body, lens)
    // the beam: a unit open cone from the lens, scaled to the hit distance each
    // frame, brightest at the lens and still half there where it lands
    const cg = new THREE.ConeGeometry(1, 1, 28, 1, true)
    cg.translate(0, -0.5, 0)
    const cols: number[] = []
    const p = cg.getAttribute('position')
    for (let i = 0; i < p.count; i++) { const k = 1 - 0.5 * Math.min(1, -p.getY(i)); cols.push(k, k, k) }
    cg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3))
    const coneMat = new THREE.MeshBasicMaterial({ color: f.color, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, vertexColors: true, clippingPlanes: [FLOOR] })
    mats.push(coneMat)
    const cone = new THREE.Mesh(cg, coneMat); cone.position.y = -0.23; cone.frustumCulled = false
    head.add(cone)
    // the real light
    const spot = new THREE.SpotLight(f.color, 0, 60, THREE.MathUtils.degToRad(f.zoom / 2), 0.45, 1.3)
    spot.position.set(0, -0.23, 0)
    spot.target.position.set(0, -10, 0)
    spot.castShadow = f.group === 'top'
    spot.shadow.mapSize.set(1024, 1024)
    spot.shadow.bias = -0.0002
    spot.shadow.camera.near = 0.5
    spot.shadow.camera.far = 60
    head.add(spot, spot.target)
    yoke.add(head)
    root.add(base, yoke)
    group.add(root)
    const h: Head = { f, root, yoke, head, lens, cone, coneMat, spot, phase: Math.random() * 6.283, base: { pan: f.pan, tilt: f.tilt } }
    applyHead(h)
    return h
  }

  const applyHead = (h: Head) => {
    const f = h.f
    h.root.position.set(...f.pos)
    h.root.rotation.x = f.mount === 'floor' ? Math.PI : 0
    const cone = f.zoom / 2
    h.spot.angle = THREE.MathUtils.degToRad(cone)
    h.spot.color.setHex(f.color)
    h.coneMat.color.setHex(f.color)
    ;(h.lens.material as THREE.MeshBasicMaterial).color.setHex(f.color).multiplyScalar(f.on ? 1 : 0.15)
    const lvl = f.on && S.on ? f.intensity : 0
    // narrow beams are brighter per area, and haze is what makes any of them visible
    h.coneMat.opacity = 0.11 * lvl * S.beamGain * Math.sqrt(18 / Math.max(6, f.zoom)) * (0.35 + 0.65 * Math.sqrt(S.haze))
    h.cone.visible = lvl > 0.01
    h.spot.intensity = 420 * lvl * (f.kind === 'wash' ? 0.7 : 1)
    h.spot.visible = lvl > 0.01
    h.base.pan = f.pan; h.base.tilt = f.tilt
    if (!S.sweep.on) pose(h, f.pan, f.tilt)
    cut(h)
  }
  const pose = (h: Head, pan: number, tilt: number) => {
    h.yoke.rotation.y = -THREE.MathUtils.degToRad(pan)
    h.head.rotation.x = THREE.MathUtils.degToRad(tilt)
  }
  /** Cut the beam at the first thing it lands on. */
  const cut = (h: Head) => {
    h.root.updateWorldMatrix(true, true)
    h.lens.getWorldPosition(_o)
    _d.set(0, -1, 0).applyQuaternion(h.head.getWorldQuaternion(_q))
    let L = BEAM_LEN
    if (occluders.length) {
      ray.set(_o, _d)
      const hit = ray.intersectObjects(occluders, false)[0]
      if (hit) L = Math.max(0.3, hit.distance + 0.05)
    }
    const r = L * Math.tan(THREE.MathUtils.degToRad(h.f.zoom / 2))
    h.cone.scale.set(r, L, r)
  }

  for (const f of fixtures) heads.push(makeHead(f))

  // Haze: a touch of depth fog, mostly the beams reading brighter (applyHead).
  const haze = new THREE.FogExp2(0x14110e, 0.006)
  const HAZE0 = 0.006

  const update = (dt: number) => {
    if (!S.on) return
    if (S.sweep.on) {
      clock += dt * S.sweep.speed
      for (const h of heads) {
        if (!h.f.on) continue
        const sp = S.sweep.spread
        const pan = h.base.pan + Math.sin(clock * 0.9 + h.phase) * 22 * sp
        const tilt = h.base.tilt + Math.sin(clock * 0.6 + h.phase * 1.7) * 9 * sp
        pose(h, pan, tilt)
        cut(h)
      }
    }
  }

  return {
    group, mats, haze, heads,
    get settings() { return { ...S, sweep: { ...S.sweep } } },
    /** Replace one fixture's values and re-pose it. */
    setFixture(f: Fixture) { const h = heads.find((x) => x.f.id === f.id); if (!h) return; h.f = f; applyHead(h) },
    setFixtures(fx: Fixture[]) { for (const f of fx) this.setFixture(f) },
    setSettings(patch: Partial<RigSettings>) {
      Object.assign(S, patch, patch.sweep ? { sweep: { ...S.sweep, ...patch.sweep } } : {})
      haze.density = HAZE0 * S.haze
      group.visible = S.on
      for (const h of heads) applyHead(h)
    },
    update,
    /** The direction each head is pointing right now, for the HUD. */
    dirOf(id: string) { const h = heads.find((x) => x.f.id === id); if (!h) return null; return new THREE.Vector3(0, -1, 0).applyQuaternion(h.head.getWorldQuaternion(new THREE.Quaternion())) },
    dispose() { for (const h of heads) { h.cone.geometry.dispose() } mats.forEach((m) => m.dispose()) },
  }
}
void up

// ---- looks ---------------------------------------------------------------------

export type Look = {
  id: string
  label: string
  hint: string
  /** Per fixture id: what to change. `aim` resolves to pan/tilt from a target id. */
  fx: Record<string, Partial<Pick<Fixture, 'color' | 'intensity' | 'zoom' | 'on' | 'pan' | 'tilt'>> & { aim?: string }>
  rig?: Partial<RigSettings>
}

const all = (v: Look['fx'][string]) => ({ t1: v, t2: v, t3: v, t4: v, b1: v, b2: v })

export const LOOKS: Look[] = [
  { id: 'darshan', label: 'Darshan', hint: 'The top four tight and warm on the chair through the glass; the deck pair a soft fill from the front corners',
    fx: { ...all({ aim: 'chair', color: 0xfff4e0, intensity: 0.85, zoom: 12, on: true }), b1: { aim: 'chair', color: 0xffe2b8, intensity: 0.35, zoom: 9 }, b2: { aim: 'chair', color: 0xffe2b8, intensity: 0.35, zoom: 9 } },
    rig: { haze: 0.9, house: 0.14, sweep: { on: false, speed: 1, spread: 1 } } },
  { id: 'wash', label: 'Stage wash', hint: 'Top four open wide across the deck in saffron and gold, bottom two up the LED ends',
    fx: { t1: { aim: 'centre', color: 0xff7a00, intensity: 0.9, zoom: 42 }, t2: { aim: 'fore', color: 0xffc63d, intensity: 0.9, zoom: 42 }, t3: { aim: 'fore', color: 0xffc63d, intensity: 0.9, zoom: 42 }, t4: { aim: 'centre', color: 0xff7a00, intensity: 0.9, zoom: 42 },
      b1: { aim: 'ledL', color: 0xffb020, intensity: 0.6, zoom: 20 }, b2: { aim: 'ledR', color: 0xffb020, intensity: 0.6, zoom: 20 } },
    rig: { haze: 0.8, house: 0.22, sweep: { on: false, speed: 1, spread: 1 } } },
  { id: 'cross', label: 'Crossing beams', hint: 'Tight beams crossing over the cabin, the bottom pair firing up behind it',
    fx: { t1: { aim: 'ledR', color: 0x12d8e8, intensity: 1, zoom: 7 }, t2: { aim: 'cabin', color: 0x7b4dff, intensity: 1, zoom: 7 }, t3: { aim: 'cabin', color: 0x7b4dff, intensity: 1, zoom: 7 }, t4: { aim: 'ledL', color: 0x12d8e8, intensity: 1, zoom: 7 },
      b1: { pan: -35, tilt: 35, color: 0xff2e88, intensity: 1, zoom: 6 }, b2: { pan: 35, tilt: 35, color: 0xff2e88, intensity: 1, zoom: 6 } },
    rig: { haze: 1.8, house: 0.04, sweep: { on: false, speed: 1, spread: 1 } } },
  { id: 'audience', label: 'Into the room', hint: 'Top four turned out over the audience in cool white, bottom two low on the forestage',
    fx: { t1: { aim: 'house', color: 0xe6f0ff, intensity: 0.8, zoom: 30 }, t2: { aim: 'house', color: 0xe6f0ff, intensity: 0.8, zoom: 30 }, t3: { aim: 'house', color: 0xe6f0ff, intensity: 0.8, zoom: 30 }, t4: { aim: 'house', color: 0xe6f0ff, intensity: 0.8, zoom: 30 },
      b1: { aim: 'fore', color: 0xffb020, intensity: 0.5, zoom: 24 }, b2: { aim: 'fore', color: 0xffb020, intensity: 0.5, zoom: 24 } },
    rig: { haze: 1.2, house: 0.1, sweep: { on: false, speed: 1, spread: 1 } } },
  { id: 'sweep', label: 'Sweep', hint: 'Full colour, every head moving',
    fx: { t1: { aim: 'centre', color: 0xff2e88, intensity: 1, zoom: 10 }, t2: { aim: 'fore', color: 0x12d8e8, intensity: 1, zoom: 10 }, t3: { aim: 'fore', color: 0xffb020, intensity: 1, zoom: 10 }, t4: { aim: 'centre', color: 0x7b4dff, intensity: 1, zoom: 10 },
      b1: { pan: -20, tilt: 40, color: 0x286eff, intensity: 1, zoom: 8 }, b2: { pan: 20, tilt: 40, color: 0x1ee8a0, intensity: 1, zoom: 8 } },
    rig: { haze: 1.6, house: 0.03, sweep: { on: true, speed: 1.2, spread: 1 } } },
  { id: 'aarti', label: 'Aarti', hint: 'Warm and slow: gold on the cabin, saffron on the deck, house light up',
    fx: { t1: { aim: 'centre', color: 0xff7a00, intensity: 0.7, zoom: 36 }, t2: { aim: 'cabin', color: 0xffc63d, intensity: 0.9, zoom: 16 }, t3: { aim: 'cabin', color: 0xffc63d, intensity: 0.9, zoom: 16 }, t4: { aim: 'centre', color: 0xff7a00, intensity: 0.7, zoom: 36 },
      b1: { aim: 'cabin', color: 0xffd166, intensity: 0.5, zoom: 14 }, b2: { aim: 'cabin', color: 0xffd166, intensity: 0.5, zoom: 14 } },
    rig: { haze: 0.7, house: 0.3, sweep: { on: true, speed: 0.25, spread: 0.3 } } },
  { id: 'off', label: 'Rig off', hint: 'House light only — the set and the wall as built',
    fx: all({ on: false }), rig: { haze: 0, house: 0.6, sweep: { on: false, speed: 1, spread: 1 } } },
]

/** Resolve a look against the current fixtures. */
export function applyLook(look: Look, fixtures: Fixture[]): Fixture[] {
  return fixtures.map((f) => {
    const v = look.fx[f.id]
    if (!v) return f
    const { aim, ...rest } = v
    const next = { ...f, ...rest, on: rest.on ?? true }
    if (aim) { const t = TARGETS.find((x) => x.id === aim); if (t) Object.assign(next, aimAt(next, t.at)) }
    return next
  })
}
